import { describe, it, expect } from "vitest";
import { getModelCapabilities } from "../../../src/llm/model-capabilities.js";

describe("getModelCapabilities", () => {
  it("should return defaults for unknown models", () => {
    const caps = getModelCapabilities("some-unknown-model");
    expect(caps.supportsTools).toBe(true);
    expect(caps.supportsSystemMessage).toBe(true);
    expect(caps.supportsTemperature).toBe(true);
    expect(caps.useDeveloperRole).toBe(false);
  });

  it("should detect GPT-4o capabilities", () => {
    const caps = getModelCapabilities("gpt-4o");
    expect(caps.supportsTools).toBe(true);
    expect(caps.maxOutputTokens).toBe(16384);
    expect(caps.tokenizer).toBe("o200k");
  });

  it("should detect GPT-4o-mini capabilities", () => {
    const caps = getModelCapabilities("gpt-4o-mini");
    expect(caps.supportsTools).toBe(true);
    expect(caps.maxOutputTokens).toBe(16384);
  });

  it("should detect o1 reasoning model capabilities", () => {
    const caps = getModelCapabilities("o1");
    expect(caps.supportsSystemMessage).toBe(false);
    expect(caps.supportsTemperature).toBe(false);
    expect(caps.useDeveloperRole).toBe(true);
    expect(caps.maxContextTokens).toBe(200_000);
  });

  it("should detect o3-mini reasoning model capabilities", () => {
    const caps = getModelCapabilities("o3-mini");
    expect(caps.supportsSystemMessage).toBe(false);
    expect(caps.supportsTemperature).toBe(false);
    expect(caps.useDeveloperRole).toBe(true);
  });

  it("should detect llama3 base as no tool support", () => {
    const caps = getModelCapabilities("llama3");
    expect(caps.supportsTools).toBe(false);
    expect(caps.tokenizer).toBe("llama");
    expect(caps.maxContextTokens).toBe(8192);
  });

  it("should detect llama3.1 as having tool support", () => {
    const caps = getModelCapabilities("llama3.1");
    expect(caps.supportsTools).toBe(true);
    expect(caps.maxContextTokens).toBe(131_072);
    expect(caps.tokenizer).toBe("llama");
  });

  it("should detect Claude models", () => {
    const caps = getModelCapabilities("claude-3.5-sonnet");
    expect(caps.supportsTools).toBe(true);
    expect(caps.maxContextTokens).toBe(200_000);
    expect(caps.tokenizer).toBe("cl100k");
  });

  it("should detect deepseek-coder as no tool support", () => {
    const caps = getModelCapabilities("deepseek-coder");
    expect(caps.supportsTools).toBe(false);
    expect(caps.maxContextTokens).toBe(16384);
  });

  it("should detect deepseek-coder-v2 as having tool support", () => {
    const caps = getModelCapabilities("deepseek-coder-v2");
    expect(caps.supportsTools).toBe(true);
    expect(caps.maxContextTokens).toBe(128_000);
  });

  it("should detect GPT-4.1 with 1M context", () => {
    const caps = getModelCapabilities("gpt-4.1");
    expect(caps.maxContextTokens).toBe(1_000_000);
    expect(caps.maxOutputTokens).toBe(32768);
  });
});
