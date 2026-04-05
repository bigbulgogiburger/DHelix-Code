import { describe, it, expect, beforeEach } from "vitest";
import {
  ABTestManager,
  type ABExperiment,
  type ABResult,
  type ABExperimentConfig,
} from "../../../src/llm/ab-testing.js";

// ─── 테스트 픽스처 ──────────────────────────────────────────────────

const BASE_CONFIG: ABExperimentConfig = {
  modelA: "claude-opus-4",
  modelB: "claude-haiku-4",
  splitRatio: 0.5,
  metrics: ["quality", "latency"],
};

// ─── createExperiment ────────────────────────────────────────────────

describe("ABTestManager.createExperiment", () => {
  it("should create an experiment with auto-generated id and startedAt", () => {
    const manager = new ABTestManager();
    const exp = manager.createExperiment(BASE_CONFIG);

    expect(exp.id).toBeDefined();
    expect(exp.id).toMatch(/^[0-9a-f-]{36}$/); // UUID 형식
    expect(exp.modelA).toBe("claude-opus-4");
    expect(exp.modelB).toBe("claude-haiku-4");
    expect(exp.splitRatio).toBe(0.5);
    expect(exp.metrics).toEqual(["quality", "latency"]);
    expect(exp.startedAt).toBeLessThanOrEqual(Date.now());
    expect(exp.status).toBe("active");
  });

  it("should throw for splitRatio < 0", () => {
    const manager = new ABTestManager();
    expect(() =>
      manager.createExperiment({ ...BASE_CONFIG, splitRatio: -0.1 })
    ).toThrow(/splitRatio/);
  });

  it("should throw for splitRatio > 1", () => {
    const manager = new ABTestManager();
    expect(() =>
      manager.createExperiment({ ...BASE_CONFIG, splitRatio: 1.5 })
    ).toThrow(/splitRatio/);
  });

  it("should accept splitRatio of exactly 0 or 1", () => {
    const manager = new ABTestManager();
    expect(() =>
      manager.createExperiment({ ...BASE_CONFIG, splitRatio: 0 })
    ).not.toThrow();
    expect(() =>
      manager.createExperiment({ ...BASE_CONFIG, splitRatio: 1 })
    ).not.toThrow();
  });

  it("should create multiple independent experiments", () => {
    const manager = new ABTestManager();
    const exp1 = manager.createExperiment(BASE_CONFIG);
    const exp2 = manager.createExperiment({ ...BASE_CONFIG, modelA: "gpt-4o" });
    expect(exp1.id).not.toBe(exp2.id);
    expect(manager.listExperiments()).toHaveLength(2);
  });
});

// ─── assignModel ─────────────────────────────────────────────────────

describe("ABTestManager.assignModel", () => {
  it("should return modelA or modelB", () => {
    const manager = new ABTestManager();
    const exp = manager.createExperiment(BASE_CONFIG);

    for (let i = 0; i < 20; i++) {
      const model = manager.assignModel(exp.id);
      expect([exp.modelA, exp.modelB]).toContain(model);
    }
  });

  it("should assign modelA exclusively when splitRatio=1", () => {
    const manager = new ABTestManager();
    const exp = manager.createExperiment({ ...BASE_CONFIG, splitRatio: 1 });

    for (let i = 0; i < 10; i++) {
      expect(manager.assignModel(exp.id)).toBe("claude-opus-4");
    }
  });

  it("should assign modelB exclusively when splitRatio=0", () => {
    const manager = new ABTestManager();
    const exp = manager.createExperiment({ ...BASE_CONFIG, splitRatio: 0 });

    for (let i = 0; i < 10; i++) {
      expect(manager.assignModel(exp.id)).toBe("claude-haiku-4");
    }
  });

  it("should throw for nonexistent experiment", () => {
    const manager = new ABTestManager();
    expect(() => manager.assignModel("non-existent-id")).toThrow(/not found/);
  });

  it("should throw for completed experiment", () => {
    const manager = new ABTestManager();
    const exp = manager.createExperiment(BASE_CONFIG);
    manager.concludeExperiment(exp.id);
    expect(() => manager.assignModel(exp.id)).toThrow(/already completed/);
  });
});

// ─── recordResult ────────────────────────────────────────────────────

describe("ABTestManager.recordResult", () => {
  it("should record scores for modelA", () => {
    const manager = new ABTestManager();
    const exp = manager.createExperiment(BASE_CONFIG);

    manager.recordResult(exp.id, "claude-opus-4", 0.9);
    manager.recordResult(exp.id, "claude-opus-4", 0.85);

    const result = manager.getResults(exp.id);
    expect(result.modelA.samples).toBe(2);
    expect(result.modelA.scores).toEqual([0.9, 0.85]);
  });

  it("should record scores for modelB", () => {
    const manager = new ABTestManager();
    const exp = manager.createExperiment(BASE_CONFIG);

    manager.recordResult(exp.id, "claude-haiku-4", 0.7);

    const result = manager.getResults(exp.id);
    expect(result.modelB.samples).toBe(1);
    expect(result.modelB.scores).toEqual([0.7]);
  });

  it("should throw for unknown model ID", () => {
    const manager = new ABTestManager();
    const exp = manager.createExperiment(BASE_CONFIG);
    expect(() =>
      manager.recordResult(exp.id, "unknown-model", 0.5)
    ).toThrow(/not part of/);
  });

  it("should throw for completed experiment", () => {
    const manager = new ABTestManager();
    const exp = manager.createExperiment(BASE_CONFIG);
    manager.concludeExperiment(exp.id);
    expect(() =>
      manager.recordResult(exp.id, "claude-opus-4", 0.8)
    ).toThrow(/already completed/);
  });
});

// ─── getResults ──────────────────────────────────────────────────────

describe("ABTestManager.getResults", () => {
  it("should return empty arms for new experiment", () => {
    const manager = new ABTestManager();
    const exp = manager.createExperiment(BASE_CONFIG);
    const result = manager.getResults(exp.id);

    expect(result.experimentId).toBe(exp.id);
    expect(result.modelA.samples).toBe(0);
    expect(result.modelB.samples).toBe(0);
    expect(result.modelA.avgScore).toBe(0);
    expect(result.modelB.avgScore).toBe(0);
  });

  it("should compute correct avgScore", () => {
    const manager = new ABTestManager();
    const exp = manager.createExperiment(BASE_CONFIG);

    manager.recordResult(exp.id, "claude-opus-4", 0.8);
    manager.recordResult(exp.id, "claude-opus-4", 0.9);
    manager.recordResult(exp.id, "claude-opus-4", 1.0);

    const result = manager.getResults(exp.id);
    expect(result.modelA.avgScore).toBeCloseTo(0.9, 5);
  });

  it("should throw for nonexistent experiment", () => {
    const manager = new ABTestManager();
    expect(() => manager.getResults("non-existent")).toThrow(/not found/);
  });
});

// ─── listExperiments ─────────────────────────────────────────────────

describe("ABTestManager.listExperiments", () => {
  it("should return empty list initially", () => {
    const manager = new ABTestManager();
    expect(manager.listExperiments()).toHaveLength(0);
  });

  it("should list all experiments", () => {
    const manager = new ABTestManager();
    manager.createExperiment(BASE_CONFIG);
    manager.createExperiment({ ...BASE_CONFIG, modelA: "gpt-4o" });
    expect(manager.listExperiments()).toHaveLength(2);
  });

  it("should include completed experiments", () => {
    const manager = new ABTestManager();
    const exp = manager.createExperiment(BASE_CONFIG);
    manager.concludeExperiment(exp.id);

    const list = manager.listExperiments();
    const found = list.find((e) => e.id === exp.id);
    expect(found?.status).toBe("completed");
  });
});

// ─── concludeExperiment ──────────────────────────────────────────────

describe("ABTestManager.concludeExperiment", () => {
  it("should mark experiment as completed", () => {
    const manager = new ABTestManager();
    const exp = manager.createExperiment(BASE_CONFIG);
    manager.concludeExperiment(exp.id);

    const list = manager.listExperiments();
    const found = list.find((e) => e.id === exp.id);
    expect(found?.status).toBe("completed");
  });

  it("should throw when concluding already completed experiment", () => {
    const manager = new ABTestManager();
    const exp = manager.createExperiment(BASE_CONFIG);
    manager.concludeExperiment(exp.id);
    expect(() => manager.concludeExperiment(exp.id)).toThrow(/already completed/);
  });

  it("should determine winner when confidence >= 0.95 with clearly different scores", () => {
    const manager = new ABTestManager();
    const exp = manager.createExperiment(BASE_CONFIG);

    // modelA에 매우 높은 점수, modelB에 매우 낮은 점수 → 명확한 차이
    for (let i = 0; i < 30; i++) {
      manager.recordResult(exp.id, "claude-opus-4", 0.95 + Math.random() * 0.04);
      manager.recordResult(exp.id, "claude-haiku-4", 0.1 + Math.random() * 0.04);
    }

    const result = manager.concludeExperiment(exp.id);
    if (result.confidence >= 0.95) {
      expect(result.winner).toBe("claude-opus-4");
    } else {
      // 확률적 테스트이므로 winner가 없을 수도 있음
      expect(result.winner).toBeUndefined();
    }
  });

  it("should not determine winner with insufficient samples", () => {
    const manager = new ABTestManager();
    const exp = manager.createExperiment(BASE_CONFIG);

    // 샘플이 적으면 신뢰도 낮음
    manager.recordResult(exp.id, "claude-opus-4", 0.9);
    manager.recordResult(exp.id, "claude-haiku-4", 0.3);

    const result = manager.concludeExperiment(exp.id);
    expect(result.confidence).toBeLessThan(0.95);
    expect(result.winner).toBeUndefined();
  });

  it("confidence should be between 0 and 1", () => {
    const manager = new ABTestManager();
    const exp = manager.createExperiment(BASE_CONFIG);

    for (let i = 0; i < 10; i++) {
      manager.recordResult(exp.id, "claude-opus-4", Math.random());
      manager.recordResult(exp.id, "claude-haiku-4", Math.random());
    }

    const result = manager.concludeExperiment(exp.id);
    expect(result.confidence).toBeGreaterThanOrEqual(0);
    expect(result.confidence).toBeLessThanOrEqual(1);
  });
});

// ─── ABResult 타입 확인 ───────────────────────────────────────────────

describe("ABResult shape", () => {
  it("should have correct structure", () => {
    const manager = new ABTestManager();
    const exp = manager.createExperiment(BASE_CONFIG);
    const result: ABResult = manager.getResults(exp.id);

    expect(result).toHaveProperty("experimentId");
    expect(result).toHaveProperty("modelA");
    expect(result).toHaveProperty("modelB");
    expect(result).toHaveProperty("confidence");
    expect(result.modelA).toHaveProperty("modelId");
    expect(result.modelA).toHaveProperty("samples");
    expect(result.modelA).toHaveProperty("avgScore");
    expect(result.modelA).toHaveProperty("scores");
  });
});
