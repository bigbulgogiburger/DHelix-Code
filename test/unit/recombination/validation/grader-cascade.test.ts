/**
 * Unit tests for src/recombination/validation/grader-cascade.ts.
 *
 * Since Team 1's `parseExpectations` is still a stub at this commit, these
 * tests vi.mock the expectation-dsl module and inject discriminated
 * `Expectation` objects directly. This isolates cascade routing from DSL
 * parsing.
 *
 * Covers:
 *   - every deterministic expectation kind (pass + fail)
 *   - semi kinds routed only when `gradingTiers` includes "semi"
 *   - free-text routed only when `gradingTiers` includes "llm"
 *   - missing tier produces `handler: "skipped"`
 *   - case.passed requires at least one non-skipped expectation
 *   - LLM judge error → `handler: "llm", passed: false, evidence: "LLM judge error: ..."`
 *   - missing run → case passed=false (empty expectationResults)
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

import type {
  Expectation,
  LLMCompletionFn,
  PipelineStrategies,
  RuntimeCase,
  RuntimeRunResult,
} from "../../../../src/recombination/types.js";

// Mock the expectation-dsl module so we can feed Expectation shapes directly.
const expectationQueue: Expectation[][] = [];
vi.mock("../../../../src/recombination/validation/expectation-dsl.js", () => ({
  parseExpectations: (_raws: readonly string[]): readonly Expectation[] => {
    const next = expectationQueue.shift();
    if (!next) throw new Error("expectationQueue empty — test setup bug");
    return next;
  },
  parseExpectation: (_raw: string): Expectation => {
    throw new Error("not used");
  },
}));

// Import AFTER mock is registered.
import { gradeCases } from "../../../../src/recombination/validation/grader-cascade.js";

function enqueue(exps: readonly Expectation[]): void {
  expectationQueue.push([...exps]);
}

function mkCase(id: string, raws: readonly string[]): RuntimeCase {
  return {
    id,
    plasmidId: "p-1",
    tier: "L1",
    origin: "eval-seed",
    prompt: "p",
    expectations: raws,
  };
}

function mkRun(overrides: Partial<RuntimeRunResult> & { readonly caseId: string }): RuntimeRunResult {
  return {
    plasmidId: "p-1",
    tier: "L1",
    output: "",
    toolCalls: [],
    hookFires: [],
    filesTouched: [],
    durationMs: 10,
    status: "ok",
    ...overrides,
  };
}

function strategies(tiers: PipelineStrategies["gradingTiers"]): PipelineStrategies {
  return {
    interpreter: "single-pass",
    compression: "abstractive",
    reorgFallback: "deterministic-only",
    validationVolume: "minimal",
    validationParallelism: 1,
    gradingTiers: tiers,
    passThresholds: { L1: 1, L2: 1, L3: 1, L4: 1 },
    projectProfile: "static-template",
    artifactGeneration: "template-only",
    interpreterRetries: 1,
  };
}

const noLlm: LLMCompletionFn = async () => {
  throw new Error("llm should not be called");
};

beforeEach(() => {
  expectationQueue.length = 0;
});

describe("gradeCases — deterministic kinds", () => {
  it("output-contains passes when substring present", async () => {
    enqueue([{ kind: "output-contains", text: "hello", original: "" }]);
    const res = await gradeCases({
      cases: [mkCase("c1", ["_"])],
      runs: [mkRun({ caseId: "c1", output: "hello world" })],
      strategies: strategies(["deterministic"]),
      llm: noLlm,
    });
    expect(res[0]?.passed).toBe(true);
    expect(res[0]?.expectationResults[0]?.handler).toBe("deterministic");
  });

  it("output-contains fails when substring absent", async () => {
    enqueue([{ kind: "output-contains", text: "missing", original: "" }]);
    const res = await gradeCases({
      cases: [mkCase("c1", ["_"])],
      runs: [mkRun({ caseId: "c1", output: "hello" })],
      strategies: strategies(["deterministic"]),
      llm: noLlm,
    });
    expect(res[0]?.passed).toBe(false);
  });

  it("output-excludes fails when substring present", async () => {
    enqueue([{ kind: "output-excludes", text: "secret", original: "" }]);
    const res = await gradeCases({
      cases: [mkCase("c1", ["_"])],
      runs: [mkRun({ caseId: "c1", output: "leaked secret here" })],
      strategies: strategies(["deterministic"]),
      llm: noLlm,
    });
    expect(res[0]?.passed).toBe(false);
  });

  it("file-exists matches create/update ops", async () => {
    enqueue([{ kind: "file-exists", path: "a.txt", original: "" }]);
    const res = await gradeCases({
      cases: [mkCase("c1", ["_"])],
      runs: [
        mkRun({
          caseId: "c1",
          filesTouched: [{ path: "a.txt", op: "create" }],
        }),
      ],
      strategies: strategies(["deterministic"]),
      llm: noLlm,
    });
    expect(res[0]?.passed).toBe(true);
  });

  it("file-exists fails when only delete op present", async () => {
    enqueue([{ kind: "file-exists", path: "a.txt", original: "" }]);
    const res = await gradeCases({
      cases: [mkCase("c1", ["_"])],
      runs: [
        mkRun({
          caseId: "c1",
          filesTouched: [{ path: "a.txt", op: "delete" }],
        }),
      ],
      strategies: strategies(["deterministic"]),
      llm: noLlm,
    });
    expect(res[0]?.passed).toBe(false);
  });

  it("file-modified requires update op (not create)", async () => {
    enqueue([{ kind: "file-modified", path: "a.txt", original: "" }]);
    const res1 = await gradeCases({
      cases: [mkCase("c1", ["_"])],
      runs: [mkRun({ caseId: "c1", filesTouched: [{ path: "a.txt", op: "update" }] })],
      strategies: strategies(["deterministic"]),
      llm: noLlm,
    });
    expect(res1[0]?.passed).toBe(true);

    enqueue([{ kind: "file-modified", path: "a.txt", original: "" }]);
    const res2 = await gradeCases({
      cases: [mkCase("c1", ["_"])],
      runs: [mkRun({ caseId: "c1", filesTouched: [{ path: "a.txt", op: "create" }] })],
      strategies: strategies(["deterministic"]),
      llm: noLlm,
    });
    expect(res2[0]?.passed).toBe(false);
  });

  it("exit-code matches run.exitCode", async () => {
    enqueue([{ kind: "exit-code", code: 0, original: "" }]);
    const res = await gradeCases({
      cases: [mkCase("c1", ["_"])],
      runs: [mkRun({ caseId: "c1", exitCode: 0 })],
      strategies: strategies(["deterministic"]),
      llm: noLlm,
    });
    expect(res[0]?.passed).toBe(true);
  });

  it("exit-code fails on mismatch", async () => {
    enqueue([{ kind: "exit-code", code: 0, original: "" }]);
    const res = await gradeCases({
      cases: [mkCase("c1", ["_"])],
      runs: [mkRun({ caseId: "c1", exitCode: 1 })],
      strategies: strategies(["deterministic"]),
      llm: noLlm,
    });
    expect(res[0]?.passed).toBe(false);
  });
});

describe("gradeCases — semi tier gating", () => {
  it("tool-called routed to semi when enabled", async () => {
    enqueue([{ kind: "tool-called", tool: "edit", original: "" }]);
    const res = await gradeCases({
      cases: [mkCase("c1", ["_"])],
      runs: [mkRun({ caseId: "c1", toolCalls: ["edit", "read"] })],
      strategies: strategies(["deterministic", "semi"]),
      llm: noLlm,
    });
    expect(res[0]?.expectationResults[0]?.handler).toBe("semi");
    expect(res[0]?.passed).toBe(true);
  });

  it("hook-fired fails when hook missing", async () => {
    enqueue([{ kind: "hook-fired", event: "PostEdit", original: "" }]);
    const res = await gradeCases({
      cases: [mkCase("c1", ["_"])],
      runs: [mkRun({ caseId: "c1", hookFires: ["PreTest"] })],
      strategies: strategies(["deterministic", "semi"]),
      llm: noLlm,
    });
    expect(res[0]?.expectationResults[0]?.handler).toBe("semi");
    expect(res[0]?.passed).toBe(false);
  });

  it("tool-called skipped when semi tier absent", async () => {
    enqueue([{ kind: "tool-called", tool: "edit", original: "tool:edit" }]);
    const res = await gradeCases({
      cases: [mkCase("c1", ["_"])],
      runs: [mkRun({ caseId: "c1", toolCalls: ["edit"] })],
      strategies: strategies(["deterministic"]),
      llm: noLlm,
    });
    expect(res[0]?.expectationResults[0]?.handler).toBe("skipped");
    // All non-skipped pass but there are no non-skipped → case fails.
    expect(res[0]?.passed).toBe(false);
  });
});

describe("gradeCases — llm tier gating", () => {
  it("free-text skipped when llm tier absent (no LLM call)", async () => {
    enqueue([{ kind: "free-text", text: "is helpful", original: "" }]);
    const res = await gradeCases({
      cases: [mkCase("c1", ["_"])],
      runs: [mkRun({ caseId: "c1", output: "x" })],
      strategies: strategies(["deterministic"]),
      llm: noLlm,
    });
    expect(res[0]?.expectationResults[0]?.handler).toBe("skipped");
  });

  it("free-text dispatched to LLM when enabled; JSON verdict parsed", async () => {
    enqueue([{ kind: "free-text", text: "is concise", original: "" }]);
    const llm: LLMCompletionFn = async () =>
      '{"passed":true,"evidence":"short","reasoning":"ok","confidence":0.9}';
    const res = await gradeCases({
      cases: [mkCase("c1", ["_"])],
      runs: [mkRun({ caseId: "c1", output: "short answer" })],
      strategies: strategies(["deterministic", "llm"]),
      llm,
    });
    const r = res[0]?.expectationResults[0];
    expect(r?.handler).toBe("llm");
    expect(r?.passed).toBe(true);
    expect(r?.llmConfidence).toBe(0.9);
  });

  it("free-text — LLM throw degrades to passed=false with evidence", async () => {
    enqueue([{ kind: "free-text", text: "is concise", original: "" }]);
    const llm: LLMCompletionFn = async () => {
      throw new Error("network down");
    };
    const res = await gradeCases({
      cases: [mkCase("c1", ["_"])],
      runs: [mkRun({ caseId: "c1", output: "x" })],
      strategies: strategies(["deterministic", "llm"]),
      llm,
    });
    const r = res[0]?.expectationResults[0];
    expect(r?.handler).toBe("llm");
    expect(r?.passed).toBe(false);
    expect(r?.evidence).toMatch(/LLM judge error: network down/);
  });

  it("free-text — non-JSON response degrades gracefully", async () => {
    enqueue([{ kind: "free-text", text: "z", original: "" }]);
    const llm: LLMCompletionFn = async () => "I cannot comply.";
    const res = await gradeCases({
      cases: [mkCase("c1", ["_"])],
      runs: [mkRun({ caseId: "c1", output: "x" })],
      strategies: strategies(["deterministic", "llm"]),
      llm,
    });
    expect(res[0]?.expectationResults[0]?.passed).toBe(false);
  });
});

describe("gradeCases — case-level pass semantics", () => {
  it("case passes only when every non-skipped passes AND at least one exists", async () => {
    enqueue([
      { kind: "output-contains", text: "ok", original: "" },
      { kind: "tool-called", tool: "edit", original: "" }, // will be skipped
    ]);
    const res = await gradeCases({
      cases: [mkCase("c1", ["_", "_"])],
      runs: [mkRun({ caseId: "c1", output: "ok" })],
      strategies: strategies(["deterministic"]), // no semi
      llm: noLlm,
    });
    // One deterministic pass, one skipped → passed overall.
    expect(res[0]?.passed).toBe(true);
  });

  it("all-skipped case fails even if zero non-skipped failures", async () => {
    enqueue([{ kind: "tool-called", tool: "edit", original: "" }]);
    const res = await gradeCases({
      cases: [mkCase("c1", ["_"])],
      runs: [mkRun({ caseId: "c1" })],
      strategies: strategies(["deterministic"]),
      llm: noLlm,
    });
    expect(res[0]?.passed).toBe(false);
    expect(res[0]?.expectationResults[0]?.handler).toBe("skipped");
  });

  it("missing run → case passed=false with empty expectationResults", async () => {
    // No enqueue needed since parseExpectations won't be called.
    const res = await gradeCases({
      cases: [mkCase("c1", ["_"])],
      runs: [],
      strategies: strategies(["deterministic"]),
      llm: noLlm,
    });
    expect(res[0]?.passed).toBe(false);
    expect(res[0]?.expectationResults).toEqual([]);
  });

  it("run status timeout/skipped → case passed=false, no grading attempted", async () => {
    const res = await gradeCases({
      cases: [mkCase("c1", ["_"])],
      runs: [mkRun({ caseId: "c1", status: "timeout" })],
      strategies: strategies(["deterministic"]),
      llm: noLlm,
    });
    expect(res[0]?.passed).toBe(false);
    expect(res[0]?.expectationResults).toEqual([]);
  });
});
