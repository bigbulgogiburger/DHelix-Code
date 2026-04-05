/**
 * ProviderRegistry — 플러거블 LLM 프로바이더 레지스트리
 *
 * 하드코딩된 if-else 프로바이더 라우팅을 대체하는 중앙 레지스트리입니다.
 * 프로바이더를 매니페스트와 팩토리 함수로 등록하고,
 * 모델 이름으로 적절한 프로바이더를 resolve합니다.
 *
 * Resolution 흐름:
 * 1. 모델 이름 → 등록된 매니페스트의 modelPatterns 매칭 → 프로바이더 선택
 * 2. 팩토리 함수로 프로바이더 인스턴스 생성 (lazy, 캐싱)
 * 3. UnifiedLLMProvider 인스턴스 반환
 *
 * 사용 예:
 * ```typescript
 * const registry = ProviderRegistry.create();
 * registry.register(anthropicManifest, () => createAnthropicUnified());
 * const provider = registry.resolve("claude-sonnet-4-20250514");
 * ```
 */
import type {
  ProviderManifest,
  ProviderFactory,
  UnifiedLLMProvider,
  CostEstimate,
  ProviderHealthStatus,
} from "./types.js";
import type {
  LLMProvider,
  ChatRequest,
  ChatResponse,
  ChatChunk,
  TokenUsage,
} from "../provider.js";
import { LLMError } from "../../utils/error.js";
import { GOOGLE_GEMINI_MANIFEST } from "./google-gemini.js";

// ─── 기본 프로바이더 매니페스트 ───────────────────────────────────────

/**
 * Anthropic Claude 프로바이더 매니페스트
 *
 * Claude 모델 시리즈의 메타데이터와 기능을 정의합니다.
 */
export const ANTHROPIC_MANIFEST: ProviderManifest = {
  id: "anthropic",
  displayName: "Anthropic Claude",
  authType: "api-key",
  modelPatterns: [/^claude/i],
  models: [
    { id: "claude-opus-4", tier: "high", context: 200_000, pricing: { input: 15, output: 75 } },
    { id: "claude-sonnet-4", tier: "high", context: 200_000, pricing: { input: 3, output: 15 } },
    { id: "claude-haiku-4", tier: "medium", context: 200_000, pricing: { input: 0.8, output: 4 } },
    {
      id: "claude-3.5-sonnet",
      tier: "high",
      context: 200_000,
      pricing: { input: 3, output: 15 },
    },
    { id: "claude-3-opus", tier: "high", context: 200_000, pricing: { input: 15, output: 75 } },
    {
      id: "claude-3-haiku",
      tier: "medium",
      context: 200_000,
      pricing: { input: 0.25, output: 1.25 },
    },
  ],
  features: {
    supportsCaching: true,
    supportsGrounding: false,
    supportsImageInput: true,
    supportsReasoningTrace: true,
    maxConcurrentRequests: 50,
    rateLimitStrategy: "token-bucket",
  },
};

/**
 * OpenAI Compatible 프로바이더 매니페스트
 *
 * OpenAI API 호환 엔드포인트(OpenAI, Azure, Ollama, vLLM 등)의 메타데이터입니다.
 * modelPatterns가 비어 있으므로 패턴 매칭이 아닌 폴백으로 사용됩니다.
 */
export const OPENAI_COMPATIBLE_MANIFEST: ProviderManifest = {
  id: "openai-compatible",
  displayName: "OpenAI Compatible",
  authType: "api-key",
  modelPatterns: [/^gpt-/i, /^o[13]/i],
  models: [
    {
      id: "gpt-4o",
      tier: "high",
      context: 128_000,
      pricing: { input: 2.5, output: 10 },
    },
    {
      id: "gpt-4o-mini",
      tier: "medium",
      context: 128_000,
      pricing: { input: 0.15, output: 0.6 },
    },
  ],
  features: {
    supportsCaching: false,
    supportsGrounding: false,
    supportsImageInput: true,
    supportsReasoningTrace: false,
    maxConcurrentRequests: 100,
    rateLimitStrategy: "token-bucket",
  },
};

/**
 * Responses API 전용 프로바이더 매니페스트
 *
 * GPT-5 Codex 계열 모델 전용 Responses API 프로바이더입니다.
 */
export const RESPONSES_API_MANIFEST: ProviderManifest = {
  id: "responses-api",
  displayName: "OpenAI Responses API",
  authType: "api-key",
  modelPatterns: [/^gpt-5(\.\d+)?-codex/i],
  models: [
    {
      id: "gpt-5.1-codex",
      tier: "high",
      context: 400_000,
      pricing: { input: 0.25, output: 2 },
    },
  ],
  features: {
    supportsCaching: false,
    supportsGrounding: false,
    supportsImageInput: false,
    supportsReasoningTrace: false,
    maxConcurrentRequests: 50,
    rateLimitStrategy: "token-bucket",
  },
};

// ─── UnifiedLLMProvider 어댑터 ──────────────────────────────────────

/**
 * 기존 LLMProvider를 UnifiedLLMProvider로 감싸는 어댑터
 *
 * 기존 프로바이더 코드를 최소한으로 변경하면서
 * ProviderRegistry가 요구하는 인터페이스를 만족시킵니다.
 *
 * @param provider - 기존 LLMProvider 구현체
 * @param manifest - 프로바이더 매니페스트
 * @returns UnifiedLLMProvider 인터페이스를 구현하는 래퍼
 */
export function createUnifiedAdapter(
  provider: LLMProvider,
  manifest: ProviderManifest,
): UnifiedLLMProvider {
  return {
    // 기존 LLMProvider 메서드 위임
    get name(): string {
      return provider.name;
    },
    chat(request: ChatRequest): Promise<ChatResponse> {
      return provider.chat(request);
    },
    stream(request: ChatRequest): AsyncIterable<ChatChunk> {
      return provider.stream(request);
    },
    countTokens(text: string): number {
      return provider.countTokens(text);
    },

    // UnifiedLLMProvider 확장
    manifest,

    async healthCheck(): Promise<ProviderHealthStatus> {
      const start = Date.now();
      try {
        // 간단한 토큰 카운트로 프로바이더가 살아있는지 확인
        provider.countTokens("health check");
        return {
          healthy: true,
          latencyMs: Date.now() - start,
        };
      } catch (err) {
        return {
          healthy: false,
          latencyMs: Date.now() - start,
          error: err instanceof Error ? err.message : String(err),
        };
      }
    },

    estimateCost(tokens: TokenUsage): CostEstimate {
      // 매니페스트의 첫 번째 모델 가격을 기본값으로 사용
      const model = manifest.models[0];
      const inputRate = model?.pricing.input ?? 1;
      const outputRate = model?.pricing.output ?? 3;

      const inputCost = (tokens.promptTokens / 1_000_000) * inputRate;
      const outputCost = (tokens.completionTokens / 1_000_000) * outputRate;

      return {
        inputCost,
        outputCost,
        totalCost: inputCost + outputCost,
        currency: "USD",
      };
    },
  };
}

// ─── 환경변수 헬퍼 ──────────────────────────────────────────────────

/**
 * 프로바이더 ID에 맞는 API 키를 환경변수에서 조회
 *
 * DHELIX_ 접두사가 붙은 키를 우선 조회하고, 없으면 폴백 키를 조회합니다.
 *
 * @param providerId - 프로바이더 ID (예: "anthropic", "openai-compatible")
 * @returns API 키 또는 undefined
 */
export function resolveApiKey(providerId: string): string | undefined {
  const envMap: Record<string, readonly string[]> = {
    anthropic: ["DHELIX_ANTHROPIC_API_KEY", "ANTHROPIC_API_KEY"],
    "openai-compatible": ["DHELIX_OPENAI_API_KEY", "OPENAI_API_KEY"],
    "responses-api": ["DHELIX_OPENAI_API_KEY", "OPENAI_API_KEY"],
    "google-gemini": ["DHELIX_GOOGLE_API_KEY", "GOOGLE_API_KEY", "GEMINI_API_KEY"],
  };

  const keys = envMap[providerId];
  if (!keys) return undefined;

  for (const key of keys) {
    const value = process.env[key];
    if (value) return value;
  }
  return undefined;
}

// ─── ProviderRegistry 클래스 ────────────────────────────────────────

/** 등록된 프로바이더 정보 (매니페스트 + 팩토리 + 캐시된 인스턴스) */
interface RegisteredProvider {
  readonly manifest: ProviderManifest;
  readonly factory: ProviderFactory;
  /** lazy 생성된 인스턴스 캐시 */
  instance?: UnifiedLLMProvider;
}

/**
 * LLM 프로바이더 레지스트리 — 모델 이름으로 프로바이더를 찾는 중앙 시스템
 *
 * 주요 기능:
 * - register(): 프로바이더 등록 (매니페스트 + 팩토리)
 * - resolve(): 모델 이름으로 프로바이더 인스턴스를 조회
 * - listProviders(): 등록된 모든 프로바이더 매니페스트 목록
 * - getProvider(): ID로 프로바이더 인스턴스 조회
 *
 * 인스턴스 캐싱:
 * - 한번 생성된 프로바이더 인스턴스는 캐싱되어 재사용됩니다.
 * - 같은 프로바이더에 대한 반복적인 resolve() 호출은 동일 인스턴스를 반환합니다.
 */
export class ProviderRegistry {
  /** 프로바이더 ID → 등록 정보 맵 */
  private readonly providers: Map<string, RegisteredProvider> = new Map();

  /**
   * 프로바이더를 레지스트리에 등록
   *
   * 이미 같은 ID의 프로바이더가 등록되어 있으면 덮어씁니다 (캐시 포함).
   *
   * @param manifest - 프로바이더 메타데이터
   * @param factory - 프로바이더 인스턴스를 생성하는 팩토리 함수
   */
  register(manifest: ProviderManifest, factory: ProviderFactory): void {
    this.providers.set(manifest.id, { manifest, factory });
  }

  /**
   * 모델 이름으로 적합한 프로바이더를 찾아 인스턴스를 반환
   *
   * Resolution 순서:
   * 1. 등록된 매니페스트의 modelPatterns를 순회하며 매칭
   * 2. 매칭된 프로바이더의 팩토리로 인스턴스 생성 (또는 캐시에서 반환)
   * 3. 매칭 실패 시 LLMError 발생
   *
   * @param modelName - 모델 이름 (예: "claude-sonnet-4-20250514")
   * @returns 모델에 맞는 UnifiedLLMProvider 인스턴스
   * @throws LLMError - 매칭되는 프로바이더가 없을 때
   */
  resolve(modelName: string): UnifiedLLMProvider {
    for (const [, registered] of this.providers) {
      const { manifest, factory } = registered;
      for (const pattern of manifest.modelPatterns) {
        if (pattern.test(modelName)) {
          // 캐시된 인스턴스가 있으면 반환
          if (registered.instance) {
            return registered.instance;
          }
          // 팩토리로 새 인스턴스를 생성하고 캐싱
          const instance = factory();
          (registered as { instance?: UnifiedLLMProvider }).instance = instance;
          return instance;
        }
      }
    }

    throw new LLMError(
      `No provider registered for model "${modelName}". ` +
        `Registered providers: [${[...this.providers.keys()].join(", ")}]`,
    );
  }

  /**
   * 등록된 모든 프로바이더의 매니페스트 목록을 반환
   *
   * @returns 읽기 전용 매니페스트 배열
   */
  listProviders(): readonly ProviderManifest[] {
    return [...this.providers.values()].map((r) => r.manifest);
  }

  /**
   * 프로바이더 ID로 인스턴스를 조회
   *
   * 아직 생성되지 않은 프로바이더는 팩토리로 생성합니다.
   *
   * @param id - 프로바이더 ID (예: "anthropic")
   * @returns UnifiedLLMProvider 인스턴스 또는 undefined
   */
  getProvider(id: string): UnifiedLLMProvider | undefined {
    const registered = this.providers.get(id);
    if (!registered) return undefined;

    if (!registered.instance) {
      (registered as { instance?: UnifiedLLMProvider }).instance = registered.factory();
    }
    return registered.instance;
  }

  /**
   * 등록된 프로바이더 수를 반환
   */
  get size(): number {
    return this.providers.size;
  }

  /**
   * 모든 등록을 초기화 (테스트용)
   */
  clear(): void {
    this.providers.clear();
  }

  /**
   * 기본 프로바이더가 등록된 새 레지스트리를 생성하는 정적 팩토리
   *
   * Anthropic, OpenAI Compatible, Responses API 프로바이더를 자동 등록합니다.
   * 각 프로바이더의 팩토리 함수는 lazy하게 호출됩니다.
   *
   * @param overrides - 프로바이더별 설정 오버라이드
   * @returns 기본 프로바이더가 등록된 ProviderRegistry
   */
  static create(
    overrides: DefaultRegistryOverrides = {},
  ): ProviderRegistry {
    const registry = new ProviderRegistry();

    // Anthropic 프로바이더 등록
    registry.register(ANTHROPIC_MANIFEST, () => {
      // 동적 import를 피하고, 호출자가 제공한 팩토리 사용 또는 기본 로직
      if (overrides.anthropicFactory) {
        return overrides.anthropicFactory();
      }
      // 기본 팩토리: AnthropicProvider를 직접 생성하지 않고,
      // 호출 시점에 동적으로 import하여 순환 의존성 방지
      throw new LLMError(
        "Anthropic provider factory not configured. " +
          "Use ProviderRegistry.create({ anthropicFactory }) or register manually.",
      );
    });

    // OpenAI Compatible 프로바이더 등록
    registry.register(OPENAI_COMPATIBLE_MANIFEST, () => {
      if (overrides.openaiFactory) {
        return overrides.openaiFactory();
      }
      throw new LLMError(
        "OpenAI Compatible provider factory not configured. " +
          "Use ProviderRegistry.create({ openaiFactory }) or register manually.",
      );
    });

    // Responses API 프로바이더 등록
    registry.register(RESPONSES_API_MANIFEST, () => {
      if (overrides.responsesFactory) {
        return overrides.responsesFactory();
      }
      throw new LLMError(
        "Responses API provider factory not configured. " +
          "Use ProviderRegistry.create({ responsesFactory }) or register manually.",
      );
    });

    // Google Gemini 프로바이더 등록
    registry.register(GOOGLE_GEMINI_MANIFEST, () => {
      if (overrides.geminiFactory) {
        return overrides.geminiFactory();
      }
      throw new LLMError(
        "Google Gemini provider factory not configured. " +
          "Use ProviderRegistry.create({ geminiFactory }) or register manually.",
      );
    });

    return registry;
  }
}

/**
 * ProviderRegistry.create()에 전달할 수 있는 오버라이드 설정
 */
export interface DefaultRegistryOverrides {
  /** Anthropic 프로바이더 팩토리 */
  readonly anthropicFactory?: ProviderFactory;
  /** OpenAI Compatible 프로바이더 팩토리 */
  readonly openaiFactory?: ProviderFactory;
  /** Responses API 프로바이더 팩토리 */
  readonly responsesFactory?: ProviderFactory;
  /** Google Gemini 프로바이더 팩토리 */
  readonly geminiFactory?: ProviderFactory;
}
