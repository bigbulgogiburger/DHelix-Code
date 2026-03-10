import {
  type ToolDefinition,
  type ToolContext,
  type ToolResult,
  type ExtractedToolCall,
  type ToolCallResult,
} from "./types.js";
import { type ToolRegistry } from "./registry.js";
import { parseToolArguments } from "./validation.js";
import { getPlatform, getShellCommand, getShellArgs } from "../utils/platform.js";
import { TOOL_TIMEOUTS } from "../constants.js";
import { spawn, type ChildProcess } from "node:child_process";
import { createWriteStream } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { randomUUID } from "node:crypto";

/**
 * Execute a single tool call with timeout, validation, and error handling.
 */
export async function executeTool(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  tool: ToolDefinition<any>,
  args: Record<string, unknown>,
  options?: { workingDirectory?: string; signal?: AbortSignal },
): Promise<ToolResult> {
  const timeoutMs = tool.timeoutMs ?? TOOL_TIMEOUTS.default;
  const controller = new AbortController();
  const workingDirectory = options?.workingDirectory ?? process.cwd();

  // Link parent abort signal
  if (options?.signal) {
    if (options.signal.aborted) {
      return { output: "Aborted", isError: true };
    }
    options.signal.addEventListener("abort", () => controller.abort(), { once: true });
  }

  // Timeout
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  const context: ToolContext = {
    workingDirectory,
    abortSignal: controller.signal,
    timeoutMs,
    platform: getPlatform(),
  };

  try {
    const validatedArgs = parseToolArguments(tool.parameterSchema, args);
    const result = await tool.execute(validatedArgs, context);
    return result;
  } catch (error) {
    if (controller.signal.aborted) {
      return { output: `Tool "${tool.name}" timed out after ${timeoutMs}ms`, isError: true };
    }
    const message = error instanceof Error ? error.message : String(error);
    return { output: `Tool "${tool.name}" failed: ${message}`, isError: true };
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Execute a tool call by looking it up in the registry.
 */
export async function executeToolCall(
  registry: ToolRegistry,
  call: ExtractedToolCall,
  options?: { workingDirectory?: string; signal?: AbortSignal },
): Promise<ToolCallResult> {
  const tool = registry.get(call.name);
  if (!tool) {
    return {
      id: call.id,
      name: call.name,
      output: `Unknown tool: ${call.name}`,
      isError: true,
    };
  }

  const result = await executeTool(tool, call.arguments, options);
  return {
    id: call.id,
    name: call.name,
    output: result.output,
    isError: result.isError,
    metadata: result.metadata,
  };
}

/** Status of a background process */
export interface BackgroundProcessStatus {
  readonly pid: number;
  readonly command: string;
  readonly running: boolean;
  readonly exitCode: number | null;
  readonly outputFile: string;
}

interface BackgroundProcess {
  readonly pid: number;
  readonly command: string;
  readonly outputFile: string;
  readonly proc: ChildProcess;
  running: boolean;
  exitCode: number | null;
  completionCallbacks: Array<(exitCode: number) => void>;
}

/**
 * Manages background shell processes with detached execution.
 * Processes run independently and their output is written to temp files.
 */
export class BackgroundProcessManager {
  private readonly processes = new Map<number, BackgroundProcess>();

  start(command: string, cwd: string): { pid: number; outputFile: string } {
    const id = randomUUID().slice(0, 8);
    const outputFile = join(tmpdir(), `dbcode-bg-${id}.log`);
    const shell = getShellCommand();
    const args = getShellArgs(command);

    const outStream = createWriteStream(outputFile, { flags: "a" });

    const proc = spawn(shell, [...args], {
      cwd,
      detached: true,
      stdio: ["ignore", "pipe", "pipe"],
    });

    const pid = proc.pid!;

    proc.stdout?.pipe(outStream);
    proc.stderr?.pipe(outStream);

    const entry: BackgroundProcess = {
      pid,
      command,
      outputFile,
      proc,
      running: true,
      exitCode: null,
      completionCallbacks: [],
    };

    proc.on("close", (code) => {
      entry.running = false;
      entry.exitCode = code ?? 1;
      outStream.end();
      for (const cb of entry.completionCallbacks) {
        cb(entry.exitCode);
      }
    });

    proc.on("error", () => {
      entry.running = false;
      entry.exitCode = 1;
      outStream.end();
    });

    proc.unref();

    this.processes.set(pid, entry);
    return { pid, outputFile };
  }

  getStatus(pid: number): BackgroundProcessStatus | undefined {
    const entry = this.processes.get(pid);
    if (!entry) return undefined;
    return {
      pid: entry.pid,
      command: entry.command,
      running: entry.running,
      exitCode: entry.exitCode,
      outputFile: entry.outputFile,
    };
  }

  getOutput(pid: number): string {
    const entry = this.processes.get(pid);
    if (!entry) return "";
    try {
      const { readFileSync } = require("node:fs") as typeof import("node:fs");
      return readFileSync(entry.outputFile, "utf-8");
    } catch {
      return "";
    }
  }

  kill(pid: number): void {
    const entry = this.processes.get(pid);
    if (!entry || !entry.running) return;
    try {
      process.kill(-entry.pid, "SIGTERM");
    } catch {
      try {
        entry.proc.kill("SIGTERM");
      } catch {
        // Process already exited
      }
    }
  }

  onComplete(pid: number, callback: (exitCode: number) => void): void {
    const entry = this.processes.get(pid);
    if (!entry) return;
    if (!entry.running) {
      callback(entry.exitCode ?? 1);
      return;
    }
    entry.completionCallbacks.push(callback);
  }
}

/** Singleton background process manager */
export const backgroundProcessManager = new BackgroundProcessManager();
