/**
 * LLM 클라이언트 팩토리 — 모델에 따라 적절한 클라이언트를 생성
 *
 * /model 명령에서 프로바이더 전환(Local ↔ Cloud) 시
 * 새 클라이언트를 동적으로 생성하는 데 사용됩니다.
 *
 * - Claude 모델 / Anthropic 엔드포인트 → AnthropicProvider (네이티브 Messages API)
 * - Responses API 전용 모델(gpt-5.x-codex) → ResponsesAPIClient
 * - 그 외 모든 모델 → OpenAICompatibleClient
 */
import { type LLMProvider } from "./provider.js";
import { OpenAICompatibleClient } from "./client.js";
import { ResponsesAPIClient, isResponsesOnlyModel } from "./responses-client.js";
import { AnthropicProvider } from "./providers/anthropic.js";

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
 * 모델 이름이 Anthropic Claude 모델인지 확인
 *
 * @param model - 모델 이름
 * @returns Claude 모델 여부
 */
function isAnthropicModel(model: string): boolean {
  return /^claude/i.test(model);
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

/**
 * 모델에 맞는 LLM 클라이언트를 생성합니다.
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
  // Claude 모델 또는 Anthropic 엔드포인트 → Anthropic 네이티브 클라이언트
  if (isAnthropicModel(config.model) || isAnthropicEndpoint(config.baseURL)) {
    return new AnthropicProvider({
      apiKey: config.apiKey || process.env.ANTHROPIC_API_KEY,
      baseURL: isAnthropicEndpoint(config.baseURL) ? config.baseURL : undefined,
      timeout: config.timeout ?? 120_000,
    });
  }

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
