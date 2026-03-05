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
});
