import { z } from "zod";
import { type ToolDefinition, type ToolResult } from "../types.js";
import { backgroundProcessManager } from "../executor.js";

const signalSchema = z.enum(["SIGTERM", "SIGKILL", "SIGINT"]);

const paramSchema = z.object({
  processId: z
    .string()
    .describe(
      'The process ID to terminate (e.g., "bg-1")',
    ),
  signal: signalSchema
    .optional()
    .default("SIGTERM")
    .describe("Signal to send to the process (default: SIGTERM)"),
});

type Params = z.infer<typeof paramSchema>;

async function execute(params: Params): Promise<ToolResult> {
  const status = backgroundProcessManager.getStatus(params.processId);
  if (!status) {
    return {
      output: `No background process found with ID "${params.processId}".`,
      isError: true,
      metadata: { processId: params.processId },
    };
  }

  if (!status.running) {
    return {
      output: `Process ${status.processId} (PID ${status.pid}) has already exited with code ${status.exitCode ?? "unknown"}.`,
      isError: false,
      metadata: {
        processId: status.processId,
        pid: status.pid,
        running: false,
        exitCode: status.exitCode,
      },
    };
  }

  const signal = params.signal ?? "SIGTERM";
  const killed = backgroundProcessManager.kill(params.processId, signal as NodeJS.Signals);

  if (killed) {
    return {
      output: `Sent ${signal} to process ${status.processId} (PID ${status.pid}).`,
      isError: false,
      metadata: {
        processId: status.processId,
        pid: status.pid,
        signal,
      },
    };
  }

  return {
    output: `Failed to send ${signal} to process ${status.processId} (PID ${status.pid}). The process may have already exited.`,
    isError: true,
    metadata: {
      processId: status.processId,
      pid: status.pid,
      signal,
    },
  };
}

export const killShellTool: ToolDefinition<Params> = {
  name: "kill_shell",
  description:
    "Terminate a running background shell process. Sends a signal (SIGTERM by default) to stop the process.",
  parameterSchema: paramSchema,
  permissionLevel: "confirm",
  execute,
};
