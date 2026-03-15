/**
 * useConversation.ts — 불변(Immutable) 대화 상태를 관리하는 React 훅
 *
 * Conversation 객체를 React 상태로 감싸서 대화 히스토리의
 * 추가/초기화를 관리합니다. 모든 변경은 새 객체를 생성하는
 * 불변 패턴을 따릅니다 (spread copy).
 *
 * 제공하는 기능:
 * - addUserMessage: 사용자 메시지 추가
 * - addAssistantMessage: AI 응답 추가 (도구 호출 포함 가능)
 * - addToolResults: 도구 실행 결과 추가
 * - addSystemMessage: 시스템 메시지 추가
 * - reset: 대화 초기화 (/clear 명령 등)
 */
import { useState, useCallback } from "react";
import { Conversation } from "../../core/conversation.js";
import { type ToolCall, type ToolCallResult } from "../../core/message-types.js";

/**
 * 불변 대화 상태 관리 훅
 *
 * @param conversationId - 대화의 고유 ID (세션 구분용)
 * @returns conversation 객체와 메시지 추가/초기화 함수들
 */
export function useConversation(conversationId: string) {
  const [conversation, setConversation] = useState(() => Conversation.create(conversationId));

  const addUserMessage = useCallback((content: string) => {
    setConversation((prev) => prev.appendUserMessage(content));
  }, []);

  const addAssistantMessage = useCallback(
    (content: string, toolCalls: readonly ToolCall[] = []) => {
      setConversation((prev) => prev.appendAssistantMessage(content, toolCalls));
    },
    [],
  );

  const addToolResults = useCallback((results: readonly ToolCallResult[]) => {
    setConversation((prev) => prev.appendToolResults(results));
  }, []);

  const addSystemMessage = useCallback((content: string) => {
    setConversation((prev) => prev.appendSystemMessage(content));
  }, []);

  const reset = useCallback(() => {
    setConversation(Conversation.create(conversationId));
  }, [conversationId]);

  return {
    conversation,
    addUserMessage,
    addAssistantMessage,
    addToolResults,
    addSystemMessage,
    reset,
  };
}
