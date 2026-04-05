/**
 * MessageList.tsx — 완료된 대화 메시지를 목록으로 표시하는 컴포넌트
 *
 * 대화 히스토리의 모든 메시지(사용자, 어시스턴트, 시스템, 도구)를
 * 역할에 따라 색상을 구분하여 표시합니다.
 *
 * 가상화(Windowed Rendering):
 * - VISIBLE_WINDOW 개수 이상의 메시지가 있을 때 최근 N개만 렌더링
 * - 오래된 메시지는 "... N earlier messages ..." 플레이스홀더로 표시
 * - 완료된 메시지는 React.memo로 불필요한 리렌더를 방지
 *
 * 참고: 현재는 ActivityFeed가 주로 사용되며, MessageList는
 * 간단한 메시지 표시가 필요한 경우에 활용됩니다.
 */
import React, { useMemo } from "react";
import { Box, Text, Static } from "ink";
import { type AnyMessage, MessageRole } from "../../core/message-types.js";
import { renderMarkdown } from "../renderer/markdown.js";
import {
  computeVisibleWindow,
  computeHiddenCount,
  createPlaceholder,
  shouldSkipRerender,
  DEFAULT_WINDOW_CONFIG,
  type WindowConfig,
} from "./message-list-utils.js";

/** 한 번에 렌더링할 최대 메시지 수 (기본 윈도우 크기) */
const VISIBLE_WINDOW = DEFAULT_WINDOW_CONFIG.visibleCount;

/**
 * @param messages        - 표시할 메시지 배열
 * @param enableMarkdown  - 어시스턴트 응답에 마크다운 렌더링 적용 여부 (기본값: true)
 * @param scrollOffset    - 스크롤 위치 오프셋 (0 = 최신 메시지 기준, 기본값: 0)
 * @param windowConfig    - 가상화 윈도우 설정 (기본값: DEFAULT_WINDOW_CONFIG)
 */
interface MessageListProps {
  readonly messages: readonly AnyMessage[];
  readonly enableMarkdown?: boolean;
  readonly scrollOffset?: number;
  readonly windowConfig?: WindowConfig;
}

/**
 * 완료된 대화 메시지를 가상화된 윈도우로 표시합니다.
 *
 * - VISIBLE_WINDOW(50) 이하: Static으로 전체 렌더링
 * - VISIBLE_WINDOW 초과: 최근 N개만 렌더링하고, 숨겨진 메시지는 플레이스홀더 표시
 */
export const MessageList = React.memo(function MessageList({
  messages,
  enableMarkdown = true,
  scrollOffset = 0,
  windowConfig = DEFAULT_WINDOW_CONFIG,
}: MessageListProps) {
  const totalMessages = messages.length;

  // 가시 범위 계산 (메모이제이션으로 불필요한 재계산 방지)
  const window = useMemo(
    () => computeVisibleWindow(totalMessages, scrollOffset, windowConfig),
    [totalMessages, scrollOffset, windowConfig],
  );

  const hiddenCount = useMemo(
    () => computeHiddenCount(totalMessages, window),
    [totalMessages, window],
  );

  const placeholder = useMemo(() => createPlaceholder(hiddenCount), [hiddenCount]);

  // VISIBLE_WINDOW 이하이면 Static으로 전체 렌더링 (기존 동작 유지)
  if (totalMessages <= VISIBLE_WINDOW) {
    return (
      <Static items={messages.map((msg, i) => ({ ...msg, key: `msg-${i}` }))}>
        {(msg) => (
          <Box key={msg.key} flexDirection="column" marginBottom={1}>
            <MessageItem message={msg} enableMarkdown={enableMarkdown} isStreaming={false} />
          </Box>
        )}
      </Static>
    );
  }

  // 가상화 모드: 플레이스홀더 + 가시 범위 메시지만 렌더링
  const visibleMessages = messages.slice(window.start, window.end + 1);

  return (
    <Box flexDirection="column">
      {/* 숨겨진 이전 메시지 플레이스홀더 */}
      {placeholder.hiddenCount > 0 && (
        <Box marginBottom={1}>
          <Text color="gray" dimColor>
            {placeholder.label}
          </Text>
        </Box>
      )}

      {/* 가시 범위 메시지 렌더링 */}
      {visibleMessages.map((msg, i) => {
        const absoluteIndex = window.start + i;
        const isLastMessage = absoluteIndex === totalMessages - 1;
        return (
          <Box key={`msg-${absoluteIndex}`} flexDirection="column" marginBottom={1}>
            <MessageItem
              message={msg}
              enableMarkdown={enableMarkdown}
              isStreaming={isLastMessage}
            />
          </Box>
        );
      })}
    </Box>
  );
});

interface MessageItemProps {
  readonly message: AnyMessage;
  readonly enableMarkdown: boolean;
  /** 현재 스트리밍 중인 메시지인지 여부 (완료된 메시지는 리렌더 방지) */
  readonly isStreaming: boolean;
}

/**
 * 개별 메시지 항목을 렌더링합니다.
 *
 * shouldSkipRerender를 React.memo 비교 함수로 사용하여
 * 완료된 메시지는 절대 리렌더되지 않습니다.
 * 스트리밍 중인 마지막 메시지만 content 변경 시 업데이트됩니다.
 */
const MessageItem = React.memo(
  function MessageItem({ message, enableMarkdown }: MessageItemProps) {
    const roleColor = getRoleColor(message.role);

    const content =
      enableMarkdown && message.role === MessageRole.Assistant
        ? renderMarkdown(message.content)
        : message.content;

    return (
      <>
        <Text color={roleColor} bold>
          {message.role}:{" "}
        </Text>
        <Text>{content}</Text>
      </>
    );
  },
  // React.memo 비교 함수: 완료된 메시지는 리렌더 생략
  shouldSkipRerender,
);

/** 메시지 역할에 따른 표시 색상을 반환 (User=파랑, Assistant=밝은시안, System=회색, Tool=틸) */
function getRoleColor(role: string): string {
  switch (role) {
    case MessageRole.User:
      return "blue";
    case MessageRole.Assistant:
      return "#00E5FF";
    case MessageRole.System:
      return "gray";
    case MessageRole.Tool:
      return "#00BCD4";
    default:
      return "white";
  }
}
