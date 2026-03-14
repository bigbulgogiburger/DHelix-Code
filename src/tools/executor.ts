import {
  type ToolDefinition,
  type ToolContext,
  type ToolResult,
  type ExtractedToolCall,
  type ToolCallResult,
} from "./types.js";
import { type ToolRegistry } from "./registry.js";
import { type AppEventEmitter } from "../utils/events.js";
import { parseToolArguments } from "./validation.js";
import { correctToolCall } from "./tool-call-corrector.js";
import { type CapabilityTier } from "../llm/model-capabilities.js";
import { getPlatform, getShellCommand, getShellArgs } from "../utils/platform.js";
import { TOOL_TIMEOUTS } from "../constants.js";
import { spawn, type ChildProcess } from "node:child_process";
import { createWriteStream, readFileSync, statSync, openSync, readSync, closeSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { randomUUID } from "node:crypto";

const MAX_TOOL_RETRIES = 1;

function isTransientError(error: unknown): boolean {
  const msg = error instanceof Error ? error.message : String(error);
  return /ECONNRESET|ETIMEDOUT|ENOTFOUND|EPIPE|EAI_AGAIN/.test(msg);
}

/**
 * Execute a single tool call with timeout, validation, and error handling.
 */
export async function executeTool(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  tool: ToolDefinition<any>,
  args: Record<string, unknown>,
  options?: {
    workingDirectory?: string;
    signal?: AbortSignal;
    events?: AppEventEmitter;
    toolCallId?: string;
    capabilityTier?: CapabilityTier;
  },
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
    events: options?.events,
    toolCallId: options?.toolCallId,
  };

  try {
    // Correct common tool call errors from lower-capability models (before validation)
    const correctedArgs = correctToolCall(args, workingDirectory, options?.capabilityTier ?? "high");
    const validatedArgs = parseToolArguments(tool.parameterSchema, correctedArgs);

    // Retry loop for transient errors
    let lastError: unknown;
    for (let attempt = 0; attempt <= MAX_TOOL_RETRIES; attempt++) {
      try {
        return await tool.execute(validatedArgs, context);
      } catch (execError) {
        lastError = execError;
        if (attempt < MAX_TOOL_RETRIES && isTransientError(execError)) {
          await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
          continue;
        }
        throw execError;
      }
    }
    throw lastError;
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
  options?: {
    workingDirectory?: string;
    signal?: AbortSignal;
    events?: AppEventEmitter;
    capabilityTier?: CapabilityTier;
  },
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

  const result = await executeTool(tool, call.arguments, {
    workingDirectory: options?.workingDirectory,
    signal: options?.signal,
    events: options?.events,
    toolCallId: call.id,
    capabilityTier: options?.capabilityTier,
  });
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
  readonly processId: string;
  readonly command: string;
  readonly running: boolean;
  readonly exitCode: number | null;
  readonly outputFile: string;
}

/** Info for listing background processes */
export interface BackgroundProcessInfo {
  readonly processId: string;
  readonly pid: number;
  readonly command: string;
  readonly running: boolean;
  readonly exitCode: number | null;
}

interface BackgroundProcess {
  readonly pid: number;
  readonly processId: string;
  readonly command: string;
  readonly outputFile: string;
  readonly proc: ChildProcess;
  running: boolean;
  exitCode: number | null;
  completionCallbacks: Array<(exitCode: number) => void>;
  /** Byte offset for incremental output reads */
  lastReadOffset: number;
}

/**
 * Manages background shell processes with detached execution.
 * Processes run independently and their output is written to temp files.
 * Each process is assigned a human-readable ID (e.g., "bg-1", "bg-2").
 */
export class BackgroundProcessManager {
  private readonly processes = new Map<number, BackgroundProcess>();
  private readonly processIdMap = new Map<string, BackgroundProcess>();
  private nextId = 1;

  start(command: string, cwd: string): { pid: number; processId: string; outputFile: string } {
    const fileId = randomUUID().slice(0, 8);
    const processId = `bg-${this.nextId++}`;
    const outputFile = join(tmpdir(), `dbcode-bg-${fileId}.log`);
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
      processId,
      command,
      outputFile,
      proc,
      running: true,
      exitCode: null,
      completionCallbacks: [],
      lastReadOffset: 0,
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
    this.processIdMap.set(processId, entry);
    return { pid, processId, outputFile };
  }

  /** Resolve a process by either human-readable ID ("bg-1") or numeric PID */
  private resolve(idOrPid: string | number): BackgroundProcess | undefined {
    if (typeof idOrPid === "string") {
      return this.processIdMap.get(idOrPid) ?? this.findByPidString(idOrPid);
    }
    return this.processes.get(idOrPid);
  }

  /** Try to parse a string as a numeric PID and look it up */
  private findByPidString(str: string): BackgroundProcess | undefined {
    const num = parseInt(str, 10);
    if (!isNaN(num)) {
      return this.processes.get(num);
    }
    return undefined;
  }

  getStatus(idOrPid: string | number): BackgroundProcessStatus | undefined {
    const entry = this.resolve(idOrPid);
    if (!entry) return undefined;
    return {
      pid: entry.pid,
      processId: entry.processId,
      command: entry.command,
      running: entry.running,
      exitCode: entry.exitCode,
      outputFile: entry.outputFile,
    };
  }

  /** Read all output from a background process (full contents) */
  getOutput(idOrPid: string | number): string {
    const entry = this.resolve(idOrPid);
    if (!entry) return "";
    try {
      return readFileSync(entry.outputFile, "utf-8");
    } catch {
      return "";
    }
  }

  /** Read only new output since the last incremental read */
  getIncrementalOutput(idOrPid: string | number): {
    output: string;
    running: boolean;
    exitCode: number | null;
  } {
    const entry = this.resolve(idOrPid);
    if (!entry) {
      return { output: "", running: false, exitCode: null };
    }
    try {
      const stats = statSync(entry.outputFile);
      const totalBytes = stats.size;
      if (totalBytes <= entry.lastReadOffset) {
        return { output: "", running: entry.running, exitCode: entry.exitCode };
      }
      const fd = openSync(entry.outputFile, "r");
      const buffer = Buffer.alloc(totalBytes - entry.lastReadOffset);
      readSync(fd, buffer, 0, buffer.length, entry.lastReadOffset);
      closeSync(fd);
      entry.lastReadOffset = totalBytes;
      return { output: buffer.toString("utf-8"), running: entry.running, exitCode: entry.exitCode };
    } catch {
      return { output: "", running: entry.running, exitCode: entry.exitCode };
    }
  }

  /** Kill a background process with a specific signal */
  kill(idOrPid: string | number, signal: NodeJS.Signals = "SIGTERM"): boolean {
    const entry = this.resolve(idOrPid);
    if (!entry) return false;
    if (!entry.running) return false;
    try {
      process.kill(-entry.pid, signal);
      return true;
    } catch {
      try {
        entry.proc.kill(signal);
        return true;
      } catch {
        // Process already exited
        return false;
      }
    }
  }

  onComplete(idOrPid: string | number, callback: (exitCode: number) => void): void {
    const entry = this.resolve(idOrPid);
    if (!entry) return;
    if (!entry.running) {
      callback(entry.exitCode ?? 1);
      return;
    }
    entry.completionCallbacks.push(callback);
  }

  /** List all tracked background processes */
  list(): readonly BackgroundProcessInfo[] {
    return [...this.processIdMap.values()].map((entry) => ({
      processId: entry.processId,
      pid: entry.pid,
      command: entry.command,
      running: entry.running,
      exitCode: entry.exitCode,
    }));
  }

  /** Terminate all running background processes */
  cleanup(): void {
    for (const entry of this.processes.values()) {
      if (entry.running) {
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
    }
  }
}

/** Singleton background process manager */
export const backgroundProcessManager = new BackgroundProcessManager();
