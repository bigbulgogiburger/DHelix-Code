import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { SessionManager } from "../../../src/core/session-manager.js";
import { SessionForkManager, CheckpointManager } from "../../../src/core/session-fork.js";

describe("SessionForkManager", () => {
  let tempDir: string;
  let sessionManager: SessionManager;
  let forkManager: SessionForkManager;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "dhelix-fork-test-"));
    sessionManager = new SessionManager(tempDir);
    forkManager = new SessionForkManager(sessionManager, tempDir);
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  // ─── createFork ──────────────────────────────────────────────────────────

  describe("createFork", () => {
    it("should create a fork with all parent messages (default fromMessageIndex)", async () => {
      const parentId = await sessionManager.createSession({
        workingDirectory: "/test",
        model: "test-model",
      });
      await sessionManager.appendMessage(parentId, { role: "user", content: "Hello" });
      await sessionManager.appendMessage(parentId, { role: "assistant", content: "Hi!" });

      const fork = await forkManager.createFork({
        parentSessionId: parentId,
        description: "alternative approach",
      });

      expect(fork.id).toBeDefined();
      expect(fork.parentSessionId).toBe(parentId);
      expect(fork.parentMessageIndex).toBe(2);
      expect(fork.description).toBe("alternative approach");
      expect(fork.status).toBe("active");
      expect(fork.messageCount).toBe(2);

      // Verify fork session has copied messages
      const forkMessages = await sessionManager.loadMessages(fork.id);
      expect(forkMessages).toHaveLength(2);
      expect(forkMessages[0].content).toBe("Hello");
      expect(forkMessages[1].content).toBe("Hi!");
    });

    it("should create a fork from specific message index", async () => {
      const parentId = await sessionManager.createSession({
        workingDirectory: "/test",
        model: "test-model",
      });
      await sessionManager.appendMessage(parentId, { role: "user", content: "msg1" });
      await sessionManager.appendMessage(parentId, { role: "assistant", content: "msg2" });
      await sessionManager.appendMessage(parentId, { role: "user", content: "msg3" });

      const fork = await forkManager.createFork({
        parentSessionId: parentId,
        fromMessageIndex: 1,
        description: "early branch",
      });

      expect(fork.parentMessageIndex).toBe(1);
      expect(fork.messageCount).toBe(1);

      const forkMessages = await sessionManager.loadMessages(fork.id);
      expect(forkMessages).toHaveLength(1);
      expect(forkMessages[0].content).toBe("msg1");
    });

    it("should exclude tool messages when inheritToolResults is false", async () => {
      const parentId = await sessionManager.createSession({
        workingDirectory: "/test",
        model: "test-model",
      });
      await sessionManager.appendMessage(parentId, { role: "user", content: "Hello" });
      await sessionManager.appendMessage(parentId, {
        role: "tool",
        content: "tool result",
        toolCallId: "tc-1",
      });
      await sessionManager.appendMessage(parentId, { role: "assistant", content: "Done" });

      const fork = await forkManager.createFork({
        parentSessionId: parentId,
        description: "no tools",
        inheritToolResults: false,
      });

      const forkMessages = await sessionManager.loadMessages(fork.id);
      expect(forkMessages).toHaveLength(2);
      expect(forkMessages.every((m) => m.role !== "tool")).toBe(true);
    });

    it("should throw on invalid fromMessageIndex", async () => {
      const parentId = await sessionManager.createSession({
        workingDirectory: "/test",
        model: "test-model",
      });
      await sessionManager.appendMessage(parentId, { role: "user", content: "Hello" });

      await expect(
        forkManager.createFork({
          parentSessionId: parentId,
          fromMessageIndex: 10,
          description: "bad index",
        }),
      ).rejects.toThrow("fromMessageIndex out of range");
    });

    it("should allow forking an empty session without fromMessageIndex", async () => {
      const parentId = await sessionManager.createSession({
        workingDirectory: "/test",
        model: "test-model",
      });

      const fork = await forkManager.createFork({
        parentSessionId: parentId,
        description: "empty fork",
      });

      expect(fork.messageCount).toBe(0);
      expect(fork.parentMessageIndex).toBe(0);
    });
  });

  // ─── listForks / getFork ─────────────────────────────────────────────────

  describe("listForks", () => {
    it("should list all forks for a parent session", async () => {
      const parentId = await sessionManager.createSession({
        workingDirectory: "/test",
        model: "test-model",
      });
      await sessionManager.appendMessage(parentId, { role: "user", content: "Hello" });

      await forkManager.createFork({ parentSessionId: parentId, description: "fork-1" });
      await forkManager.createFork({ parentSessionId: parentId, description: "fork-2" });

      const forks = await forkManager.listForks(parentId);
      expect(forks).toHaveLength(2);
      expect(forks[0].description).toBe("fork-1");
      expect(forks[1].description).toBe("fork-2");
    });

    it("should return empty array for session with no forks", async () => {
      const parentId = await sessionManager.createSession({
        workingDirectory: "/test",
        model: "test-model",
      });

      const forks = await forkManager.listForks(parentId);
      expect(forks).toHaveLength(0);
    });
  });

  describe("getFork", () => {
    it("should retrieve a fork by its ID", async () => {
      const parentId = await sessionManager.createSession({
        workingDirectory: "/test",
        model: "test-model",
      });
      await sessionManager.appendMessage(parentId, { role: "user", content: "Hello" });

      const created = await forkManager.createFork({
        parentSessionId: parentId,
        description: "findable",
      });

      const found = await forkManager.getFork(created.id);
      expect(found).toBeDefined();
      expect(found!.id).toBe(created.id);
      expect(found!.description).toBe("findable");
    });

    it("should return undefined for non-existent fork ID", async () => {
      const found = await forkManager.getFork("non-existent-id");
      expect(found).toBeUndefined();
    });
  });

  // ─── merge ───────────────────────────────────────────────────────────────

  describe("merge", () => {
    it("should merge with adopt-all strategy", async () => {
      const parentId = await sessionManager.createSession({
        workingDirectory: "/test",
        model: "test-model",
      });
      await sessionManager.appendMessage(parentId, { role: "user", content: "original" });

      const fork = await forkManager.createFork({
        parentSessionId: parentId,
        description: "adopt test",
      });

      // Add messages to the fork session
      await sessionManager.appendMessage(fork.id, { role: "user", content: "fork msg 1" });
      await sessionManager.appendMessage(fork.id, { role: "assistant", content: "fork msg 2" });

      const result = await forkManager.merge(fork.id, "adopt-all");

      expect(result.success).toBe(true);
      expect(result.mergedMessages).toBe(2);
      expect(result.strategy).toBe("adopt-all");
      expect(result.conflicts).toBeUndefined();

      // Verify parent now has the fork messages
      const parentMessages = await sessionManager.loadMessages(parentId);
      expect(parentMessages).toHaveLength(3); // original + 2 fork messages
      expect(parentMessages[1].content).toBe("fork msg 1");
      expect(parentMessages[2].content).toBe("fork msg 2");
    });

    it("should merge with cherry-pick strategy", async () => {
      const parentId = await sessionManager.createSession({
        workingDirectory: "/test",
        model: "test-model",
      });
      await sessionManager.appendMessage(parentId, { role: "user", content: "original" });

      const fork = await forkManager.createFork({
        parentSessionId: parentId,
        description: "cherry-pick test",
      });

      await sessionManager.appendMessage(fork.id, { role: "user", content: "pick me" });
      await sessionManager.appendMessage(fork.id, { role: "assistant", content: "skip me" });
      await sessionManager.appendMessage(fork.id, { role: "user", content: "pick me too" });

      const result = await forkManager.merge(fork.id, "cherry-pick", {
        messageIndices: [0, 2],
      });

      expect(result.success).toBe(true);
      expect(result.mergedMessages).toBe(2);
      expect(result.strategy).toBe("cherry-pick");

      const parentMessages = await sessionManager.loadMessages(parentId);
      expect(parentMessages).toHaveLength(3); // original + 2 picked
      expect(parentMessages[1].content).toBe("pick me");
      expect(parentMessages[2].content).toBe("pick me too");
    });

    it("should report conflicts for invalid cherry-pick indices", async () => {
      const parentId = await sessionManager.createSession({
        workingDirectory: "/test",
        model: "test-model",
      });
      await sessionManager.appendMessage(parentId, { role: "user", content: "original" });

      const fork = await forkManager.createFork({
        parentSessionId: parentId,
        description: "bad cherry-pick",
      });

      await sessionManager.appendMessage(fork.id, { role: "user", content: "only msg" });

      const result = await forkManager.merge(fork.id, "cherry-pick", {
        messageIndices: [0, 99],
      });

      expect(result.success).toBe(true);
      expect(result.mergedMessages).toBe(1);
      expect(result.conflicts).toBeDefined();
      expect(result.conflicts![0]).toContain("Invalid indices");
    });

    it("should merge with summary-only strategy", async () => {
      const parentId = await sessionManager.createSession({
        workingDirectory: "/test",
        model: "test-model",
      });
      await sessionManager.appendMessage(parentId, { role: "user", content: "original" });

      const fork = await forkManager.createFork({
        parentSessionId: parentId,
        description: "summary test",
      });

      await sessionManager.appendMessage(fork.id, { role: "user", content: "q1" });
      await sessionManager.appendMessage(fork.id, { role: "assistant", content: "a1" });

      const result = await forkManager.merge(fork.id, "summary-only", {
        summaryText: "Explored alternative approach, decided against it.",
      });

      expect(result.success).toBe(true);
      expect(result.mergedMessages).toBe(1);
      expect(result.strategy).toBe("summary-only");

      const parentMessages = await sessionManager.loadMessages(parentId);
      expect(parentMessages).toHaveLength(2);
      expect(parentMessages[1].content).toContain("summary test");
      expect(parentMessages[1].content).toContain("Explored alternative approach");
    });

    it("should throw when merging non-existent fork", async () => {
      await expect(forkManager.merge("fake-id", "adopt-all")).rejects.toThrow("Fork not found");
    });

    it("should throw when merging already merged fork", async () => {
      const parentId = await sessionManager.createSession({
        workingDirectory: "/test",
        model: "test-model",
      });

      const fork = await forkManager.createFork({
        parentSessionId: parentId,
        description: "double merge",
      });

      await forkManager.merge(fork.id, "adopt-all");
      await expect(forkManager.merge(fork.id, "adopt-all")).rejects.toThrow("not active");
    });
  });

  // ─── abandon ─────────────────────────────────────────────────────────────

  describe("abandon", () => {
    it("should mark fork as abandoned", async () => {
      const parentId = await sessionManager.createSession({
        workingDirectory: "/test",
        model: "test-model",
      });

      const fork = await forkManager.createFork({
        parentSessionId: parentId,
        description: "to abandon",
      });

      await forkManager.abandon(fork.id);

      const updated = await forkManager.getFork(fork.id);
      expect(updated!.status).toBe("abandoned");
    });

    it("should throw when abandoning non-existent fork", async () => {
      await expect(forkManager.abandon("fake-id")).rejects.toThrow("Fork not found");
    });
  });

  // ─── compareForks ────────────────────────────────────────────────────────

  describe("compareForks", () => {
    it("should compare multiple forks", async () => {
      const parentId = await sessionManager.createSession({
        workingDirectory: "/test",
        model: "test-model",
      });
      await sessionManager.appendMessage(parentId, { role: "user", content: "Hello" });

      const fork1 = await forkManager.createFork({
        parentSessionId: parentId,
        description: "approach A",
      });
      await sessionManager.appendMessage(fork1.id, { role: "assistant", content: "Result A" });

      const fork2 = await forkManager.createFork({
        parentSessionId: parentId,
        description: "approach B",
      });
      await sessionManager.appendMessage(fork2.id, { role: "assistant", content: "Result B long" });
      await sessionManager.appendMessage(fork2.id, { role: "user", content: "Follow-up B" });

      const comparison = await forkManager.compareForks([fork1.id, fork2.id]);

      expect(comparison.forkIds).toEqual([fork1.id, fork2.id]);
      expect(comparison.descriptions[fork1.id]).toBe("approach A");
      expect(comparison.descriptions[fork2.id]).toBe("approach B");
      expect(comparison.messageCounts[fork1.id]).toBe(2); // 1 copied + 1 new
      expect(comparison.messageCounts[fork2.id]).toBe(3); // 1 copied + 2 new
      expect(comparison.lastMessages[fork1.id]).toBe("Result A");
      expect(comparison.lastMessages[fork2.id]).toBe("Follow-up B");
    });

    it("should handle non-existent fork IDs gracefully", async () => {
      const comparison = await forkManager.compareForks(["non-existent"]);

      expect(comparison.descriptions["non-existent"]).toBe("(not found)");
      expect(comparison.messageCounts["non-existent"]).toBe(0);
    });
  });
});

// ─── CheckpointManager ────────────────────────────────────────────────────

describe("CheckpointManager", () => {
  let tempDir: string;
  let sessionManager: SessionManager;
  let checkpointManager: CheckpointManager;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "dhelix-checkpoint-test-"));
    sessionManager = new SessionManager(tempDir);
    checkpointManager = new CheckpointManager(sessionManager, tempDir);
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  describe("createCheckpoint", () => {
    it("should create a checkpoint and return its ID", async () => {
      const sessionId = await sessionManager.createSession({
        workingDirectory: "/test",
        model: "test-model",
      });
      await sessionManager.appendMessage(sessionId, { role: "user", content: "Hello" });

      const cpId = await checkpointManager.createCheckpoint(sessionId, "before-change");

      expect(cpId).toBeDefined();
      expect(typeof cpId).toBe("string");
    });
  });

  describe("listCheckpoints", () => {
    it("should list all checkpoints for a session", async () => {
      const sessionId = await sessionManager.createSession({
        workingDirectory: "/test",
        model: "test-model",
      });
      await sessionManager.appendMessage(sessionId, { role: "user", content: "msg1" });
      await checkpointManager.createCheckpoint(sessionId, "cp-1");

      await sessionManager.appendMessage(sessionId, { role: "assistant", content: "msg2" });
      await checkpointManager.createCheckpoint(sessionId, "cp-2");

      const checkpoints = await checkpointManager.listCheckpoints(sessionId);

      expect(checkpoints).toHaveLength(2);
      expect(checkpoints[0].label).toBe("cp-1");
      expect(checkpoints[0].messageCount).toBe(1);
      expect(checkpoints[1].label).toBe("cp-2");
      expect(checkpoints[1].messageCount).toBe(2);
    });

    it("should return empty array for session with no checkpoints", async () => {
      const sessionId = await sessionManager.createSession({
        workingDirectory: "/test",
        model: "test-model",
      });

      const checkpoints = await checkpointManager.listCheckpoints(sessionId);
      expect(checkpoints).toHaveLength(0);
    });
  });

  describe("restoreCheckpoint", () => {
    it("should restore a checkpoint as a new session", async () => {
      const sessionId = await sessionManager.createSession({
        workingDirectory: "/test",
        model: "test-model",
      });
      await sessionManager.appendMessage(sessionId, { role: "user", content: "msg1" });
      await sessionManager.appendMessage(sessionId, { role: "assistant", content: "msg2" });

      const cpId = await checkpointManager.createCheckpoint(sessionId, "snapshot");

      // Add more messages after checkpoint
      await sessionManager.appendMessage(sessionId, { role: "user", content: "msg3" });

      // Restore should only have msg1 and msg2
      const restored = await checkpointManager.restoreCheckpoint(cpId);

      expect(restored.checkpointId).toBe(cpId);
      expect(restored.sessionId).toBeDefined();
      expect(restored.messageCount).toBe(2);

      // Verify restored session messages
      const restoredMessages = await sessionManager.loadMessages(restored.sessionId);
      expect(restoredMessages).toHaveLength(2);
      expect(restoredMessages[0].content).toBe("msg1");
      expect(restoredMessages[1].content).toBe("msg2");

      // Original session should still have 3 messages
      const originalMessages = await sessionManager.loadMessages(sessionId);
      expect(originalMessages).toHaveLength(3);
    });

    it("should throw when restoring non-existent checkpoint", async () => {
      await expect(checkpointManager.restoreCheckpoint("non-existent-cp")).rejects.toThrow(
        "Checkpoint not found",
      );
    });
  });
});
