/**
 * DHELIX.md section-tree parser — Stage 2d input model for the reorganizer.
 *
 * The tree is a flat sequence of {@link Section} nodes covering every line of
 * the source file. Two node kinds:
 *   - `user`   — content OUTSIDE any BEGIN/END marker pair. Frozen per I-9.
 *   - `marker` — content INSIDE a BEGIN/END `plasmid-derived` marker pair.
 *
 * The parser is strict enough to refuse malformed markers (unterminated,
 * duplicate, nested) but permissive with surrounding whitespace. No I/O, no
 * LLM — pure string in, pure tree out.
 *
 * Layer: Core (Layer 2). Leaf-pure.
 */

import { ConstitutionParseError } from "./errors.js";
import { parseBeginLine, parseEndLine } from "./marker.js";

/** Content outside any marker — frozen per I-9. */
export interface UserSection {
  readonly kind: "user";
  /** Heading text (without leading `#`s) if this block starts with one. */
  readonly heading?: string;
  /** Raw line content (newline-joined; final newline stripped). */
  readonly content: string;
  /** 0-based inclusive. */
  readonly startLine: number;
  /** 0-based inclusive. Equals `startLine` for single-line sections. */
  readonly endLine: number;
}

/** Content inside a BEGIN/END `plasmid-derived` marker pair. */
export interface MarkerSection {
  readonly kind: "marker";
  readonly markerId: string;
  /** Heading text (without leading `#`s) if the body starts with one. */
  readonly heading: string;
  /** Body markdown BETWEEN the BEGIN and END lines (exclusive). */
  readonly body: string;
  /** 0-based line index of the BEGIN marker. */
  readonly startLine: number;
  /** 0-based line index of the END marker. */
  readonly endLine: number;
  /** First path segment of a composite marker-id — e.g. `owasp-gate` in `owasp-gate/security`. */
  readonly sourcePlasmidIdHint?: string;
}

export type Section = UserSection | MarkerSection;

export interface SectionTree {
  readonly sections: readonly Section[];
  /** Pre-computed line-ending style; `render` reuses it so round-trips stay stable. */
  readonly lineEnding: "\n" | "\r\n";
  /** `true` iff the input ended with a newline. */
  readonly trailingNewline: boolean;
}

// ─── Internal helpers ───────────────────────────────────────────────────────

function detectLineEnding(src: string): "\n" | "\r\n" {
  // CRLF iff every \n that appears is preceded by \r; if none, default LF.
  if (src.includes("\r\n")) return "\r\n";
  return "\n";
}

function splitLines(src: string): readonly string[] {
  // Normalise to LF for scanning; we reinstate the original EOL at render time.
  return src.split(/\r?\n/);
}

function extractHeading(block: string): string | undefined {
  // First non-empty line; if it looks like `#+ title`, return the title.
  for (const line of block.split("\n")) {
    const stripped = line.trim();
    if (stripped.length === 0) continue;
    const m = /^(#{1,6})\s+(.+?)\s*$/.exec(stripped);
    if (m) return m[2];
    return undefined;
  }
  return undefined;
}

function joinRange(lines: readonly string[], start: number, end: number): string {
  // inclusive [start, end]
  if (start > end) return "";
  return lines.slice(start, end + 1).join("\n");
}

function sourcePlasmidHint(markerId: string): string | undefined {
  const slash = markerId.indexOf("/");
  return slash > 0 ? markerId.slice(0, slash) : undefined;
}

// ─── Public API ─────────────────────────────────────────────────────────────

/**
 * Parse DHELIX.md source into a {@link SectionTree}.
 *
 * Throws {@link ConstitutionParseError} for:
 *   - unterminated BEGIN (no matching END)
 *   - orphan END (no preceding BEGIN)
 *   - nested BEGIN (already inside a marker block)
 *   - duplicate marker-id within the same file
 */
export function parse(constitutionMd: string): SectionTree {
  const lineEnding = detectLineEnding(constitutionMd);
  const trailingNewline =
    constitutionMd.length === 0
      ? false
      : constitutionMd.endsWith("\r\n") || constitutionMd.endsWith("\n");

  if (constitutionMd.length === 0) {
    return { sections: [], lineEnding, trailingNewline };
  }

  // Strip the terminating newline so `split` doesn't yield a phantom empty line.
  const normalised = trailingNewline
    ? constitutionMd.slice(0, lineEnding === "\r\n" ? -2 : -1)
    : constitutionMd;
  const lines = splitLines(normalised);

  const sections: Section[] = [];
  const seenIds = new Set<string>();

  let cursor = 0; // next line to emit as a user section
  let insideBegin: { id: string; line: number } | null = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const beginId = parseBeginLine(line);
    const endId = parseEndLine(line);

    if (beginId !== null) {
      if (insideBegin) {
        throw new ConstitutionParseError(
          `Nested BEGIN marker "${beginId}" inside "${insideBegin.id}" at line ${i + 1}`,
          {
            line: i + 1,
            outerMarkerId: insideBegin.id,
            innerMarkerId: beginId,
          },
        );
      }
      // Emit any pending user content before the BEGIN.
      if (cursor <= i - 1) {
        const content = joinRange(lines, cursor, i - 1);
        sections.push({
          kind: "user",
          heading: extractHeading(content),
          content,
          startLine: cursor,
          endLine: i - 1,
        });
      }
      insideBegin = { id: beginId, line: i };
      continue;
    }

    if (endId !== null) {
      if (!insideBegin) {
        throw new ConstitutionParseError(
          `Orphan END marker "${endId}" without matching BEGIN at line ${i + 1}`,
          { line: i + 1, markerId: endId },
        );
      }
      if (insideBegin.id !== endId) {
        throw new ConstitutionParseError(
          `Mismatched END marker: expected "${insideBegin.id}", got "${endId}" at line ${i + 1}`,
          {
            line: i + 1,
            expectedMarkerId: insideBegin.id,
            actualMarkerId: endId,
          },
        );
      }
      if (seenIds.has(insideBegin.id)) {
        throw new ConstitutionParseError(
          `Duplicate marker-id "${insideBegin.id}" — each id may appear at most once`,
          { markerId: insideBegin.id },
        );
      }
      seenIds.add(insideBegin.id);

      const body = joinRange(lines, insideBegin.line + 1, i - 1);
      sections.push({
        kind: "marker",
        markerId: insideBegin.id,
        heading: extractHeading(body) ?? "",
        body,
        startLine: insideBegin.line,
        endLine: i,
        ...(sourcePlasmidHint(insideBegin.id)
          ? { sourcePlasmidIdHint: sourcePlasmidHint(insideBegin.id) }
          : {}),
      });
      cursor = i + 1;
      insideBegin = null;
      continue;
    }
    // non-marker line — just accumulated into the pending user run.
  }

  if (insideBegin) {
    throw new ConstitutionParseError(
      `Unterminated BEGIN marker "${insideBegin.id}" (started at line ${insideBegin.line + 1})`,
      { line: insideBegin.line + 1, markerId: insideBegin.id },
    );
  }

  // Trailing user content.
  if (cursor <= lines.length - 1) {
    const content = joinRange(lines, cursor, lines.length - 1);
    sections.push({
      kind: "user",
      heading: extractHeading(content),
      content,
      startLine: cursor,
      endLine: lines.length - 1,
    });
  }

  return { sections, lineEnding, trailingNewline };
}

/**
 * Render a {@link SectionTree} back to markdown. Round-trip stable with the
 * original `parse()` input when no edits were made.
 */
export function render(tree: SectionTree): string {
  if (tree.sections.length === 0) return "";
  const eol = tree.lineEnding;
  const parts: string[] = [];
  for (const section of tree.sections) {
    if (section.kind === "user") {
      parts.push(section.content);
    } else {
      parts.push(
        `<!-- BEGIN plasmid-derived: ${section.markerId} -->`,
        section.body,
        `<!-- END plasmid-derived: ${section.markerId} -->`,
      );
    }
  }
  // Each section becomes one logical block; separate by a single EOL so the
  // original line layout is preserved. The `content`/`body` strings are
  // normalised to LF internally, so we reinstate the tree's EOL here.
  const joined = parts.join("\n");
  const normalised = tree.trailingNewline ? `${joined}\n` : joined;
  return eol === "\n" ? normalised : normalised.replace(/\n/g, eol);
}

/** `O(n)` marker lookup by id. Returns `null` if the marker is not present. */
export function findMarker(tree: SectionTree, markerId: string): MarkerSection | null {
  for (const s of tree.sections) {
    if (s.kind === "marker" && s.markerId === markerId) return s;
  }
  return null;
}

/** Every user section in document order. Convenience for I-9 hashing. */
export function listUserSections(tree: SectionTree): readonly UserSection[] {
  const out: UserSection[] = [];
  for (const s of tree.sections) {
    if (s.kind === "user") out.push(s);
  }
  return out;
}

/** Every marker section in document order. */
export function listMarkerSections(tree: SectionTree): readonly MarkerSection[] {
  const out: MarkerSection[] = [];
  for (const s of tree.sections) {
    if (s.kind === "marker") out.push(s);
  }
  return out;
}

/** Set of marker-ids present in `tree`. Used by validator + deterministic diff. */
export function listMarkerIds(tree: SectionTree): ReadonlySet<string> {
  const ids = new Set<string>();
  for (const s of tree.sections) {
    if (s.kind === "marker") ids.add(s.markerId);
  }
  return ids;
}
