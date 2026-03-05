import { z } from "zod";
import { spawn } from "node:child_process";
import { type ToolDefinition, type ToolContext, type ToolResult } from "../types.js";
import { getShellCommand, getShellArgs } from "../../utils/platform.js";
import { TOOL_TIMEOUTS } from "../../constants.js";

const paramSchema = z.object({
  command: z.string().describe("Shell command to execute"),
  timeout: z
    .number()
    .int()
    .min(1000)
    .max(600_000)
    .optional()
    .describe("Timeout in milliseconds (default: 120000)"),
});

type Params = z.infer<typeof paramSchema>;

async function execute(params: Params, context: ToolContext): Promise<ToolResult> {
  const timeoutMs = params.timeout ?? TOOL_TIMEOUTS.bash;
  const shell = getShellCommand();
  const args = getShellArgs(params.command);

  return new Promise<ToolResult>((resolve) => {
    const chunks: Buffer[] = [];
    const errChunks: Buffer[] = [];

    const proc = spawn(shell, [...args], {
      cwd: context.workingDirectory,
      signal: context.abortSignal,
      stdio: ["ignore", "pipe", "pipe"],
    });

    proc.stdout.on("data", (chunk: Buffer) => chunks.push(chunk));
    proc.stderr.on("data", (chunk: Buffer) => errChunks.push(chunk));

    const timer = setTimeout(() => {
      proc.kill("SIGTERM");
    }, timeoutMs);

    proc.on("close", (code) => {
      clearTimeout(timer);
      const stdout = Buffer.concat(chunks).toString("utf-8");
      const stderr = Buffer.concat(errChunks).toString("utf-8");
      const output = [stdout, stderr].filter(Boolean).join("\n");

      resolve({
        output: output || "(no output)",
        isError: code !== 0,
        metadata: { exitCode: code, command: params.command },
      });
    });

    proc.on("error", (error) => {
      clearTimeout(timer);
      resolve({
        output: `Command failed: ${error.message}`,
        isError: true,
      });
    });
  });
}

export const bashExecTool: ToolDefinition<Params> = {
  name: "bash_exec",
  description:
    "Execute a shell command and return stdout/stderr. Use for running builds, tests, git commands, etc. Commands time out after 120 seconds by default.",
  parameterSchema: paramSchema,
  permissionLevel: "confirm",
  timeoutMs: TOOL_TIMEOUTS.bash,
  execute,
};
