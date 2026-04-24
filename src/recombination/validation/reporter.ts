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
  PlasmidValidationSummary,
  RollbackDecision,
  TierStats,
  ValidationLevel,
  ValidationReport,
} from "../types.js";
import { ROLLBACK_GRACE_PERIOD_MS } from "../types.js";

const TIER_LABELS: Readonly<Record<ValidationLevel, string>> = {
  L1: "L1 (direct):     ",
  L2: "L2 (indirect):   ",
  L3: "L3 (conditional):",
  L4: "L4 (adversarial):",
};

const VALID_TIERS: readonly ValidationLevel[] = ["L1", "L2", "L3", "L4"];

const pct = (rate: number): string => `${(rate * 100).toFixed(1)}%`;

const formatTierLine = (stats: TierStats): string => {
  const mark = stats.meetsThreshold ? "✓" : "✗";
  const label = TIER_LABELS[stats.tier];
  return `  ${label} ${stats.passed}/${stats.total} ${mark} (${pct(stats.rate)})`;
};

const formatPerPlasmidFailures = (
  perPlasmid: readonly PlasmidValidationSummary[],
): string[] => {
  const rows: string[] = [];
  for (const summary of perPlasmid) {
    for (const tier of VALID_TIERS) {
      const stats = summary.perLevel.get(tier);
      if (!stats || stats.meetsThreshold) continue;
      rows.push(
        `  - ${summary.plasmidId} [${tier}] ${stats.passed}/${stats.total} (${pct(stats.rate)} < ${pct(stats.threshold)})`,
      );
    }
  }
  return rows;
};

export const renderReport: (report: ValidationReport) => string = (
  report,
) => {
  const lines: string[] = [];
  lines.push("Validation summary:");

  for (const tier of VALID_TIERS) {
    const stats = report.perTier.find((t) => t.tier === tier);
    if (stats) {
      lines.push(formatTierLine(stats));
    }
  }

  const totalPassed = report.perTier.reduce((sum, t) => sum + t.passed, 0);
  const totalCount = report.perTier.reduce((sum, t) => sum + t.total, 0);
  const overallRate = totalCount === 0 ? 0 : totalPassed / totalCount;
  lines.push(
    `  Overall:          ${totalPassed}/${totalCount} (${pct(overallRate)})`,
  );

  lines.push("");
  lines.push(`  Profile:          ${report.profile}`);
  lines.push(`  Duration:         ${(report.durationMs / 1000).toFixed(1)}s`);
  lines.push(`  Total cases:      ${report.totalCases}`);
  if (report.timeBudgetExceeded) {
    lines.push("  ⚠ time budget exceeded");
  }
  if (report.dropped.length > 0) {
    lines.push(`  Dropped cases:    ${report.dropped.length}`);
  }

  if (!report.overallPassed) {
    const failures = formatPerPlasmidFailures(report.perPlasmid);
    if (failures.length > 0) {
      lines.push("");
      lines.push("Failing plasmids:");
      lines.push(...failures);
    }
  }

  return lines.join("\n");
};

export const renderGraceFrame: (
  report: ValidationReport,
  decision: RollbackDecision,
  secondsRemaining: number,
) => string = (report, decision, secondsRemaining) => {
  const tier = decision.failingTier;
  const tierStats = tier
    ? report.perTier.find((t) => t.tier === tier)
    : undefined;

  const failLine = tierStats
    ? `${tier}: ${tierStats.passed}/${tierStats.total} (${pct(tierStats.rate)}) — below ${pct(tierStats.threshold)} threshold`
    : `${tier ?? "?"}: threshold not met`;
  const plasmidLine = decision.failingPlasmidId
    ? `Plasmid: ${decision.failingPlasmidId}`
    : "Plasmid: (multiple)";

  const lines: string[] = [
    `🧬 Validation FAILED — auto-rollback in ${secondsRemaining}s`,
    "─────────────────────────────────────────────",
    failLine,
    plasmidLine,
    "",
    `[r] Rollback (default, auto in ${secondsRemaining}s)  [k] Keep (override+audit)`,
    "[c] Re-run cloud  [i] Inspect  [e] Edit plasmid",
  ];
  return lines.join("\n");
};

export interface AwaitRollbackDecisionRequest {
  readonly io: GracePromptIO;
  readonly report: ValidationReport;
  readonly decision: RollbackDecision;
  readonly signal?: AbortSignal;
}

const GRACE_VALID_INPUTS: readonly GraceInput[] = [
  "rollback",
  "keep",
  "rerun",
  "inspect",
  "edit",
];

export const awaitRollbackDecision: (
  req: AwaitRollbackDecisionRequest,
) => Promise<"rollback" | "keep"> = async (req) => {
  if (req.signal?.aborted) {
    throw new Error("grace period aborted");
  }
  const frameRenderer = (secondsRemaining: number): string =>
    renderGraceFrame(req.report, req.decision, secondsRemaining);

  const result = await req.io.prompt(
    frameRenderer,
    ROLLBACK_GRACE_PERIOD_MS,
    GRACE_VALID_INPUTS,
  );

  if (req.signal?.aborted) {
    throw new Error("grace period aborted");
  }

  // Phase-3 mapping: only explicit "keep" preserves the run.
  // "rerun" / "inspect" / "edit" are richer UX reserved for Phase 4;
  // today they collapse to "rollback" so no side-effect work survives a
  // failed validation.
  if (result === "keep") return "keep";
  return "rollback";
};

/**
 * Headless default IO — resolves "rollback" after `timeoutMs`. Intended for
 * `--validate=ci` runs where no terminal is attached. `valid` is accepted
 * for contract parity with interactive IOs but ignored; the resolver never
 * consults stdin.
 */
export const autoTimeoutDecisionIO: (
  valid: readonly GraceInput[],
) => GracePromptIO = (_valid) => {
  void _valid;
  return {
    prompt: (_frameRenderer, timeoutMs, _validInputs) =>
      new Promise<GraceInput>((resolve) => {
        setTimeout(() => resolve("rollback"), timeoutMs);
      }),
  };
};
