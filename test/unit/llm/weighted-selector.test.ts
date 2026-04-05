import { describe, it, expect, beforeEach } from "vitest";
import {
  WeightedModelSelector,
  type ModelWeight,
  type ModelMetrics,
  type ModelScore,
} from "../../../src/llm/weighted-selector.js";

// ─── 테스트 픽스처 ──────────────────────────────────────────────────

const WEIGHTS: ModelWeight[] = [
  { modelId: "model-cheap", costWeight: 0.8, qualityWeight: 0.1, latencyWeight: 0.1 },
  { modelId: "model-quality", costWeight: 0.1, qualityWeight: 0.8, latencyWeight: 0.1 },
  { modelId: "model-fast", costWeight: 0.1, qualityWeight: 0.1, latencyWeight: 0.8 },
];

const METRICS: ModelMetrics[] = [
  { costPer1kTokens: 0.0005, qualityRating: 0.6, avgLatencyMs: 300 },  // cheap
  { costPer1kTokens: 0.015, qualityRating: 0.95, avgLatencyMs: 1200 },  // quality
  { costPer1kTokens: 0.002, qualityRating: 0.75, avgLatencyMs: 100 },   // fast
];

// ─── constructor & listWeights ───────────────────────────────────────

describe("WeightedModelSelector — constructor", () => {
  it("should initialize with provided weights", () => {
    const selector = new WeightedModelSelector(WEIGHTS);
    expect(selector.listWeights()).toHaveLength(3);
  });

  it("should accept empty model list", () => {
    const selector = new WeightedModelSelector([]);
    expect(selector.listWeights()).toHaveLength(0);
  });
});

// ─── getWeight ───────────────────────────────────────────────────────

describe("WeightedModelSelector.getWeight", () => {
  it("should return weight for registered model", () => {
    const selector = new WeightedModelSelector(WEIGHTS);
    const w = selector.getWeight("model-cheap");
    expect(w).toBeDefined();
    expect(w?.costWeight).toBe(0.8);
  });

  it("should return undefined for unregistered model", () => {
    const selector = new WeightedModelSelector(WEIGHTS);
    expect(selector.getWeight("unknown-model")).toBeUndefined();
  });
});

// ─── score ───────────────────────────────────────────────────────────

describe("WeightedModelSelector.score", () => {
  let selector: WeightedModelSelector;

  beforeEach(() => {
    selector = new WeightedModelSelector(WEIGHTS);
  });

  it("should return a ModelScore with breakdown", () => {
    const result = selector.score("model-cheap", METRICS[0]!);
    expect(result.modelId).toBe("model-cheap");
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(1);
    expect(result).toHaveProperty("breakdown");
    expect(result.breakdown).toHaveProperty("cost");
    expect(result.breakdown).toHaveProperty("quality");
    expect(result.breakdown).toHaveProperty("latency");
  });

  it("should throw for unregistered model", () => {
    expect(() =>
      selector.score("ghost-model", METRICS[0]!)
    ).toThrow(/not registered/);
  });

  it("should return score 0 when all weights are 0", () => {
    const zeroSel = new WeightedModelSelector([
      { modelId: "zero", costWeight: 0, qualityWeight: 0, latencyWeight: 0 },
    ]);
    const result = zeroSel.score("zero", METRICS[0]!);
    expect(result.score).toBe(0);
  });

  it("breakdown values should reflect weight contributions", () => {
    // quality-heavy weight → qualityScore should be dominant
    const result = selector.score("model-quality", METRICS[1]!);
    expect(result.breakdown.quality).toBeGreaterThan(result.breakdown.cost);
    expect(result.breakdown.quality).toBeGreaterThan(result.breakdown.latency);
  });
});

// ─── selectBest ──────────────────────────────────────────────────────

describe("WeightedModelSelector.selectBest", () => {
  let selector: WeightedModelSelector;

  beforeEach(() => {
    selector = new WeightedModelSelector(WEIGHTS);
  });

  it("should return the best model based on weights", () => {
    const candidates = ["model-cheap", "model-quality", "model-fast"];
    const best = selector.selectBest(candidates, METRICS);
    expect(best).toHaveProperty("modelId");
    expect(candidates).toContain(best.modelId);
  });

  it("should prefer cheap model when cost weight is highest", () => {
    // Only register cost-heavy selector
    const costSel = new WeightedModelSelector([
      { modelId: "model-cheap", costWeight: 0.9, qualityWeight: 0.05, latencyWeight: 0.05 },
      { modelId: "model-quality", costWeight: 0.9, qualityWeight: 0.05, latencyWeight: 0.05 },
    ]);
    const metrics: ModelMetrics[] = [
      { costPer1kTokens: 0.0001, qualityRating: 0.5, avgLatencyMs: 500 },
      { costPer1kTokens: 0.1, qualityRating: 0.99, avgLatencyMs: 500 },
    ];
    const best = costSel.selectBest(["model-cheap", "model-quality"], metrics);
    expect(best.modelId).toBe("model-cheap");
  });

  it("should prefer quality model when quality weight is highest", () => {
    const qualitySel = new WeightedModelSelector([
      { modelId: "model-a", costWeight: 0.05, qualityWeight: 0.9, latencyWeight: 0.05 },
      { modelId: "model-b", costWeight: 0.05, qualityWeight: 0.9, latencyWeight: 0.05 },
    ]);
    const metrics: ModelMetrics[] = [
      { costPer1kTokens: 0.01, qualityRating: 0.5, avgLatencyMs: 500 },
      { costPer1kTokens: 0.01, qualityRating: 0.99, avgLatencyMs: 500 },
    ];
    const best = qualitySel.selectBest(["model-a", "model-b"], metrics);
    expect(best.modelId).toBe("model-b");
  });

  it("should throw when candidates array is empty", () => {
    expect(() => selector.selectBest([], [])).toThrow(/must not be empty/);
  });

  it("should throw when candidates and metrics have different lengths", () => {
    expect(() =>
      selector.selectBest(["model-cheap"], [METRICS[0]!, METRICS[1]!])
    ).toThrow(/same length/);
  });

  it("should return fallback score 0 when none of candidates are registered", () => {
    const result = selector.selectBest(
      ["unregistered-a"],
      [{ costPer1kTokens: 0.01, qualityRating: 0.5, avgLatencyMs: 200 }],
    );
    expect(result.score).toBe(0);
    expect(result.modelId).toBe("unregistered-a");
  });

  it("should handle single candidate gracefully", () => {
    const result = selector.selectBest(["model-cheap"], [METRICS[0]!]);
    expect(result.modelId).toBe("model-cheap");
  });
});

// ─── rebalance ───────────────────────────────────────────────────────

describe("WeightedModelSelector.rebalance", () => {
  it("should update weights for existing model", () => {
    const selector = new WeightedModelSelector(WEIGHTS);
    const newWeight: ModelWeight = {
      modelId: "model-cheap",
      costWeight: 0.3,
      qualityWeight: 0.4,
      latencyWeight: 0.3,
    };
    selector.rebalance(newWeight);
    const updated = selector.getWeight("model-cheap");
    expect(updated?.costWeight).toBe(0.3);
    expect(updated?.qualityWeight).toBe(0.4);
  });

  it("should throw when rebalancing unregistered model", () => {
    const selector = new WeightedModelSelector(WEIGHTS);
    expect(() =>
      selector.rebalance({ modelId: "ghost", costWeight: 0.5, qualityWeight: 0.3, latencyWeight: 0.2 })
    ).toThrow(/not registered/);
  });

  it("selectBest should reflect rebalanced weights", () => {
    const selector = new WeightedModelSelector([
      { modelId: "model-a", costWeight: 0.9, qualityWeight: 0.05, latencyWeight: 0.05 },
      { modelId: "model-b", costWeight: 0.9, qualityWeight: 0.05, latencyWeight: 0.05 },
    ]);
    const metrics: ModelMetrics[] = [
      { costPer1kTokens: 0.0001, qualityRating: 0.5, avgLatencyMs: 500 },
      { costPer1kTokens: 0.1, qualityRating: 0.99, avgLatencyMs: 500 },
    ];

    // 초기에는 cheap이 우세
    expect(selector.selectBest(["model-a", "model-b"], metrics).modelId).toBe("model-a");

    // quality weight로 재조정
    selector.rebalance({ modelId: "model-a", costWeight: 0.05, qualityWeight: 0.9, latencyWeight: 0.05 });
    selector.rebalance({ modelId: "model-b", costWeight: 0.05, qualityWeight: 0.9, latencyWeight: 0.05 });

    expect(selector.selectBest(["model-a", "model-b"], metrics).modelId).toBe("model-b");
  });
});

// ─── ModelScore 타입 확인 ─────────────────────────────────────────────

describe("ModelScore shape", () => {
  it("should have correct readonly structure", () => {
    const selector = new WeightedModelSelector(WEIGHTS);
    const result: ModelScore = selector.score("model-cheap", METRICS[0]!);
    // TypeScript 컴파일 시 readonly 검증 — 런타임에서는 형태만 확인
    expect(typeof result.modelId).toBe("string");
    expect(typeof result.score).toBe("number");
    expect(typeof result.breakdown.cost).toBe("number");
    expect(typeof result.breakdown.quality).toBe("number");
    expect(typeof result.breakdown.latency).toBe("number");
  });
});
