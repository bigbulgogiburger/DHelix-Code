import { describe, it, expect } from "vitest";
import { mcpCommand } from "../../../src/commands/mcp.js";

const baseContext = {
  workingDirectory: process.cwd(),
  model: "test-model",
  sessionId: "test-session",
  emit: () => {},
};

describe("/mcp command", () => {
  it("should show help when no subcommand given", async () => {
    const result = await mcpCommand.execute("", baseContext);
    expect(result.success).toBe(true);
    expect(result.output).toContain("MCP Server Management");
    expect(result.output).toContain("/mcp list");
    expect(result.output).toContain("/mcp add");
    expect(result.output).toContain("/mcp remove");
  });

  it("should list servers", async () => {
    const result = await mcpCommand.execute("list", baseContext);
    expect(result.success).toBe(true);
    expect(result.output).toContain("MCP server listing");
  });

  it("should add a server with name and command", async () => {
    const result = await mcpCommand.execute("add postgres pg-mcp --port 5432", baseContext);
    expect(result.success).toBe(true);
    expect(result.output).toContain("postgres");
    expect(result.output).toContain("pg-mcp --port 5432");
  });

  it("should require name and command for add", async () => {
    const result = await mcpCommand.execute("add", baseContext);
    expect(result.success).toBe(false);
    expect(result.output).toContain("Usage");
  });

  it("should require only name for add without command", async () => {
    const result = await mcpCommand.execute("add myserver", baseContext);
    expect(result.success).toBe(false);
    expect(result.output).toContain("Usage");
  });

  it("should remove a server", async () => {
    const result = await mcpCommand.execute("remove postgres", baseContext);
    expect(result.success).toBe(true);
    expect(result.output).toContain("postgres");
    expect(result.output).toContain("removed");
  });

  it("should require name for remove", async () => {
    const result = await mcpCommand.execute("remove", baseContext);
    expect(result.success).toBe(false);
    expect(result.output).toContain("Usage");
  });

  it("should handle serve subcommand", async () => {
    const result = await mcpCommand.execute("serve", baseContext);
    expect(result.success).toBe(false);
    expect(result.output).toContain("not yet implemented");
  });
});
