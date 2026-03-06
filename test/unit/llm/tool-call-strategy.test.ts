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

  it("should return native strategy for unknown models (safe default)", () => {
    const strategy = selectStrategy("local-llama");
    expect(strategy.name).toBe("native");
  });

  it("should return native strategy for llama3.1+ (supports tools)", () => {
    const strategy = selectStrategy("llama3.1");
    expect(strategy.name).toBe("native");
  });

  it("should return text-parsing strategy for llama3 base (no tool support)", () => {
    const strategy = selectStrategy("llama3");
    expect(strategy.name).toBe("text-parsing");
  });

  it("should return text-parsing strategy for deepseek-coder (no tool support)", () => {
    const strategy = selectStrategy("deepseek-coder");
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
