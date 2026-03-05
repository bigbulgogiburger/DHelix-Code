import { describe, it, expect } from "vitest";
import { resumeCommand } from "../../../src/commands/resume.js";
import { rewindCommand } from "../../../src/commands/rewind.js";
import { mcpCommand } from "../../../src/commands/mcp.js";

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
});

describe("rewind command", () => {
  it("should have correct metadata", () => {
    expect(rewindCommand.name).toBe("rewind");
    expect(rewindCommand.execute).toBeTypeOf("function");
  });

  it("should execute", async () => {
    const result = await rewindCommand.execute("", baseContext);
    expect(result.output).toBeTypeOf("string");
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
