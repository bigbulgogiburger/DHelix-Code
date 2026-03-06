import { describe, it, expect } from "vitest";
import {
  MessageRole,
  isUserMessage,
  isAssistantMessage,
  isToolMessage,
  isSystemMessage,
  type ChatMessage,
} from "../../../src/core/message-types.js";

describe("message-types", () => {
  describe("MessageRole constants", () => {
    it("should have correct role values", () => {
      expect(MessageRole.System).toBe("system");
      expect(MessageRole.User).toBe("user");
      expect(MessageRole.Assistant).toBe("assistant");
      expect(MessageRole.Tool).toBe("tool");
    });
  });

  describe("type guards", () => {
    const userMsg: ChatMessage = {
      role: MessageRole.User,
      content: "Hello",
      timestamp: new Date(),
    };

    const assistantMsg: ChatMessage = {
      role: MessageRole.Assistant,
      content: "Hi there",
      timestamp: new Date(),
    };

    const toolMsg: ChatMessage = {
      role: MessageRole.Tool,
      content: "result",
      timestamp: new Date(),
    };

    const systemMsg: ChatMessage = {
      role: MessageRole.System,
      content: "You are helpful",
      timestamp: new Date(),
    };

    it("isUserMessage should identify user messages", () => {
      expect(isUserMessage(userMsg)).toBe(true);
      expect(isUserMessage(assistantMsg)).toBe(false);
      expect(isUserMessage(toolMsg)).toBe(false);
      expect(isUserMessage(systemMsg)).toBe(false);
    });

    it("isAssistantMessage should identify assistant messages", () => {
      expect(isAssistantMessage(assistantMsg)).toBe(true);
      expect(isAssistantMessage(userMsg)).toBe(false);
      expect(isAssistantMessage(toolMsg)).toBe(false);
      expect(isAssistantMessage(systemMsg)).toBe(false);
    });

    it("isToolMessage should identify tool messages", () => {
      expect(isToolMessage(toolMsg)).toBe(true);
      expect(isToolMessage(userMsg)).toBe(false);
      expect(isToolMessage(assistantMsg)).toBe(false);
      expect(isToolMessage(systemMsg)).toBe(false);
    });

    it("isSystemMessage should identify system messages", () => {
      expect(isSystemMessage(systemMsg)).toBe(true);
      expect(isSystemMessage(userMsg)).toBe(false);
      expect(isSystemMessage(assistantMsg)).toBe(false);
      expect(isSystemMessage(toolMsg)).toBe(false);
    });
  });
});
