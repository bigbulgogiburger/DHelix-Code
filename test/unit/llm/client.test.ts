import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the OpenAI SDK before importing the client
const mockCreate = vi.fn();

vi.mock("openai", () => {
  class MockAPIError extends Error {
    status: number;
    headers: Record<string, string>;
    constructor(
      status: number,
      message: string,
      headers: Record<string, string> = {},
    ) {
      super(message);
      this.status = status;
      this.headers = headers;
      this.name = "APIError";
    }
  }

  class MockAuthenticationError extends MockAPIError {
    constructor(message: string) {
      super(401, message);
      this.name = "AuthenticationError";
    }
  }

  class MockPermissionDeniedError extends MockAPIError {
    constructor(message: string) {
      super(403, message);
      this.name = "PermissionDeniedError";
    }
  }

  class MockRateLimitError extends MockAPIError {
    constructor(message: string, headers: Record<string, string> = {}) {
      super(429, message, headers);
      this.name = "RateLimitError";
    }
  }

  class MockInternalServerError extends MockAPIError {
    constructor(message: string) {
      super(500, message);
      this.name = "InternalServerError";
    }
  }

  class MockAPIConnectionError extends Error {
    constructor(message: string) {
      super(message);
      this.name = "APIConnectionError";
    }
  }

  class MockAPIConnectionTimeoutError extends MockAPIConnectionError {
    constructor(message: string) {
      super(message);
      this.name = "APIConnectionTimeoutError";
    }
  }

  return {
    default: class MockOpenAI {
      static APIError = MockAPIError;
      static AuthenticationError = MockAuthenticationError;
      static PermissionDeniedError = MockPermissionDeniedError;
      static RateLimitError = MockRateLimitError;
      static InternalServerError = MockInternalServerError;
      static APIConnectionError = MockAPIConnectionError;
      static APIConnectionTimeoutError = MockAPIConnectionTimeoutError;
      chat = {
        completions: {
          create: mockCreate,
        },
      };
      constructor() {}
    },
  };
});

// Mock token-counter to avoid tiktoken dependency
vi.mock("../../../src/llm/token-counter.js", () => ({
  countTokens: (text: string) => Math.ceil(text.length / 4),
}));

import OpenAI from "openai";
import { OpenAICompatibleClient } from "../../../src/llm/client.js";
import { type ChatMessage } from "../../../src/llm/provider.js";

describe("OpenAICompatibleClient", () => {
  let client: OpenAICompatibleClient;

  beforeEach(() => {
    vi.clearAllMocks();
    client = new OpenAICompatibleClient({
      baseURL: "http://localhost:11434/v1",
      apiKey: "test-key",
      timeout: 5000,
    });
  });

  describe("chat", () => {
    it("should make a basic chat request and return formatted response", async () => {
      mockCreate.mockResolvedValueOnce({
        choices: [
          {
            message: { content: "Hello!", tool_calls: undefined },
            finish_reason: "stop",
          },
        ],
        usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
      });

      const response = await client.chat({
        model: "gpt-4o",
        messages: [{ role: "user", content: "Hi" }],
        temperature: 0.7,
        maxTokens: 100,
      });

      expect(response.content).toBe("Hello!");
      expect(response.toolCalls).toEqual([]);
      expect(response.usage).toEqual({
        promptTokens: 10,
        completionTokens: 5,
        totalTokens: 15,
      });
      expect(response.finishReason).toBe("stop");
    });

    it("should handle tool calls in response", async () => {
      mockCreate.mockResolvedValueOnce({
        choices: [
          {
            message: {
              content: "",
              tool_calls: [
                {
                  id: "tc_1",
                  type: "function",
                  function: { name: "read_file", arguments: '{"path":"test.ts"}' },
                },
              ],
            },
            finish_reason: "tool_calls",
          },
        ],
        usage: { prompt_tokens: 20, completion_tokens: 10, total_tokens: 30 },
      });

      const response = await client.chat({
        model: "gpt-4o",
        messages: [{ role: "user", content: "Read test.ts" }],
        tools: [
          {
            type: "function",
            function: { name: "read_file", description: "Read a file", parameters: {} },
          },
        ],
        temperature: 0,
        maxTokens: 100,
      });

      expect(response.toolCalls).toHaveLength(1);
      expect(response.toolCalls[0].name).toBe("read_file");
      expect(response.toolCalls[0].arguments).toBe('{"path":"test.ts"}');
      expect(response.finishReason).toBe("tool_calls");
    });

    it("should throw LLMError when no response choice", async () => {
      mockCreate.mockResolvedValueOnce({
        choices: [],
        usage: { prompt_tokens: 10, completion_tokens: 0, total_tokens: 10 },
      });

      await expect(
        client.chat({
          model: "gpt-4o",
          messages: [{ role: "user", content: "Hi" }],
          maxTokens: 100,
        }),
      ).rejects.toThrow("No response choice from LLM");
    });

    it("should wrap SDK errors in LLMError", async () => {
      mockCreate.mockRejectedValueOnce(new Error("Connection refused"));

      await expect(
        client.chat({
          model: "gpt-4o",
          messages: [{ role: "user", content: "Hi" }],
          maxTokens: 100,
        }),
      ).rejects.toThrow("LLM chat request failed");
    });

    it("should convert tool messages with toolCallId", async () => {
      mockCreate.mockResolvedValueOnce({
        choices: [
          {
            message: { content: "Got it!", tool_calls: undefined },
            finish_reason: "stop",
          },
        ],
        usage: { prompt_tokens: 20, completion_tokens: 5, total_tokens: 25 },
      });

      const messages: ChatMessage[] = [
        { role: "user", content: "Read file" },
        {
          role: "assistant",
          content: "",
          toolCalls: [{ id: "tc_1", name: "read_file", arguments: '{"path":"x"}' }],
        },
        { role: "tool", content: "file contents", toolCallId: "tc_1" },
      ];

      const response = await client.chat({
        model: "gpt-4o",
        messages,
        maxTokens: 100,
      });

      expect(response.content).toBe("Got it!");
      const callArgs = mockCreate.mock.calls[0][0];
      expect(callArgs.messages[1].role).toBe("assistant");
      expect(callArgs.messages[1].tool_calls).toHaveLength(1);
      expect(callArgs.messages[2].role).toBe("tool");
      expect(callArgs.messages[2].tool_call_id).toBe("tc_1");
    });

    it("should convert system to developer role for o1 models", async () => {
      mockCreate.mockResolvedValueOnce({
        choices: [
          {
            message: { content: "OK", tool_calls: undefined },
            finish_reason: "stop",
          },
        ],
        usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
      });

      await client.chat({
        model: "o1",
        messages: [
          { role: "system", content: "You are helpful" },
          { role: "user", content: "Hi" },
        ],
        maxTokens: 100,
      });

      const callArgs = mockCreate.mock.calls[0][0];
      expect(callArgs.messages[0].role).toBe("developer");
      expect(callArgs.temperature).toBeUndefined();
    });

    it("should not include tools when model does not support them", async () => {
      mockCreate.mockResolvedValueOnce({
        choices: [
          {
            message: { content: "OK", tool_calls: undefined },
            finish_reason: "stop",
          },
        ],
        usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
      });

      await client.chat({
        model: "deepseek-coder",
        messages: [{ role: "user", content: "Hi" }],
        tools: [
          {
            type: "function",
            function: { name: "test", description: "test", parameters: {} },
          },
        ],
        maxTokens: 100,
      });

      const callArgs = mockCreate.mock.calls[0][0];
      expect(callArgs.tools).toBeUndefined();
    });
  });

  describe("chat error handling", () => {
    it("should provide clear message for authentication errors (401)", async () => {
      mockCreate.mockRejectedValueOnce(
        new (OpenAI as unknown as { AuthenticationError: new (msg: string) => Error }).AuthenticationError("Invalid API key"),
      );

      await expect(
        client.chat({
          model: "gpt-4o",
          messages: [{ role: "user", content: "Hi" }],
          maxTokens: 100,
        }),
      ).rejects.toThrow("Authentication failed");
    });

    it("should provide clear message for permission denied (403)", async () => {
      mockCreate.mockRejectedValueOnce(
        new (OpenAI as unknown as { PermissionDeniedError: new (msg: string) => Error }).PermissionDeniedError("No access"),
      );

      await expect(
        client.chat({
          model: "gpt-4o",
          messages: [{ role: "user", content: "Hi" }],
          maxTokens: 100,
        }),
      ).rejects.toThrow("Permission denied");
    });

    it("should retry on rate limit (429) and eventually throw", async () => {
      const RLE = (OpenAI as unknown as { RateLimitError: new (msg: string, h?: Record<string, string>) => Error }).RateLimitError;
      const err = new RLE("Rate limit exceeded", { "retry-after": "0.001" });
      mockCreate
        .mockRejectedValueOnce(err)
        .mockRejectedValueOnce(err)
        .mockRejectedValueOnce(err)
        .mockRejectedValueOnce(err)
        .mockRejectedValueOnce(err)
        .mockRejectedValueOnce(err);

      await expect(
        client.chat({
          model: "gpt-4o",
          messages: [{ role: "user", content: "Hi" }],
          maxTokens: 100,
        }),
      ).rejects.toThrow("Rate limit");

      // 1 initial + 5 retries = 6 calls (MAX_RETRIES_RATE_LIMIT = 5)
      expect(mockCreate).toHaveBeenCalledTimes(6);
    }, 15000);

    it("should retry on server error (500) and succeed on second try", async () => {
      const ISE = (OpenAI as unknown as { InternalServerError: new (msg: string) => Error }).InternalServerError;
      mockCreate.mockRejectedValueOnce(new ISE("Internal server error")).mockResolvedValueOnce({
        choices: [
          {
            message: { content: "OK", tool_calls: undefined },
            finish_reason: "stop",
          },
        ],
        usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
      });

      const response = await client.chat({
        model: "gpt-4o",
        messages: [{ role: "user", content: "Hi" }],
        maxTokens: 100,
      });

      expect(response.content).toBe("OK");
      // 1 failed + 1 success = at least 2 calls
      expect(mockCreate).toHaveBeenCalledTimes(2);
    }, 30000);

    it("should not retry on non-retryable errors", async () => {
      mockCreate.mockRejectedValueOnce(new Error("Invalid request format"));

      await expect(
        client.chat({
          model: "gpt-4o",
          messages: [{ role: "user", content: "Hi" }],
          maxTokens: 100,
        }),
      ).rejects.toThrow("LLM chat request failed");

      expect(mockCreate).toHaveBeenCalledTimes(1);
    });

    it("should retry on timeout and provide clear message", async () => {
      const ACTE = (OpenAI as unknown as { APIConnectionTimeoutError: new (msg: string) => Error }).APIConnectionTimeoutError;
      const err = new ACTE("Request timed out");
      mockCreate
        .mockRejectedValueOnce(err)
        .mockRejectedValueOnce(err)
        .mockRejectedValueOnce(err)
        .mockRejectedValueOnce(err);

      await expect(
        client.chat({
          model: "gpt-4o",
          messages: [{ role: "user", content: "Hi" }],
          maxTokens: 100,
        }),
      ).rejects.toThrow("timed out");

      expect(mockCreate).toHaveBeenCalledTimes(4);
    }, 15000);
  });

  describe("stream", () => {
    it("should yield text chunks from stream", async () => {
      const chunks = [
        { choices: [{ delta: { content: "Hello" } }] },
        { choices: [{ delta: { content: " world" } }] },
        { choices: [{ delta: {} }] },
      ];

      mockCreate.mockResolvedValueOnce({
        [Symbol.asyncIterator]: async function* () {
          for (const chunk of chunks) {
            yield chunk;
          }
        },
      });

      const result: string[] = [];
      for await (const chunk of client.stream({
        model: "gpt-4o",
        messages: [{ role: "user", content: "Hi" }],
        maxTokens: 100,
      })) {
        if (chunk.type === "text-delta" && chunk.text) {
          result.push(chunk.text);
        }
      }

      expect(result).toEqual(["Hello", " world"]);
    });

    it("should yield tool call delta chunks", async () => {
      const chunks = [
        {
          choices: [
            {
              delta: {
                tool_calls: [
                  {
                    index: 0,
                    id: "tc_1",
                    function: { name: "read_file", arguments: '{"path":' },
                  },
                ],
              },
            },
          ],
        },
        {
          choices: [
            {
              delta: {
                tool_calls: [
                  {
                    index: 0,
                    function: { arguments: '"test.ts"}' },
                  },
                ],
              },
            },
          ],
        },
      ];

      mockCreate.mockResolvedValueOnce({
        [Symbol.asyncIterator]: async function* () {
          for (const chunk of chunks) {
            yield chunk;
          }
        },
      });

      const toolDeltas: unknown[] = [];
      for await (const chunk of client.stream({
        model: "gpt-4o",
        messages: [{ role: "user", content: "Read file" }],
        tools: [
          {
            type: "function",
            function: { name: "read_file", description: "Read", parameters: {} },
          },
        ],
        maxTokens: 100,
      })) {
        if (chunk.type === "tool-call-delta") {
          toolDeltas.push(chunk.toolCall);
        }
      }

      expect(toolDeltas).toHaveLength(2);
    });

    it("should wrap stream errors in LLMError", async () => {
      mockCreate.mockRejectedValueOnce(new Error("Stream connection failed"));

      const streamIt = async () => {
        const chunks: unknown[] = [];
        for await (const chunk of client.stream({
          model: "gpt-4o",
          messages: [{ role: "user", content: "Hi" }],
          maxTokens: 100,
        })) {
          chunks.push(chunk);
        }
        return chunks;
      };

      await expect(streamIt()).rejects.toThrow("LLM stream request failed");
    });

    it("should retry stream on server errors", async () => {
      const ISE = (OpenAI as unknown as { InternalServerError: new (msg: string) => Error }).InternalServerError;
      const chunks = [
        { choices: [{ delta: { content: "Hello" } }] },
        { choices: [{ delta: {} }] },
      ];

      mockCreate.mockRejectedValueOnce(new ISE("Server overloaded")).mockResolvedValueOnce({
        [Symbol.asyncIterator]: async function* () {
          for (const chunk of chunks) {
            yield chunk;
          }
        },
      });

      const result: string[] = [];
      for await (const chunk of client.stream({
        model: "gpt-4o",
        messages: [{ role: "user", content: "Hi" }],
        maxTokens: 100,
      })) {
        if (chunk.type === "text-delta" && chunk.text) {
          result.push(chunk.text);
        }
      }

      expect(result).toEqual(["Hello"]);
      expect(mockCreate).toHaveBeenCalledTimes(2);
    }, 15000);
  });

  describe("retry consolidation", () => {
    it("should use longer backoff (5s base) for rate limit errors", async () => {
      const RLE = (OpenAI as unknown as { RateLimitError: new (msg: string, h?: Record<string, string>) => Error }).RateLimitError;
      // No retry-after header → falls back to BASE_RATE_LIMIT_DELAY_MS (5s)
      const err = new RLE("Rate limit exceeded");

      // Succeed on second attempt
      mockCreate
        .mockRejectedValueOnce(err)
        .mockResolvedValueOnce({
          choices: [
            {
              message: { content: "OK", tool_calls: undefined },
              finish_reason: "stop",
            },
          ],
          usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
        });

      const start = Date.now();
      const response = await client.chat({
        model: "gpt-4o",
        messages: [{ role: "user", content: "Hi" }],
        maxTokens: 100,
      });

      const elapsed = Date.now() - start;
      expect(response.content).toBe("OK");
      expect(mockCreate).toHaveBeenCalledTimes(2);
      // Rate limit base delay is 5s, first attempt uses 5s * 2^0 = 5000ms
      // Allow some tolerance for timing
      expect(elapsed).toBeGreaterThanOrEqual(4500);
    }, 30000);

    it("should respect Retry-After header and propagate retryAfterMs in LLMError", async () => {
      const RLE = (OpenAI as unknown as { RateLimitError: new (msg: string, h?: Record<string, string>) => Error }).RateLimitError;
      // Server says retry after 2 seconds (small enough for fast tests)
      const err = new RLE("Rate limit exceeded", { "retry-after": "2" });
      mockCreate
        .mockRejectedValueOnce(err)
        .mockRejectedValueOnce(err)
        .mockRejectedValueOnce(err)
        .mockRejectedValueOnce(err)
        .mockRejectedValueOnce(err)
        .mockRejectedValueOnce(err);

      try {
        await client.chat({
          model: "gpt-4o",
          messages: [{ role: "user", content: "Hi" }],
          maxTokens: 100,
        });
        expect.fail("Should have thrown");
      } catch (error: unknown) {
        expect(error).toBeInstanceOf(Error);
        const llmErr = error as Error & { context?: Record<string, unknown> };
        expect(llmErr.message).toContain("Rate limit");
        // The error should include retryAfterMs derived from Retry-After header
        if (llmErr.context) {
          expect(llmErr.context.retryAfterMs).toBe(2_000);
        }
      }
    }, 30000);

    it("should use short backoff (1s, 2s, 4s) for transient errors", async () => {
      const ISE = (OpenAI as unknown as { InternalServerError: new (msg: string) => Error }).InternalServerError;
      const err = new ISE("Internal server error");

      // Fail 3 times (1s + 2s + 4s = ~7s total), then succeed
      mockCreate
        .mockRejectedValueOnce(err)
        .mockRejectedValueOnce(err)
        .mockRejectedValueOnce(err)
        .mockResolvedValueOnce({
          choices: [
            {
              message: { content: "Recovered", tool_calls: undefined },
              finish_reason: "stop",
            },
          ],
          usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
        });

      const start = Date.now();
      const response = await client.chat({
        model: "gpt-4o",
        messages: [{ role: "user", content: "Hi" }],
        maxTokens: 100,
      });

      const elapsed = Date.now() - start;
      expect(response.content).toBe("Recovered");
      expect(mockCreate).toHaveBeenCalledTimes(4);
      // 1s + 2s + 4s = 7s total backoff, but should be much less than rate limit's 5s base
      expect(elapsed).toBeGreaterThanOrEqual(6500);
      expect(elapsed).toBeLessThan(15000); // Should not use rate limit's longer delays
    }, 30000);

    it("should retry rate limits up to MAX_RETRIES_RATE_LIMIT (5) times", async () => {
      const RLE = (OpenAI as unknown as { RateLimitError: new (msg: string, h?: Record<string, string>) => Error }).RateLimitError;
      const err = new RLE("Rate limit exceeded", { "retry-after": "0.001" });

      // Reject 6 times (1 initial + 5 retries)
      for (let i = 0; i < 6; i++) {
        mockCreate.mockRejectedValueOnce(err);
      }

      await expect(
        client.chat({
          model: "gpt-4o",
          messages: [{ role: "user", content: "Hi" }],
          maxTokens: 100,
        }),
      ).rejects.toThrow("Rate limit");

      // 1 initial + 5 retries = 6 calls
      expect(mockCreate).toHaveBeenCalledTimes(6);
    }, 30000);

    it("should include retryAfterMs in LLMError after exhausting rate limit retries", async () => {
      const RLE = (OpenAI as unknown as { RateLimitError: new (msg: string, h?: Record<string, string>) => Error }).RateLimitError;
      // Use small retry-after to avoid slow tests, but still verify propagation
      const err = new RLE("Rate limit exceeded", { "retry-after": "0.001" });

      for (let i = 0; i < 6; i++) {
        mockCreate.mockRejectedValueOnce(err);
      }

      try {
        await client.chat({
          model: "gpt-4o",
          messages: [{ role: "user", content: "Hi" }],
          maxTokens: 100,
        });
        expect.fail("Should have thrown");
      } catch (error: unknown) {
        const llmErr = error as Error & { context?: Record<string, unknown> };
        expect(llmErr.message).toContain("Rate limit");
        // Error should propagate the retryAfterMs from Retry-After header
        if (llmErr.context) {
          expect(llmErr.context.retryAfterMs).toBeDefined();
        }
      }
    }, 30000);
  });

  describe("countTokens", () => {
    it("should count tokens", () => {
      const count = client.countTokens("Hello world");
      expect(count).toBeGreaterThan(0);
    });
  });
});
