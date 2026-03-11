/**
 * Stdio Transport — spawns a child process and communicates via stdin/stdout JSON-RPC lines.
 * Extracted from the original MCPClient implementation.
 */
import { spawn, type ChildProcess } from "node:child_process";
import { createInterface, type Interface as ReadlineInterface } from "node:readline";
import { BaseError } from "../../utils/error.js";
import { type MCPServerConfig, type JsonRpcMessage } from "../types.js";
import { type MCPTransportLayer } from "./base.js";

export class StdioTransportError extends BaseError {
  constructor(message: string, context: Record<string, unknown> = {}) {
    super(message, "STDIO_TRANSPORT_ERROR", context);
  }
}

export class StdioTransport implements MCPTransportLayer {
  private process: ChildProcess | null = null;
  private readline: ReadlineInterface | null = null;
  private messageHandler: ((message: JsonRpcMessage) => void) | null = null;
  private errorHandler: ((error: Error) => void) | null = null;
  private closeHandler: (() => void) | null = null;

  constructor(private readonly config: MCPServerConfig) {}

  async connect(): Promise<void> {
    if (!this.config.command) {
      throw new StdioTransportError("stdio transport requires a command", {
        server: this.config.name,
      });
    }

    const env = this.config.env ? this.resolveEnvVars(this.config.env) : undefined;

    this.process = spawn(this.config.command, [...(this.config.args ?? [])], {
      stdio: ["pipe", "pipe", "pipe"],
      env: { ...process.env, ...env },
    });

    if (!this.process.stdout || !this.process.stdin) {
      throw new StdioTransportError("Failed to attach to child process stdio");
    }

    this.readline = createInterface({ input: this.process.stdout });
    this.readline.on("line", (line) => this.handleLine(line));

    this.process.on("exit", (code) => {
      this.errorHandler?.(new StdioTransportError(`Server exited with code ${code}`));
      this.closeHandler?.();
    });

    this.process.on("error", (error) => {
      this.errorHandler?.(new StdioTransportError(`Server process error: ${error.message}`));
    });
  }

  async disconnect(): Promise<void> {
    this.readline?.close();
    this.readline = null;

    if (this.process) {
      this.process.kill();
      this.process = null;
    }
  }

  sendRequest(id: string | number, method: string, params: Record<string, unknown>): void {
    const request = {
      jsonrpc: "2.0" as const,
      id,
      method,
      params,
    };
    this.writeLine(JSON.stringify(request));
  }

  sendNotification(method: string, params: Record<string, unknown>): void {
    const notification = {
      jsonrpc: "2.0" as const,
      method,
      params,
    };
    this.writeLine(JSON.stringify(notification));
  }

  onMessage(handler: (message: JsonRpcMessage) => void): void {
    this.messageHandler = handler;
  }

  onError(handler: (error: Error) => void): void {
    this.errorHandler = handler;
  }

  onClose(handler: () => void): void {
    this.closeHandler = handler;
  }

  private writeLine(line: string): void {
    if (!this.process?.stdin?.writable) {
      throw new StdioTransportError("Server stdin not writable");
    }
    this.process.stdin.write(line + "\n");
  }

  private handleLine(line: string): void {
    const trimmed = line.trim();
    if (!trimmed) return;

    try {
      const message = JSON.parse(trimmed) as JsonRpcMessage;
      this.messageHandler?.(message);
    } catch {
      // Ignore unparseable lines (server may emit non-JSON debug output)
    }
  }

  /** Resolve ${VAR} and ${VAR:-default} patterns in environment variables */
  private resolveEnvVars(env: Readonly<Record<string, string>>): Record<string, string> {
    const resolved: Record<string, string> = {};

    for (const [key, value] of Object.entries(env)) {
      resolved[key] = value.replace(
        /\$\{(\w+)(?::-([^}]*))?\}/g,
        (_, varName: string, defaultVal?: string) => {
          return process.env[varName] ?? defaultVal ?? "";
        },
      );
    }

    return resolved;
  }
}
