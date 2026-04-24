/**
 * Phase 5 — Production adapters wrapping `webSearchTool` + `webFetchTool` into
 * the `WebSearchFn` / `WebFetchFn` shapes consumed by `research-mode.ts`.
 *
 * Owned by Team 2 — Phase 5 GAL-1 dev-guide §3.
 *
 * Design notes:
 * - We never call `fetch()` / `https.request` directly. Both adapters route
 *   through the existing tool definitions (`webSearchTool`, `webFetchTool`)
 *   so guardrails + permissions + caching apply uniformly.
 * - `webSearchTool` returns a markdown-formatted `output` string, NOT a
 *   structured payload. The adapter parses that string back into structured
 *   form, tolerating both Brave and DuckDuckGo result shapes (they share the
 *   same `formatResults()` writer in `web-search.ts`, so a single parser
 *   covers both).
 * - `webFetchTool` strips HTML and may prefix the output with bracketed
 *   annotations (`[Cached response]`, `[Redirected to: ...]`, ...). The
 *   adapter strips those annotations before hashing so the SHA-256 digest
 *   reflects the canonical body content the synthesiser will see.
 * - All errors map to a structured `PLASMID_RESEARCH_NETWORK_ERROR` so
 *   callers can branch on `.code` rather than string matching.
 */

import { createHash } from "node:crypto";

import { webSearchTool } from "../../tools/definitions/web-search.js";
import { webFetchTool } from "../../tools/definitions/web-fetch.js";
import type { ToolContext } from "../../tools/types.js";
import { PlasmidError } from "../errors.js";

/**
 * Single search hit produced by `webSearchAdapter`. Mirrors the
 * `WebSearchFn` contract Team 1 declares in `research-mode.ts`.
 */
export interface WebSearchHit {
  readonly url: string;
  readonly title: string;
  readonly snippet?: string;
}

/**
 * Search adapter signature — keeps `research-mode.ts` decoupled from the
 * concrete `webSearchTool` definition.
 */
export type WebSearchFn = (
  req: { readonly query: string; readonly maxResults: number; readonly signal: AbortSignal },
) => Promise<readonly WebSearchHit[]>;

/**
 * Fetch adapter signature — returns the cleaned body and a sha256 digest of
 * the same. Forward-compat: future fields (e.g. `finalUrl`) can be added as
 * optional properties without breaking Team 1.
 */
export type WebFetchFn = (
  req: { readonly url: string; readonly signal: AbortSignal },
) => Promise<{ readonly body: string; readonly contentSha256: string }>;

/** Minimal `ToolContext` factory used by the adapters when no caller-supplied context is available. */
function makeToolContext(signal: AbortSignal): ToolContext {
  return {
    workingDirectory: process.cwd(),
    abortSignal: signal,
    timeoutMs: 30_000,
    platform: process.platform as "win32" | "darwin" | "linux",
  };
}

/**
 * Compute a stable sha256 hex digest over the cleaned body. Exported so the
 * tests can verify the helper independently of `webFetchAdapter`.
 */
export function computeContentSha256(body: string): string {
  return createHash("sha256").update(body, "utf8").digest("hex");
}

/**
 * Bracketed annotations the `web_fetch` tool may prefix on the output. We
 * strip them before hashing so the digest reflects the body the user / the
 * synthesiser actually consumes — not the surrounding metadata.
 */
const FETCH_ANNOTATION_PREFIXES: readonly string[] = [
  "[Cached response]",
  "[Redirected to:",
  "[Upgraded to HTTPS]",
  "[Extraction prompt:",
];

/**
 * Strip the leading annotation block emitted by `webFetchTool`. The block
 * is composed of one or more bracketed lines separated by `\n\n` from the
 * actual body. Unknown bracketed lines are passed through unchanged so we
 * don't accidentally swallow real content.
 */
export function stripFetchAnnotations(raw: string): string {
  const parts = raw.split(/\n\n+/);
  let cursor = 0;
  while (cursor < parts.length) {
    const part = parts[cursor]?.trimStart() ?? "";
    if (FETCH_ANNOTATION_PREFIXES.some((p) => part.startsWith(p))) {
      cursor += 1;
      continue;
    }
    break;
  }
  return parts.slice(cursor).join("\n\n").trimEnd();
}

/**
 * Strip a trailing truncation marker the fetch tool appends when the
 * content exceeds `maxLength`. Format: `[Truncated: showing first ... of ... chars]`.
 */
function stripTruncationMarker(body: string): string {
  return body.replace(/\n\n\[Truncated: [^\]]+\]\s*$/u, "").trimEnd();
}

/**
 * Parse the markdown output of `webSearchTool` back into structured hits.
 *
 * Format (see `formatResults()` in `web-search.ts`):
 *
 *   Web search results for "query":
 *
 *   1. [Title](https://...)
 *      Optional snippet
 *
 *   2. [Other title](https://...)
 *      ...
 *
 * The "No results found" sentinel returns an empty array.
 */
export function parseWebSearchOutput(output: string): readonly WebSearchHit[] {
  const trimmed = output.trim();
  if (trimmed.length === 0) return [];
  if (/^No results found/u.test(trimmed)) return [];

  const lines = trimmed.split(/\r?\n/);
  const hits: WebSearchHit[] = [];
  // The Brave / DDG writer emits each hit as either:
  //   "  N. [title](url)"
  //   "     snippet line"
  //   ""
  // We loop forward and pair the two-line forms.
  const itemRegex = /^\s*\d+\.\s*\[(.+?)\]\((https?:[^)]+)\)\s*$/u;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? "";
    const match = itemRegex.exec(line);
    if (!match) continue;
    const title = match[1].trim();
    const url = match[2].trim();
    // Look ahead for an indented snippet line; a blank line terminates the entry.
    let snippet: string | undefined;
    const next = lines[i + 1] ?? "";
    if (next.trim().length > 0 && !itemRegex.test(next)) {
      snippet = next.trim();
    }
    hits.push(snippet ? { title, url, snippet } : { title, url });
  }
  return hits;
}

/**
 * Production `WebSearchFn` — wraps `webSearchTool.execute` and converts the
 * markdown output into structured hits. Errors are surfaced as a typed
 * `PlasmidError(PLASMID_RESEARCH_NETWORK_ERROR)` so the command layer can
 * branch consistently.
 */
export const webSearchAdapter: WebSearchFn = async (req) => {
  const tool = webSearchTool;
  const ctx = makeToolContext(req.signal);
  const result = await tool.execute(
    { query: req.query, max_results: req.maxResults },
    ctx,
  );
  if (result.isError) {
    throw new PlasmidError(
      `Web search failed: ${result.output}`,
      "PLASMID_RESEARCH_NETWORK_ERROR",
      { query: req.query, engine: result.metadata?.engine },
    );
  }
  return parseWebSearchOutput(result.output);
};

/**
 * Production `WebFetchFn` — wraps `webFetchTool.execute`, strips the
 * tool's bracketed annotations, hashes the canonical body, and returns
 * the structured pair `research-mode.ts` expects.
 */
export const webFetchAdapter: WebFetchFn = async (req) => {
  const tool = webFetchTool;
  const ctx = makeToolContext(req.signal);
  const result = await tool.execute({ url: req.url, maxLength: 50_000 }, ctx);
  if (result.isError) {
    throw new PlasmidError(
      `Web fetch failed: ${result.output}`,
      "PLASMID_RESEARCH_NETWORK_ERROR",
      { url: req.url },
    );
  }
  const stripped = stripTruncationMarker(stripFetchAnnotations(result.output));
  return {
    body: stripped,
    contentSha256: computeContentSha256(stripped),
  };
};
