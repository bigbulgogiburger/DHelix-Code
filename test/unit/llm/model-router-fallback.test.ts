import { describe, it, expect, vi } from "vitest";
import { ModelRouter, type StreamFallbackWarning } from "../../../src/llm/model-router.js";
import { type LLMProvider, type ChatChunk, type ChatRequest } from "../../../src/llm/provider.js";

/** 기본 테스트 요청 */
const baseRequest: ChatRequest = {
  model: "gpt-4",
  messages: [{ role: "user", content: "test" }],
  tools: [],
  temperature: 0,
  maxTokens: 100,
};

/** 정상 동작하는 프로바이더 생성 */
function createSuccessProvider(name: string, chunks: readonly ChatChunk[]): LLMProvider {
  return {
    name,
    chat: vi.fn(async () => ({
      content: chunks
        .filter((c) => c.type === "text-delta")
        .map((c) => c.text ?? "")
        .join(""),
      toolCalls: [],
      usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
      finishReason: "stop",
    })),
    stream: vi.fn(async function* () {
      for (const chunk of chunks) {
        yield chunk;
      }
    }),
    countTokens: vi.fn(() => 10),
  };
}

/**
 * 스트리밍 도중 에러를 발생시키는 프로바이더 생성
 * partialChunks를 먼저 yield한 후 에러를 throw
 */
function createMidStreamErrorProvider(
  name: string,
  partialChunks: readonly ChatChunk[],
  error: Error,
): LLMProvider {
  return {
    name,
    chat: vi.fn(async () => {
      throw error;
    }),
    stream: vi.fn(async function* () {
      for (const chunk of partialChunks) {
        yield chunk;
      }
      throw error;
    }),
    countTokens: vi.fn(() => 10),
  };
}

describe("ModelRouter mid-stream fallback", () => {
  it("should preserve partial stream content when falling back", async () => {
    const partialChunks: ChatChunk[] = [
      { type: "text-delta", text: "Hello " },
      { type: "text-delta", text: "wor" },
    ];
    const primary = createMidStreamErrorProvider(
      "primary",
      partialChunks,
      new Error("500 server error"),
    );

    const fallbackChunks: ChatChunk[] = [
      { type: "text-delta", text: "continued response" },
      {
        type: "done",
        finishReason: "stop",
        usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
      },
    ];
    const fallback = createSuccessProvider("fallback", fallbackChunks);

    const warnings: StreamFallbackWarning[] = [];
    const router = new ModelRouter({
      primary,
      primaryModel: "gpt-4",
      fallback,
      fallbackModel: "gpt-3.5-turbo",
      onStreamFallback: (w) => {
        warnings.push(w);
      },
    });

    const collected: ChatChunk[] = [];
    for await (const chunk of router.stream(baseRequest)) {
      collected.push(chunk);
    }

    // Should have received partial chunks from primary + fallback chunks
    expect(collected).toHaveLength(4);
    expect(collected[0]).toEqual({ type: "text-delta", text: "Hello " });
    expect(collected[1]).toEqual({ type: "text-delta", text: "wor" });
    expect(collected[2]).toEqual({ type: "text-delta", text: "continued response" });

    // Warning callback should have been called with partial text
    expect(warnings).toHaveLength(1);
    expect(warnings[0].fromModel).toBe("gpt-4");
    expect(warnings[0].toModel).toBe("gpt-3.5-turbo");
    expect(warnings[0].partialText).toBe("Hello wor");

    // Fallback should have received the partial text as assistant message
    expect(fallback.stream).toHaveBeenCalledTimes(1);
    const fallbackCall = vi.mocked(fallback.stream).mock.calls[0][0];
    const lastMessage = fallbackCall.messages[fallbackCall.messages.length - 1];
    expect(lastMessage.role).toBe("assistant");
    expect(lastMessage.content).toBe("Hello wor");
  });

  it("should stream normally without errors", async () => {
    const chunks: ChatChunk[] = [
      { type: "text-delta", text: "Hello" },
      { type: "text-delta", text: " world" },
      {
        type: "done",
        finishReason: "stop",
        usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
      },
    ];
    const primary = createSuccessProvider("primary", chunks);

    const router = new ModelRouter({
      primary,
      primaryModel: "gpt-4",
    });

    const collected: string[] = [];
    for await (const chunk of router.stream(baseRequest)) {
      if (chunk.type === "text-delta" && chunk.text) {
        collected.push(chunk.text);
      }
    }

    expect(collected).toEqual(["Hello", " world"]);
    expect(router.isUsingFallback).toBe(false);
  });

  it("should skip fallback when no fallback is configured", async () => {
    const primary = createMidStreamErrorProvider(
      "primary",
      [{ type: "text-delta", text: "partial" }],
      new Error("500 server error"),
    );

    const router = new ModelRouter({
      primary,
      primaryModel: "gpt-4",
    });

    const streamIt = async () => {
      const chunks: ChatChunk[] = [];
      for await (const chunk of router.stream(baseRequest)) {
        chunks.push(chunk);
      }
      return chunks;
    };

    await expect(streamIt()).rejects.toThrow("500 server error");
  });

  it("should fallback without partial text when error occurs before any chunks", async () => {
    const primary = createMidStreamErrorProvider("primary", [], new Error("503 overloaded"));

    const fallbackChunks: ChatChunk[] = [
      { type: "text-delta", text: "full fallback response" },
      {
        type: "done",
        finishReason: "stop",
        usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
      },
    ];
    const fallback = createSuccessProvider("fallback", fallbackChunks);

    const warnings: StreamFallbackWarning[] = [];
    const router = new ModelRouter({
      primary,
      primaryModel: "gpt-4",
      fallback,
      fallbackModel: "gpt-3.5-turbo",
      onStreamFallback: (w) => {
        warnings.push(w);
      },
    });

    const collected: ChatChunk[] = [];
    for await (const chunk of router.stream(baseRequest)) {
      collected.push(chunk);
    }

    expect(collected).toHaveLength(2);
    expect(collected[0]).toEqual({ type: "text-delta", text: "full fallback response" });

    // Warning should report empty partial text
    expect(warnings[0].partialText).toBe("");

    // Fallback request should NOT have extra assistant message when no partial text
    const fallbackCall = vi.mocked(fallback.stream).mock.calls[0][0];
    expect(fallbackCall.messages).toHaveLength(1);
    expect(fallbackCall.messages[0].role).toBe("user");
  });

  it("should not fallback on auth errors even with fallback configured", async () => {
    const primary = createMidStreamErrorProvider(
      "primary",
      [{ type: "text-delta", text: "partial" }],
      new Error("401 unauthorized"),
    );

    const fallback = createSuccessProvider("fallback", [
      { type: "text-delta", text: "should not reach" },
    ]);

    const router = new ModelRouter({
      primary,
      primaryModel: "gpt-4",
      fallback,
      fallbackModel: "gpt-3.5-turbo",
    });

    const streamIt = async () => {
      const chunks: ChatChunk[] = [];
      for await (const chunk of router.stream(baseRequest)) {
        chunks.push(chunk);
      }
      return chunks;
    };

    await expect(streamIt()).rejects.toThrow("401 unauthorized");
    expect(fallback.stream).not.toHaveBeenCalled();
  });

  it("should call onStreamFallback callback when provided", async () => {
    const primaryError = new Error("429 rate limit exceeded");
    const primary = createMidStreamErrorProvider(
      "primary",
      [
        { type: "text-delta", text: "half" },
        { type: "text-delta", text: "-done" },
      ],
      primaryError,
    );

    const fallback = createSuccessProvider("fallback", [{ type: "text-delta", text: "rest" }]);

    const onStreamFallback = vi.fn();
    const router = new ModelRouter({
      primary,
      primaryModel: "gpt-4",
      fallback,
      fallbackModel: "claude-sonnet",
      onStreamFallback,
    });

    const chunks: ChatChunk[] = [];
    for await (const chunk of router.stream(baseRequest)) {
      chunks.push(chunk);
    }

    expect(onStreamFallback).toHaveBeenCalledOnce();
    expect(onStreamFallback).toHaveBeenCalledWith({
      fromModel: "gpt-4",
      toModel: "claude-sonnet",
      partialText: "half-done",
      error: primaryError,
    });

    // Verify router switched to fallback
    expect(router.isUsingFallback).toBe(true);
  });
});
