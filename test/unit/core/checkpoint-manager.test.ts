import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { CheckpointManager } from "../../../src/core/checkpoint-manager.js";
import { mkdir, writeFile, rm } from "node:fs/promises";
import { join } from "node:path";

const tmpDir = join(process.cwd(), "test", "tmp", "checkpoints");
const workDir = join(process.cwd(), "test", "tmp", "work");

describe("CheckpointManager", () => {
  beforeEach(async () => {
    await mkdir(tmpDir, { recursive: true });
    await mkdir(workDir, { recursive: true });
    await writeFile(join(workDir, "test.txt"), "hello world", "utf-8");
    await writeFile(join(workDir, "other.txt"), "other content", "utf-8");
  });

  afterEach(async () => {
    try {
      await rm(tmpDir, { recursive: true, force: true });
      await rm(workDir, { recursive: true, force: true });
    } catch {
      // ignore cleanup errors
    }
  });

  it("should create a checkpoint", async () => {
    const manager = new CheckpointManager(tmpDir);
    const checkpoint = await manager.createCheckpoint({
      sessionId: "test-session",
      description: "Initial checkpoint",
      messageIndex: 0,
      workingDirectory: workDir,
      trackedFiles: ["test.txt", "other.txt"],
    });

    expect(checkpoint.id).toBe("cp-001");
    expect(checkpoint.sessionId).toBe("test-session");
    expect(checkpoint.description).toBe("Initial checkpoint");
    expect(checkpoint.files).toHaveLength(2);
    expect(checkpoint.files[0].exists).toBe(true);
    expect(checkpoint.files[0].contentHash).toBeTypeOf("string");
    expect(checkpoint.files[0].contentHash.length).toBe(64); // SHA-256 hex
  });

  it("should list checkpoints", async () => {
    const manager = new CheckpointManager(tmpDir);
    await manager.createCheckpoint({
      sessionId: "test",
      description: "CP1",
      messageIndex: 0,
      workingDirectory: workDir,
      trackedFiles: ["test.txt"],
    });
    await manager.createCheckpoint({
      sessionId: "test",
      description: "CP2",
      messageIndex: 1,
      workingDirectory: workDir,
      trackedFiles: ["test.txt"],
    });

    const list = await manager.listCheckpoints();
    expect(list).toHaveLength(2);
    expect(list[0].id).toBe("cp-001");
    expect(list[1].id).toBe("cp-002");
  });

  it("should restore a checkpoint", async () => {
    const manager = new CheckpointManager(tmpDir);
    await manager.createCheckpoint({
      sessionId: "test",
      description: "Before edit",
      messageIndex: 0,
      workingDirectory: workDir,
      trackedFiles: ["test.txt"],
    });

    // Modify the file
    await writeFile(join(workDir, "test.txt"), "modified content", "utf-8");

    // Restore
    const result = await manager.restoreCheckpoint("cp-001", workDir);
    expect(result.restoredFiles.length).toBeGreaterThan(0);

    // Verify content restored
    const { readFile: rf } = await import("node:fs/promises");
    const content = await rf(join(workDir, "test.txt"), "utf-8");
    expect(content).toBe("hello world");
  });

  it("should handle non-existent tracked files gracefully", async () => {
    const manager = new CheckpointManager(tmpDir);
    const checkpoint = await manager.createCheckpoint({
      sessionId: "test",
      description: "With missing file",
      messageIndex: 0,
      workingDirectory: workDir,
      trackedFiles: ["test.txt", "does-not-exist.txt"],
    });

    const missingFile = checkpoint.files.find((f) => f.relativePath.includes("does-not-exist"));
    expect(missingFile).toBeDefined();
    expect(missingFile!.exists).toBe(false);
  });

  it("should return empty list for new session", async () => {
    const manager = new CheckpointManager(tmpDir);
    const list = await manager.listCheckpoints();
    expect(list).toHaveLength(0);
  });

  it("should get a specific checkpoint by ID", async () => {
    const manager = new CheckpointManager(tmpDir);
    await manager.createCheckpoint({
      sessionId: "test",
      description: "Get by ID",
      messageIndex: 5,
      workingDirectory: workDir,
      trackedFiles: ["test.txt"],
    });

    const cp = await manager.getCheckpoint("cp-001");
    expect(cp.id).toBe("cp-001");
    expect(cp.description).toBe("Get by ID");
    expect(cp.messageIndex).toBe(5);
  });

  it("should throw for non-existent checkpoint ID", async () => {
    const manager = new CheckpointManager(tmpDir);
    await expect(manager.getCheckpoint("cp-999")).rejects.toThrow("Checkpoint not found");
  });

  it("should diff unchanged files from checkpoint", async () => {
    const manager = new CheckpointManager(tmpDir);
    await manager.createCheckpoint({
      sessionId: "test",
      description: "Diff test",
      messageIndex: 0,
      workingDirectory: workDir,
      trackedFiles: ["test.txt", "other.txt"],
    });

    const diff = await manager.diffFromCheckpoint("cp-001", workDir);
    expect(diff).toHaveLength(2);
    expect(diff.every((d) => d.status === "unchanged")).toBe(true);
  });

  it("should diff modified files from checkpoint", async () => {
    const manager = new CheckpointManager(tmpDir);
    await manager.createCheckpoint({
      sessionId: "test",
      description: "Diff modified",
      messageIndex: 0,
      workingDirectory: workDir,
      trackedFiles: ["test.txt"],
    });

    await writeFile(join(workDir, "test.txt"), "changed content", "utf-8");

    const diff = await manager.diffFromCheckpoint("cp-001", workDir);
    expect(diff).toHaveLength(1);
    expect(diff[0].status).toBe("modified");
  });

  it("should diff deleted files from checkpoint", async () => {
    const manager = new CheckpointManager(tmpDir);
    await manager.createCheckpoint({
      sessionId: "test",
      description: "Diff deleted",
      messageIndex: 0,
      workingDirectory: workDir,
      trackedFiles: ["test.txt"],
    });

    await rm(join(workDir, "test.txt"));

    const diff = await manager.diffFromCheckpoint("cp-001", workDir);
    expect(diff).toHaveLength(1);
    expect(diff[0].status).toBe("deleted");
  });

  it("should diff file that was non-existent at checkpoint time but now exists", async () => {
    const manager = new CheckpointManager(tmpDir);
    await manager.createCheckpoint({
      sessionId: "test",
      description: "Diff new",
      messageIndex: 0,
      workingDirectory: workDir,
      trackedFiles: ["future.txt"],
    });

    // future.txt didn't exist at checkpoint time — create it now
    await writeFile(join(workDir, "future.txt"), "new file", "utf-8");

    const diff = await manager.diffFromCheckpoint("cp-001", workDir);
    const futureEntry = diff.find((d) => d.path.includes("future"));
    expect(futureEntry).toBeDefined();
    expect(futureEntry!.status).toBe("new");
  });

  it("should handle restore with skipped files (non-existent snapshot)", async () => {
    const manager = new CheckpointManager(tmpDir);
    await manager.createCheckpoint({
      sessionId: "test",
      description: "Skip test",
      messageIndex: 0,
      workingDirectory: workDir,
      trackedFiles: ["test.txt", "ghost.txt"],
    });

    const result = await manager.restoreCheckpoint("cp-001", workDir);
    expect(result.restoredFiles.length).toBeGreaterThan(0);
    expect(result.skippedFiles.length).toBeGreaterThan(0);
  });

  it("should diff file that was non-existent at checkpoint time and still does not exist", async () => {
    const manager = new CheckpointManager(tmpDir);
    await manager.createCheckpoint({
      sessionId: "test",
      description: "Both missing",
      messageIndex: 0,
      workingDirectory: workDir,
      trackedFiles: ["never-existed.txt"],
    });

    // never-existed.txt didn't exist then and doesn't now — should be "unchanged"
    const diff = await manager.diffFromCheckpoint("cp-001", workDir);
    const entry = diff.find((d) => d.path.includes("never-existed"));
    expect(entry).toBeDefined();
    expect(entry!.status).toBe("unchanged");
  });

  it("should auto-increment checkpoint IDs across instances", async () => {
    const manager1 = new CheckpointManager(tmpDir);
    await manager1.createCheckpoint({
      sessionId: "test",
      description: "First",
      messageIndex: 0,
      workingDirectory: workDir,
      trackedFiles: ["test.txt"],
    });

    // New manager instance should pick up where the last one left off
    const manager2 = new CheckpointManager(tmpDir);
    const cp2 = await manager2.createCheckpoint({
      sessionId: "test",
      description: "Second",
      messageIndex: 1,
      workingDirectory: workDir,
      trackedFiles: ["test.txt"],
    });

    expect(cp2.id).toBe("cp-002");
  });
});
