import { describe, it, expect } from "vitest";
import { Conversation } from "../../../src/core/conversation.js";

describe("Conversation", () => {
  it("should create empty conversation", () => {
    const conv = Conversation.create("test-1");
    expect(conv.id).toBe("test-1");
    expect(conv.length).toBe(0);
    expect(conv.messages).toEqual([]);
  });

  it("should append user message immutably", () => {
    const conv = Conversation.create("test-1");
    const updated = conv.appendUserMessage("Hello");

    expect(updated.length).toBe(1);
    expect(updated.messages[0].role).toBe("user");
    expect(updated.messages[0].content).toBe("Hello");

    // Original unchanged
    expect(conv.length).toBe(0);
  });

  it("should append assistant message immutably", () => {
    const conv = Conversation.create("test-1").appendUserMessage("Hi");
    const updated = conv.appendAssistantMessage("Hello! How can I help?");

    expect(updated.length).toBe(2);
    expect(updated.messages[1].role).toBe("assistant");
    expect(updated.messages[1].content).toBe("Hello! How can I help?");

    // Original unchanged
    expect(conv.length).toBe(1);
  });

  it("should append assistant message with tool calls", () => {
    const conv = Conversation.create("test-1").appendUserMessage("Read file");
    const toolCalls = [{ id: "tc-1", name: "file_read", arguments: '{"path": "test.ts"}' }];
    const updated = conv.appendAssistantMessage("Let me read that file.", toolCalls);

    expect(updated.length).toBe(2);
    const lastMsg = updated.messages[1];
    expect(lastMsg.role).toBe("assistant");
    if (lastMsg.role === "assistant" && "toolCalls" in lastMsg) {
      expect(lastMsg.toolCalls).toHaveLength(1);
      expect(lastMsg.toolCalls[0].name).toBe("file_read");
    }
  });

  it("should append tool results immutably", () => {
    const conv = Conversation.create("test-1")
      .appendUserMessage("Read file")
      .appendAssistantMessage("Reading...", [{ id: "tc-1", name: "file_read", arguments: "{}" }]);

    const updated = conv.appendToolResults([
      { id: "tc-1", output: "file contents here", isError: false },
    ]);

    expect(updated.length).toBe(3);
    expect(updated.messages[2].role).toBe("tool");
    expect(updated.messages[2].content).toBe("file contents here");
  });

  it("should append system message", () => {
    const conv = Conversation.create("test-1").appendSystemMessage("You are helpful.");

    expect(conv.length).toBe(1);
    expect(conv.messages[0].role).toBe("system");
    expect(conv.messages[0].content).toBe("You are helpful.");
  });

  it("should return last message", () => {
    const conv = Conversation.create("test-1")
      .appendUserMessage("Hello")
      .appendAssistantMessage("Hi there");

    expect(conv.lastMessage?.role).toBe("assistant");
    expect(conv.lastMessage?.content).toBe("Hi there");
  });

  it("should return undefined for lastMessage on empty conversation", () => {
    const conv = Conversation.create("test-1");
    expect(conv.lastMessage).toBeUndefined();
  });

  it("should set metadata immutably", () => {
    const conv = Conversation.create("test-1");
    const updated = conv.withMetadata("model", "gpt-4");

    expect(updated.metadata.model).toBe("gpt-4");
    expect(conv.metadata.model).toBeUndefined();
  });

  it("should format messages for LLM", () => {
    const conv = Conversation.create("test-1")
      .appendSystemMessage("System prompt")
      .appendUserMessage("Hello")
      .appendAssistantMessage("Hi");

    const llmMessages = conv.toMessagesForLLM();
    expect(llmMessages).toHaveLength(3);
    expect(llmMessages[0].role).toBe("system");
    expect(llmMessages[1].role).toBe("user");
    expect(llmMessages[2].role).toBe("assistant");
  });
});
