/**
 * Plasmid error hierarchy.
 *
 * All plasmid errors extend {@link BaseError} (utils/error.ts) so call sites can
 * uniformly inspect `.code` / `.context`. Codes mirror
 * {@link PlasmidErrorCode} from `./types.ts` so downstream consumers can map
 * catch-blocks to a finite, typed vocabulary.
 *
 * Layer: Leaf — imports only from `./types.js` and `../utils/error.js`.
 */

import { BaseError } from "../utils/error.js";
import type { PlasmidErrorCode } from "./types.js";

/**
 * Abstract base for all plasmid errors. Not meant to be thrown directly — pick
 * one of the concrete subclasses below. Exists so call-sites can `instanceof
 * PlasmidError` without listing every subtype.
 */
export class PlasmidError extends BaseError {
  constructor(
    message: string,
    code: PlasmidErrorCode,
    context: Record<string, unknown> = {},
  ) {
    super(message, code, context);
  }
}

/** Zod validation failure against `plasmidMetadataSchema` / `evalCaseSchema`. */
export class PlasmidSchemaError extends PlasmidError {
  constructor(message: string, context: Record<string, unknown> = {}) {
    super(message, "PLASMID_SCHEMA_INVALID", context);
  }
}

/**
 * Frontmatter delimiter (`---`) block not found in a single-file plasmid. Also
 * thrown when YAML parsing produces a non-object root.
 */
export class PlasmidFrontmatterMissingError extends PlasmidError {
  constructor(message: string, context: Record<string, unknown> = {}) {
    super(message, "PLASMID_FRONTMATTER_MISSING", context);
  }
}

/** Body file on disk could not be read / decoded. */
export class PlasmidBodyUnreadableError extends PlasmidError {
  constructor(message: string, context: Record<string, unknown> = {}) {
    super(message, "PLASMID_BODY_UNREADABLE", context);
  }
}

/** Same plasmid id was provided by two scopes; earlier precedence wins. */
export class PlasmidDuplicateIdError extends PlasmidError {
  constructor(message: string, context: Record<string, unknown> = {}) {
    super(message, "PLASMID_DUPLICATE_ID", context);
  }
}

/**
 * Two-file lock (I-1) violation. Use `kind` to distinguish which half is
 * orphaned:
 * - `"metadata"` → `metadata.yaml` present, `body.md` missing.
 * - `"body"`     → `body.md` present, `metadata.yaml` missing.
 */
export class PlasmidOrphanError extends PlasmidError {
  /** Which file is orphaned. */
  readonly kind: "metadata" | "body";

  constructor(
    message: string,
    kind: "metadata" | "body",
    context: Record<string, unknown> = {},
  ) {
    super(
      message,
      kind === "metadata" ? "PLASMID_ORPHAN_METADATA" : "PLASMID_ORPHAN_BODY",
      { ...context, kind },
    );
    this.kind = kind;
  }
}

/**
 * Narrow type guard for any plasmid-layer error. Useful in
 * loader/command boundaries that want to log uniformly.
 */
export function isPlasmidError(error: unknown): error is PlasmidError {
  return error instanceof PlasmidError;
}
