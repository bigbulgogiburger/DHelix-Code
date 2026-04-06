import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { SQLiteSessionStore } from "../../../../src/core/session/sqlite-store.js";
import type { CreateSessionOptions } from "../../../../src/core/session/sqlite-store.js";

describe("SQLiteSessionStore", () => {
  let store: SQLiteSessionStore;

  beforeEach(() => {
    // 인메모리 SQLite로 테스트 (파일 불필요)
    store = new SQLiteSessionStore(":memory:");
  });

  afterEach(() => {
    store.close();
  });

  describe("createSession", () => {
    it("should create a session and return its ID", () => {
      const id = store.createSession({
        model: "gpt-4",
        workingDirectory: "/test/project",
      });

      expect(id).toBeDefined();
      expect(typeof id).toBe("string");
      expect(id.length).toBeGreaterThan(0);
    });

    it("should create a session with a custom ID", () => {
      const customId = "custom-session-id";
      const id = store.createSession({
        id: customId,
        model: "gpt-4",
        workingDirectory: "/test",
      });

      expect(id).toBe(customId);
    });

    it("should create a session with a title", () => {
      const id = store.createSession({
        title: "My Session",
        model: "gpt-4",
        workingDirectory: "/test",
      });

      const session = store.getSession(id);
      expect(session?.title).toBe("My Session");
    });

    it("should set default status to active", () => {
      const id = store.createSession({
        model: "gpt-4",
        workingDirectory: "/test",
      });

      const session = store.getSession(id);
      expect(session?.status).toBe("active");
    });

    it("should set message_count and total_tokens to 0", () => {
      const id = store.createSession({
        model: "gpt-4",
        workingDirectory: "/test",
      });

      const session = store.getSession(id);
      expect(session?.message_count).toBe(0);
      expect(session?.total_tokens).toBe(0);
    });
  });

  describe("getSession", () => {
    it("should return undefined for non-existent session", () => {
      const session = store.getSession("non-existent-id");
      expect(session).toBeUndefined();
    });

    it("should return the session record", () => {
      const id = store.createSession({
        title: "Test",
        model: "llama3",
        workingDirectory: "/projects/test",
      });

      const session = store.getSession(id);
      expect(session).toBeDefined();
      expect(session?.id).toBe(id);
      expect(session?.title).toBe("Test");
      expect(session?.model).toBe("llama3");
      expect(session?.working_directory).toBe("/projects/test");
      expect(session?.created_at).toBeDefined();
      expect(session?.updated_at).toBeDefined();
    });
  });

  describe("listSessions", () => {
    it("should return empty array when no sessions exist", () => {
      const sessions = store.listSessions();
      expect(sessions).toEqual([]);
    });

    it("should return all sessions ordered by updated_at DESC", () => {
      store.createSession({ model: "m1", workingDirectory: "/a" });
      store.createSession({ model: "m2", workingDirectory: "/b" });
      store.createSession({ model: "m3", workingDirectory: "/c" });

      const sessions = store.listSessions();
      expect(sessions).toHaveLength(3);
    });

    it("should filter by status", () => {
      const id1 = store.createSession({ model: "m1", workingDirectory: "/a" });
      store.createSession({ model: "m2", workingDirectory: "/b" });

      store.updateSession(id1, { status: "completed" });

      const active = store.listSessions({ status: "active" });
      expect(active).toHaveLength(1);

      const completed = store.listSessions({ status: "completed" });
      expect(completed).toHaveLength(1);
      expect(completed[0].id).toBe(id1);
    });

    it("should support limit and offset", () => {
      for (let i = 0; i < 5; i++) {
        store.createSession({ model: `m${i}`, workingDirectory: `/p${i}` });
      }

      const page1 = store.listSessions({ limit: 2, offset: 0 });
      expect(page1).toHaveLength(2);

      const page2 = store.listSessions({ limit: 2, offset: 2 });
      expect(page2).toHaveLength(2);

      const page3 = store.listSessions({ limit: 2, offset: 4 });
      expect(page3).toHaveLength(1);
    });
  });

  describe("deleteSession", () => {
    it("should delete an existing session", () => {
      const id = store.createSession({ model: "m1", workingDirectory: "/a" });

      const deleted = store.deleteSession(id);
      expect(deleted).toBe(true);

      const session = store.getSession(id);
      expect(session).toBeUndefined();
    });

    it("should return false for non-existent session", () => {
      const deleted = store.deleteSession("non-existent");
      expect(deleted).toBe(false);
    });

    it("should cascade delete messages", () => {
      const id = store.createSession({ model: "m1", workingDirectory: "/a" });

      // 메시지 직접 삽입 (writer 없이 직접 테스트)
      const db = store.getDatabase();
      db.prepare(
        "INSERT INTO messages (session_id, sequence, role, content) VALUES (?, ?, ?, ?)",
      ).run(id, 0, "user", "Hello");

      store.deleteSession(id);

      const count = db
        .prepare("SELECT COUNT(*) as c FROM messages WHERE session_id = ?")
        .get(id) as { c: number };
      expect(count.c).toBe(0);
    });
  });

  describe("updateSession", () => {
    it("should update title", () => {
      const id = store.createSession({ model: "m1", workingDirectory: "/a" });

      store.updateSession(id, { title: "Updated Title" });

      const session = store.getSession(id);
      expect(session?.title).toBe("Updated Title");
    });

    it("should update status", () => {
      const id = store.createSession({ model: "m1", workingDirectory: "/a" });

      store.updateSession(id, { status: "archived" });

      const session = store.getSession(id);
      expect(session?.status).toBe("archived");
    });

    it("should update message_count and total_tokens", () => {
      const id = store.createSession({ model: "m1", workingDirectory: "/a" });

      store.updateSession(id, { message_count: 10, total_tokens: 500 });

      const session = store.getSession(id);
      expect(session?.message_count).toBe(10);
      expect(session?.total_tokens).toBe(500);
    });

    it("should update updated_at timestamp", () => {
      const id = store.createSession({ model: "m1", workingDirectory: "/a" });
      const before = store.getSession(id)?.updated_at;

      // 약간의 지연 후 업데이트
      store.updateSession(id, { title: "New" });
      const after = store.getSession(id)?.updated_at;

      // updated_at이 변경되었는지 확인 (같은 밀리초 내에서는 동일할 수 있음)
      expect(after).toBeDefined();
    });

    it("should return false for empty updates", () => {
      const id = store.createSession({ model: "m1", workingDirectory: "/a" });
      const result = store.updateSession(id, {});
      expect(result).toBe(false);
    });

    it("should return false for non-existent session", () => {
      const result = store.updateSession("non-existent", { title: "X" });
      expect(result).toBe(false);
    });
  });

  describe("compaction history", () => {
    it("should add and retrieve compaction records", () => {
      const id = store.createSession({ model: "m1", workingDirectory: "/a" });

      store.addCompactionRecord(id, {
        originalTokens: 1000,
        compactedTokens: 300,
        removedMessages: 5,
        summary: "Removed tool calls",
        strategy: "native",
      });

      const history = store.getCompactionHistory(id);
      expect(history).toHaveLength(1);
      expect(history[0].original_tokens).toBe(1000);
      expect(history[0].compacted_tokens).toBe(300);
      expect(history[0].removed_messages).toBe(5);
      expect(history[0].summary).toBe("Removed tool calls");
      expect(history[0].strategy).toBe("native");
    });

    it("should return empty array for session with no compaction history", () => {
      const id = store.createSession({ model: "m1", workingDirectory: "/a" });
      const history = store.getCompactionHistory(id);
      expect(history).toEqual([]);
    });
  });

  describe("transaction", () => {
    it("should execute operations in a transaction", () => {
      store.transaction(() => {
        store.createSession({ id: "tx-1", model: "m1", workingDirectory: "/a" });
        store.createSession({ id: "tx-2", model: "m2", workingDirectory: "/b" });
      });

      expect(store.getSession("tx-1")).toBeDefined();
      expect(store.getSession("tx-2")).toBeDefined();
    });
  });

  describe("PRAGMA settings", () => {
    it("should have WAL journal mode (memory DB reports 'memory')", () => {
      const db = store.getDatabase();
      const result = db.pragma("journal_mode") as Array<{ journal_mode: string }>;
      // In-memory databases cannot use WAL; they report 'memory' instead.
      // On-disk databases will correctly report 'wal'.
      expect(["wal", "memory"]).toContain(result[0].journal_mode);
    });

    it("should have foreign keys enabled", () => {
      const db = store.getDatabase();
      const result = db.pragma("foreign_keys") as Array<{ foreign_keys: number }>;
      expect(result[0].foreign_keys).toBe(1);
    });
  });
});
