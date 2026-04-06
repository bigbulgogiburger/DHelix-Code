/**
 * message-list-utils.ts — MessageList 가상화(virtualization) 유틸리티
 *
 * 대량 메시지를 효율적으로 렌더링하기 위한 윈도우 계산, 메모이제이션 비교,
 * 플레이스홀더 생성 함수들을 제공합니다.
 *
 * 주요 개념:
 * - Windowed rendering: 전체 메시지 중 보이는 범위만 렌더링
 * - Overscan: 스크롤 시 깜빡임 방지를 위한 추가 여유 범위
 * - Placeholder: 숨겨진 메시지를 요약 표시
 */

import { type AnyMessage, MessageRole } from "../../core/message-types.js";

/**
 * 가상화 윈도우 설정
 *
 * @property visibleCount - 한 번에 렌더링할 최대 메시지 수 (기본값: 50)
 * @property overscan    - 윈도우 위아래 여유 메시지 수 (기본값: 10)
 */
export interface WindowConfig {
  readonly visibleCount: number;
  readonly overscan: number;
}

/**
 * 가상화 윈도우의 렌더링 범위
 *
 * @property start - 렌더링 시작 인덱스 (포함)
 * @property end   - 렌더링 종료 인덱스 (포함)
 */
export interface VisibleWindow {
  readonly start: number;
  readonly end: number;
}

/**
 * 숨겨진 메시지를 나타내는 플레이스홀더 정보
 *
 * @property hiddenCount - 숨겨진 메시지 수
 * @property label       - 표시할 레이블 문자열 (예: "... 47 earlier messages ...")
 */
export interface PlaceholderInfo {
  readonly hiddenCount: number;
  readonly label: string;
}

/** 기본 윈도우 설정 상수 */
export const DEFAULT_WINDOW_CONFIG: WindowConfig = {
  visibleCount: 50,
  overscan: 10,
} as const;

/**
 * 메시지 배열에서 렌더링할 가시 범위를 계산합니다.
 *
 * 스크롤 오프셋(scrollOffset)을 기준으로 visibleCount 개의 메시지를
 * 선택하고, overscan 을 위아래로 더합니다. 결과는 항상 배열 범위 내로
 * 클램핑됩니다.
 *
 * @param totalMessages - 전체 메시지 수
 * @param scrollOffset  - 스크롤 위치 (0 = 최신 메시지 기준 오프셋 없음)
 * @param config        - 윈도우 설정 (기본값 사용 시 DEFAULT_WINDOW_CONFIG)
 * @returns 렌더링할 { start, end } 인덱스 범위
 *
 * @example
 * // 전체 100개 중 최근 50개만 렌더링
 * computeVisibleWindow(100, 0, { visibleCount: 50, overscan: 10 })
 * // => { start: 40, end: 99 }  (overscan 10개 포함)
 */
export function computeVisibleWindow(
  totalMessages: number,
  scrollOffset: number,
  config: WindowConfig = DEFAULT_WINDOW_CONFIG,
): VisibleWindow {
  if (totalMessages <= 0) {
    return { start: 0, end: -1 };
  }

  const { visibleCount, overscan } = config;

  // 스크롤 없을 때(scrollOffset=0)는 최신 메시지 기준으로 끝 인덱스를 결정
  const anchorEnd = Math.max(0, totalMessages - 1 - scrollOffset);
  const windowSize = visibleCount + overscan * 2;

  const rawStart = anchorEnd - windowSize + 1;
  const rawEnd = anchorEnd + overscan;

  const start = Math.max(0, rawStart);
  const end = Math.min(totalMessages - 1, rawEnd);

  return { start, end };
}

/**
 * 완료된 메시지와 스트리밍 중인 메시지의 리렌더 여부를 비교합니다.
 *
 * React.memo의 두 번째 인자(비교 함수)로 사용합니다.
 * - 완료된 메시지(isStreaming=false): role, content 가 같으면 리렌더 불필요
 * - 스트리밍 중인 메시지(isStreaming=true): content 가 달라졌으면 리렌더 필요
 *
 * @param prev - 이전 메시지 props
 * @param next - 다음 메시지 props
 * @returns true이면 이전 결과를 재사용 (리렌더 생략), false이면 리렌더
 */
export function shouldSkipRerender(
  prev: Readonly<{ message: AnyMessage; isStreaming?: boolean }>,
  next: Readonly<{ message: AnyMessage; isStreaming?: boolean }>,
): boolean {
  // 스트리밍 상태가 바뀐 경우 반드시 리렌더
  if (prev.isStreaming !== next.isStreaming) {
    return false;
  }

  // 스트리밍 중인 메시지는 content 변경 시 리렌더
  if (next.isStreaming) {
    return (
      prev.message.role === next.message.role &&
      prev.message.content === next.message.content
    );
  }

  // 완료된 메시지는 role + content + timestamp 모두 같을 때만 스킵
  return (
    prev.message.role === next.message.role &&
    prev.message.content === next.message.content &&
    prev.message.timestamp === next.message.timestamp
  );
}

/**
 * 숨겨진 메시지 수를 나타내는 플레이스홀더를 생성합니다.
 *
 * 숨겨진 메시지가 없거나 음수인 경우 hiddenCount=0, label="" 를 반환합니다.
 *
 * @param hiddenCount - 숨겨진 메시지 수
 * @returns PlaceholderInfo 객체
 *
 * @example
 * createPlaceholder(47)
 * // => { hiddenCount: 47, label: "... 47 earlier messages ..." }
 *
 * createPlaceholder(1)
 * // => { hiddenCount: 1, label: "... 1 earlier message ..." }
 */
export function createPlaceholder(hiddenCount: number): PlaceholderInfo {
  const count = Math.max(0, hiddenCount);
  if (count === 0) {
    return { hiddenCount: 0, label: "" };
  }
  const noun = count === 1 ? "earlier message" : "earlier messages";
  return {
    hiddenCount: count,
    label: `... ${count} ${noun} ...`,
  };
}

/**
 * 메시지가 어시스턴트 역할인지 확인하는 타입 가드
 *
 * @param message - 검사할 메시지
 * @returns 어시스턴트 메시지이면 true
 */
export function isAssistantRole(message: AnyMessage): boolean {
  return message.role === MessageRole.Assistant;
}

/**
 * 전체 메시지 배열에서 숨겨진 메시지 수를 계산합니다.
 *
 * @param totalMessages - 전체 메시지 수
 * @param window        - 현재 가시 범위
 * @returns 가시 범위 앞에 있는 숨겨진 메시지 수
 */
export function computeHiddenCount(totalMessages: number, window: VisibleWindow): number {
  if (totalMessages <= 0 || window.start <= 0) {
    return 0;
  }
  return window.start;
}
