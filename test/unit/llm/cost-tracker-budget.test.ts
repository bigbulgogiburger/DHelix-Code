import { describe, it, expect, vi, beforeEach } from "vitest";
import { CostTracker, type BudgetStatus } from "../../../src/llm/cost-tracker.js";

// Mock model-capabilities to return deterministic pricing
vi.mock("../../../src/llm/model-capabilities.js", () => ({
  getModelCapabilities: vi.fn().mockReturnValue({
    pricing: { inputPerMillion: 10, outputPerMillion: 30 },
    capabilityTier: "high",
  }),
}));

describe("CostTracker Budget", () => {
  let tracker: CostTracker;

  beforeEach(() => {
    tracker = new CostTracker();
  });

  it("should return default budget status when no budget is set", () => {
    const status = tracker.checkBudget();
    expect(status.withinBudget).toBe(true);
    expect(status.percentUsed).toBe(0);
    expect(status.remaining).toBe(Infinity);
  });

  it("should track budget after setBudget", () => {
    tracker.setBudget(1.0); // $1 budget

    // Add usage: 1000 input * $10/M + 1000 output * $30/M = $0.01 + $0.03 = $0.04
    tracker.addUsage({
      model: "test-model",
      promptTokens: 1000,
      completionTokens: 1000,
      totalTokens: 2000,
      iteration: 1,
    });

    const status = tracker.checkBudget();
    expect(status.withinBudget).toBe(true);
    expect(status.percentUsed).toBeGreaterThan(0);
    expect(status.percentUsed).toBeLessThan(100);
    expect(status.remaining).toBeGreaterThan(0);
    expect(status.sessionBudgetUSD).toBe(1.0);
  });

  it("should detect budget exceeded", () => {
    tracker.setBudget(0.01); // Very small budget: $0.01

    // Add usage that exceeds budget
    tracker.addUsage({
      model: "test-model",
      promptTokens: 10000,
      completionTokens: 10000,
      totalTokens: 20000,
      iteration: 1,
    });

    const status = tracker.checkBudget();
    expect(status.withinBudget).toBe(false);
    expect(status.percentUsed).toBe(100); // Capped at 100
    expect(status.remaining).toBe(0);
  });

  it("should call budget threshold callback at 80%", () => {
    const callback = vi.fn();
    tracker.setBudget(0.05); // $0.05 budget
    tracker.onBudgetThreshold(callback);

    // Add usage: 1000 * $10/M + 1000 * $30/M = $0.04 = 80% of $0.05
    tracker.addUsage({
      model: "test-model",
      promptTokens: 1000,
      completionTokens: 1000,
      totalTokens: 2000,
      iteration: 1,
    });

    expect(callback).toHaveBeenCalled();
    const status = callback.mock.calls[0][0] as BudgetStatus;
    expect(status.percentUsed).toBeGreaterThanOrEqual(80);
  });

  it("should call budget threshold callback at 100%", () => {
    const callback = vi.fn();
    tracker.setBudget(0.01); // $0.01 budget
    tracker.onBudgetThreshold(callback);

    // This will exceed $0.01
    tracker.addUsage({
      model: "test-model",
      promptTokens: 10000,
      completionTokens: 10000,
      totalTokens: 20000,
      iteration: 1,
    });

    expect(callback).toHaveBeenCalled();
    const status = callback.mock.calls[0][0] as BudgetStatus;
    expect(status.withinBudget).toBe(false);
  });

  it("should not call callback when below 80%", () => {
    const callback = vi.fn();
    tracker.setBudget(100.0); // Very large budget
    tracker.onBudgetThreshold(callback);

    tracker.addUsage({
      model: "test-model",
      promptTokens: 1,
      completionTokens: 1,
      totalTokens: 2,
      iteration: 1,
    });

    expect(callback).not.toHaveBeenCalled();
  });

  it("should set daily budget", () => {
    tracker.setBudget(1.0, 5.0);
    const status = tracker.checkBudget();
    expect(status.sessionBudgetUSD).toBe(1.0);
    expect(status.dailyBudgetUSD).toBe(5.0);
  });

  it("should ignore invalid budget values", () => {
    tracker.setBudget(0); // 0 should be ignored
    const status = tracker.checkBudget();
    expect(status.withinBudget).toBe(true);
    expect(status.remaining).toBe(Infinity);
  });

  it("should reset budget tracking on reset", () => {
    tracker.setBudget(1.0);
    tracker.addUsage({
      model: "test-model",
      promptTokens: 1000,
      completionTokens: 1000,
      totalTokens: 2000,
      iteration: 1,
    });
    tracker.reset();

    const status = tracker.checkBudget();
    // Budget is still set but usage is 0
    expect(status.percentUsed).toBe(0);
    expect(status.remaining).toBe(1.0);
  });
});
