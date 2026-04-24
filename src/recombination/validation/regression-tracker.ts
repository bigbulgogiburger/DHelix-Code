/**
 * Regression tracker (`.dhelix/recombination/validation-history.jsonl`).
 *
 * Team 3 — Phase 3. Append-only (I-5). Each successful validation run
 * records a `HistoryEntry`. `detectRegressions` diffs the new entry
 * against the last prior one and flags any plasmid-level rate drop ≥5%
 * (configurable). Returned findings are attached to `ValidateResult`
 * and, per PRD §10.3, surface as error code
 * `VALIDATION_REGRESSION_DETECTED` in the report warnings.
 *
 * Layer: Core. Atomic append; read-all for diff.
 */
import type { HistoryEntry, RegressionFinding, ValidationReport } from "../types.js";

export const appendHistory: (
  workingDirectory: string,
  entry: HistoryEntry,
  signal?: AbortSignal,
) => Promise<void> = () => {
  throw new Error("TODO Phase 3 Team 3: appendHistory");
};

export interface DetectRegressionsRequest {
  readonly workingDirectory: string;
  readonly current: ValidationReport;
  readonly transcriptId: string;
  /** Threshold delta (default 0.05 = 5%). */
  readonly threshold?: number;
  readonly signal?: AbortSignal;
}

export const detectRegressions: (
  req: DetectRegressionsRequest,
) => Promise<readonly RegressionFinding[]> = () => {
  throw new Error("TODO Phase 3 Team 3: detectRegressions");
};

export const reportToHistoryEntry: (
  transcriptId: string,
  report: ValidationReport,
) => HistoryEntry = () => {
  throw new Error("TODO Phase 3 Team 3: reportToHistoryEntry");
};
