/**
 * Reporter — human-readable validation output + 10s grace UX (PRD §8.5 + P-1.16).
 *
 * Team 3 — Phase 3. Pure rendering functions + one I/O-abstracted
 * `awaitRollbackDecision` that takes a `GracePromptIO` (so the command
 * layer owns stdin/stdout and the validator stays framework-agnostic).
 *
 * Exports:
 *   - renderReport(ValidationReport) → formatted multi-line string
 *     (matches PRD §6.3.3 validation summary layout)
 *   - renderGraceFrame(report, decision, secondsRemaining) → countdown frame
 *   - awaitRollbackDecision({ io, report, decision, signal? }) →
 *     Promise<"rollback"|"keep"> — 10s grace; default=rollback on timeout
 *
 * Layer: Core. No disk I/O; prompt IO is injected.
 */
import type {
  GraceInput,
  GracePromptIO,
  RollbackDecision,
  ValidationReport,
} from "../types.js";

export const renderReport: (report: ValidationReport) => string = () => {
  throw new Error("TODO Phase 3 Team 3: renderReport");
};

export const renderGraceFrame: (
  report: ValidationReport,
  decision: RollbackDecision,
  secondsRemaining: number,
) => string = () => {
  throw new Error("TODO Phase 3 Team 3: renderGraceFrame");
};

export interface AwaitRollbackDecisionRequest {
  readonly io: GracePromptIO;
  readonly report: ValidationReport;
  readonly decision: RollbackDecision;
  readonly signal?: AbortSignal;
}

export const awaitRollbackDecision: (
  req: AwaitRollbackDecisionRequest,
) => Promise<"rollback" | "keep"> = () => {
  throw new Error("TODO Phase 3 Team 3: awaitRollbackDecision");
};

/** Helper for tests + headless command — timeout-only input resolver. */
export const autoTimeoutDecisionIO: (
  valid: readonly GraceInput[],
) => GracePromptIO = () => {
  throw new Error("TODO Phase 3 Team 3: autoTimeoutDecisionIO");
};
