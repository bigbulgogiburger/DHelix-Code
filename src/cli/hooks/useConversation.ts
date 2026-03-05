import { useState, useCallback } from "react";
import { Conversation } from "../../core/conversation.js";
import { type ToolCall, type ToolCallResult } from "../../core/message-types.js";

/** Hook for managing immutable conversation state */
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
