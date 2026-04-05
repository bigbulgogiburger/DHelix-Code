/**
 * Azure OpenAI 프로바이더 단위 테스트
 *
 * 매니페스트 정의, 모델 패턴 매칭, API 키 해석,
 * chat/stream mock, healthCheck, estimateCost 계산을 검증합니다.
 * 실제 API 호출은 하지 않습니다.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  AzureOpenAIProvider,
  AZURE_OPENAI_MANIFEST,
  resolveAzureApiKey,
} from "../../../../src/llm/providers/azure-openai.js";
import type { ChatRequest } from "../../../../src/llm/provider.js";

// ─── 테스트 헬퍼 ────────────────────────────────────────────────────

/** 기본 ChatRequest 생성 */
function createTestRequest(overrides?: Partial<ChatRequest>): ChatRequest {
  return {
    model: "azure-gpt-4o",
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

/** 테스트용 AzureOpenAIProvider 생성 (필수 옵션 포함) */
function createTestProvider(overrides?: {
  apiKey?: string;
  resourceName?: string;
  deploymentName?: string;
  apiVersion?: string;
}): AzureOpenAIProvider {
  return new AzureOpenAIProvider({
    apiKey: "test-api-key",
    resourceName: "test-resource",
    deploymentName: "gpt-4o",
    ...overrides,
  });
}

// ─── AZURE_OPENAI_MANIFEST 테스트 ───────────────────────────────────

describe("AZURE_OPENAI_MANIFEST", () => {
  it("has correct provider id and display name", () => {
    expect(AZURE_OPENAI_MANIFEST.id).toBe("azure-openai");
    expect(AZURE_OPENAI_MANIFEST.displayName).toBe("Azure OpenAI");
    expect(AZURE_OPENAI_MANIFEST.authType).toBe("api-key");
  });

  it("defines four models", () => {
    expect(AZURE_OPENAI_MANIFEST.models).toHaveLength(4);
    const ids = AZURE_OPENAI_MANIFEST.models.map((m) => m.id);
    expect(ids).toContain("azure-gpt-4o");
    expect(ids).toContain("azure-gpt-4o-mini");
    expect(ids).toContain("azure-gpt-4-turbo");
    expect(ids).toContain("azure-gpt-35-turbo");
  });

  it("models have correct tiers", () => {
    const modelMap = new Map(AZURE_OPENAI_MANIFEST.models.map((m) => [m.id, m]));
    expect(modelMap.get("azure-gpt-4o")?.tier).toBe("high");
    expect(modelMap.get("azure-gpt-4o-mini")?.tier).toBe("medium");
    expect(modelMap.get("azure-gpt-4-turbo")?.tier).toBe("high");
    expect(modelMap.get("azure-gpt-35-turbo")?.tier).toBe("low");
  });

  it("features do not include caching or grounding", () => {
    expect(AZURE_OPENAI_MANIFEST.features.supportsCaching).toBe(false);
    expect(AZURE_OPENAI_MANIFEST.features.supportsGrounding).toBe(false);
    expect(AZURE_OPENAI_MANIFEST.features.supportsImageInput).toBe(true);
    expect(AZURE_OPENAI_MANIFEST.features.supportsReasoningTrace).toBe(false);
  });

  describe("model pattern matching", () => {
    const patterns = AZURE_OPENAI_MANIFEST.modelPatterns;

    it("matches azure- prefixed model names", () => {
      expect(patterns.some((p) => p.test("azure-gpt-4o"))).toBe(true);
      expect(patterns.some((p) => p.test("azure-gpt-4-turbo"))).toBe(true);
      expect(patterns.some((p) => p.test("azure-gpt-35-turbo"))).toBe(true);
      expect(patterns.some((p) => p.test("azure-custom-deployment"))).toBe(true);
    });

    it("matches case-insensitively", () => {
      expect(patterns.some((p) => p.test("AZURE-gpt-4o"))).toBe(true);
      expect(patterns.some((p) => p.test("Azure-Gpt-4-Turbo"))).toBe(true);
    });

    it("does not match non-azure model names", () => {
      expect(patterns.some((p) => p.test("gpt-4o"))).toBe(false);
      expect(patterns.some((p) => p.test("claude-sonnet-4"))).toBe(false);
      expect(patterns.some((p) => p.test("gemini-2.5-pro"))).toBe(false);
    });
  });
});

// ─── resolveAzureApiKey 테스트 ───────────────────────────────────────

describe("resolveAzureApiKey", () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("returns DHELIX_AZURE_API_KEY first", () => {
    process.env["DHELIX_AZURE_API_KEY"] = "dhelix-azure-key";
    process.env["AZURE_OPENAI_API_KEY"] = "azure-key";
    expect(resolveAzureApiKey()).toBe("dhelix-azure-key");
  });

  it("falls back to AZURE_OPENAI_API_KEY", () => {
    delete process.env["DHELIX_AZURE_API_KEY"];
    process.env["AZURE_OPENAI_API_KEY"] = "azure-key";
    expect(resolveAzureApiKey()).toBe("azure-key");
  });

  it("returns undefined when no key is set", () => {
    delete process.env["DHELIX_AZURE_API_KEY"];
    delete process.env["AZURE_OPENAI_API_KEY"];
    expect(resolveAzureApiKey()).toBeUndefined();
  });
});

// ─── AzureOpenAIProvider 테스트 ──────────────────────────────────────

describe("AzureOpenAIProvider", () => {
  let provider: AzureOpenAIProvider;
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    provider = createTestProvider();
    fetchSpy = vi.spyOn(globalThis, "fetch");
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("constructor", () => {
    it("throws when no API key is available", () => {
      const originalEnv = { ...process.env };
      delete process.env["DHELIX_AZURE_API_KEY"];
      delete process.env["AZURE_OPENAI_API_KEY"];

      expect(() => new AzureOpenAIProvider({ resourceName: "test-resource" })).toThrow(
        /API key not found/,
      );

      process.env = originalEnv;
    });

    it("throws when no resource name is provided", () => {
      const originalEnv = { ...process.env };
      delete process.env["AZURE_OPENAI_RESOURCE_NAME"];

      expect(
        () => new AzureOpenAIProvider({ apiKey: "test-key" }),
      ).toThrow(/resource name not found/);

      process.env = originalEnv;
    });

    it("uses AZURE_OPENAI_RESOURCE_NAME env var as fallback", () => {
      const originalEnv = { ...process.env };
      process.env["AZURE_OPENAI_RESOURCE_NAME"] = "env-resource";

      const p = new AzureOpenAIProvider({ apiKey: "test-key" });
      expect(p.name).toBe("azure-openai");

      process.env = originalEnv;
    });

    it("uses AZURE_OPENAI_DEPLOYMENT_NAME env var as fallback", () => {
      const originalEnv = { ...process.env };
      process.env["AZURE_OPENAI_DEPLOYMENT_NAME"] = "my-deployment";

      const p = new AzureOpenAIProvider({
        apiKey: "test-key",
        resourceName: "test-resource",
      });
      expect(p.name).toBe("azure-openai");

      process.env = originalEnv;
    });
  });

  it("has correct provider name and manifest", () => {
    expect(provider.name).toBe("azure-openai");
    expect(provider.manifest.id).toBe("azure-openai");
  });

  describe("chat()", () => {
    it("returns parsed response from Azure endpoint", async () => {
      const mockBody = createChatCompletionResponse("Hello from Azure!");
      fetchSpy.mockResolvedValueOnce(createMockResponse(mockBody));

      const result = await provider.chat(createTestRequest());

      expect(result.content).toBe("Hello from Azure!");
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

    it("sends correct Azure-specific headers and URL", async () => {
      fetchSpy.mockResolvedValueOnce(
        createMockResponse(createChatCompletionResponse("ok")),
      );

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

      // Azure 엔드포인트 형식 확인
      expect(url).toContain("test-resource.openai.azure.com");
      expect(url).toContain("/openai/deployments/gpt-4o/chat/completions");
      expect(url).toContain("api-version=");

      // Azure는 api-key 헤더 사용 (Authorization Bearer가 아닌)
      const headers = options?.headers as Record<string, string>;
      expect(headers["api-key"]).toBe("test-api-key");
      expect(headers["Content-Type"]).toBe("application/json");
      expect(headers["Authorization"]).toBeUndefined();

      const body = JSON.parse(options?.body as string) as Record<string, unknown>;
      expect(body["temperature"]).toBe(0.7);
      expect(body["max_tokens"]).toBe(1024);
      expect(body["tools"]).toBeDefined();
    });

    it("does not include model field in request body (Azure uses deployment name in URL)", async () => {
      fetchSpy.mockResolvedValueOnce(
        createMockResponse(createChatCompletionResponse("ok")),
      );

      await provider.chat(createTestRequest());

      const [, options] = fetchSpy.mock.calls[0]!;
      const body = JSON.parse(options?.body as string) as Record<string, unknown>;
      // Azure uses deployment name in URL, not in body
      expect(body["model"]).toBeUndefined();
    });

    it("throws LLMError on non-retryable HTTP error", async () => {
      fetchSpy.mockResolvedValueOnce(createMockResponse({ error: "bad request" }, 400));

      await expect(provider.chat(createTestRequest())).rejects.toThrow(
        /Azure OpenAI API error/,
      );
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

      const toolChunks = (chunks as { type: string }[]).filter(
        (c) => c.type === "tool-call-delta",
      );
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
      fetchSpy.mockResolvedValueOnce(createMockResponse({ value: [] }));

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

    it("calls models endpoint with Azure api-key header", async () => {
      fetchSpy.mockResolvedValueOnce(createMockResponse({ value: [] }));

      await provider.healthCheck();

      expect(fetchSpy).toHaveBeenCalledOnce();
      const [url, options] = fetchSpy.mock.calls[0]!;
      expect(url).toContain("test-resource.openai.azure.com");
      expect(url).toContain("/openai/models");
      expect(url).toContain("api-version=");
      expect(options?.method).toBe("GET");
      const headers = options?.headers as Record<string, string>;
      expect(headers["api-key"]).toBe("test-api-key");
    });
  });

  describe("estimateCost()", () => {
    const usage = {
      promptTokens: 1_000_000,
      completionTokens: 500_000,
      totalTokens: 1_500_000,
    };

    it("uses default model (azure-gpt-4o) pricing when no modelId", () => {
      const cost = provider.estimateCost(usage);

      // azure-gpt-4o: input=$2.5/1M, output=$10/1M
      expect(cost.inputCost).toBeCloseTo(2.5);
      expect(cost.outputCost).toBeCloseTo(5.0);
      expect(cost.totalCost).toBeCloseTo(7.5);
      expect(cost.currency).toBe("USD");
    });

    it("uses specific model pricing for azure-gpt-4o-mini", () => {
      const cost = provider.estimateCost(usage, "azure-gpt-4o-mini");

      // azure-gpt-4o-mini: input=$0.15/1M, output=$0.60/1M
      expect(cost.inputCost).toBeCloseTo(0.15);
      expect(cost.outputCost).toBeCloseTo(0.30);
      expect(cost.totalCost).toBeCloseTo(0.45);
    });

    it("uses specific model pricing for azure-gpt-4-turbo", () => {
      const cost = provider.estimateCost(usage, "azure-gpt-4-turbo");

      // azure-gpt-4-turbo: input=$10/1M, output=$30/1M
      expect(cost.inputCost).toBeCloseTo(10.0);
      expect(cost.outputCost).toBeCloseTo(15.0);
      expect(cost.totalCost).toBeCloseTo(25.0);
    });

    it("uses specific model pricing for azure-gpt-35-turbo", () => {
      const cost = provider.estimateCost(usage, "azure-gpt-35-turbo");

      // azure-gpt-35-turbo: input=$0.5/1M, output=$1.5/1M
      expect(cost.inputCost).toBeCloseTo(0.5);
      expect(cost.outputCost).toBeCloseTo(0.75);
      expect(cost.totalCost).toBeCloseTo(1.25);
    });

    it("falls back to default pricing for unknown model", () => {
      const cost = provider.estimateCost(usage, "azure-unknown-model");

      // Falls back to azure-gpt-4o pricing
      expect(cost.inputCost).toBeCloseTo(2.5);
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
    it("uses custom api version in URL", async () => {
      const customProvider = createTestProvider({ apiVersion: "2023-12-01-preview" });

      fetchSpy.mockResolvedValueOnce(
        createMockResponse(createChatCompletionResponse("ok")),
      );

      await customProvider.chat(createTestRequest());

      const [url] = fetchSpy.mock.calls[0]!;
      expect(url).toContain("api-version=2023-12-01-preview");
    });

    it("uses custom deployment name in URL", async () => {
      const customProvider = createTestProvider({ deploymentName: "my-gpt4-deployment" });

      fetchSpy.mockResolvedValueOnce(
        createMockResponse(createChatCompletionResponse("ok")),
      );

      await customProvider.chat(createTestRequest());

      const [url] = fetchSpy.mock.calls[0]!;
      expect(url).toContain("/deployments/my-gpt4-deployment/");
    });

    it("uses custom resource name in URL", async () => {
      const customProvider = createTestProvider({ resourceName: "my-custom-resource" });

      fetchSpy.mockResolvedValueOnce(
        createMockResponse(createChatCompletionResponse("ok")),
      );

      await customProvider.chat(createTestRequest());

      const [url] = fetchSpy.mock.calls[0]!;
      expect(url).toContain("my-custom-resource.openai.azure.com");
    });
  });
});
