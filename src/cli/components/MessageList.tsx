/**
 * MessageList.tsx — 완료된 대화 메시지를 목록으로 표시하는 컴포넌트
 *
 * 대화 히스토리의 모든 메시지(사용자, 어시스턴트, 시스템, 도구)를
 * 역할에 따라 색상을 구분하여 표시합니다.
 * Ink의 <Static>을 사용하여 메시지가 한 번만 렌더링되도록 합니다.
 *
 * 참고: 현재는 ActivityFeed가 주로 사용되며, MessageList는
 * 간단한 메시지 표시가 필요한 경우에 활용됩니다.
 */
import React from "react";
import { Box, Text, Static } from "ink";
import { type AnyMessage, MessageRole } from "../../core/message-types.js";
import { renderMarkdown } from "../renderer/markdown.js";

/**
 * @param messages - 표시할 메시지 배열
 * @param enableMarkdown - 어시스턴트 응답에 마크다운 렌더링 적용 여부 (기본값: true)
 */
interface MessageListProps {
  readonly messages: readonly AnyMessage[];
  readonly enableMarkdown?: boolean;
}

/** 완료된 대화 메시지를 Static으로 감싸서 표시 (한 번 렌더링 후 고정) */
export const MessageList = React.memo(function MessageList({
  messages,
  enableMarkdown = true,
}: MessageListProps) {
  return (
    <Static items={messages.map((msg, i) => ({ ...msg, key: `msg-${i}` }))}>
      {(msg) => (
        <Box key={msg.key} flexDirection="column" marginBottom={1}>
          <MessageItem message={msg} enableMarkdown={enableMarkdown} />
        </Box>
      )}
    </Static>
  );
});

interface MessageItemProps {
  readonly message: AnyMessage;
  readonly enableMarkdown: boolean;
}

/** 개별 메시지 항목을 렌더링 — 역할에 따른 색상 + 마크다운 변환 적용 */
const MessageItem = React.memo(function MessageItem({ message, enableMarkdown }: MessageItemProps) {
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
});

/** 메시지 역할에 따른 표시 색상을 반환 (User=파랑, Assistant=초록, System=회색, Tool=노랑) */
function getRoleColor(role: string): string {
  switch (role) {
    case MessageRole.User:
      return "blue";
    case MessageRole.Assistant:
      return "green";
    case MessageRole.System:
      return "gray";
    case MessageRole.Tool:
      return "yellow";
    default:
      return "white";
  }
}
