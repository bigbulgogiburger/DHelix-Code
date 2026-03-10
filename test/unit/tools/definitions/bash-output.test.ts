import { describe, it, expect, afterAll } from "vitest";
import { bashOutputTool } from "../../../../src/tools/definitions/bash-output.js";
import { backgroundProcessManager } from "../../../../src/tools/executor.js";
import { existsSync, unlinkSync } from "node:fs";

const context = {
  workingDirectory: process.cwd(),
  abortSignal: new AbortController().signal,
  timeoutMs: 30_000,
  platform: "darwin" as const,
};

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

describe("bash_output tool", () => {
  it("should have correct metadata", () => {
    expect(bashOutputTool.name).toBe("bash_output");
    expect(bashOutputTool.permissionLevel).toBe("safe");
  });

  it("should return error for unknown process ID", async () => {
    const result = await bashOutputTool.execute({ processId: "bg-999" }, context);
    expect(result.isError).toBe(true);
    expect(result.output).toContain("No background process found");
    expect(result.output).toContain("bg-999");
  });

  it("should read output from a completed background process", async () => {
    const { processId, outputFile } = backgroundProcessManager.start(
      "echo bash-output-test",
      process.cwd(),
    );
    outputFilesToClean.push(outputFile);

    // Wait for completion
    await new Promise<void>((resolve) => {
      backgroundProcessManager.onComplete(processId, () => resolve());
    });

    const result = await bashOutputTool.execute({ processId }, context);
    expect(result.isError).toBe(false);
    expect(result.output).toContain("bash-output-test");
    expect(result.output).toContain("exited");
    expect(result.metadata?.running).toBe(false);
  });

  it("should return incremental output (only new data since last read)", async () => {
    const { processId, outputFile } = backgroundProcessManager.start(
      "echo line1 && sleep 0.1 && echo line2",
      process.cwd(),
    );
    outputFilesToClean.push(outputFile);

    // Wait for completion
    await new Promise<void>((resolve) => {
      backgroundProcessManager.onComplete(processId, () => resolve());
    });

    // First read — should get all output
    const result1 = await bashOutputTool.execute({ processId }, context);
    expect(result1.isError).toBe(false);
    expect(result1.output).toContain("line1");
    expect(result1.output).toContain("line2");

    // Second read — no new output
    const result2 = await bashOutputTool.execute({ processId }, context);
    expect(result2.isError).toBe(false);
    expect(result2.output).toContain("no new output");
  });

  it("should show process status information", async () => {
    const { processId, outputFile } = backgroundProcessManager.start(
      "echo status-info-test",
      process.cwd(),
    );
    outputFilesToClean.push(outputFile);

    await new Promise<void>((resolve) => {
      backgroundProcessManager.onComplete(processId, () => resolve());
    });

    const result = await bashOutputTool.execute({ processId }, context);
    expect(result.isError).toBe(false);
    expect(result.output).toContain(`Process ${processId}`);
    expect(result.output).toContain("Command: echo status-info-test");
    expect(result.output).toContain("Status:");
  });

  it("should also accept numeric PID as string", async () => {
    const { pid, outputFile } = backgroundProcessManager.start(
      "echo pid-test",
      process.cwd(),
    );
    outputFilesToClean.push(outputFile);

    await new Promise<void>((resolve) => {
      backgroundProcessManager.onComplete(pid, () => resolve());
    });

    const result = await bashOutputTool.execute({ processId: String(pid) }, context);
    expect(result.isError).toBe(false);
    expect(result.output).toContain("pid-test");
  });
});
