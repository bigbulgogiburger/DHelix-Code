import { describe, it, expect } from "vitest";
import { configSchema, llmConfigSchema } from "../../../src/config/schema.js";

describe("configSchema", () => {
  it("should parse valid full config", () => {
    const result = configSchema.safeParse({
      llm: {
        baseUrl: "http://localhost:11434/v1",
        model: "llama3.1",
        temperature: 0.5,
        maxTokens: 2048,
        contextWindow: 64000,
        timeout: 30000,
      },
      permissionMode: "default",
      verbose: true,
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.llm.model).toBe("llama3.1");
      expect(result.data.verbose).toBe(true);
    }
  });

  it("should use defaults for missing fields", () => {
    const result = configSchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.llm.model).toBe("llama3.1");
      expect(result.data.llm.temperature).toBe(0.0);
      expect(result.data.permissionMode).toBe("default");
      expect(result.data.verbose).toBe(false);
    }
  });

  it("should reject invalid temperature", () => {
    const result = configSchema.safeParse({
      llm: { temperature: 3.0 },
    });
    expect(result.success).toBe(false);
  });

  it("should reject invalid permission mode", () => {
    const result = configSchema.safeParse({
      permissionMode: "invalid",
    });
    expect(result.success).toBe(false);
  });
});

describe("llmConfigSchema", () => {
  it("should parse valid LLM config", () => {
    const result = llmConfigSchema.safeParse({
      baseUrl: "https://api.example.com/v1",
      apiKey: "test-key",
      model: "gpt-4",
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.apiKey).toBe("test-key");
      expect(result.data.model).toBe("gpt-4");
    }
  });

  it("should reject invalid URL", () => {
    const result = llmConfigSchema.safeParse({
      baseUrl: "not-a-url",
    });
    expect(result.success).toBe(false);
  });
});
