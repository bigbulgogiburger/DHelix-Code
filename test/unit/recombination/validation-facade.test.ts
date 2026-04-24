/**
 * Unit tests for Team 5's `createValidate` facade (validation/index.ts).
 *
 * Exercises the four decision paths: continue, warn, rollback, and
 * rollback + keep override. Uses fully stubbed Team 1-3 deps so the test
 * never reads disk or contacts an LLM.
 */
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  buildValidationReport,
  createValidate,
  type ValidateFacadeDeps,
} from "../../../src/recombination/validation/index.js";
import type {
  ArtifactEnv,
  BuildArtifactEnvFn,
  CaseGrading,
  CompiledPlasmidIR,
  DecideRollbackFn,
  GenerateCasesFn,
  GracePromptIO,
  GradeCasesFn,
  PipelineStrategies,
  RollbackDecision,
  RunCasesFn,
  RuntimeCase,
  RuntimeCaseSet,
  RuntimeRunResult,
  ValidateRequest,
  VolumeGovernorFn,
  VolumePlan,
} from "../../../src/recombination/types.js";
import type {
  PlasmidFingerprint,
  PlasmidId,
} from "../../../src/plasmids/types.js";

// ─── helpers ─────────────────────────────────────────────────────────────────

function strategies(): PipelineStrategies {
  return {
    interpreter: "single-pass",
    compression: "abstractive",
    reorgFallback: "llm-only",
    validationVolume: "standard",
    validationParallelism: 1,
    gradingTiers: ["deterministic"],
    passThresholds: { L1: 0.95, L2: 0.8, L3: 0.7, L4: 0.6 },
    projectProfile: "full-llm",
    artifactGeneration: "template-only",
    interpreterRetries: 0,
  };
}

function ir(id: string): CompiledPlasmidIR {
  return {
    plasmidId: id as PlasmidId,
    plasmidVersion: "0.1.0",
    metadata: {
      id: id as PlasmidId,
      name: id,
      description: id,
      version: "0.1.0",
      tier: "L2",
      scope: "local",
      privacy: "cloud-ok",
      created: "2026-04-01T00:00:00Z",
      updated: "2026-04-01T00:00:00Z",
    },
    bodyFingerprint: "fp" as PlasmidFingerprint,
    summary: `summary ${id}`,
    intents: [],
    tier: "L2",
    interpretedAt: "2026-04-01T00:00:00Z",
    strategyUsed: "single-pass",
    cacheKey: `c-${id}`,
  };
}

function volumePlan(): VolumePlan {
  return {
    profile: "minimal",
    totalBudget: 4,
    perPlasmid: new Map(),
    timeBudgetMs: 30_000,
    parallelism: 1,
  };
}

function mkCase(id: string, plasmidId: string, tier: "L1" | "L2"): RuntimeCase {
  return {
    id,
    plasmidId: plasmidId as PlasmidId,
    tier,
    origin: "deterministic",
    prompt: "prompt",
    expectations: [],
  };
}

function mkRun(caseId: string, plasmidId: string, tier: "L1" | "L2"): RuntimeRunResult {
  return {
    caseId,
    plasmidId: plasmidId as PlasmidId,
    tier,
    output: "ok",
    toolCalls: [],
    hookFires: [],
    filesTouched: [],
    durationMs: 10,
    status: "ok",
  };
}

function mkGrading(
  caseId: string,
  plasmidId: string,
  tier: "L1" | "L2",
  passed: boolean,
): CaseGrading {
  return {
    caseId,
    plasmidId: plasmidId as PlasmidId,
    tier,
    passed,
    expectationResults: [],
  };
}

function envStub(cleanup: () => Promise<void>): ArtifactEnv {
  return {
    workspaceRoot: "/tmp/fake",
    cleanup,
    mode: "copy",
  };
}

interface StubDepsOptions {
  readonly decision: RollbackDecision;
  readonly gradings?: readonly CaseGrading[];
  readonly runs?: readonly RuntimeRunResult[];
  readonly cases?: readonly RuntimeCase[];
  readonly cleanup?: () => Promise<void>;
  readonly promptIO?: GracePromptIO;
}

function mkDeps(o: StubDepsOptions): ValidateFacadeDeps {
  const cases = o.cases ?? [mkCase("c1", "alpha", "L1")];
  const runs = o.runs ?? [mkRun("c1", "alpha", "L1")];
  const gradings = o.gradings ?? [mkGrading("c1", "alpha", "L1", true)];

  const buildVolumePlanFn: VolumeGovernorFn = vi.fn(() => volumePlan());
  const generateCasesFn: GenerateCasesFn = vi.fn(async (): Promise<RuntimeCaseSet> => ({
    cases,
    droppedCount: 0,
    droppedReasons: [],
  }));
  const buildArtifactEnvFn: BuildArtifactEnvFn = vi.fn(async () =>
    envStub(o.cleanup ?? (async () => {})),
  );
  const runCasesFn: RunCasesFn = vi.fn(async () => runs);
  const gradeCasesFn: GradeCasesFn = vi.fn(async () => gradings);
  const decideRollbackFn: DecideRollbackFn = vi.fn(() => o.decision);

  return {
    buildVolumePlan: buildVolumePlanFn,
    generateCases: generateCasesFn,
    buildArtifactEnv: buildArtifactEnvFn,
    runCases: runCasesFn,
    gradeCases: gradeCasesFn,
    decideRollback: decideRollbackFn,
    ...(o.promptIO !== undefined ? { promptIO: o.promptIO } : {}),
  };
}

function mkRequest(workdir: string): ValidateRequest {
  return {
    irs: [ir("alpha")],
    artifacts: [],
    reorgPlan: {
      ops: [],
      keptMarkerIds: [],
      preReorgContentHash: "pre",
      intentGraphHash: "graph",
      fallbackTier: "llm-only",
    },
    writtenFiles: [],
    strategies: strategies(),
    model: "gpt-4o",
    workingDirectory: workdir,
    transcriptId: "tid-1",
    profile: "local",
    llm: vi.fn(async () => "unused"),
  };
}

// Vitest hoists vi.mock; stub out Team 3 modules to avoid TODO throws from
// regression-tracker / override-tracker during the facade calls.
vi.mock("../../../src/recombination/validation/regression-tracker.js", () => ({
  appendHistory: vi.fn(async () => {}),
  detectRegressions: vi.fn(async () => []),
  reportToHistoryEntry: vi.fn((transcriptId: string) => ({
    timestamp: "2026-04-24T12:00:00Z",
    transcriptId,
    perTier: [],
    perPlasmid: [],
  })),
}));

vi.mock("../../../src/recombination/validation/override-tracker.js", () => ({
  recordOverride: vi.fn(async () => {}),
  countOverrides: vi.fn(async () => 0),
}));

vi.mock("../../../src/recombination/validation/reporter.js", () => ({
  renderReport: vi.fn(() => "rendered"),
  renderGraceFrame: vi.fn(() => "frame"),
  awaitRollbackDecision: vi.fn(async () => "rollback"),
  autoTimeoutDecisionIO: vi.fn(() => ({
    prompt: async () => "rollback",
  })),
}));

let workdir: string;

beforeEach(async () => {
  workdir = await mkdtemp(join(tmpdir(), "dhelix-val-facade-"));
});

afterEach(async () => {
  await rm(workdir, { recursive: true, force: true });
  vi.clearAllMocks();
});

// ─── buildValidationReport ──────────────────────────────────────────────────

describe("buildValidationReport", () => {
  it("aggregates per-tier stats + per-plasmid summaries from gradings", () => {
    const runs = [
      mkRun("c1", "alpha", "L1"),
      mkRun("c2", "alpha", "L2"),
    ];
    const gradings = [
      mkGrading("c1", "alpha", "L1", true),
      mkGrading("c2", "alpha", "L2", false),
    ];
    const cases = [mkCase("c1", "alpha", "L1"), mkCase("c2", "alpha", "L2")];
    const report = buildValidationReport({
      profile: "local",
      plan: volumePlan(),
      caseSet: { cases, droppedCount: 0, droppedReasons: [] },
      runs,
      gradings,
      irs: [ir("alpha")],
      strategies: strategies(),
      startedAt: new Date("2026-04-24T12:00:00Z"),
      finishedAt: new Date("2026-04-24T12:00:01Z"),
    });
    expect(report.totalCases).toBe(2);
    expect(report.durationMs).toBe(1000);
    const l1 = report.perTier.find((t) => t.tier === "L1")!;
    const l2 = report.perTier.find((t) => t.tier === "L2")!;
    expect(l1.total).toBe(1);
    expect(l1.passed).toBe(1);
    expect(l1.meetsThreshold).toBe(true);
    expect(l2.total).toBe(1);
    expect(l2.passed).toBe(0);
    expect(l2.meetsThreshold).toBe(false);
    expect(report.overallPassed).toBe(false);
    expect(report.perPlasmid).toHaveLength(1);
    expect(report.perPlasmid[0]!.plasmidId).toBe("alpha");
    expect(report.perPlasmid[0]!.overallPassed).toBe(false);
  });

  it("flags timeBudgetExceeded when any run is a timeout", () => {
    const runs = [{ ...mkRun("c1", "alpha", "L1"), status: "timeout" as const }];
    const gradings = [mkGrading("c1", "alpha", "L1", false)];
    const report = buildValidationReport({
      profile: "smoke",
      plan: volumePlan(),
      caseSet: { cases: [mkCase("c1", "alpha", "L1")], droppedCount: 0, droppedReasons: [] },
      runs,
      gradings,
      irs: [ir("alpha")],
      strategies: strategies(),
      startedAt: new Date(),
      finishedAt: new Date(),
    });
    expect(report.timeBudgetExceeded).toBe(true);
  });

  it("flags earlyExit when L1 fails AND some run is skipped", () => {
    const runs = [
      mkRun("c1", "alpha", "L1"),
      { ...mkRun("c2", "alpha", "L2"), status: "skipped" as const },
    ];
    const gradings = [mkGrading("c1", "alpha", "L1", false)];
    const report = buildValidationReport({
      profile: "smoke",
      plan: volumePlan(),
      caseSet: {
        cases: [mkCase("c1", "alpha", "L1"), mkCase("c2", "alpha", "L2")],
        droppedCount: 0,
        droppedReasons: [],
      },
      runs,
      gradings,
      irs: [ir("alpha")],
      strategies: strategies(),
      startedAt: new Date(),
      finishedAt: new Date(),
    });
    expect(report.earlyExit).toBe(true);
  });
});

// ─── createValidate — decision paths ─────────────────────────────────────────

describe("createValidate — action=continue", () => {
  it("returns decision.continue, calls env.cleanup, omits overrideRecorded", async () => {
    const cleanup = vi.fn(async () => {});
    const validate = createValidate(
      mkDeps({
        decision: { action: "continue", reason: "all green" },
        cleanup,
      }),
    );
    const result = await validate(mkRequest(workdir));
    expect(result.decision.action).toBe("continue");
    expect(result.overrideRecorded).toBeUndefined();
    expect(cleanup).toHaveBeenCalledOnce();
    expect(result.report.overallPassed).toBe(true);
  });
});

describe("createValidate — action=warn", () => {
  it("forwards warn decision; no override recorded even without promptIO", async () => {
    const cleanup = vi.fn(async () => {});
    const validate = createValidate(
      mkDeps({
        decision: { action: "warn", reason: "some warnings" },
        cleanup,
      }),
    );
    const result = await validate(mkRequest(workdir));
    expect(result.decision.action).toBe("warn");
    expect(result.overrideRecorded).toBeUndefined();
    expect(cleanup).toHaveBeenCalledOnce();
  });
});

describe("createValidate — action=rollback (no promptIO)", () => {
  it("returns rollback without override when promptIO is absent", async () => {
    const cleanup = vi.fn(async () => {});
    const validate = createValidate(
      mkDeps({
        decision: {
          action: "rollback",
          reason: "L1 failed",
          failingTier: "L1",
          failingPlasmidId: "alpha" as PlasmidId,
        },
        gradings: [mkGrading("c1", "alpha", "L1", false)],
        cleanup,
      }),
    );
    const result = await validate(mkRequest(workdir));
    expect(result.decision.action).toBe("rollback");
    expect(result.overrideRecorded).toBeUndefined();
    expect(cleanup).toHaveBeenCalledOnce();
  });
});

describe("createValidate — rollback + keep override", () => {
  it("flips action to continue and records an OverrideRecord when IO resolves 'keep'", async () => {
    const reporter = await import(
      "../../../src/recombination/validation/reporter.js"
    );
    (reporter.awaitRollbackDecision as unknown as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce("keep");
    const overrideMod = await import(
      "../../../src/recombination/validation/override-tracker.js"
    );

    const cleanup = vi.fn(async () => {});
    const promptIO: GracePromptIO = { prompt: async () => "keep" };
    const validate = createValidate(
      mkDeps({
        decision: {
          action: "rollback",
          reason: "L1 fail",
          failingTier: "L1",
          failingPlasmidId: "alpha" as PlasmidId,
        },
        gradings: [mkGrading("c1", "alpha", "L1", false)],
        cleanup,
        promptIO,
      }),
    );
    const result = await validate(mkRequest(workdir));
    expect(result.decision.action).toBe("continue");
    expect(result.overrideRecorded).toBeDefined();
    expect(result.overrideRecorded?.plasmidId).toBe("alpha");
    expect(result.overrideRecorded?.tier).toBe("L1");
    expect(overrideMod.recordOverride).toHaveBeenCalledOnce();
    expect(cleanup).toHaveBeenCalledOnce();
  });
});

describe("createValidate — env.cleanup is always invoked", () => {
  it("invokes cleanup even when runCases throws", async () => {
    const cleanup = vi.fn(async () => {});
    const deps = mkDeps({
      decision: { action: "continue", reason: "n/a" },
      cleanup,
    });
    const boom = deps.runCases as unknown as ReturnType<typeof vi.fn>;
    boom.mockImplementationOnce(async () => {
      throw new Error("runner blew up");
    });
    const validate = createValidate(deps);
    await expect(validate(mkRequest(workdir))).rejects.toThrow(/runner blew up/);
    expect(cleanup).toHaveBeenCalledOnce();
  });
});
