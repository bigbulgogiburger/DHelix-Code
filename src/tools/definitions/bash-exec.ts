import { z } from "zod";
import { type ToolDefinition, type ToolContext, type ToolResult } from "../types.js";
import { getShellCommand, getShellArgs } from "../../utils/platform.js";
import { TOOL_TIMEOUTS } from "../../constants.js";
import { backgroundProcessManager } from "../executor.js";
import { spawn } from "node:child_process";

const INTERACTIVE_COMMANDS = [
  "git rebase -i",
  "git add -i",
  "git add -p",
  "git add --interactive",
  "git add --patch",
  "git commit --amend",
  "vim",
  "nvim",
  "nano",
  "emacs",
  "vi ",
  "less ",
  "more ",
  "top",
  "htop",
  "ssh ",
  "python -i",
  "python3 -i",
  "node --inspect",
  "irb",
  "pry",
];

function isInteractiveCommand(command: string): boolean {
  const trimmed = command.trim();
  return INTERACTIVE_COMMANDS.some(
    (interactive) => trimmed === interactive.trim() || trimmed.startsWith(interactive),
  );
}

const paramSchema = z.object({
  command: z.string().describe("Shell command to execute"),
  description: z
    .string()
    .optional()
    .describe("Brief description of what this command does"),
  run_in_background: z
    .boolean()
    .optional()
    .describe("Run command in background, returns immediately with PID"),
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
  // Detect interactive commands
  if (isInteractiveCommand(params.command)) {
    return {
      output: `Warning: "${params.command}" appears to be an interactive command that requires terminal input. Interactive commands are not supported. Please use non-interactive alternatives (e.g., "git rebase --onto" instead of "git rebase -i", "git commit -m" instead of "git commit --amend" without a message).`,
      isError: true,
      metadata: { command: params.command, description: params.description },
    };
  }

  // Background execution
  if (params.run_in_background) {
    try {
      const { pid, outputFile } = backgroundProcessManager.start(
        params.command,
        context.workingDirectory,
      );
      const desc = params.description ? ` (${params.description})` : "";
      return {
        output: `Background process started${desc}.\nPID: ${pid}\nOutput file: ${outputFile}\nUse "cat ${outputFile}" to check output later.`,
        isError: false,
        metadata: {
          pid,
          status: "background",
          output_file: outputFile,
          command: params.command,
          description: params.description,
        },
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        output: `Failed to start background process: ${message}`,
        isError: true,
        metadata: { command: params.command, description: params.description },
      };
    }
  }

  // Normal foreground execution
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
        metadata: {
          exitCode: code,
          command: params.command,
          description: params.description,
        },
      });
    });

    proc.on("error", (error) => {
      clearTimeout(timer);
      resolve({
        output: `Command failed: ${error.message}`,
        isError: true,
        metadata: { command: params.command, description: params.description },
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
