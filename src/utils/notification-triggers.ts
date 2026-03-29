/**
 * 알림 트리거 — 이벤트 버스와 데스크톱 알림을 연결하는 모듈
 *
 * 에이전트 루프(agent loop)가 오래 걸리는 작업을 완료하거나 LLM 에러가 발생하면
 * 데스크톱 알림을 자동으로 전송합니다.
 *
 * 주요 흐름:
 * 1. "agent:iteration" 이벤트로 작업 시작 시간을 기록
 * 2. "agent:assistant-message"의 isFinal=true로 작업 완료를 감지
 * 3. 경과 시간이 최소 기준(minDurationMs) 이상이면 알림 전송
 * 4. "llm:error" 발생 시 즉시 에러 알림 전송
 *
 * 알림은 fire-and-forget(발사 후 망각) 패턴으로, 메인 이벤트 루프를 차단하지 않습니다.
 *
 * @example
 * const cleanup = setupNotificationTriggers(events, { minDurationMs: 60000 });
 * // ... 작업 수행 ...
 * cleanup(); // 리스너 해제
 */

import { type AppEventEmitter } from "./events.js";
import { sendNotification } from "./notifications.js";
import { DEFAULT_NOTIFICATION_CONFIG, type NotificationConfig } from "./notification-config.js";

/** 알림 트리거 설정 옵션 */
export interface NotificationTriggerOptions {
  /** 완료 알림을 보내기 위한 최소 경과 시간 (밀리초 단위) */
  readonly minDurationMs?: number;
  /** 알림 활성화 여부 */
  readonly enabled?: boolean;
  /** 알림에 사운드를 포함할지 여부 */
  readonly sound?: boolean;
}

/**
 * 장시간 작업에 대한 알림 트리거를 설정합니다.
 *
 * 다음 상황에서 데스크톱 알림을 전송합니다:
 * - 에이전트 루프가 설정된 최소 시간 이상 실행된 후 완료될 때
 * - LLM 에러가 발생하여 사용자의 주의가 필요할 때
 *
 * 알림은 fire-and-forget(발사 후 망각) 방식이며 메인 이벤트 루프를 절대 차단하지 않습니다.
 *
 * @param events - 앱 이벤트 에미터 (mitt 기반)
 * @param options - 알림 트리거 옵션 (선택적)
 * @returns 정리(cleanup) 함수 — 호출하면 모든 이벤트 리스너를 해제합니다
 */
export function setupNotificationTriggers(
  events: AppEventEmitter,
  options?: NotificationTriggerOptions,
): () => void {
  // 옵션이 제공되지 않으면 기본값(DEFAULT_NOTIFICATION_CONFIG)을 사용
  const config: NotificationConfig = {
    enabled: options?.enabled ?? DEFAULT_NOTIFICATION_CONFIG.enabled,
    minDurationSeconds:
      options?.minDurationMs !== undefined
        ? options.minDurationMs / 1000
        : DEFAULT_NOTIFICATION_CONFIG.minDurationSeconds,
    sound: options?.sound ?? DEFAULT_NOTIFICATION_CONFIG.sound,
  };

  // 알림이 비활성화되어 있으면 아무 작업도 하지 않는 정리 함수만 반환
  if (!config.enabled) {
    return () => {
      /* 비활성 상태에서는 정리할 것이 없음 (no-op) */
    };
  }

  // 초(seconds) → 밀리초(ms) 변환
  const minDurationMs = config.minDurationSeconds * 1000;
  // 에이전트 루프 시작 시간을 추적하기 위한 변수
  let agentStartTime: number | null = null;

  /**
   * 에이전트 루프의 첫 번째 반복(iteration) 시작 시 시간을 기록합니다.
   * iteration이 1인 경우에만 시작 시간을 설정합니다.
   */
  const onAgentIteration = ({ iteration }: { iteration: number }): void => {
    if (iteration === 1) {
      agentStartTime = Date.now();
    }
  };

  /**
   * 에이전트 루프의 마지막 메시지(isFinal=true) 수신 시,
   * 경과 시간이 최소 기준 이상이면 완료 알림을 전송합니다.
   */
  const onAssistantMessage = ({
    isFinal,
  }: {
    readonly content: string;
    readonly toolCalls: readonly { readonly id: string; readonly name: string }[];
    readonly iteration: number;
    readonly isFinal: boolean;
  }): void => {
    // 최종 메시지가 아니거나 시작 시간이 기록되지 않았으면 무시
    if (!isFinal || agentStartTime === null) {
      return;
    }

    // 경과 시간 계산
    const elapsed = Date.now() - agentStartTime;
    agentStartTime = null;

    // 최소 시간 이상 걸렸을 때만 알림 전송
    if (elapsed >= minDurationMs) {
      const seconds = Math.round(elapsed / 1000);
      // void: Promise를 의도적으로 무시 — 이벤트 핸들러에서 await하면 안 됨
      void sendNotification({
        title: "dhelix",
        message: `Task completed in ${seconds}s`,
        sound: config.sound,
      });
    }
  };

  /**
   * LLM 에러 발생 시 사용자에게 즉시 에러 알림을 전송합니다.
   * 에러 메시지는 200자로 잘라 전송합니다.
   */
  const onLLMError = ({ error }: { error: Error }): void => {
    // fire-and-forget: 결과를 기다리지 않음
    void sendNotification({
      title: "Dhelix Code — Error",
      message: error.message.slice(0, 200),
      sound: config.sound,
    });
    agentStartTime = null;
  };

  // 이벤트 리스너 등록
  events.on("agent:iteration", onAgentIteration);
  events.on("agent:assistant-message", onAssistantMessage);
  events.on("llm:error", onLLMError);

  /**
   * 정리(cleanup) 함수 — 등록한 모든 이벤트 리스너를 해제합니다.
   * 컴포넌트 언마운트 시 또는 알림 기능을 끌 때 호출하세요.
   */
  return () => {
    events.off("agent:iteration", onAgentIteration);
    events.off("agent:assistant-message", onAssistantMessage);
    events.off("llm:error", onLLMError);
    agentStartTime = null;
  };
}
