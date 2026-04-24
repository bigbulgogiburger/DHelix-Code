/**
 * Stage-6 / Stage-7 executor unit tests — Team 5 Phase 3.
 *
 * Covers the validate-facade wiring: continue / warn / rollback / skipped
 * paths + the new phase-3 transcript fields (preReorgSnapshot, reorgOps,
 * validation). Peer deps (interpret/generate/compress/reorganize) are
 * stubbed so we can focus on Stage 6 behaviour.
 */
import { access, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { executeRecombination } from "../../../src/recombination/executor.js";
import type {
  CompiledPlasmidIR,
  CompressFn,
  CompressionOutput,
  ExecutorDeps,
  GenerateFn,
  GeneratedArtifact,
  InterpretFn,
  LLMCompletionFn,
  RecombinationOptions,
  ReorganizeFn,
  ReorgOp,
  ReorgPlan,
  ValidateFn,
  ValidateRequest,
  ValidateResult,
  ValidationReport,
  VolumePlan,
} from "../../../src/recombination/types.js";
import type {
  PlasmidFingerprint,
  PlasmidId,
} from "../../../src/plasmids/types.js";

// ── fixtures ────────────────────────────────────────────────────────────────

function makeIR(id: string): CompiledPlasmidIR {
  return {
    plasmidId: id as PlasmidId,
    plasmidVersion: "0.1.0",
    metadata: {
      id: id as PlasmidId,
      name: id,
      description: "d",
      version: "0.1.0",
      tier: "L2",
      scope: "local",
      privacy: "cloud-ok",
      created: "2026-04-01T00:00:00Z",
      updated: "2026-04-01T00:00:00Z",
    },
    bodyFingerprint: "fp" as PlasmidFingerprint,
    summary: `s-${id}`,
    intents: [],
    tier: "L2",
    interpretedAt: "2026-04-01T00:00:00Z",
    strategyUsed: "single-pass",
    cacheKey: `c-${id}`,
  };
}

function reorgWithOp(op: ReorgOp): ReorgPlan {
  return {
    ops: [op],
    keptMarkerIds: [],
    preReorgContentHash: "pre",
    intentGraphHash: "graph",
    fallbackTier: "llm-only",
  };
}

function volumePlan(): VolumePlan {
  return {
    profile: "minimal",
    totalBudget: 0,
    perPlasmid: new Map(),
    timeBudgetMs: 1000,
    parallelism: 1,
  };
}

function emptyReport(): ValidationReport {
  return {
    startedAt: "2026-04-24T12:00:00.000Z",
    finishedAt: "2026-04-24T12:00:01.000Z",
    durationMs: 1000,
    profile: "local",
    plan: volumePlan(),
    totalCases: 0,
    perTier: [],
    perPlasmid: [],
    caseGradings: [],
    earlyExit: false,
    timeBudgetExceeded: false,
    overallPassed: true,
    dropped: [],
  };
}

function baseDeps(extra: Partial<ExecutorDeps> = {}): ExecutorDeps {
  const interpret: InterpretFn = vi.fn(async (req) => ({
    ir: makeIR(req.plasmid.metadata.id),
    cacheHit: false,
    warnings: [],
  }));
  const generate: GenerateFn = vi.fn(
    async (): Promise<{ artifacts: readonly GeneratedArtifact[]; warnings: readonly string[] }> => ({
      artifacts: [],
      warnings: [],
    }),
  );
  const compress: CompressFn = vi.fn(
    async (): Promise<CompressionOutput> => ({
      summaries: [],
      sections: [],
      projectProfileMarkdown: "",
      totalTokenEstimate: 0,
      budgetTokens: 1500,
      droppedPlasmidIds: [],
    }),
  );
  const reorganize: ReorganizeFn = vi.fn(
    async (): Promise<ReorgPlan> =>
      reorgWithOp({
        kind: "insert",
        markerId: "alpha/intent-1",
        heading: "Intent 1",
        body: "body-1",
        sourcePlasmid: "alpha" as PlasmidId,
      }),
  );
  const llm: LLMCompletionFn = vi.fn(async () => "");
  return { interpret, generate, compress, reorganize, llm, ...extra };
}

// ── workspace ──────────────────────────────────────────────────────────────

let workdir: string;

async function seedPlasmid(root: string, id: string): Promise<void> {
  const dir = join(root, ".dhelix/plasmids", id);
  await mkdir(dir, { recursive: true });
  await writeFile(
    join(dir, "metadata.yaml"),
    [
      `id: ${id}`,
      `name: ${id}`,
      `description: "test"`,
      `version: 0.1.0`,
      `tier: L2`,
      `scope: local`,
      `privacy: cloud-ok`,
      `created: 2026-04-01T00:00:00Z`,
      `updated: 2026-04-01T00:00:00Z`,
    ].join("\n"),
    "utf-8",
  );
  await writeFile(join(dir, "body.md"), "# body\nhello\n", "utf-8");
}

async function activate(root: string, ids: readonly string[]): Promise<void> {
  const stateDir = join(root, ".dhelix/plasmids/.state");
  await mkdir(stateDir, { recursive: true });
  await writeFile(
    join(stateDir, "active.json"),
    JSON.stringify({ activePlasmidIds: ids, updatedAt: new Date().toISOString() }),
    "utf-8",
  );
}

async function fileExists(p: string): Promise<boolean> {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

function opts(overrides: Partial<RecombinationOptions> = {}): RecombinationOptions {
  return {
    workingDirectory: workdir,
    registryPath: ".dhelix/plasmids",
    mode: "extend",
    approvalMode: "auto",
    staticValidation: "warn-only",
    ...overrides,
  };
}

beforeEach(async () => {
  workdir = await mkdtemp(join(tmpdir(), "dhelix-exec-s6-"));
});

afterEach(async () => {
  await rm(workdir, { recursive: true, force: true });
});

// ── Phase 3 Stage-1/2d transcript capture ──────────────────────────────────

describe("executor — preReorgSnapshot + reorgOps capture", () => {
  it("captures preReorgSnapshot from existing DHELIX.md and records reorgOps", async () => {
    await seedPlasmid(workdir, "alpha");
    await activate(workdir, ["alpha"]);
    await writeFile(join(workdir, "DHELIX.md"), "# Existing\n\nUser body.\n", "utf-8");
    const result = await executeRecombination(opts(), baseDeps());
    expect(result.applied).toBe(true);
    expect(result.transcript.preReorgSnapshot).toBeDefined();
    expect(result.transcript.preReorgSnapshot?.beforeContent).toContain("User body.");
    expect(result.transcript.preReorgSnapshot?.beforeHash).toMatch(/^[0-9a-f]{64}$/);
    expect(result.transcript.reorgOps).toHaveLength(1);
    expect(result.transcript.reorgOps?.[0]!.markerId).toBe("alpha/intent-1");
  });
});

// ── Stage 6 — skipped paths ─────────────────────────────────────────────────

describe("executor Stage 6 — skipped paths", () => {
  it("skips with 'no validator injected' when profile undefined and no validate dep", async () => {
    await seedPlasmid(workdir, "alpha");
    await activate(workdir, ["alpha"]);
    const result = await executeRecombination(opts(), baseDeps());
    const stage6 = result.transcript.stages.find((s) => s.stage === 6);
    expect(stage6).toBeDefined();
    expect(stage6?.status).toBe("skipped");
    expect(stage6?.message).toContain("no validator injected");
  });

  it("skips with 'phase-2 compatible path' when validator injected but profile undefined", async () => {
    await seedPlasmid(workdir, "alpha");
    await activate(workdir, ["alpha"]);
    const validate: ValidateFn = vi.fn(async () => {
      throw new Error("should not be called");
    });
    // No validateProfile in opts.
    const result = await executeRecombination(opts(), baseDeps({ validate }));
    const stage6 = result.transcript.stages.find((s) => s.stage === 6);
    expect(stage6?.status).toBe("skipped");
    expect(stage6?.message).toContain("phase-2 compatible");
    expect(validate).not.toHaveBeenCalled();
  });

  it("skips with 'no validator injected' when validateProfile set but deps.validate missing", async () => {
    await seedPlasmid(workdir, "alpha");
    await activate(workdir, ["alpha"]);
    const result = await executeRecombination(opts({ validateProfile: "local" }), baseDeps());
    const stage6 = result.transcript.stages.find((s) => s.stage === 6);
    expect(stage6?.status).toBe("skipped");
    expect(stage6?.message).toContain("no validator injected");
  });

  it("skips with 'explicit --validate=none' when validateProfile='none'", async () => {
    await seedPlasmid(workdir, "alpha");
    await activate(workdir, ["alpha"]);
    const validate = vi.fn(async () => {
      throw new Error("should not be called");
    });
    const result = await executeRecombination(
      opts({ validateProfile: "none" }),
      baseDeps({ validate: validate as unknown as ValidateFn }),
    );
    const stage6 = result.transcript.stages.find((s) => s.stage === 6);
    expect(stage6?.status).toBe("skipped");
    expect(stage6?.message).toContain("explicit --validate=none");
    expect(validate).not.toHaveBeenCalled();
  });
});

// ── Stage 6 — action=continue ───────────────────────────────────────────────

describe("executor Stage 6 — continue", () => {
  it("records validation on transcript, stage status=ok, applied=true", async () => {
    await seedPlasmid(workdir, "alpha");
    await activate(workdir, ["alpha"]);
    const report = emptyReport();
    const validate: ValidateFn = vi.fn(
      async (_req: ValidateRequest): Promise<ValidateResult> => ({
        report,
        decision: { action: "continue", reason: "all green" },
        regressions: [],
      }),
    );
    const result = await executeRecombination(
      opts({ validateProfile: "local" }),
      baseDeps({ validate }),
    );
    expect(result.applied).toBe(true);
    expect(result.transcript.validation).toEqual(report);
    const stage6 = result.transcript.stages.find((s) => s.stage === 6);
    expect(stage6?.status).toBe("ok");
    expect(validate).toHaveBeenCalledOnce();
  });
});

// ── Stage 6 — action=warn ───────────────────────────────────────────────────

describe("executor Stage 6 — warn", () => {
  it("records stage status=warn but keeps applied=true", async () => {
    await seedPlasmid(workdir, "alpha");
    await activate(workdir, ["alpha"]);
    const validate: ValidateFn = vi.fn(async () => ({
      report: emptyReport(),
      decision: { action: "warn", reason: "L3 below threshold" },
      regressions: [],
    }));
    const result = await executeRecombination(
      opts({ validateProfile: "local" }),
      baseDeps({ validate }),
    );
    expect(result.applied).toBe(true);
    const stage6 = result.transcript.stages.find((s) => s.stage === 6);
    expect(stage6?.status).toBe("warn");
    expect(stage6?.message).toBe("L3 below threshold");
  });
});

// ── Stage 6 — action=rollback ───────────────────────────────────────────────

describe("executor Stage 6 — rollback", () => {
  it("rolls back written artifacts, marks applied=false, sets VALIDATION_FAILED_L1 code", async () => {
    await seedPlasmid(workdir, "alpha");
    await activate(workdir, ["alpha"]);

    // Generate one real artifact so we can verify it gets unlinked.
    const generate: GenerateFn = vi.fn(async () => ({
      artifacts: [
        {
          kind: "rule" as const,
          sourcePlasmid: "alpha" as PlasmidId,
          sourceIntentId: "alpha-int",
          targetPath: join(workdir, ".dhelix/rules/alpha.md"),
          contents: "---\nname: alpha\n---\n# alpha\n",
          contentHash: "h",
          templateLayer: "primitives" as const,
          templateId: "primitives/rule.basic",
        },
      ],
      warnings: [],
    }));

    const validate: ValidateFn = vi.fn(async () => ({
      report: emptyReport(),
      decision: {
        action: "rollback",
        reason: "L1 hard fail",
        failingTier: "L1",
        failingPlasmidId: "alpha" as PlasmidId,
      },
      regressions: [],
    }));

    const result = await executeRecombination(
      opts({ validateProfile: "ci" }),
      baseDeps({ generate, validate }),
    );
    expect(result.applied).toBe(false);
    expect(result.transcript.errorCode).toBe("VALIDATION_FAILED_L1");
    const stage6 = result.transcript.stages.find((s) => s.stage === 6);
    expect(stage6?.status).toBe("error");
    // Artifact should be rolled back.
    expect(await fileExists(join(workdir, ".dhelix/rules/alpha.md"))).toBe(false);
    // Transcript should still be persisted.
    expect(
      await fileExists(join(workdir, ".dhelix/recombination/transcripts")),
    ).toBe(true);
  });

  it("maps failingTier=L2 to VALIDATION_FAILED_L2", async () => {
    await seedPlasmid(workdir, "alpha");
    await activate(workdir, ["alpha"]);
    const validate: ValidateFn = vi.fn(async () => ({
      report: emptyReport(),
      decision: {
        action: "rollback",
        reason: "L2 below threshold",
        failingTier: "L2",
      },
      regressions: [],
    }));
    const result = await executeRecombination(
      opts({ validateProfile: "ci" }),
      baseDeps({ validate }),
    );
    expect(result.transcript.errorCode).toBe("VALIDATION_FAILED_L2");
    expect(result.applied).toBe(false);
  });

  it("maps foundationalL4Triggered=true to VALIDATION_FAILED_FOUNDATIONAL_L4", async () => {
    await seedPlasmid(workdir, "alpha");
    await activate(workdir, ["alpha"]);
    const validate: ValidateFn = vi.fn(async () => ({
      report: emptyReport(),
      decision: {
        action: "rollback",
        reason: "foundational L4 exceeded 5%",
        foundationalL4Triggered: true,
      },
      regressions: [],
    }));
    const result = await executeRecombination(
      opts({ validateProfile: "ci" }),
      baseDeps({ validate }),
    );
    expect(result.transcript.errorCode).toBe("VALIDATION_FAILED_FOUNDATIONAL_L4");
  });
});

// ── Stage 6 — crash path ────────────────────────────────────────────────────

describe("executor Stage 6 — validator crash", () => {
  it("records stage as warn but continues (Phase-2 compat preserved)", async () => {
    await seedPlasmid(workdir, "alpha");
    await activate(workdir, ["alpha"]);
    const validate: ValidateFn = vi.fn(async () => {
      throw new Error("infrastructure down");
    });
    const result = await executeRecombination(
      opts({ validateProfile: "local" }),
      baseDeps({ validate }),
    );
    expect(result.applied).toBe(true);
    const stage6 = result.transcript.stages.find((s) => s.stage === 6);
    expect(stage6?.status).toBe("warn");
    expect(stage6?.message).toContain("infrastructure down");
  });
});

// ── Stage 6 — override recorded ─────────────────────────────────────────────

describe("executor Stage 6 — override recorded on keep", () => {
  it("records validationOverride when facade returns overrideRecorded", async () => {
    await seedPlasmid(workdir, "alpha");
    await activate(workdir, ["alpha"]);
    const validate: ValidateFn = vi.fn(async () => ({
      report: emptyReport(),
      decision: { action: "continue", reason: "user kept it" },
      regressions: [],
      overrideRecorded: {
        timestamp: "2026-04-24T12:00:00Z",
        transcriptId: "tid",
        plasmidId: "alpha" as PlasmidId,
        tier: "L1",
        reason: "user override",
        passRate: 0.5,
        threshold: 0.95,
        actor: "1@h",
      },
    }));
    const result = await executeRecombination(
      opts({ validateProfile: "local" }),
      baseDeps({ validate }),
    );
    expect(result.applied).toBe(true);
    expect(result.transcript.validationOverride).toBeDefined();
    expect(result.transcript.validationOverride?.tier).toBe("L1");
  });
});
