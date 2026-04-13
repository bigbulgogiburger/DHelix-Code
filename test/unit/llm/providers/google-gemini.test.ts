/**
 * Google Gemini 프로바이더 단위 테스트
 *
 * 매니페스트 정의, 모델 패턴 매칭, chat/stream mock,
 * healthCheck, estimateCost 계산을 검증합니다.
 * 실제 API 호출은 하지 않습니다.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  GoogleGeminiProvider,
  GOOGLE_GEMINI_MANIFEST,
  resolveGeminiApiKey,
} from "../../../../src/llm/providers/google-gemini.js";
import type { ChatRequest } from "../../../../src/llm/provider.js";

// ─── 테스트 헬퍼 ────────────────────────────────────────────────────

/** 기본 ChatRequest 생성 */
function createTestRequest(overrides?: Partial<ChatRequest>): ChatRequest {
  return {
    model: "gemini-2.5-pro",
    messages: [{ role: "user", content: "Hello" }],
    ...overrides,
  };
}

/** fetch mock 응답 생성 */
function createMockResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? "OK" : "Error",
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(JSON.stringify(body)),
    body: null,
    headers: new Headers(),
    redirected: false,
    type: "basic" as ResponseType,
    url: "",
    clone: () => createMockResponse(body, status),
    arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)),
    blob: () => Promise.resolve(new Blob()),
    formData: () => Promise.resolve(new FormData()),
    bodyUsed: false,
  } as Response;
}

/** OpenAI 호환 chat completion 응답 생성 */
function createChatCompletionResponse(
  content: string,
  toolCalls?: { id: string; function: { name: string; arguments: string } }[],
) {
  return {
    choices: [
      {
        message: {
          content,
          ...(toolCalls
            ? { tool_calls: toolCalls.map((tc) => ({ ...tc, type: "function" })) }
            : {}),
        },
        finish_reason: toolCalls ? "tool_calls" : "stop",
      },
    ],
    usage: {
      prompt_tokens: 10,
      completion_tokens: 20,
      total_tokens: 30,
    },
  };
}

// ─── GEMINI_MANIFEST 테스트 ──────────────────────────────────────────

describe("GOOGLE_GEMINI_MANIFEST", () => {
  it("has correct provider id and display name", () => {
    expect(GOOGLE_GEMINI_MANIFEST.id).toBe("google-gemini");
    expect(GOOGLE_GEMINI_MANIFEST.displayName).toBe("Google Gemini");
    expect(GOOGLE_GEMINI_MANIFEST.authType).toBe("api-key");
  });

  it("defines three models", () => {
    expect(GOOGLE_GEMINI_MANIFEST.models).toHaveLength(3);
    const ids = GOOGLE_GEMINI_MANIFEST.models.map((m) => m.id);
    expect(ids).toContain("gemini-2.5-pro");
    expect(ids).toContain("gemini-2.5-flash");
    expect(ids).toContain("gemini-2.0-flash");
  });

  it("models have correct tiers", () => {
    const modelMap = new Map(GOOGLE_GEMINI_MANIFEST.models.map((m) => [m.id, m]));
    expect(modelMap.get("gemini-2.5-pro")?.tier).toBe("high");
    expect(modelMap.get("gemini-2.5-flash")?.tier).toBe("medium");
    expect(modelMap.get("gemini-2.0-flash")?.tier).toBe("low");
  });

  it("models have 1M context window", () => {
    for (const model of GOOGLE_GEMINI_MANIFEST.models) {
      expect(model.context).toBe(1_000_000);
    }
  });

  it("features include grounding and image input", () => {
    expect(GOOGLE_GEMINI_MANIFEST.features.supportsGrounding).toBe(true);
    expect(GOOGLE_GEMINI_MANIFEST.features.supportsImageInput).toBe(true);
    expect(GOOGLE_GEMINI_MANIFEST.features.supportsReasoningTrace).toBe(true);
    expect(GOOGLE_GEMINI_MANIFEST.features.supportsCaching).toBe(false);
  });

  describe("model pattern matching", () => {
    const patterns = GOOGLE_GEMINI_MANIFEST.modelPatterns;

    it("matches gemini model names", () => {
      expect(patterns.some((p) => p.test("gemini-2.5-pro"))).toBe(true);
      expect(patterns.some((p) => p.test("gemini-2.5-flash"))).toBe(true);
      expect(patterns.some((p) => p.test("gemini-2.0-flash"))).toBe(true);
      expect(patterns.some((p) => p.test("gemini-1.5-pro"))).toBe(true);
    });

    it("matches case-insensitively", () => {
      expect(patterns.some((p) => p.test("Gemini-2.5-Pro"))).toBe(true);
      expect(patterns.some((p) => p.test("GEMINI-2.5-FLASH"))).toBe(true);
    });

    it("does not match non-gemini models", () => {
      expect(patterns.some((p) => p.test("claude-sonnet-4"))).toBe(false);
      expect(patterns.some((p) => p.test("gpt-4o"))).toBe(false);
      expect(patterns.some((p) => p.test("o3-mini"))).toBe(false);
    });
  });
});

// ─── resolveGeminiApiKey 테스트 ──────────────────────────────────────

describe("resolveGeminiApiKey", () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("returns DHELIX_GOOGLE_API_KEY first", () => {
    process.env["DHELIX_GOOGLE_API_KEY"] = "dhelix-key";
    process.env["GOOGLE_API_KEY"] = "google-key";
    process.env["GEMINI_API_KEY"] = "gemini-key";
    expect(resolveGeminiApiKey()).toBe("dhelix-key");
  });

  it("falls back to GOOGLE_API_KEY", () => {
    delete process.env["DHELIX_GOOGLE_API_KEY"];
    process.env["GOOGLE_API_KEY"] = "google-key";
    process.env["GEMINI_API_KEY"] = "gemini-key";
    expect(resolveGeminiApiKey()).toBe("google-key");
  });

  it("falls back to GEMINI_API_KEY", () => {
    delete process.env["DHELIX_GOOGLE_API_KEY"];
    delete process.env["GOOGLE_API_KEY"];
    process.env["GEMINI_API_KEY"] = "gemini-key";
    expect(resolveGeminiApiKey()).toBe("gemini-key");
  });

  it("returns undefined when no key is set", () => {
    delete process.env["DHELIX_GOOGLE_API_KEY"];
    delete process.env["GOOGLE_API_KEY"];
    delete process.env["GEMINI_API_KEY"];
    expect(resolveGeminiApiKey()).toBeUndefined();
  });
});

// ─── GoogleGeminiProvider 테스트 ─────────────────────────────────────

describe("GoogleGeminiProvider", () => {
  let provider: GoogleGeminiProvider;
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    provider = new GoogleGeminiProvider({ apiKey: "test-api-key" });
    fetchSpy = vi.spyOn(globalThis, "fetch");
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("throws when no API key is available", () => {
    const originalEnv = { ...process.env };
    delete process.env["DHELIX_GOOGLE_API_KEY"];
    delete process.env["GOOGLE_API_KEY"];
    delete process.env["GEMINI_API_KEY"];

    expect(() => new GoogleGeminiProvider()).toThrow(/API key not found/);

    process.env = originalEnv;
  });

  it("has correct provider name and manifest", () => {
    expect(provider.name).toBe("google-gemini");
    expect(provider.manifest.id).toBe("google-gemini");
  });

  describe("chat()", () => {
    it("returns parsed response from OpenAI-compatible endpoint", async () => {
      const mockBody = createChatCompletionResponse("Hello from Gemini!");
      fetchSpy.mockResolvedValueOnce(createMockResponse(mockBody));

      const result = await provider.chat(createTestRequest());

      expect(result.content).toBe("Hello from Gemini!");
      expect(result.toolCalls).toHaveLength(0);
      expect(result.usage.promptTokens).toBe(10);
      expect(result.usage.completionTokens).toBe(20);
      expect(result.usage.totalTokens).toBe(30);
      expect(result.finishReason).toBe("stop");
    });

    it("parses tool calls from response", async () => {
      const mockBody = createChatCompletionResponse("", [
        {
          id: "call_1",
          function: {
            name: "file_read",
            arguments: '{"path":"/tmp/test.txt"}',
          },
        },
      ]);
      fetchSpy.mockResolvedValueOnce(createMockResponse(mockBody));

      const result = await provider.chat(createTestRequest());

      expect(result.toolCalls).toHaveLength(1);
      expect(result.toolCalls[0]!.id).toBe("call_1");
      expect(result.toolCalls[0]!.name).toBe("file_read");
      expect(result.toolCalls[0]!.arguments).toBe('{"path":"/tmp/test.txt"}');
      expect(result.finishReason).toBe("tool_calls");
    });

    it("sends correct headers and body", async () => {
      fetchSpy.mockResolvedValueOnce(createMockResponse(createChatCompletionResponse("ok")));

      await provider.chat(
        createTestRequest({
          temperature: 0.7,
          maxTokens: 1024,
          tools: [
            {
              type: "function",
              function: {
                name: "test_tool",
                description: "A test tool",
                parameters: { type: "object", properties: {} },
              },
            },
          ],
        }),
      );

      expect(fetchSpy).toHaveBeenCalledOnce();
      const [url, options] = fetchSpy.mock.calls[0]!;
      expect(url).toContain("/chat/completions");

      const headers = options?.headers as Record<string, string>;
      expect(headers["Authorization"]).toBe("Bearer test-api-key");
      expect(headers["Content-Type"]).toBe("application/json");

      const body = JSON.parse(options?.body as string) as Record<string, unknown>;
      expect(body["model"]).toBe("gemini-2.5-pro");
      expect(body["temperature"]).toBe(0.7);
      expect(body["max_tokens"]).toBe(1024);
      expect(body["tools"]).toBeDefined();
    });

    it("throws LLMError on non-retryable HTTP error", async () => {
      fetchSpy.mockResolvedValueOnce(createMockResponse({ error: "bad request" }, 400));

      await expect(provider.chat(createTestRequest())).rejects.toThrow(/Gemini API error/);
    });
  });

  describe("stream()", () => {
    it("yields text-delta and done chunks from SSE", async () => {
      const sseData = [
        'data: {"choices":[{"delta":{"content":"Hello"}}]}\n\n',
        'data: {"choices":[{"delta":{"content":" world"}}]}\n\n',
        'data: {"choices":[{"finish_reason":"stop"}],"usage":{"prompt_tokens":5,"completion_tokens":2,"total_tokens":7}}\n\n',
        "data: [DONE]\n\n",
      ].join("");

      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue(encoder.encode(sseData));
          controller.close();
        },
      });

      fetchSpy.mockResolvedValueOnce({
        ok: true,
        status: 200,
        body: stream,
      } as Response);

      const chunks: { type: string; text?: string }[] = [];
      for await (const chunk of provider.stream(createTestRequest())) {
        chunks.push(chunk);
      }

      const textChunks = chunks.filter((c) => c.type === "text-delta");
      expect(textChunks).toHaveLength(2);
      expect(textChunks[0]!.text).toBe("Hello");
      expect(textChunks[1]!.text).toBe(" world");

      const doneChunk = chunks.find((c) => c.type === "done");
      expect(doneChunk).toBeDefined();
      expect(doneChunk!.usage?.promptTokens).toBe(5);
      expect(doneChunk!.usage?.completionTokens).toBe(2);
    });

    it("yields tool-call-delta chunks", async () => {
      const sseData = [
        'data: {"choices":[{"delta":{"tool_calls":[{"index":0,"id":"call_1","function":{"name":"bash_exec","arguments":"{\\"cmd\\":"}}]}}]}\n\n',
        'data: {"choices":[{"delta":{"tool_calls":[{"index":0,"function":{"arguments":"\\"ls\\"}"}}]}}]}\n\n',
        'data: {"choices":[{"finish_reason":"tool_calls"}],"usage":{"prompt_tokens":10,"completion_tokens":5,"total_tokens":15}}\n\n',
        "data: [DONE]\n\n",
      ].join("");

      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue(encoder.encode(sseData));
          controller.close();
        },
      });

      fetchSpy.mockResolvedValueOnce({
        ok: true,
        status: 200,
        body: stream,
      } as Response);

      const chunks: unknown[] = [];
      for await (const chunk of provider.stream(createTestRequest())) {
        chunks.push(chunk);
      }

      const toolChunks = (chunks as { type: string }[]).filter((c) => c.type === "tool-call-delta");
      expect(toolChunks.length).toBeGreaterThanOrEqual(1);
    });

    it("throws when response body is null", async () => {
      fetchSpy.mockResolvedValueOnce({
        ok: true,
        status: 200,
        body: null,
      } as Response);

      const gen = provider.stream(createTestRequest());
      await expect(async () => {
        for await (const _chunk of gen) {
          // consume
        }
      }).rejects.toThrow(/response body is null/);
    });
  });

  describe("healthCheck()", () => {
    it("returns healthy status on successful response", async () => {
      fetchSpy.mockResolvedValueOnce(createMockResponse({ models: [] }));

      const result = await provider.healthCheck();

      expect(result.healthy).toBe(true);
      expect(result.latencyMs).toBeGreaterThanOrEqual(0);
      expect(result.error).toBeUndefined();
    });

    it("returns unhealthy status on HTTP error", async () => {
      fetchSpy.mockResolvedValueOnce(createMockResponse({}, 401));

      const result = await provider.healthCheck();

      expect(result.healthy).toBe(false);
      expect(result.error).toContain("401");
    });

    it("returns unhealthy status on network error", async () => {
      fetchSpy.mockRejectedValueOnce(new Error("Network error"));

      const result = await provider.healthCheck();

      expect(result.healthy).toBe(false);
      expect(result.error).toBe("Network error");
    });

    it("calls models endpoint with correct auth header", async () => {
      fetchSpy.mockResolvedValueOnce(createMockResponse({ models: [] }));

      await provider.healthCheck();

      expect(fetchSpy).toHaveBeenCalledOnce();
      const [url, options] = fetchSpy.mock.calls[0]!;
      expect(url).toContain("/models");
      expect(options?.method).toBe("GET");
      const headers = options?.headers as Record<string, string>;
      expect(headers["Authorization"]).toBe("Bearer test-api-key");
    });
  });

  describe("estimateCost()", () => {
    const usage = {
      promptTokens: 1_000_000,
      completionTokens: 500_000,
      totalTokens: 1_500_000,
    };

    it("uses default model (gemini-2.5-pro) pricing when no modelId", () => {
      const cost = provider.estimateCost(usage);

      // gemini-2.5-pro: input=$1.25/1M, output=$10/1M
      expect(cost.inputCost).toBeCloseTo(1.25);
      expect(cost.outputCost).toBeCloseTo(5.0);
      expect(cost.totalCost).toBeCloseTo(6.25);
      expect(cost.currency).toBe("USD");
    });

    it("uses specific model pricing when modelId is provided", () => {
      const cost = provider.estimateCost(usage, "gemini-2.5-flash");

      // gemini-2.5-flash: input=$0.15/1M, output=$0.60/1M
      expect(cost.inputCost).toBeCloseTo(0.15);
      expect(cost.outputCost).toBeCloseTo(0.3);
      expect(cost.totalCost).toBeCloseTo(0.45);
    });

    it("uses specific model pricing for gemini-2.0-flash", () => {
      const cost = provider.estimateCost(usage, "gemini-2.0-flash");

      // gemini-2.0-flash: input=$0.10/1M, output=$0.40/1M
      expect(cost.inputCost).toBeCloseTo(0.1);
      expect(cost.outputCost).toBeCloseTo(0.2);
      expect(cost.totalCost).toBeCloseTo(0.3);
    });

    it("falls back to default pricing for unknown model", () => {
      const cost = provider.estimateCost(usage, "gemini-unknown");

      // Falls back to gemini-2.5-pro pricing
      expect(cost.inputCost).toBeCloseTo(1.25);
      expect(cost.outputCost).toBeCloseTo(5.0);
    });

    it("handles zero tokens", () => {
      const cost = provider.estimateCost({
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0,
      });

      expect(cost.inputCost).toBe(0);
      expect(cost.outputCost).toBe(0);
      expect(cost.totalCost).toBe(0);
    });
  });

  describe("countTokens()", () => {
    it("returns token count for text", () => {
      const count = provider.countTokens("Hello, world!");
      expect(count).toBeGreaterThan(0);
    });

    it("returns 0 for empty string", () => {
      const count = provider.countTokens("");
      expect(count).toBe(0);
    });
  });

  describe("custom configuration", () => {
    it("uses custom base URL", async () => {
      const customProvider = new GoogleGeminiProvider({
        apiKey: "test-key",
        baseUrl: "https://custom.api.example.com",
      });

      fetchSpy.mockResolvedValueOnce(createMockResponse(createChatCompletionResponse("ok")));

      await customProvider.chat(createTestRequest());

      const [url] = fetchSpy.mock.calls[0]!;
      expect(url).toContain("https://custom.api.example.com");
    });
  });
});
