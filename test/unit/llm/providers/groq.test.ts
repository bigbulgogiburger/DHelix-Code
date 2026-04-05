/**
 * Groq 프로바이더 단위 테스트
 *
 * 매니페스트 정의, 모델 패턴 매칭, chat/stream mock,
 * healthCheck, estimateCost 계산을 검증합니다.
 * 실제 API 호출은 하지 않습니다.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  GroqProvider,
  GROQ_MANIFEST,
  resolveGroqApiKey,
} from "../../../../src/llm/providers/groq.js";
import type { ChatRequest } from "../../../../src/llm/provider.js";

// ─── 테스트 헬퍼 ────────────────────────────────────────────────────

/** 기본 ChatRequest 생성 */
function createTestRequest(overrides?: Partial<ChatRequest>): ChatRequest {
  return {
    model: "llama-3.3-70b-versatile",
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

// ─── GROQ_MANIFEST 테스트 ────────────────────────────────────────────

describe("GROQ_MANIFEST", () => {
  it("has correct provider id and display name", () => {
    expect(GROQ_MANIFEST.id).toBe("groq");
    expect(GROQ_MANIFEST.displayName).toBe("Groq");
    expect(GROQ_MANIFEST.authType).toBe("api-key");
  });

  it("defines four models", () => {
    expect(GROQ_MANIFEST.models).toHaveLength(4);
    const ids = GROQ_MANIFEST.models.map((m) => m.id);
    expect(ids).toContain("llama-3.3-70b-versatile");
    expect(ids).toContain("llama-3.1-8b-instant");
    expect(ids).toContain("mixtral-8x7b-32768");
    expect(ids).toContain("gemma2-9b-it");
  });

  it("models have correct tiers", () => {
    const modelMap = new Map(GROQ_MANIFEST.models.map((m) => [m.id, m]));
    expect(modelMap.get("llama-3.3-70b-versatile")?.tier).toBe("high");
    expect(modelMap.get("llama-3.1-8b-instant")?.tier).toBe("low");
    expect(modelMap.get("mixtral-8x7b-32768")?.tier).toBe("medium");
    expect(modelMap.get("gemma2-9b-it")?.tier).toBe("low");
  });

  it("features do not support image input", () => {
    expect(GROQ_MANIFEST.features.supportsImageInput).toBe(false);
    expect(GROQ_MANIFEST.features.supportsCaching).toBe(false);
    expect(GROQ_MANIFEST.features.supportsGrounding).toBe(false);
  });

  describe("model pattern matching", () => {
    const patterns = GROQ_MANIFEST.modelPatterns;

    it("matches llama- prefix", () => {
      expect(patterns.some((p) => p.test("llama-3.3-70b-versatile"))).toBe(true);
      expect(patterns.some((p) => p.test("llama-3.1-8b-instant"))).toBe(true);
      expect(patterns.some((p) => p.test("llama-2-70b"))).toBe(true);
    });

    it("matches mixtral- prefix", () => {
      expect(patterns.some((p) => p.test("mixtral-8x7b-32768"))).toBe(true);
      expect(patterns.some((p) => p.test("mixtral-8x22b"))).toBe(true);
    });

    it("matches gemma prefix", () => {
      expect(patterns.some((p) => p.test("gemma2-9b-it"))).toBe(true);
      expect(patterns.some((p) => p.test("gemma-7b-it"))).toBe(true);
    });

    it("matches case-insensitively", () => {
      expect(patterns.some((p) => p.test("Llama-3.3-70B"))).toBe(true);
      expect(patterns.some((p) => p.test("MIXTRAL-8x7B"))).toBe(true);
      expect(patterns.some((p) => p.test("Gemma2-9B"))).toBe(true);
    });

    it("does not match non-groq models", () => {
      expect(patterns.some((p) => p.test("claude-sonnet-4"))).toBe(false);
      expect(patterns.some((p) => p.test("gpt-4o"))).toBe(false);
      expect(patterns.some((p) => p.test("gemini-2.5-pro"))).toBe(false);
      expect(patterns.some((p) => p.test("mistral-large"))).toBe(false);
    });
  });
});

// ─── resolveGroqApiKey 테스트 ────────────────────────────────────────

describe("resolveGroqApiKey", () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("returns DHELIX_GROQ_API_KEY first", () => {
    process.env["DHELIX_GROQ_API_KEY"] = "dhelix-key";
    process.env["GROQ_API_KEY"] = "groq-key";
    expect(resolveGroqApiKey()).toBe("dhelix-key");
  });

  it("falls back to GROQ_API_KEY", () => {
    delete process.env["DHELIX_GROQ_API_KEY"];
    process.env["GROQ_API_KEY"] = "groq-key";
    expect(resolveGroqApiKey()).toBe("groq-key");
  });

  it("returns undefined when no key is set", () => {
    delete process.env["DHELIX_GROQ_API_KEY"];
    delete process.env["GROQ_API_KEY"];
    expect(resolveGroqApiKey()).toBeUndefined();
  });
});

// ─── GroqProvider 테스트 ─────────────────────────────────────────────

describe("GroqProvider", () => {
  let provider: GroqProvider;
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    provider = new GroqProvider({ apiKey: "test-api-key" });
    fetchSpy = vi.spyOn(globalThis, "fetch");
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("throws when no API key is available", () => {
    const originalEnv = { ...process.env };
    delete process.env["DHELIX_GROQ_API_KEY"];
    delete process.env["GROQ_API_KEY"];

    expect(() => new GroqProvider()).toThrow(/API key not found/);

    process.env = originalEnv;
  });

  it("has correct provider name and manifest", () => {
    expect(provider.name).toBe("groq");
    expect(provider.manifest.id).toBe("groq");
  });

  describe("chat()", () => {
    it("returns parsed response from OpenAI-compatible endpoint", async () => {
      const mockBody = createChatCompletionResponse("Hello from Groq!");
      fetchSpy.mockResolvedValueOnce(createMockResponse(mockBody));

      const result = await provider.chat(createTestRequest());

      expect(result.content).toBe("Hello from Groq!");
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
            name: "bash_exec",
            arguments: '{"cmd":"ls"}',
          },
        },
      ]);
      fetchSpy.mockResolvedValueOnce(createMockResponse(mockBody));

      const result = await provider.chat(createTestRequest());

      expect(result.toolCalls).toHaveLength(1);
      expect(result.toolCalls[0]!.id).toBe("call_1");
      expect(result.toolCalls[0]!.name).toBe("bash_exec");
      expect(result.finishReason).toBe("tool_calls");
    });

    it("sends to correct Groq endpoint with Bearer auth", async () => {
      fetchSpy.mockResolvedValueOnce(
        createMockResponse(createChatCompletionResponse("ok")),
      );

      await provider.chat(
        createTestRequest({
          temperature: 0.8,
          maxTokens: 512,
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
      expect(url).toContain("api.groq.com");
      expect(url).toContain("/chat/completions");

      const headers = options?.headers as Record<string, string>;
      expect(headers["Authorization"]).toBe("Bearer test-api-key");
      expect(headers["Content-Type"]).toBe("application/json");

      const body = JSON.parse(options?.body as string) as Record<string, unknown>;
      expect(body["model"]).toBe("llama-3.3-70b-versatile");
      expect(body["temperature"]).toBe(0.8);
      expect(body["max_tokens"]).toBe(512);
      expect(body["tools"]).toBeDefined();
    });

    it("throws LLMError on non-retryable HTTP error", async () => {
      fetchSpy.mockResolvedValueOnce(createMockResponse({ error: "bad request" }, 400));

      await expect(provider.chat(createTestRequest())).rejects.toThrow(/Groq API error/);
    });
  });

  describe("stream()", () => {
    it("yields text-delta and done chunks from SSE", async () => {
      const sseData = [
        'data: {"choices":[{"delta":{"content":"Hello"}}]}\n\n',
        'data: {"choices":[{"delta":{"content":" Groq"}}]}\n\n',
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
      expect(textChunks[1]!.text).toBe(" Groq");

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

      const toolChunks = (chunks as { type: string }[]).filter(
        (c) => c.type === "tool-call-delta",
      );
      expect(toolChunks.length).toBeGreaterThanOrEqual(1);
    });

    it("sends stream: true in request body", async () => {
      const sseData = "data: [DONE]\n\n";
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

      const [, options] = fetchSpy.mock.calls[0]!;
      const body = JSON.parse(options?.body as string) as Record<string, unknown>;
      expect(body["stream"]).toBe(true);
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
      fetchSpy.mockResolvedValueOnce(createMockResponse({ data: [] }));

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
      fetchSpy.mockResolvedValueOnce(createMockResponse({ data: [] }));

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

    it("uses default model (llama-3.3-70b-versatile) pricing when no modelId", () => {
      const cost = provider.estimateCost(usage);

      // llama-3.3-70b: input=$0.59/1M, output=$0.79/1M
      expect(cost.inputCost).toBeCloseTo(0.59);
      expect(cost.outputCost).toBeCloseTo(0.395);
      expect(cost.totalCost).toBeCloseTo(0.985);
      expect(cost.currency).toBe("USD");
    });

    it("uses mixtral pricing when modelId matches", () => {
      const cost = provider.estimateCost(usage, "mixtral-8x7b-32768");

      // mixtral: input=$0.24/1M, output=$0.24/1M
      expect(cost.inputCost).toBeCloseTo(0.24);
      expect(cost.outputCost).toBeCloseTo(0.12);
      expect(cost.totalCost).toBeCloseTo(0.36);
    });

    it("uses gemma pricing when modelId matches", () => {
      const cost = provider.estimateCost(usage, "gemma2-9b-it");

      // gemma2: input=$0.2/1M, output=$0.2/1M
      expect(cost.inputCost).toBeCloseTo(0.2);
      expect(cost.outputCost).toBeCloseTo(0.1);
      expect(cost.totalCost).toBeCloseTo(0.3);
    });

    it("falls back to default pricing for unknown model", () => {
      const cost = provider.estimateCost(usage, "llama-unknown");

      expect(cost.inputCost).toBeCloseTo(0.59);
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
      const count = provider.countTokens("Hello, Groq!");
      expect(count).toBeGreaterThan(0);
    });

    it("returns 0 for empty string", () => {
      const count = provider.countTokens("");
      expect(count).toBe(0);
    });
  });

  describe("custom configuration", () => {
    it("uses custom base URL", async () => {
      const customProvider = new GroqProvider({
        apiKey: "test-key",
        baseUrl: "https://custom.groq.example.com",
      });

      fetchSpy.mockResolvedValueOnce(
        createMockResponse(createChatCompletionResponse("ok")),
      );

      await customProvider.chat(createTestRequest());

      const [url] = fetchSpy.mock.calls[0]!;
      expect(url).toContain("https://custom.groq.example.com");
    });
  });
});
