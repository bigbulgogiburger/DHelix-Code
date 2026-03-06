import { describe, it, expect } from "vitest";
import { bashExecTool } from "../../../../src/tools/definitions/bash-exec.js";

const context = {
  workingDirectory: process.cwd(),
  signal: new AbortController().signal,
};

describe("bash_exec tool", () => {
  it("should have correct metadata", () => {
    expect(bashExecTool.name).toBe("bash_exec");
    expect(bashExecTool.permissionLevel).toBe("confirm");
  });

  it("should execute a simple command", async () => {
    const result = await bashExecTool.execute({ command: "echo hello" }, context);
    expect(result.isError).toBe(false);
    expect(result.output).toContain("hello");
  });

  it("should capture exit code in metadata", async () => {
    const result = await bashExecTool.execute({ command: "echo test" }, context);
    expect(result.metadata?.exitCode).toBe(0);
  });

  it("should mark failed commands as errors", async () => {
    const result = await bashExecTool.execute({ command: "exit 1" }, context);
    expect(result.isError).toBe(true);
    expect(result.metadata?.exitCode).toBe(1);
  });

  it("should capture stderr", async () => {
    const result = await bashExecTool.execute({ command: "echo error >&2" }, context);
    expect(result.output).toContain("error");
  });

  it("should handle command with no output", async () => {
    const result = await bashExecTool.execute({ command: "true" }, context);
    expect(result.isError).toBe(false);
    // Should get "(no output)" since `true` produces no stdout/stderr
    expect(result.output).toBeTypeOf("string");
  });

  it("should handle nonexistent command", async () => {
    // A command that doesn't exist - should fail with exit code != 0
    const result = await bashExecTool.execute(
      { command: "this_command_does_not_exist_xyz_123" },
      context,
    );
    expect(result.isError).toBe(true);
    expect(result.output).toBeTypeOf("string");
  });
});
