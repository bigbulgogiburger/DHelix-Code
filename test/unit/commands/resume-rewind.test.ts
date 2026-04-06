import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mcpCommand } from "../../../src/commands/mcp.js";
import { configCommand } from "../../../src/commands/config.js";
import { updateCommand } from "../../../src/commands/update.js";
import { SessionManager } from "../../../src/core/session-manager.js";
import { CheckpointManager } from "../../../src/core/checkpoint-manager.js";
import { mkdir, rm, writeFile, readFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

const baseContext = {
  workingDirectory: process.cwd(),
  model: "test-model",
  sessionId: "test-session",
  emit: () => {},
};

describe("resume command", () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = join(tmpdir(), `dhelix-resume-test-${Date.now()}`);
    await mkdir(tmpDir, { recursive: true });
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it("should have correct metadata", async () => {
    const { resumeCommand } = await import("../../../src/commands/resume.js");
    expect(resumeCommand.name).toBe("resume");
    expect(resumeCommand.execute).toBeTypeOf("function");
  });

  it("should list no sessions when empty", async () => {
    // Mock SessionManager constructor to use our tmp dir
    const listMock = vi.spyOn(SessionManager.prototype, "listSessions");
    listMock.mockResolvedValueOnce([]);

    const { resumeCommand } = await import("../../../src/commands/resume.js");
    const result = await resumeCommand.execute("", baseContext);
    expect(result.output).toContain("No saved sessions");
    expect(result.success).toBe(true);

    listMock.mockRestore();
  });

  it("should return interactiveSelect when sessions exist", async () => {
    const listMock = vi.spyOn(SessionManager.prototype, "listSessions");
    listMock.mockResolvedValueOnce([
      {
        id: "abc12345-session-id",
        name: "My Session",
        model: "gpt-4o",
        workingDirectory: process.cwd(),
        createdAt: new Date().toISOString(),
        lastUsedAt: new Date().toISOString(),
        messageCount: 5,
        tokenUsage: { input: 100, output: 200 },
      },
    ]);

    const { resumeCommand } = await import("../../../src/commands/resume.js");
    const result = await resumeCommand.execute("", baseContext);
    expect(result.success).toBe(true);
    expect(result.interactiveSelect).toBeDefined();
    expect(result.interactiveSelect!.prompt).toContain("Select a session");
    expect(result.interactiveSelect!.onSelect).toBe("/resume");
    expect(result.interactiveSelect!.options).toHaveLength(1);
    expect(result.interactiveSelect!.options[0]!.value).toBe("abc12345-session-id");
    expect(result.interactiveSelect!.options[0]!.label).toContain("abc12345");
    expect(result.interactiveSelect!.options[0]!.description).toBe("My Session");

    listMock.mockRestore();
  });

  it("should resume session by partial ID match", async () => {
    const listMock = vi.spyOn(SessionManager.prototype, "listSessions");
    listMock.mockResolvedValueOnce([
      {
        id: "abc12345-full-session-id",
        name: "Matching Session",
        model: "gpt-4o",
        workingDirectory: process.cwd(),
        createdAt: new Date().toISOString(),
        lastUsedAt: new Date().toISOString(),
        messageCount: 3,
        tokenUsage: { input: 50, output: 100 },
      },
    ]);

    const { resumeCommand } = await import("../../../src/commands/resume.js");
    const result = await resumeCommand.execute("abc12345", baseContext);
    expect(result.output).toContain("Resuming session");
    expect(result.output).toContain("Matching Session");
    expect(result.success).toBe(true);

    listMock.mockRestore();
  });

  it("should handle resume with non-existent session id", async () => {
    const { resumeCommand } = await import("../../../src/commands/resume.js");
    const result = await resumeCommand.execute("nonexistent-session-id", baseContext);
    expect(result.output).toContain("Session not found");
    expect(result.success).toBe(false);
  });

  it("should handle session listing error gracefully", async () => {
    const listMock = vi.spyOn(SessionManager.prototype, "listSessions");
    listMock.mockRejectedValueOnce(new Error("Filesystem error"));

    const { resumeCommand } = await import("../../../src/commands/resume.js");
    const result = await resumeCommand.execute("some-id", baseContext);
    expect(result.output).toContain("Failed to resume session");
    expect(result.success).toBe(false);

    listMock.mockRestore();
  });
});

describe("rewind command", () => {
  let tmpDir: string;
  let sessionDir: string;

  beforeEach(async () => {
    tmpDir = join(tmpdir(), `dhelix-rewind-test-${Date.now()}`);
    sessionDir = join(tmpDir, "test-session");
    await mkdir(sessionDir, { recursive: true });
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it("should have correct metadata", async () => {
    const { rewindCommand } = await import("../../../src/commands/rewind.js");
    expect(rewindCommand.name).toBe("rewind");
    expect(rewindCommand.execute).toBeTypeOf("function");
  });

  it("should report no active session when sessionId is missing", async () => {
    const { rewindCommand } = await import("../../../src/commands/rewind.js");
    const result = await rewindCommand.execute("", {
      ...baseContext,
      sessionId: undefined,
    });
    expect(result.output).toContain("No active session");
    expect(result.success).toBe(false);
  });

  it("should list empty checkpoints via command", async () => {
    // Mock listCheckpoints to return empty
    const listMock = vi.spyOn(CheckpointManager.prototype, "listCheckpoints");
    listMock.mockResolvedValueOnce([]);

    const { rewindCommand } = await import("../../../src/commands/rewind.js");
    const result = await rewindCommand.execute("", baseContext);
    expect(result.output).toContain("No checkpoints found");
    expect(result.success).toBe(true);

    listMock.mockRestore();
  });

  it("should list checkpoints when they exist via command", async () => {
    const listMock = vi.spyOn(CheckpointManager.prototype, "listCheckpoints");
    listMock.mockResolvedValueOnce([
      {
        id: "cp-001",
        sessionId: "test-session",
        createdAt: new Date().toISOString(),
        description: "Before editing app.ts",
        messageIndex: 3,
        files: [
          { relativePath: "src/app.ts", contentHash: "abc123", size: 500, exists: true },
          { relativePath: "src/utils.ts", contentHash: "def456", size: 200, exists: true },
        ],
      },
    ]);

    const { rewindCommand } = await import("../../../src/commands/rewind.js");
    const result = await rewindCommand.execute("", baseContext);
    expect(result.output).toContain("Available checkpoints");
    expect(result.output).toContain("cp-001");
    expect(result.output).toContain("Before editing app.ts");
    expect(result.output).toContain("2 file(s) tracked");
    expect(result.output).toContain("/rewind <checkpoint-id>");
    expect(result.success).toBe(true);

    listMock.mockRestore();
  });

  it("should restore checkpoint via command", async () => {
    const diffMock = vi.spyOn(CheckpointManager.prototype, "diffFromCheckpoint");
    diffMock.mockResolvedValueOnce([
      { path: "src/app.ts", status: "modified" },
      { path: "src/utils.ts", status: "modified" },
    ]);

    const restoreMock = vi.spyOn(CheckpointManager.prototype, "restoreCheckpoint");
    restoreMock.mockResolvedValueOnce({
      restoredFiles: ["src/app.ts", "src/utils.ts"],
      skippedFiles: [],
      checkpoint: {
        id: "cp-001",
        sessionId: "test-session",
        createdAt: new Date().toISOString(),
        description: "Before editing",
        messageIndex: 3,
        files: [],
      },
    });

    const { rewindCommand } = await import("../../../src/commands/rewind.js");
    const result = await rewindCommand.execute("cp-001", baseContext);
    expect(result.output).toContain("Restored checkpoint: cp-001");
    expect(result.output).toContain("Restored 2 file(s)");
    expect(result.success).toBe(true);

    restoreMock.mockRestore();
    diffMock.mockRestore();
  });

  it("should report skipped files during restore via command", async () => {
    const diffMock = vi.spyOn(CheckpointManager.prototype, "diffFromCheckpoint");
    diffMock.mockResolvedValueOnce([
      { path: "src/app.ts", status: "modified" },
      { path: "src/missing.ts", status: "deleted" },
    ]);

    const restoreMock = vi.spyOn(CheckpointManager.prototype, "restoreCheckpoint");
    restoreMock.mockResolvedValueOnce({
      restoredFiles: ["src/app.ts"],
      skippedFiles: ["src/missing.ts"],
      checkpoint: {
        id: "cp-002",
        sessionId: "test-session",
        createdAt: new Date().toISOString(),
        description: "With missing file",
        messageIndex: 5,
        files: [],
      },
    });

    const { rewindCommand } = await import("../../../src/commands/rewind.js");
    const result = await rewindCommand.execute("cp-002", baseContext);
    expect(result.output).toContain("Restored 1 file(s)");
    expect(result.output).toContain("Skipped 1 file(s)");
    expect(result.success).toBe(true);

    restoreMock.mockRestore();
    diffMock.mockRestore();
  });

  it("should handle restore with non-existent checkpoint id", async () => {
    const { rewindCommand } = await import("../../../src/commands/rewind.js");
    const result = await rewindCommand.execute("nonexistent-checkpoint", baseContext);
    expect(result.output).toContain("Failed to restore checkpoint");
    expect(result.success).toBe(false);
  });

  it("should list and restore checkpoints via CheckpointManager directly", async () => {
    const cpManager = new CheckpointManager(sessionDir);

    // Create a temp file and checkpoint it
    const testFilePath = join(tmpDir, "restore-test.txt");
    await writeFile(testFilePath, "Original content", "utf-8");

    const cp = await cpManager.createCheckpoint({
      sessionId: "test-session",
      description: "Before edit",
      messageIndex: 0,
      workingDirectory: tmpDir,
      trackedFiles: ["restore-test.txt"],
    });

    // Verify listing
    const checkpoints = await cpManager.listCheckpoints();
    expect(checkpoints).toHaveLength(1);
    expect(checkpoints[0].description).toBe("Before edit");

    // Modify and restore
    await writeFile(testFilePath, "Modified content", "utf-8");
    const result = await cpManager.restoreCheckpoint(cp.id, tmpDir);
    expect(result.restoredFiles).toContain("restore-test.txt");

    const restored = await readFile(testFilePath, "utf-8");
    expect(restored).toBe("Original content");
  });

  it("should handle non-existent files in checkpoint", async () => {
    const cpManager = new CheckpointManager(sessionDir);

    const cp = await cpManager.createCheckpoint({
      sessionId: "test-session",
      description: "With missing file",
      messageIndex: 0,
      workingDirectory: tmpDir,
      trackedFiles: ["nonexistent-file.txt"],
    });

    const result = await cpManager.restoreCheckpoint(cp.id, tmpDir);
    expect(result.skippedFiles).toContain("nonexistent-file.txt");
  });
});

describe("config command", () => {
  it("should have correct metadata", () => {
    expect(configCommand.name).toBe("config");
    expect(configCommand.execute).toBeTypeOf("function");
  });

  it("should show current config without args", async () => {
    const result = await configCommand.execute("", baseContext);
    expect(result.output).toContain("Current Configuration");
    expect(result.output).toContain("test-model");
    expect(result.success).toBe(true);
  });

  it("should show (none) when sessionId is undefined", async () => {
    const result = await configCommand.execute("", {
      ...baseContext,
      sessionId: undefined,
    });
    expect(result.output).toContain("(none)");
    expect(result.success).toBe(true);
  });

  it("should change model with model key and value", async () => {
    const result = await configCommand.execute("model gpt-4o-mini", baseContext);
    expect(result.output).toContain("gpt-4o-mini");
    expect(result.newModel).toBe("gpt-4o-mini");
  });

  it("should report unknown key", async () => {
    const result = await configCommand.execute("unknownkey", baseContext);
    expect(result.output).toContain("Unknown config key");
    expect(result.success).toBe(false);
  });
});

describe("update command", () => {
  it("should have correct metadata", () => {
    expect(updateCommand.name).toBe("update");
    expect(updateCommand.execute).toBeTypeOf("function");
  });
});

describe("mcp command", () => {
  it("should have correct metadata", () => {
    expect(mcpCommand.name).toBe("mcp");
    expect(mcpCommand.execute).toBeTypeOf("function");
  });

  it("should show help without subcommand", async () => {
    const result = await mcpCommand.execute("", baseContext);
    expect(result.output).toBeTypeOf("string");
  });

  it("should handle list subcommand", async () => {
    const result = await mcpCommand.execute("list", baseContext);
    expect(result.output).toBeTypeOf("string");
  });
});
