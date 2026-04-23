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

  describe("thinking capabilities", () => {
    it("Claude models should support thinking", () => {
      expect(getModelCapabilities("claude-opus-4").supportsThinking).toBe(true);
      expect(getModelCapabilities("claude-sonnet-4").supportsThinking).toBe(true);
      expect(getModelCapabilities("claude-haiku-4").supportsThinking).toBe(true);
    });

    it("Non-Claude models should not support thinking", () => {
      expect(getModelCapabilities("gpt-4o").supportsThinking).toBe(false);
      expect(getModelCapabilities("deepseek-chat").supportsThinking).toBe(false);
    });

    it("Claude Opus should have highest thinking budget", () => {
      const opus = getModelCapabilities("claude-opus-4");
      const sonnet = getModelCapabilities("claude-sonnet-4");
      expect(opus.defaultThinkingBudget).toBeGreaterThan(sonnet.defaultThinkingBudget);
    });
  });

  // ── P-1.18 / P-1.21 plasmid extension fields ────────────────────
  describe("plasmid extension fields — defaults", () => {
    it("unknown models fall back to unknown/B/false/strong/either", () => {
      const caps = getModelCapabilities("some-unknown-model");
      expect(caps.privacyTier).toBe("unknown");
      expect(caps.strategyTier).toBe("B");
      expect(caps.supportsJsonMode).toBe(false);
      expect(caps.toolCallReliability).toBe("strong");
      expect(caps.preferredDualModelRole).toBe("either");
    });
  });

  describe("privacyTier classification", () => {
    it("classifies cloud models as cloud", () => {
      expect(getModelCapabilities("gpt-5").privacyTier).toBe("cloud");
      expect(getModelCapabilities("gpt-5.1-codex").privacyTier).toBe("cloud");
      expect(getModelCapabilities("gpt-4o").privacyTier).toBe("cloud");
      expect(getModelCapabilities("gpt-4.1").privacyTier).toBe("cloud");
      expect(getModelCapabilities("claude-opus-4-7").privacyTier).toBe("cloud");
      expect(getModelCapabilities("claude-haiku-4-5").privacyTier).toBe(
        "cloud",
      );
      expect(getModelCapabilities("o1").privacyTier).toBe("cloud");
      expect(getModelCapabilities("o3-mini").privacyTier).toBe("cloud");
      expect(getModelCapabilities("mistral-large").privacyTier).toBe("cloud");
      expect(getModelCapabilities("deepseek-v3").privacyTier).toBe("cloud");
    });

    it("classifies local models as local", () => {
      expect(getModelCapabilities("llama3").privacyTier).toBe("local");
      expect(getModelCapabilities("llama3.1:8b").privacyTier).toBe("local");
      expect(getModelCapabilities("qwen2.5-coder-7b").privacyTier).toBe(
        "local",
      );
      expect(getModelCapabilities("qwen2.5-coder-32b").privacyTier).toBe(
        "local",
      );
      expect(getModelCapabilities("phi-3").privacyTier).toBe("local");
      expect(getModelCapabilities("gemma-7b").privacyTier).toBe("local");
      expect(getModelCapabilities("codestral").privacyTier).toBe("local");
      expect(getModelCapabilities("deepseek-coder").privacyTier).toBe("local");
    });

    it("treats MiniMax as local-first (pricing 0)", () => {
      expect(getModelCapabilities("minimax").privacyTier).toBe("local");
    });
  });

  describe("strategyTier matrix (P-1.19)", () => {
    it("top-tier models map to A", () => {
      expect(getModelCapabilities("gpt-5").strategyTier).toBe("A");
      expect(getModelCapabilities("gpt-5.1-codex").strategyTier).toBe("A");
      expect(getModelCapabilities("gpt-4.1").strategyTier).toBe("A");
      expect(getModelCapabilities("claude-opus-4-7").strategyTier).toBe("A");
      expect(getModelCapabilities("o3").strategyTier).toBe("A");
    });

    it("mid-tier models map to B", () => {
      expect(getModelCapabilities("gpt-5-mini").strategyTier).toBe("B");
      expect(getModelCapabilities("gpt-5-nano").strategyTier).toBe("B");
      expect(getModelCapabilities("claude-haiku-4-5").strategyTier).toBe("B");
      expect(getModelCapabilities("qwen2.5-coder-32b").strategyTier).toBe("B");
      expect(getModelCapabilities("o3-mini").strategyTier).toBe("B");
      expect(getModelCapabilities("minimax").strategyTier).toBe("B");
      expect(getModelCapabilities("mistral-large").strategyTier).toBe("B");
    });

    it("entry / small-local models map to C", () => {
      expect(getModelCapabilities("llama3").strategyTier).toBe("C");
      expect(getModelCapabilities("llama3.1:8b").strategyTier).toBe("C");
      expect(getModelCapabilities("qwen2.5-coder-7b").strategyTier).toBe("C");
      expect(getModelCapabilities("phi-3").strategyTier).toBe("C");
      expect(getModelCapabilities("gemma-7b").strategyTier).toBe("C");
      expect(getModelCapabilities("codestral").strategyTier).toBe("C");
      expect(getModelCapabilities("gpt-3.5-turbo").strategyTier).toBe("C");
    });
  });

  describe("supportsJsonMode", () => {
    it("true for flagship cloud and modern local models", () => {
      expect(getModelCapabilities("gpt-5").supportsJsonMode).toBe(true);
      expect(getModelCapabilities("gpt-5.1-codex").supportsJsonMode).toBe(true);
      expect(getModelCapabilities("gpt-4o").supportsJsonMode).toBe(true);
      expect(getModelCapabilities("gpt-4.1").supportsJsonMode).toBe(true);
      expect(getModelCapabilities("claude-opus-4-7").supportsJsonMode).toBe(
        true,
      );
      expect(getModelCapabilities("claude-haiku-4-5").supportsJsonMode).toBe(
        true,
      );
      expect(getModelCapabilities("llama3.1:8b").supportsJsonMode).toBe(true);
      expect(getModelCapabilities("qwen2.5-coder-7b").supportsJsonMode).toBe(
        true,
      );
      expect(getModelCapabilities("deepseek-v3").supportsJsonMode).toBe(true);
      expect(getModelCapabilities("mistral-large").supportsJsonMode).toBe(true);
    });

    it("false for base llama3 / phi / gemma", () => {
      expect(getModelCapabilities("llama3").supportsJsonMode).toBe(false);
      expect(getModelCapabilities("phi-3").supportsJsonMode).toBe(false);
      expect(getModelCapabilities("gemma-7b").supportsJsonMode).toBe(false);
    });
  });

  describe("toolCallReliability", () => {
    it("is 'strong' for flagship + llama3.1+ + qwen2.5+", () => {
      expect(getModelCapabilities("gpt-5").toolCallReliability).toBe("strong");
      expect(getModelCapabilities("claude-opus-4-7").toolCallReliability).toBe(
        "strong",
      );
      expect(getModelCapabilities("llama3.1:8b").toolCallReliability).toBe(
        "strong",
      );
      expect(
        getModelCapabilities("qwen2.5-coder-7b").toolCallReliability,
      ).toBe("strong");
    });

    it("is 'weak' for phi / gemma", () => {
      expect(getModelCapabilities("phi-3").toolCallReliability).toBe("weak");
      expect(getModelCapabilities("gemma-7b").toolCallReliability).toBe("weak");
    });

    it("is 'none' where supportsTools is false", () => {
      const llama3 = getModelCapabilities("llama3");
      expect(llama3.supportsTools).toBe(false);
      expect(llama3.toolCallReliability).toBe("none");

      const ds = getModelCapabilities("deepseek-coder");
      expect(ds.supportsTools).toBe(false);
      expect(ds.toolCallReliability).toBe("none");
    });
  });

  describe("preferredDualModelRole", () => {
    it("top-tier prefer architect", () => {
      expect(
        getModelCapabilities("gpt-5").preferredDualModelRole,
      ).toBe("architect");
      expect(
        getModelCapabilities("gpt-4.1").preferredDualModelRole,
      ).toBe("architect");
      expect(
        getModelCapabilities("claude-opus-4-7").preferredDualModelRole,
      ).toBe("architect");
      expect(getModelCapabilities("o3").preferredDualModelRole).toBe(
        "architect",
      );
    });

    it("mini / nano / coder / small-local prefer editor", () => {
      expect(
        getModelCapabilities("gpt-5-mini").preferredDualModelRole,
      ).toBe("editor");
      expect(
        getModelCapabilities("gpt-5-nano").preferredDualModelRole,
      ).toBe("editor");
      expect(
        getModelCapabilities("gpt-5.1-codex").preferredDualModelRole,
      ).toBe("editor");
      expect(
        getModelCapabilities("claude-haiku-4-5").preferredDualModelRole,
      ).toBe("editor");
      expect(
        getModelCapabilities("o3-mini").preferredDualModelRole,
      ).toBe("editor");
      expect(
        getModelCapabilities("qwen2.5-coder-32b").preferredDualModelRole,
      ).toBe("editor");
      expect(getModelCapabilities("llama3.1:8b").preferredDualModelRole).toBe(
        "editor",
      );
    });

    it("others fall back to either", () => {
      expect(
        getModelCapabilities("minimax").preferredDualModelRole,
      ).toBe("either");
      expect(
        getModelCapabilities("mistral-large").preferredDualModelRole,
      ).toBe("either");
      expect(
        getModelCapabilities("gpt-4o").preferredDualModelRole,
      ).toBe("either");
    });
  });
});
