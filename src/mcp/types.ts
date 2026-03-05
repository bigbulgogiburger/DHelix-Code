/**
 * MCP (Model Context Protocol) type definitions.
 * Based on the JSON-RPC 2.0 protocol with MCP-specific extensions.
 */

/** JSON-RPC 2.0 request */
export interface JsonRpcRequest {
  readonly jsonrpc: "2.0";
  readonly id: string | number;
  readonly method: string;
  readonly params?: Readonly<Record<string, unknown>>;
}

/** JSON-RPC 2.0 response (success) */
export interface JsonRpcResponse {
  readonly jsonrpc: "2.0";
  readonly id: string | number;
  readonly result: unknown;
}

/** JSON-RPC 2.0 error response */
export interface JsonRpcError {
  readonly jsonrpc: "2.0";
  readonly id: string | number | null;
  readonly error: {
    readonly code: number;
    readonly message: string;
    readonly data?: unknown;
  };
}

/** JSON-RPC 2.0 notification (no id) */
export interface JsonRpcNotification {
  readonly jsonrpc: "2.0";
  readonly method: string;
  readonly params?: Readonly<Record<string, unknown>>;
}

/** Union of all JSON-RPC message types */
export type JsonRpcMessage = JsonRpcRequest | JsonRpcResponse | JsonRpcError | JsonRpcNotification;

/** MCP transport type */
export type MCPTransport = "stdio" | "http" | "sse";

/** MCP server configuration */
export interface MCPServerConfig {
  /** Unique server name */
  readonly name: string;
  /** Transport type */
  readonly transport: MCPTransport;
  /** Command to execute (stdio transport) */
  readonly command?: string;
  /** Command arguments (stdio transport) */
  readonly args?: readonly string[];
  /** URL (http/sse transport) */
  readonly url?: string;
  /** Environment variables for the server process */
  readonly env?: Readonly<Record<string, string>>;
  /** Server scope */
  readonly scope?: "local" | "project" | "user";
}

/** MCP tool definition from a server */
export interface MCPToolDefinition {
  /** Tool name */
  readonly name: string;
  /** Tool description */
  readonly description: string;
  /** JSON Schema for input parameters */
  readonly inputSchema: Readonly<Record<string, unknown>>;
}

/** MCP resource definition */
export interface MCPResource {
  /** Resource URI */
  readonly uri: string;
  /** Resource name */
  readonly name: string;
  /** Resource description */
  readonly description?: string;
  /** MIME type */
  readonly mimeType?: string;
}

/** MCP prompt definition */
export interface MCPPrompt {
  /** Prompt name */
  readonly name: string;
  /** Prompt description */
  readonly description?: string;
  /** Prompt arguments */
  readonly arguments?: readonly MCPPromptArgument[];
}

/** MCP prompt argument */
export interface MCPPromptArgument {
  readonly name: string;
  readonly description?: string;
  readonly required?: boolean;
}

/** MCP server capabilities (from initialize response) */
export interface MCPServerCapabilities {
  readonly tools?: { readonly listChanged?: boolean };
  readonly resources?: { readonly subscribe?: boolean; readonly listChanged?: boolean };
  readonly prompts?: { readonly listChanged?: boolean };
}

/** MCP tool call result content */
export interface MCPToolResultContent {
  readonly type: "text" | "image" | "resource";
  readonly text?: string;
  readonly data?: string;
  readonly mimeType?: string;
}

/** MCP tool call result */
export interface MCPToolCallResult {
  readonly content: readonly MCPToolResultContent[];
  readonly isError?: boolean;
}

/** Connection state for an MCP server */
export type MCPConnectionState = "disconnected" | "connecting" | "connected" | "error";

/** MCP client events */
export interface MCPClientEvents {
  readonly connected: { readonly serverName: string };
  readonly disconnected: { readonly serverName: string; readonly reason?: string };
  readonly toolsChanged: { readonly serverName: string };
  readonly error: { readonly serverName: string; readonly error: Error };
}
