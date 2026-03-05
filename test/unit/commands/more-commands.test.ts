import { describe, it, expect } from "vitest";
import { clearCommand } from "../../../src/commands/clear.js";
import { compactCommand } from "../../../src/commands/compact.js";
import { helpCommand, setHelpCommands } from "../../../src/commands/help.js";
import { modelCommand } from "../../../src/commands/model.js";
import { effortCommand } from "../../../src/commands/effort.js";
import { fastCommand } from "../../../src/commands/fast.js";
import { simplifyCommand } from "../../../src/commands/simplify.js";
import { batchCommand } from "../../../src/commands/batch.js";
import { debugCommand } from "../../../src/commands/debug.js";

const baseContext = {
  workingDirectory: process.cwd(),
  model: "test-model",
  sessionId: "test-session",
  emit: () => {},
};

describe("Core slash commands", () => {
  it("/clear should clear conversation", async () => {
    const result = await clearCommand.execute("", baseContext);
    expect(result.success).toBe(true);
    expect(result.shouldClear).toBe(true);
  });

  it("/compact should return instructions", async () => {
    const result = await compactCommand.execute("", baseContext);
    expect(result.success).toBe(true);
    expect(result.output).toBeTypeOf("string");
  });

  it("/help should list commands", async () => {
    setHelpCommands([clearCommand, compactCommand, helpCommand]);
    const result = await helpCommand.execute("", baseContext);
    expect(result.success).toBe(true);
    expect(result.output).toContain("clear");
  });

  it("/model should show current model without args", async () => {
    const result = await modelCommand.execute("", baseContext);
    expect(result.output).toContain("test-model");
  });

  it("/model should switch model with args", async () => {
    const result = await modelCommand.execute("gpt-4", baseContext);
    expect(result.newModel).toBe("gpt-4");
  });

  it("/effort should show instructions", async () => {
    const result = await effortCommand.execute("", baseContext);
    expect(result.success).toBe(true);
  });

  it("/fast should toggle fast mode", async () => {
    const result = await fastCommand.execute("", baseContext);
    expect(result.success).toBe(true);
  });

  it("/simplify should provide instructions", async () => {
    const result = await simplifyCommand.execute("", baseContext);
    expect(result.success).toBe(true);
  });

  it("/batch should require args", async () => {
    const result = await batchCommand.execute("", baseContext);
    expect(result.success).toBe(false);
    expect(result.output).toContain("Usage");
  });

  it("/batch should accept pattern and operation", async () => {
    const result = await batchCommand.execute("src/**/*.ts add comments", baseContext);
    expect(result.success).toBe(true);
    expect(result.output).toContain("src/**/*.ts");
  });

  it("/debug should require args", async () => {
    const result = await debugCommand.execute("", baseContext);
    expect(result.success).toBe(false);
    expect(result.output).toContain("Usage");
  });

  it("/debug should accept error description", async () => {
    const result = await debugCommand.execute("TypeError: undefined", baseContext);
    expect(result.success).toBe(true);
    expect(result.output).toContain("TypeError");
  });

  it("all core commands should have name and description", () => {
    const commands = [
      clearCommand,
      compactCommand,
      helpCommand,
      modelCommand,
      effortCommand,
      fastCommand,
      simplifyCommand,
      batchCommand,
      debugCommand,
    ];
    for (const cmd of commands) {
      expect(cmd.name).toBeTypeOf("string");
      expect(cmd.description).toBeTypeOf("string");
      expect(cmd.execute).toBeTypeOf("function");
    }
  });
});
