import { describe, it, expect, vi } from "vitest";
import {
  SkillComposer,
  evaluateCondition,
  type SkillComposition,
  type SkillExecutor,
  type StepResult,
} from "../../../src/skills/composer.js";
import { type SkillManifest } from "../../../src/skills/manifest.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** 테스트용 기본 매니페스트 팩토리 */
function makeManifest(name: string): SkillManifest {
  return {
    name,
    description: `${name} skill`,
    userInvocable: true,
    disableModelInvocation: false,
    model: null,
    context: "inline",
    hooks: [],
  };
}

/** 성공하는 executor 팩토리 */
function successExecutor(outputs?: Record<string, unknown>): SkillExecutor {
  return async (skillName: string) => {
    return outputs?.[skillName] ?? `${skillName}-output`;
  };
}

/** 실패하는 executor 팩토리 */
function failingExecutor(failSkill: string): SkillExecutor {
  return async (skillName: string) => {
    if (skillName === failSkill) {
      throw new Error(`${skillName} failed`);
    }
    return `${skillName}-output`;
  };
}

// ---------------------------------------------------------------------------
// evaluateCondition
// ---------------------------------------------------------------------------

describe("evaluateCondition", () => {
  const successResult: StepResult = {
    skillName: "prev-skill",
    success: true,
    output: { status: "ok", count: 42 },
    durationMs: 100,
  };

  const failResult: StepResult = {
    skillName: "prev-skill",
    success: false,
    error: "something went wrong",
    durationMs: 50,
  };

  it("should return false when prev is undefined", () => {
    expect(evaluateCondition("prev.success", undefined)).toBe(false);
  });

  it("should evaluate prev.success as truthy", () => {
    expect(evaluateCondition("prev.success", successResult)).toBe(true);
    expect(evaluateCondition("prev.success", failResult)).toBe(false);
  });

  it("should evaluate nested output paths", () => {
    expect(evaluateCondition("prev.output.status", successResult)).toBe(true);
    expect(evaluateCondition("prev.output.count", successResult)).toBe(true);
    expect(evaluateCondition("prev.output.missing", successResult)).toBe(false);
  });

  it("should evaluate equality comparisons with strings", () => {
    expect(evaluateCondition("prev.output.status === 'ok'", successResult)).toBe(true);
    expect(evaluateCondition("prev.output.status === 'fail'", successResult)).toBe(false);
  });

  it("should evaluate equality comparisons with booleans", () => {
    expect(evaluateCondition("prev.success === true", successResult)).toBe(true);
    expect(evaluateCondition("prev.success === false", successResult)).toBe(false);
  });

  it("should evaluate equality comparisons with numbers", () => {
    expect(evaluateCondition("prev.output.count === 42", successResult)).toBe(true);
    expect(evaluateCondition("prev.output.count === 99", successResult)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// SkillComposer.validate
// ---------------------------------------------------------------------------

describe("SkillComposer.validate", () => {
  const knownSkills = new Map<string, SkillManifest>([
    ["lint", makeManifest("lint")],
    ["test", makeManifest("test")],
    ["build", makeManifest("build")],
  ]);

  const composer = new SkillComposer((name) => knownSkills.get(name));

  it("should pass for a valid composition", () => {
    const composition: SkillComposition = {
      name: "ci-pipeline",
      description: "Run CI",
      steps: [
        { skillName: "lint" },
        { skillName: "test" },
        { skillName: "build" },
      ],
    };

    const result = composer.validate(composition);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("should fail for empty steps", () => {
    const composition: SkillComposition = {
      name: "empty",
      description: "No steps",
      steps: [],
    };

    const result = composer.validate(composition);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("Composition must have at least one step");
  });

  it("should fail for non-existent skill reference", () => {
    const composition: SkillComposition = {
      name: "broken",
      description: "References missing skill",
      steps: [
        { skillName: "lint" },
        { skillName: "non-existent-skill" },
      ],
    };

    const result = composer.validate(composition);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("non-existent-skill"))).toBe(true);
  });

  it("should detect circular reference (composition references itself)", () => {
    const composition: SkillComposition = {
      name: "lint",
      description: "Self-referencing",
      steps: [{ skillName: "lint" }],
    };

    const result = composer.validate(composition);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("Circular reference"))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// SkillComposer.execute — sequential
// ---------------------------------------------------------------------------

describe("SkillComposer.execute — sequential", () => {
  const knownSkills = new Map<string, SkillManifest>([
    ["step-a", makeManifest("step-a")],
    ["step-b", makeManifest("step-b")],
    ["step-c", makeManifest("step-c")],
  ]);

  const composer = new SkillComposer((name) => knownSkills.get(name));

  it("should execute all steps sequentially", async () => {
    const composition: SkillComposition = {
      name: "seq-pipeline",
      description: "Sequential",
      steps: [
        { skillName: "step-a" },
        { skillName: "step-b" },
        { skillName: "step-c" },
      ],
    };

    const result = await composer.execute(composition, successExecutor());
    expect(result.success).toBe(true);
    expect(result.stepsCompleted).toBe(3);
    expect(result.stepsTotal).toBe(3);
    expect(result.results).toHaveLength(3);
    expect(result.results.every((r) => r.success)).toBe(true);
  });

  it("should stop on first failure with failFast=true", async () => {
    const composition: SkillComposition = {
      name: "fail-fast",
      description: "Fails early",
      steps: [
        { skillName: "step-a" },
        { skillName: "step-b" },
        { skillName: "step-c" },
      ],
      failFast: true,
    };

    const result = await composer.execute(
      composition,
      failingExecutor("step-b"),
    );

    expect(result.success).toBe(false);
    expect(result.stepsCompleted).toBe(2); // step-a succeeded, step-b failed
    expect(result.results[0].success).toBe(true);
    expect(result.results[1].success).toBe(false);
    expect(result.results[1].error).toContain("step-b failed");
  });

  it("should continue after failure with failFast=false", async () => {
    const composition: SkillComposition = {
      name: "no-fail-fast",
      description: "Continues on failure",
      steps: [
        { skillName: "step-a" },
        { skillName: "step-b" },
        { skillName: "step-c" },
      ],
      failFast: false,
      aggregation: "all-must-pass",
    };

    const result = await composer.execute(
      composition,
      failingExecutor("step-b"),
    );

    expect(result.success).toBe(false);
    expect(result.stepsCompleted).toBe(3);
    expect(result.results[0].success).toBe(true);
    expect(result.results[1].success).toBe(false);
    expect(result.results[2].success).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// SkillComposer.execute — parallel
// ---------------------------------------------------------------------------

describe("SkillComposer.execute — parallel", () => {
  const knownSkills = new Map<string, SkillManifest>([
    ["lint", makeManifest("lint")],
    ["typecheck", makeManifest("typecheck")],
    ["test", makeManifest("test")],
    ["build", makeManifest("build")],
  ]);

  const composer = new SkillComposer((name) => knownSkills.get(name));

  it("should execute parallel steps concurrently", async () => {
    const executionOrder: string[] = [];

    const executor: SkillExecutor = async (skillName) => {
      executionOrder.push(skillName);
      return `${skillName}-done`;
    };

    const composition: SkillComposition = {
      name: "parallel-ci",
      description: "Parallel lint and typecheck, then build",
      steps: [
        { skillName: "lint", parallel: true },
        { skillName: "typecheck", parallel: true },
        { skillName: "build" }, // sequential after parallel group
      ],
    };

    const result = await composer.execute(composition, executor);

    expect(result.success).toBe(true);
    expect(result.stepsCompleted).toBe(3);
    // lint and typecheck should both be called (order may vary), then build
    expect(executionOrder).toContain("lint");
    expect(executionOrder).toContain("typecheck");
    expect(executionOrder[executionOrder.length - 1]).toBe("build");
  });
});

// ---------------------------------------------------------------------------
// SkillComposer.execute — condition
// ---------------------------------------------------------------------------

describe("SkillComposer.execute — condition", () => {
  const knownSkills = new Map<string, SkillManifest>([
    ["check", makeManifest("check")],
    ["deploy", makeManifest("deploy")],
  ]);

  const composer = new SkillComposer((name) => knownSkills.get(name));

  it("should skip step when condition is not met", async () => {
    const executor: SkillExecutor = async () => {
      throw new Error("should not be called for deploy");
    };

    // check will fail, so deploy condition (prev.success) is false
    const failExecutor: SkillExecutor = async (skillName) => {
      if (skillName === "check") throw new Error("check failed");
      throw new Error("deploy should be skipped");
    };

    const composition: SkillComposition = {
      name: "conditional",
      description: "Deploy only if check passes",
      steps: [
        { skillName: "check" },
        { skillName: "deploy", condition: "prev.success" },
      ],
      failFast: false,
    };

    const result = await composer.execute(composition, failExecutor);

    expect(result.stepsCompleted).toBe(2);
    expect(result.results[0].success).toBe(false); // check failed
    expect(result.results[1].success).toBe(true); // deploy skipped (treated as success)
  });

  it("should execute step when condition is met", async () => {
    const composition: SkillComposition = {
      name: "conditional-pass",
      description: "Deploy when check passes",
      steps: [
        { skillName: "check" },
        { skillName: "deploy", condition: "prev.success" },
      ],
    };

    const result = await composer.execute(composition, successExecutor());

    expect(result.success).toBe(true);
    expect(result.results).toHaveLength(2);
    expect(result.results.every((r) => r.success)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// SkillComposer.execute — timeout
// ---------------------------------------------------------------------------

describe("SkillComposer.execute — timeout", () => {
  const knownSkills = new Map<string, SkillManifest>([
    ["slow", makeManifest("slow")],
  ]);

  const composer = new SkillComposer((name) => knownSkills.get(name));

  it("should timeout a slow step", async () => {
    const slowExecutor: SkillExecutor = async () => {
      return new Promise((resolve) => setTimeout(resolve, 5000));
    };

    const composition: SkillComposition = {
      name: "timeout-test",
      description: "Step with timeout",
      steps: [{ skillName: "slow", timeoutMs: 50 }],
    };

    const result = await composer.execute(composition, slowExecutor);

    expect(result.success).toBe(false);
    expect(result.results[0].success).toBe(false);
    expect(result.results[0].error).toContain("timed out");
  });
});

// ---------------------------------------------------------------------------
// SkillComposer.execute — aggregation strategies
// ---------------------------------------------------------------------------

describe("SkillComposer.execute — aggregation", () => {
  const knownSkills = new Map<string, SkillManifest>([
    ["a", makeManifest("a")],
    ["b", makeManifest("b")],
    ["c", makeManifest("c")],
  ]);

  const composer = new SkillComposer((name) => knownSkills.get(name));

  const threeSteps: SkillComposition["steps"] = [
    { skillName: "a" },
    { skillName: "b" },
    { skillName: "c" },
  ];

  it("merge-outputs: merges all outputs by skill name", async () => {
    const executor = successExecutor({
      a: { x: 1 },
      b: { y: 2 },
      c: { z: 3 },
    });

    const composition: SkillComposition = {
      name: "merge",
      description: "Merge test",
      steps: threeSteps,
      aggregation: "merge-outputs",
    };

    const result = await composer.execute(composition, executor);
    expect(result.success).toBe(true);
    expect(result.aggregatedOutput).toEqual({
      a: { x: 1 },
      b: { y: 2 },
      c: { z: 3 },
    });
  });

  it("first-success: returns first successful output", async () => {
    const composition: SkillComposition = {
      name: "first",
      description: "First success test",
      steps: threeSteps,
      failFast: false,
      aggregation: "first-success",
    };

    const executor: SkillExecutor = async (skillName) => {
      if (skillName === "a") throw new Error("a failed");
      return `${skillName}-result`;
    };

    const result = await composer.execute(composition, executor);
    expect(result.success).toBe(true);
    expect(result.aggregatedOutput).toBe("b-result");
  });

  it("first-success: returns failure when none succeed", async () => {
    const composition: SkillComposition = {
      name: "all-fail",
      description: "All fail",
      steps: [{ skillName: "a" }],
      failFast: false,
      aggregation: "first-success",
    };

    const executor: SkillExecutor = async () => {
      throw new Error("failed");
    };

    const result = await composer.execute(composition, executor);
    expect(result.success).toBe(false);
    expect(result.aggregatedOutput).toBeUndefined();
  });

  it("all-must-pass: succeeds only when all pass", async () => {
    const composition: SkillComposition = {
      name: "all-pass",
      description: "All must pass",
      steps: threeSteps,
      aggregation: "all-must-pass",
    };

    const result = await composer.execute(composition, successExecutor());
    expect(result.success).toBe(true);
  });

  it("all-must-pass: fails when any step fails", async () => {
    const composition: SkillComposition = {
      name: "one-fails",
      description: "One fails",
      steps: threeSteps,
      failFast: false,
      aggregation: "all-must-pass",
    };

    const result = await composer.execute(
      composition,
      failingExecutor("b"),
    );
    expect(result.success).toBe(false);
    expect(result.stepsCompleted).toBe(3);
  });

  it("all-must-pass: fails when not all steps completed (failFast)", async () => {
    const composition: SkillComposition = {
      name: "early-stop",
      description: "Stops early",
      steps: threeSteps,
      failFast: true,
      aggregation: "all-must-pass",
    };

    const result = await composer.execute(
      composition,
      failingExecutor("b"),
    );
    expect(result.success).toBe(false);
    expect(result.stepsCompleted).toBe(2); // stopped after b
    expect(result.stepsTotal).toBe(3);
  });
});

// ---------------------------------------------------------------------------
// SkillComposer.execute — durationMs tracking
// ---------------------------------------------------------------------------

describe("SkillComposer.execute — durationMs", () => {
  const knownSkills = new Map<string, SkillManifest>([
    ["fast", makeManifest("fast")],
  ]);

  const composer = new SkillComposer((name) => knownSkills.get(name));

  it("should track execution duration for each step", async () => {
    const composition: SkillComposition = {
      name: "timing",
      description: "Track timing",
      steps: [{ skillName: "fast" }],
    };

    const result = await composer.execute(composition, successExecutor());
    expect(result.results[0].durationMs).toBeGreaterThanOrEqual(0);
  });
});
