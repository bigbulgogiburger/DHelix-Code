import { describe, it, expect } from "vitest";
import { countTokens, estimateTokens, countMessageTokens } from "../../../src/llm/token-counter.js";

describe("countTokens", () => {
  it("should count tokens for simple English text", () => {
    const count = countTokens("Hello, world!");
    expect(count).toBeGreaterThan(0);
    expect(count).toBeLessThan(10);
  });

  it("should count tokens for empty string", () => {
    expect(countTokens("")).toBe(0);
  });

  it("should count tokens for longer text", () => {
    const text = "The quick brown fox jumps over the lazy dog.";
    const count = countTokens(text);
    expect(count).toBeGreaterThan(5);
    expect(count).toBeLessThan(20);
  });
});

describe("estimateTokens", () => {
  it("should estimate tokens for English text", () => {
    const estimate = estimateTokens("Hello world this is a test");
    expect(estimate).toBeGreaterThan(0);
  });

  it("should return 0 for empty string", () => {
    expect(estimateTokens("")).toBe(0);
  });

  it("should handle CJK characters", () => {
    const estimate = estimateTokens("안녕하세요 세계");
    expect(estimate).toBeGreaterThan(0);
  });
});

describe("countMessageTokens", () => {
  it("should include overhead per message", () => {
    const messages = [
      { role: "user", content: "Hi" },
      { role: "assistant", content: "Hello!" },
    ];
    const total = countMessageTokens(messages);
    // At minimum: 2 messages × 4 overhead + 2 priming + actual tokens
    expect(total).toBeGreaterThanOrEqual(10);
  });

  it("should handle empty messages array", () => {
    const total = countMessageTokens([]);
    expect(total).toBe(2); // Just the priming token
  });
});
