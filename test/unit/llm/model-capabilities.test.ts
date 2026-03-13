import { describe, it, expect } from "vitest";
import { getModelCapabilities } from "../../../src/llm/model-capabilities.js";

describe("getModelCapabilities", () => {
  it("should return defaults for unknown models", () => {
    const caps = getModelCapabilities("some-unknown-model");
    expect(caps.supportsTools).toBe(true);
    expect(caps.supportsSystemMessage).toBe(true);
    expect(caps.supportsTemperature).toBe(true);
    expect(caps.useDeveloperRole).toBe(false);
    expect(caps.capabilityTier).toBe("medium");
  });

  it("should detect GPT-4o capabilities", () => {
    const caps = getModelCapabilities("gpt-4o");
    expect(caps.supportsTools).toBe(true);
    expect(caps.maxOutputTokens).toBe(16384);
    expect(caps.tokenizer).toBe("o200k");
    expect(caps.capabilityTier).toBe("high");
  });

  it("should detect GPT-4o-mini capabilities", () => {
    const caps = getModelCapabilities("gpt-4o-mini");
    expect(caps.supportsTools).toBe(true);
    expect(caps.maxOutputTokens).toBe(16384);
    expect(caps.capabilityTier).toBe("medium");
  });

  it("should detect o1 reasoning model capabilities", () => {
    const caps = getModelCapabilities("o1");
    expect(caps.supportsSystemMessage).toBe(false);
    expect(caps.supportsTemperature).toBe(false);
    expect(caps.useDeveloperRole).toBe(true);
    expect(caps.maxContextTokens).toBe(200_000);
    expect(caps.capabilityTier).toBe("high");
  });

  it("should detect o3-mini reasoning model capabilities", () => {
    const caps = getModelCapabilities("o3-mini");
    expect(caps.supportsSystemMessage).toBe(false);
    expect(caps.supportsTemperature).toBe(false);
    expect(caps.useDeveloperRole).toBe(true);
    expect(caps.capabilityTier).toBe("high");
  });

  it("should detect llama3 base as no tool support", () => {
    const caps = getModelCapabilities("llama3");
    expect(caps.supportsTools).toBe(false);
    expect(caps.tokenizer).toBe("llama");
    expect(caps.maxContextTokens).toBe(8192);
    expect(caps.capabilityTier).toBe("low");
  });

  it("should detect llama3.1 as having tool support", () => {
    const caps = getModelCapabilities("llama3.1");
    expect(caps.supportsTools).toBe(true);
    expect(caps.maxContextTokens).toBe(131_072);
    expect(caps.tokenizer).toBe("llama");
    expect(caps.capabilityTier).toBe("low");
  });

  it("should detect Claude models", () => {
    const caps = getModelCapabilities("claude-3.5-sonnet");
    expect(caps.supportsTools).toBe(true);
    expect(caps.maxContextTokens).toBe(200_000);
    expect(caps.tokenizer).toBe("cl100k");
    expect(caps.capabilityTier).toBe("high");
  });

  it("should detect deepseek-coder as no tool support", () => {
    const caps = getModelCapabilities("deepseek-coder");
    expect(caps.supportsTools).toBe(false);
    expect(caps.maxContextTokens).toBe(16384);
    expect(caps.capabilityTier).toBe("low");
  });

  it("should detect deepseek-coder-v2 as having tool support", () => {
    const caps = getModelCapabilities("deepseek-coder-v2");
    expect(caps.supportsTools).toBe(true);
    expect(caps.maxContextTokens).toBe(128_000);
    expect(caps.capabilityTier).toBe("medium");
  });

  it("should detect GPT-4.1 with 1M context", () => {
    const caps = getModelCapabilities("gpt-4.1");
    expect(caps.maxContextTokens).toBe(1_000_000);
    expect(caps.maxOutputTokens).toBe(32768);
    expect(caps.capabilityTier).toBe("high");
  });

  describe("capabilityTier classification", () => {
    it("should classify high-tier models correctly", () => {
      expect(getModelCapabilities("gpt-4o").capabilityTier).toBe("high");
      expect(getModelCapabilities("gpt-4.1").capabilityTier).toBe("high");
      expect(getModelCapabilities("gpt-5").capabilityTier).toBe("high");
      expect(getModelCapabilities("gpt-5.1-codex").capabilityTier).toBe("high");
      expect(getModelCapabilities("gpt-4-turbo").capabilityTier).toBe("high");
      expect(getModelCapabilities("gpt-4").capabilityTier).toBe("high");
      expect(getModelCapabilities("o1").capabilityTier).toBe("high");
      expect(getModelCapabilities("o3").capabilityTier).toBe("high");
      expect(getModelCapabilities("claude-3-opus").capabilityTier).toBe("high");
      expect(getModelCapabilities("claude-3.5-sonnet").capabilityTier).toBe("high");
    });

    it("should classify medium-tier models correctly", () => {
      expect(getModelCapabilities("gpt-4o-mini").capabilityTier).toBe("medium");
      expect(getModelCapabilities("gpt-5-mini").capabilityTier).toBe("medium");
      expect(getModelCapabilities("gpt-5-nano").capabilityTier).toBe("medium");
      expect(getModelCapabilities("gpt-3.5-turbo").capabilityTier).toBe("medium");
      expect(getModelCapabilities("claude-3-haiku").capabilityTier).toBe("medium");
      expect(getModelCapabilities("deepseek-coder-v2").capabilityTier).toBe("medium");
      expect(getModelCapabilities("deepseek-v3").capabilityTier).toBe("medium");
      expect(getModelCapabilities("mistral-large").capabilityTier).toBe("medium");
    });

    it("should classify low-tier models correctly", () => {
      expect(getModelCapabilities("llama3").capabilityTier).toBe("low");
      expect(getModelCapabilities("llama3.1").capabilityTier).toBe("low");
      expect(getModelCapabilities("qwen2.5-coder-7b").capabilityTier).toBe("low");
      expect(getModelCapabilities("qwen2.5-coder-32b").capabilityTier).toBe("low");
      expect(getModelCapabilities("codestral").capabilityTier).toBe("low");
      expect(getModelCapabilities("deepseek-coder").capabilityTier).toBe("low");
      expect(getModelCapabilities("phi-3").capabilityTier).toBe("low");
      expect(getModelCapabilities("gemma-7b").capabilityTier).toBe("low");
    });

    it("should default unknown models to medium tier", () => {
      expect(getModelCapabilities("unknown-model").capabilityTier).toBe("medium");
      expect(getModelCapabilities("custom-local-model").capabilityTier).toBe("medium");
    });
  });
});
