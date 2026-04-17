import { describe, expect, it, vi } from "vitest";
import type { GradedExpectation } from "../../../../../src/skills/creator/evals/types.js";
import {
  createProductionOptimizerDeps,
  optimizeDescription,
  type OptimizerDeps,
  type TriggerEval,
} from "../../../../../src/skills/creator/optimize/description-optimizer.js";

// Mock createGraderClient so production deps never touch real LLMs.
const gradeMock = vi.fn<
  (args: {
    readonly prompt: string;
    readonly output: string;
    readonly expectation: string;
    readonly signal?: AbortSignal;
  }) => Promise<GradedExpectation>
>();

vi.mock("../../../../../src/skills/creator/evals/grader.js", () => ({
  createGraderClient: () => ({ grade: gradeMock }),
}));

// ---------------------------------------------------------------------------
// Helpers to build stub deps
// ---------------------------------------------------------------------------

/**
 * Build 20 trigger evals: 10 should-trigger + 10 should-not-trigger.
 * Prompts are "pos-0"..."pos-9" and "neg-0"..."neg-9".
 */
function makeTriggerEvals(): readonly TriggerEval[] {
  const pos: TriggerEval[] = Array.from({ length: 10 }, (_, i) => ({
    prompt: `pos-${i}`,
    shouldTrigger: true,
  }));
  const neg: TriggerEval[] = Array.from({ length: 10 }, (_, i) => ({
    prompt: `neg-${i}`,
    shouldTrigger: false,
  }));
  return [...pos, ...neg];
}

/**
 * Build a deps object where `checkTrigger` decides triggering based on which
 * description is passed. `triggerMap` maps descriptionKey -> set of prompts
 * that DO trigger.
 */
interface StubConfig {
  readonly triggerEvals?: readonly TriggerEval[];
  readonly triggerMap: ReadonlyMap<string, ReadonlySet<string>>;
  readonly rewrites: readonly string[];
}

function buildDeps(cfg: StubConfig): {
  readonly deps: OptimizerDeps;
  readonly counters: {
    generateCalls: number;
    checkCalls: number;
    rewriteCalls: number;
    concurrentPeak: number;
  };
} {
  const counters = {
    generateCalls: 0,
    checkCalls: 0,
    rewriteCalls: 0,
    concurrentPeak: 0,
  };
  let inFlight = 0;
  let rewriteIdx = 0;

  const deps: OptimizerDeps = {
    generateTriggerEvals: async () => {
      counters.generateCalls += 1;
      return cfg.triggerEvals ?? makeTriggerEvals();
    },
    checkTrigger: async ({ description, prompt }) => {
      counters.checkCalls += 1;
      inFlight += 1;
      if (inFlight > counters.concurrentPeak) counters.concurrentPeak = inFlight;
      try {
        // Simulate some async gap to allow parallel fan-out to be observable.
        await new Promise((r) => setImmediate(r));
        const triggeringPrompts = cfg.triggerMap.get(description);
        return triggeringPrompts ? triggeringPrompts.has(prompt) : false;
      } finally {
        inFlight -= 1;
      }
    },
    rewriteDescription: async () => {
      const next = cfg.rewrites[rewriteIdx] ?? `candidate-${rewriteIdx}`;
      rewriteIdx += 1;
      counters.rewriteCalls += 1;
      return next;
    },
  };

  return { deps, counters };
}

/** Set of prompts triggered by a description which matches exactly `nPos` positives and `nNeg` negatives. */
function triggerSet(nPos: number, nNeg: number): ReadonlySet<string> {
  const s = new Set<string>();
  for (let i = 0; i < nPos; i += 1) s.add(`pos-${i}`);
  for (let i = 0; i < nNeg; i += 1) s.add(`neg-${i}`);
  return s;
}

// accuracy = (pos-triggered + (10 - neg-triggered)) / 20

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("optimizeDescription", () => {
  it("computes baseline accuracy correctly (14/20 = 0.7)", async () => {
    // 8 of 10 positives trigger, 4 of 10 negatives trigger → passed = 8 + (10 - 4) = 14
    const baseline = "baseline-desc";
    const { deps } = buildDeps({
      triggerMap: new Map([[baseline, triggerSet(8, 4)]]),
      rewrites: [], // maxIterations=0 → no rewrites needed
    });

    const result = await optimizeDescription(
      { baselineDescription: baseline, skillBody: "body" },
      deps,
      { maxIterations: 0 },
    );

    expect(result.baselineAccuracy).toBeCloseTo(0.7, 10);
    expect(result.bestAccuracy).toBeCloseTo(0.7, 10);
    expect(result.final).toBe(baseline);
    expect(result.history).toHaveLength(1);
    expect(result.history[0]?.version).toBe(0);
    expect(result.history[0]?.accepted).toBe(true);
  });

  it("accepts improving candidate, rejects worse-but-within-threshold, accepts better-than-best", async () => {
    // baseline: 14/20 = 0.70
    // candidate-1: 17/20 = 0.85 (improvement +0.15 > 0.05) → accepted
    // candidate-2: 16/20 = 0.80 (within 0.10 of best, not >+0.05) → rejected, not a regression
    // candidate-3: 19/20 = 0.95 (> 0.85 + 0.05) → accepted
    const baseline = "baseline";
    const c1 = "cand-1";
    const c2 = "cand-2";
    const c3 = "cand-3";

    const { deps, counters } = buildDeps({
      triggerMap: new Map([
        [baseline, triggerSet(8, 4)], // 14
        [c1, triggerSet(9, 2)], // 9 + 8 = 17
        [c2, triggerSet(9, 3)], // 9 + 7 = 16
        [c3, triggerSet(10, 1)], // 10 + 9 = 19
      ]),
      rewrites: [c1, c2, c3],
    });

    const result = await optimizeDescription(
      { baselineDescription: baseline, skillBody: "body" },
      deps,
      { maxIterations: 3 },
    );

    expect(counters.rewriteCalls).toBe(3);
    expect(result.history.map((h) => h.accepted)).toEqual([
      true,
      true,
      false,
      true,
    ]);
    expect(result.history[1]?.reason).toBe("won");
    expect(result.history[2]?.reason).toBe("no-improvement");
    expect(result.history[3]?.reason).toBe("won");
    expect(result.final).toBe(c3);
    expect(result.bestAccuracy).toBeCloseTo(0.95, 10);
  });

  it("regression guard breaks loop and records reason=regression-guard", async () => {
    const baseline = "baseline";
    const c1 = "cand-1";
    const c2 = "cand-2";
    const c3 = "cand-3";

    // baseline: 0.8
    // c1: 0.95 (accepted, best=0.95)
    // c2: 0.80 (drop = 0.15 > 0.10) → regression-guard, break
    // c3: never reached
    const { deps, counters } = buildDeps({
      triggerMap: new Map([
        [baseline, triggerSet(9, 3)], // 16 → 0.8
        [c1, triggerSet(10, 1)], // 19 → 0.95
        [c2, triggerSet(9, 3)], // 16 → 0.8 (< 0.95 - 0.10)
        [c3, triggerSet(10, 0)], // 20 → 1.0 (should never run)
      ]),
      rewrites: [c1, c2, c3],
    });

    const result = await optimizeDescription(
      { baselineDescription: baseline, skillBody: "body" },
      deps,
      { maxIterations: 5 },
    );

    expect(counters.rewriteCalls).toBe(2);
    expect(result.history).toHaveLength(3); // baseline + c1 + c2
    expect(result.history[2]?.reason).toBe("regression-guard");
    expect(result.history[2]?.accepted).toBe(false);
    expect(result.final).toBe(c1);
    expect(result.bestAccuracy).toBeCloseTo(0.95, 10);
  });

  it("honors maxIterations=2 (only two rewrites)", async () => {
    const baseline = "baseline";
    const { deps, counters } = buildDeps({
      triggerMap: new Map([[baseline, triggerSet(5, 5)]]),
      rewrites: ["c1", "c2", "c3", "c4", "c5"],
    });

    await optimizeDescription(
      { baselineDescription: baseline, skillBody: "body" },
      deps,
      { maxIterations: 2 },
    );

    expect(counters.rewriteCalls).toBe(2);
  });

  it("defaults maxIterations to 5", async () => {
    const baseline = "baseline";
    const { deps, counters } = buildDeps({
      triggerMap: new Map([[baseline, triggerSet(5, 5)]]),
      rewrites: Array.from({ length: 10 }, (_, i) => `c${i}`),
    });

    await optimizeDescription(
      { baselineDescription: baseline, skillBody: "body" },
      deps,
    );

    expect(counters.rewriteCalls).toBe(5);
  });

  it("aborts mid-iteration via AbortSignal", async () => {
    const baseline = "baseline";
    const controller = new AbortController();
    const { deps } = buildDeps({
      triggerMap: new Map([[baseline, triggerSet(5, 5)]]),
      rewrites: ["c1", "c2"],
    });

    // Abort immediately after generateTriggerEvals resolves.
    const wrapped: OptimizerDeps = {
      ...deps,
      generateTriggerEvals: async (args) => {
        const res = await deps.generateTriggerEvals(args);
        controller.abort();
        return res;
      },
    };

    await expect(
      optimizeDescription(
        { baselineDescription: baseline, skillBody: "body" },
        wrapped,
        { signal: controller.signal },
      ),
    ).rejects.toThrow(/abort/i);
  });

  it("calls generateTriggerEvals exactly once and checkTrigger N*(iterations+1) times", async () => {
    // baseline + 3 candidates = 4 evaluations × 20 prompts = 80 checkTrigger calls
    const baseline = "baseline";
    const { deps, counters } = buildDeps({
      triggerMap: new Map([[baseline, triggerSet(5, 5)]]),
      rewrites: ["c1", "c2", "c3"],
    });

    await optimizeDescription(
      { baselineDescription: baseline, skillBody: "body" },
      deps,
      { maxIterations: 3 },
    );

    expect(counters.generateCalls).toBe(1);
    expect(counters.checkCalls).toBe(80);
  });

  it("respects concurrency limit in checkTrigger fan-out", async () => {
    const baseline = "baseline";
    const { deps, counters } = buildDeps({
      triggerMap: new Map([[baseline, triggerSet(5, 5)]]),
      rewrites: [],
    });

    await optimizeDescription(
      { baselineDescription: baseline, skillBody: "body" },
      deps,
      { maxIterations: 0, concurrency: 3 },
    );

    expect(counters.concurrentPeak).toBeLessThanOrEqual(3);
    expect(counters.concurrentPeak).toBeGreaterThan(0);
  });

  it("final is the highest-accuracy accepted candidate, even when later candidates are worse", async () => {
    const baseline = "baseline";
    const c1 = "cand-1";
    const c2 = "cand-2";

    // baseline: 0.5
    // c1: 0.9 accepted (best)
    // c2: 0.6 rejected (not regression: 0.9 - 0.6 = 0.3 > 0.10) → regression-guard, but best remains c1
    const { deps } = buildDeps({
      triggerMap: new Map([
        [baseline, triggerSet(5, 5)], // 10/20 = 0.5
        [c1, triggerSet(9, 1)], // 18/20 = 0.9
        [c2, triggerSet(6, 4)], // 12/20 = 0.6
      ]),
      rewrites: [c1, c2],
    });

    const result = await optimizeDescription(
      { baselineDescription: baseline, skillBody: "body" },
      deps,
      { maxIterations: 5 },
    );

    expect(result.final).toBe(c1);
    expect(result.bestAccuracy).toBeCloseTo(0.9, 10);
  });

  it("no-improvement path: every candidate <= baseline → final === baseline, all candidates rejected", async () => {
    const baseline = "baseline";
    const c1 = "c1";
    const c2 = "c2";
    const c3 = "c3";
    const c4 = "c4";
    const c5 = "c5";

    // baseline: 0.8 (16/20)
    // every candidate: 0.75 (15/20) — tiny drop, within regression threshold 0.10
    const { deps } = buildDeps({
      triggerMap: new Map([
        [baseline, triggerSet(9, 3)], // 16 → 0.8
        [c1, triggerSet(9, 4)], // 15 → 0.75
        [c2, triggerSet(9, 4)],
        [c3, triggerSet(9, 4)],
        [c4, triggerSet(9, 4)],
        [c5, triggerSet(9, 4)],
      ]),
      rewrites: [c1, c2, c3, c4, c5],
    });

    const result = await optimizeDescription(
      { baselineDescription: baseline, skillBody: "body" },
      deps,
      { maxIterations: 5 },
    );

    expect(result.final).toBe(baseline);
    expect(result.bestAccuracy).toBeCloseTo(0.8, 10);
    expect(result.history).toHaveLength(6); // baseline + 5 candidates
    // All candidate iterations rejected
    const candidateEntries = result.history.slice(1);
    for (const entry of candidateEntries) {
      expect(entry.accepted).toBe(false);
      expect(entry.reason).toBe("no-improvement");
    }
  });

  it("rejects immediately if signal already aborted", async () => {
    const baseline = "baseline";
    const controller = new AbortController();
    controller.abort();

    const { deps } = buildDeps({
      triggerMap: new Map([[baseline, triggerSet(5, 5)]]),
      rewrites: [],
    });

    await expect(
      optimizeDescription(
        { baselineDescription: baseline, skillBody: "body" },
        deps,
        { signal: controller.signal },
      ),
    ).rejects.toThrow(/abort/i);
  });

  it("only keeps triggerEvals on the last history entry (token-saving)", async () => {
    const baseline = "baseline";
    const { deps } = buildDeps({
      triggerMap: new Map([
        [baseline, triggerSet(5, 5)],
        ["c1", triggerSet(10, 0)], // accepted
      ]),
      rewrites: ["c1"],
    });

    const result = await optimizeDescription(
      { baselineDescription: baseline, skillBody: "body" },
      deps,
      { maxIterations: 1 },
    );

    expect(result.history).toHaveLength(2);
    expect(result.history[0]?.triggerEvals).toBeUndefined();
    expect(result.history[1]?.triggerEvals).toBeDefined();
    expect(result.history[1]?.triggerEvals?.length).toBe(20);
  });
});

describe("createProductionOptimizerDeps", () => {
  it("returns an object with all three method properties", () => {
    const deps = createProductionOptimizerDeps();
    expect(typeof deps.generateTriggerEvals).toBe("function");
    expect(typeof deps.checkTrigger).toBe("function");
    expect(typeof deps.rewriteDescription).toBe("function");
  });

  it("accepts a custom model override", () => {
    const deps = createProductionOptimizerDeps({ model: "claude-haiku-4-5-20251001" });
    expect(deps).toBeDefined();
    expect(typeof deps.checkTrigger).toBe("function");
  });

  it("generateTriggerEvals parses grader JSON payload into TriggerEval[]", async () => {
    gradeMock.mockResolvedValueOnce({
      text: "",
      passed: true,
      evidence: JSON.stringify({
        shouldTrigger: ["go!", "please do it"],
        shouldNotTrigger: ["ignore", 42],
      }),
      reasoning: "",
    });
    const deps = createProductionOptimizerDeps();
    const out = await deps.generateTriggerEvals({ skillBody: "body", count: 2 });
    // 2 positives + 1 negative (42 dropped because not a string)
    expect(out).toHaveLength(3);
    expect(out.filter((e) => e.shouldTrigger)).toHaveLength(2);
    expect(out.filter((e) => !e.shouldTrigger)).toHaveLength(1);
  });

  it("generateTriggerEvals returns [] when grader output is non-JSON or malformed", async () => {
    gradeMock.mockResolvedValueOnce({
      text: "",
      passed: false,
      evidence: "not-json",
      reasoning: "",
    });
    const deps = createProductionOptimizerDeps();
    const out = await deps.generateTriggerEvals({ skillBody: "body", count: 2 });
    expect(out).toEqual([]);
  });

  it("generateTriggerEvals returns [] when fields are wrong shape", async () => {
    gradeMock.mockResolvedValueOnce({
      text: "",
      passed: false,
      evidence: JSON.stringify({ shouldTrigger: "not-array", shouldNotTrigger: [] }),
      reasoning: "",
    });
    const deps = createProductionOptimizerDeps();
    const out = await deps.generateTriggerEvals({ skillBody: "body", count: 2 });
    expect(out).toEqual([]);
  });

  it("checkTrigger forwards the grader verdict as a boolean", async () => {
    gradeMock.mockResolvedValueOnce({
      text: "",
      passed: true,
      evidence: "",
      reasoning: "",
    });
    const deps = createProductionOptimizerDeps();
    const got = await deps.checkTrigger({ description: "d", prompt: "p" });
    expect(got).toBe(true);
  });

  it("rewriteDescription returns grader text, falling back to current description if empty", async () => {
    gradeMock.mockResolvedValueOnce({
      text: "",
      passed: true,
      evidence: "  new and improved  ",
      reasoning: "",
    });
    const deps = createProductionOptimizerDeps();
    const out = await deps.rewriteDescription({
      currentDescription: "old",
      failures: [
        { prompt: "p1", shouldTrigger: true, didTrigger: false, passed: false },
        { prompt: "p2", shouldTrigger: false, didTrigger: true, passed: false },
      ],
    });
    expect(out).toBe("new and improved");

    gradeMock.mockResolvedValueOnce({
      text: "",
      passed: false,
      evidence: "",
      reasoning: "",
    });
    const out2 = await deps.rewriteDescription({
      currentDescription: "keep-me",
      failures: [],
    });
    expect(out2).toBe("keep-me");
  });
});

// Silence unused-import vi reference in case someone refactors later.
void vi;
