import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createEventEmitter } from "../../../../src/utils/events.js";

// Store original env
const originalEnv = { ...process.env };

// Mock fetch
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

function createMockResponse(data: unknown, ok = true, status = 200): Response {
  return {
    ok,
    status,
    json: () => Promise.resolve(data),
    text: () => Promise.resolve(JSON.stringify(data)),
    body: null,
    headers: new Headers(),
  } as unknown as Response;
}

function createSSEStream(
  events: Array<{ event: string; data: unknown }>,
): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  let index = 0;

  return new ReadableStream<Uint8Array>({
    pull(controller) {
      if (index >= events.length) {
        controller.close();
        return;
      }
      const { event, data } = events[index++];
      const chunk = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
      controller.enqueue(encoder.encode(chunk));
    },
  });
}

function createStreamResponse(events: Array<{ event: string; data: unknown }>): Response {
  return {
    ok: true,
    status: 200,
    body: createSSEStream(events),
    headers: new Headers(),
  } as unknown as Response;
}

describe("AnthropicProvider", () => {
  beforeEach(() => {
    vi.resetModules();
    mockFetch.mockReset();
    process.env.ANTHROPIC_API_KEY = "test-key-123";
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  async function getProvider(config?: Record<string, unknown>) {
    const mod = await import("../../../../src/llm/providers/anthropic.js");
    return new mod.AnthropicProvider(config ?? {});
  }

  describe("constructor", () => {
    it("should throw if no API key is provided", async () => {
      delete process.env.ANTHROPIC_API_KEY;
      await expect(getProvider()).rejects.toThrow("ANTHROPIC_API_KEY");
    });

    it("should accept API key from config", async () => {
      delete process.env.ANTHROPIC_API_KEY;
      const provider = await getProvider({ apiKey: "custom-key" });
      expect(provider.name).toBe("anthropic");
    });

    it("should use environment variable API key", async () => {
      const provider = await getProvider();
      expect(provider.name).toBe("anthropic");
    });
  });

  describe("chat", () => {
    it("should make a basic chat request", async () => {
      const provider = await getProvider();
      mockFetch.mockResolvedValueOnce(
        createMockResponse({
          id: "msg_123",
          type: "message",
          role: "assistant",
          content: [{ type: "text", text: "Hello!" }],
          stop_reason: "end_turn",
          usage: { input_tokens: 10, output_tokens: 5 },
        }),
      );

      const result = await provider.chat({
        model: "claude-sonnet-4-20250514",
        messages: [{ role: "user", content: "Hi" }],
      });

      expect(result.content).toBe("Hello!");
      expect(result.finishReason).toBe("stop");
      expect(result.usage.promptTokens).toBe(10);
      expect(result.usage.completionTokens).toBe(5);
      expect(result.usage.totalTokens).toBe(15);
    });

    it("should extract system messages into system parameter", async () => {
      const provider = await getProvider();
      mockFetch.mockResolvedValueOnce(
        createMockResponse({
          id: "msg_123",
          type: "message",
          role: "assistant",
          content: [{ type: "text", text: "OK" }],
          stop_reason: "end_turn",
          usage: { input_tokens: 20, output_tokens: 3 },
        }),
      );

      await provider.chat({
        model: "claude-sonnet-4-20250514",
        messages: [
          { role: "system", content: "You are helpful." },
          { role: "user", content: "Hi" },
        ],
      });

      const fetchCall = mockFetch.mock.calls[0];
      const body = JSON.parse(fetchCall[1].body as string);
      // System is now an array of cachable blocks
      expect(Array.isArray(body.system)).toBe(true);
      expect(body.system[0].text).toBe("You are helpful.");
      expect(body.messages).toHaveLength(1);
      expect(body.messages[0].role).toBe("user");
    });

    it("should convert tool_calls to Anthropic tool_use format", async () => {
      const provider = await getProvider();
      mockFetch.mockResolvedValueOnce(
        createMockResponse({
          id: "msg_123",
          type: "message",
          role: "assistant",
          content: [
            { type: "text", text: "Let me check." },
            { type: "tool_use", id: "tc_1", name: "file_read", input: { path: "/test.ts" } },
          ],
          stop_reason: "tool_use",
          usage: { input_tokens: 30, output_tokens: 20 },
        }),
      );

      const result = await provider.chat({
        model: "claude-sonnet-4-20250514",
        messages: [{ role: "user", content: "Read the file" }],
        tools: [
          {
            type: "function",
            function: {
              name: "file_read",
              description: "Read a file",
              parameters: { type: "object", properties: { path: { type: "string" } } },
            },
          },
        ],
      });

      expect(result.content).toBe("Let me check.");
      expect(result.toolCalls).toHaveLength(1);
      expect(result.toolCalls[0].id).toBe("tc_1");
      expect(result.toolCalls[0].name).toBe("file_read");
      expect(JSON.parse(result.toolCalls[0].arguments)).toEqual({ path: "/test.ts" });
      expect(result.finishReason).toBe("tool_calls");
    });

    it("should convert tool results from tool role to user role with tool_result", async () => {
      const provider = await getProvider();
      mockFetch.mockResolvedValueOnce(
        createMockResponse({
          id: "msg_124",
          type: "message",
          role: "assistant",
          content: [{ type: "text", text: "The file contains..." }],
          stop_reason: "end_turn",
          usage: { input_tokens: 50, output_tokens: 15 },
        }),
      );

      await provider.chat({
        model: "claude-sonnet-4-20250514",
        messages: [
          { role: "user", content: "Read the file" },
          {
            role: "assistant",
            content: "Let me check.",
            toolCalls: [{ id: "tc_1", name: "file_read", arguments: '{"path":"/test.ts"}' }],
          },
          { role: "tool", content: "file contents here", toolCallId: "tc_1" },
        ],
      });

      const fetchCall = mockFetch.mock.calls[0];
      const body = JSON.parse(fetchCall[1].body as string);

      // Tool result should be converted to user role
      const toolResultMsg = body.messages[2];
      expect(toolResultMsg.role).toBe("user");
      expect(toolResultMsg.content[0].type).toBe("tool_result");
      expect(toolResultMsg.content[0].tool_use_id).toBe("tc_1");
    });

    it("should include thinking config in request body", async () => {
      const provider = await getProvider();
      mockFetch.mockResolvedValueOnce(
        createMockResponse({
          id: "msg_125",
          type: "message",
          role: "assistant",
          content: [
            { type: "thinking", thinking: "Let me think about this..." },
            { type: "text", text: "The answer is 42." },
          ],
          stop_reason: "end_turn",
          usage: { input_tokens: 10, output_tokens: 50 },
        }),
      );

      const result = await provider.chat({
        model: "claude-sonnet-4-20250514",
        messages: [{ role: "user", content: "What is the meaning of life?" }],
        thinking: { type: "enabled", budget_tokens: 10000 },
      });

      // Verify thinking was sent in request
      const fetchCall = mockFetch.mock.calls[0];
      const body = JSON.parse(fetchCall[1].body as string);
      expect(body.thinking).toEqual({ type: "enabled", budget_tokens: 10000 });

      // Verify thinking was parsed from response
      expect(result.thinking).toBe("Let me think about this...");
      expect(result.content).toBe("The answer is 42.");
    });

    it("should not include thinking in response when no thinking blocks", async () => {
      const provider = await getProvider();
      mockFetch.mockResolvedValueOnce(
        createMockResponse({
          id: "msg_126",
          type: "message",
          role: "assistant",
          content: [{ type: "text", text: "Simple answer." }],
          stop_reason: "end_turn",
          usage: { input_tokens: 5, output_tokens: 3 },
        }),
      );

      const result = await provider.chat({
        model: "claude-sonnet-4-20250514",
        messages: [{ role: "user", content: "Hi" }],
      });

      expect(result.thinking).toBeUndefined();
    });

    it("should handle authentication errors without retrying", async () => {
      const provider = await getProvider();
      let callCount = 0;
      mockFetch.mockImplementation(() => {
        callCount++;
        return Promise.resolve(
          createMockResponse({ error: { message: "Invalid API key" } }, false, 401),
        );
      });

      await expect(
        provider.chat({
          model: "claude-sonnet-4-20250514",
          messages: [{ role: "user", content: "Hi" }],
        }),
      ).rejects.toThrow("Authentication failed");

      // Auth errors should not retry
      expect(callCount).toBe(1);
    });
  });

  describe("stream", () => {
    it("should stream text deltas", async () => {
      const provider = await getProvider();
      mockFetch.mockResolvedValueOnce(
        createStreamResponse([
          {
            event: "message_start",
            data: {
              type: "message_start",
              message: {
                id: "msg_1",
                type: "message",
                role: "assistant",
                content: [],
                stop_reason: null,
                usage: { input_tokens: 10, output_tokens: 0 },
              },
            },
          },
          {
            event: "content_block_start",
            data: {
              type: "content_block_start",
              index: 0,
              content_block: { type: "text", text: "" },
            },
          },
          {
            event: "content_block_delta",
            data: {
              type: "content_block_delta",
              index: 0,
              delta: { type: "text_delta", text: "Hello " },
            },
          },
          {
            event: "content_block_delta",
            data: {
              type: "content_block_delta",
              index: 0,
              delta: { type: "text_delta", text: "world!" },
            },
          },
          {
            event: "content_block_stop",
            data: { type: "content_block_stop", index: 0 },
          },
          {
            event: "message_delta",
            data: {
              type: "message_delta",
              delta: { stop_reason: "end_turn" },
              usage: { output_tokens: 5 },
            },
          },
          {
            event: "message_stop",
            data: { type: "message_stop" },
          },
        ]),
      );

      const chunks: Array<{ type: string; text?: string }> = [];
      for await (const chunk of provider.stream({
        model: "claude-sonnet-4-20250514",
        messages: [{ role: "user", content: "Hi" }],
      })) {
        chunks.push(chunk);
      }

      const textChunks = chunks.filter((c) => c.type === "text-delta");
      expect(textChunks).toHaveLength(2);
      expect(textChunks[0].text).toBe("Hello ");
      expect(textChunks[1].text).toBe("world!");

      const doneChunk = chunks.find((c) => c.type === "done");
      expect(doneChunk).toBeDefined();
      expect(doneChunk!.usage?.promptTokens).toBe(10);
    });

    it("should stream thinking deltas", async () => {
      const provider = await getProvider();
      mockFetch.mockResolvedValueOnce(
        createStreamResponse([
          {
            event: "message_start",
            data: {
              type: "message_start",
              message: {
                id: "msg_2",
                type: "message",
                role: "assistant",
                content: [],
                stop_reason: null,
                usage: { input_tokens: 15, output_tokens: 0 },
              },
            },
          },
          {
            event: "content_block_start",
            data: {
              type: "content_block_start",
              index: 0,
              content_block: { type: "thinking", thinking: "" },
            },
          },
          {
            event: "content_block_delta",
            data: {
              type: "content_block_delta",
              index: 0,
              delta: { type: "thinking_delta", thinking: "Let me " },
            },
          },
          {
            event: "content_block_delta",
            data: {
              type: "content_block_delta",
              index: 0,
              delta: { type: "thinking_delta", thinking: "think..." },
            },
          },
          {
            event: "content_block_stop",
            data: { type: "content_block_stop", index: 0 },
          },
          {
            event: "content_block_start",
            data: {
              type: "content_block_start",
              index: 1,
              content_block: { type: "text", text: "" },
            },
          },
          {
            event: "content_block_delta",
            data: {
              type: "content_block_delta",
              index: 1,
              delta: { type: "text_delta", text: "The answer is 42." },
            },
          },
          {
            event: "content_block_stop",
            data: { type: "content_block_stop", index: 1 },
          },
          {
            event: "message_delta",
            data: {
              type: "message_delta",
              delta: { stop_reason: "end_turn" },
              usage: { output_tokens: 30 },
            },
          },
          {
            event: "message_stop",
            data: { type: "message_stop" },
          },
        ]),
      );

      const chunks: Array<{ type: string; text?: string; thinking_delta?: string }> = [];
      for await (const chunk of provider.stream({
        model: "claude-sonnet-4-20250514",
        messages: [{ role: "user", content: "Think about this" }],
        thinking: { type: "enabled", budget_tokens: 10000 },
      })) {
        chunks.push(chunk);
      }

      const thinkingChunks = chunks.filter((c) => c.type === "thinking-delta");
      expect(thinkingChunks).toHaveLength(2);
      expect(thinkingChunks[0].thinking_delta).toBe("Let me ");
      expect(thinkingChunks[1].thinking_delta).toBe("think...");

      const textChunks = chunks.filter((c) => c.type === "text-delta");
      expect(textChunks).toHaveLength(1);
      expect(textChunks[0].text).toBe("The answer is 42.");

      // Verify thinking was included in the request
      const fetchCall = mockFetch.mock.calls[0];
      const body = JSON.parse(fetchCall[1].body as string);
      expect(body.thinking).toEqual({ type: "enabled", budget_tokens: 10000 });
      expect(body.stream).toBe(true);
    });

    it("should stream tool_use blocks", async () => {
      const provider = await getProvider();
      mockFetch.mockResolvedValueOnce(
        createStreamResponse([
          {
            event: "message_start",
            data: {
              type: "message_start",
              message: {
                id: "msg_3",
                type: "message",
                role: "assistant",
                content: [],
                stop_reason: null,
                usage: { input_tokens: 20, output_tokens: 0 },
              },
            },
          },
          {
            event: "content_block_start",
            data: {
              type: "content_block_start",
              index: 0,
              content_block: { type: "tool_use", id: "tc_1", name: "file_read", input: {} },
            },
          },
          {
            event: "content_block_delta",
            data: {
              type: "content_block_delta",
              index: 0,
              delta: { type: "input_json_delta", partial_json: '{"path":' },
            },
          },
          {
            event: "content_block_delta",
            data: {
              type: "content_block_delta",
              index: 0,
              delta: { type: "input_json_delta", partial_json: '"/test.ts"}' },
            },
          },
          {
            event: "content_block_stop",
            data: { type: "content_block_stop", index: 0 },
          },
          {
            event: "message_delta",
            data: {
              type: "message_delta",
              delta: { stop_reason: "tool_use" },
              usage: { output_tokens: 10 },
            },
          },
          {
            event: "message_stop",
            data: { type: "message_stop" },
          },
        ]),
      );

      const chunks: Array<{ type: string; toolCall?: unknown }> = [];
      for await (const chunk of provider.stream({
        model: "claude-sonnet-4-20250514",
        messages: [{ role: "user", content: "Read file" }],
      })) {
        chunks.push(chunk);
      }

      const toolChunks = chunks.filter((c) => c.type === "tool-call-delta");
      expect(toolChunks.length).toBeGreaterThanOrEqual(2);
    });

    it("should handle stream errors", async () => {
      const provider = await getProvider();
      mockFetch.mockResolvedValueOnce(
        createMockResponse({ error: { message: "Server error" } }, false, 500),
      );

      // After retries exhausted, it should throw
      await expect(async () => {
        for await (const _chunk of provider.stream({
          model: "claude-sonnet-4-20250514",
          messages: [{ role: "user", content: "Hi" }],
        })) {
          // consume
        }
      }).rejects.toThrow();
    }, 30_000);
  });

  describe("countTokens", () => {
    it("should estimate tokens based on character count", async () => {
      const provider = await getProvider();
      const count = provider.countTokens("Hello, world!");
      expect(count).toBeGreaterThan(0);
      // ~4 chars per token, "Hello, world!" is 13 chars => ceil(13/4) = 4
      expect(count).toBe(4);
    });
  });

  describe("prompt caching", () => {
    it("should send anthropic-beta header for caching", async () => {
      const provider = await getProvider();
      mockFetch.mockResolvedValueOnce(
        createMockResponse({
          id: "msg_cache",
          type: "message",
          role: "assistant",
          content: [{ type: "text", text: "OK" }],
          stop_reason: "end_turn",
          usage: { input_tokens: 5, output_tokens: 1 },
        }),
      );

      await provider.chat({
        model: "claude-sonnet-4-20250514",
        messages: [{ role: "user", content: "Hi" }],
      });

      const fetchCall = mockFetch.mock.calls[0];
      const headers = fetchCall[1].headers;
      expect(headers["anthropic-beta"]).toBe("prompt-caching-2024-07-31");
    });

    it("should split system prompt into cachable blocks", async () => {
      const provider = await getProvider();
      mockFetch.mockResolvedValueOnce(
        createMockResponse({
          id: "msg_cache2",
          type: "message",
          role: "assistant",
          content: [{ type: "text", text: "OK" }],
          stop_reason: "end_turn",
          usage: { input_tokens: 20, output_tokens: 2 },
        }),
      );

      const systemPrompt = "# System\n\nIdentity section\n\n---\n\n# Environment\n\nDynamic stuff\n\n---\n\n# Code quality\n\nStatic section";
      await provider.chat({
        model: "claude-sonnet-4-20250514",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: "Hi" },
        ],
      });

      const fetchCall = mockFetch.mock.calls[0];
      const body = JSON.parse(fetchCall[1].body as string);

      // system should be an array of blocks, not a string
      expect(Array.isArray(body.system)).toBe(true);
      expect(body.system.length).toBeGreaterThan(1);

      // Environment block should NOT have cache_control
      const envBlock = body.system.find((b: Record<string, unknown>) =>
        (b.text as string).includes("# Environment"),
      );
      expect(envBlock).toBeDefined();
      expect(envBlock.cache_control).toBeUndefined();

      // Static blocks should have cache_control
      const cachedBlocks = body.system.filter(
        (b: Record<string, unknown>) => b.cache_control !== undefined,
      );
      expect(cachedBlocks.length).toBeGreaterThan(0);
    });

    it("should cache single-block system prompt", async () => {
      const provider = await getProvider();
      mockFetch.mockResolvedValueOnce(
        createMockResponse({
          id: "msg_cache3",
          type: "message",
          role: "assistant",
          content: [{ type: "text", text: "OK" }],
          stop_reason: "end_turn",
          usage: { input_tokens: 10, output_tokens: 1 },
        }),
      );

      await provider.chat({
        model: "claude-sonnet-4-20250514",
        messages: [
          { role: "system", content: "Simple system prompt without separators" },
          { role: "user", content: "Hi" },
        ],
      });

      const fetchCall = mockFetch.mock.calls[0];
      const body = JSON.parse(fetchCall[1].body as string);

      expect(Array.isArray(body.system)).toBe(true);
      expect(body.system).toHaveLength(1);
      expect(body.system[0].cache_control).toEqual({ type: "ephemeral" });
    });
  });

  describe("cache stats emission", () => {
    it("should emit llm:cache-stats event when cache tokens are present in chat response", async () => {
      const emitter = createEventEmitter();
      const cacheStatsHandler = vi.fn();
      emitter.on("llm:cache-stats", cacheStatsHandler);

      const mod = await import("../../../../src/llm/providers/anthropic.js");
      const provider = new mod.AnthropicProvider({ apiKey: "test-key-123", eventEmitter: emitter });

      mockFetch.mockResolvedValueOnce(
        createMockResponse({
          id: "msg_cache_stats",
          type: "message",
          role: "assistant",
          content: [{ type: "text", text: "OK" }],
          stop_reason: "end_turn",
          usage: {
            input_tokens: 100,
            output_tokens: 5,
            cache_creation_input_tokens: 2000,
            cache_read_input_tokens: 500,
          },
        }),
      );

      await provider.chat({
        model: "claude-sonnet-4-20250514",
        messages: [{ role: "user", content: "Hi" }],
      });

      expect(cacheStatsHandler).toHaveBeenCalledTimes(1);
      expect(cacheStatsHandler).toHaveBeenCalledWith({
        cacheCreationInputTokens: 2000,
        cacheReadInputTokens: 500,
        model: "claude-sonnet-4-20250514",
      });
    });

    it("should not emit llm:cache-stats when no cache tokens in response", async () => {
      const emitter = createEventEmitter();
      const cacheStatsHandler = vi.fn();
      emitter.on("llm:cache-stats", cacheStatsHandler);

      const mod = await import("../../../../src/llm/providers/anthropic.js");
      const provider = new mod.AnthropicProvider({ apiKey: "test-key-123", eventEmitter: emitter });

      mockFetch.mockResolvedValueOnce(
        createMockResponse({
          id: "msg_no_cache",
          type: "message",
          role: "assistant",
          content: [{ type: "text", text: "OK" }],
          stop_reason: "end_turn",
          usage: { input_tokens: 10, output_tokens: 5 },
        }),
      );

      await provider.chat({
        model: "claude-sonnet-4-20250514",
        messages: [{ role: "user", content: "Hi" }],
      });

      expect(cacheStatsHandler).not.toHaveBeenCalled();
    });

    it("should emit llm:cache-stats during streaming from message_start", async () => {
      const emitter = createEventEmitter();
      const cacheStatsHandler = vi.fn();
      emitter.on("llm:cache-stats", cacheStatsHandler);

      const mod = await import("../../../../src/llm/providers/anthropic.js");
      const provider = new mod.AnthropicProvider({ apiKey: "test-key-123", eventEmitter: emitter });

      mockFetch.mockResolvedValueOnce(
        createStreamResponse([
          {
            event: "message_start",
            data: {
              type: "message_start",
              message: {
                id: "msg_stream_cache",
                type: "message",
                role: "assistant",
                content: [],
                stop_reason: null,
                usage: {
                  input_tokens: 100,
                  output_tokens: 0,
                  cache_creation_input_tokens: 1500,
                  cache_read_input_tokens: 300,
                },
              },
            },
          },
          {
            event: "content_block_start",
            data: {
              type: "content_block_start",
              index: 0,
              content_block: { type: "text", text: "" },
            },
          },
          {
            event: "content_block_delta",
            data: {
              type: "content_block_delta",
              index: 0,
              delta: { type: "text_delta", text: "Hello" },
            },
          },
          {
            event: "content_block_stop",
            data: { type: "content_block_stop", index: 0 },
          },
          {
            event: "message_delta",
            data: {
              type: "message_delta",
              delta: { stop_reason: "end_turn" },
              usage: { output_tokens: 2 },
            },
          },
          {
            event: "message_stop",
            data: { type: "message_stop" },
          },
        ]),
      );

      const chunks = [];
      for await (const chunk of provider.stream({
        model: "claude-sonnet-4-20250514",
        messages: [{ role: "user", content: "Hi" }],
      })) {
        chunks.push(chunk);
      }

      expect(cacheStatsHandler).toHaveBeenCalledTimes(1);
      expect(cacheStatsHandler).toHaveBeenCalledWith({
        cacheCreationInputTokens: 1500,
        cacheReadInputTokens: 300,
        model: "claude-sonnet-4-20250514",
      });
    });

    it("should work without event emitter (no error thrown)", async () => {
      const provider = await getProvider();
      mockFetch.mockResolvedValueOnce(
        createMockResponse({
          id: "msg_no_emitter",
          type: "message",
          role: "assistant",
          content: [{ type: "text", text: "OK" }],
          stop_reason: "end_turn",
          usage: {
            input_tokens: 10,
            output_tokens: 5,
            cache_creation_input_tokens: 100,
            cache_read_input_tokens: 50,
          },
        }),
      );

      // Should not throw even with cache tokens but no emitter
      const result = await provider.chat({
        model: "claude-sonnet-4-20250514",
        messages: [{ role: "user", content: "Hi" }],
      });
      expect(result.content).toBe("OK");
    });
  });

  describe("message conversion", () => {
    it("should merge multiple system messages", async () => {
      const provider = await getProvider();
      mockFetch.mockResolvedValueOnce(
        createMockResponse({
          id: "msg_sys",
          type: "message",
          role: "assistant",
          content: [{ type: "text", text: "OK" }],
          stop_reason: "end_turn",
          usage: { input_tokens: 30, output_tokens: 2 },
        }),
      );

      await provider.chat({
        model: "claude-sonnet-4-20250514",
        messages: [
          { role: "system", content: "You are helpful." },
          { role: "system", content: "Be concise." },
          { role: "user", content: "Hi" },
        ],
      });

      const fetchCall = mockFetch.mock.calls[0];
      const body = JSON.parse(fetchCall[1].body as string);
      // System is now an array of cachable blocks
      expect(Array.isArray(body.system)).toBe(true);
      // Single block since no "---" separator in merged content
      expect(body.system[0].text).toBe("You are helpful.\n\nBe concise.");
    });

    it("should send correct headers", async () => {
      const provider = await getProvider();
      mockFetch.mockResolvedValueOnce(
        createMockResponse({
          id: "msg_hdr",
          type: "message",
          role: "assistant",
          content: [{ type: "text", text: "OK" }],
          stop_reason: "end_turn",
          usage: { input_tokens: 5, output_tokens: 1 },
        }),
      );

      await provider.chat({
        model: "claude-sonnet-4-20250514",
        messages: [{ role: "user", content: "Hi" }],
      });

      const fetchCall = mockFetch.mock.calls[0];
      const headers = fetchCall[1].headers;
      expect(headers["x-api-key"]).toBe("test-key-123");
      expect(headers["anthropic-version"]).toBe("2023-06-01");
      expect(headers["content-type"]).toBe("application/json");
      expect(headers["anthropic-beta"]).toBe("prompt-caching-2024-07-31");
    });
  });
});
