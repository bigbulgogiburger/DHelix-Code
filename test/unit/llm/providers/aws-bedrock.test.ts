/**
 * AWS Bedrock 프로바이더 단위 테스트
 *
 * 매니페스트 정의, 모델 패턴 매칭, chat/stream mock,
 * healthCheck, estimateCost 계산, SigV4 서명을 검증합니다.
 * 실제 API 호출은 하지 않습니다.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  AwsBedrockProvider,
  AWS_BEDROCK_MANIFEST,
  resolveBedrockCredentials,
} from "../../../../src/llm/providers/aws-bedrock.js";
import type { ChatRequest } from "../../../../src/llm/provider.js";

// ─── 테스트 헬퍼 ────────────────────────────────────────────────────

/** 기본 ChatRequest 생성 */
function createTestRequest(overrides?: Partial<ChatRequest>): ChatRequest {
  return {
    model: "bedrock-claude-3.5-sonnet",
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

/** Bedrock Converse API 응답 생성 */
function createBedrockResponse(
  text: string,
  toolUses?: { toolUseId: string; name: string; input: Record<string, unknown> }[],
) {
  const content: unknown[] = [];
  if (text) {
    content.push({ text });
  }
  if (toolUses) {
    for (const tu of toolUses) {
      content.push({ toolUse: tu });
    }
  }

  return {
    output: {
      message: {
        role: "assistant",
        content,
      },
    },
    usage: {
      inputTokens: 10,
      outputTokens: 20,
      totalTokens: 30,
    },
    stopReason: toolUses && toolUses.length > 0 ? "tool_use" : "end_turn",
  };
}

// ─── AWS_BEDROCK_MANIFEST 테스트 ────────────────────────────────────

describe("AWS_BEDROCK_MANIFEST", () => {
  it("has correct provider id and display name", () => {
    expect(AWS_BEDROCK_MANIFEST.id).toBe("aws-bedrock");
    expect(AWS_BEDROCK_MANIFEST.displayName).toBe("AWS Bedrock");
    expect(AWS_BEDROCK_MANIFEST.authType).toBe("iam");
  });

  it("defines five models", () => {
    expect(AWS_BEDROCK_MANIFEST.models).toHaveLength(5);
    const ids = AWS_BEDROCK_MANIFEST.models.map((m) => m.id);
    expect(ids).toContain("bedrock-claude-3.5-sonnet");
    expect(ids).toContain("bedrock-claude-3-haiku");
    expect(ids).toContain("nova-pro");
    expect(ids).toContain("nova-lite");
    expect(ids).toContain("nova-micro");
  });

  it("models have correct tiers", () => {
    const modelMap = new Map(AWS_BEDROCK_MANIFEST.models.map((m) => [m.id, m]));
    expect(modelMap.get("bedrock-claude-3.5-sonnet")?.tier).toBe("high");
    expect(modelMap.get("nova-pro")?.tier).toBe("high");
    expect(modelMap.get("nova-lite")?.tier).toBe("low");
    expect(modelMap.get("nova-micro")?.tier).toBe("low");
  });

  describe("model pattern matching", () => {
    const patterns = AWS_BEDROCK_MANIFEST.modelPatterns;

    it("matches bedrock- prefix", () => {
      expect(patterns.some((p) => p.test("bedrock-claude-3.5-sonnet"))).toBe(true);
      expect(patterns.some((p) => p.test("bedrock-claude-3-haiku"))).toBe(true);
    });

    it("matches aws- prefix", () => {
      expect(patterns.some((p) => p.test("aws-claude"))).toBe(true);
    });

    it("matches nova- prefix", () => {
      expect(patterns.some((p) => p.test("nova-pro"))).toBe(true);
      expect(patterns.some((p) => p.test("nova-lite"))).toBe(true);
      expect(patterns.some((p) => p.test("nova-micro"))).toBe(true);
    });

    it("matches case-insensitively", () => {
      expect(patterns.some((p) => p.test("BEDROCK-claude"))).toBe(true);
      expect(patterns.some((p) => p.test("Nova-Pro"))).toBe(true);
    });

    it("does not match non-bedrock models", () => {
      expect(patterns.some((p) => p.test("claude-sonnet-4"))).toBe(false);
      expect(patterns.some((p) => p.test("gpt-4o"))).toBe(false);
      expect(patterns.some((p) => p.test("gemini-2.5-pro"))).toBe(false);
    });
  });
});

// ─── resolveBedrockCredentials 테스트 ───────────────────────────────

describe("resolveBedrockCredentials", () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("returns DHELIX_ credentials first", () => {
    process.env["DHELIX_AWS_ACCESS_KEY_ID"] = "dhelix-key-id";
    process.env["DHELIX_AWS_SECRET_ACCESS_KEY"] = "dhelix-secret";
    process.env["AWS_ACCESS_KEY_ID"] = "aws-key-id";
    process.env["AWS_SECRET_ACCESS_KEY"] = "aws-secret";

    const creds = resolveBedrockCredentials();
    expect(creds?.accessKeyId).toBe("dhelix-key-id");
    expect(creds?.secretAccessKey).toBe("dhelix-secret");
  });

  it("falls back to AWS_ credentials", () => {
    delete process.env["DHELIX_AWS_ACCESS_KEY_ID"];
    delete process.env["DHELIX_AWS_SECRET_ACCESS_KEY"];
    process.env["AWS_ACCESS_KEY_ID"] = "aws-key-id";
    process.env["AWS_SECRET_ACCESS_KEY"] = "aws-secret";

    const creds = resolveBedrockCredentials();
    expect(creds?.accessKeyId).toBe("aws-key-id");
    expect(creds?.secretAccessKey).toBe("aws-secret");
  });

  it("uses DHELIX_AWS_REGION when set", () => {
    process.env["DHELIX_AWS_ACCESS_KEY_ID"] = "key";
    process.env["DHELIX_AWS_SECRET_ACCESS_KEY"] = "secret";
    process.env["DHELIX_AWS_REGION"] = "ap-northeast-2";

    const creds = resolveBedrockCredentials();
    expect(creds?.region).toBe("ap-northeast-2");
  });

  it("defaults to us-east-1 when no region set", () => {
    process.env["DHELIX_AWS_ACCESS_KEY_ID"] = "key";
    process.env["DHELIX_AWS_SECRET_ACCESS_KEY"] = "secret";
    delete process.env["DHELIX_AWS_REGION"];
    delete process.env["AWS_DEFAULT_REGION"];

    const creds = resolveBedrockCredentials();
    expect(creds?.region).toBe("us-east-1");
  });

  it("returns undefined when credentials are missing", () => {
    delete process.env["DHELIX_AWS_ACCESS_KEY_ID"];
    delete process.env["DHELIX_AWS_SECRET_ACCESS_KEY"];
    delete process.env["AWS_ACCESS_KEY_ID"];
    delete process.env["AWS_SECRET_ACCESS_KEY"];

    expect(resolveBedrockCredentials()).toBeUndefined();
  });
});

// ─── AwsBedrockProvider 테스트 ───────────────────────────────────────

describe("AwsBedrockProvider", () => {
  let provider: AwsBedrockProvider;
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    provider = new AwsBedrockProvider({
      accessKeyId: "AKIATEST",
      secretAccessKey: "test-secret",
      region: "us-east-1",
    });
    fetchSpy = vi.spyOn(globalThis, "fetch");
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("throws when no credentials are available", () => {
    const originalEnv = { ...process.env };
    delete process.env["DHELIX_AWS_ACCESS_KEY_ID"];
    delete process.env["DHELIX_AWS_SECRET_ACCESS_KEY"];
    delete process.env["AWS_ACCESS_KEY_ID"];
    delete process.env["AWS_SECRET_ACCESS_KEY"];

    expect(() => new AwsBedrockProvider()).toThrow(/credentials not found/);

    process.env = originalEnv;
  });

  it("has correct provider name and manifest", () => {
    expect(provider.name).toBe("aws-bedrock");
    expect(provider.manifest.id).toBe("aws-bedrock");
  });

  describe("chat()", () => {
    it("returns parsed response from Bedrock Converse API", async () => {
      const mockBody = createBedrockResponse("Hello from Bedrock!");
      fetchSpy.mockResolvedValueOnce(createMockResponse(mockBody));

      const result = await provider.chat(createTestRequest());

      expect(result.content).toBe("Hello from Bedrock!");
      expect(result.toolCalls).toHaveLength(0);
      expect(result.usage.promptTokens).toBe(10);
      expect(result.usage.completionTokens).toBe(20);
      expect(result.usage.totalTokens).toBe(30);
      expect(result.finishReason).toBe("end_turn");
    });

    it("parses tool calls from response", async () => {
      const mockBody = createBedrockResponse("", [
        {
          toolUseId: "call_1",
          name: "file_read",
          input: { path: "/tmp/test.txt" },
        },
      ]);
      fetchSpy.mockResolvedValueOnce(createMockResponse(mockBody));

      const result = await provider.chat(createTestRequest());

      expect(result.toolCalls).toHaveLength(1);
      expect(result.toolCalls[0]!.id).toBe("call_1");
      expect(result.toolCalls[0]!.name).toBe("file_read");
      expect(JSON.parse(result.toolCalls[0]!.arguments)).toEqual({
        path: "/tmp/test.txt",
      });
    });

    it("sends request to correct Bedrock endpoint with SigV4 headers", async () => {
      fetchSpy.mockResolvedValueOnce(
        createMockResponse(createBedrockResponse("ok")),
      );

      await provider.chat(createTestRequest());

      expect(fetchSpy).toHaveBeenCalledOnce();
      const [url, options] = fetchSpy.mock.calls[0]!;
      expect(url).toContain("bedrock-runtime.us-east-1.amazonaws.com");
      expect(url).toContain("/converse");

      const headers = options?.headers as Record<string, string>;
      expect(headers["Authorization"]).toMatch(/^AWS4-HMAC-SHA256/);
      expect(headers["x-amz-date"]).toBeDefined();
      expect(headers["x-amz-content-sha256"]).toBeDefined();
    });

    it("includes system message in request body", async () => {
      fetchSpy.mockResolvedValueOnce(
        createMockResponse(createBedrockResponse("ok")),
      );

      await provider.chat({
        ...createTestRequest(),
        messages: [
          { role: "system", content: "You are helpful." },
          { role: "user", content: "Hi" },
        ],
      });

      const [, options] = fetchSpy.mock.calls[0]!;
      const body = JSON.parse(options?.body as string) as Record<string, unknown>;
      expect(body["system"]).toBeDefined();
    });

    it("includes tools in toolConfig", async () => {
      fetchSpy.mockResolvedValueOnce(
        createMockResponse(createBedrockResponse("ok")),
      );

      await provider.chat(
        createTestRequest({
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

      const [, options] = fetchSpy.mock.calls[0]!;
      const body = JSON.parse(options?.body as string) as Record<string, unknown>;
      expect(body["toolConfig"]).toBeDefined();
    });

    it("throws LLMError on non-retryable HTTP error", async () => {
      fetchSpy.mockResolvedValueOnce(createMockResponse({ message: "Forbidden" }, 403));

      await expect(provider.chat(createTestRequest())).rejects.toThrow(/Bedrock API error/);
    });
  });

  describe("stream()", () => {
    it("yields text-delta and done chunks", async () => {
      const events = [
        JSON.stringify({
          contentBlockDelta: { delta: { text: "Hello" } },
        }),
        JSON.stringify({
          contentBlockDelta: { delta: { text: " world" } },
        }),
        JSON.stringify({
          messageStop: { stopReason: "end_turn" },
        }),
        JSON.stringify({
          metadata: { usage: { inputTokens: 5, outputTokens: 2 } },
        }),
      ].join("\n");

      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue(encoder.encode(events));
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
      fetchSpy.mockResolvedValueOnce(createMockResponse({ modelSummaries: [] }));

      const result = await provider.healthCheck();

      expect(result.healthy).toBe(true);
      expect(result.latencyMs).toBeGreaterThanOrEqual(0);
      expect(result.error).toBeUndefined();
    });

    it("returns unhealthy status on HTTP error", async () => {
      fetchSpy.mockResolvedValueOnce(createMockResponse({}, 403));

      const result = await provider.healthCheck();

      expect(result.healthy).toBe(false);
      expect(result.error).toContain("403");
    });

    it("returns unhealthy status on network error", async () => {
      fetchSpy.mockRejectedValueOnce(new Error("Network error"));

      const result = await provider.healthCheck();

      expect(result.healthy).toBe(false);
      expect(result.error).toBe("Network error");
    });

    it("calls bedrock foundation-models endpoint", async () => {
      fetchSpy.mockResolvedValueOnce(createMockResponse({ modelSummaries: [] }));

      await provider.healthCheck();

      expect(fetchSpy).toHaveBeenCalledOnce();
      const [url] = fetchSpy.mock.calls[0]!;
      expect(url).toContain("bedrock.us-east-1.amazonaws.com");
      expect(url).toContain("foundation-models");
    });
  });

  describe("estimateCost()", () => {
    const usage = {
      promptTokens: 1_000_000,
      completionTokens: 500_000,
      totalTokens: 1_500_000,
    };

    it("uses default model (bedrock-claude-3.5-sonnet) pricing when no modelId", () => {
      const cost = provider.estimateCost(usage);

      // claude-3.5-sonnet: input=$3/1M, output=$15/1M
      expect(cost.inputCost).toBeCloseTo(3.0);
      expect(cost.outputCost).toBeCloseTo(7.5);
      expect(cost.totalCost).toBeCloseTo(10.5);
      expect(cost.currency).toBe("USD");
    });

    it("uses specific model pricing when modelId is provided", () => {
      const cost = provider.estimateCost(usage, "nova-pro");

      // nova-pro: input=$0.8/1M, output=$3.2/1M
      expect(cost.inputCost).toBeCloseTo(0.8);
      expect(cost.outputCost).toBeCloseTo(1.6);
      expect(cost.totalCost).toBeCloseTo(2.4);
    });

    it("falls back to default pricing for unknown model", () => {
      const cost = provider.estimateCost(usage, "unknown-model");

      expect(cost.inputCost).toBeCloseTo(3.0);
      expect(cost.outputCost).toBeCloseTo(7.5);
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
    it("uses custom region in endpoint", async () => {
      const apProvider = new AwsBedrockProvider({
        accessKeyId: "AKIATEST",
        secretAccessKey: "test-secret",
        region: "ap-northeast-2",
      });

      fetchSpy.mockResolvedValueOnce(
        createMockResponse(createBedrockResponse("ok")),
      );

      await apProvider.chat(createTestRequest());

      const [url] = fetchSpy.mock.calls[0]!;
      expect(url).toContain("ap-northeast-2");
    });
  });
});
