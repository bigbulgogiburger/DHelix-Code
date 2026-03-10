import { z } from "zod";
import { type ToolDefinition, type ToolResult } from "../types.js";
import { backgroundProcessManager } from "../executor.js";

const paramSchema = z.object({
  processId: z
    .string()
    .describe(
      'The process ID returned by bash_exec when run in background mode (e.g., "bg-1")',
    ),
});

type Params = z.infer<typeof paramSchema>;

async function execute(params: Params): Promise<ToolResult> {
  const status = backgroundProcessManager.getStatus(params.processId);
  if (!status) {
    return {
      output: `No background process found with ID "${params.processId}". Use bash_exec with run_in_background to start a background process.`,
      isError: true,
      metadata: { processId: params.processId },
    };
  }

  const { output, running, exitCode } = backgroundProcessManager.getIncrementalOutput(
    params.processId,
  );

  const statusLine = running
    ? "Status: running"
    : `Status: exited (code ${exitCode ?? "unknown"})`;

  const outputSection = output.length > 0 ? `\n\nOutput:\n${output}` : "\n\n(no new output)";

  return {
    output: `Process ${status.processId} (PID ${status.pid})\nCommand: ${status.command}\n${statusLine}${outputSection}`,
    isError: false,
    metadata: {
      processId: status.processId,
      pid: status.pid,
      running,
      exitCode,
      hasNewOutput: output.length > 0,
    },
  };
}

export const bashOutputTool: ToolDefinition<Params> = {
  name: "bash_output",
  description:
    "Read the latest output from a background shell process. Use this to check on long-running commands started with bash_exec in background mode. Returns only new output since the last read.",
  parameterSchema: paramSchema,
  permissionLevel: "safe",
  execute,
};
