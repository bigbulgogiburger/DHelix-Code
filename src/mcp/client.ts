import { randomUUID } from "node:crypto";
import { BaseError } from "../utils/error.js";
import {
  type MCPServerConfig,
  type MCPServerCapabilities,
  type MCPToolDefinition,
  type MCPResource,
  type MCPToolCallResult,
  type MCPConnectionState,
  type JsonRpcResponse,
  type JsonRpcError,
  type JsonRpcNotification,
  type JsonRpcMessage,
} from "./types.js";
import { type MCPTransportLayer, createTransport } from "./transports/base.js";

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
 * MCP client — communicates with an MCP server via a pluggable transport layer.
 * Handles the JSON-RPC 2.0 protocol, connection lifecycle, and tool discovery.
 */
export class MCPClient {
  private transport: MCPTransportLayer | null = null;
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
   * Creates the appropriate transport and performs the initialize handshake.
   */
  async connect(): Promise<void> {
    if (this.state === "connected") return;

    this.state = "connecting";

    try {
      this.transport = createTransport(this.config);

      // Wire up transport event handlers before connecting
      this.transport.onMessage((message) => this.handleMessage(message));
      this.transport.onError((error) => {
        this.state = "error";
        this.rejectAllPending(
          new MCPClientError(`Transport error: ${error.message}`, {
            server: this.config.name,
          }),
        );
      });
      this.transport.onClose(() => {
        this.state = "disconnected";
        this.rejectAllPending(new MCPClientError("Transport closed"));
      });

      await this.transport.connect();

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
      await this.cleanup();

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
    await this.cleanup();
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

      const timer = setTimeout(() => {
        this.pendingRequests.delete(id);
        reject(new MCPClientError(`Request timed out: ${method}`, { id, method }));
      }, DEFAULT_REQUEST_TIMEOUT_MS);

      this.pendingRequests.set(id, { resolve, reject, timer });

      try {
        this.transport!.sendRequest(id, method, params);
      } catch (error) {
        this.pendingRequests.delete(id);
        clearTimeout(timer);
        reject(
          error instanceof MCPClientError
            ? error
            : new MCPClientError(`Failed to send request: ${method}`, {
                cause: error instanceof Error ? error.message : String(error),
              }),
        );
      }
    });
  }

  /** Send a JSON-RPC notification (no response expected) */
  private sendNotification(method: string, params: Record<string, unknown>): void {
    this.transport!.sendNotification(method, params);
  }

  /** Handle an incoming JSON-RPC message from the transport */
  private handleMessage(message: JsonRpcMessage): void {
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

  /** Clean up transport */
  private async cleanup(): Promise<void> {
    if (this.transport) {
      await this.transport.disconnect();
      this.transport = null;
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
}
