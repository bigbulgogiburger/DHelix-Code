/**
 * LLM 클라이언트 팩토리 — 모델에 따라 적절한 클라이언트를 생성
 *
 * /model 명령에서 프로바이더 전환(Local ↔ Cloud) 시
 * 새 클라이언트를 동적으로 생성하는 데 사용됩니다.
 *
 * 내부적으로 ProviderRegistry를 사용하여 모델 이름으로 프로바이더를 resolve합니다.
 * 레지스트리에 등록되지 않은 모델은 폴백 로직으로 처리합니다.
 *
 * - Claude 모델 / Anthropic 엔드포인트 → AnthropicProvider (네이티브 Messages API)
 * - Responses API 전용 모델(gpt-5.x-codex) → ResponsesAPIClient
 * - 그 외 모든 모델 → OpenAICompatibleClient
 */
import { type LLMProvider } from "./provider.js";
import { OpenAICompatibleClient } from "./client.js";
import { ResponsesAPIClient, isResponsesOnlyModel } from "./responses-client.js";
import { AnthropicProvider } from "./providers/anthropic.js";
import {
  ProviderRegistry,
  createUnifiedAdapter,
  resolveApiKey,
  ANTHROPIC_MANIFEST,
  OPENAI_COMPATIBLE_MANIFEST,
  RESPONSES_API_MANIFEST,
} from "./providers/registry.js";

/** 클라이언트 생성에 필요한 연결 정보 */
export interface LLMClientConfig {
  readonly model: string;
  readonly baseURL: string;
  readonly apiKey: string;
  readonly timeout?: number;
  /** 커스텀 API 키 헤더명 (예: "model-api-key") */
  readonly apiKeyHeader?: string;
}

/**
 * 엔드포인트 URL이 Anthropic API인지 확인
 *
 * @param baseUrl - API 엔드포인트 URL
 * @returns Anthropic API 여부
 */
function isAnthropicEndpoint(baseUrl: string): boolean {
  return baseUrl.includes("anthropic.com");
}

/** 싱글턴 ProviderRegistry 인스턴스 (lazy 초기화) */
let defaultRegistry: ProviderRegistry | undefined;

/**
 * 기본 ProviderRegistry를 가져오거나 생성
 *
 * 싱글턴 패턴으로 애플리케이션 수명 동안 하나의 레지스트리를 공유합니다.
 * 각 프로바이더는 resolve() 시점에 lazy하게 생성됩니다.
 *
 * @returns 기본 프로바이더가 등록된 ProviderRegistry
 */
export function getDefaultRegistry(): ProviderRegistry {
  if (!defaultRegistry) {
    defaultRegistry = new ProviderRegistry();

    // Anthropic 프로바이더 (패턴: /^claude/i)
    defaultRegistry.register(ANTHROPIC_MANIFEST, () =>
      createUnifiedAdapter(
        new AnthropicProvider({
          apiKey: resolveApiKey("anthropic"),
        }),
        ANTHROPIC_MANIFEST,
      ),
    );

    // Responses API 프로바이더 (패턴: /^gpt-5.x-codex/i)
    // 반드시 openai-compatible보다 먼저 등록 (더 구체적인 패턴이 우선)
    defaultRegistry.register(RESPONSES_API_MANIFEST, () =>
      createUnifiedAdapter(
        new ResponsesAPIClient({
          baseURL: "",
          apiKey: resolveApiKey("responses-api"),
        }),
        RESPONSES_API_MANIFEST,
      ),
    );

    // OpenAI Compatible 프로바이더 (패턴: /^gpt-/i, /^o[13]/i)
    defaultRegistry.register(OPENAI_COMPATIBLE_MANIFEST, () =>
      createUnifiedAdapter(
        new OpenAICompatibleClient({
          baseURL: "",
          apiKey: resolveApiKey("openai-compatible"),
        }),
        OPENAI_COMPATIBLE_MANIFEST,
      ),
    );
  }
  return defaultRegistry;
}

/**
 * 테스트용: 기본 레지스트리 리셋
 *
 * @internal
 */
export function resetDefaultRegistry(): void {
  defaultRegistry = undefined;
}

/**
 * 모델에 맞는 LLM 클라이언트를 생성합니다.
 *
 * ProviderRegistry를 사용하되, 호출자가 명시적으로 config를 제공하므로
 * registry의 팩토리 대신 config 기반으로 직접 생성합니다.
 * 이렇게 하면 기존 호출 코드와의 호환성을 유지합니다.
 *
 * 라우팅 규칙:
 * - Claude 모델명 또는 Anthropic 엔드포인트 → AnthropicProvider
 * - Codex 모델 → ResponsesAPIClient
 * - 그 외 → OpenAICompatibleClient
 *
 * @param config - 모델명, API 엔드포인트, 인증키, 타임아웃
 * @returns LLMProvider 인터페이스를 구현하는 클라이언트 인스턴스
 */
export function createLLMClientForModel(config: LLMClientConfig): LLMProvider {
  const registry = getDefaultRegistry();

  // Anthropic 엔드포인트 명시적 지정 시 Anthropic 프로바이더 사용
  if (isAnthropicEndpoint(config.baseURL)) {
    return new AnthropicProvider({
      apiKey: config.apiKey || resolveApiKey("anthropic"),
      baseURL: config.baseURL,
      timeout: config.timeout ?? 120_000,
    });
  }

  // ProviderRegistry로 모델 이름 기반 resolve 시도
  try {
    // config에서 제공된 값으로 직접 프로바이더 인스턴스를 생성
    // (registry의 캐시된 인스턴스 대신 config 기반 인스턴스 사용)
    const resolved = registry.resolve(config.model);
    const providerId = resolved.manifest.id;

    if (providerId === "anthropic") {
      return new AnthropicProvider({
        apiKey: config.apiKey || resolveApiKey("anthropic"),
        baseURL: undefined,
        timeout: config.timeout ?? 120_000,
      });
    }

    if (providerId === "responses-api") {
      return new ResponsesAPIClient({
        baseURL: config.baseURL,
        apiKey: config.apiKey,
        timeout: config.timeout ?? 120_000,
      });
    }

    // openai-compatible
    return new OpenAICompatibleClient({
      baseURL: config.baseURL,
      apiKey: config.apiKey,
      timeout: config.timeout ?? 120_000,
      apiKeyHeader: config.apiKeyHeader,
    });
  } catch {
    // 레지스트리에 등록되지 않은 모델 → 폴백 로직
    const clientConfig = {
      baseURL: config.baseURL,
      apiKey: config.apiKey,
      timeout: config.timeout ?? 120_000,
      apiKeyHeader: config.apiKeyHeader,
    };

    if (isResponsesOnlyModel(config.model)) {
      return new ResponsesAPIClient(clientConfig);
    }

    return new OpenAICompatibleClient(clientConfig);
  }
}
