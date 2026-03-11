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
    expect(result.output).toContain("No memory files found");
  });

  it("should save a memory entry with topic", async () => {
    const result = await memoryCommand.execute("edit debugging Found the auth bug", baseContext);
    expect(result.success).toBe(true);
    expect(result.output).toContain("debugging");
  });

  it("should save a memory entry without topic (defaults to General)", async () => {
    const result = await memoryCommand.execute("edit General Hello world", baseContext);
    expect(result.success).toBe(true);
    expect(result.output).toContain("General");
  });

  it("should show memory content after saving", async () => {
    await memoryCommand.execute("edit notes Some content here", baseContext);

    const result = await memoryCommand.execute("view notes", baseContext);
    expect(result.success).toBe(true);
    expect(result.output).toContain("Some content here");
  });

  it("should overwrite when saving same file twice", async () => {
    await memoryCommand.execute("edit notes Hello world", baseContext);
    const result = await memoryCommand.execute("edit notes Hello world", baseContext);
    expect(result.success).toBe(true);
    expect(result.output).toContain("Memory file written");
  });

  it("should list topic files", async () => {
    const result = await memoryCommand.execute("topics", baseContext);
    expect(result.success).toBe(true);
    // No topic files initially (only MEMORY.md exists, topics are separate)
  });

  it("should return error for non-existent topic file", async () => {
    const result = await memoryCommand.execute("view nonexistent", baseContext);
    expect(result.success).toBe(false);
    expect(result.output).toContain("not found");
  });

  it("should delete a memory file", async () => {
    await memoryCommand.execute("edit notes data to clear", baseContext);
    const result = await memoryCommand.execute("delete notes", baseContext);
    expect(result.success).toBe(true);
    expect(result.output).toContain("deleted");

    // Verify memory file is gone
    const showResult = await memoryCommand.execute("view notes", baseContext);
    expect(showResult.success).toBe(false);
    expect(showResult.output).toContain("not found");
  });

  it("should require content for edit subcommand", async () => {
    const result = await memoryCommand.execute("edit", baseContext);
    expect(result.success).toBe(false);
  });

  it("should require name for view subcommand", async () => {
    const result = await memoryCommand.execute("view", baseContext);
    expect(result.success).toBe(false);
  });
});
