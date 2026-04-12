import { describe, it, expect } from "vitest";
import { type CommandContext } from "../../../src/commands/registry.js";
import { extensionsCommand } from "../../../src/commands/extensions.js";

const mockContext: CommandContext = {
  workingDirectory: "/tmp",
  model: "gpt-4o",
  messages: [],
  sessionId: "test",
  emit: () => {},
  toolCount: 29,
  skillCount: 5,
  commandRegistry: {
    getAll: () => [
      {
        name: "help",
        description: "Show help",
        usage: "/help",
        execute: async () => ({ output: "", success: true }),
      },
      {
        name: "model",
        description: "Change model",
        usage: "/model [name]",
        execute: async () => ({ output: "", success: true }),
      },
      {
        name: "commit",
        description: "Commit changes",
        usage: "/commit",
        execute: async () => ({ output: "", success: true }),
      },
    ],
  } as unknown as CommandContext["commandRegistry"],
};

describe("extensions command", () => {
  it("should show all extension categories", async () => {
    const result = await extensionsCommand.execute("", mockContext);
    expect(result.success).toBe(true);
    expect(result.output).toContain("Extension Points");
    expect(result.output).toContain("Commands");
    expect(result.output).toContain("Skills");
    expect(result.output).toContain("Subagents");
    expect(result.output).toContain("Tools");
  });

  it("should filter by category", async () => {
    const result = await extensionsCommand.execute("commands", mockContext);
    expect(result.success).toBe(true);
    expect(result.output).toContain("Commands");
    expect(result.output).not.toContain("## Skills");
  });

  it("should show tool count", async () => {
    const result = await extensionsCommand.execute("tools", mockContext);
    expect(result.output).toContain("29");
  });

  it("should show skill count", async () => {
    const result = await extensionsCommand.execute("skills", mockContext);
    expect(result.output).toContain("5");
  });

  it("should show quick reference when no filter", async () => {
    const result = await extensionsCommand.execute("", mockContext);
    expect(result.output).toContain("Quick Reference");
    expect(result.output).toContain("/extensions commands");
  });

  it("should not show quick reference when filtering", async () => {
    const result = await extensionsCommand.execute("tools", mockContext);
    expect(result.output).not.toContain("Quick Reference");
  });

  it("should handle agents alias for subagents", async () => {
    const result = await extensionsCommand.execute("agents", mockContext);
    expect(result.output).toContain("Subagents");
    expect(result.output).not.toContain("## Commands");
  });

  it("should handle zero skills gracefully", async () => {
    const noSkillsContext: CommandContext = {
      ...mockContext,
      skillCount: 0,
    };
    const result = await extensionsCommand.execute("skills", noSkillsContext);
    expect(result.output).toContain("No skills loaded");
  });

  it("should group commands by category", async () => {
    const result = await extensionsCommand.execute("commands", mockContext);
    expect(result.output).toContain("**Workflow**");
    expect(result.output).toContain("/commit");
    expect(result.output).toContain("**Info**");
    expect(result.output).toContain("/help");
    expect(result.output).toContain("**Config**");
    expect(result.output).toContain("/model");
  });
});
