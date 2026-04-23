/**
 * BEGIN / END marker grammar for `plasmid-derived` sections in DHELIX.md.
 *
 * LOCKED format (P-1.15 v0.2):
 *   <!-- BEGIN plasmid-derived: <marker-id> -->
 *   ...body...
 *   <!-- END plasmid-derived: <marker-id> -->
 *
 * `<marker-id>` is one of:
 *   - `<plasmid-id>/<kebab-slug>`   (preferred — P-1.15 task spec)
 *   - `<kebab-slug>`                (legacy — design doc v0.2 §1.1)
 *
 * Total length ≤ 96 chars. BEGIN + END ids must match. Markers live on their
 * own line; leading/trailing whitespace tolerated (see regex below).
 *
 * Layer: Core (Layer 2). Leaf-pure — no I/O, no LLM, no fs.
 */

/**
 * Upper bound on marker-id length. Enforced at parse and render time so a
 * pathological LLM cannot inflate DHELIX.md with a multi-kilobyte marker.
 */
export const MARKER_ID_MAX_LENGTH = 96;

/**
 * Marker-id shape. Two permitted forms:
 *   1. `<plasmid-id>/<slug>` where both halves are kebab-case ([a-z0-9-]+).
 *   2. `<slug>` (legacy) where the whole id is kebab-case.
 * Leading digits are allowed (e.g. `owasp-gate/v2-posture`); trailing hyphens
 * are not (e.g. `foo/bar-` is rejected).
 */
const MARKER_ID_SEGMENT = "[a-z0-9]+(?:-[a-z0-9]+)*";
const MARKER_ID_RE = new RegExp(
  `^${MARKER_ID_SEGMENT}(?:\\/${MARKER_ID_SEGMENT})?$`,
);

/** `^\s*<!--\s+BEGIN\s+plasmid-derived:\s+<id>\s+-->\s*$` (multiline). */
export const BEGIN_MARKER_RE =
  /^[ \t]*<!--[ \t]+BEGIN[ \t]+plasmid-derived:[ \t]+([^\s<>-][^\s<>]*(?:[ \t]+[^\s<>]+)*?)[ \t]+-->[ \t]*$/;

/** `^\s*<!--\s+END\s+plasmid-derived:\s+<id>\s+-->\s*$` (multiline). */
export const END_MARKER_RE =
  /^[ \t]*<!--[ \t]+END[ \t]+plasmid-derived:[ \t]+([^\s<>-][^\s<>]*(?:[ \t]+[^\s<>]+)*?)[ \t]+-->[ \t]*$/;

/**
 * `true` iff `id` is a syntactically valid marker id (either form) and fits
 * the length cap. Does NOT check whether the id currently exists in a tree.
 */
export function isValidMarkerId(id: string): boolean {
  if (id.length === 0 || id.length > MARKER_ID_MAX_LENGTH) return false;
  return MARKER_ID_RE.test(id);
}

/**
 * Parse a single line as a BEGIN marker. Returns the marker-id or `null` if
 * the line is not a BEGIN marker OR the embedded id fails validation.
 */
export function parseBeginLine(line: string): string | null {
  const m = BEGIN_MARKER_RE.exec(line);
  if (!m) return null;
  const id = m[1];
  return isValidMarkerId(id) ? id : null;
}

/**
 * Parse a single line as an END marker. Returns the marker-id or `null` if
 * the line is not an END marker OR the embedded id fails validation.
 */
export function parseEndLine(line: string): string | null {
  const m = END_MARKER_RE.exec(line);
  if (!m) return null;
  const id = m[1];
  return isValidMarkerId(id) ? id : null;
}

/** Render a BEGIN marker line for `id`. Assumes `id` is already validated. */
export function renderBeginMarker(id: string): string {
  return `<!-- BEGIN plasmid-derived: ${id} -->`;
}

/** Render an END marker line for `id`. Assumes `id` is already validated. */
export function renderEndMarker(id: string): string {
  return `<!-- END plasmid-derived: ${id} -->`;
}

/**
 * Produce a kebab-slug from an arbitrary string (intent title, section name).
 *
 * Lower-cases; collapses runs of non-alphanumerics to a single hyphen; trims
 * leading/trailing hyphens. Empty inputs return `"section"` so we always
 * yield a valid segment.
 */
export function kebab(text: string): string {
  const slug = text
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "") // strip combining diacritics
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug.length === 0 ? "section" : slug;
}

/**
 * Construct a marker-id from a plasmid id + a slug source. Clamps the combined
 * length to {@link MARKER_ID_MAX_LENGTH} by truncating the slug (never the
 * plasmid id). Returned id is guaranteed to satisfy {@link isValidMarkerId}.
 */
export function buildMarkerId(plasmidId: string, slugSource: string): string {
  const slug = kebab(slugSource);
  const head = kebab(plasmidId);
  const prefix = `${head}/`;
  const budget = MARKER_ID_MAX_LENGTH - prefix.length;
  if (budget <= 0) {
    // plasmid id alone exceeds the cap — fall back to truncated head.
    return head.slice(0, MARKER_ID_MAX_LENGTH).replace(/-+$/, "") || "section";
  }
  const trimmed = slug.slice(0, budget).replace(/-+$/, "") || "section";
  return `${prefix}${trimmed}`;
}
