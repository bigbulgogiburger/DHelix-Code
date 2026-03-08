import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { memoryCommand } from "../../../src/commands/memory.js";
import { mkdir, rm, readFile } from "node:fs/promises";
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

  it("should list no memory files when directory does not exist", async () => {
    const result = await memoryCommand.execute("", baseContext);
    expect(result.success).toBe(true);
    expect(result.output).toContain("No memory files found");
  });

  it("should write a memory file", async () => {
    const result = await memoryCommand.execute("notes Hello world", baseContext);
    expect(result.success).toBe(true);
    expect(result.output).toContain("notes.md");

    // Verify the file was actually written
    const content = await readFile(join(tmpDir, ".dbcode", "memory", "notes.md"), "utf-8");
    expect(content).toBe("Hello world");
  });

  it("should read a memory file", async () => {
    // Write first
    await memoryCommand.execute("notes Some content here", baseContext);

    // Read
    const result = await memoryCommand.execute("notes", baseContext);
    expect(result.success).toBe(true);
    expect(result.output).toContain("Some content here");
  });

  it("should return error for non-existent memory file", async () => {
    const result = await memoryCommand.execute("nonexistent", baseContext);
    expect(result.success).toBe(false);
    expect(result.output).toContain("not found");
  });

  it("should list memory files after writing", async () => {
    await memoryCommand.execute("alpha First", baseContext);
    await memoryCommand.execute("beta Second", baseContext);

    const result = await memoryCommand.execute("", baseContext);
    expect(result.success).toBe(true);
    expect(result.output).toContain("alpha.md");
    expect(result.output).toContain("beta.md");
  });

  it("should handle .md extension in name", async () => {
    await memoryCommand.execute("test.md Some data", baseContext);

    const result = await memoryCommand.execute("test.md", baseContext);
    expect(result.success).toBe(true);
    expect(result.output).toContain("Some data");
  });
});
