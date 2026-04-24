/**
 * Unit tests for `src/recombination/executor.ts` — the 8-stage pipeline
 * orchestrator (Phase-2 implements stages 0–5; stage 6/7 are recorded
 * as skipped / release markers respectively).
 *
 * All peer dependencies (interpret / generate / compress / reorganize /
 * llm) are stubbed so the executor is exercised in isolation.
 */
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { executeRecombination } from "../../../src/recombination/executor.js";
import { RecombinationError } from "../../../src/recombination/errors.js";
import type {
  CompiledPlasmidIR,
  CompressFn,
  CompressionOutput,
  ExecutorDeps,
  GenerateFn,
  GenerateResult,
  GeneratedArtifact,
  InterpretFn,
  InterpretResult,
  LLMCompletionFn,
  RecombinationOptions,
  ReorganizeFn,
  ReorgPlan,
} from "../../../src/recombination/types.js";
import type {
  PlasmidFingerprint,
  PlasmidId,
  PlasmidMetadata,
} from "../../../src/plasmids/types.js";

// ── fixtures ────────────────────────────────────────────────────────────────

function makeMeta(id: string): PlasmidMetadata {
  return {
    id: id as PlasmidId,
    name: id,
    description: `Test plasmid ${id}`,
    version: "0.1.0",
    tier: "L2",
    scope: "local",
    privacy: "cloud-ok",
    created: "2026-04-01T00:00:00Z",
    updated: "2026-04-01T00:00:00Z",
  };
}

function makeIR(id: string): CompiledPlasmidIR {
  const meta = makeMeta(id);
  return {
    plasmidId: meta.id,
    plasmidVersion: "0.1.0",
    metadata: meta,
    bodyFingerprint: "fp-stub" as PlasmidFingerprint,
    summary: `summary for ${id}`,
    intents: [],
    tier: "L2",
    interpretedAt: "2026-04-01T00:00:00Z",
    strategyUsed: "single-pass",
    cacheKey: `cache-${id}`,
  };
}

function okArtifact(
  id: string,
  overrides: Partial<GeneratedArtifact> = {},
): GeneratedArtifact {
  return {
    kind: overrides.kind ?? "rule",
    sourcePlasmid: id as PlasmidId,
    sourceIntentId: `${id}-intent-1`,
    targetPath:
      overrides.targetPath ?? join(workdir, ".dhelix/rules", `${id}.md`),
    contents:
      overrides.contents ??
      `---\nname: ${id}\ndescription: stub rule\n---\n\n# ${id}\n`,
    contentHash: "hash",
    templateLayer: overrides.templateLayer ?? "primitives",
    templateId: overrides.templateId ?? "primitives/rule.basic",
    ...(overrides.requiredTools !== undefined
      ? { requiredTools: overrides.requiredTools }
      : {}),
    ...(overrides.trustLevel !== undefined
      ? { trustLevel: overrides.trustLevel }
      : {}),
  };
}

function emptyCompression(): CompressionOutput {
  return {
    summaries: [],
    sections: [],
    projectProfileMarkdown: "",
    totalTokenEstimate: 0,
    budgetTokens: 1500,
    droppedPlasmidIds: [],
  };
}

function okReorg(): ReorgPlan {
  return {
    ops: [],
    keptMarkerIds: [],
    preReorgContentHash: "pre",
    intentGraphHash: "graph",
    fallbackTier: "llm-only",
  };
}

const llmStub: LLMCompletionFn = vi.fn<
  (...args: Parameters<LLMCompletionFn>) => ReturnType<LLMCompletionFn>
>(async () => "unused");

function buildDeps(overrides: Partial<ExecutorDeps> = {}): ExecutorDeps {
  const interpret: InterpretFn = vi.fn<
    (...args: Parameters<InterpretFn>) => Promise<InterpretResult>
  >(async (req) => ({
    ir: makeIR(req.plasmid.metadata.id),
    cacheHit: false,
    warnings: [],
  }));
  const generate: GenerateFn = vi.fn<
    (...args: Parameters<GenerateFn>) => Promise<GenerateResult>
  >(async () => ({ artifacts: [], warnings: [] }));
  const compress: CompressFn = vi.fn<
    (...args: Parameters<CompressFn>) => Promise<CompressionOutput>
  >(async () => emptyCompression());
  const reorganize: ReorganizeFn = vi.fn<
    (...args: Parameters<ReorganizeFn>) => Promise<ReorgPlan>
  >(async () => okReorg());
  return {
    interpret,
    generate,
    compress,
    reorganize,
    llm: llmStub,
    ...overrides,
  };
}

// ── scratch workspace + registry setup ──────────────────────────────────────

let workdir: string;

async function seedPlasmid(root: string, id: string): Promise<void> {
  const dir = join(root, ".dhelix/plasmids", id);
  await mkdir(dir, { recursive: true });
  const metadata = [
    `id: ${id}`,
    `name: ${id}`,
    `description: "A plasmid for testing"`,
    `version: 0.1.0`,
    `tier: L2`,
    `scope: local`,
    `privacy: cloud-ok`,
    `created: 2026-04-01T00:00:00Z`,
    `updated: 2026-04-01T00:00:00Z`,
  ].join("\n");
  await writeFile(join(dir, "metadata.yaml"), metadata, "utf-8");
  await writeFile(join(dir, "body.md"), "# body\nhello\n", "utf-8");
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

beforeEach(async () => {
  workdir = await mkdtemp(join(tmpdir(), "dhelix-exec-"));
});

afterEach(async () => {
  await rm(workdir, { recursive: true, force: true });
});

function baseOpts(mode: RecombinationOptions["mode"] = "extend"): RecombinationOptions {
  return {
    workingDirectory: workdir,
    registryPath: ".dhelix/plasmids",
    mode,
    approvalMode: "auto",
    staticValidation: "strict",
  };
}

// ── tests ───────────────────────────────────────────────────────────────────

describe("executeRecombination — happy path", () => {
  it("runs extend mode end-to-end and returns applied=true with populated transcript", async () => {
    await seedPlasmid(workdir, "alpha");
    await activate(workdir, ["alpha"]);

    const deps = buildDeps();
    const result = await executeRecombination(baseOpts("extend"), deps);

    expect(result.applied).toBe(true);
    expect(result.transcript.mode).toBe("extend");
    expect(result.transcript.activePlasmidIds).toEqual(["alpha"]);
    // Stage 0..7 all recorded (7 is release; stage 6 appears as skipped).
    const stageIds = result.transcript.stages.map((s) => s.stage);
    expect(stageIds).toContain(0);
    expect(stageIds).toContain(5);
    // Wiring report passed; no error code recorded.
    expect(result.transcript.wiring.passed).toBe(true);
    expect(result.transcript.errorCode).toBeUndefined();
  });

  it("runs dry-run mode without applying — applied=false and no artifact files on disk", async () => {
    await seedPlasmid(workdir, "beta");
    await activate(workdir, ["beta"]);

    const deps = buildDeps({
      generate: vi.fn<
        (...args: Parameters<GenerateFn>) => Promise<GenerateResult>
      >(async () => ({
        artifacts: [okArtifact("beta")],
        warnings: [],
      })),
    });
    const result = await executeRecombination(baseOpts("dry-run"), deps);
    expect(result.applied).toBe(false);
    // Generated artifact was NOT written to disk.
    let present = true;
    try {
      await readFile(join(workdir, ".dhelix/rules/beta.md"), "utf-8");
    } catch {
      present = false;
    }
    expect(present).toBe(false);
  });
});

describe("executeRecombination — error paths", () => {
  it("falls back gracefully when mode='rebuild' runs with no prior transcript", async () => {
    // Phase 4: the rebuild guard is removed. With zero existing transcripts
    // the executor proceeds as if mode='extend' and emits a stage-0 note.
    await seedPlasmid(workdir, "rebuild-fallback");
    await activate(workdir, ["rebuild-fallback"]);
    const deps = buildDeps();
    const result = await executeRecombination(baseOpts("rebuild"), deps);
    expect(result.applied).toBe(true);
    expect(result.transcript.mode).toBe("rebuild");
    expect(result.transcript.rebuildLineage).toBeUndefined();
  });

  it("returns applied=false and records wiring errors when strict validation fails", async () => {
    await seedPlasmid(workdir, "gamma");
    await activate(workdir, ["gamma"]);
    // Generate an artifact with an unknown tool → triggers WIRING_REFERENCE_MISSING_TOOL.
    const bad: GeneratedArtifact = okArtifact("gamma", {
      targetPath: join(workdir, ".dhelix/rules/gamma.md"),
      requiredTools: ["this-tool-definitely-does-not-exist"],
    });
    const deps = buildDeps({
      generate: vi.fn<
        (...args: Parameters<GenerateFn>) => Promise<GenerateResult>
      >(async () => ({ artifacts: [bad], warnings: [] })),
    });

    const result = await executeRecombination(baseOpts("extend"), deps);
    expect(result.applied).toBe(false);
    expect(result.transcript.errorCode).toBe("WIRING_VALIDATION_ERROR");
    expect(result.transcript.wiring.errorCount).toBeGreaterThan(0);

    // Rollback: the artifact file should have been removed.
    let present = true;
    try {
      await readFile(join(workdir, ".dhelix/rules/gamma.md"), "utf-8");
    } catch {
      present = false;
    }
    expect(present).toBe(false);
  });

  it("throws RECOMBINATION_ABORTED when the signal is aborted before stage 0", async () => {
    const ac = new AbortController();
    ac.abort();
    const deps = buildDeps();
    await expect(
      executeRecombination({ ...baseOpts(), signal: ac.signal }, deps),
    ).rejects.toThrow(RecombinationError);
  });

  it("propagates privacy violation when an active plasmid is local-only under a cloud model", async () => {
    // Seed a local-only plasmid under local registry.
    const dir = join(workdir, ".dhelix/plasmids/secret");
    await mkdir(dir, { recursive: true });
    await writeFile(
      join(dir, "metadata.yaml"),
      [
        "id: secret",
        "name: secret",
        'description: "secret plasmid"',
        "version: 0.1.0",
        "tier: L2",
        "scope: local",
        "privacy: local-only",
        "created: 2026-04-01T00:00:00Z",
        "updated: 2026-04-01T00:00:00Z",
      ].join("\n"),
      "utf-8",
    );
    await writeFile(join(dir, "body.md"), "# body\n", "utf-8");
    await activate(workdir, ["secret"]);

    const deps = buildDeps();
    try {
      await executeRecombination(
        { ...baseOpts("extend"), modelOverride: "gpt-4o" }, // cloud caps
        deps,
      );
      throw new Error("expected privacy block");
    } catch (err) {
      expect(err).toBeInstanceOf(RecombinationError);
      if (err instanceof RecombinationError) {
        expect(err.code).toBe("PRIVACY_CLOUD_BLOCKED");
      }
    }
  });
});

describe("executeRecombination — cache counters", () => {
  it("counts interpret cache hits + misses across active plasmids", async () => {
    await seedPlasmid(workdir, "first-p");
    await seedPlasmid(workdir, "second-p");
    await activate(workdir, ["first-p", "second-p"]);

    const interpret: InterpretFn = vi.fn<
      (...args: Parameters<InterpretFn>) => Promise<InterpretResult>
    >(async (req) => ({
      ir: makeIR(req.plasmid.metadata.id),
      cacheHit: req.plasmid.metadata.id === "first-p",
      warnings: [],
    }));
    const deps = buildDeps({ interpret });
    const result = await executeRecombination(baseOpts("extend"), deps);
    expect(result.transcript.cacheHits).toBe(1);
    expect(result.transcript.cacheMisses).toBe(1);
  });
});
