import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { SQLiteSessionStore } from "../../../../src/core/session/sqlite-store.js";
import { StreamingSessionWriter } from "../../../../src/core/session/streaming-writer.js";
import type { ChatMessage } from "../../../../src/llm/provider.js";

describe("StreamingSessionWriter", () => {
  let store: SQLiteSessionStore;
  let writer: StreamingSessionWriter;
  const SESSION_ID = "test-session-id";

  beforeEach(() => {
    store = new SQLiteSessionStore(":memory:");
    store.createSession({
      id: SESSION_ID,
      model: "gpt-4",
      workingDirectory: "/test",
    });
    writer = new StreamingSessionWriter(store.getDatabase(), SESSION_ID);
  });

  afterEach(() => {
    store.close();
  });

  describe("appendMessage", () => {
    it("should append a user message", () => {
      const message: ChatMessage = {
        role: "user",
        content: "Hello, world!",
      };

      writer.appendMessage(message);

      const messages = writer.loadMessages();
      expect(messages).toHaveLength(1);
      expect(messages[0].role).toBe("user");
      expect(messages[0].content).toBe("Hello, world!");
    });

    it("should append an assistant message", () => {
      writer.appendMessage({ role: "assistant", content: "Hi there!" });

      const messages = writer.loadMessages();
      expect(messages).toHaveLength(1);
      expect(messages[0].role).toBe("assistant");
      expect(messages[0].content).toBe("Hi there!");
    });

    it("should preserve message order (sequence)", () => {
      writer.appendMessage({ role: "user", content: "First" });
      writer.appendMessage({ role: "assistant", content: "Second" });
      writer.appendMessage({ role: "user", content: "Third" });

      const messages = writer.loadMessages();
      expect(messages).toHaveLength(3);
      expect(messages[0].content).toBe("First");
      expect(messages[1].content).toBe("Second");
      expect(messages[2].content).toBe("Third");
    });

    it("should handle messages with tool calls", () => {
      const message: ChatMessage = {
        role: "assistant",
        content: "Let me check that.",
        toolCalls: [
          {
            id: "call_123",
            name: "file_read",
            arguments: '{"path": "/test.ts"}',
          },
        ],
      };

      writer.appendMessage(message);

      const messages = writer.loadMessages();
      expect(messages).toHaveLength(1);
      expect(messages[0].toolCalls).toBeDefined();
      expect(messages[0].toolCalls).toHaveLength(1);
      expect(messages[0].toolCalls![0].id).toBe("call_123");
      expect(messages[0].toolCalls![0].name).toBe("file_read");
    });

    it("should handle tool result messages", () => {
      const message: ChatMessage = {
        role: "tool",
        content: "File content here",
        toolCallId: "call_123",
      };

      writer.appendMessage(message);

      const messages = writer.loadMessages();
      expect(messages).toHaveLength(1);
      expect(messages[0].role).toBe("tool");
      expect(messages[0].toolCallId).toBe("call_123");
    });

    it("should update session message_count", () => {
      writer.appendMessage({ role: "user", content: "Hello" });
      writer.appendMessage({ role: "assistant", content: "Hi" });

      const session = store.getSession(SESSION_ID);
      expect(session?.message_count).toBe(2);
    });

    it("should update session total_tokens", () => {
      writer.appendMessage({ role: "user", content: "Hello" });

      const session = store.getSession(SESSION_ID);
      expect(session?.total_tokens).toBeGreaterThan(0);
    });

    it("should handle empty content", () => {
      writer.appendMessage({ role: "assistant", content: "" });

      const messages = writer.loadMessages();
      expect(messages).toHaveLength(1);
      expect(messages[0].content).toBe("");
    });
  });

  describe("appendMessages (batch)", () => {
    it("should append multiple messages at once", () => {
      const msgs: ChatMessage[] = [
        { role: "user", content: "Q1" },
        { role: "assistant", content: "A1" },
        { role: "user", content: "Q2" },
        { role: "assistant", content: "A2" },
      ];

      writer.appendMessages(msgs);

      const loaded = writer.loadMessages();
      expect(loaded).toHaveLength(4);
      expect(loaded[0].content).toBe("Q1");
      expect(loaded[3].content).toBe("A2");
    });

    it("should handle empty array", () => {
      writer.appendMessages([]);
      const loaded = writer.loadMessages();
      expect(loaded).toHaveLength(0);
    });

    it("should update session message_count correctly for batch", () => {
      writer.appendMessages([
        { role: "user", content: "Q1" },
        { role: "assistant", content: "A1" },
        { role: "user", content: "Q2" },
      ]);

      const session = store.getSession(SESSION_ID);
      expect(session?.message_count).toBe(3);
    });
  });

  describe("loadMessages", () => {
    it("should return empty array for session with no messages", () => {
      const messages = writer.loadMessages();
      expect(messages).toEqual([]);
    });

    it("should not include toolCallId when it is null", () => {
      writer.appendMessage({ role: "user", content: "Hello" });
      const messages = writer.loadMessages();
      expect(messages[0]).not.toHaveProperty("toolCallId");
    });

    it("should not include toolCalls when it is null", () => {
      writer.appendMessage({ role: "user", content: "Hello" });
      const messages = writer.loadMessages();
      expect(messages[0]).not.toHaveProperty("toolCalls");
    });
  });

  describe("getMessageCount", () => {
    it("should return 0 for empty session", () => {
      expect(writer.getMessageCount()).toBe(0);
    });

    it("should return correct count after appending messages", () => {
      writer.appendMessage({ role: "user", content: "Hello" });
      writer.appendMessage({ role: "assistant", content: "Hi" });
      expect(writer.getMessageCount()).toBe(2);
    });
  });

  describe("resume support", () => {
    it("should continue sequence from existing messages", () => {
      // 첫 번째 writer로 메시지 추가
      writer.appendMessage({ role: "user", content: "First" });
      writer.appendMessage({ role: "assistant", content: "Second" });

      // 두 번째 writer 생성 (resume 시뮬레이션)
      const writer2 = new StreamingSessionWriter(store.getDatabase(), SESSION_ID);
      writer2.appendMessage({ role: "user", content: "Third" });

      // 모든 메시지가 올바른 순서로 로드되는지 확인
      const messages = writer2.loadMessages();
      expect(messages).toHaveLength(3);
      expect(messages[0].content).toBe("First");
      expect(messages[1].content).toBe("Second");
      expect(messages[2].content).toBe("Third");
    });
  });

  describe("getSessionId", () => {
    it("should return the session ID", () => {
      expect(writer.getSessionId()).toBe(SESSION_ID);
    });
  });
});
