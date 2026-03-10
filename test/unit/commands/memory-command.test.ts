import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { memoryCommand } from "../../../src/commands/memory.js";
import { mkdir, rm } from "node:fs/promises";
import { join } from "node:path";

const tmpDir = join(process.cwd(), "test", "tmp", "memory-command");

const baseContext = {
  workingDirectory: tmpDir,
  model: "test-model",
  sessionId: "test-session",
  emit: () => {},
};

describe("/memory command", () => {
  beforeEach(async () => {
    await mkdir(tmpDir, { recursive: true });
  });

  afterEach(async () => {
    try {
      await rm(tmpDir, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
  });

  it("should have correct metadata", () => {
    expect(memoryCommand.name).toBe("memory");
    expect(memoryCommand.description).toBeDefined();
    expect(memoryCommand.usage).toContain("/memory");
  });

  it("should show no memory when directory does not exist", async () => {
    const result = await memoryCommand.execute("", baseContext);
    expect(result.success).toBe(true);
    expect(result.output).toContain("No project memory found");
  });

  it("should save a memory entry with topic", async () => {
    const result = await memoryCommand.execute("save debugging: Found the auth bug", baseContext);
    expect(result.success).toBe(true);
    expect(result.output).toContain("debugging");
  });

  it("should save a memory entry without topic (defaults to General)", async () => {
    const result = await memoryCommand.execute("save Hello world", baseContext);
    expect(result.success).toBe(true);
    expect(result.output).toContain("General");
  });

  it("should show memory content after saving", async () => {
    await memoryCommand.execute("save notes: Some content here", baseContext);

    const result = await memoryCommand.execute("", baseContext);
    expect(result.success).toBe(true);
    expect(result.output).toContain("Some content here");
  });

  it("should detect duplicate entries", async () => {
    await memoryCommand.execute("save notes: Hello world", baseContext);
    const result = await memoryCommand.execute("save notes: Hello world", baseContext);
    expect(result.success).toBe(true);
    expect(result.output).toContain("duplicate");
  });

  it("should list topic files", async () => {
    const result = await memoryCommand.execute("topics", baseContext);
    expect(result.success).toBe(true);
    // No topic files initially (only MEMORY.md exists, topics are separate)
  });

  it("should return error for non-existent topic file", async () => {
    const result = await memoryCommand.execute("read nonexistent", baseContext);
    expect(result.success).toBe(false);
    expect(result.output).toContain("not found");
  });

  it("should clear all memory", async () => {
    await memoryCommand.execute("save notes: data to clear", baseContext);
    const result = await memoryCommand.execute("clear", baseContext);
    expect(result.success).toBe(true);
    expect(result.output).toContain("cleared");

    // Verify memory is empty
    const showResult = await memoryCommand.execute("", baseContext);
    expect(showResult.output).toContain("No project memory found");
  });

  it("should require text for save subcommand", async () => {
    const result = await memoryCommand.execute("save", baseContext);
    expect(result.success).toBe(false);
  });

  it("should require topic for read subcommand", async () => {
    const result = await memoryCommand.execute("read", baseContext);
    expect(result.success).toBe(false);
  });
});
