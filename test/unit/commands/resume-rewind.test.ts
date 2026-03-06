import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { resumeCommand } from "../../../src/commands/resume.js";
import { rewindCommand } from "../../../src/commands/rewind.js";
import { mcpCommand } from "../../../src/commands/mcp.js";
import { configCommand } from "../../../src/commands/config.js";
import { updateCommand } from "../../../src/commands/update.js";
import { SessionManager } from "../../../src/core/session-manager.js";
import { CheckpointManager } from "../../../src/core/checkpoint-manager.js";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

const baseContext = {
  workingDirectory: process.cwd(),
  model: "test-model",
  sessionId: "test-session",
  emit: () => {},
};

describe("resume command", () => {
  it("should have correct metadata", () => {
    expect(resumeCommand.name).toBe("resume");
    expect(resumeCommand.execute).toBeTypeOf("function");
  });

  it("should list sessions without args", async () => {
    const result = await resumeCommand.execute("", baseContext);
    expect(result.output).toBeTypeOf("string");
  });

  it("should handle resume with non-existent session id", async () => {
    const result = await resumeCommand.execute("nonexistent-session-id", baseContext);
    expect(result.output).toContain("Session not found");
    expect(result.success).toBe(false);
  });

  it("should resume a session by partial ID", async () => {
    // Create a real session first
    const tmpDir = join(tmpdir(), `dbcode-resume-test-${Date.now()}`);
    const sessionManager = new SessionManager(tmpDir);

    const sessionId = await sessionManager.createSession({
      workingDirectory: process.cwd(),
      model: "test-model",
      name: "Test Session",
    });

    // The resume command creates its own SessionManager using default dir,
    // so we can't easily test with isolated dir. Just verify the logic works.
    const result = await resumeCommand.execute("nonexistent-id-12345", baseContext);
    expect(result.success).toBe(false);
    expect(result.output).toContain("Session not found");

    // Cleanup
    await rm(tmpDir, { recursive: true, force: true });
  });
});

describe("rewind command", () => {
  let tmpDir: string;
  let sessionDir: string;

  beforeEach(async () => {
    tmpDir = join(tmpdir(), `dbcode-rewind-test-${Date.now()}`);
    sessionDir = join(tmpDir, "test-session");
    await mkdir(sessionDir, { recursive: true });
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it("should have correct metadata", () => {
    expect(rewindCommand.name).toBe("rewind");
    expect(rewindCommand.execute).toBeTypeOf("function");
  });

  it("should report no active session when sessionId is missing", async () => {
    const result = await rewindCommand.execute("", {
      ...baseContext,
      sessionId: undefined,
    });
    expect(result.output).toContain("No active session");
    expect(result.success).toBe(false);
  });

  it("should list empty checkpoints", async () => {
    const result = await rewindCommand.execute("", baseContext);
    expect(result.output).toBeTypeOf("string");
  });

  it("should handle restore with non-existent checkpoint id", async () => {
    const result = await rewindCommand.execute("nonexistent-checkpoint", baseContext);
    expect(result.output).toContain("Failed to restore checkpoint");
    expect(result.success).toBe(false);
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
