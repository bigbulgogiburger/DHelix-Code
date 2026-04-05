/**
 * ProviderRegistry 단위 테스트
 *
 * register/resolve/list/getProvider 기본 동작과
 * 에러 케이스를 검증합니다.
 */
import { describe, it, expect, beforeEach } from "vitest";
import {
  ProviderRegistry,
  createUnifiedAdapter,
  resolveApiKey,
  ANTHROPIC_MANIFEST,
  OPENAI_COMPATIBLE_MANIFEST,
  RESPONSES_API_MANIFEST,
} from "../../../../src/llm/providers/registry.js";
import type {
  ProviderManifest,
  UnifiedLLMProvider,
} from "../../../../src/llm/providers/types.js";
import type {
  LLMProvider,
  ChatRequest,
  ChatResponse,
  ChatChunk,
} from "../../../../src/llm/provider.js";

// ─── 테스트 헬퍼 ────────────────────────────────────────────────────

/** 최소한의 LLMProvider mock */
function createMockProvider(name: string): LLMProvider {
  return {
    name,
    async chat(_request: ChatRequest): Promise<ChatResponse> {
      return {
        content: "mock response",
        toolCalls: [],
        usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
        finishReason: "stop",
      };
    },
    async *stream(_request: ChatRequest): AsyncIterable<ChatChunk> {
      yield { type: "text-delta", text: "mock" };
      yield { type: "done", usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 } };
    },
    countTokens(_text: string): number {
      return 42;
    },
  };
}

/** 테스트용 매니페스트 생성 */
function createTestManifest(id: string, patterns: RegExp[]): ProviderManifest {
  return {
    id,
    displayName: `Test ${id}`,
    authType: "api-key",
    modelPatterns: patterns,
    models: [
      {
        id: `${id}-model`,
        tier: "high",
        context: 100_000,
        pricing: { input: 1, output: 3 },
      },
    ],
    features: {
      supportsCaching: false,
      supportsGrounding: false,
      supportsImageInput: false,
      supportsReasoningTrace: false,
      maxConcurrentRequests: 10,
      rateLimitStrategy: "token-bucket",
    },
  };
}

/** 테스트용 UnifiedLLMProvider 팩토리 */
function createTestFactory(manifest: ProviderManifest): () => UnifiedLLMProvider {
  return () => createUnifiedAdapter(createMockProvider(manifest.id), manifest);
}

// ─── 테스트 ─────────────────────────────────────────────────────────

describe("ProviderRegistry", () => {
  let registry: ProviderRegistry;

  beforeEach(() => {
    registry = new ProviderRegistry();
  });

  describe("register", () => {
    it("프로바이더를 등록할 수 있다", () => {
      const manifest = createTestManifest("test-provider", [/^test-/i]);
      registry.register(manifest, createTestFactory(manifest));

      expect(registry.size).toBe(1);
    });

    it("같은 ID로 재등록하면 덮어쓴다", () => {
      const manifest1 = createTestManifest("test-provider", [/^test-/i]);
      const manifest2 = createTestManifest("test-provider", [/^test-v2-/i]);

      registry.register(manifest1, createTestFactory(manifest1));
      registry.register(manifest2, createTestFactory(manifest2));

      expect(registry.size).toBe(1);
      const providers = registry.listProviders();
      expect(providers[0]?.modelPatterns[0]?.source).toBe("^test-v2-");
    });

    it("여러 프로바이더를 등록할 수 있다", () => {
      const m1 = createTestManifest("provider-a", [/^a-/i]);
      const m2 = createTestManifest("provider-b", [/^b-/i]);

      registry.register(m1, createTestFactory(m1));
      registry.register(m2, createTestFactory(m2));

      expect(registry.size).toBe(2);
    });
  });

  describe("resolve", () => {
    it("모델 이름으로 프로바이더를 resolve할 수 있다", () => {
      const manifest = createTestManifest("anthropic-test", [/^claude/i]);
      registry.register(manifest, createTestFactory(manifest));

      const provider = registry.resolve("claude-sonnet-4-20250514");
      expect(provider.name).toBe("anthropic-test");
      expect(provider.manifest.id).toBe("anthropic-test");
    });

    it("resolve된 인스턴스는 캐싱된다", () => {
      const manifest = createTestManifest("cached-test", [/^cached-/i]);
      registry.register(manifest, createTestFactory(manifest));

      const first = registry.resolve("cached-model");
      const second = registry.resolve("cached-other-model");

      expect(first).toBe(second); // 같은 인스턴스 참조
    });

    it("여러 패턴 중 하나라도 매칭되면 resolve된다", () => {
      const manifest = createTestManifest("multi-pattern", [/^alpha-/i, /^beta-/i]);
      registry.register(manifest, createTestFactory(manifest));

      const alpha = registry.resolve("alpha-model");
      const beta = registry.resolve("beta-model");

      expect(alpha.manifest.id).toBe("multi-pattern");
      expect(beta.manifest.id).toBe("multi-pattern");
    });

    it("등록되지 않은 모델에 대해 에러를 던진다", () => {
      expect(() => registry.resolve("unknown-model")).toThrow(
        /No provider registered for model "unknown-model"/,
      );
    });

    it("에러 메시지에 등록된 프로바이더 목록이 포함된다", () => {
      const m1 = createTestManifest("provider-a", [/^a-/i]);
      const m2 = createTestManifest("provider-b", [/^b-/i]);
      registry.register(m1, createTestFactory(m1));
      registry.register(m2, createTestFactory(m2));

      expect(() => registry.resolve("unknown-model")).toThrow(/provider-a, provider-b/);
    });

    it("더 먼저 등록된 프로바이더가 우선 매칭된다", () => {
      // 두 프로바이더 모두 "gpt-" 패턴에 매칭
      const specific = createTestManifest("specific", [/^gpt-5(\.\d+)?-codex/i]);
      const general = createTestManifest("general", [/^gpt-/i]);

      registry.register(specific, createTestFactory(specific));
      registry.register(general, createTestFactory(general));

      const codex = registry.resolve("gpt-5.1-codex");
      expect(codex.manifest.id).toBe("specific");

      const gpt4 = registry.resolve("gpt-4o");
      expect(gpt4.manifest.id).toBe("general");
    });
  });

  describe("listProviders", () => {
    it("빈 레지스트리는 빈 배열을 반환한다", () => {
      expect(registry.listProviders()).toEqual([]);
    });

    it("등록된 모든 매니페스트를 반환한다", () => {
      const m1 = createTestManifest("provider-a", [/^a-/i]);
      const m2 = createTestManifest("provider-b", [/^b-/i]);

      registry.register(m1, createTestFactory(m1));
      registry.register(m2, createTestFactory(m2));

      const list = registry.listProviders();
      expect(list).toHaveLength(2);
      expect(list.map((m) => m.id)).toEqual(["provider-a", "provider-b"]);
    });
  });

  describe("getProvider", () => {
    it("ID로 프로바이더를 조회할 수 있다", () => {
      const manifest = createTestManifest("my-provider", [/^my-/i]);
      registry.register(manifest, createTestFactory(manifest));

      const provider = registry.getProvider("my-provider");
      expect(provider).toBeDefined();
      expect(provider?.manifest.id).toBe("my-provider");
    });

    it("등록되지 않은 ID는 undefined를 반환한다", () => {
      expect(registry.getProvider("nonexistent")).toBeUndefined();
    });

    it("getProvider도 인스턴스를 캐싱한다", () => {
      const manifest = createTestManifest("cached-get", [/^cached-/i]);
      registry.register(manifest, createTestFactory(manifest));

      const first = registry.getProvider("cached-get");
      const second = registry.getProvider("cached-get");

      expect(first).toBe(second);
    });
  });

  describe("clear", () => {
    it("모든 등록을 초기화한다", () => {
      const m1 = createTestManifest("p1", [/^p1-/i]);
      registry.register(m1, createTestFactory(m1));

      expect(registry.size).toBe(1);
      registry.clear();
      expect(registry.size).toBe(0);
      expect(registry.listProviders()).toEqual([]);
    });
  });
});

describe("createUnifiedAdapter", () => {
  it("기존 LLMProvider를 UnifiedLLMProvider로 감싼다", () => {
    const manifest = createTestManifest("adapter-test", [/^test-/i]);
    const provider = createMockProvider("test-provider");
    const unified = createUnifiedAdapter(provider, manifest);

    expect(unified.name).toBe("test-provider");
    expect(unified.manifest.id).toBe("adapter-test");
  });

  it("chat 메서드를 위임한다", async () => {
    const manifest = createTestManifest("chat-test", [/^test-/i]);
    const provider = createMockProvider("test");
    const unified = createUnifiedAdapter(provider, manifest);

    const response = await unified.chat({
      model: "test-model",
      messages: [{ role: "user", content: "hello" }],
    });

    expect(response.content).toBe("mock response");
  });

  it("countTokens 메서드를 위임한다", () => {
    const manifest = createTestManifest("tokens-test", [/^test-/i]);
    const provider = createMockProvider("test");
    const unified = createUnifiedAdapter(provider, manifest);

    expect(unified.countTokens("hello")).toBe(42);
  });

  it("healthCheck가 정상 상태를 반환한다", async () => {
    const manifest = createTestManifest("health-test", [/^test-/i]);
    const provider = createMockProvider("test");
    const unified = createUnifiedAdapter(provider, manifest);

    const status = await unified.healthCheck();
    expect(status.healthy).toBe(true);
    expect(status.latencyMs).toBeGreaterThanOrEqual(0);
  });

  it("estimateCost가 비용을 계산한다", () => {
    const manifest = createTestManifest("cost-test", [/^test-/i]);
    const provider = createMockProvider("test");
    const unified = createUnifiedAdapter(provider, manifest);

    const cost = unified.estimateCost({
      promptTokens: 1_000_000,
      completionTokens: 1_000_000,
      totalTokens: 2_000_000,
    });

    // manifest models[0] pricing: input=1, output=3
    expect(cost.inputCost).toBe(1);
    expect(cost.outputCost).toBe(3);
    expect(cost.totalCost).toBe(4);
    expect(cost.currency).toBe("USD");
  });
});

describe("resolveApiKey", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    // 환경변수 초기화
    delete process.env.DHELIX_ANTHROPIC_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.DHELIX_OPENAI_API_KEY;
    delete process.env.OPENAI_API_KEY;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("DHELIX_ 접두사 키를 우선 조회한다", () => {
    process.env.DHELIX_ANTHROPIC_API_KEY = "dhelix-key";
    process.env.ANTHROPIC_API_KEY = "fallback-key";

    expect(resolveApiKey("anthropic")).toBe("dhelix-key");
  });

  it("DHELIX_ 키가 없으면 폴백 키를 사용한다", () => {
    process.env.ANTHROPIC_API_KEY = "fallback-key";

    expect(resolveApiKey("anthropic")).toBe("fallback-key");
  });

  it("키가 모두 없으면 undefined를 반환한다", () => {
    expect(resolveApiKey("anthropic")).toBeUndefined();
  });

  it("알 수 없는 프로바이더는 undefined를 반환한다", () => {
    expect(resolveApiKey("unknown-provider")).toBeUndefined();
  });
});

describe("기본 매니페스트", () => {
  it("ANTHROPIC_MANIFEST의 패턴이 Claude 모델과 매칭된다", () => {
    expect(ANTHROPIC_MANIFEST.modelPatterns[0]?.test("claude-sonnet-4")).toBe(true);
    expect(ANTHROPIC_MANIFEST.modelPatterns[0]?.test("gpt-4o")).toBe(false);
  });

  it("OPENAI_COMPATIBLE_MANIFEST의 패턴이 GPT/O 모델과 매칭된다", () => {
    expect(OPENAI_COMPATIBLE_MANIFEST.modelPatterns[0]?.test("gpt-4o")).toBe(true);
    expect(OPENAI_COMPATIBLE_MANIFEST.modelPatterns[1]?.test("o1-mini")).toBe(true);
    expect(OPENAI_COMPATIBLE_MANIFEST.modelPatterns[0]?.test("claude-sonnet-4")).toBe(false);
  });

  it("RESPONSES_API_MANIFEST의 패턴이 Codex 모델과 매칭된다", () => {
    expect(RESPONSES_API_MANIFEST.modelPatterns[0]?.test("gpt-5.1-codex")).toBe(true);
    expect(RESPONSES_API_MANIFEST.modelPatterns[0]?.test("gpt-4o")).toBe(false);
  });

  it("매니페스트에 필수 필드가 모두 있다", () => {
    for (const manifest of [ANTHROPIC_MANIFEST, OPENAI_COMPATIBLE_MANIFEST, RESPONSES_API_MANIFEST]) {
      expect(manifest.id).toBeTruthy();
      expect(manifest.displayName).toBeTruthy();
      expect(manifest.authType).toBeTruthy();
      expect(manifest.models.length).toBeGreaterThan(0);
      expect(manifest.features).toBeDefined();
      expect(manifest.modelPatterns.length).toBeGreaterThan(0);
    }
  });
});

// afterEach import for resolveApiKey tests
import { afterEach } from "vitest";
