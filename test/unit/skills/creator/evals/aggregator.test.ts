import { describe, expect, it } from "vitest";
import {
  classifyBenchmark,
  computeBenchmark,
  computeStat,
  passRateFromGrading,
  summarizeConfig,
} from "../../../../../src/skills/creator/evals/aggregator.js";
import type {
  Benchmark,
  Grading,
  RawRunResult,
} from "../../../../../src/skills/creator/evals/types.js";

const makeResult = (
  caseId: string,
  configName: string,
  passRate: number,
  durationMs: number,
): RawRunResult => {
  const totalExpectations = 4;
  const passedCount = Math.round(passRate * totalExpectations);
  const grading: Grading = {
    case_id: caseId,
    expectations: Array.from({ length: totalExpectations }, (_, i) => ({
      text: `expectation ${String(i)}`,
      passed: i < passedCount,
      evidence: "evidence",
    })),
  };
  return {
    caseId,
    configName,
    runId: `iteration-0/eval-${caseId}/${configName}`,
    output: "output",
    transcript: "[]",
    metrics: {
      tool_calls_by_type: {},
      total_steps: 0,
      files_created: [],
      errors: [],
      output_chars: 6,
      transcript_chars: 2,
    },
    timing: { executor_duration_ms: durationMs },
    grading,
  };
};

describe("passRateFromGrading", () => {
  it("returns 1 when all expectations passed", () => {
    expect(
      passRateFromGrading({
        case_id: "e1",
        expectations: [
          { text: "a", passed: true, evidence: "" },
          { text: "b", passed: true, evidence: "" },
        ],
      }),
    ).toBe(1);
  });

  it("returns 0 when all failed", () => {
    expect(
      passRateFromGrading({
        case_id: "e1",
        expectations: [{ text: "a", passed: false, evidence: "" }],
      }),
    ).toBe(0);
  });

  it("returns 0.5 when half pass", () => {
    expect(
      passRateFromGrading({
        case_id: "e1",
        expectations: [
          { text: "a", passed: true, evidence: "" },
          { text: "b", passed: false, evidence: "" },
        ],
      }),
    ).toBe(0.5);
  });

  it("returns 0 when grading is undefined", () => {
    expect(passRateFromGrading(undefined)).toBe(0);
  });

  it("returns 0 when expectations array is empty", () => {
    expect(passRateFromGrading({ case_id: "e1", expectations: [] })).toBe(0);
  });
});

describe("computeStat", () => {
  it("returns zeros for empty array", () => {
    expect(computeStat([])).toEqual({ mean: 0, stddev: 0, min: 0, max: 0 });
  });

  it("computes mean/min/max/stddev for uniform values", () => {
    const stat = computeStat([2, 2, 2, 2]);
    expect(stat.mean).toBe(2);
    expect(stat.stddev).toBe(0);
    expect(stat.min).toBe(2);
    expect(stat.max).toBe(2);
  });

  it("computes non-trivial stddev", () => {
    const stat = computeStat([1, 2, 3, 4]);
    expect(stat.mean).toBe(2.5);
    // population stddev of [1,2,3,4]
    expect(stat.stddev).toBeCloseTo(Math.sqrt(1.25), 10);
    expect(stat.min).toBe(1);
    expect(stat.max).toBe(4);
  });

  it("handles single element", () => {
    const stat = computeStat([42]);
    expect(stat.mean).toBe(42);
    expect(stat.stddev).toBe(0);
    expect(stat.min).toBe(42);
    expect(stat.max).toBe(42);
  });
});

describe("summarizeConfig", () => {
  it("summarizes a handful of runs", () => {
    const runs = [
      makeResult("e1", "with_skill", 1.0, 1000),
      makeResult("e2", "with_skill", 0.5, 1500),
      makeResult("e3", "with_skill", 0.0, 2000),
    ];
    const s = summarizeConfig(runs);
    expect(s.runs.length).toBe(3);
    expect(s.summary.pass_rate.mean).toBeCloseTo(0.5, 10);
    expect(s.summary.duration_ms.mean).toBe(1500);
  });
});

describe("computeBenchmark", () => {
  it("groups runs by config and computes delta", () => {
    const runs = [
      makeResult("e1", "with_skill", 1.0, 1000),
      makeResult("e1", "baseline", 0.5, 1200),
      makeResult("e2", "with_skill", 0.75, 1100),
      makeResult("e2", "baseline", 0.5, 1300),
    ];
    const b = computeBenchmark("demo", 0, runs);
    expect(b.skill_name).toBe("demo");
    expect(b.iteration).toBe(0);
    const withSkill = b.configs["with_skill"];
    const baseline = b.configs["baseline"];
    expect(withSkill).toBeDefined();
    expect(baseline).toBeDefined();
    expect(b.delta).toBeDefined();
    // with_skill 0.875 vs baseline 0.5 → delta +0.375
    expect(b.delta?.pass_rate).toBeCloseTo(0.375, 10);
  });

  it("omits delta when baseline config is missing", () => {
    const runs = [makeResult("e1", "with_skill", 0.5, 1000)];
    const b = computeBenchmark("demo", 0, runs);
    expect(b.delta).toBeUndefined();
  });
});

describe("classifyBenchmark", () => {
  const mkBenchmark = (withSkillMean: number, baselineMean: number): Benchmark => ({
    skill_name: "demo",
    iteration: 0,
    configs: {
      with_skill: {
        runs: [{ run_id: "r1", pass_rate: withSkillMean, duration_ms: 1000 }],
        summary: {
          pass_rate: { mean: withSkillMean, stddev: 0, min: withSkillMean, max: withSkillMean },
          duration_ms: { mean: 1000, stddev: 0, min: 1000, max: 1000 },
        },
      },
      baseline: {
        runs: [{ run_id: "r2", pass_rate: baselineMean, duration_ms: 1000 }],
        summary: {
          pass_rate: { mean: baselineMean, stddev: 0, min: baselineMean, max: baselineMean },
          duration_ms: { mean: 1000, stddev: 0, min: 1000, max: 1000 },
        },
      },
    },
  });

  it("returns baseline when baseline config is missing", () => {
    const b: Benchmark = {
      skill_name: "demo",
      iteration: 0,
      configs: {
        with_skill: {
          runs: [],
          summary: {
            pass_rate: { mean: 0.5, stddev: 0, min: 0.5, max: 0.5 },
            duration_ms: { mean: 1000, stddev: 0, min: 1000, max: 1000 },
          },
        },
      },
    };
    expect(classifyBenchmark(b)).toBe("baseline");
  });

  it("returns won when with_skill improves by ≥5%", () => {
    expect(classifyBenchmark(mkBenchmark(0.85, 0.5))).toBe("won");
    expect(classifyBenchmark(mkBenchmark(0.55, 0.5))).toBe("won");
  });

  it("returns lost when with_skill drops by ≥5%", () => {
    expect(classifyBenchmark(mkBenchmark(0.3, 0.5))).toBe("lost");
    expect(classifyBenchmark(mkBenchmark(0.4, 0.5))).toBe("lost");
  });

  it("returns tie when within ±5%", () => {
    expect(classifyBenchmark(mkBenchmark(0.52, 0.5))).toBe("tie");
    expect(classifyBenchmark(mkBenchmark(0.5, 0.5))).toBe("tie");
    expect(classifyBenchmark(mkBenchmark(0.47, 0.5))).toBe("tie");
  });
});
