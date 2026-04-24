/**
 * Expectation DSL parser (P-1.23 §4, 7 prefixes + free-text fallback).
 *
 * Team 1 — Phase 3. Pure, sync. Consumes a raw expectation string
 * (from eval-seed files or LLM auto-gen) and produces a discriminated
 * `Expectation`. The grader-cascade branches on `kind` to pick a handler.
 *
 * Layer: Core (Layer 2). No I/O.
 */
import type { Expectation } from "../types.js";

export interface ParseOptions {
  /** When true, throws on malformed prefixed DSL; otherwise downgrades to free-text. */
  readonly strict?: boolean;
}

/**
 * Extract a single- or double-quoted string from `body`. Returns `null` when
 * no matching opening/closing quotes are present.
 */
const extractQuoted = (body: string): string | null => {
  const trimmed = body.trim();
  if (trimmed.length < 2) return null;
  const open = trimmed.charAt(0);
  if (open !== '"' && open !== "'") return null;
  const close = trimmed.lastIndexOf(open);
  if (close <= 0) return null;
  return trimmed.slice(1, close);
};

/** Strip wrapping whitespace and common trailing noise ("is called", "fires", ...). */
const stripTrailingNoise = (s: string): string =>
  s
    .replace(/\s+(is\s+called|was\s+called|fires|fired|was\s+fired)\s*$/i, "")
    .trim();

const malformed = (
  raw: string,
  reason: string,
  strict: boolean,
): Expectation => {
  if (strict) {
    throw new Error(
      `expectation-dsl: malformed expectation (${reason}): ${raw}`,
    );
  }
  return { kind: "free-text", text: raw, original: raw };
};

const OUTPUT_CONTAINS_RE = /^output\s+contains\s+(.+)$/i;
// Tolerates "does not", "doesn't", "do not" — always case-insensitive on NOT.
const OUTPUT_EXCLUDES_RE =
  /^output\s+(?:does\s*n['’]?t|does\s+not|do\s+not)\s+contain\s+(.+)$/i;

/** Parse a single expectation DSL line. */
export const parseExpectation = (
  raw: string,
  opts?: ParseOptions,
): Expectation => {
  const strict = opts?.strict === true;
  if (typeof raw !== "string") {
    return malformed(String(raw), "non-string input", strict);
  }
  const trimmed = raw.trim();
  if (trimmed.length === 0) {
    return malformed(raw, "empty string", strict);
  }

  // 1. output does NOT contain "<str>" — checked before positive form
  const excl = OUTPUT_EXCLUDES_RE.exec(trimmed);
  if (excl) {
    const text = extractQuoted(excl[1] ?? "");
    if (text === null) {
      return malformed(raw, "output excludes missing quoted text", strict);
    }
    return { kind: "output-excludes", text, original: raw };
  }

  // 2. output contains "<str>"
  const incl = OUTPUT_CONTAINS_RE.exec(trimmed);
  if (incl) {
    const text = extractQuoted(incl[1] ?? "");
    if (text === null) {
      return malformed(raw, "output contains missing quoted text", strict);
    }
    return { kind: "output-contains", text, original: raw };
  }

  // 3. file:<path> exists | modified
  if (/^file\s*:/i.test(trimmed)) {
    const body = trimmed.replace(/^file\s*:/i, "").trim();
    const m = /^(.+?)\s+(exists|modified)\s*$/i.exec(body);
    if (!m) {
      return malformed(
        raw,
        "file: expected '<path> exists|modified'",
        strict,
      );
    }
    const path = m[1].trim();
    const verb = m[2].toLowerCase();
    if (path.length === 0) {
      return malformed(raw, "file: empty path", strict);
    }
    return verb === "exists"
      ? { kind: "file-exists", path, original: raw }
      : { kind: "file-modified", path, original: raw };
  }

  // 4. exit code <n>
  const exitMatch = /^exit\s+code\s+(-?\d+)\s*$/i.exec(trimmed);
  if (exitMatch) {
    const n = Number.parseInt(exitMatch[1], 10);
    if (!Number.isFinite(n)) {
      return malformed(raw, "exit code not an integer", strict);
    }
    return { kind: "exit-code", code: n, original: raw };
  }
  if (/^exit\s+code\b/i.test(trimmed)) {
    return malformed(raw, "exit code missing integer", strict);
  }

  // 5. tool:<name>
  if (/^tool\s*:/i.test(trimmed)) {
    const body = trimmed.replace(/^tool\s*:/i, "").trim();
    const tool = stripTrailingNoise(body).split(/\s+/)[0] ?? "";
    if (tool.length === 0) {
      return malformed(raw, "tool: missing tool name", strict);
    }
    return { kind: "tool-called", tool, original: raw };
  }

  // 6. hook:<event>
  if (/^hook\s*:/i.test(trimmed)) {
    const body = trimmed.replace(/^hook\s*:/i, "").trim();
    const event = stripTrailingNoise(body).split(/\s+/)[0] ?? "";
    if (event.length === 0) {
      return malformed(raw, "hook: missing event name", strict);
    }
    return { kind: "hook-fired", event, original: raw };
  }

  // 7. Free-text fallback — natural language for LLM judge tier.
  return { kind: "free-text", text: raw, original: raw };
};

/** Batch-parse preserving ordering. */
export const parseExpectations = (
  raws: readonly string[],
  opts?: ParseOptions,
): readonly Expectation[] => raws.map((r) => parseExpectation(r, opts));
