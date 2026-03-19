/**
 * LLM 클라이언트 팩토리 — 모델에 따라 적절한 클라이언트를 생성
 *
 * /model 명령에서 프로바이더 전환(Local ↔ Cloud) 시
 * 새 클라이언트를 동적으로 생성하는 데 사용됩니다.
 *
 * - Responses API 전용 모델(gpt-5.x-codex) → ResponsesAPIClient
 * - 그 외 모든 모델 → OpenAICompatibleClient
 */
import { type LLMProvider } from "./provider.js";
import { OpenAICompatibleClient } from "./client.js";
import { ResponsesAPIClient, isResponsesOnlyModel } from "./responses-client.js";

/** 클라이언트 생성에 필요한 연결 정보 */
export interface LLMClientConfig {
  readonly model: string;
  readonly baseURL: string;
  readonly apiKey: string;
  readonly timeout?: number;
}

/**
 * 모델에 맞는 LLM 클라이언트를 생성합니다.
 *
 * @param config - 모델명, API 엔드포인트, 인증키, 타임아웃
 * @returns LLMProvider 인터페이스를 구현하는 클라이언트 인스턴스
 */
export function createLLMClientForModel(config: LLMClientConfig): LLMProvider {
  const clientConfig = {
    baseURL: config.baseURL,
    apiKey: config.apiKey,
    timeout: config.timeout ?? 120_000,
  };

  if (isResponsesOnlyModel(config.model)) {
    return new ResponsesAPIClient(clientConfig);
  }

  return new OpenAICompatibleClient(clientConfig);
}
