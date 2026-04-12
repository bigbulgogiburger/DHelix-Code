import { describe, it, expect } from "vitest";
import { dashboardCommand } from "../../../src/commands/dashboard.js";
import { type CommandContext } from "../../../src/commands/registry.js";

const mockContext: CommandContext = {
  workingDirectory: "/tmp",
  model: "gpt-4o",
  messages: [],
  sessionId: "test",
  emit: () => {},
};

describe("dashboard command", () => {
  it("should show status when not running", async () => {
    const result = await dashboardCommand.execute("status", mockContext);
    expect(result.success).toBe(true);
    expect(result.output).toContain("not running");
  });

  it("should show usage hint", async () => {
    const result = await dashboardCommand.execute("", mockContext);
    expect(result.success).toBe(true);
    expect(result.output).toContain("/dashboard start");
  });

  it("should reject invalid port", async () => {
    const result = await dashboardCommand.execute("start 99999", mockContext);
    expect(result.success).toBe(false);
    expect(result.output).toContain("Invalid port");
  });

  it("should reject non-numeric port", async () => {
    const result = await dashboardCommand.execute("start abc", mockContext);
    expect(result.success).toBe(false);
  });

  it("should reject port below 1024", async () => {
    const result = await dashboardCommand.execute("start 80", mockContext);
    expect(result.success).toBe(false);
    expect(result.output).toContain("Invalid port");
  });

  it("should have correct metadata", () => {
    expect(dashboardCommand.name).toBe("dashboard");
    expect(dashboardCommand.description).toBeTruthy();
    expect(dashboardCommand.usage).toContain("/dashboard");
  });

  it("should report not running when stopping without start", async () => {
    const result = await dashboardCommand.execute("stop", mockContext);
    expect(result.success).toBe(true);
    expect(result.output).toContain("not running");
  });
});
