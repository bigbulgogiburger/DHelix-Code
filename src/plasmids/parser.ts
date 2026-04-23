/**
 * Plasmid markdown parser — extracts eval cases from the `## Eval cases`
 * section and leaves the remainder of the body untouched.
 *
 * The parser is *format-aware* but schema-agnostic: it returns raw YAML decode
 * output for both the frontmatter and the eval block. Zod validation happens
 * in the loader, so this module's job is purely textual.
 *
 * Layer: Leaf — imports only `./frontmatter.js`, `./errors.js`.
 */

import { parse as parseYaml } from "yaml";

import { PlasmidSchemaError } from "./errors.js";
import { parseYamlMetadata, splitFrontmatter } from "./frontmatter.js";

/** Result of {@link parsePlasmidSource}. */
export interface ParsedPlasmidSource {
  /** Raw, pre-Zod frontmatter record. */
  readonly metadata: Record<string, unknown>;
  /** Markdown body with the eval section (if any) removed. */
  readonly bodyWithoutEvals: string;
  /** Raw, pre-Zod eval case list. Empty when no section was found. */
  readonly evalCases: readonly unknown[];
}

/**
 * ATX `## Eval cases` heading, case-insensitive. We match only level-2 headings
 * to avoid collisions with `### Eval cases` subsections in the body prose.
 * Trailing `#` runs (per CommonMark) are stripped by the regex's trailing `#*`.
 */
const EVAL_HEADING_REGEX = /^##[ \t]+eval\s+cases[ \t]*#*[ \t]*$/im;

/**
 * Parse a raw plasmid source string (either single-file with frontmatter, or
 * the combined `metadata.yaml` + `body.md` form rejoined by the loader).
 *
 * Returns unvalidated shapes — the loader is responsible for Zod narrowing.
 */
export function parsePlasmidSource(source: string): ParsedPlasmidSource {
  const { rawMetadata, body } = splitFrontmatter(source);
  const metadata = parseYamlMetadata(rawMetadata);
  const { bodyWithoutEvals, evalCases } = extractEvalSection(body);
  return { metadata, bodyWithoutEvals, evalCases };
}

/**
 * Parse the body of a two-file plasmid (no frontmatter wrapper). Used by the
 * loader after it has read `body.md` directly.
 */
export function parsePlasmidBody(body: string): {
  readonly bodyWithoutEvals: string;
  readonly evalCases: readonly unknown[];
} {
  return extractEvalSection(body);
}

interface EvalSplit {
  readonly bodyWithoutEvals: string;
  readonly evalCases: readonly unknown[];
}

function extractEvalSection(body: string): EvalSplit {
  const match = EVAL_HEADING_REGEX.exec(body);
  if (match === null) {
    return { bodyWithoutEvals: body, evalCases: [] };
  }
  const headingStart = match.index;
  const afterHeading = body.slice(headingStart + match[0].length);

  // A section runs until the next ATX heading of the same level or higher, or
  // EOF. `#` or `##` on a new line counts; deeper headings (`###+`) stay
  // inside the section.
  const nextHeadingMatch = /(^|\r?\n)(#{1,2})[ \t]+\S/.exec(afterHeading);
  const sectionEnd =
    nextHeadingMatch === null
      ? afterHeading.length
      : nextHeadingMatch.index + (nextHeadingMatch[1]?.length ?? 0);

  const sectionBody = afterHeading.slice(0, sectionEnd);
  const rest = afterHeading.slice(sectionEnd);
  const bodyWithoutEvals = body.slice(0, headingStart) + rest;

  const trimmed = sectionBody.trim();
  if (trimmed.length === 0) {
    return { bodyWithoutEvals, evalCases: [] };
  }

  const yamlText = stripFencedYamlBlock(trimmed);
  // Eval section accepts a YAML list OR a mapping with `cases:` — parse
  // permissively (unlike `parseYamlMetadata` which requires a mapping root).
  const parsed = parseYamlPermissive(yamlText);
  const evalCases = coerceEvalList(parsed);
  return { bodyWithoutEvals, evalCases };
}

/**
 * Strip an optional fenced code block (```yaml ... ```) so authors can wrap
 * the eval list for editor syntax highlighting without confusing the parser.
 */
function stripFencedYamlBlock(sectionBody: string): string {
  const fenceMatch = /^```(?:ya?ml)?\s*\r?\n([\s\S]*?)\r?\n```\s*$/i.exec(sectionBody);
  if (fenceMatch !== null && fenceMatch[1] !== undefined) {
    return fenceMatch[1];
  }
  return sectionBody;
}

/**
 * Eval sections are canonically YAML lists. Accept two shapes:
 *  1. A bare YAML list at the section root (most common).
 *  2. A mapping whose only key is `cases:` (legacy form).
 */
function coerceEvalList(parsed: unknown): readonly unknown[] {
  if (Array.isArray(parsed)) {
    return parsed as readonly unknown[];
  }
  if (parsed !== null && typeof parsed === "object") {
    const cases = (parsed as Record<string, unknown>).cases;
    if (Array.isArray(cases)) {
      return cases as readonly unknown[];
    }
  }
  throw new PlasmidSchemaError(
    'eval cases section must be a YAML list or a mapping with a "cases" key',
    { got: parsed === null ? "null" : typeof parsed },
  );
}

// `yaml` is already bundled via frontmatter.ts — we re-import here because
// eval sections are allowed to be YAML lists (which `parseYamlMetadata`
// explicitly rejects for frontmatter safety).
function parseYamlPermissive(text: string): unknown {
  try {
    return parseYaml(text, { schema: "core" });
  } catch (error) {
    throw new PlasmidSchemaError(
      `eval cases YAML parse failed: ${
        error instanceof Error ? error.message : String(error)
      }`,
      { cause: error instanceof Error ? error.message : String(error) },
    );
  }
}
