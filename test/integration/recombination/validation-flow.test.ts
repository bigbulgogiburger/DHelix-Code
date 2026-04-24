/**
 * Integration test — Phase-3 Stage-6 validation flow end-to-end.
 *
 * Exercises the `executeRecombination` orchestrator with a fake
 * `validate` facade. Uses `StaticValidationMode="warn-only"` so Stage 5
 * never short-circuits the run before we reach Stage 6.
 *
 * Scenarios:
 *   A) validate returns "continue"  → applied=true, transcript.validation set
 *   B) validate returns "rollback"  → applied=false, writtenFiles unlinked,
 *                                      errorCode=VALIDATION_FAILED_L1
 *   C) --validate=none              → Stage 6 skipped explicitly
 *   D) --validate=local + validate  → Stage 6 executed (ok)
 */
import {
  access,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { executeRecombination } from "../../../src/recombination/executor.js";
import type {
  CompressFn,
  CompressionOutput,
  ExecutorDeps,
  GenerateFn,
  GeneratedArtifact,
  InterpretFn,
  LLMCompletionFn,
  RecombinationOptions,
  ReorganizeFn,
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

let workdir: string;

async function seedPlasmid(root: string, id: string): Promise<void> {
  const dir = join(root, ".dhelix/plasmids", id);
  await mkdir(dir, { recursive: true });
  await writeFile(
    join(dir, "metadata.yaml"),
    [
      `id: ${id}`,
      `name: ${id}`,
      `description: "Integration plasmid"`,
      `version: 0.1.0`,
      `tier: L2`,
      `scope: local`,
      `privacy: cloud-ok`,
      `created: 2026-04-01T00:00:00Z`,
      `updated: 2026-04-01T00:00:00Z`,
    ].join("\n"),
    "utf-8",
  );
  await writeFile(join(dir, "body.md"), "# body\nbody text\n", "utf-8");
}

async function activate(root: string, ids: readonly string[]): Promise<void> {
  const stateDir = join(root, ".dhelix/plasmids/.state");
  await mkdir(stateDir, { recursive: true });
  await writeFile(
    join(stateDir, "active.json"),
    JSON.stringify({
      activePlasmidIds: ids,
      updatedAt: new Date().toISOString(),
    }),
    "utf-8",
  );
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

function emptyReport(overrides: Partial<ValidationReport> = {}): ValidationReport {
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
    ...overrides,
  };
}

function baseDeps(
  workingDir: string,
  extra: Partial<ExecutorDeps> = {},
): ExecutorDeps {
  const interpret: InterpretFn = vi.fn(async (req) => ({
    ir: {
      plasmidId: req.plasmid.metadata.id,
      plasmidVersion: req.plasmid.metadata.version,
      metadata: req.plasmid.metadata,
      bodyFingerprint: req.plasmid.bodyFingerprint as PlasmidFingerprint,
      summary: "stub",
      intents: [],
      tier: req.plasmid.metadata.tier,
      interpretedAt: "2026-04-01T00:00:00Z",
      strategyUsed: req.strategy,
      cacheKey: `k-${req.plasmid.metadata.id}`,
    },
    cacheHit: false,
    warnings: [],
  }));

  // Real generate: produce one artifact per plasmid under .dhelix/rules/.
  const generate: GenerateFn = vi.fn(async (req) => {
    const artifacts: GeneratedArtifact[] = req.irs.map((ir) => ({
      kind: "rule",
      sourcePlasmid: ir.plasmidId,
      sourceIntentId: `${ir.plasmidId}-root`,
      targetPath: join(workingDir, ".dhelix/rules", `${ir.plasmidId}.md`),
      contents: `---\nname: ${ir.plasmidId}\n---\n# ${ir.plasmidId}\n`,
      contentHash: `h-${ir.plasmidId}`,
      templateLayer: "primitives",
      templateId: "primitives/rule.basic",
    }));
    return { artifacts, warnings: [] };
  });

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
    async (): Promise<ReorgPlan> => ({
      ops: [
        {
          kind: "insert",
          markerId: "alpha/intent",
          heading: "Intent",
          body: "body",
          sourcePlasmid: "alpha" as PlasmidId,
        },
      ],
      keptMarkerIds: [],
      preReorgContentHash: "pre",
      intentGraphHash: "graph",
      fallbackTier: "llm-only",
    }),
  );

  const llm: LLMCompletionFn = vi.fn(async () => "");
  return { interpret, generate, compress, reorganize, llm, ...extra };
}

async function exists(p: string): Promise<boolean> {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

beforeEach(async () => {
  workdir = await mkdtemp(join(tmpdir(), "dhelix-val-int-"));
});

afterEach(async () => {
  await rm(workdir, { recursive: true, force: true });
});

describe("integration: Stage 6 — scenario A (continue)", () => {
  it("records validation on transcript, preserves applied=true, stage 6 status=ok", async () => {
    await seedPlasmid(workdir, "alpha");
    await activate(workdir, ["alpha"]);

    const validate: ValidateFn = vi.fn(
      async (_req: ValidateRequest): Promise<ValidateResult> => ({
        report: emptyReport(),
        decision: { action: "continue", reason: "all L1-L2 passed" },
        regressions: [],
      }),
    );

    const opts: RecombinationOptions = {
      workingDirectory: workdir,
      registryPath: ".dhelix/plasmids",
      mode: "extend",
      approvalMode: "auto",
      staticValidation: "warn-only",
      validateProfile: "local",
    };

    const result = await executeRecombination(opts, baseDeps(workdir, { validate }));
    expect(result.applied).toBe(true);
    expect(validate).toHaveBeenCalledOnce();
    expect(result.transcript.validation).toBeDefined();

    const stage6 = result.transcript.stages.find((s) => s.stage === 6);
    expect(stage6?.status).toBe("ok");

    // Artifact is on disk.
    expect(await exists(join(workdir, ".dhelix/rules/alpha.md"))).toBe(true);

    // Pre-reorg snapshot + reorg ops are recorded.
    expect(result.transcript.preReorgSnapshot).toBeDefined();
    expect(result.transcript.reorgOps).toHaveLength(1);

    // Transcript JSON on disk contains the validation block.
    const entries = await readdir(
      join(workdir, ".dhelix/recombination/transcripts"),
    );
    const jsonPath = join(
      workdir,
      ".dhelix/recombination/transcripts",
      entries.find((n) => n.endsWith(".json"))!,
    );
    const body = await readFile(jsonPath, "utf-8");
    expect(body).toContain("\"validation\"");
  });
});

describe("integration: Stage 6 — scenario B (rollback)", () => {
  it("unlinks writtenFiles on L1 failure and records VALIDATION_FAILED_L1", async () => {
    await seedPlasmid(workdir, "alpha");
    await activate(workdir, ["alpha"]);

    const validate: ValidateFn = vi.fn(async () => ({
      report: emptyReport({ overallPassed: false }),
      decision: {
        action: "rollback" as const,
        reason: "synthetic L1 hard failure",
        failingTier: "L1" as const,
        failingPlasmidId: "alpha" as PlasmidId,
      },
      regressions: [],
    }));

    const opts: RecombinationOptions = {
      workingDirectory: workdir,
      registryPath: ".dhelix/plasmids",
      mode: "extend",
      approvalMode: "auto",
      staticValidation: "warn-only",
      validateProfile: "ci",
    };

    const result = await executeRecombination(opts, baseDeps(workdir, { validate }));
    expect(result.applied).toBe(false);
    expect(result.transcript.errorCode).toBe("VALIDATION_FAILED_L1");

    // Artifact was rolled back from disk.
    expect(await exists(join(workdir, ".dhelix/rules/alpha.md"))).toBe(false);
  });
});

describe("integration: --validate=none skips Stage 6 explicitly", () => {
  it("records stage 6 as skipped with 'explicit --validate=none' message", async () => {
    await seedPlasmid(workdir, "alpha");
    await activate(workdir, ["alpha"]);

    const validate: ValidateFn = vi.fn(async () => {
      throw new Error("should never run");
    });

    const opts: RecombinationOptions = {
      workingDirectory: workdir,
      registryPath: ".dhelix/plasmids",
      mode: "extend",
      approvalMode: "auto",
      staticValidation: "warn-only",
      validateProfile: "none",
    };

    const result = await executeRecombination(opts, baseDeps(workdir, { validate }));
    expect(result.applied).toBe(true);
    expect(validate).not.toHaveBeenCalled();
    const stage6 = result.transcript.stages.find((s) => s.stage === 6);
    expect(stage6?.status).toBe("skipped");
    expect(stage6?.message).toContain("explicit --validate=none");
  });
});

describe("integration: --validate=local runs the validator", () => {
  it("executes Stage 6 when deps.validate is injected and profile is set", async () => {
    await seedPlasmid(workdir, "alpha");
    await activate(workdir, ["alpha"]);

    const validate: ValidateFn = vi.fn(async () => ({
      report: emptyReport(),
      decision: { action: "continue" as const, reason: "ok" },
      regressions: [],
    }));

    const opts: RecombinationOptions = {
      workingDirectory: workdir,
      registryPath: ".dhelix/plasmids",
      mode: "extend",
      approvalMode: "auto",
      staticValidation: "warn-only",
      validateProfile: "local",
    };

    const result = await executeRecombination(opts, baseDeps(workdir, { validate }));
    expect(validate).toHaveBeenCalledOnce();
    expect(result.transcript.validation).toBeDefined();
  });
});
