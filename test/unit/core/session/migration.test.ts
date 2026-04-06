import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm, mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { SQLiteSessionStore } from "../../../../src/core/session/sqlite-store.js";
import { StreamingSessionWriter } from "../../../../src/core/session/streaming-writer.js";
import {
  migrateJsonlToSqlite,
  isMigrationComplete,
} from "../../../../src/core/session/migration.js";

describe("JSONL to SQLite Migration", () => {
  let tempDir: string;
  let store: SQLiteSessionStore;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "dhelix-migration-test-"));
    store = new SQLiteSessionStore(":memory:");
  });

  afterEach(async () => {
    store.close();
    await rm(tempDir, { recursive: true, force: true });
  });

  /**
   * WriterFactory for tests — creates StreamingSessionWriter directly
   */
  function testWriterFactory(
    storeInstance: SQLiteSessionStore,
    sessionId: string,
  ): StreamingSessionWriter {
    return new StreamingSessionWriter(storeInstance.getDatabase(), sessionId);
  }

  /**
   * Helper: create a JSONL session directory structure
   */
  async function createJsonlSession(
    sessionId: string,
    metadata: {
      name: string;
      model: string;
      workingDirectory: string;
      messageCount: number;
    },
    messages: Array<{ role: string; content: string; toolCallId?: string }>,
  ): Promise<void> {
    const sessionDir = join(tempDir, sessionId);
    await mkdir(sessionDir, { recursive: true });

    const now = new Date().toISOString();
    const meta = {
      id: sessionId,
      name: metadata.name,
      createdAt: now,
      lastUsedAt: now,
      workingDirectory: metadata.workingDirectory,
      model: metadata.model,
      messageCount: metadata.messageCount,
    };

    await writeFile(join(sessionDir, "metadata.json"), JSON.stringify(meta), "utf-8");

    const lines = messages.map((m) =>
      JSON.stringify({
        role: m.role,
        content: m.content,
        timestamp: now,
        ...(m.toolCallId ? { toolCallId: m.toolCallId } : {}),
      }),
    );
    await writeFile(join(sessionDir, "transcript.jsonl"), lines.join("\n") + "\n", "utf-8");
  }

  /**
   * Helper: create index.json
   */
  async function createIndex(
    entries: Array<{ id: string; name: string }>,
  ): Promise<void> {
    const now = new Date().toISOString();
    const indexEntries = entries.map((e) => ({
      id: e.id,
      name: e.name,
      createdAt: now,
      lastUsedAt: now,
      messageCount: 0,
    }));
    await writeFile(join(tempDir, "index.json"), JSON.stringify(indexEntries), "utf-8");
  }

  describe("migrateJsonlToSqlite", () => {
    it("should migrate a single session with messages", async () => {
      const sessionId = "11111111-1111-1111-1111-111111111111";

      await createIndex([{ id: sessionId, name: "Test Session" }]);
      await createJsonlSession(
        sessionId,
        { name: "Test Session", model: "gpt-4", workingDirectory: "/test", messageCount: 2 },
        [
          { role: "user", content: "Hello" },
          { role: "assistant", content: "Hi there!" },
        ],
      );

      const result = await migrateJsonlToSqlite(tempDir, store, testWriterFactory);

      expect(result.alreadyMigrated).toBe(false);
      expect(result.totalSessions).toBe(1);
      expect(result.successCount).toBe(1);
      expect(result.failCount).toBe(0);

      // 세션이 SQLite에 존재하는지 확인
      const session = store.getSession(sessionId);
      expect(session).toBeDefined();
      expect(session?.title).toBe("Test Session");
      expect(session?.model).toBe("gpt-4");

      // 메시지가 올바르게 마이그레이션되었는지 확인
      const writer = new StreamingSessionWriter(store.getDatabase(), sessionId);
      const messages = writer.loadMessages();
      expect(messages).toHaveLength(2);
      expect(messages[0].role).toBe("user");
      expect(messages[0].content).toBe("Hello");
      expect(messages[1].role).toBe("assistant");
      expect(messages[1].content).toBe("Hi there!");
    });

    it("should migrate multiple sessions", async () => {
      const id1 = "11111111-1111-1111-1111-111111111111";
      const id2 = "22222222-2222-2222-2222-222222222222";

      await createIndex([
        { id: id1, name: "Session 1" },
        { id: id2, name: "Session 2" },
      ]);

      await createJsonlSession(
        id1,
        { name: "Session 1", model: "gpt-4", workingDirectory: "/a", messageCount: 1 },
        [{ role: "user", content: "Hello from 1" }],
      );

      await createJsonlSession(
        id2,
        { name: "Session 2", model: "llama3", workingDirectory: "/b", messageCount: 1 },
        [{ role: "user", content: "Hello from 2" }],
      );

      const result = await migrateJsonlToSqlite(tempDir, store, testWriterFactory);

      expect(result.totalSessions).toBe(2);
      expect(result.successCount).toBe(2);
      expect(result.failCount).toBe(0);
    });

    it("should handle session with no messages", async () => {
      const sessionId = "11111111-1111-1111-1111-111111111111";

      await createIndex([{ id: sessionId, name: "Empty" }]);

      const sessionDir = join(tempDir, sessionId);
      await mkdir(sessionDir, { recursive: true });
      await writeFile(
        join(sessionDir, "metadata.json"),
        JSON.stringify({
          id: sessionId,
          name: "Empty",
          createdAt: new Date().toISOString(),
          lastUsedAt: new Date().toISOString(),
          workingDirectory: "/test",
          model: "gpt-4",
          messageCount: 0,
        }),
        "utf-8",
      );
      await writeFile(join(sessionDir, "transcript.jsonl"), "", "utf-8");

      const result = await migrateJsonlToSqlite(tempDir, store, testWriterFactory);
      expect(result.successCount).toBe(1);

      const session = store.getSession(sessionId);
      expect(session?.message_count).toBe(0);
    });

    it("should handle missing metadata.json gracefully", async () => {
      const sessionId = "11111111-1111-1111-1111-111111111111";

      await createIndex([{ id: sessionId, name: "Bad" }]);

      // 세션 디렉토리만 생성하고 metadata.json은 생성하지 않음
      await mkdir(join(tempDir, sessionId), { recursive: true });

      const result = await migrateJsonlToSqlite(tempDir, store, testWriterFactory);
      expect(result.failCount).toBe(1);
      expect(result.sessions[0].error).toContain("metadata.json");
    });

    it("should not re-migrate if already complete", async () => {
      const sessionId = "11111111-1111-1111-1111-111111111111";

      await createIndex([{ id: sessionId, name: "Test" }]);
      await createJsonlSession(
        sessionId,
        { name: "Test", model: "gpt-4", workingDirectory: "/test", messageCount: 1 },
        [{ role: "user", content: "Hello" }],
      );

      // 첫 번째 마이그레이션
      await migrateJsonlToSqlite(tempDir, store, testWriterFactory);

      // 두 번째 시도 — 이미 완료됨
      const result2 = await migrateJsonlToSqlite(tempDir, store, testWriterFactory);
      expect(result2.alreadyMigrated).toBe(true);
      expect(result2.totalSessions).toBe(0);
    });

    it("should discover sessions by directory scan when index.json is missing", async () => {
      const sessionId = "11111111-1111-1111-1111-111111111111";

      // index.json 없이 세션 디렉토리만 생성
      await createJsonlSession(
        sessionId,
        { name: "Test", model: "gpt-4", workingDirectory: "/test", messageCount: 1 },
        [{ role: "user", content: "Hello" }],
      );

      const result = await migrateJsonlToSqlite(tempDir, store, testWriterFactory);
      expect(result.totalSessions).toBe(1);
      expect(result.successCount).toBe(1);
    });
  });

  describe("isMigrationComplete", () => {
    it("should return false when no marker exists", async () => {
      const complete = await isMigrationComplete(tempDir);
      expect(complete).toBe(false);
    });

    it("should return true after successful migration", async () => {
      const sessionId = "11111111-1111-1111-1111-111111111111";
      await createIndex([{ id: sessionId, name: "Test" }]);
      await createJsonlSession(
        sessionId,
        { name: "Test", model: "gpt-4", workingDirectory: "/test", messageCount: 1 },
        [{ role: "user", content: "Hello" }],
      );

      await migrateJsonlToSqlite(tempDir, store, testWriterFactory);

      const complete = await isMigrationComplete(tempDir);
      expect(complete).toBe(true);
    });
  });

  describe("message count verification", () => {
    it("should verify message count matches", async () => {
      const sessionId = "11111111-1111-1111-1111-111111111111";

      await createIndex([{ id: sessionId, name: "Test" }]);
      await createJsonlSession(
        sessionId,
        { name: "Test", model: "gpt-4", workingDirectory: "/test", messageCount: 3 },
        [
          { role: "user", content: "Q1" },
          { role: "assistant", content: "A1" },
          { role: "user", content: "Q2" },
        ],
      );

      const result = await migrateJsonlToSqlite(tempDir, store, testWriterFactory);
      expect(result.sessions[0].messageCount).toBe(3);
      expect(result.sessions[0].success).toBe(true);
    });
  });
});
