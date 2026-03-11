/**
 * MCP Transport Layer — abstract interface for JSON-RPC communication.
 * Implementations handle the wire protocol (stdio, HTTP, SSE).
 */
import { type MCPServerConfig, type JsonRpcMessage } from "../types.js";
import { StdioTransport } from "./stdio.js";
import { HttpTransport } from "./http.js";
import { SseTransport } from "./sse.js";

/** Transport layer interface for MCP JSON-RPC communication */
export interface MCPTransportLayer {
  /** Establish the transport connection */
  connect(): Promise<void>;
  /** Gracefully disconnect the transport */
  disconnect(): Promise<void>;
  /** Send a JSON-RPC request (with id) */
  sendRequest(id: string | number, method: string, params: Record<string, unknown>): void;
  /** Send a JSON-RPC notification (no id, no response expected) */
  sendNotification(method: string, params: Record<string, unknown>): void;
  /** Register a handler for incoming messages */
  onMessage(handler: (message: JsonRpcMessage) => void): void;
  /** Register a handler for transport errors */
  onError(handler: (error: Error) => void): void;
  /** Register a handler for transport close */
  onClose(handler: () => void): void;
}

/** Create a transport instance based on server configuration */
export function createTransport(config: MCPServerConfig): MCPTransportLayer {
  switch (config.transport) {
    case "stdio":
      return new StdioTransport(config);
    case "http":
      return new HttpTransport(config);
    case "sse":
      return new SseTransport(config);
    default:
      throw new Error(`Unknown transport type: ${config.transport as string}`);
  }
}
