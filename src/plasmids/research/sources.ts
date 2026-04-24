/**
 * Phase 5 — Research source helpers (canonicalisation, dedupe, ranking).
 *
 * Pure functions. No I/O, no global state. Owned by Team 1
 * (Phase 5 GAL-1 dev-guide §2).
 *
 * The canonicalisation rules are intentionally narrow — we only strip
 * well-known tracking parameters and normalise host casing / trailing
 * slashes. Anything more aggressive (e.g. stripping fragments) risks
 * losing semantically meaningful URLs (anchored docs).
 */

/** Tracking-style query parameters that are dropped during canonicalisation. */
const TRACKING_PARAM_PREFIXES: readonly string[] = ["utm_"];
const TRACKING_PARAM_EXACT: ReadonlySet<string> = new Set([
  "gclid",
  "fbclid",
  "ref",
  "ref_src",
  "ref_url",
  "mc_cid",
  "mc_eid",
  "yclid",
  "_hsenc",
  "_hsmi",
]);

/** Minimum candidate shape — anything with a URL counts. */
export interface Candidate {
  readonly url: string;
  readonly title: string;
  readonly snippet?: string;
}

/**
 * Canonicalise a URL for dedupe + storage.
 *
 * Rules (kept conservative on purpose):
 * - Lowercase the host (paths/queries are case-sensitive on most servers).
 * - Strip tracking params (`utm_*`, `gclid`, `fbclid`, `ref`, `mc_*`, etc.).
 * - Drop trailing slash on the pathname (but keep "/" for the root).
 * - Sort remaining query params alphabetically so `?b=1&a=2` and `?a=2&b=1`
 *   collapse to the same canonical form.
 * - Preserve scheme, port, fragment, userinfo verbatim.
 *
 * If the input is not a parseable URL we return the original string so the
 * caller can decide whether to drop it (we still get a stable dedupe key).
 */
export function canonicalizeUrl(url: string): string {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return url;
  }

  // Lowercase host (case-insensitive per RFC 3986 §3.2.2).
  parsed.hostname = parsed.hostname.toLowerCase();

  // Drop tracking params, sort the survivors.
  const survivors: [string, string][] = [];
  for (const [key, value] of parsed.searchParams.entries()) {
    if (isTrackingParam(key)) continue;
    survivors.push([key, value]);
  }
  survivors.sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  // Replace the query in-place so we keep the URL's serialisation rules.
  for (const key of [...parsed.searchParams.keys()]) {
    parsed.searchParams.delete(key);
  }
  for (const [k, v] of survivors) {
    parsed.searchParams.append(k, v);
  }

  // Trailing slash normalisation: keep "/" for site root, strip it
  // elsewhere so "/docs/" and "/docs" collapse together.
  if (parsed.pathname.length > 1 && parsed.pathname.endsWith("/")) {
    parsed.pathname = parsed.pathname.replace(/\/+$/u, "");
  }

  return parsed.toString();
}

function isTrackingParam(key: string): boolean {
  const lower = key.toLowerCase();
  if (TRACKING_PARAM_EXACT.has(lower)) return true;
  return TRACKING_PARAM_PREFIXES.some((prefix) => lower.startsWith(prefix));
}

/**
 * Dedupe candidates by canonical URL. The first occurrence wins so callers
 * that pre-rank by relevance keep the best snippet/title.
 */
export function dedupeByCanonicalUrl(
  refs: readonly Candidate[],
): readonly Candidate[] {
  const seen = new Set<string>();
  const out: Candidate[] = [];
  for (const ref of refs) {
    const key = canonicalizeUrl(ref.url);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ ...ref, url: key });
  }
  return out;
}

/**
 * Rank candidates by simple intent-token overlap against `title + snippet`.
 *
 * Scoring is intentionally cheap — Phase 5 doesn't need TF-IDF: the LLM
 * does the heavy lifting downstream. We just want stable ordering so the
 * top-N surface is reproducible.
 *
 * Scoring rules:
 * - Tokenise on Unicode word boundaries, lowercase, drop tokens shorter than 2.
 * - Title hits weigh 2x snippet hits (titles are tighter, more salient).
 * - Stable sort: equal scores preserve input order.
 */
export function rankByIntentOverlap<T extends Candidate>(
  intent: string,
  refs: readonly T[],
): readonly T[] {
  const intentTokens = tokenize(intent);
  if (intentTokens.size === 0) {
    // Nothing to score on — preserve input order.
    return [...refs];
  }
  const scored = refs.map((ref, idx) => ({
    ref,
    idx,
    score:
      overlap(tokenize(ref.title), intentTokens) * 2 +
      overlap(tokenize(ref.snippet ?? ""), intentTokens),
  }));
  scored.sort((a, b) => b.score - a.score || a.idx - b.idx);
  return scored.map((s) => s.ref);
}

function tokenize(text: string): ReadonlySet<string> {
  const out = new Set<string>();
  // Match runs of letters/digits in any Unicode script.
  for (const m of text.toLowerCase().matchAll(/[\p{L}\p{N}]{2,}/gu)) {
    out.add(m[0]);
  }
  return out;
}

function overlap(a: ReadonlySet<string>, b: ReadonlySet<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  const [small, large] = a.size <= b.size ? [a, b] : [b, a];
  let count = 0;
  for (const token of small) {
    if (large.has(token)) count += 1;
  }
  return count;
}

/**
 * Take the first N items from a list. Returns a fresh readonly array
 * (no aliasing the caller's storage).
 */
export function topN<T>(items: readonly T[], n: number): readonly T[] {
  if (n <= 0) return [];
  if (n >= items.length) return [...items];
  return items.slice(0, n);
}
