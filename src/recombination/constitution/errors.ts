/**
 * Constitution reorganizer errors (Stage 2d, P-1.15).
 *
 * All errors extend {@link BaseError} so call-sites can map `.code` to the
 * {@link RecombinationErrorCode} catalogued in `../types.ts`. PRD §10.3.
 *
 * Layer: Core (Layer 2). Imports from `utils/error.js` only.
 */

import { BaseError } from "../../utils/error.js";
import type { RecombinationErrorCode } from "../types.js";

/**
 * Abstract base for every error thrown from the reorganizer. Not meant to be
 * thrown directly — pick a concrete subclass.
 */
export class ReorganizerError extends BaseError {
  constructor(
    message: string,
    code: RecombinationErrorCode,
    context: Record<string, unknown> = {},
  ) {
    super(message, code, context);
  }
}

/**
 * Parser failure — DHELIX.md structure is malformed. The reorganizer cannot
 * proceed because it cannot guarantee I-9 invariance without a trustworthy
 * section tree.
 *
 * Mapped to the wiring check {@link "WIRING_MARKER_UNTERMINATED"} for Stage 5
 * surfacing. The reorganizer itself rejects the plan via the generic
 * {@link "RECOMBINATION_PLAN_ERROR"} code so Team 5's validator can attach
 * the appropriate finding.
 */
export class ConstitutionParseError extends ReorganizerError {
  constructor(message: string, context: Record<string, unknown> = {}) {
    super(message, "RECOMBINATION_PLAN_ERROR", context);
  }
}

/**
 * LLM (or XML fallback) produced a plan whose `update` / `remove` op targets
 * a `markerId` not present in the existing DHELIX.md. This is the most common
 * I-9 violation pattern (LLM trying to rewrite a user-authored heading by
 * claiming it as a marker). PRD §10.3.
 */
export class ReorgInvalidUpdateTargetError extends ReorganizerError {
  constructor(message: string, context: Record<string, unknown> = {}) {
    super(message, "REORG_INVALID_UPDATE_TARGET", context);
  }
}

/**
 * Post-plan I-9 semantic check detected that a user-authored section would be
 * added, removed, or altered by the plan. Never recoverable — the plan must
 * be discarded. PRD §10.3 + §10.1 I-9.
 */
export class ReorgUserAreaViolationError extends ReorganizerError {
  constructor(message: string, context: Record<string, unknown> = {}) {
    super(message, "REORG_USER_AREA_VIOLATION", context);
  }
}

/**
 * All configured fallback tiers (LLM JSON → XML → deterministic) failed to
 * produce a valid plan. Surfaces `REORG_FALLBACK_USED` so the transcript
 * records the degraded state. Only thrown when `deterministic-only` is *not*
 * part of the configured chain.
 */
export class ReorgFallbackExhaustedError extends ReorganizerError {
  constructor(message: string, context: Record<string, unknown> = {}) {
    super(message, "REORG_FALLBACK_USED", context);
  }
}
