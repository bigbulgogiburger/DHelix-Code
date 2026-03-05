import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { SessionManager } from "../../../src/core/session-manager.js";

describe("SessionManager", () => {
  let tempDir: string;
  let manager: SessionManager;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "dbcode-session-test-"));
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
});
