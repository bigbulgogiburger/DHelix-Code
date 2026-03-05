import { describe, it, expect, vi } from "vitest";
import { ModelRouter, type ModelRouterConfig } from "../../../src/llm/model-router.js";
import { type LLMProvider } from "../../../src/llm/provider.js";
import { LLMError } from "../../../src/utils/error.js";

function mockProvider(name: string, shouldFail?: string): LLMProvider {
  return {
    name,
    chat: vi.fn(async () => {
      if (shouldFail) throw new Error(shouldFail);
      return {
        content: `Response from ${name}`,
        toolCalls: [],
        usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
      };
    }),
    stream: vi.fn(async function* () {
      if (shouldFail) throw new Error(shouldFail);
      yield { type: "text-delta" as const, text: "chunk" };
    }),
    countTokens: vi.fn(() => 10),
  };
}

describe("ModelRouter", () => {
  it("should route to primary by default", async () => {
    const primary = mockProvider("primary");
    const router = new ModelRouter({
      primary,
      primaryModel: "gpt-4",
    });

    expect(router.activeModel).toBe("gpt-4");
    expect(router.isUsingFallback).toBe(false);

    await router.chat({
      model: "gpt-4",
      messages: [{ role: "user", content: "test" }],
      tools: [],
      temperature: 0,
      maxTokens: 100,
    });

    expect(primary.chat).toHaveBeenCalled();
  });

  it("should switch to fallback on overload", async () => {
    const primary = mockProvider("primary", "429 rate limit exceeded");
    const fallback = mockProvider("fallback");

    const router = new ModelRouter({
      primary,
      primaryModel: "gpt-4",
      fallback,
      fallbackModel: "gpt-3.5-turbo",
      maxRetries: 0,
    });

    const response = await router.chat({
      model: "gpt-4",
      messages: [{ role: "user", content: "test" }],
      tools: [],
      temperature: 0,
      maxTokens: 100,
    });

    expect(response.content).toContain("fallback");
    expect(router.isUsingFallback).toBe(true);
  });

  it("should throw on permanent error without fallback", async () => {
    const primary = mockProvider("primary", "invalid model");
    const router = new ModelRouter({
      primary,
      primaryModel: "gpt-4",
      maxRetries: 0,
    });

    await expect(
      router.chat({
        model: "gpt-4",
        messages: [{ role: "user", content: "test" }],
        tools: [],
        temperature: 0,
        maxTokens: 100,
      }),
    ).rejects.toThrow();
  });

  it("should reset to primary", () => {
    const primary = mockProvider("primary");
    const fallback = mockProvider("fallback");
    const router = new ModelRouter({
      primary,
      primaryModel: "gpt-4",
      fallback,
      fallbackModel: "gpt-3.5",
    });

    router.switchToFallback();
    expect(router.isUsingFallback).toBe(true);
    expect(router.activeModel).toBe("gpt-3.5");

    router.resetToPrimary();
    expect(router.isUsingFallback).toBe(false);
    expect(router.activeModel).toBe("gpt-4");
  });

  it("should throw when switching to fallback without one", () => {
    const router = new ModelRouter({
      primary: mockProvider("primary"),
      primaryModel: "gpt-4",
    });

    expect(() => router.switchToFallback()).toThrow("No fallback model configured");
  });

  it("should count tokens using active provider", () => {
    const primary = mockProvider("primary");
    const router = new ModelRouter({
      primary,
      primaryModel: "gpt-4",
    });

    router.countTokens("hello world");
    expect(primary.countTokens).toHaveBeenCalledWith("hello world");
  });
});
