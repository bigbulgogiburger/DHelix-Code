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
});
