/**
 * Phase 5 — Team 5: executor override consumption integration tests.
 *
 * Verifies that the Stage 0/1 hook correctly consumes pending foundational
 * overrides (queued by `/plasmid challenge --action override`) before the
 * pipeline proceeds, and records the dropped ids on the transcript.
 *
 * Coverage:
 *   1. consumed plasmid is dropped from Stage 1 (interpret never sees it)
 *   2. transcript carries `consumedOverrides` with the dropped id
 *   3. consumed override is one-shot — second executor run does NOT drop again
 *   4. missing/empty overrides-pending file → no-op (best-effort surface)
 *   5. transcript shape stays Phase-4 compatible when no overrides consumed
 *      (no `consumedOverrides` key present)
 */
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { executeRecombination } from "../executor.js";
import type {
  CompiledPlasmidIR,
  CompressFn,
  CompressionOutput,
  ExecutorDeps,
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
import {
  RECOMBINATION_TRANSCRIPTS_DIR,
} from "../types.js";
import type {
  PlasmidFingerprint,
  PlasmidId,
  PlasmidMetadata,
} from "../../plasmids/types.js";
import { OVERRIDE_PENDING_PATH } from "../../plasmids/types.js";

// ─── governance module mock ─────────────────────────────────────────────────
//
// Team 3's `consumeOverride` is still a placeholder export when this team's
// branch lands first. We mock the module so the dynamic import inside the
// executor sees a working surface AND we can drive the consume-once
// semantics deterministically from each test.

interface MockState {
  readonly remaining: Set<string>;
  readonly consumedHistory: string[];
}
const mockState: MockState = {
  remaining: new Set(),
  consumedHistory: [],
};

vi.mock("../../plasmids/governance/overrides-pending.js", () => ({
  consumeOverride: async (req: { plasmidId: string }): Promise<boolean> => {
    if (mockState.remaining.has(req.plasmidId)) {
      mockState.remaining.delete(req.plasmidId);
      mockState.consumedHistory.push(req.plasmidId);
      return true;
    }
    return false;
  },
}));

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

let interpretCalls: string[] = [];

function buildDeps(): ExecutorDeps {
  const interpret: InterpretFn = vi.fn<
    (...args: Parameters<InterpretFn>) => Promise<InterpretResult>
  >(async (req) => {
    interpretCalls.push(req.plasmid.metadata.id);
    return {
      ir: makeIR(req.plasmid.metadata.id),
      cacheHit: false,
      warnings: [],
    };
  });
  const generate: GenerateFn = vi.fn<
    (...args: Parameters<GenerateFn>) => Promise<GenerateResult>
  >(async () => ({ artifacts: [], warnings: [] }));
  const compress: CompressFn = vi.fn<
    (...args: Parameters<CompressFn>) => Promise<CompressionOutput>
  >(async () => emptyCompression());
  const reorganize: ReorganizeFn = vi.fn<
    (...args: Parameters<ReorganizeFn>) => Promise<ReorgPlan>
  >(async () => emptyReorg());
  return {
    interpret,
    generate,
    compress,
    reorganize,
    llm: llmStub,
  };
}

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

async function writePendingOverrideFile(
  root: string,
  ids: readonly string[],
): Promise<void> {
  const path = join(root, OVERRIDE_PENDING_PATH);
  await mkdir(join(root, ".dhelix/governance"), { recursive: true });
  const payload = {
    pending: ids.map((id) => ({
      plasmidId: id,
      queuedAt: new Date().toISOString(),
      rationaleSha256: "0".repeat(64),
    })),
  };
  await writeFile(path, JSON.stringify(payload, null, 2), "utf-8");
}

function baseOpts(): RecombinationOptions {
  return {
    workingDirectory: workdir,
    registryPath: ".dhelix/plasmids",
    mode: "extend",
    approvalMode: "auto",
    staticValidation: "strict",
  };
}

async function latestTranscript(cwd: string): Promise<RecombinationTranscript> {
  const dir = join(cwd, RECOMBINATION_TRANSCRIPTS_DIR);
  const entries = (await readdir(dir)).filter((f) => f.endsWith(".json")).sort();
  const latest = entries[entries.length - 1];
  if (latest === undefined) throw new Error("no transcripts found");
  const raw = await readFile(join(dir, latest), "utf-8");
  return JSON.parse(raw) as RecombinationTranscript;
}

beforeEach(async () => {
  workdir = await mkdtemp(join(tmpdir(), "dhelix-override-"));
  mockState.remaining.clear();
  mockState.consumedHistory.length = 0;
  interpretCalls = [];
});

afterEach(async () => {
  await rm(workdir, { recursive: true, force: true });
});

describe("executeRecombination — Phase 5 override consumption", () => {
  it("drops a plasmid from Stage 1 when a pending override is queued", async () => {
    await seedPlasmid(workdir, "alpha");
    await seedPlasmid(workdir, "beta");
    await activate(workdir, ["alpha", "beta"]);
    await writePendingOverrideFile(workdir, ["alpha"]);
    mockState.remaining.add("alpha");

    const result = await executeRecombination(baseOpts(), buildDeps());

    expect(result.applied).toBe(true);
    expect(interpretCalls).toEqual(["beta"]);
    expect(result.transcript.activePlasmidIds).toEqual(["beta"]);
    expect(result.transcript.consumedOverrides).toEqual(["alpha"]);
  });

  it("records consumedOverrides on the persisted transcript JSON", async () => {
    await seedPlasmid(workdir, "alpha");
    await activate(workdir, ["alpha"]);
    await writePendingOverrideFile(workdir, ["alpha"]);
    mockState.remaining.add("alpha");

    const result = await executeRecombination(baseOpts(), buildDeps());
    expect(result.applied).toBe(true);

    const persisted = await latestTranscript(workdir);
    expect(persisted.consumedOverrides).toEqual(["alpha"]);
  });

  it("only consumes the override once across two executor runs", async () => {
    await seedPlasmid(workdir, "alpha");
    await seedPlasmid(workdir, "beta");
    await activate(workdir, ["alpha", "beta"]);
    await writePendingOverrideFile(workdir, ["alpha"]);
    mockState.remaining.add("alpha");

    const first = await executeRecombination(baseOpts(), buildDeps());
    expect(first.transcript.consumedOverrides).toEqual(["alpha"]);
    expect(interpretCalls).toEqual(["beta"]);

    interpretCalls = [];
    const second = await executeRecombination(baseOpts(), buildDeps());
    // Override has been consumed — second run sees both plasmids again.
    expect(second.transcript.consumedOverrides).toBeUndefined();
    expect(interpretCalls.sort()).toEqual(["alpha", "beta"]);
    // Mock state confirms only one consume occurred across both runs.
    expect(mockState.consumedHistory).toEqual(["alpha"]);
  });

  it("is a no-op when the overrides-pending file is missing", async () => {
    await seedPlasmid(workdir, "gamma");
    await activate(workdir, ["gamma"]);
    // No pending file written; mock state empty so consume returns false.

    const result = await executeRecombination(baseOpts(), buildDeps());

    expect(result.applied).toBe(true);
    expect(interpretCalls).toEqual(["gamma"]);
    expect(result.transcript.consumedOverrides).toBeUndefined();
  });

  it("preserves the Phase-4 transcript shape when no overrides fire", async () => {
    await seedPlasmid(workdir, "delta");
    await activate(workdir, ["delta"]);

    const result = await executeRecombination(baseOpts(), buildDeps());
    const persisted = await latestTranscript(workdir);

    // Field is absent (not present-but-empty) — Phase 2/3/4 compatible.
    expect(Object.prototype.hasOwnProperty.call(persisted, "consumedOverrides")).toBe(
      false,
    );
    expect(result.transcript).not.toHaveProperty("consumedOverrides");
  });
});
