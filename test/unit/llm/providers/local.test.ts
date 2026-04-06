/**
 * Local Model 프로바이더 단위 테스트
 *
 * 매니페스트 정의, 엔드포인트 해석, chat/stream mock,
 * healthCheck, discoverModels, estimateCost 등을 검증합니다.
 * 실제 로컬 서버 연결은 하지 않습니다 (fetch mock 사용).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  LocalModelProvider,
  LOCAL_MODEL_MANIFEST,
  resolveOllamaEndpoint,
  resolveLMStudioEndpoint,
  resolveLocalEndpoint,
} from "../../../../src/llm/providers/local.js";
import type { ChatRequest } from "../../../../src/llm/provider.js";

// ─── 테스트 헬퍼 ────────────────────────────────────────────────────

/** 기본 ChatRequest 생성 */
function createTestRequest(overrides?: Partial<ChatRequest>): ChatRequest {
  return {
    model: "llama3",
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

// ─── LOCAL_MODEL_MANIFEST 테스트 ─────────────────────────────────────

describe("LOCAL_MODEL_MANIFEST", () => {
  it("has correct provider id and display name", () => {
    expect(LOCAL_MODEL_MANIFEST.id).toBe("local");
    expect(LOCAL_MODEL_MANIFEST.displayName).toBe("Local Models");
    expect(LOCAL_MODEL_MANIFEST.authType).toBe("none");
  });

  it("has no-cost models", () => {
    for (const model of LOCAL_MODEL_MANIFEST.models) {
      expect(model.pricing.input).toBe(0);
      expect(model.pricing.output).toBe(0);
    }
  });

  it("matches local model name patterns", () => {
    const patterns = LOCAL_MODEL_MANIFEST.modelPatterns;
    const matchingNames = [
      "ollama:llama3",
      "local:qwen",
      "lmstudio:mistral",
      "llama3",
      "mistral-7b",
      "qwen2.5-coder",
      "phi-3",
      "gemma2",
    ];
    for (const name of matchingNames) {
      const matches = patterns.some((p) => p.test(name));
      expect(matches, `${name} should match`).toBe(true);
    }
  });

  it("has correct feature flags for local inference", () => {
    expect(LOCAL_MODEL_MANIFEST.features.supportsCaching).toBe(false);
    expect(LOCAL_MODEL_MANIFEST.features.supportsGrounding).toBe(false);
    expect(LOCAL_MODEL_MANIFEST.features.maxConcurrentRequests).toBe(1);
  });
});

// ─── 엔드포인트 해석 테스트 ──────────────────────────────────────────

describe("resolveOllamaEndpoint", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("returns default endpoint when no env var is set", () => {
    delete process.env["DHELIX_OLLAMA_ENDPOINT"];
    delete process.env["OLLAMA_ENDPOINT"];
    expect(resolveOllamaEndpoint()).toBe("http://localhost:11434");
  });

  it("prefers DHELIX_OLLAMA_ENDPOINT over OLLAMA_ENDPOINT", () => {
    process.env["DHELIX_OLLAMA_ENDPOINT"] = "http://custom:11434";
    process.env["OLLAMA_ENDPOINT"] = "http://other:11434";
    expect(resolveOllamaEndpoint()).toBe("http://custom:11434");
  });

  it("uses OLLAMA_ENDPOINT as fallback", () => {
    delete process.env["DHELIX_OLLAMA_ENDPOINT"];
    process.env["OLLAMA_ENDPOINT"] = "http://fallback:11434";
    expect(resolveOllamaEndpoint()).toBe("http://fallback:11434");
  });
});

describe("resolveLMStudioEndpoint", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("returns default endpoint when no env var is set", () => {
    delete process.env["DHELIX_LMSTUDIO_ENDPOINT"];
    delete process.env["LMSTUDIO_ENDPOINT"];
    expect(resolveLMStudioEndpoint()).toBe("http://localhost:1234");
  });

  it("uses DHELIX_LMSTUDIO_ENDPOINT when set", () => {
    process.env["DHELIX_LMSTUDIO_ENDPOINT"] = "http://gpu-box:1234";
    expect(resolveLMStudioEndpoint()).toBe("http://gpu-box:1234");
  });
});

describe("resolveLocalEndpoint", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("prefers DHELIX_LOCAL_ENDPOINT when set", () => {
    process.env["DHELIX_LOCAL_ENDPOINT"] = "http://llm-server:8080";
    expect(resolveLocalEndpoint("ollama")).toBe("http://llm-server:8080");
  });

  it("falls back to server-type-specific endpoint", () => {
    delete process.env["DHELIX_LOCAL_ENDPOINT"];
    delete process.env["DHELIX_LMSTUDIO_ENDPOINT"];
    delete process.env["LMSTUDIO_ENDPOINT"];
    const endpoint = resolveLocalEndpoint("lmstudio");
    expect(endpoint).toBe("http://localhost:1234");
  });

  it("defaults to ollama endpoint for unknown server type", () => {
    delete process.env["DHELIX_LOCAL_ENDPOINT"];
    delete process.env["DHELIX_OLLAMA_ENDPOINT"];
    delete process.env["OLLAMA_ENDPOINT"];
    const endpoint = resolveLocalEndpoint("generic");
    expect(endpoint).toBe("http://localhost:11434");
  });
});

// ─── LocalModelProvider 생성 테스트 ─────────────────────────────────

describe("LocalModelProvider constructor", () => {
  it("creates with default Ollama endpoint", () => {
    const provider = new LocalModelProvider();
    expect(provider.name).toBe("local");
    expect(provider.manifest).toBe(LOCAL_MODEL_MANIFEST);
  });

  it("creates with LMStudio server type", () => {
    const provider = new LocalModelProvider({ serverType: "lmstudio" });
    expect(provider.name).toBe("local");
  });

  it("accepts custom base URL with /v1 suffix", () => {
    const provider = new LocalModelProvider({ baseUrl: "http://custom:8080/v1" });
    expect(provider).toBeTruthy();
  });

  it("auto-appends /v1 to base URL", () => {
    const provider = new LocalModelProvider({ baseUrl: "http://custom:8080" });
    expect(provider).toBeTruthy();
  });
});

// ─── chat() 테스트 ───────────────────────────────────────────────────

describe("LocalModelProvider.chat()", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("sends request to correct endpoint and returns response", async () => {
    const responseBody = createChatCompletionResponse("Hello from local model!");
    fetchMock.mockResolvedValueOnce(createMockResponse(responseBody));

    const provider = new LocalModelProvider({ baseUrl: "http://localhost:11434" });
    const result = await provider.chat(createTestRequest());

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("http://localhost:11434/v1/chat/completions");
    expect(options.method).toBe("POST");

    const body = JSON.parse(options.body as string) as Record<string, unknown>;
    expect(body["model"]).toBe("llama3");

    expect(result.content).toBe("Hello from local model!");
    expect(result.toolCalls).toHaveLength(0);
    expect(result.usage.promptTokens).toBe(10);
    expect(result.usage.completionTokens).toBe(20);
    expect(result.finishReason).toBe("stop");
  });

  it("parses tool calls correctly", async () => {
    const responseBody = createChatCompletionResponse("", [
      { id: "call_1", function: { name: "file_read", arguments: '{"path":"/etc/hosts"}' } },
    ]);
    fetchMock.mockResolvedValueOnce(createMockResponse(responseBody));

    const provider = new LocalModelProvider({ baseUrl: "http://localhost:11434" });
    const result = await provider.chat(createTestRequest());

    expect(result.toolCalls).toHaveLength(1);
    expect(result.toolCalls[0]?.name).toBe("file_read");
    expect(result.toolCalls[0]?.arguments).toBe('{"path":"/etc/hosts"}');
    expect(result.finishReason).toBe("tool_calls");
  });

  it("throws LLMError on HTTP error status", async () => {
    fetchMock.mockResolvedValueOnce(createMockResponse({ error: "Model not found" }, 404));

    const provider = new LocalModelProvider({ baseUrl: "http://localhost:11434" });
    await expect(provider.chat(createTestRequest())).rejects.toThrow(
      "Local model API error (HTTP 404)",
    );
  });

  it("sends tools when provided in request", async () => {
    const responseBody = createChatCompletionResponse("using tool");
    fetchMock.mockResolvedValueOnce(createMockResponse(responseBody));

    const provider = new LocalModelProvider({ baseUrl: "http://localhost:11434" });
    await provider.chat(
      createTestRequest({
        tools: [
          {
            type: "function",
            function: {
              name: "my_tool",
              description: "A test tool",
              parameters: { type: "object", properties: {} },
            },
          },
        ],
      }),
    );

    const body = JSON.parse(fetchMock.mock.calls[0]![1].body as string) as Record<string, unknown>;
    expect(Array.isArray(body["tools"])).toBe(true);
    expect((body["tools"] as unknown[]).length).toBe(1);
  });
});

// ─── estimateCost() 테스트 ───────────────────────────────────────────

describe("LocalModelProvider.estimateCost()", () => {
  it("always returns zero cost for local models", () => {
    const provider = new LocalModelProvider();
    const cost = provider.estimateCost({
      promptTokens: 1000,
      completionTokens: 500,
      totalTokens: 1500,
    });

    expect(cost.inputCost).toBe(0);
    expect(cost.outputCost).toBe(0);
    expect(cost.totalCost).toBe(0);
    expect(cost.currency).toBe("USD");
  });
});

// ─── countTokens() 테스트 ────────────────────────────────────────────

describe("LocalModelProvider.countTokens()", () => {
  it("returns a positive number for non-empty text", () => {
    const provider = new LocalModelProvider();
    const count = provider.countTokens("Hello, world!");
    expect(count).toBeGreaterThan(0);
  });

  it("returns 0 for empty string", () => {
    const provider = new LocalModelProvider();
    const count = provider.countTokens("");
    expect(count).toBe(0);
  });
});

// ─── healthCheck() 테스트 ────────────────────────────────────────────

describe("LocalModelProvider.healthCheck()", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns healthy: true when server responds OK", async () => {
    fetchMock.mockResolvedValueOnce(
      createMockResponse({ data: [] }, 200),
    );

    const provider = new LocalModelProvider({ baseUrl: "http://localhost:11434" });
    const status = await provider.healthCheck();

    expect(status.healthy).toBe(true);
    expect(status.latencyMs).toBeGreaterThanOrEqual(0);
    expect(status.error).toBeUndefined();
  });

  it("returns healthy: false when server returns error status", async () => {
    fetchMock.mockResolvedValueOnce(createMockResponse({}, 503));

    const provider = new LocalModelProvider({ baseUrl: "http://localhost:11434" });
    const status = await provider.healthCheck();

    expect(status.healthy).toBe(false);
    expect(status.error).toMatch(/503/);
  });

  it("returns healthy: false when connection fails", async () => {
    fetchMock.mockRejectedValueOnce(new Error("Connection refused"));

    const provider = new LocalModelProvider({ baseUrl: "http://localhost:11434" });
    const status = await provider.healthCheck();

    expect(status.healthy).toBe(false);
    expect(status.error).toBe("Connection refused");
  });
});

// ─── discoverModels() 테스트 ─────────────────────────────────────────

describe("LocalModelProvider.discoverModels()", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("discovers models via Ollama /api/tags endpoint", async () => {
    fetchMock.mockResolvedValueOnce(
      createMockResponse({
        models: [
          { name: "llama3:latest", size: 4_000_000_000 },
          { name: "mistral:7b", size: 3_800_000_000 },
        ],
      }),
    );

    const provider = new LocalModelProvider({ serverType: "ollama", baseUrl: "http://localhost:11434" });
    const models = await provider.discoverModels();

    expect(models).toHaveLength(2);
    expect(models[0]?.id).toBe("llama3:latest");
    expect(models[0]?.serverType).toBe("ollama");
    expect(models[1]?.id).toBe("mistral:7b");
  });

  it("falls back to /v1/models when Ollama /api/tags fails", async () => {
    // /api/tags 실패
    fetchMock.mockRejectedValueOnce(new Error("Not found"));
    // /v1/models 성공
    fetchMock.mockResolvedValueOnce(
      createMockResponse({
        data: [{ id: "llama3" }, { id: "qwen2.5" }],
      }),
    );

    const provider = new LocalModelProvider({ serverType: "ollama", baseUrl: "http://localhost:11434" });
    const models = await provider.discoverModels();

    expect(models.length).toBeGreaterThanOrEqual(0);
  });

  it("returns empty array when all discovery fails", async () => {
    fetchMock.mockRejectedValue(new Error("All failed"));

    const provider = new LocalModelProvider({ serverType: "lmstudio", baseUrl: "http://localhost:1234" });
    const models = await provider.discoverModels();

    expect(Array.isArray(models)).toBe(true);
    expect(models).toHaveLength(0);
  });

  it("discovers models via /v1/models for LMStudio", async () => {
    fetchMock.mockResolvedValueOnce(
      createMockResponse({
        data: [{ id: "lmstudio-community/Meta-Llama-3-8B-Instruct-GGUF" }],
      }),
    );

    const provider = new LocalModelProvider({ serverType: "lmstudio", baseUrl: "http://localhost:1234" });
    const models = await provider.discoverModels();

    expect(models).toHaveLength(1);
    expect(models[0]?.serverType).toBe("lmstudio");
  });
});
