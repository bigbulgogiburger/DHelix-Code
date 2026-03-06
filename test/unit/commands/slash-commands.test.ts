import { describe, it, expect } from "vitest";
import { join } from "node:path";
import { configCommand } from "../../../src/commands/config.js";
import { diffCommand } from "../../../src/commands/diff.js";
import { doctorCommand } from "../../../src/commands/doctor.js";
import { statsCommand } from "../../../src/commands/stats.js";
import { contextCommand } from "../../../src/commands/context.js";
import { copyCommand } from "../../../src/commands/copy.js";
import { exportCommand } from "../../../src/commands/export.js";
import { forkCommand } from "../../../src/commands/fork.js";
import { outputStyleCommand } from "../../../src/commands/output-style.js";
import { renameCommand } from "../../../src/commands/rename.js";
import { costCommand } from "../../../src/commands/cost.js";
import { updateCommand } from "../../../src/commands/update.js";

const baseContext = {
  workingDirectory: process.cwd(),
  model: "test-model",
  sessionId: "test-session",
  emit: () => {},
};

describe("Phase 6 slash commands", () => {
  it("/config should have correct metadata", () => {
    expect(configCommand.name).toBe("config");
    expect(configCommand.description).toBeDefined();
    expect(configCommand.execute).toBeTypeOf("function");
  });

  it("/diff should execute successfully", async () => {
    const result = await diffCommand.execute("", baseContext);
    expect(result.success).toBeDefined();
    expect(result.output).toBeTypeOf("string");
  });

  it("/doctor should run diagnostics", async () => {
    const result = await doctorCommand.execute("", baseContext);
    expect(result.output).toContain("Doctor");
    expect(result.output).toContain("Node.js");
  });

  it("/stats should show usage statistics", async () => {
    const result = await statsCommand.execute("", baseContext);
    expect(result.output).toContain("Statistics");
    expect(result.output).toContain("Model");
  });

  it("/context should show context info", async () => {
    const result = await contextCommand.execute("", baseContext);
    expect(result.output).toContain("Context Window");
    expect(result.success).toBe(true);
  });

  it("/copy should handle no code blocks gracefully", async () => {
    const result = await copyCommand.execute("", baseContext);
    expect(result.output).toBeTypeOf("string");
  });

  it("/export should export conversation", async () => {
    const tmpContext = { ...baseContext, workingDirectory: join(process.cwd(), "test", "tmp") };
    const result = await exportCommand.execute("test-export.md", tmpContext);
    expect(result.success).toBe(true);
    expect(result.output).toContain("exported");
    // Cleanup
    const { unlink } = await import("node:fs/promises");
    try {
      await unlink(join(tmpContext.workingDirectory, "test-export.md"));
    } catch {
      /* ignore */
    }
  });

  it("/export should use default filename", async () => {
    const tmpContext = { ...baseContext, workingDirectory: join(process.cwd(), "test", "tmp") };
    const result = await exportCommand.execute("", tmpContext);
    expect(result.success).toBe(true);
    expect(result.output).toContain("dbcode-conversation");
  });

  it("/fork should create fork", async () => {
    const result = await forkCommand.execute("my-fork", baseContext);
    expect(result.success).toBe(true);
    expect(result.output).toContain("my-fork");
  });

  it("/fork should use default name", async () => {
    const result = await forkCommand.execute("", baseContext);
    expect(result.success).toBe(true);
    expect(result.output).toContain("fork-");
  });

  it("/output-style should list available styles", async () => {
    const result = await outputStyleCommand.execute("", baseContext);
    expect(result.output).toContain("default");
  });

  it("/rename should require a name argument", async () => {
    const result = await renameCommand.execute("", baseContext);
    expect(result.success).toBe(false);
    expect(result.output).toContain("name");
  });

  it("/cost should show token cost info", async () => {
    const result = await costCommand.execute("", baseContext);
    expect(result.output).toContain("Cost");
  });

  it("/update should have correct metadata", () => {
    expect(updateCommand.name).toBe("update");
    expect(updateCommand.description).toContain("Update");
  });

  it("all commands should have name, description, and execute", () => {
    const commands = [
      configCommand,
      diffCommand,
      doctorCommand,
      statsCommand,
      contextCommand,
      copyCommand,
      exportCommand,
      forkCommand,
      outputStyleCommand,
      renameCommand,
      costCommand,
      updateCommand,
    ];
    for (const cmd of commands) {
      expect(cmd.name).toBeTypeOf("string");
      expect(cmd.description).toBeTypeOf("string");
      expect(cmd.execute).toBeTypeOf("function");
    }
  });
});
