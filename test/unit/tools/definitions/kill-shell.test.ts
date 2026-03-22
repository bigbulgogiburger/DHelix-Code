import { describe, it, expect, afterAll } from "vitest";
import { killShellTool } from "../../../../src/tools/definitions/kill-shell.js";
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

describe("kill_shell tool", () => {
  it("should have correct metadata", () => {
    expect(killShellTool.name).toBe("kill_shell");
    expect(killShellTool.permissionLevel).toBe("confirm");
  });

  it("should return error for unknown process ID", async () => {
    const result = await killShellTool.execute({ processId: "bg-999" }, context);
    expect(result.isError).toBe(true);
    expect(result.output).toContain("No background process found");
  });

  it.skipIf(process.platform === "win32")(
    "should terminate a running background process",
    async () => {
      const { processId, outputFile } = backgroundProcessManager.start("sleep 30", process.cwd());
      outputFilesToClean.push(outputFile);

      // Small delay to let the process start
      await new Promise((resolve) => setTimeout(resolve, 50));

      const result = await killShellTool.execute({ processId }, context);
      expect(result.isError).toBe(false);
      expect(result.output).toContain("Sent SIGTERM");
      expect(result.output).toContain(processId);
      expect(result.metadata?.signal).toBe("SIGTERM");

      // Wait for the process to actually terminate
      await new Promise<void>((resolve) => {
        backgroundProcessManager.onComplete(processId, () => resolve());
      });
    },
  );

  it("should report already-exited process without error", async () => {
    const { processId, outputFile } = backgroundProcessManager.start(
      "echo done-already",
      process.cwd(),
    );
    outputFilesToClean.push(outputFile);

    // Wait for completion
    await new Promise<void>((resolve) => {
      backgroundProcessManager.onComplete(processId, () => resolve());
    });

    const result = await killShellTool.execute({ processId }, context);
    expect(result.isError).toBe(false);
    expect(result.output).toContain("already exited");
    expect(result.metadata?.running).toBe(false);
  });

  it.skipIf(process.platform === "win32")("should support sending SIGKILL signal", async () => {
    const { processId, outputFile } = backgroundProcessManager.start("sleep 30", process.cwd());
    outputFilesToClean.push(outputFile);

    await new Promise((resolve) => setTimeout(resolve, 50));

    const result = await killShellTool.execute({ processId, signal: "SIGKILL" }, context);
    expect(result.isError).toBe(false);
    expect(result.output).toContain("SIGKILL");

    // Wait for the process to terminate
    await new Promise<void>((resolve) => {
      backgroundProcessManager.onComplete(processId, () => resolve());
    });
  });

  it.skipIf(process.platform === "win32")("should support sending SIGINT signal", async () => {
    const { processId, outputFile } = backgroundProcessManager.start("sleep 30", process.cwd());
    outputFilesToClean.push(outputFile);

    await new Promise((resolve) => setTimeout(resolve, 50));

    const result = await killShellTool.execute({ processId, signal: "SIGINT" }, context);
    expect(result.isError).toBe(false);
    expect(result.output).toContain("SIGINT");

    await new Promise<void>((resolve) => {
      backgroundProcessManager.onComplete(processId, () => resolve());
    });
  });

  it.skipIf(process.platform === "win32")("should also accept numeric PID as string", async () => {
    const { pid, processId, outputFile } = backgroundProcessManager.start(
      "sleep 30",
      process.cwd(),
    );
    outputFilesToClean.push(outputFile);

    await new Promise((resolve) => setTimeout(resolve, 50));

    const result = await killShellTool.execute({ processId: String(pid) }, context);
    expect(result.isError).toBe(false);
    expect(result.output).toContain("Sent SIGTERM");

    await new Promise<void>((resolve) => {
      backgroundProcessManager.onComplete(processId, () => resolve());
    });
  });
});
