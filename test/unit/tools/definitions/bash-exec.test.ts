import { describe, it, expect, afterAll } from "vitest";
import { bashExecTool } from "../../../../src/tools/definitions/bash-exec.js";
import { backgroundProcessManager } from "../../../../src/tools/executor.js";
import { readFileSync, existsSync, unlinkSync } from "node:fs";

const context = {
  workingDirectory: process.cwd(),
  signal: new AbortController().signal,
};

// Track output files to clean up
const outputFilesToClean: string[] = [];

afterAll(() => {
  for (const f of outputFilesToClean) {
    try {
      if (existsSync(f)) unlinkSync(f);
    } catch {
      // ignore cleanup errors
    }
  }
});

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
    expect(result.output).toBeTypeOf("string");
  });

  it("should handle nonexistent command", async () => {
    const result = await bashExecTool.execute(
      { command: "this_command_does_not_exist_xyz_123" },
      context,
    );
    expect(result.isError).toBe(true);
    expect(result.output).toBeTypeOf("string");
  });

  describe("description parameter", () => {
    it("should include description in metadata", async () => {
      const result = await bashExecTool.execute(
        { command: "echo hi", description: "Print greeting" },
        context,
      );
      expect(result.isError).toBe(false);
      expect(result.metadata?.description).toBe("Print greeting");
    });

    it("should work without description", async () => {
      const result = await bashExecTool.execute({ command: "echo hi" }, context);
      expect(result.isError).toBe(false);
      expect(result.metadata?.description).toBeUndefined();
    });
  });

  describe("interactive command detection", () => {
    it("should reject git rebase -i", async () => {
      const result = await bashExecTool.execute({ command: "git rebase -i HEAD~3" }, context);
      expect(result.isError).toBe(true);
      expect(result.output).toContain("interactive");
    });

    it("should reject git add -i", async () => {
      const result = await bashExecTool.execute({ command: "git add -i" }, context);
      expect(result.isError).toBe(true);
      expect(result.output).toContain("interactive");
    });

    it("should reject vim", async () => {
      const result = await bashExecTool.execute({ command: "vim somefile.txt" }, context);
      expect(result.isError).toBe(true);
      expect(result.output).toContain("interactive");
    });

    it("should reject nano", async () => {
      const result = await bashExecTool.execute({ command: "nano somefile.txt" }, context);
      expect(result.isError).toBe(true);
      expect(result.output).toContain("interactive");
    });

    it("should reject top", async () => {
      const result = await bashExecTool.execute({ command: "top" }, context);
      expect(result.isError).toBe(true);
      expect(result.output).toContain("interactive");
    });

    it("should allow non-interactive git commands", async () => {
      const result = await bashExecTool.execute({ command: "git status" }, context);
      expect(result.output).not.toContain("interactive");
    });
  });

  describe("run_in_background", () => {
    it("should start a background process and return immediately", async () => {
      const result = await bashExecTool.execute(
        { command: "sleep 0.1 && echo bg-done", run_in_background: true },
        context,
      );
      expect(result.isError).toBe(false);
      expect(result.output).toContain("Background process started");
      expect(result.metadata?.status).toBe("background");
      expect(result.metadata?.pid).toBeTypeOf("number");
      expect(result.metadata?.output_file).toBeTypeOf("string");
      outputFilesToClean.push(result.metadata!.output_file as string);
    });

    it("should include description in background output", async () => {
      const result = await bashExecTool.execute(
        {
          command: "echo bg-test",
          description: "Test background",
          run_in_background: true,
        },
        context,
      );
      expect(result.isError).toBe(false);
      expect(result.output).toContain("(Test background)");
      outputFilesToClean.push(result.metadata!.output_file as string);
    });

    it("should write output to file", async () => {
      const result = await bashExecTool.execute(
        { command: "echo file-output-test", run_in_background: true },
        context,
      );
      const outputFile = result.metadata!.output_file as string;
      outputFilesToClean.push(outputFile);

      // Wait for the process to complete
      await new Promise<void>((resolve) => {
        const pid = result.metadata!.pid as number;
        backgroundProcessManager.onComplete(pid, () => resolve());
      });

      const content = readFileSync(outputFile, "utf-8");
      expect(content).toContain("file-output-test");
    });

    it("should still reject interactive commands even in background mode", async () => {
      const result = await bashExecTool.execute(
        { command: "vim test.txt", run_in_background: true },
        context,
      );
      expect(result.isError).toBe(true);
      expect(result.output).toContain("interactive");
    });
  });
});

describe("BackgroundProcessManager", () => {
  it("should track process status", async () => {
    const { pid, outputFile } = backgroundProcessManager.start("echo status-test", process.cwd());
    outputFilesToClean.push(outputFile);

    expect(pid).toBeTypeOf("number");

    // Wait for completion
    await new Promise<void>((resolve) => {
      backgroundProcessManager.onComplete(pid, () => resolve());
    });

    const status = backgroundProcessManager.getStatus(pid);
    expect(status).toBeDefined();
    expect(status!.running).toBe(false);
    expect(status!.exitCode).toBe(0);
  });

  it("should return undefined for unknown PID", () => {
    const status = backgroundProcessManager.getStatus(999999);
    expect(status).toBeUndefined();
  });

  it("should get output from completed process", async () => {
    const { pid, outputFile } = backgroundProcessManager.start(
      "echo manager-output-test",
      process.cwd(),
    );
    outputFilesToClean.push(outputFile);

    await new Promise<void>((resolve) => {
      backgroundProcessManager.onComplete(pid, () => resolve());
    });

    const output = backgroundProcessManager.getOutput(pid);
    expect(output).toContain("manager-output-test");
  });

  it("should invoke onComplete callback immediately if already done", async () => {
    const { pid, outputFile } = backgroundProcessManager.start("echo done-test", process.cwd());
    outputFilesToClean.push(outputFile);

    // Wait for actual completion first
    await new Promise<void>((resolve) => {
      backgroundProcessManager.onComplete(pid, () => resolve());
    });

    // Now register another callback — should fire immediately
    const exitCode = await new Promise<number>((resolve) => {
      backgroundProcessManager.onComplete(pid, (code) => resolve(code));
    });
    expect(exitCode).toBe(0);
  });

  it("should return empty string for unknown PID output", () => {
    const output = backgroundProcessManager.getOutput(999999);
    expect(output).toBe("");
  });
});
