import { describe, it, expect } from "vitest";
import { planCommand } from "../../../src/commands/plan.js";

const mockContext = {
  workingDirectory: process.cwd(),
  model: "test-model",
  sessionId: "test-session",
  emit: () => {},
};

describe("plan command", () => {
  it("should return newPermissionMode: plan on enable", async () => {
    const result = await planCommand.execute("on", mockContext);
    expect(result.newPermissionMode).toBe("plan");
    expect(result.refreshInstructions).toBe(true);
    expect(result.success).toBe(true);
    expect(result.output).toContain("Plan mode enabled");
  });

  it("should return newPermissionMode: plan with no args", async () => {
    const result = await planCommand.execute("", mockContext);
    expect(result.newPermissionMode).toBe("plan");
    expect(result.refreshInstructions).toBe(true);
    expect(result.success).toBe(true);
  });

  it("should return newPermissionMode: default on disable", async () => {
    const result = await planCommand.execute("off", mockContext);
    expect(result.newPermissionMode).toBe("default");
    expect(result.refreshInstructions).toBe(true);
    expect(result.success).toBe(true);
    expect(result.output).toContain("Plan mode disabled");
  });

  it("should list available tools in plan mode output", async () => {
    const result = await planCommand.execute("on", mockContext);
    expect(result.output).toContain("file_read");
    expect(result.output).toContain("glob_search");
    expect(result.output).toContain("grep_search");
    expect(result.output).toContain("list_dir");
  });

  it("should list blocked tools in plan mode output", async () => {
    const result = await planCommand.execute("on", mockContext);
    expect(result.output).toContain("file_write");
    expect(result.output).toContain("file_edit");
    expect(result.output).toContain("bash_exec");
  });

  it("should have correct command metadata", () => {
    expect(planCommand.name).toBe("plan");
    expect(planCommand.description).toContain("plan mode");
    expect(planCommand.usage).toContain("/plan");
  });
});
