import { describe, it, expect, vi } from "vitest";
import { ModelRouter } from "../../../src/llm/model-router.js";
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

  it("should fallback after transient retries exhausted", async () => {
    const primary = mockProvider("primary", "500 internal server error");
    const fallback = mockProvider("fallback");

    const router = new ModelRouter({
      primary,
      primaryModel: "gpt-4",
      fallback,
      fallbackModel: "gpt-3.5-turbo",
      maxRetries: 1,
      retryDelayMs: 1, // fast retries for test
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
    // Primary should have been called maxRetries+1 times
    expect(primary.chat).toHaveBeenCalledTimes(2);
  });

  it("should throw combined error when both primary and fallback fail", async () => {
    const primary = mockProvider("primary", "timeout error");
    const fallback = mockProvider("fallback", "fallback also failed");

    const router = new ModelRouter({
      primary,
      primaryModel: "gpt-4",
      fallback,
      fallbackModel: "gpt-3.5-turbo",
      maxRetries: 0,
      retryDelayMs: 1,
    });

    await expect(
      router.chat({
        model: "gpt-4",
        messages: [{ role: "user", content: "test" }],
        tools: [],
        temperature: 0,
        maxTokens: 100,
      }),
    ).rejects.toThrow("Both primary and fallback models failed");
  });

  it("should throw LLMError after retries without fallback", async () => {
    const primary = mockProvider("primary", "502 bad gateway");

    const router = new ModelRouter({
      primary,
      primaryModel: "gpt-4",
      maxRetries: 1,
      retryDelayMs: 1,
    });

    await expect(
      router.chat({
        model: "gpt-4",
        messages: [{ role: "user", content: "test" }],
        tools: [],
        temperature: 0,
        maxTokens: 100,
      }),
    ).rejects.toThrow("LLM request failed after retries");
  });

  it("should not retry auth errors", async () => {
    const primary = mockProvider("primary", "401 unauthorized");

    const router = new ModelRouter({
      primary,
      primaryModel: "gpt-4",
      maxRetries: 3,
      retryDelayMs: 1,
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

    // Should only be called once — no retries for auth errors
    expect(primary.chat).toHaveBeenCalledTimes(1);
  });

  it("should stream from fallback on overload error", async () => {
    const primary = mockProvider("primary", "503 overloaded");
    const fallback: LLMProvider = {
      name: "fallback",
      chat: vi.fn(async () => ({
        content: "fallback",
        toolCalls: [],
        usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
      })),
      stream: vi.fn(async function* () {
        yield { type: "text-delta" as const, text: "fallback-chunk" };
        yield {
          type: "done" as const,
          usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
        };
      }),
      countTokens: vi.fn(() => 10),
    };

    const router = new ModelRouter({
      primary,
      primaryModel: "gpt-4",
      fallback,
      fallbackModel: "gpt-3.5-turbo",
    });

    const chunks: string[] = [];
    for await (const chunk of router.stream({
      model: "gpt-4",
      messages: [{ role: "user", content: "test" }],
      tools: [],
      temperature: 0,
      maxTokens: 100,
    })) {
      if (chunk.type === "text-delta") {
        chunks.push(chunk.text);
      }
    }

    expect(chunks).toContain("fallback-chunk");
    expect(router.isUsingFallback).toBe(true);
  });

  it("should rethrow stream error when no fallback available", async () => {
    const primary = mockProvider("primary", "403 forbidden");

    const router = new ModelRouter({
      primary,
      primaryModel: "gpt-4",
    });

    const streamIt = async () => {
      const chunks: unknown[] = [];
      for await (const chunk of router.stream({
        model: "gpt-4",
        messages: [{ role: "user", content: "test" }],
        tools: [],
        temperature: 0,
        maxTokens: 100,
      })) {
        chunks.push(chunk);
      }
      return chunks;
    };

    await expect(streamIt()).rejects.toThrow("403 forbidden");
  });

  it("should abort immediately if signal already aborted before retry sleep", async () => {
    const controller = new AbortController();
    controller.abort();

    const primary = mockProvider("primary", "500 server error");
    const router = new ModelRouter({
      primary,
      primaryModel: "gpt-4",
      maxRetries: 3,
      retryDelayMs: 1,
    });

    await expect(
      router.chat({
        model: "gpt-4",
        messages: [{ role: "user", content: "test" }],
        tools: [],
        temperature: 0,
        maxTokens: 100,
        signal: controller.signal,
      }),
    ).rejects.toThrow("Aborted");

    // Only the first attempt before abort
    expect(primary.chat).toHaveBeenCalledTimes(1);
  });

  it("should abort during retry sleep delay", async () => {
    const controller = new AbortController();
    let callCount = 0;

    const primary: LLMProvider = {
      name: "primary",
      chat: vi.fn(async () => {
        callCount++;
        if (callCount === 1) {
          setTimeout(() => controller.abort(), 10);
          throw new Error("500 server error");
        }
        return {
          content: "should not reach",
          toolCalls: [],
          usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
        };
      }),
      stream: vi.fn(async function* () {
        yield { type: "text-delta" as const, text: "x" };
      }),
      countTokens: vi.fn(() => 10),
    };

    const router = new ModelRouter({
      primary,
      primaryModel: "gpt-4",
      maxRetries: 3,
      retryDelayMs: 5000, // Long delay so abort fires during it
    });

    await expect(
      router.chat({
        model: "gpt-4",
        messages: [{ role: "user", content: "test" }],
        tools: [],
        temperature: 0,
        maxTokens: 100,
        signal: controller.signal,
      }),
    ).rejects.toThrow("Aborted");

    expect(callCount).toBe(1);
  });

  it("should re-throw LLMError directly when retries exhausted without fallback", async () => {
    const primary: LLMProvider = {
      name: "primary",
      chat: vi.fn(async () => {
        throw new LLMError("Custom LLM error");
      }),
      stream: vi.fn(async function* () {
        yield { type: "text-delta" as const, text: "x" };
      }),
      countTokens: vi.fn(() => 10),
    };

    const router = new ModelRouter({
      primary,
      primaryModel: "gpt-4",
      maxRetries: 0,
    });

    try {
      await router.chat({
        model: "gpt-4",
        messages: [{ role: "user", content: "test" }],
        tools: [],
        temperature: 0,
        maxTokens: 100,
      });
    } catch (error) {
      // Should be the original LLMError, not wrapped
      expect(error).toBeInstanceOf(LLMError);
      expect((error as LLMError).message).toBe("Custom LLM error");
    }
  });

  it("should stream successfully from primary", async () => {
    const primary: LLMProvider = {
      name: "primary",
      chat: vi.fn(async () => ({
        content: "ok",
        toolCalls: [],
        usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
      })),
      stream: vi.fn(async function* () {
        yield { type: "text-delta" as const, text: "hello" };
        yield { type: "text-delta" as const, text: " world" };
      }),
      countTokens: vi.fn(() => 10),
    };

    const router = new ModelRouter({
      primary,
      primaryModel: "gpt-4",
    });

    const chunks: string[] = [];
    for await (const chunk of router.stream({
      model: "gpt-4",
      messages: [{ role: "user", content: "test" }],
      tools: [],
      temperature: 0,
      maxTokens: 100,
    })) {
      if (chunk.type === "text-delta") {
        chunks.push(chunk.text);
      }
    }

    expect(chunks).toEqual(["hello", " world"]);
  });
});
