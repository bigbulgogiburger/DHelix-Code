import { spawn, type ChildProcess } from "node:child_process";
import { randomUUID } from "node:crypto";
import { createInterface, type Interface as ReadlineInterface } from "node:readline";
import { BaseError } from "../utils/error.js";
import {
  type MCPServerConfig,
  type MCPServerCapabilities,
  type MCPToolDefinition,
  type MCPResource,
  type MCPToolCallResult,
  type MCPConnectionState,
  type JsonRpcRequest,
  type JsonRpcResponse,
  type JsonRpcError,
  type JsonRpcNotification,
} from "./types.js";

/** MCP client error */
export class MCPClientError extends BaseError {
  constructor(message: string, context: Record<string, unknown> = {}) {
    super(message, "MCP_CLIENT_ERROR", context);
  }
}

/** Default timeout for MCP requests (30 seconds) */
const DEFAULT_REQUEST_TIMEOUT_MS = 30_000;

/** Pending request tracker */
interface PendingRequest {
  readonly resolve: (result: unknown) => void;
  readonly reject: (error: Error) => void;
  readonly timer: ReturnType<typeof setTimeout>;
}

/**
 * MCP client — communicates with an MCP server via stdio transport.
 * Handles the JSON-RPC 2.0 protocol, connection lifecycle, and tool discovery.
 */
export class MCPClient {
  private process: ChildProcess | null = null;
  private readline: ReadlineInterface | null = null;
  private readonly pendingRequests = new Map<string | number, PendingRequest>();
  private state: MCPConnectionState = "disconnected";
  private capabilities: MCPServerCapabilities | null = null;
  private onToolsChanged: (() => void) | null = null;

  constructor(private readonly config: MCPServerConfig) {}

  /** Get current connection state */
  getState(): MCPConnectionState {
    return this.state;
  }

  /** Get server capabilities (available after connect) */
  getCapabilities(): MCPServerCapabilities | null {
    return this.capabilities;
  }

  /** Set callback for tools/list_changed notification */
  setToolsChangedCallback(callback: () => void): void {
    this.onToolsChanged = callback;
  }

  /**
   * Connect to the MCP server.
   * For stdio transport: spawns the child process and performs the initialize handshake.
   */
  async connect(): Promise<void> {
    if (this.state === "connected") return;

    if (this.config.transport !== "stdio") {
      throw new MCPClientError(`Transport "${this.config.transport}" not yet supported`, {
        server: this.config.name,
      });
    }

    if (!this.config.command) {
      throw new MCPClientError("stdio transport requires a command", {
        server: this.config.name,
      });
    }

    this.state = "connecting";

    try {
      // Resolve environment variables in config env
      const env = this.config.env ? this.resolveEnvVars(this.config.env) : undefined;

      this.process = spawn(this.config.command, [...(this.config.args ?? [])], {
        stdio: ["pipe", "pipe", "pipe"],
        env: { ...process.env, ...env },
      });

      if (!this.process.stdout || !this.process.stdin) {
        throw new MCPClientError("Failed to attach to child process stdio");
      }

      // Set up line-based JSON-RPC reader
      this.readline = createInterface({ input: this.process.stdout });
      this.readline.on("line", (line) => this.handleLine(line));

      this.process.on("exit", (code) => {
        this.state = "disconnected";
        this.rejectAllPending(new MCPClientError(`Server exited with code ${code}`));
      });

      this.process.on("error", (error) => {
        this.state = "error";
        this.rejectAllPending(new MCPClientError(`Server process error: ${error.message}`));
      });

      // Perform initialize handshake
      const initResult = (await this.sendRequest("initialize", {
        protocolVersion: "2024-11-05",
        capabilities: {},
        clientInfo: { name: "dbcode", version: "0.1.0" },
      })) as {
        capabilities?: MCPServerCapabilities;
        serverInfo?: { name: string; version: string };
      };

      this.capabilities = initResult.capabilities ?? null;

      // Send initialized notification
      this.sendNotification("notifications/initialized", {});

      this.state = "connected";
    } catch (error) {
      this.state = "error";
      this.cleanup();

      if (error instanceof MCPClientError) throw error;
      throw new MCPClientError("Failed to connect to MCP server", {
        server: this.config.name,
        cause: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /** Disconnect from the MCP server */
  async disconnect(): Promise<void> {
    if (this.state === "disconnected") return;

    this.rejectAllPending(new MCPClientError("Client disconnecting"));
    this.cleanup();
    this.state = "disconnected";
  }

  /** List available tools from the server */
  async listTools(): Promise<readonly MCPToolDefinition[]> {
    this.ensureConnected();
    const result = (await this.sendRequest("tools/list", {})) as {
      tools: MCPToolDefinition[];
    };
    return result.tools ?? [];
  }

  /** Call a tool on the server */
  async callTool(name: string, args: Record<string, unknown>): Promise<MCPToolCallResult> {
    this.ensureConnected();
    const result = (await this.sendRequest("tools/call", {
      name,
      arguments: args,
    })) as MCPToolCallResult;
    return result;
  }

  /** List available resources */
  async listResources(): Promise<readonly MCPResource[]> {
    this.ensureConnected();
    const result = (await this.sendRequest("resources/list", {})) as {
      resources: MCPResource[];
    };
    return result.resources ?? [];
  }

  /** Read a resource by URI */
  async readResource(uri: string): Promise<string> {
    this.ensureConnected();
    const result = (await this.sendRequest("resources/read", { uri })) as {
      contents: Array<{ text?: string; blob?: string }>;
    };
    const content = result.contents?.[0];
    return content?.text ?? content?.blob ?? "";
  }

  /**
   * Send a JSON-RPC request and wait for the response.
   */
  private sendRequest(method: string, params: Record<string, unknown>): Promise<unknown> {
    return new Promise<unknown>((resolve, reject) => {
      const id = randomUUID();
      const request: JsonRpcRequest = {
        jsonrpc: "2.0",
        id,
        method,
        params,
      };

      const timer = setTimeout(() => {
        this.pendingRequests.delete(id);
        reject(new MCPClientError(`Request timed out: ${method}`, { id, method }));
      }, DEFAULT_REQUEST_TIMEOUT_MS);

      this.pendingRequests.set(id, { resolve, reject, timer });
      this.writeLine(JSON.stringify(request));
    });
  }

  /** Send a JSON-RPC notification (no response expected) */
  private sendNotification(method: string, params: Record<string, unknown>): void {
    const notification: JsonRpcNotification = {
      jsonrpc: "2.0",
      method,
      params,
    };
    this.writeLine(JSON.stringify(notification));
  }

  /** Write a line to the server's stdin */
  private writeLine(line: string): void {
    if (!this.process?.stdin?.writable) {
      throw new MCPClientError("Server stdin not writable");
    }
    this.process.stdin.write(line + "\n");
  }

  /** Handle a line of output from the server */
  private handleLine(line: string): void {
    const trimmed = line.trim();
    if (!trimmed) return;

    try {
      const message = JSON.parse(trimmed) as JsonRpcResponse | JsonRpcError | JsonRpcNotification;

      // Check if it's a notification (no id)
      if (!("id" in message)) {
        this.handleNotification(message as JsonRpcNotification);
        return;
      }

      const msgId = (message as { id?: string | number | null }).id;
      if (msgId === null || msgId === undefined) return;

      const pending = this.pendingRequests.get(msgId);
      if (!pending) return;

      this.pendingRequests.delete(msgId);
      clearTimeout(pending.timer);

      if ("error" in message) {
        const errMsg = message as JsonRpcError;
        pending.reject(
          new MCPClientError(errMsg.error.message, {
            code: errMsg.error.code,
            data: errMsg.error.data,
          }),
        );
      } else {
        pending.resolve((message as JsonRpcResponse).result);
      }
    } catch {
      // Ignore unparseable lines (server may emit non-JSON debug output)
    }
  }

  /** Handle a server notification */
  private handleNotification(notification: JsonRpcNotification): void {
    if (notification.method === "notifications/tools/list_changed") {
      this.onToolsChanged?.();
    }
  }

  /** Reject all pending requests */
  private rejectAllPending(error: Error): void {
    for (const [id, pending] of this.pendingRequests) {
      clearTimeout(pending.timer);
      pending.reject(error);
      this.pendingRequests.delete(id);
    }
  }

  /** Clean up child process and readline */
  private cleanup(): void {
    this.readline?.close();
    this.readline = null;

    if (this.process) {
      this.process.kill();
      this.process = null;
    }
  }

  /** Ensure the client is connected */
  private ensureConnected(): void {
    if (this.state !== "connected") {
      throw new MCPClientError("Not connected to MCP server", {
        server: this.config.name,
        state: this.state,
      });
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
