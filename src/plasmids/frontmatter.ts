/**
 * YAML frontmatter split + parse.
 *
 * Single-file plasmids wrap their metadata in a `---`-delimited YAML block at
 * the top of the markdown source. This module isolates the textual split and
 * YAML decoding so both the single-file path and the two-file path (I-1) can
 * share the same parser.
 *
 * Layer: Leaf — imports only `yaml`, `./errors.js`.
 */

import { parse as parseYaml, YAMLParseError } from "yaml";

import {
  PlasmidFrontmatterMissingError,
  PlasmidSchemaError,
} from "./errors.js";

/** Successful split of the leading `---`-delimited block from the body. */
export interface SplitResult {
  /** Raw YAML text between the leading and trailing `---` markers. */
  readonly rawMetadata: string;
  /** Markdown body after the closing `---` marker. */
  readonly body: string;
}

// Leading delimiter may optionally be preceded by a BOM / leading whitespace.
const FRONTMATTER_OPEN_REGEX = /^﻿?\s*---\r?\n/;

/**
 * Split `source` into a `(rawMetadata, body)` pair.
 *
 * Accepts LF or CRLF line endings. Tolerates a UTF-8 BOM and leading blank
 * lines before the opening `---`. Rejects sources that do not begin with a
 * frontmatter block with {@link PlasmidFrontmatterMissingError}.
 */
export function splitFrontmatter(source: string): SplitResult {
  const openMatch = FRONTMATTER_OPEN_REGEX.exec(source);
  if (openMatch === null) {
    throw new PlasmidFrontmatterMissingError(
      "expected leading `---` frontmatter delimiter",
      { snippet: source.slice(0, 40) },
    );
  }

  const afterOpen = source.slice(openMatch[0].length);
  // Closing delimiter: `---` on its own line (LF or CRLF terminated), or
  // flush at EOF. We locate the first `---` line and treat everything before
  // it as YAML.
  const closeMatch = /(^|\r?\n)---(\r?\n|$)/.exec(afterOpen);
  if (closeMatch === null) {
    throw new PlasmidFrontmatterMissingError(
      "expected closing `---` frontmatter delimiter",
      { snippet: source.slice(0, 80) },
    );
  }

  const closeStart = closeMatch.index + (closeMatch[1]?.length ?? 0);
  const rawMetadata = afterOpen.slice(0, closeStart);
  // Strip the closing delimiter + its line terminator (if any) from the body.
  const bodyStart = closeMatch.index + closeMatch[0].length;
  const body = afterOpen.slice(bodyStart);

  return { rawMetadata, body };
}

/**
 * Parse `rawMetadata` as YAML and assert the root is an object.
 *
 * Throws {@link PlasmidSchemaError} on malformed YAML or non-object roots
 * (e.g., a bare string / number / list at the top level), so downstream
 * Zod validation can trust the shape.
 */
export function parseYamlMetadata(rawMetadata: string): Record<string, unknown> {
  let parsed: unknown;
  try {
    parsed = parseYaml(rawMetadata, {
      // Force JSON-compatible output so `date` objects don't sneak through.
      schema: "core",
    });
  } catch (error) {
    const message =
      error instanceof YAMLParseError
        ? error.message
        : error instanceof Error
          ? error.message
          : "unknown YAML parse error";
    throw new PlasmidSchemaError(`YAML parse failed: ${message}`, {
      cause: error instanceof Error ? error.message : String(error),
    });
  }

  if (parsed === null || parsed === undefined) {
    throw new PlasmidSchemaError("frontmatter is empty", {});
  }
  if (typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new PlasmidSchemaError("frontmatter must be a YAML mapping (object at root)", {
      actual: Array.isArray(parsed) ? "array" : typeof parsed,
    });
  }
  return parsed as Record<string, unknown>;
}
