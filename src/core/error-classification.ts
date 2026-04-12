/**
 * 에러 분류 & 대기 유틸리티 — 에이전트 루프, 파이프라인 스테이지, 모델 라우터에서 공유
 *
 * 이전에 3곳(agent-loop.ts, sample-llm.ts, model-router.ts)에 중복되어 있던
 * 에러 분류 로직과 대기 함수를 하나의 모듈로 통합합니다.
 *
 * 에러 분류 카테고리:
 * - "transient": 일시적 에러 (타임아웃, 네트워크) → 재시도 가능
 * - "overload": 과부하/Rate Limit (429, 503) → 대체 모델 전환 또는 대기
 * - "auth": 인증/권한 에러 (401, 403) → 재시도 불가
 * - "permanent": 영구적 에러 → 재시도 불가
 *
 * @module core/error-classification
 */

import { LLMError } from "../utils/error.js";

/**
 * LLM 에러 분류 결과
 *
 * model-router.ts의 "auth" 카테고리를 포함하여 모든 소비자의 요구를 통합합니다.
 * agent-loop.ts와 sample-llm.ts는 "auth"를 사용하지 않지만,
 * "permanent"으로 매핑되므로 하위 호환성이 유지됩니다.
 */
export type LLMErrorClass = "transient" | "overload" | "auth" | "permanent";

/**
 * LLM 에러를 분류하여 재시도/폴백 전략을 결정합니다.
 *
 * 에러 메시지에 포함된 키워드를 분석하여 에러 유형을 판별합니다.
 * 3곳에 중복되어 있던 로직을 통합하며, model-router.ts의 "auth" 분류를 포함합니다.
 *
 * @param error - 발생한 에러
 * @returns 에러 분류 ("transient" | "overload" | "auth" | "permanent")
 */
export function classifyLLMError(error: unknown): LLMErrorClass {
  if (!(error instanceof Error)) return "permanent";

  const message = error.message.toLowerCase();

  // "Request too large" is permanent — retrying the same payload won't help
  if (message.includes("request too large") || message.includes("too many tokens")) {
    return "permanent";
  }

  // Authentication / authorization errors — no retry possible
  if (
    message.includes("401") ||
    message.includes("403") ||
    message.includes("unauthorized") ||
    message.includes("forbidden") ||
    message.includes("invalid api key") ||
    message.includes("invalid_api_key")
  ) {
    return "auth";
  }

  // Rate limit or overload — client may have already retried with Retry-After
  if (
    message.includes("rate limit") ||
    message.includes("429") ||
    message.includes("overload") ||
    message.includes("503") ||
    message.includes("capacity")
  ) {
    return "overload";
  }

  // Transient network / server errors — retry with backoff
  if (
    message.includes("timeout") ||
    message.includes("timedout") ||
    message.includes("etimedout") ||
    message.includes("econnreset") ||
    message.includes("econnrefused") ||
    message.includes("500") ||
    message.includes("502") ||
    message.includes("504") ||
    message.includes("network")
  ) {
    return "transient";
  }

  return "permanent";
}

/**
 * AbortSignal을 존중하면서 지정된 시간만큼 대기합니다.
 *
 * 사용자가 Esc를 누르면(AbortSignal이 발동하면) 즉시 reject됩니다.
 * agent-loop.ts와 sample-llm.ts에 중복되어 있던 함수를 통합합니다.
 *
 * @param ms - 대기할 밀리초
 * @param signal - 취소 신호 (선택사항)
 * @throws LLMError("Aborted") - signal이 발동된 경우
 */
export function waitWithAbort(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new LLMError("Aborted"));
      return;
    }
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener(
      "abort",
      () => {
        clearTimeout(timer);
        reject(new LLMError("Aborted"));
      },
      { once: true },
    );
  });
}
