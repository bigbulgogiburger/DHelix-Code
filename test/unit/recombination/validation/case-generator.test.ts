/**
 * Unit tests for `src/recombination/validation/case-generator.ts`.
 *
 * Covers:
 *   - seeds-first priority
 *   - deterministic derivation for L1/L2/L3
 *   - quota enforcement
 *   - L4 skipped when llm grading tier absent
 *   - AbortSignal propagation
 *   - LLM auto-gen via mock `LLMCompletionFn`
 */
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type {
  PlasmidFingerprint,
  PlasmidId,
  PlasmidMetadata,
} from "../../../../src/plasmids/types.js";
import type {
  CompiledPlasmidIR,
  GradingTier,
  LLMCompletionFn,
  PipelineStrategies,
  PlasmidIntentNode,
  PlasmidQuota,
  ValidationLevel,
  VolumePlan,
} from "../../../../src/recombination/types.js";
import { generateCases } from "../../../../src/recombination/validation/case-generator.js";
import { evalSeedsPath } from "../../../../src/recombination/validation/eval-seeds.js";

const PID = "case-gen-test" as PlasmidId;

function meta(overrides: Partial<PlasmidMetadata> = {}): PlasmidMetadata {
  return {
    id: PID,
    name: "case-gen-test",
    description: "A plasmid about security scanning and commit validation.",
    version: "1.0.0",
    tier: "L1",
    scope: "local",
    privacy: "local-only",
    created: "2026-04-24T00:00:00Z",
    updated: "2026-04-24T00:00:00Z",
    ...overrides,
  };
}

function intent(overrides: Partial<PlasmidIntentNode> = {}): PlasmidIntentNode {
  return {
    id: overrides.id ?? "int-1",
    sourcePlasmid: PID,
    kind: overrides.kind ?? "command",
    title: overrides.title ?? "security-scan",
    description:
      overrides.description ??
      "Runs a security scan. When the user asks to commit, verify no secrets leaked.",
    constraints: overrides.constraints ?? [
      "Never skip the scan even in CI mode.",
    ],
    evidence: [],
    params: overrides.params ?? { triggers: ["scan files", "audit repo"] },
  };
}

function ir(
  overrides: Partial<CompiledPlasmidIR> = {},
  metaOverrides: Partial<PlasmidMetadata> = {},
  intents: readonly PlasmidIntentNode[] = [intent()],
): CompiledPlasmidIR {
  const m = meta(metaOverrides);
  return {
    plasmidId: PID,
    plasmidVersion: m.version,
    metadata: m,
    bodyFingerprint: "fp" as PlasmidFingerprint,
    summary: "",
    intents,
    tier: m.tier,
    interpretedAt: m.created,
    strategyUsed: "single-pass",
    cacheKey: "k",
    ...overrides,
  };
}

function strategies(
  gradingTiers: readonly GradingTier[] = ["deterministic", "semi", "llm"],
): PipelineStrategies {
  return {
    interpreter: "single-pass",
    compression: "abstractive",
    reorgFallback: "llm-with-deterministic-fallback",
    validationVolume: "standard",
    validationParallelism: 1,
    gradingTiers,
    passThresholds: { L1: 1, L2: 0.9, L3: 0.8, L4: 0.7 },
    projectProfile: "full-llm",
    artifactGeneration: "template-and-llm",
    interpreterRetries: 0,
  };
}

function planFor(quota: PlasmidQuota): VolumePlan {
  const m = new Map<PlasmidId, PlasmidQuota>();
  m.set(PID, quota);
  return {
    profile: "standard",
    totalBudget: quota.L1 + quota.L2 + quota.L3 + quota.L4,
    perPlasmid: m,
    timeBudgetMs: 300_000,
    parallelism: 1,
  };
}

const noLlm: LLMCompletionFn = async () => {
  throw new Error("LLM must not be called");
};

describe("generateCases — deterministic derivation", () => {
  let cwd: string;
  beforeEach(async () => {
    cwd = await mkdtemp(join(tmpdir(), "case-gen-test-"));
  });
  afterEach(async () => {
    await rm(cwd, { recursive: true, force: true });
  });

  it("derives L1 cases from triggers + keywords", async () => {
    const r = await generateCases({
      irs: [ir()],
      strategies: strategies(["deterministic"]),
      plan: planFor({ L1: 3, L2: 0, L3: 0, L4: 0 }),
      workingDirectory: cwd,
      llm: noLlm,
    });
    expect(r.cases.length).toBe(3);
    expect(r.cases.every((c) => c.tier === "L1")).toBe(true);
    expect(r.cases.every((c) => c.origin === "deterministic")).toBe(true);
  });

  it("never exceeds quota", async () => {
    const r = await generateCases({
      irs: [ir()],
      strategies: strategies(["deterministic"]),
      plan: planFor({ L1: 1, L2: 0, L3: 0, L4: 0 }),
      workingDirectory: cwd,
      llm: noLlm,
    });
    expect(r.cases.length).toBe(1);
  });

  it("derives L2 cases from `When ...` sentences", async () => {
    const r = await generateCases({
      irs: [
        ir({}, {}, [
          intent({
            id: "int-l2",
            description:
              "When the user asks to commit, block the commit. When secrets are found, print a warning.",
            constraints: [],
            params: {},
          }),
        ]),
      ],
      strategies: strategies(["deterministic"]),
      plan: planFor({ L1: 0, L2: 5, L3: 0, L4: 0 }),
      workingDirectory: cwd,
      llm: noLlm,
    });
    expect(r.cases.length).toBeGreaterThan(0);
    expect(r.cases.every((c) => c.tier === "L2")).toBe(true);
  });

  it("derives L3 cases from constraints (denial-phrase expectations)", async () => {
    const r = await generateCases({
      irs: [
        ir({}, {}, [
          intent({
            id: "int-l3",
            constraints: ["Never skip the scan even in CI mode."],
            params: {},
          }),
        ]),
      ],
      strategies: strategies(["deterministic"]),
      plan: planFor({ L1: 0, L2: 0, L3: 1, L4: 0 }),
      workingDirectory: cwd,
      llm: noLlm,
    });
    expect(r.cases).toHaveLength(1);
    expect(r.cases[0].tier).toBe("L3");
    expect(
      r.cases[0].expectations.some((e) => /does NOT contain/.test(e)),
    ).toBe(true);
  });
});

describe("generateCases — seed priority + LLM gating", () => {
  let cwd: string;
  beforeEach(async () => {
    cwd = await mkdtemp(join(tmpdir(), "case-gen-seeds-"));
  });
  afterEach(async () => {
    await rm(cwd, { recursive: true, force: true });
  });

  const writeSeeds = async (): Promise<void> => {
    const p = evalSeedsPath(cwd, PID);
    await mkdir(join(cwd, ".dhelix/plasmids", PID), { recursive: true });
    await writeFile(
      p,
      `plasmidId: ${PID}\nseeds:\n  - id: manual-1\n    tier: L1\n    prompt: "manual prompt"\n    expectations: ["output contains 'ok'"]\n`,
      "utf8",
    );
  };

  it("seeds come before deterministic", async () => {
    await writeSeeds();
    const r = await generateCases({
      irs: [ir()],
      strategies: strategies(["deterministic"]),
      plan: planFor({ L1: 3, L2: 0, L3: 0, L4: 0 }),
      workingDirectory: cwd,
      llm: noLlm,
    });
    expect(r.cases[0].origin).toBe("eval-seed");
    expect(r.cases[0].id).toBe("seed:manual-1");
    expect(r.cases.slice(1).every((c) => c.origin === "deterministic")).toBe(
      true,
    );
  });

  it("skips L4 entirely when llm grading absent", async () => {
    const r = await generateCases({
      irs: [ir()],
      strategies: strategies(["deterministic", "semi"]),
      plan: planFor({ L1: 0, L2: 0, L3: 0, L4: 2 }),
      workingDirectory: cwd,
      llm: noLlm,
    });
    expect(r.cases).toHaveLength(0);
    expect(r.droppedCount).toBe(2);
    expect(
      r.droppedReasons.every(
        (d) => d.reason === "tier skipped (no llm grading)",
      ),
    ).toBe(true);
  });

  it("calls LLM to fill remaining L4 quota when llm grading is enabled", async () => {
    const llm = vi.fn<LLMCompletionFn>(async () =>
      JSON.stringify([
        {
          id: "a1",
          prompt: "adversarial prompt",
          expectations: ["output contains 'x'"],
        },
        {
          id: "a2",
          prompt: "adversarial 2",
          expectations: ["output contains 'y'"],
        },
      ]),
    );
    const r = await generateCases({
      irs: [ir()],
      strategies: strategies(["deterministic", "llm"]),
      plan: planFor({ L1: 0, L2: 0, L3: 0, L4: 2 }),
      workingDirectory: cwd,
      llm,
    });
    expect(llm).toHaveBeenCalledTimes(1);
    expect(r.cases).toHaveLength(2);
    expect(r.cases.every((c) => c.origin === "llm-auto")).toBe(true);
    expect(r.cases.every((c) => c.tier === "L4")).toBe(true);
  });

  it("records `llm autogen failed` drops when LLM returns garbage", async () => {
    const llm = vi.fn<LLMCompletionFn>(async () => "not json");
    const r = await generateCases({
      irs: [ir()],
      strategies: strategies(["deterministic", "llm"]),
      plan: planFor({ L1: 0, L2: 0, L3: 0, L4: 3 }),
      workingDirectory: cwd,
      llm,
    });
    expect(r.cases).toHaveLength(0);
    expect(r.droppedCount).toBe(3);
    expect(
      r.droppedReasons.every((d) => d.reason === "llm autogen failed"),
    ).toBe(true);
  });

  it("aborts immediately on pre-aborted signal", async () => {
    const ac = new AbortController();
    ac.abort();
    await expect(
      generateCases({
        irs: [ir()],
        strategies: strategies(["deterministic"]),
        plan: planFor({ L1: 1, L2: 0, L3: 0, L4: 0 }),
        workingDirectory: cwd,
        llm: noLlm,
        signal: ac.signal,
      }),
    ).rejects.toThrow(/aborted/);
  });
});

describe("generateCases — aggregate quota enforcement", () => {
  let cwd: string;
  beforeEach(async () => {
    cwd = await mkdtemp(join(tmpdir(), "case-gen-agg-"));
  });
  afterEach(async () => {
    await rm(cwd, { recursive: true, force: true });
  });

  it("never emits more cases than the per-plasmid quota", async () => {
    const quota: PlasmidQuota = { L1: 2, L2: 1, L3: 0, L4: 0 };
    const r = await generateCases({
      irs: [ir()],
      strategies: strategies(["deterministic"]),
      plan: planFor(quota),
      workingDirectory: cwd,
      llm: noLlm,
    });
    const counts: Record<ValidationLevel, number> = {
      L1: 0,
      L2: 0,
      L3: 0,
      L4: 0,
    };
    for (const c of r.cases) counts[c.tier] += 1;
    expect(counts.L1).toBeLessThanOrEqual(quota.L1);
    expect(counts.L2).toBeLessThanOrEqual(quota.L2);
    expect(counts.L3).toBeLessThanOrEqual(quota.L3);
    expect(counts.L4).toBeLessThanOrEqual(quota.L4);
  });
});
