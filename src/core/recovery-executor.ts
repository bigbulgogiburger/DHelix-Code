/**
 * 복구 전략 실행기(Recovery Executor) 모듈
 *
 * recovery-strategy.ts에서 찾은 복구 전략을 실제로 실행하는 모듈입니다.
 * 각 전략 유형(compact, retry, fallback-strategy)에 따라 적절한 복구 작업을 수행합니다.
 *
 * 주니어 개발자를 위한 설명:
 * - recovery-strategy.ts가 "어떤 에러에 어떤 전략을 쓸지 결정"하는 역할이라면,
 *   이 파일은 "그 전략을 실제로 실행"하는 역할입니다
 * - 예: compact 전략이 선택되면 -> 메시지를 실제로 압축하고 retry 신호를 반환
 * - 각 전략별 재시도 횟수를 추적하여 무한 재시도를 방지합니다
 */
import { type RecoveryStrategy } from "./recovery-strategy.js";
import { type ChatMessage } from "../llm/provider.js";

/**
 * 복구 전략 실행 결과
 *
 * @property action - 호출자가 취해야 할 행동:
 *   - "retry": 재시도해야 함 (messages나 overrides가 변경되었을 수 있음)
 *   - "abort": 복구 실패, 더 이상 시도하지 말 것
 * @property messages - 수정된 메시지 배열 (compact 후 압축된 메시지 등)
 * @property overrides - 재시도 시 변경할 설정값 (예: 도구 호출 전략 변경)
 * @property strategyUsed - 사용된 복구 전략의 설명 문구
 */
export interface RecoveryResult {
  readonly action: "retry" | "abort";
  readonly messages?: readonly ChatMessage[];
  readonly overrides?: Record<string, unknown>;
  readonly strategyUsed: string;
}

/**
 * 복구 실행기 옵션
 *
 * @property maxContextTokens - 최대 컨텍스트 토큰 수 (compact 시 참조)
 * @property signal - 중단 신호 (사용자가 Esc를 누르면 AbortSignal이 발생)
 */
export interface RecoveryExecutorOptions {
  readonly maxContextTokens?: number;
  readonly signal?: AbortSignal;
}

/**
 * 전략별 재시도 상태를 추적하는 내부 인터페이스
 *
 * @property strategyDescription - 전략 설명 (Map의 키로 사용)
 * @property attempts - 현재까지 시도한 횟수
 */
interface RetryState {
  readonly strategyDescription: string;
  attempts: number;
}

/** 전략별 재시도 상태를 저장하는 Map (전략 설명 -> 상태) */
const retryStates = new Map<string, RetryState>();

/**
 * 모든 재시도 상태를 초기화합니다.
 * 새 세션을 시작하거나 테스트 시 호출합니다.
 */
export function resetRetryState(): void {
  retryStates.clear();
}

/**
 * 전략에 대한 재시도 상태를 가져옵니다. 없으면 새로 생성합니다.
 *
 * @param strategy - 복구 전략
 * @returns 해당 전략의 재시도 상태
 */
function getRetryState(strategy: RecoveryStrategy): RetryState {
  const existing = retryStates.get(strategy.description);
  if (existing) return existing;

  const state: RetryState = {
    strategyDescription: strategy.description,
    attempts: 0,
  };
  retryStates.set(strategy.description, state);
  return state;
}

/**
 * AbortSignal을 존중하면서 지정된 시간만큼 대기합니다.
 *
 * 사용자가 작업을 취소(Esc 키)하면 대기를 즉시 중단합니다.
 *
 * @param ms - 대기할 밀리초
 * @param signal - 취소 신호 (선택사항)
 */
function delayWithSignal(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    // 이미 취소된 상태라면 즉시 거부
    if (signal?.aborted) {
      reject(new Error("Aborted"));
      return;
    }
    const timer = setTimeout(resolve, ms);
    // 대기 중 취소 신호가 발생하면 타이머를 취소하고 거부
    signal?.addEventListener(
      "abort",
      () => {
        clearTimeout(timer);
        reject(new Error("Aborted"));
      },
      { once: true }, // 이벤트 리스너를 한 번만 실행
    );
  });
}

/**
 * 메시지를 압축하여 컨텍스트 크기를 줄입니다.
 *
 * 시스템 메시지와 최근 3개 메시지를 유지하고,
 * 중간 메시지들은 요약 메시지 하나로 대체합니다.
 *
 * @param messages - 원본 메시지 배열
 * @param _maxContextTokens - 최대 컨텍스트 토큰 수 (현재 미사용, 향후 확장용)
 * @returns 압축된 메시지 배열
 */
function compactMessages(
  messages: readonly ChatMessage[],
  _maxContextTokens?: number,
): readonly ChatMessage[] {
  // 메시지가 4개 이하면 압축할 필요 없음
  if (messages.length <= 4) return messages;

  // 시스템 메시지는 항상 유지 (LLM에게 역할과 규칙을 알려주는 중요한 메시지)
  const systemMessages = messages.filter((m) => m.role === "system");
  const nonSystem = messages.filter((m) => m.role !== "system");

  // 최근 3개 메시지만 유지 (가장 관련성 높은 문맥)
  const keepRecent = 3;
  const recentMessages = nonSystem.slice(-keepRecent);
  const droppedCount = nonSystem.length - keepRecent;

  // 제거된 메시지를 대체하는 요약 메시지
  const summaryMessage: ChatMessage = {
    role: "user" as const,
    content: `[Context compacted: ${droppedCount} earlier messages were summarized to free context space. Key context has been preserved in recent messages.]`,
  };

  return [...systemMessages, summaryMessage, ...recentMessages];
}

/**
 * findRecoveryStrategy()에서 찾은 복구 전략을 실제로 실행합니다.
 *
 * 각 전략 유형에 따른 동작:
 * - "compact": 메시지를 압축(오래된 메시지를 요약으로 대체)하고 재시도 신호를 반환
 * - "retry": 지수 백오프(exponential backoff)로 대기한 뒤 재시도 신호를 반환
 * - "fallback-strategy": 도구 호출 전략을 텍스트 파싱 방식으로 전환하도록 override 설정
 *
 * 최대 재시도 횟수를 초과하면 "abort"를 반환하여 더 이상 시도하지 않습니다.
 *
 * @param strategy - 실행할 복구 전략
 * @param _error - 발생한 에러 (현재는 사용하지 않지만, 향후 에러별 분기에 활용 가능)
 * @param messages - 현재 대화 메시지 배열
 * @param options - 실행 옵션 (최대 토큰, 취소 신호 등)
 * @returns 복구 결과 (재시도 또는 중단)
 */
export async function executeRecovery(
  strategy: RecoveryStrategy,
  _error: Error,
  messages: readonly ChatMessage[],
  options?: RecoveryExecutorOptions,
): Promise<RecoveryResult> {
  const state = getRetryState(strategy);

  // 이 전략의 최대 재시도 횟수를 초과했으면 중단
  if (state.attempts >= strategy.maxRetries) {
    return {
      action: "abort",
      strategyUsed: strategy.description,
    };
  }

  state.attempts++;

  switch (strategy.action) {
    case "compact": {
      // 메시지를 압축하여 토큰 수를 줄임
      const compacted = compactMessages(messages, options?.maxContextTokens);
      return {
        action: "retry",
        messages: compacted,
        strategyUsed: strategy.description,
      };
    }

    case "retry": {
      // 지수 백오프: 시도할수록 대기 시간이 2배로 증가
      // 예: 1000ms -> 2000ms -> 4000ms
      const backoffMs = strategy.backoffMs ?? 1000;
      const delay = backoffMs * Math.pow(2, state.attempts - 1);

      await delayWithSignal(delay, options?.signal);

      return {
        action: "retry",
        messages, // 메시지는 변경하지 않고 그대로 재시도
        strategyUsed: strategy.description,
      };
    }

    case "fallback-strategy": {
      // 도구 호출 전략을 텍스트 파싱 방식으로 전환
      // LLM의 JSON 도구 호출이 실패할 때, 텍스트에서 도구 호출을 추출하는 방식으로 대체
      return {
        action: "retry",
        messages,
        overrides: {
          toolCallStrategy: "text-parsing",
        },
        strategyUsed: strategy.description,
      };
    }

    default: {
      // 알 수 없는 전략 유형은 중단 처리
      return {
        action: "abort",
        strategyUsed: strategy.description,
      };
    }
  }
}
