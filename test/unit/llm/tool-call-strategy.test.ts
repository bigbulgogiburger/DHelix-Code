import { describe, it, expect } from "vitest";
import { selectStrategy } from "../../../src/llm/tool-call-strategy.js";

describe("selectStrategy", () => {
  it("should return native strategy for GPT models", () => {
    const strategy = selectStrategy("gpt-4");
    expect(strategy.name).toBe("native");
  });

  it("should return native strategy for Claude models", () => {
    const strategy = selectStrategy("claude-3-opus");
    expect(strategy.name).toBe("native");
  });

  it("should return text-parsing strategy for unknown models", () => {
    const strategy = selectStrategy("local-llama");
    expect(strategy.name).toBe("text-parsing");
  });

  it("should return text-parsing strategy for Ollama models", () => {
    const strategy = selectStrategy("llama3.1");
    expect(strategy.name).toBe("text-parsing");
  });

  it("returned strategy should have prepareRequest method", () => {
    const strategy = selectStrategy("gpt-4");
    expect(strategy.prepareRequest).toBeTypeOf("function");
  });

  it("returned strategy should have extractToolCalls method", () => {
    const strategy = selectStrategy("gpt-4");
    expect(strategy.extractToolCalls).toBeTypeOf("function");
  });

  it("returned strategy should have formatToolResults method", () => {
    const strategy = selectStrategy("gpt-4");
    expect(strategy.formatToolResults).toBeTypeOf("function");
  });
});
