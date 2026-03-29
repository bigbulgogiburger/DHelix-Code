import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm, mkdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { SessionManager, atomicWrite, withFileLock } from "../../../src/core/session-manager.js";

describe("SessionManager", () => {
  let tempDir: string;
  let manager: SessionManager;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "dhelix-session-test-"));
    manager = new SessionManager(tempDir);
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it("should create a new session and return its ID", async () => {
    const id = await manager.createSession({
      workingDirectory: "/test/project",
      model: "llama3.1",
    });

    expect(id).toBeDefined();
    expect(typeof id).toBe("string");
    expect(id.length).toBeGreaterThan(0);
  });

  it("should store and retrieve session metadata", async () => {
    const id = await manager.createSession({
      workingDirectory: "/test/project",
      model: "llama3.1",
      name: "Test Session",
    });

    const metadata = await manager.getMetadata(id);

    expect(metadata.id).toBe(id);
    expect(metadata.name).toBe("Test Session");
    expect(metadata.workingDirectory).toBe("/test/project");
    expect(metadata.model).toBe("llama3.1");
    expect(metadata.messageCount).toBe(0);
  });

  it("should append and load messages", async () => {
    const id = await manager.createSession({
      workingDirectory: "/test",
      model: "test-model",
    });

    await manager.appendMessage(id, { role: "user", content: "Hello" });
    await manager.appendMessage(id, { role: "assistant", content: "Hi there!" });

    const messages = await manager.loadMessages(id);

    expect(messages).toHaveLength(2);
    expect(messages[0].role).toBe("user");
    expect(messages[0].content).toBe("Hello");
    expect(messages[1].role).toBe("assistant");
    expect(messages[1].content).toBe("Hi there!");
  });

  it("should batch append messages", async () => {
    const id = await manager.createSession({
      workingDirectory: "/test",
      model: "test-model",
    });

    await manager.appendMessages(id, [
      { role: "user", content: "msg1" },
      { role: "assistant", content: "msg2" },
      { role: "user", content: "msg3" },
    ]);

    const messages = await manager.loadMessages(id);
    expect(messages).toHaveLength(3);

    const metadata = await manager.getMetadata(id);
    expect(metadata.messageCount).toBe(3);
  });

  it("should list sessions sorted by last used", async () => {
    const id1 = await manager.createSession({
      workingDirectory: "/test1",
      model: "m1",
      name: "First",
    });
    const id2 = await manager.createSession({
      workingDirectory: "/test2",
      model: "m2",
      name: "Second",
    });

    // Touch first session to make it more recent
    await manager.appendMessage(id1, { role: "user", content: "ping" });

    const sessions = await manager.listSessions();

    expect(sessions).toHaveLength(2);
    expect(sessions[0].id).toBe(id1); // Most recently used
    expect(sessions[1].id).toBe(id2);
  });

  it("should get most recent session ID", async () => {
    await manager.createSession({ workingDirectory: "/a", model: "m" });
    const id2 = await manager.createSession({ workingDirectory: "/b", model: "m" });

    const recent = await manager.getMostRecentSessionId();
    expect(recent).toBe(id2);
  });

  it("should return null when no sessions exist", async () => {
    const recent = await manager.getMostRecentSessionId();
    expect(recent).toBeNull();
  });

  it("should rename a session", async () => {
    const id = await manager.createSession({
      workingDirectory: "/test",
      model: "m",
      name: "Original",
    });

    await manager.renameSession(id, "Renamed");

    const metadata = await manager.getMetadata(id);
    expect(metadata.name).toBe("Renamed");
  });

  it("should auto-name session from first user message", async () => {
    const id = await manager.createSession({
      workingDirectory: "/test",
      model: "m",
    });

    await manager.autoNameSession(id, "Fix the authentication bug in the login flow");

    const metadata = await manager.getMetadata(id);
    expect(metadata.name).toBe("Fix the authentication bug in the login flow");
  });

  it("should truncate long auto-names to 50 characters", async () => {
    const id = await manager.createSession({
      workingDirectory: "/test",
      model: "m",
    });

    const longMessage =
      "This is a very long message that should be truncated because it exceeds the fifty character limit for session names";
    await manager.autoNameSession(id, longMessage);

    const metadata = await manager.getMetadata(id);
    expect(metadata.name.length).toBeLessThanOrEqual(50);
    expect(metadata.name.endsWith("...")).toBe(true);
  });

  it("should delete a session", async () => {
    const id = await manager.createSession({
      workingDirectory: "/test",
      model: "m",
    });

    await manager.deleteSession(id);

    const sessions = await manager.listSessions();
    expect(sessions).toHaveLength(0);
  });

  it("should throw when getting metadata for nonexistent session", async () => {
    await expect(manager.getMetadata("nonexistent-id")).rejects.toThrow("Session not found");
  });

  it("should fork a session with all messages", async () => {
    const id = await manager.createSession({
      workingDirectory: "/test",
      model: "test-model",
      name: "Original",
    });
    await manager.appendMessage(id, { role: "user", content: "Hello" });
    await manager.appendMessage(id, { role: "assistant", content: "Hi!" });

    const forkedId = await manager.forkSession(id, { name: "My Fork" });

    expect(forkedId).not.toBe(id);

    const forkedMeta = await manager.getMetadata(forkedId);
    expect(forkedMeta.name).toBe("My Fork");
    expect(forkedMeta.model).toBe("test-model");
    expect(forkedMeta.workingDirectory).toBe("/test");
    expect(forkedMeta.messageCount).toBe(2);

    const forkedMessages = await manager.loadMessages(forkedId);
    expect(forkedMessages).toHaveLength(2);
    expect(forkedMessages[0].content).toBe("Hello");
    expect(forkedMessages[1].content).toBe("Hi!");
  });

  it("should fork with auto-generated name when none provided", async () => {
    const id = await manager.createSession({
      workingDirectory: "/test",
      model: "m",
      name: "Source Session",
    });

    const forkedId = await manager.forkSession(id);

    const meta = await manager.getMetadata(forkedId);
    expect(meta.name).toContain("Fork of Source Session");
  });

  it("should throw when forking nonexistent session", async () => {
    await expect(manager.forkSession("nonexistent")).rejects.toThrow("Session not found");
  });

  describe("concurrent access", () => {
    it("should handle concurrent appendMessage calls without data loss", async () => {
      const id = await manager.createSession({
        workingDirectory: "/test",
        model: "test-model",
      });

      // Fire 10 concurrent appends
      const promises = Array.from({ length: 10 }, (_, i) =>
        manager.appendMessage(id, { role: "user", content: `msg-${i}` }),
      );
      await Promise.all(promises);

      const messages = await manager.loadMessages(id);
      expect(messages).toHaveLength(10);

      const metadata = await manager.getMetadata(id);
      expect(metadata.messageCount).toBe(10);
    });

    it("should handle concurrent createSession calls", async () => {
      const promises = Array.from({ length: 5 }, (_, i) =>
        manager.createSession({
          workingDirectory: `/test/${i}`,
          model: "test-model",
          name: `Session ${i}`,
        }),
      );
      const ids = await Promise.all(promises);

      expect(new Set(ids).size).toBe(5); // All unique
      const sessions = await manager.listSessions();
      expect(sessions).toHaveLength(5);
    });

    it("should handle concurrent appendMessages (batch) calls", async () => {
      const id = await manager.createSession({
        workingDirectory: "/test",
        model: "test-model",
      });

      const promises = Array.from({ length: 5 }, (_, i) =>
        manager.appendMessages(id, [
          { role: "user", content: `batch-${i}-a` },
          { role: "assistant", content: `batch-${i}-b` },
        ]),
      );
      await Promise.all(promises);

      const messages = await manager.loadMessages(id);
      expect(messages).toHaveLength(10);

      const metadata = await manager.getMetadata(id);
      expect(metadata.messageCount).toBe(10);
    });
  });
});

describe("atomicWrite", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "dhelix-atomic-test-"));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it("should write file content atomically", async () => {
    const filePath = join(tempDir, "test.json");
    await atomicWrite(filePath, '{"key": "value"}');

    const content = await readFile(filePath, "utf-8");
    expect(content).toBe('{"key": "value"}');
  });

  it("should overwrite existing file atomically", async () => {
    const filePath = join(tempDir, "test.json");
    await atomicWrite(filePath, "original");
    await atomicWrite(filePath, "updated");

    const content = await readFile(filePath, "utf-8");
    expect(content).toBe("updated");
  });
});

describe("withFileLock", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "dhelix-lock-test-"));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it("should execute function exclusively", async () => {
    const lockDir = join(tempDir, "test.lock");
    const order: number[] = [];

    const task = (id: number, delayMs: number) =>
      withFileLock(lockDir, async () => {
        order.push(id);
        await new Promise((r) => setTimeout(r, delayMs));
        order.push(id);
      });

    // Two tasks with overlapping timing
    await Promise.all([task(1, 50), task(2, 50)]);

    // Each task should push its id twice consecutively (not interleaved)
    // Either [1,1,2,2] or [2,2,1,1]
    expect(order).toHaveLength(4);
    expect(order[0]).toBe(order[1]);
    expect(order[2]).toBe(order[3]);
  });

  it("should release lock after function completes", async () => {
    const lockDir = join(tempDir, "test.lock");

    await withFileLock(lockDir, async () => {
      // do nothing
    });

    // Lock directory should be cleaned up
    await expect(readFile(join(lockDir, "pid"), "utf-8")).rejects.toThrow();
  });

  it("should release lock even if function throws", async () => {
    const lockDir = join(tempDir, "test.lock");

    await expect(
      withFileLock(lockDir, async () => {
        throw new Error("test error");
      }),
    ).rejects.toThrow("test error");

    // Should be able to acquire lock again
    const result = await withFileLock(lockDir, async () => "success");
    expect(result).toBe("success");
  });

  it("should timeout when lock cannot be acquired", async () => {
    const lockDir = join(tempDir, "test.lock");

    // Manually create lock dir to simulate held lock
    await mkdir(lockDir);

    await expect(withFileLock(lockDir, async () => "never", 200)).rejects.toThrow(
      "Lock acquisition timeout",
    );

    // Clean up manual lock
    await rm(lockDir, { recursive: true, force: true });
  });

  it("should detect and recover from stale locks", async () => {
    const lockDir = join(tempDir, "stale.lock");

    // Create a stale lock with old timestamp
    await mkdir(lockDir);
    const staleTime = Date.now() - 60_000; // 60 seconds ago
    const { writeFile: wf } = await import("node:fs/promises");
    await wf(join(lockDir, "pid"), `99999\n${staleTime}`, "utf-8");

    // Should recover from stale lock
    const result = await withFileLock(lockDir, async () => "recovered");
    expect(result).toBe("recovered");
  });
});
