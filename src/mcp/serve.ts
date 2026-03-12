import { createInterface, type Interface as ReadlineInterface } from "node:readline";
import { z } from "zod";
import { type ToolRegistry } from "../tools/registry.js";
import { type ToolResult, type ToolContext } from "../tools/types.js";
import { zodSchemaToJsonSchema } from "../tools/validation.js";
import { BaseError } from "../utils/error.js";
import {
  type JsonRpcRequest,
  type JsonRpcError,
  type MCPToolDefinition,
  type MCPServerCapabilities,
  type MCPToolCallResult,
} from "./types.js";
import { VERSION } from "../constants.js";

/** MCP server error */
export class MCPServerError extends BaseError {
  constructor(message: string, context: Record<string, unknown> = {}) {
    super(message, "MCP_SERVER_ERROR", context);
  }
}

/** JSON-RPC error codes per MCP specification */
export const JSON_RPC_ERRORS = {
  PARSE_ERROR: -32700,
  INVALID_REQUEST: -32600,
  METHOD_NOT_FOUND: -32601,
  INVALID_PARAMS: -32602,
  INTERNAL_ERROR: -32603,
} as const;

/** Default tool execution timeout (30 seconds) */
const DEFAULT_TOOL_TIMEOUT_MS = 30_000;

/** MCP protocol version */
const PROTOCOL_VERSION = "2024-11-05";

/** Configuration for the MCP server */
export interface MCPServeConfig {
  /** Server name (default: "dbcode") */
  readonly name?: string;
  /** Server version (default: from constants) */
  readonly version?: string;
  /** Tool registry containing tools to expose */
  readonly toolRegistry: ToolRegistry;
  /** Whitelist of tool names to expose (default: all safe tools) */
  readonly exposedTools?: readonly string[];
  /** Working directory for tool execution context */
  readonly workingDirectory?: string;
  /** Stdin stream override (for testing) */
  readonly stdin?: NodeJS.ReadableStream;
  /** Stdout stream override (for testing) */
  readonly stdout?: NodeJS.WritableStream;
}

/** JSON-RPC response shape (success) */
interface JsonRpcSuccessResponse {
  readonly jsonrpc: "2.0";
  readonly id: string | number;
  readonly result: unknown;
}

/** Union response type the server sends */
type ServerResponse = JsonRpcSuccessResponse | JsonRpcError;

/**
 * Build a JSON-RPC success response (immutable).
 */
function createSuccessResponse(id: string | number, result: unknown): JsonRpcSuccessResponse {
  return { jsonrpc: "2.0", id, result };
}

/**
 * Build a JSON-RPC error response (immutable).
 */
function createErrorResponse(
  id: string | number | null,
  code: number,
  message: string,
  data?: unknown,
): JsonRpcError {
  return {
    jsonrpc: "2.0",
    id,
    error: { code, message, ...(data !== undefined ? { data } : {}) },
  };
}

/**
 * MCPServer — exposes dbcode's internal tools as MCP tools over stdio JSON-RPC 2.0.
 *
 * Other MCP clients (Claude Code, other AI agents) can connect to this server
 * and use dbcode's tools.
 */
export class MCPServer {
  private readonly serverName: string;
  private readonly serverVersion: string;
  private readonly toolRegistry: ToolRegistry;
  private readonly exposedToolNames: ReadonlySet<string>;
  private readonly workingDirectory: string;
  private readonly stdinStream: NodeJS.ReadableStream;
  private readonly stdoutStream: NodeJS.WritableStream;
  private initialized = false;
  private running = false;
  private readline: ReadlineInterface | null = null;

  constructor(config: MCPServeConfig) {
    this.serverName = config.name ?? "dbcode";
    this.serverVersion = config.version ?? VERSION;
    this.toolRegistry = config.toolRegistry;
    this.workingDirectory = config.workingDirectory ?? process.cwd();
    this.stdinStream = config.stdin ?? process.stdin;
    this.stdoutStream = config.stdout ?? process.stdout;
    this.exposedToolNames = buildExposedToolSet(config);
  }

  /** Start listening for JSON-RPC messages on stdin */
  async start(): Promise<void> {
    if (this.running) {
      return;
    }

    this.running = true;

    this.readline = createInterface({
      input: this.stdinStream,
      terminal: false,
    });

    this.readline.on("line", (line: string) => {
      void this.processLine(line);
    });

    this.readline.on("close", () => {
      this.running = false;
    });
  }

  /** Stop the server */
  async stop(): Promise<void> {
    if (!this.running) {
      return;
    }

    this.running = false;
    this.initialized = false;

    if (this.readline) {
      this.readline.close();
      this.readline = null;
    }
  }

  /** Check if the server is currently running */
  isRunning(): boolean {
    return this.running;
  }

  /** Check if the server has completed initialization handshake */
  isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Handle a single JSON-RPC message string.
   * Returns the response JSON string, or null for notifications.
   * Exposed for direct testing without stdin/stdout wiring.
   */
  async handleMessage(message: string): Promise<string | null> {
    const parsed = parseJsonRpcMessage(message);

    if (!parsed.ok) {
      const response = createErrorResponse(null, parsed.error.code, parsed.error.message);
      return JSON.stringify(response);
    }

    const request = parsed.value;

    // Notifications have no id — handle and return null
    if (request.id === undefined) {
      this.handleNotification(request.method, request.params);
      return null;
    }

    const response = await this.handleRequest(request as JsonRpcRequest);
    return JSON.stringify(response);
  }

  /** Get the set of exposed tool names */
  getExposedToolNames(): ReadonlySet<string> {
    return this.exposedToolNames;
  }

  // ---------------------------------------------------------------------------
  // Private
  // ---------------------------------------------------------------------------

  /** Process a line from stdin */
  private async processLine(line: string): Promise<void> {
    const trimmed = line.trim();
    if (trimmed.length === 0) {
      return;
    }

    const responseJson = await this.handleMessage(trimmed);
    if (responseJson !== null) {
      this.sendRaw(responseJson);
    }
  }

  /** Route a JSON-RPC request to the appropriate handler */
  private async handleRequest(request: JsonRpcRequest): Promise<ServerResponse> {
    const { id, method } = request;

    // initialize is always allowed
    if (method === "initialize") {
      return this.handleInitialize(id, request.params);
    }

    // All other methods require initialization first
    if (!this.initialized) {
      return createErrorResponse(
        id,
        JSON_RPC_ERRORS.INVALID_REQUEST,
        "Server not initialized. Send 'initialize' first.",
      );
    }

    switch (method) {
      case "tools/list":
        return this.handleToolsList(id, request.params);
      case "tools/call":
        return this.handleToolsCall(id, request.params);
      case "ping":
        return createSuccessResponse(id, {});
      default:
        return createErrorResponse(
          id,
          JSON_RPC_ERRORS.METHOD_NOT_FOUND,
          `Method not found: ${method}`,
        );
    }
  }

  /** Handle the initialize handshake */
  private handleInitialize(
    id: string | number,
    _params?: Readonly<Record<string, unknown>>,
  ): ServerResponse {
    this.initialized = true;

    const capabilities: MCPServerCapabilities = {
      tools: { listChanged: false },
    };

    return createSuccessResponse(id, {
      protocolVersion: PROTOCOL_VERSION,
      capabilities,
      serverInfo: {
        name: this.serverName,
        version: this.serverVersion,
      },
    });
  }

  /** Handle tools/list — return all exposed tools */
  private handleToolsList(
    id: string | number,
    params?: Readonly<Record<string, unknown>>,
  ): ServerResponse {
    const allTools = this.toolRegistry.getAll();
    const exposedTools = allTools.filter((t) => this.exposedToolNames.has(t.name));

    const mcpTools: readonly MCPToolDefinition[] = exposedTools.map((tool) =>
      convertToolDefToMCP(tool),
    );

    // Support cursor-based pagination (optional, we return all at once)
    const cursor = params?.cursor as string | undefined;
    if (cursor) {
      // No pagination needed — return empty when cursor is provided after first page
      return createSuccessResponse(id, { tools: [] });
    }

    return createSuccessResponse(id, { tools: mcpTools });
  }

  /** Handle tools/call — execute a tool and return results */
  private async handleToolsCall(
    id: string | number,
    params?: Readonly<Record<string, unknown>>,
  ): Promise<ServerResponse> {
    if (!params || typeof params.name !== "string") {
      return createErrorResponse(
        id,
        JSON_RPC_ERRORS.INVALID_PARAMS,
        "Missing required parameter: name",
      );
    }

    const toolName = params.name;
    const toolArgs = (params.arguments ?? {}) as Record<string, unknown>;

    // Check if tool exists
    const toolDef = this.toolRegistry.get(toolName);
    if (!toolDef) {
      return createErrorResponse(id, JSON_RPC_ERRORS.INVALID_PARAMS, `Tool not found: ${toolName}`);
    }

    // Check if tool is exposed
    if (!this.exposedToolNames.has(toolName)) {
      return createErrorResponse(
        id,
        JSON_RPC_ERRORS.INVALID_PARAMS,
        `Tool not exposed: ${toolName}`,
      );
    }

    // Validate arguments against schema
    const parseResult = toolDef.parameterSchema.safeParse(toolArgs);
    if (!parseResult.success) {
      const issues = parseResult.error.issues
        .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
        .join("; ");
      return createErrorResponse(
        id,
        JSON_RPC_ERRORS.INVALID_PARAMS,
        `Invalid tool arguments: ${issues}`,
      );
    }

    // Execute the tool
    try {
      const abortController = new AbortController();
      const timeout = toolDef.timeoutMs ?? DEFAULT_TOOL_TIMEOUT_MS;

      const context: ToolContext = {
        workingDirectory: this.workingDirectory,
        abortSignal: abortController.signal,
        timeoutMs: timeout,
        platform: process.platform as "win32" | "darwin" | "linux",
      };

      const timer = setTimeout(() => abortController.abort(), timeout);
      let result: ToolResult;
      try {
        result = await toolDef.execute(parseResult.data, context);
      } finally {
        clearTimeout(timer);
      }

      const mcpResult: MCPToolCallResult = {
        content: [{ type: "text", text: result.output }],
        isError: result.isError,
      };

      return createSuccessResponse(id, mcpResult);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const mcpResult: MCPToolCallResult = {
        content: [{ type: "text", text: `Error: ${errorMessage}` }],
        isError: true,
      };
      return createSuccessResponse(id, mcpResult);
    }
  }

  /** Handle a notification (no response needed) */
  private handleNotification(method: string, _params?: Readonly<Record<string, unknown>>): void {
    // notifications/initialized — client acknowledges init
    // We don't need to do anything special here
    if (method === "notifications/initialized") {
      // acknowledged
    }
    // Other notifications are silently ignored per MCP spec
  }

  /** Write a raw JSON string to stdout, newline-delimited */
  private sendRaw(json: string): void {
    this.stdoutStream.write(`${json}\n`);
  }
}

// ---------------------------------------------------------------------------
// Pure helper functions
// ---------------------------------------------------------------------------

/**
 * Build the set of tool names to expose.
 * If exposedTools is specified, use that whitelist.
 * Otherwise, expose all tools with "safe" permission level.
 */
function buildExposedToolSet(config: MCPServeConfig): ReadonlySet<string> {
  if (config.exposedTools) {
    return new Set(config.exposedTools);
  }

  const allTools = config.toolRegistry.getAll();
  const safeTools = allTools.filter((t) => t.permissionLevel === "safe");
  return new Set(safeTools.map((t) => t.name));
}

/**
 * Convert an internal ToolDefinition to MCP tool format.
 */
function convertToolDefToMCP(tool: {
  readonly name: string;
  readonly description: string;
  readonly parameterSchema: z.ZodSchema;
}): MCPToolDefinition {
  return {
    name: tool.name,
    description: tool.description,
    inputSchema: zodSchemaToJsonSchema(tool.parameterSchema),
  };
}

/** Parsed JSON-RPC message (success) */
interface ParsedMessageOk {
  readonly ok: true;
  readonly value: {
    readonly method: string;
    readonly id?: string | number;
    readonly params?: Readonly<Record<string, unknown>>;
  };
}

/** Parsed JSON-RPC message (error) */
interface ParsedMessageErr {
  readonly ok: false;
  readonly error: { readonly code: number; readonly message: string };
}

/** Parse result for JSON-RPC message parsing */
type ParsedMessage = ParsedMessageOk | ParsedMessageErr;

/**
 * Parse a raw JSON string into a JSON-RPC message.
 * Returns either the parsed value or an error descriptor.
 */
function parseJsonRpcMessage(raw: string): ParsedMessage {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return {
      ok: false,
      error: { code: JSON_RPC_ERRORS.PARSE_ERROR, message: "Parse error: invalid JSON" },
    };
  }

  if (typeof parsed !== "object" || parsed === null) {
    return {
      ok: false,
      error: { code: JSON_RPC_ERRORS.INVALID_REQUEST, message: "Invalid request: expected object" },
    };
  }

  const obj = parsed as Record<string, unknown>;

  if (obj.jsonrpc !== "2.0") {
    return {
      ok: false,
      error: {
        code: JSON_RPC_ERRORS.INVALID_REQUEST,
        message: "Invalid request: jsonrpc must be '2.0'",
      },
    };
  }

  if (typeof obj.method !== "string") {
    return {
      ok: false,
      error: {
        code: JSON_RPC_ERRORS.INVALID_REQUEST,
        message: "Invalid request: method must be a string",
      },
    };
  }

  return {
    ok: true,
    value: {
      method: obj.method,
      id: obj.id as string | number | undefined,
      params: obj.params as Readonly<Record<string, unknown>> | undefined,
    },
  };
}
