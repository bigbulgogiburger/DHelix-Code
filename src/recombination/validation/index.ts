/**
 * Validation module barrel — Team 5 owns the facade `createValidate` that
 * wires Team 1-3 deps into a single `ValidateFn` consumed by the executor
 * at Stage 6.
 *
 * Re-exports team entry points so adjacent code (command layer, tests)
 * can import a single path.
 *
 * Layer: Core.
 */
import { hostname } from "node:os";

import type { PlasmidId } from "../../plasmids/types.js";
import type {
  BuildArtifactEnvFn,
  CaseGrading,
  CompiledPlasmidIR,
  DecideRollbackFn,
  DroppedCase,
  GenerateCasesFn,
  GracePromptIO,
  GradeCasesFn,
  OverrideRecord,
  PipelineStrategies,
  PlasmidValidationSummary,
  RuntimeCase,
  RuntimeCaseSet,
  RuntimeRunResult,
  RunCasesFn,
  TierStats,
  ValidateFn,
  ValidateProfile,
  ValidationLevel,
  ValidationReport,
  VolumeGovernorFn,
  VolumePlan,
} from "../types.js";
import { buildArtifactEnv } from "./artifact-env.js";
import { generateCases } from "./case-generator.js";
import { gradeCases } from "./grader-cascade.js";
import { recordOverride } from "./override-tracker.js";
import {
  appendHistory,
  detectRegressions,
  reportToHistoryEntry,
} from "./regression-tracker.js";
import { awaitRollbackDecision } from "./reporter.js";
import { decideRollback } from "./rollback-decision.js";
import { runCases } from "./runtime-executor.js";
import { buildVolumePlan } from "./volume-governor.js";

export * from "./expectation-dsl.js";
export * from "./eval-seeds.js";
export * from "./volume-governor.js";
export * from "./case-generator.js";
export * from "./artifact-env.js";
export * from "./runtime-executor.js";
export * from "./grader-cascade.js";
export * from "./rollback-decision.js";
export * from "./reporter.js";
export * from "./override-tracker.js";
export * from "./regression-tracker.js";

/** Injected dependencies for `createValidate`. Each is team-1-3's entry. */
export interface ValidateFacadeDeps {
  readonly buildVolumePlan: VolumeGovernorFn;
  readonly generateCases: GenerateCasesFn;
  readonly buildArtifactEnv: BuildArtifactEnvFn;
  readonly runCases: RunCasesFn;
  readonly gradeCases: GradeCasesFn;
  readonly decideRollback: DecideRollbackFn;
  /** Optional — command layer injects terminal-aware IO; tests pass stubs. */
  readonly promptIO?: GracePromptIO;
}

/**
 * Build a `ValidateFn` composing all Team 1-3 entries. Default wiring
 * lives in `defaultValidateFacadeDeps()` (team-5 owns it). Executor
 * Stage 6 invokes the returned fn.
 */
export const createValidate: (deps: ValidateFacadeDeps) => ValidateFn = (
  deps,
) => async (req) => {
  const started = new Date();
  const plan = deps.buildVolumePlan({ irs: req.irs, strategies: req.strategies });
  const caseSet = await deps.generateCases({
    irs: req.irs,
    strategies: req.strategies,
    plan,
    workingDirectory: req.workingDirectory,
    llm: req.llm,
    ...(req.signal !== undefined ? { signal: req.signal } : {}),
  });
  const env = await deps.buildArtifactEnv({
    workingDirectory: req.workingDirectory,
    transcriptId: req.transcriptId,
    artifacts: req.artifacts,
    writtenFiles: req.writtenFiles,
    ...(req.signal !== undefined ? { signal: req.signal } : {}),
  });
  try {
    const runs = await deps.runCases({
      cases: caseSet.cases,
      strategies: req.strategies,
      workingDirectory: req.workingDirectory,
      workspaceRoot: env.workspaceRoot,
      llm: req.llm,
      timeBudgetMs: plan.timeBudgetMs,
      parallelism: plan.parallelism,
      ...(req.signal !== undefined ? { signal: req.signal } : {}),
    });
    const gradings = await deps.gradeCases({
      cases: caseSet.cases,
      runs,
      strategies: req.strategies,
      llm: req.llm,
      ...(req.signal !== undefined ? { signal: req.signal } : {}),
    });
    const report = buildValidationReport({
      profile: req.profile,
      plan,
      caseSet,
      runs,
      gradings,
      irs: req.irs,
      strategies: req.strategies,
      startedAt: started,
      finishedAt: new Date(),
    });
    const decision = deps.decideRollback({
      report,
      plasmids: req.irs,
      strategies: req.strategies,
    });
    let finalAction = decision.action;
    let overrideRecorded: OverrideRecord | undefined;
    if (decision.action === "rollback" && deps.promptIO !== undefined) {
      const chosen = await awaitRollbackDecision({
        io: deps.promptIO,
        report,
        decision,
        ...(req.signal !== undefined ? { signal: req.signal } : {}),
      });
      if (chosen === "keep") {
        finalAction = "continue";
        const failingPlasmidId =
          decision.failingPlasmidId ??
          req.irs[0]?.plasmidId ??
          ("" as PlasmidId);
        const failingTier = decision.failingTier ?? "L1";
        const { passRate, threshold } = resolvePassStats(
          report,
          failingPlasmidId,
          failingTier,
        );
        overrideRecorded = {
          timestamp: new Date().toISOString(),
          transcriptId: req.transcriptId,
          plasmidId: failingPlasmidId,
          tier: failingTier,
          reason: decision.reason,
          passRate,
          threshold,
          actor: `${process.pid}@${hostname()}`,
        };
        await recordOverride(
          req.workingDirectory,
          overrideRecorded,
          req.signal,
        );
      }
    }
    await appendHistory(
      req.workingDirectory,
      reportToHistoryEntry(req.transcriptId, report),
      req.signal,
    );
    const regressions = await detectRegressions({
      workingDirectory: req.workingDirectory,
      current: report,
      transcriptId: req.transcriptId,
      ...(req.signal !== undefined ? { signal: req.signal } : {}),
    });
    return {
      report,
      decision: { ...decision, action: finalAction },
      regressions,
      ...(overrideRecorded !== undefined ? { overrideRecorded } : {}),
    };
  } finally {
    await env.cleanup();
  }
};

export const defaultValidateFacadeDeps: () => ValidateFacadeDeps = () => ({
  buildVolumePlan,
  generateCases,
  buildArtifactEnv,
  runCases,
  gradeCases,
  decideRollback,
  // promptIO intentionally undefined — command layer injects a terminal-aware
  // IO; headless runs (e.g. --validate=ci) use autoTimeoutDecisionIO.
});

// ─── helpers ─────────────────────────────────────────────────────────────────

interface BuildReportArgs {
  readonly profile: ValidateProfile;
  readonly plan: VolumePlan;
  readonly caseSet: RuntimeCaseSet;
  readonly runs: readonly RuntimeRunResult[];
  readonly gradings: readonly CaseGrading[];
  readonly irs: readonly CompiledPlasmidIR[];
  readonly strategies: PipelineStrategies;
  readonly startedAt: Date;
  readonly finishedAt: Date;
}

/**
 * Aggregate raw runs + gradings into a `ValidationReport`. Exposed for use
 * by Team 5 tests + the executor reporter path.
 *
 * Skipped cases (run.status === "skipped" or "timeout") are counted toward
 * per-tier `skipped`; `timeBudgetExceeded` is true iff any run timed out.
 * `earlyExit` reflects the runtime-executor's early-exit signal when it
 * chooses to skip L2-L4 after repeated L1 hard fails.
 */
export function buildValidationReport(args: BuildReportArgs): ValidationReport {
  const tiers: readonly ValidationLevel[] = ["L1", "L2", "L3", "L4"];
  const thresholdOf = (tier: ValidationLevel): number =>
    args.strategies.passThresholds[tier];

  const perTier: TierStats[] = tiers.map((tier) => {
    const gradingsAtTier = args.gradings.filter((g) => g.tier === tier);
    const runsAtTier = args.runs.filter((r) => r.tier === tier);
    const skipped = runsAtTier.filter(
      (r) => r.status === "skipped" || r.status === "timeout",
    ).length;
    const total = gradingsAtTier.length;
    const passed = gradingsAtTier.filter((g) => g.passed).length;
    const rate = total === 0 ? 0 : passed / total;
    const threshold = thresholdOf(tier);
    return {
      tier,
      total,
      passed,
      rate,
      threshold,
      meetsThreshold: total === 0 ? true : rate >= threshold,
      skipped,
    };
  });

  const perPlasmid: PlasmidValidationSummary[] = args.irs.map((ir) => {
    const perLevel = new Map<ValidationLevel, TierStats>();
    let overallPassed = true;
    for (const tier of tiers) {
      const gradingsForPlasmidTier = args.gradings.filter(
        (g) => g.plasmidId === ir.plasmidId && g.tier === tier,
      );
      const runsForPlasmidTier = args.runs.filter(
        (r) => r.plasmidId === ir.plasmidId && r.tier === tier,
      );
      const total = gradingsForPlasmidTier.length;
      const passed = gradingsForPlasmidTier.filter((g) => g.passed).length;
      const rate = total === 0 ? 0 : passed / total;
      const threshold = thresholdOf(tier);
      const meets = total === 0 ? true : rate >= threshold;
      const skipped = runsForPlasmidTier.filter(
        (r) => r.status === "skipped" || r.status === "timeout",
      ).length;
      perLevel.set(tier, {
        tier,
        total,
        passed,
        rate,
        threshold,
        meetsThreshold: meets,
        skipped,
      });
      if (!meets) overallPassed = false;
    }
    return {
      plasmidId: ir.plasmidId,
      tier: ir.tier,
      perLevel,
      overallPassed,
    };
  });

  const dropped: readonly DroppedCase[] = args.caseSet.droppedReasons;
  const timeBudgetExceeded = args.runs.some((r) => r.status === "timeout");
  // Early exit: when the runner produced fewer runs than cases AND at least
  // one L1 failure occurred. Team 2's runner sets status="skipped" explicitly
  // on early-exit cases, so we key off that.
  const anyL1Fail = args.gradings.some(
    (g) => g.tier === "L1" && !g.passed,
  );
  const skippedRuns = args.runs.filter((r) => r.status === "skipped").length;
  const earlyExit = anyL1Fail && skippedRuns > 0;
  const overallPassed = perTier.every((t) => t.meetsThreshold);
  const totalCases = args.caseSet.cases.length;
  const durationMs = args.finishedAt.getTime() - args.startedAt.getTime();

  return {
    startedAt: args.startedAt.toISOString(),
    finishedAt: args.finishedAt.toISOString(),
    durationMs,
    profile: args.profile,
    plan: args.plan,
    totalCases,
    perTier,
    perPlasmid,
    caseGradings: args.gradings,
    earlyExit,
    timeBudgetExceeded,
    overallPassed,
    dropped,
  };
}

function resolvePassStats(
  report: ValidationReport,
  plasmidId: PlasmidId,
  tier: ValidationLevel,
): { readonly passRate: number; readonly threshold: number } {
  const plasmid = report.perPlasmid.find((p) => p.plasmidId === plasmidId);
  const stats = plasmid?.perLevel.get(tier);
  if (stats !== undefined) {
    return { passRate: stats.rate, threshold: stats.threshold };
  }
  const tierStats = report.perTier.find((t) => t.tier === tier);
  if (tierStats !== undefined) {
    return { passRate: tierStats.rate, threshold: tierStats.threshold };
  }
  return { passRate: 0, threshold: 0 };
}

/** Unused imports guard — explicit re-reference keeps `RuntimeCase` alive for
 * downstream consumers who `import type { RuntimeCase } from "./validation"`. */
export type { RuntimeCase };
