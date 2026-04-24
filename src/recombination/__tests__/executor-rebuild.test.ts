/**
 * Integration tests for `/recombination --mode rebuild` (Team 5, Phase 4).
 *
 * Flow covered:
 *   1. No-prior-transcript fallback (behaves as extend, no throw)
 *   2. Consumes prior artifacts + markers + populates `rebuildLineage`
 *   3. `rebuildLineage.rebuiltFromTranscriptId` matches latest prior id
 *   4. Stage 4 blob store write appears under `.dhelix/recombination/objects/`
 *   5. Blob write is idempotent — second run with same hashes never throws
 *   6. Rebuild tolerates Team-4-absent branches (mergeMode option ignored)
 *
 * Peer deps (interpret/generate/compress/reorganize) are stubbed. The
 * focus is on the rebuild orchestration path + the new side effects
 * (blob store + transcript lineage field).
 */
import { access, mkdir, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { executeRecombination } from "../executor.js";
import type {
  CompiledPlasmidIR,
  CompressFn,
  CompressionOutput,
  ExecutorDeps,
  GeneratedArtifact,
  GenerateFn,
  GenerateResult,
  InterpretFn,
  InterpretResult,
  LLMCompletionFn,
  RecombinationOptions,
  RecombinationTranscript,
  ReorganizeFn,
  ReorgPlan,
} from "../types.js";
import { objectStorePath } from "../types.js";
import { RECOMBINATION_TRANSCRIPTS_DIR } from "../types.js";
import type {
  PlasmidFingerprint,
  PlasmidId,
  PlasmidMetadata,
} from "../../plasmids/types.js";

// ─── fixtures ───────────────────────────────────────────────────────────────

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
  return {
    plasmidId: id as PlasmidId,
    plasmidVersion: "0.1.0",
    metadata: makeMeta(id),
    bodyFingerprint: "fp-stub" as PlasmidFingerprint,
    summary: `summary for ${id}`,
    intents: [],
    tier: "L2",
    interpretedAt: "2026-04-01T00:00:00Z",
    strategyUsed: "single-pass",
    cacheKey: `cache-${id}`,
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

function emptyReorg(): ReorgPlan {
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

// Arrange: build an artifact whose target lives inside the given workdir.
// Content hash is real sha256 so the blob store can resolve it.
async function makeStubArtifact(
  workdir: string,
  id: string,
  contents?: string,
): Promise<GeneratedArtifact> {
  const body =
    contents ??
    `---\nname: ${id}\ndescription: stub rule\n---\n\n# ${id}\n`;
  const crypto = await import("node:crypto");
  const contentHash = crypto.createHash("sha256").update(body, "utf-8").digest("hex");
  return {
    kind: "rule",
    sourcePlasmid: id as PlasmidId,
    sourceIntentId: `${id}-intent-1`,
    targetPath: join(workdir, ".dhelix/rules", `${id}.md`),
    contents: body,
    contentHash,
    templateLayer: "primitives",
    templateId: "primitives/rule.basic",
  };
}

function buildDeps(
  workdir: string,
  overrides: Partial<ExecutorDeps> & { readonly artifacts?: readonly GeneratedArtifact[] } = {},
): ExecutorDeps {
  const { artifacts, ...depOverrides } = overrides;
  const interpret: InterpretFn = vi.fn<
    (...args: Parameters<InterpretFn>) => Promise<InterpretResult>
  >(async (req) => ({
    ir: makeIR(req.plasmid.metadata.id),
    cacheHit: false,
    warnings: [],
  }));
  const generate: GenerateFn = vi.fn<
    (...args: Parameters<GenerateFn>) => Promise<GenerateResult>
  >(async () => ({
    artifacts: artifacts ?? [],
    warnings: [],
  }));
  const compress: CompressFn = vi.fn<
    (...args: Parameters<CompressFn>) => Promise<CompressionOutput>
  >(async () => emptyCompression());
  const reorganize: ReorganizeFn = vi.fn<
    (...args: Parameters<ReorganizeFn>) => Promise<ReorgPlan>
  >(async () => emptyReorg());
  void workdir; // referenced only by the artifact factory above
  return {
    interpret,
    generate,
    compress,
    reorganize,
    llm: llmStub,
    ...depOverrides,
  };
}

// ─── workspace helpers ──────────────────────────────────────────────────────

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

async function exists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

function baseOpts(
  mode: RecombinationOptions["mode"] = "extend",
): RecombinationOptions {
  return {
    workingDirectory: workdir,
    registryPath: ".dhelix/plasmids",
    mode,
    approvalMode: "auto",
    staticValidation: "strict",
  };
}

async function latestTranscript(cwd: string): Promise<RecombinationTranscript> {
  const dir = join(cwd, RECOMBINATION_TRANSCRIPTS_DIR);
  const { readdir } = await import("node:fs/promises");
  const entries = (await readdir(dir))
    .filter((f) => f.endsWith(".json"))
    .sort();
  const latest = entries[entries.length - 1];
  if (latest === undefined) {
    throw new Error("no transcripts found");
  }
  const raw = await readFile(join(dir, latest), "utf-8");
  return JSON.parse(raw) as RecombinationTranscript;
}

beforeEach(async () => {
  workdir = await mkdtemp(join(tmpdir(), "dhelix-rebuild-"));
});

afterEach(async () => {
  await rm(workdir, { recursive: true, force: true });
});

// ─── tests ──────────────────────────────────────────────────────────────────

describe("executeRecombination — rebuild mode", () => {
  it("falls back gracefully when no prior transcript exists", async () => {
    await seedPlasmid(workdir, "alpha");
    await activate(workdir, ["alpha"]);

    const deps = buildDeps(workdir);
    const result = await executeRecombination(baseOpts("rebuild"), deps);

    expect(result.applied).toBe(true);
    expect(result.transcript.mode).toBe("rebuild");
    // Fallback path — no lineage recorded because there was nothing to consume.
    expect(result.transcript.rebuildLineage).toBeUndefined();
    // Stage 0 carries a fallback message noting the absent prior transcript.
    const stage0 = result.transcript.stages.find((s) => s.stage === 0);
    expect(stage0?.message ?? "").toMatch(/rebuild fallback/i);
  });

  it("consumes prior artifacts + markers and populates rebuildLineage", async () => {
    await seedPlasmid(workdir, "beta");
    await activate(workdir, ["beta"]);

    // 1. First run (extend) produces artifacts that the rebuild will consume.
    const firstArtifact = await makeStubArtifact(workdir, "beta");
    const firstDeps = buildDeps(workdir, { artifacts: [firstArtifact] });
    const firstResult = await executeRecombination(baseOpts("extend"), firstDeps);
    expect(firstResult.applied).toBe(true);
    expect(await exists(firstArtifact.targetPath)).toBe(true);
    const firstTranscriptId = firstResult.transcript.id;

    // 2. Second run in rebuild mode — the prior artifact must be cleaned up
    // by the internal cure, and the new transcript must carry lineage.
    const secondArtifact = await makeStubArtifact(
      workdir,
      "beta",
      `---\nname: beta\ndescription: rebuilt\n---\n\n# rebuilt\n`,
    );
    const secondDeps = buildDeps(workdir, { artifacts: [secondArtifact] });
    const secondResult = await executeRecombination(baseOpts("rebuild"), secondDeps);

    expect(secondResult.applied).toBe(true);
    expect(secondResult.transcript.mode).toBe("rebuild");
    const lineage = secondResult.transcript.rebuildLineage;
    expect(lineage).toBeDefined();
    expect(lineage?.rebuiltFromTranscriptId).toBe(firstTranscriptId);
    expect(lineage?.consumedArtifactCount ?? 0).toBeGreaterThan(0);
  });

  it("rebuildLineage.rebuiltFromTranscriptId matches the latest prior transcript id", async () => {
    await seedPlasmid(workdir, "gamma");
    await activate(workdir, ["gamma"]);

    // Two prior extend runs so we can verify 'latest' = second transcript.
    const artA = await makeStubArtifact(workdir, "gamma");
    const firstResult = await executeRecombination(
      baseOpts("extend"),
      buildDeps(workdir, { artifacts: [artA] }),
    );
    // Transcript ids are second-precision + a random suffix, so a 1.1s
    // delay guarantees strict lexical ordering across the two prior runs.
    await new Promise((r) => setTimeout(r, 1_100));
    const artB = await makeStubArtifact(
      workdir,
      "gamma",
      `---\nname: gamma\ndescription: v2\n---\n\n# v2\n`,
    );
    const secondResult = await executeRecombination(
      baseOpts("extend"),
      buildDeps(workdir, { artifacts: [artB] }),
    );
    const priorLatestId = secondResult.transcript.id;
    expect(priorLatestId).not.toBe(firstResult.transcript.id);
    expect(priorLatestId > firstResult.transcript.id).toBe(true);

    // Same guard for the rebuild — its transcript must also sort strictly
    // after the extend one so `readLatestTranscriptId` returns `priorLatestId`.
    await new Promise((r) => setTimeout(r, 1_100));
    const rebuildResult = await executeRecombination(
      baseOpts("rebuild"),
      buildDeps(workdir, { artifacts: [artB] }),
    );
    expect(rebuildResult.transcript.rebuildLineage?.rebuiltFromTranscriptId).toBe(
      priorLatestId,
    );
  });

  it("writes every artifact to the content-addressed object store at Stage 4", async () => {
    await seedPlasmid(workdir, "delta");
    await activate(workdir, ["delta"]);

    const art = await makeStubArtifact(workdir, "delta");
    const result = await executeRecombination(
      baseOpts("extend"),
      buildDeps(workdir, { artifacts: [art] }),
    );
    expect(result.applied).toBe(true);

    const blobPath = objectStorePath(workdir, art.contentHash);
    expect(await exists(blobPath)).toBe(true);
    // Blob contents must match the source material.
    const blobBody = await readFile(blobPath, "utf-8");
    expect(blobBody).toBe(art.contents);

    // Every transcript writtenFile with a non-empty hash should be archived.
    for (const wf of result.transcript.writtenFiles) {
      if (wf.contentHash === "") continue;
      const bp = objectStorePath(workdir, wf.contentHash);
      expect(await exists(bp)).toBe(true);
    }
  });

  it("is idempotent — re-writing the same hash does not throw", async () => {
    await seedPlasmid(workdir, "epsilon");
    await activate(workdir, ["epsilon"]);

    const art = await makeStubArtifact(workdir, "epsilon");
    // First write populates the blob.
    await executeRecombination(
      baseOpts("extend"),
      buildDeps(workdir, { artifacts: [art] }),
    );
    const blobPath = objectStorePath(workdir, art.contentHash);
    const firstStat = await stat(blobPath);

    // Second run in rebuild mode must not crash even though the blob key
    // already exists on disk. Hash-keyed ⇒ identical bytes ⇒ no-op.
    const result = await executeRecombination(
      baseOpts("rebuild"),
      buildDeps(workdir, { artifacts: [art] }),
    );
    expect(result.applied).toBe(true);
    expect(await exists(blobPath)).toBe(true);

    // Size is preserved (idempotent write) — mtime may or may not change
    // depending on the fast-path skip vs. atomic rename race.
    const secondStat = await stat(blobPath);
    expect(secondStat.size).toBe(firstStat.size);
  });

  it("tolerates absent Team-4 mergeMode support (option ignored if unknown)", async () => {
    await seedPlasmid(workdir, "zeta");
    await activate(workdir, ["zeta"]);

    // Prior run to create a transcript + artifact for the rebuild to consume.
    const first = await makeStubArtifact(workdir, "zeta");
    const firstRes = await executeRecombination(
      baseOpts("extend"),
      buildDeps(workdir, { artifacts: [first] }),
    );
    expect(firstRes.transcript.mode).toBe("extend");
    // Ensure the rebuild transcript id sorts strictly after the extend one.
    await new Promise((r) => setTimeout(r, 1_100));

    // The rebuild path injects `mergeMode: "keep-user"` into CureOptions
    // even when the current Team-4 branch ignores it. We verify the run
    // completes successfully — no type-error blow-up, no thrown exception.
    const second = await makeStubArtifact(
      workdir,
      "zeta",
      `---\nname: zeta\ndescription: v2\n---\n\n# v2\n`,
    );
    const rebuildResult = await executeRecombination(
      baseOpts("rebuild"),
      buildDeps(workdir, { artifacts: [second] }),
    );
    expect(rebuildResult.applied).toBe(true);

    // Sanity: persisted transcript matches what we returned.
    const persisted = await latestTranscript(workdir);
    expect(persisted.mode).toBe("rebuild");
    expect(persisted.rebuildLineage).toBeDefined();
  });
});
