import { describe, it, expect } from "vitest";
import { calculateThinkingBudget } from "../../../src/llm/thinking-budget.js";
import { type ModelCapabilities } from "../../../src/llm/model-capabilities.js";

function makeCaps(overrides: Partial<ModelCapabilities> = {}): ModelCapabilities {
  return {
    supportsTools: true,
    supportsSystemMessage: true,
    supportsTemperature: true,
    supportsStreaming: true,
    maxContextTokens: 200000,
    maxOutputTokens: 16384,
    tokenizer: "cl100k" as const,
    useDeveloperRole: false,
    pricing: { inputPerMillion: 3, outputPerMillion: 15 },
    useMaxCompletionTokens: true,
    capabilityTier: "high" as const,
    supportsCaching: false,
    supportsThinking: false,
    defaultThinkingBudget: 0,
    ...overrides,
  };
}

describe("calculateThinkingBudget", () => {
  it("should return 0 for models that don't support thinking", () => {
    const caps = makeCaps({ supportsThinking: false });
    expect(calculateThinkingBudget(caps)).toBe(0);
  });

  it("should return default budget when set", () => {
    const caps = makeCaps({ supportsThinking: true, defaultThinkingBudget: 10000 });
    expect(calculateThinkingBudget(caps)).toBe(10000);
  });

  it("should reduce budget when context usage is high", () => {
    const caps = makeCaps({ supportsThinking: true, defaultThinkingBudget: 10000 });
    const budget = calculateThinkingBudget(caps, 80);
    expect(budget).toBe(5000);
  });

  it("should auto-calculate when no default is set", () => {
    const caps = makeCaps({ supportsThinking: true, defaultThinkingBudget: 0, maxContextTokens: 200000 });
    const budget = calculateThinkingBudget(caps);
    expect(budget).toBe(10000); // 200000 * 0.05 = 10000
  });

  it("should cap auto-calculate at 16384", () => {
    const caps = makeCaps({ supportsThinking: true, defaultThinkingBudget: 0, maxContextTokens: 1000000 });
    const budget = calculateThinkingBudget(caps);
    expect(budget).toBe(16384); // 1000000 * 0.05 = 50000, capped at 16384
  });

  it("should enforce minimum of 1024", () => {
    const caps = makeCaps({ supportsThinking: true, defaultThinkingBudget: 2000, maxContextTokens: 4096 });
    const budget = calculateThinkingBudget(caps, 90);
    expect(budget).toBe(1024); // 2000 * 0.5 = 1000, min 1024
  });
});
