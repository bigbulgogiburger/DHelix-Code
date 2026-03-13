import { describe, it, expect, beforeEach } from "vitest";
import {
  CostTracker,
  getModelPricing,
  calculateCost,
  type CostSummary,
  type ModelPricing,
} from "../../../src/llm/cost-tracker.js";
import { getModelCapabilities } from "../../../src/llm/model-capabilities.js";

// =============================================================================
// getModelPricing — SSOT delegation to model-capabilities
// =============================================================================

describe("getModelPricing", () => {
  it("should return pricing for claude-3.5-sonnet", () => {
    const pricing = getModelPricing("claude-3.5-sonnet-20241022");
    expect(pricing.inputPerMillion).toBe(3);
    expect(pricing.outputPerMillion).toBe(15);
  });

  it("should return pricing for claude-3-opus", () => {
    const pricing = getModelPricing("claude-3-opus-20240229");
    expect(pricing.inputPerMillion).toBe(15);
    expect(pricing.outputPerMillion).toBe(75);
  });

  it("should return pricing for claude-3-haiku", () => {
    const pricing = getModelPricing("claude-3-haiku-20240307");
    expect(pricing.inputPerMillion).toBe(0.25);
    expect(pricing.outputPerMillion).toBe(1.25);
  });

  it("should return pricing for gpt-4o", () => {
    const pricing = getModelPricing("gpt-4o");
    expect(pricing.inputPerMillion).toBe(2.5);
    expect(pricing.outputPerMillion).toBe(10);
  });

  it("should return pricing for gpt-4o-mini", () => {
    const pricing = getModelPricing("gpt-4o-mini");
    expect(pricing.inputPerMillion).toBe(0.15);
    expect(pricing.outputPerMillion).toBe(0.6);
  });

  it("should return pricing for gpt-4-turbo", () => {
    const pricing = getModelPricing("gpt-4-turbo");
    expect(pricing.inputPerMillion).toBe(10);
    expect(pricing.outputPerMillion).toBe(30);
  });

  it("should be case insensitive for model matching", () => {
    const pricing = getModelPricing("Claude-3.5-Sonnet");
    expect(pricing.inputPerMillion).toBe(3);
    expect(pricing.outputPerMillion).toBe(15);
  });

  it("should fall back to default pricing for unknown models", () => {
    const pricing = getModelPricing("unknown-local-model-v1");
    expect(pricing.inputPerMillion).toBe(1);
    expect(pricing.outputPerMillion).toBe(3);
  });

  it("should fall back to default pricing for empty string", () => {
    const pricing = getModelPricing("");
    expect(pricing.inputPerMillion).toBe(1);
    expect(pricing.outputPerMillion).toBe(3);
  });

  it("should delegate to model-capabilities as SSOT", () => {
    // Verify that getModelPricing returns the same values as getModelCapabilities
    const models = [
      "gpt-4o",
      "gpt-4o-mini",
      "claude-3.5-sonnet",
      "claude-opus-4-6",
      "o1",
      "o3-mini",
      "deepseek-v3",
    ];
    for (const model of models) {
      const pricing = getModelPricing(model);
      const caps = getModelCapabilities(model);
      expect(pricing.inputPerMillion).toBe(caps.pricing.inputPerMillion);
      expect(pricing.outputPerMillion).toBe(caps.pricing.outputPerMillion);
    }
  });

  it("should return pricing for o1", () => {
    const pricing = getModelPricing("o1");
    expect(pricing.inputPerMillion).toBe(15);
    expect(pricing.outputPerMillion).toBe(60);
  });

  it("should return pricing for o1-mini", () => {
    const pricing = getModelPricing("o1-mini");
    expect(pricing.inputPerMillion).toBe(3);
    expect(pricing.outputPerMillion).toBe(12);
  });

  it("should return pricing for o3-mini", () => {
    const pricing = getModelPricing("o3-mini");
    expect(pricing.inputPerMillion).toBe(1.1);
    expect(pricing.outputPerMillion).toBe(4.4);
  });

  it("should return pricing for claude-opus-4-6", () => {
    const pricing = getModelPricing("claude-opus-4-6");
    expect(pricing.inputPerMillion).toBe(15);
    expect(pricing.outputPerMillion).toBe(75);
  });

  it("should return pricing for claude-haiku-4-5-20251001", () => {
    const pricing = getModelPricing("claude-haiku-4-5-20251001");
    expect(pricing.inputPerMillion).toBe(0.8);
    expect(pricing.outputPerMillion).toBe(4);
  });

  it("should return pricing for deepseek variants", () => {
    const pricing = getModelPricing("deepseek-v3");
    expect(pricing.inputPerMillion).toBe(0.27);
    expect(pricing.outputPerMillion).toBe(1.1);
  });

  it("should return zero pricing for local models (llama)", () => {
    const pricing = getModelPricing("llama3.2");
    expect(pricing.inputPerMillion).toBe(0);
    expect(pricing.outputPerMillion).toBe(0);
  });

  it("should return zero pricing for local models (qwen)", () => {
    const pricing = getModelPricing("qwen2.5-coder-7b");
    expect(pricing.inputPerMillion).toBe(0);
    expect(pricing.outputPerMillion).toBe(0);
  });
});

// =============================================================================
// calculateCost
// =============================================================================

describe("calculateCost", () => {
  it("should calculate cost correctly for claude-3.5-sonnet", () => {
    // 1000 prompt tokens at $3/M = $0.003
    // 500 completion tokens at $15/M = $0.0075
    // Total: $0.0105
    const cost = calculateCost("claude-3.5-sonnet", 1000, 500);
    expect(cost).toBeCloseTo(0.0105, 6);
  });

  it("should calculate cost correctly for gpt-4o", () => {
    // 10000 prompt tokens at $2.5/M = $0.025
    // 5000 completion tokens at $10/M = $0.05
    // Total: $0.075
    const cost = calculateCost("gpt-4o", 10_000, 5_000);
    expect(cost).toBeCloseTo(0.075, 6);
  });

  it("should return zero for zero tokens", () => {
    const cost = calculateCost("gpt-4o", 0, 0);
    expect(cost).toBe(0);
  });

  it("should handle large token counts", () => {
    // 1M prompt tokens at $3/M = $3
    // 1M completion tokens at $15/M = $15
    const cost = calculateCost("claude-3.5-sonnet", 1_000_000, 1_000_000);
    expect(cost).toBeCloseTo(18, 2);
  });

  it("should use default pricing for unknown models", () => {
    // 1000 prompt at $1/M = $0.001
    // 1000 completion at $3/M = $0.003
    const cost = calculateCost("my-local-model", 1000, 1000);
    expect(cost).toBeCloseTo(0.004, 6);
  });
});

// =============================================================================
// CostTracker
// =============================================================================

describe("CostTracker", () => {
  let tracker: CostTracker;

  beforeEach(() => {
    tracker = new CostTracker();
  });

  describe("addUsage and getSummary", () => {
    it("should start with zero cost and entries", () => {
      const summary = tracker.getSummary();
      expect(summary.totalCost).toBe(0);
      expect(summary.totalTokens).toBe(0);
      expect(summary.totalPromptTokens).toBe(0);
      expect(summary.totalCompletionTokens).toBe(0);
      expect(summary.entries).toHaveLength(0);
      expect(summary.modelBreakdown.size).toBe(0);
    });

    it("should track a single usage entry", () => {
      tracker.addUsage({
        model: "claude-3.5-sonnet",
        promptTokens: 1000,
        completionTokens: 500,
        totalTokens: 1500,
        iteration: 1,
      });

      const summary = tracker.getSummary();
      expect(summary.entries).toHaveLength(1);
      expect(summary.totalTokens).toBe(1500);
      expect(summary.totalPromptTokens).toBe(1000);
      expect(summary.totalCompletionTokens).toBe(500);
      expect(summary.totalCost).toBeGreaterThan(0);
    });

    it("should accumulate multiple usage entries", () => {
      tracker.addUsage({
        model: "claude-3.5-sonnet",
        promptTokens: 1000,
        completionTokens: 500,
        totalTokens: 1500,
        iteration: 1,
      });

      tracker.addUsage({
        model: "claude-3.5-sonnet",
        promptTokens: 2000,
        completionTokens: 1000,
        totalTokens: 3000,
        iteration: 2,
      });

      const summary = tracker.getSummary();
      expect(summary.entries).toHaveLength(2);
      expect(summary.totalTokens).toBe(4500);
      expect(summary.totalPromptTokens).toBe(3000);
      expect(summary.totalCompletionTokens).toBe(1500);
    });

    it("should calculate cost automatically based on model", () => {
      tracker.addUsage({
        model: "gpt-4o",
        promptTokens: 10_000,
        completionTokens: 5_000,
        totalTokens: 15_000,
        iteration: 1,
      });

      const summary = tracker.getSummary();
      // gpt-4o: 10k prompt at $2.5/M + 5k completion at $10/M = $0.025 + $0.05 = $0.075
      expect(summary.totalCost).toBeCloseTo(0.075, 4);
    });

    it("should assign timestamps to entries", () => {
      const before = Date.now();
      tracker.addUsage({
        model: "gpt-4o",
        promptTokens: 100,
        completionTokens: 50,
        totalTokens: 150,
        iteration: 1,
      });
      const after = Date.now();

      const summary = tracker.getSummary();
      expect(summary.entries[0].timestamp).toBeGreaterThanOrEqual(before);
      expect(summary.entries[0].timestamp).toBeLessThanOrEqual(after);
    });
  });

  describe("model-specific pricing", () => {
    it("should use claude-3.5-sonnet pricing", () => {
      tracker.addUsage({
        model: "claude-3.5-sonnet-20241022",
        promptTokens: 1_000_000,
        completionTokens: 0,
        totalTokens: 1_000_000,
        iteration: 1,
      });

      const summary = tracker.getSummary();
      // $3 per million input tokens
      expect(summary.totalCost).toBeCloseTo(3.0, 2);
    });

    it("should use gpt-4o-mini pricing", () => {
      tracker.addUsage({
        model: "gpt-4o-mini",
        promptTokens: 1_000_000,
        completionTokens: 0,
        totalTokens: 1_000_000,
        iteration: 1,
      });

      const summary = tracker.getSummary();
      // $0.15 per million input tokens
      expect(summary.totalCost).toBeCloseTo(0.15, 4);
    });
  });

  describe("unknown model fallback", () => {
    it("should use default pricing for unknown models", () => {
      tracker.addUsage({
        model: "my-custom-local-model",
        promptTokens: 1_000_000,
        completionTokens: 1_000_000,
        totalTokens: 2_000_000,
        iteration: 1,
      });

      const summary = tracker.getSummary();
      // Default: $1/M input + $3/M output = $1 + $3 = $4
      expect(summary.totalCost).toBeCloseTo(4.0, 2);
    });
  });

  describe("reset", () => {
    it("should clear all data on reset", () => {
      tracker.addUsage({
        model: "gpt-4o",
        promptTokens: 1000,
        completionTokens: 500,
        totalTokens: 1500,
        iteration: 1,
      });

      tracker.addUsage({
        model: "gpt-4o",
        promptTokens: 2000,
        completionTokens: 1000,
        totalTokens: 3000,
        iteration: 2,
      });

      expect(tracker.entryCount).toBe(2);

      tracker.reset();

      expect(tracker.entryCount).toBe(0);
      const summary = tracker.getSummary();
      expect(summary.totalCost).toBe(0);
      expect(summary.totalTokens).toBe(0);
      expect(summary.entries).toHaveLength(0);
      expect(summary.modelBreakdown.size).toBe(0);
    });

    it("should allow new entries after reset", () => {
      tracker.addUsage({
        model: "gpt-4o",
        promptTokens: 1000,
        completionTokens: 500,
        totalTokens: 1500,
        iteration: 1,
      });

      tracker.reset();

      tracker.addUsage({
        model: "claude-3.5-sonnet",
        promptTokens: 500,
        completionTokens: 250,
        totalTokens: 750,
        iteration: 1,
      });

      const summary = tracker.getSummary();
      expect(summary.entries).toHaveLength(1);
      expect(summary.entries[0].model).toBe("claude-3.5-sonnet");
    });
  });

  describe("modelBreakdown aggregation", () => {
    it("should aggregate by model name", () => {
      tracker.addUsage({
        model: "gpt-4o",
        promptTokens: 1000,
        completionTokens: 500,
        totalTokens: 1500,
        iteration: 1,
      });

      tracker.addUsage({
        model: "claude-3.5-sonnet",
        promptTokens: 2000,
        completionTokens: 1000,
        totalTokens: 3000,
        iteration: 2,
      });

      tracker.addUsage({
        model: "gpt-4o",
        promptTokens: 500,
        completionTokens: 250,
        totalTokens: 750,
        iteration: 3,
      });

      const summary = tracker.getSummary();
      expect(summary.modelBreakdown.size).toBe(2);

      const gpt4oBreakdown = summary.modelBreakdown.get("gpt-4o");
      expect(gpt4oBreakdown).toBeDefined();
      expect(gpt4oBreakdown!.tokens).toBe(2250); // 1500 + 750

      const claudeBreakdown = summary.modelBreakdown.get("claude-3.5-sonnet");
      expect(claudeBreakdown).toBeDefined();
      expect(claudeBreakdown!.tokens).toBe(3000);
    });

    it("should aggregate costs correctly in breakdown", () => {
      tracker.addUsage({
        model: "gpt-4o",
        promptTokens: 10_000,
        completionTokens: 5_000,
        totalTokens: 15_000,
        iteration: 1,
      });

      tracker.addUsage({
        model: "gpt-4o",
        promptTokens: 10_000,
        completionTokens: 5_000,
        totalTokens: 15_000,
        iteration: 2,
      });

      const summary = tracker.getSummary();
      const breakdown = summary.modelBreakdown.get("gpt-4o");
      // Each call: $0.025 + $0.05 = $0.075, total: $0.15
      expect(breakdown!.cost).toBeCloseTo(0.15, 4);
    });
  });

  describe("addFromTokenUsage convenience method", () => {
    it("should work with TokenUsage objects", () => {
      tracker.addFromTokenUsage(
        "gpt-4o",
        { promptTokens: 1000, completionTokens: 500, totalTokens: 1500 },
        1,
      );

      const summary = tracker.getSummary();
      expect(summary.entries).toHaveLength(1);
      expect(summary.totalTokens).toBe(1500);
      expect(summary.totalCost).toBeGreaterThan(0);
    });
  });

  describe("entryCount", () => {
    it("should reflect the number of recorded entries", () => {
      expect(tracker.entryCount).toBe(0);

      tracker.addUsage({
        model: "gpt-4o",
        promptTokens: 100,
        completionTokens: 50,
        totalTokens: 150,
        iteration: 1,
      });
      expect(tracker.entryCount).toBe(1);

      tracker.addUsage({
        model: "gpt-4o",
        promptTokens: 200,
        completionTokens: 100,
        totalTokens: 300,
        iteration: 2,
      });
      expect(tracker.entryCount).toBe(2);
    });
  });
});
