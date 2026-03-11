import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock token-counter to avoid tiktoken dependency
vi.mock("../../../src/llm/token-counter.js", () => ({
  countTokens: (text: string) => Math.ceil(text.length / 4),
}));

import { ResponsesAPIClient } from "../../../src/llm/responses-client.js";
import { LLMError } from "../../../src/utils/error.js";
import type { ChatRequest } from "../../../src/llm/provider.js";

// Spy on global fetch
const mockFetch = vi.fn<typeof globalThis.fetch>();

function makeSuccessResponse(data: Record<string, unknown>): Response {
  return {
    ok: true,
    status: 200,
    headers: new Headers(),
    json: () => Promise.resolve(data),
    text: () => Promise.resolve(JSON.stringify(data)),
  } as unknown as Response;
}

function makeErrorResponse(
  status: number,
  body: string,
  headers?: Record<string, string>,
): Response {
  const h = new Headers(headers);
  return {
    ok: false,
    status,
    headers: h,
    json: () => Promise.resolve(JSON.parse(body)),
    text: () => Promise.resolve(body),
  } as unknown as Response;
}

function makeStreamResponse(sseData: string): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(encoder.encode(sseData));
      controller.close();
    },
  });
  return {
    ok: true,
    status: 200,
    headers: new Headers(),
    body: stream,
    json: () => Promise.reject(new Error("streaming")),
    text: () => Promise.resolve(sseData),
  } as unknown as Response;
}

const defaultResponseBody = {
  id: "resp_1",
  model: "gpt-5.1-codex-mini",
  output: [
    {
      type: "message",
      role: "assistant",
      content: [{ type: "output_text", text: "Hello!" }],
    },
  ],
  output_text: "Hello!",
  usage: { input_tokens: 10, output_tokens: 5, total_tokens: 15 },
  status: "completed",
};

function makeRequest(overrides?: Partial<ChatRequest>): ChatRequest {
  return {
    model: "gpt-5.1-codex-mini",
    messages: [{ role: "user", content: "Hi" }],
    maxTokens: 100,
    ...overrides,
  };
}

describe("ResponsesAPIClient", () => {
  let client: ResponsesAPIClient;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ shouldAdvanceTime: true });
    // Stub Math.random for deterministic jitter
    vi.spyOn(Math, "random").mockReturnValue(0.5);
    vi.stubGlobal("fetch", mockFetch);
    client = new ResponsesAPIClient({
      baseURL: "https://test.openai.azure.com/openai?api-version=2025-01-01",
      apiKey: "test-key",
      timeout: 5000,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  describe("chat", () => {
    it("should make a successful request without retry", async () => {
      mockFetch.mockResolvedValueOnce(makeSuccessResponse(defaultResponseBody));

      const response = await client.chat(makeRequest());

      expect(response.content).toBe("Hello!");
      expect(response.usage).toEqual({
        promptTokens: 10,
        completionTokens: 5,
        totalTokens: 15,
      });
      expect(response.finishReason).toBe("stop");
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it("should retry on transient 500 error and succeed", async () => {
      mockFetch
        .mockResolvedValueOnce(makeErrorResponse(500, '{"error":{"message":"Internal error"}}'))
        .mockResolvedValueOnce(makeSuccessResponse(defaultResponseBody));

      const response = await client.chat(makeRequest());

      expect(response.content).toBe("Hello!");
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it("should retry on 502 and 503 errors", async () => {
      mockFetch
        .mockResolvedValueOnce(makeErrorResponse(502, "Bad Gateway"))
        .mockResolvedValueOnce(makeErrorResponse(503, "Service Unavailable"))
        .mockResolvedValueOnce(makeSuccessResponse(defaultResponseBody));

      const response = await client.chat(makeRequest());

      expect(response.content).toBe("Hello!");
      expect(mockFetch).toHaveBeenCalledTimes(3);
    });

    it(
      "should retry on 429 rate limit up to 5 times",
      async () => {
        vi.useRealTimers();

        // Create a fast client with near-zero timeout so retries are instant
        // We re-stub fetch since useRealTimers resets
        vi.stubGlobal("fetch", mockFetch);
        vi.spyOn(Math, "random").mockReturnValue(0.5);

        // 429 errors with no Retry-After header
        for (let i = 0; i < 6; i++) {
          mockFetch.mockResolvedValueOnce(
            makeErrorResponse(429, '{"error":{"message":"Rate limited"}}'),
          );
        }

        // Monkey-patch the delay constants via module-level sleep override
        // Since we can't modify module constants, we instead mock setTimeout to fire immediately
        const origSetTimeout = globalThis.setTimeout;
        vi.stubGlobal(
          "setTimeout",
          (fn: (...args: unknown[]) => void) => origSetTimeout(fn, 0),
        );

        try {
          await expect(client.chat(makeRequest())).rejects.toThrow("Rate limit");
          // attempt 0 through 5 = 6 calls total (initial + 5 retries)
          expect(mockFetch).toHaveBeenCalledTimes(6);
        } finally {
          vi.stubGlobal("setTimeout", origSetTimeout);
          vi.useFakeTimers({ shouldAdvanceTime: true });
          vi.stubGlobal("fetch", mockFetch);
          vi.spyOn(Math, "random").mockReturnValue(0.5);
        }
      },
      30_000,
    );

    it("should honor Retry-After header on 429 response", async () => {
      mockFetch
        .mockResolvedValueOnce(
          makeErrorResponse(429, '{"error":{"message":"Rate limited"}}', { "retry-after": "2" }),
        )
        .mockResolvedValueOnce(makeSuccessResponse(defaultResponseBody));

      const response = await client.chat(makeRequest());

      expect(response.content).toBe("Hello!");
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it("should fail immediately on 401 authentication error (no retry)", async () => {
      mockFetch.mockResolvedValueOnce(
        makeErrorResponse(401, '{"error":{"message":"Invalid key"}}'),
      );

      await expect(client.chat(makeRequest())).rejects.toThrow("Authentication failed");
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it("should fail immediately on 403 permission error (no retry)", async () => {
      mockFetch.mockResolvedValueOnce(makeErrorResponse(403, '{"error":{"message":"Forbidden"}}'));

      await expect(client.chat(makeRequest())).rejects.toThrow("Permission denied");
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it("should fail immediately on 404 not found (no retry)", async () => {
      mockFetch.mockResolvedValueOnce(makeErrorResponse(404, '{"error":{"message":"Not found"}}'));

      await expect(client.chat(makeRequest())).rejects.toThrow("not found");
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it(
      "should exhaust transient retries after MAX_RETRIES_TRANSIENT",
      async () => {
        vi.useRealTimers();

        vi.stubGlobal("fetch", mockFetch);
        vi.spyOn(Math, "random").mockReturnValue(0.5);

        // 4 failures = initial + 3 retries exhausted
        for (let i = 0; i < 4; i++) {
          mockFetch.mockResolvedValueOnce(makeErrorResponse(500, "Internal error"));
        }

        // Make setTimeout fire immediately so retries don't wait
        const origSetTimeout = globalThis.setTimeout;
        vi.stubGlobal(
          "setTimeout",
          (fn: (...args: unknown[]) => void) => origSetTimeout(fn, 0),
        );

        try {
          await expect(client.chat(makeRequest())).rejects.toThrow("Responses API error (500)");
          expect(mockFetch).toHaveBeenCalledTimes(4);
        } finally {
          vi.stubGlobal("setTimeout", origSetTimeout);
          vi.useFakeTimers({ shouldAdvanceTime: true });
          vi.stubGlobal("fetch", mockFetch);
          vi.spyOn(Math, "random").mockReturnValue(0.5);
        }
      },
      30_000,
    );

    it("should retry on network errors (ECONNRESET)", async () => {
      const networkError = new Error("fetch failed: ECONNRESET");
      mockFetch
        .mockRejectedValueOnce(networkError)
        .mockResolvedValueOnce(makeSuccessResponse(defaultResponseBody));

      const response = await client.chat(makeRequest());

      expect(response.content).toBe("Hello!");
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it("should throw on non-retryable generic errors without retry", async () => {
      mockFetch.mockRejectedValueOnce(new TypeError("Invalid URL"));

      await expect(client.chat(makeRequest())).rejects.toThrow("Invalid URL");
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it("should handle tool calls in response", async () => {
      const responseWithTools = {
        ...defaultResponseBody,
        output: [
          {
            type: "function_call",
            call_id: "fc_1",
            name: "read_file",
            arguments: '{"path":"test.ts"}',
          },
        ],
        output_text: "",
      };
      mockFetch.mockResolvedValueOnce(makeSuccessResponse(responseWithTools));

      const response = await client.chat(
        makeRequest({
          tools: [
            {
              type: "function",
              function: { name: "read_file", description: "Read a file", parameters: {} },
            },
          ],
        }),
      );

      expect(response.toolCalls).toHaveLength(1);
      expect(response.toolCalls[0].name).toBe("read_file");
      expect(response.toolCalls[0].arguments).toBe('{"path":"test.ts"}');
    });
  });

  describe("stream", () => {
    it("should yield text chunks from stream", async () => {
      const sseData = [
        'event: response.output_text.delta\ndata: {"type":"response.output_text.delta","delta":"Hello"}\n\n',
        'event: response.output_text.delta\ndata: {"type":"response.output_text.delta","delta":" world"}\n\n',
        "data: [DONE]\n\n",
      ].join("");

      mockFetch.mockResolvedValueOnce(makeStreamResponse(sseData));

      const result: string[] = [];
      for await (const chunk of client.stream(makeRequest())) {
        if (chunk.type === "text-delta" && chunk.text) {
          result.push(chunk.text);
        }
      }

      expect(result).toEqual(["Hello", " world"]);
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it("should retry stream on transient error and succeed", async () => {
      const sseData = [
        'event: response.output_text.delta\ndata: {"type":"response.output_text.delta","delta":"OK"}\n\n',
        "data: [DONE]\n\n",
      ].join("");

      mockFetch
        .mockResolvedValueOnce(makeErrorResponse(503, "Service Unavailable"))
        .mockResolvedValueOnce(makeStreamResponse(sseData));

      const result: string[] = [];
      for await (const chunk of client.stream(makeRequest())) {
        if (chunk.type === "text-delta" && chunk.text) {
          result.push(chunk.text);
        }
      }

      expect(result).toEqual(["OK"]);
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it("should fail immediately on 401 in stream (no retry)", async () => {
      mockFetch.mockResolvedValueOnce(makeErrorResponse(401, '{"error":{"message":"Bad key"}}'));

      const streamIt = async () => {
        const chunks: unknown[] = [];
        for await (const chunk of client.stream(makeRequest())) {
          chunks.push(chunk);
        }
        return chunks;
      };

      await expect(streamIt()).rejects.toThrow("Authentication failed");
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it("should retry stream on network error", async () => {
      const sseData = [
        'event: response.output_text.delta\ndata: {"type":"response.output_text.delta","delta":"recovered"}\n\n',
        "data: [DONE]\n\n",
      ].join("");

      const networkError = new Error("fetch failed");
      mockFetch
        .mockRejectedValueOnce(networkError)
        .mockResolvedValueOnce(makeStreamResponse(sseData));

      const result: string[] = [];
      for await (const chunk of client.stream(makeRequest())) {
        if (chunk.type === "text-delta" && chunk.text) {
          result.push(chunk.text);
        }
      }

      expect(result).toEqual(["recovered"]);
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it("should throw when stream has no body", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers(),
        body: null,
      } as unknown as Response);

      const streamIt = async () => {
        for await (const _chunk of client.stream(makeRequest())) {
          // consume
        }
      };

      await expect(streamIt()).rejects.toThrow("No response body for streaming");
    });
  });

  describe("countTokens", () => {
    it("should count tokens using the mocked counter", () => {
      const count = client.countTokens("Hello world");
      expect(count).toBeGreaterThan(0);
    });
  });

  describe("Azure headers", () => {
    it("should use api-key header for Azure endpoints", async () => {
      mockFetch.mockResolvedValueOnce(makeSuccessResponse(defaultResponseBody));

      await client.chat(makeRequest());

      const calledHeaders = mockFetch.mock.calls[0][1]?.headers as Record<string, string>;
      expect(calledHeaders["api-key"]).toBe("test-key");
    });

    it("should use Authorization header for non-Azure endpoints", async () => {
      const nonAzureClient = new ResponsesAPIClient({
        baseURL: "https://api.openai.com/v1",
        apiKey: "sk-test",
      });
      mockFetch.mockResolvedValueOnce(makeSuccessResponse(defaultResponseBody));

      await nonAzureClient.chat(makeRequest());

      const calledHeaders = mockFetch.mock.calls[0][1]?.headers as Record<string, string>;
      expect(calledHeaders["Authorization"]).toBe("Bearer sk-test");
    });
  });
});
