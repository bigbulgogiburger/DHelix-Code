import { describe, it, expect, afterEach } from "vitest";
import { PassThrough } from "node:stream";
import { z } from "zod";
import {
  MCPServer,
  MCPServerError,
  JSON_RPC_ERRORS,
  type MCPServeConfig,
} from "../../../src/mcp/serve.js";
import { ToolRegistry } from "../../../src/tools/registry.js";
import { type ToolDefinition } from "../../../src/tools/types.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createMockTool(
  name: string,
  options: {
    permission?: "safe" | "confirm" | "dangerous";
    schema?: z.ZodSchema;
    execute?: (params: unknown) => Promise<{ output: string; isError: boolean }>;
  } = {},
): ToolDefinition {
  return {
    name,
    description: `Mock tool: ${name}`,
    parameterSchema: options.schema ?? z.object({ input: z.string() }),
    permissionLevel: options.permission ?? "safe",
    execute: options.execute ?? (async () => ({ output: `${name} executed`, isError: false })),
  };
}

function createTestRegistry(...tools: ToolDefinition[]): ToolRegistry {
  const registry = new ToolRegistry();
  registry.registerAll(tools);
  return registry;
}

function makeRequest(
  method: string,
  id: string | number,
  params?: Record<string, unknown>,
): string {
  return JSON.stringify({
    jsonrpc: "2.0",
    id,
    method,
    ...(params !== undefined ? { params } : {}),
  });
}

function makeNotification(method: string, params?: Record<string, unknown>): string {
  return JSON.stringify({
    jsonrpc: "2.0",
    method,
    ...(params !== undefined ? { params } : {}),
  });
}

function parseResponse(json: string): Record<string, unknown> {
  return JSON.parse(json) as Record<string, unknown>;
}

interface TestHarness {
  readonly server: MCPServer;
  readonly stdin: PassThrough;
  readonly stdout: PassThrough;
  readonly registry: ToolRegistry;
}

function createTestHarness(
  tools: ToolDefinition[] = [],
  overrides: Partial<MCPServeConfig> = {},
): TestHarness {
  const stdin = new PassThrough();
  const stdout = new PassThrough();
  const registry = createTestRegistry(...tools);

  const server = new MCPServer({
    toolRegistry: registry,
    stdin,
    stdout,
    workingDirectory: "/tmp/test",
    ...overrides,
  });

  return { server, stdin, stdout, registry };
}

/** Send a line through stdin and read the response line from stdout */
async function sendAndReceive(harness: TestHarness, message: string): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("Timed out waiting for response")), 5000);

    let buffer = "";
    const onData = (chunk: Buffer) => {
      buffer += chunk.toString();
      const newlineIdx = buffer.indexOf("\n");
      if (newlineIdx !== -1) {
        clearTimeout(timeout);
        harness.stdout.removeListener("data", onData);
        resolve(buffer.slice(0, newlineIdx));
      }
    };
    harness.stdout.on("data", onData);
    harness.stdin.write(`${message}\n`);
  });
}

/** Initialize a server (send initialize request via handleMessage) */
async function initializeServer(server: MCPServer): Promise<Record<string, unknown>> {
  const response = await server.handleMessage(
    makeRequest("initialize", 1, {
      protocolVersion: "2024-11-05",
      capabilities: {},
      clientInfo: { name: "test-client", version: "1.0.0" },
    }),
  );
  return parseResponse(response!);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("MCPServerError", () => {
  it("should be an instance of Error with proper code", () => {
    const error = new MCPServerError("test error", { detail: "info" });
    expect(error).toBeInstanceOf(Error);
    expect(error.code).toBe("MCP_SERVER_ERROR");
    expect(error.message).toBe("test error");
    expect(error.context).toEqual({ detail: "info" });
  });

  it("should default to empty context", () => {
    const error = new MCPServerError("bare error");
    expect(error.context).toEqual({});
  });
});

describe("JSON_RPC_ERRORS", () => {
  it("should have standard error codes", () => {
    expect(JSON_RPC_ERRORS.PARSE_ERROR).toBe(-32700);
    expect(JSON_RPC_ERRORS.INVALID_REQUEST).toBe(-32600);
    expect(JSON_RPC_ERRORS.METHOD_NOT_FOUND).toBe(-32601);
    expect(JSON_RPC_ERRORS.INVALID_PARAMS).toBe(-32602);
    expect(JSON_RPC_ERRORS.INTERNAL_ERROR).toBe(-32603);
  });
});

describe("MCPServer", () => {
  let harness: TestHarness;

  afterEach(async () => {
    if (harness?.server.isRunning()) {
      await harness.server.stop();
    }
  });

  // -------------------------------------------------------------------------
  // Construction and lifecycle
  // -------------------------------------------------------------------------

  describe("construction", () => {
    it("should create a server with default name and version", () => {
      harness = createTestHarness();
      expect(harness.server.isRunning()).toBe(false);
      expect(harness.server.isInitialized()).toBe(false);
    });

    it("should accept custom name and version", async () => {
      harness = createTestHarness([], { name: "my-server", version: "2.0.0" });
      const result = await initializeServer(harness.server);
      const resultData = result.result as Record<string, unknown>;
      const serverInfo = resultData.serverInfo as Record<string, string>;
      expect(serverInfo.name).toBe("my-server");
      expect(serverInfo.version).toBe("2.0.0");
    });
  });

  describe("start and stop", () => {
    it("should start and become running", async () => {
      harness = createTestHarness();
      await harness.server.start();
      expect(harness.server.isRunning()).toBe(true);
    });

    it("should stop and become not running", async () => {
      harness = createTestHarness();
      await harness.server.start();
      await harness.server.stop();
      expect(harness.server.isRunning()).toBe(false);
      expect(harness.server.isInitialized()).toBe(false);
    });

    it("should be idempotent on start", async () => {
      harness = createTestHarness();
      await harness.server.start();
      await harness.server.start(); // second call should not throw
      expect(harness.server.isRunning()).toBe(true);
    });

    it("should be idempotent on stop", async () => {
      harness = createTestHarness();
      await harness.server.stop(); // stop without start should not throw
      expect(harness.server.isRunning()).toBe(false);
    });

    it("should reset initialized state on stop", async () => {
      harness = createTestHarness();
      await initializeServer(harness.server);
      expect(harness.server.isInitialized()).toBe(true);
      // Simulate running (start sets running = true)
      await harness.server.start();
      await harness.server.stop();
      expect(harness.server.isInitialized()).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // Initialize handshake
  // -------------------------------------------------------------------------

  describe("initialize", () => {
    it("should return protocol version and capabilities", async () => {
      harness = createTestHarness();
      const result = await initializeServer(harness.server);

      expect(result.jsonrpc).toBe("2.0");
      expect(result.id).toBe(1);
      const data = result.result as Record<string, unknown>;
      expect(data.protocolVersion).toBe("2024-11-05");
      expect(data.capabilities).toEqual({ tools: { listChanged: false } });
    });

    it("should return server info", async () => {
      harness = createTestHarness([], { name: "test-server", version: "3.0.0" });
      const result = await initializeServer(harness.server);
      const data = result.result as Record<string, unknown>;
      const serverInfo = data.serverInfo as Record<string, string>;
      expect(serverInfo.name).toBe("test-server");
      expect(serverInfo.version).toBe("3.0.0");
    });

    it("should mark server as initialized", async () => {
      harness = createTestHarness();
      expect(harness.server.isInitialized()).toBe(false);
      await initializeServer(harness.server);
      expect(harness.server.isInitialized()).toBe(true);
    });

    it("should allow re-initialization", async () => {
      harness = createTestHarness();
      await initializeServer(harness.server);
      const result = await initializeServer(harness.server);
      expect(result.id).toBe(1);
      const data = result.result as Record<string, unknown>;
      expect(data.protocolVersion).toBe("2024-11-05");
    });
  });

  // -------------------------------------------------------------------------
  // Server not initialized guard
  // -------------------------------------------------------------------------

  describe("not initialized guard", () => {
    it("should reject tools/list before initialize", async () => {
      harness = createTestHarness([createMockTool("safe_tool")]);
      const response = await harness.server.handleMessage(makeRequest("tools/list", 1));
      const parsed = parseResponse(response!);
      expect(parsed.error).toBeDefined();
      const error = parsed.error as Record<string, unknown>;
      expect(error.code).toBe(JSON_RPC_ERRORS.INVALID_REQUEST);
      expect(error.message).toContain("not initialized");
    });

    it("should reject tools/call before initialize", async () => {
      harness = createTestHarness([createMockTool("safe_tool")]);
      const response = await harness.server.handleMessage(
        makeRequest("tools/call", 2, { name: "safe_tool", arguments: { input: "hi" } }),
      );
      const parsed = parseResponse(response!);
      const error = parsed.error as Record<string, unknown>;
      expect(error.code).toBe(JSON_RPC_ERRORS.INVALID_REQUEST);
    });

    it("should reject ping before initialize", async () => {
      harness = createTestHarness();
      const response = await harness.server.handleMessage(makeRequest("ping", 3));
      const parsed = parseResponse(response!);
      expect(parsed.error).toBeDefined();
    });

    it("should allow initialize itself without prior initialization", async () => {
      harness = createTestHarness();
      const result = await initializeServer(harness.server);
      expect(result.result).toBeDefined();
      expect(result.error).toBeUndefined();
    });
  });

  // -------------------------------------------------------------------------
  // tools/list
  // -------------------------------------------------------------------------

  describe("tools/list", () => {
    it("should return empty tools list when no tools registered", async () => {
      harness = createTestHarness();
      await initializeServer(harness.server);

      const response = await harness.server.handleMessage(makeRequest("tools/list", 2));
      const parsed = parseResponse(response!);
      const data = parsed.result as Record<string, unknown>;
      expect(data.tools).toEqual([]);
    });

    it("should return only safe tools by default", async () => {
      harness = createTestHarness([
        createMockTool("safe_read", { permission: "safe" }),
        createMockTool("confirm_write", { permission: "confirm" }),
        createMockTool("dangerous_exec", { permission: "dangerous" }),
      ]);
      await initializeServer(harness.server);

      const response = await harness.server.handleMessage(makeRequest("tools/list", 2));
      const parsed = parseResponse(response!);
      const data = parsed.result as { tools: Array<{ name: string }> };
      expect(data.tools).toHaveLength(1);
      expect(data.tools[0].name).toBe("safe_read");
    });

    it("should return tool descriptions and input schemas", async () => {
      harness = createTestHarness([
        createMockTool("my_tool", {
          schema: z.object({ query: z.string(), limit: z.number().optional() }),
        }),
      ]);
      await initializeServer(harness.server);

      const response = await harness.server.handleMessage(makeRequest("tools/list", 2));
      const parsed = parseResponse(response!);
      const data = parsed.result as {
        tools: Array<{ name: string; description: string; inputSchema: Record<string, unknown> }>;
      };

      expect(data.tools).toHaveLength(1);
      expect(data.tools[0].name).toBe("my_tool");
      expect(data.tools[0].description).toBe("Mock tool: my_tool");
      expect(data.tools[0].inputSchema).toBeDefined();
      expect(data.tools[0].inputSchema.type).toBe("object");
    });

    it("should support cursor pagination by returning empty on second page", async () => {
      harness = createTestHarness([createMockTool("tool_a")]);
      await initializeServer(harness.server);

      const response = await harness.server.handleMessage(
        makeRequest("tools/list", 2, { cursor: "some-cursor" }),
      );
      const parsed = parseResponse(response!);
      const data = parsed.result as { tools: unknown[] };
      expect(data.tools).toEqual([]);
    });

    it("should expose multiple safe tools", async () => {
      harness = createTestHarness([
        createMockTool("tool_a"),
        createMockTool("tool_b"),
        createMockTool("tool_c"),
      ]);
      await initializeServer(harness.server);

      const response = await harness.server.handleMessage(makeRequest("tools/list", 2));
      const parsed = parseResponse(response!);
      const data = parsed.result as { tools: Array<{ name: string }> };
      expect(data.tools).toHaveLength(3);
      const names = data.tools.map((t) => t.name);
      expect(names).toContain("tool_a");
      expect(names).toContain("tool_b");
      expect(names).toContain("tool_c");
    });
  });

  // -------------------------------------------------------------------------
  // Custom tool whitelist (exposedTools)
  // -------------------------------------------------------------------------

  describe("exposedTools whitelist", () => {
    it("should only expose whitelisted tools", async () => {
      const tools = [
        createMockTool("tool_a"),
        createMockTool("tool_b"),
        createMockTool("tool_c", { permission: "confirm" }),
      ];
      harness = createTestHarness(tools, { exposedTools: ["tool_b", "tool_c"] });
      await initializeServer(harness.server);

      const response = await harness.server.handleMessage(makeRequest("tools/list", 2));
      const parsed = parseResponse(response!);
      const data = parsed.result as { tools: Array<{ name: string }> };
      expect(data.tools).toHaveLength(2);
      const names = data.tools.map((t) => t.name);
      expect(names).toContain("tool_b");
      expect(names).toContain("tool_c");
      expect(names).not.toContain("tool_a");
    });

    it("should allow exposing confirm/dangerous tools via whitelist", async () => {
      harness = createTestHarness([createMockTool("dangerous_tool", { permission: "dangerous" })], {
        exposedTools: ["dangerous_tool"],
      });
      await initializeServer(harness.server);

      const response = await harness.server.handleMessage(makeRequest("tools/list", 2));
      const parsed = parseResponse(response!);
      const data = parsed.result as { tools: Array<{ name: string }> };
      expect(data.tools).toHaveLength(1);
      expect(data.tools[0].name).toBe("dangerous_tool");
    });

    it("should return exposed tool names via getExposedToolNames", () => {
      harness = createTestHarness([createMockTool("a"), createMockTool("b")], {
        exposedTools: ["a"],
      });
      const exposed = harness.server.getExposedToolNames();
      expect(exposed.has("a")).toBe(true);
      expect(exposed.has("b")).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // tools/call
  // -------------------------------------------------------------------------

  describe("tools/call", () => {
    it("should execute a tool and return result", async () => {
      harness = createTestHarness([
        createMockTool("echo", {
          execute: async (params: unknown) => {
            const p = params as { input: string };
            return { output: `echoed: ${p.input}`, isError: false };
          },
        }),
      ]);
      await initializeServer(harness.server);

      const response = await harness.server.handleMessage(
        makeRequest("tools/call", 3, { name: "echo", arguments: { input: "hello" } }),
      );
      const parsed = parseResponse(response!);
      const data = parsed.result as {
        content: Array<{ type: string; text: string }>;
        isError: boolean;
      };
      expect(data.content).toHaveLength(1);
      expect(data.content[0].type).toBe("text");
      expect(data.content[0].text).toBe("echoed: hello");
      expect(data.isError).toBe(false);
    });

    it("should return error for missing tool name", async () => {
      harness = createTestHarness([createMockTool("my_tool")]);
      await initializeServer(harness.server);

      const response = await harness.server.handleMessage(makeRequest("tools/call", 3, {}));
      const parsed = parseResponse(response!);
      const error = parsed.error as Record<string, unknown>;
      expect(error.code).toBe(JSON_RPC_ERRORS.INVALID_PARAMS);
      expect(error.message).toContain("Missing required parameter");
    });

    it("should return error for unknown tool", async () => {
      harness = createTestHarness([createMockTool("known_tool")]);
      await initializeServer(harness.server);

      const response = await harness.server.handleMessage(
        makeRequest("tools/call", 3, { name: "unknown_tool" }),
      );
      const parsed = parseResponse(response!);
      const error = parsed.error as Record<string, unknown>;
      expect(error.code).toBe(JSON_RPC_ERRORS.INVALID_PARAMS);
      expect(error.message).toContain("Tool not found");
    });

    it("should return error for non-exposed tool", async () => {
      harness = createTestHarness([createMockTool("hidden_tool", { permission: "confirm" })]);
      await initializeServer(harness.server);

      // hidden_tool is "confirm" so not exposed by default
      const response = await harness.server.handleMessage(
        makeRequest("tools/call", 3, { name: "hidden_tool", arguments: { input: "test" } }),
      );
      const parsed = parseResponse(response!);
      const error = parsed.error as Record<string, unknown>;
      expect(error.code).toBe(JSON_RPC_ERRORS.INVALID_PARAMS);
      expect(error.message).toContain("Tool not exposed");
    });

    it("should validate tool arguments against schema", async () => {
      harness = createTestHarness([
        createMockTool("strict_tool", {
          schema: z.object({ count: z.number().min(1) }),
        }),
      ]);
      await initializeServer(harness.server);

      const response = await harness.server.handleMessage(
        makeRequest("tools/call", 3, { name: "strict_tool", arguments: { count: -5 } }),
      );
      const parsed = parseResponse(response!);
      const error = parsed.error as Record<string, unknown>;
      expect(error.code).toBe(JSON_RPC_ERRORS.INVALID_PARAMS);
      expect(error.message).toContain("Invalid tool arguments");
    });

    it("should handle tool execution errors gracefully", async () => {
      harness = createTestHarness([
        createMockTool("failing_tool", {
          execute: async () => {
            throw new Error("Tool crashed");
          },
        }),
      ]);
      await initializeServer(harness.server);

      const response = await harness.server.handleMessage(
        makeRequest("tools/call", 3, { name: "failing_tool", arguments: { input: "test" } }),
      );
      const parsed = parseResponse(response!);
      // Execution errors are returned as successful JSON-RPC with isError in content
      const data = parsed.result as { content: Array<{ text: string }>; isError: boolean };
      expect(data.isError).toBe(true);
      expect(data.content[0].text).toContain("Tool crashed");
    });

    it("should handle tool returning isError=true", async () => {
      harness = createTestHarness([
        createMockTool("error_tool", {
          execute: async () => ({ output: "something went wrong", isError: true }),
        }),
      ]);
      await initializeServer(harness.server);

      const response = await harness.server.handleMessage(
        makeRequest("tools/call", 3, { name: "error_tool", arguments: { input: "test" } }),
      );
      const parsed = parseResponse(response!);
      const data = parsed.result as { content: Array<{ text: string }>; isError: boolean };
      expect(data.isError).toBe(true);
      expect(data.content[0].text).toBe("something went wrong");
    });

    it("should use default empty arguments when none provided", async () => {
      harness = createTestHarness([
        createMockTool("no_args_tool", {
          schema: z.object({}),
          execute: async () => ({ output: "no args needed", isError: false }),
        }),
      ]);
      await initializeServer(harness.server);

      const response = await harness.server.handleMessage(
        makeRequest("tools/call", 3, { name: "no_args_tool" }),
      );
      const parsed = parseResponse(response!);
      const data = parsed.result as { content: Array<{ text: string }> };
      expect(data.content[0].text).toBe("no args needed");
    });

    it("should return error when params are missing entirely", async () => {
      harness = createTestHarness([createMockTool("my_tool")]);
      await initializeServer(harness.server);

      const response = await harness.server.handleMessage(makeRequest("tools/call", 3));
      const parsed = parseResponse(response!);
      const error = parsed.error as Record<string, unknown>;
      expect(error.code).toBe(JSON_RPC_ERRORS.INVALID_PARAMS);
    });

    it("should handle non-Error thrown values", async () => {
      harness = createTestHarness([
        createMockTool("string_throw", {
          execute: async () => {
            throw "string error" as unknown as Error;
          },
        }),
      ]);
      await initializeServer(harness.server);

      const response = await harness.server.handleMessage(
        makeRequest("tools/call", 3, { name: "string_throw", arguments: { input: "test" } }),
      );
      const parsed = parseResponse(response!);
      const data = parsed.result as { content: Array<{ text: string }>; isError: boolean };
      expect(data.isError).toBe(true);
      expect(data.content[0].text).toContain("string error");
    });
  });

  // -------------------------------------------------------------------------
  // Zod schema to JSON Schema conversion
  // -------------------------------------------------------------------------

  describe("schema conversion", () => {
    it("should convert simple Zod object schema to JSON Schema", async () => {
      harness = createTestHarness([
        createMockTool("schema_tool", {
          schema: z.object({
            name: z.string(),
            age: z.number(),
          }),
        }),
      ]);
      await initializeServer(harness.server);

      const response = await harness.server.handleMessage(makeRequest("tools/list", 2));
      const parsed = parseResponse(response!);
      const data = parsed.result as { tools: Array<{ inputSchema: Record<string, unknown> }> };
      const schema = data.tools[0].inputSchema;

      expect(schema.type).toBe("object");
      const properties = schema.properties as Record<string, Record<string, unknown>>;
      expect(properties.name).toBeDefined();
      expect(properties.age).toBeDefined();
    });

    it("should convert schema with optional fields", async () => {
      harness = createTestHarness([
        createMockTool("opt_tool", {
          schema: z.object({
            required_field: z.string(),
            optional_field: z.string().optional(),
          }),
        }),
      ]);
      await initializeServer(harness.server);

      const response = await harness.server.handleMessage(makeRequest("tools/list", 2));
      const parsed = parseResponse(response!);
      const data = parsed.result as { tools: Array<{ inputSchema: Record<string, unknown> }> };
      const schema = data.tools[0].inputSchema;
      const required = schema.required as string[] | undefined;
      expect(required).toContain("required_field");
    });

    it("should convert schema with enum", async () => {
      harness = createTestHarness([
        createMockTool("enum_tool", {
          schema: z.object({
            mode: z.enum(["fast", "slow", "medium"]),
          }),
        }),
      ]);
      await initializeServer(harness.server);

      const response = await harness.server.handleMessage(makeRequest("tools/list", 2));
      const parsed = parseResponse(response!);
      const data = parsed.result as { tools: Array<{ inputSchema: Record<string, unknown> }> };
      const properties = data.tools[0].inputSchema.properties as Record<
        string,
        Record<string, unknown>
      >;
      expect(properties.mode.enum).toEqual(["fast", "slow", "medium"]);
    });
  });

  // -------------------------------------------------------------------------
  // Invalid JSON / parse errors
  // -------------------------------------------------------------------------

  describe("invalid JSON handling", () => {
    it("should return parse error for invalid JSON", async () => {
      harness = createTestHarness();
      const response = await harness.server.handleMessage("not json at all");
      const parsed = parseResponse(response!);
      expect(parsed.error).toBeDefined();
      const error = parsed.error as Record<string, unknown>;
      expect(error.code).toBe(JSON_RPC_ERRORS.PARSE_ERROR);
      expect(error.message).toContain("Parse error");
    });

    it("should return parse error for truncated JSON", async () => {
      harness = createTestHarness();
      const response = await harness.server.handleMessage('{"jsonrpc": "2.0"');
      const parsed = parseResponse(response!);
      const error = parsed.error as Record<string, unknown>;
      expect(error.code).toBe(JSON_RPC_ERRORS.PARSE_ERROR);
    });

    it("should return invalid request for non-object JSON", async () => {
      harness = createTestHarness();
      const response = await harness.server.handleMessage('"just a string"');
      const parsed = parseResponse(response!);
      const error = parsed.error as Record<string, unknown>;
      expect(error.code).toBe(JSON_RPC_ERRORS.INVALID_REQUEST);
      expect(error.message).toContain("expected object");
    });

    it("should return invalid request for array JSON", async () => {
      harness = createTestHarness();
      const response = await harness.server.handleMessage("[1, 2, 3]");
      const parsed = parseResponse(response!);
      const error = parsed.error as Record<string, unknown>;
      expect(error.code).toBe(JSON_RPC_ERRORS.INVALID_REQUEST);
    });

    it("should return invalid request for null JSON", async () => {
      harness = createTestHarness();
      const response = await harness.server.handleMessage("null");
      const parsed = parseResponse(response!);
      const error = parsed.error as Record<string, unknown>;
      expect(error.code).toBe(JSON_RPC_ERRORS.INVALID_REQUEST);
    });

    it("should return invalid request when jsonrpc is missing", async () => {
      harness = createTestHarness();
      const response = await harness.server.handleMessage(
        JSON.stringify({ id: 1, method: "test" }),
      );
      const parsed = parseResponse(response!);
      const error = parsed.error as Record<string, unknown>;
      expect(error.code).toBe(JSON_RPC_ERRORS.INVALID_REQUEST);
      expect(error.message).toContain("jsonrpc must be '2.0'");
    });

    it("should return invalid request when method is missing", async () => {
      harness = createTestHarness();
      const response = await harness.server.handleMessage(
        JSON.stringify({ jsonrpc: "2.0", id: 1 }),
      );
      const parsed = parseResponse(response!);
      const error = parsed.error as Record<string, unknown>;
      expect(error.code).toBe(JSON_RPC_ERRORS.INVALID_REQUEST);
      expect(error.message).toContain("method must be a string");
    });

    it("should return invalid request when method is not a string", async () => {
      harness = createTestHarness();
      const response = await harness.server.handleMessage(
        JSON.stringify({ jsonrpc: "2.0", id: 1, method: 42 }),
      );
      const parsed = parseResponse(response!);
      const error = parsed.error as Record<string, unknown>;
      expect(error.code).toBe(JSON_RPC_ERRORS.INVALID_REQUEST);
    });
  });

  // -------------------------------------------------------------------------
  // Unknown method handling
  // -------------------------------------------------------------------------

  describe("unknown method", () => {
    it("should return method not found for unknown methods", async () => {
      harness = createTestHarness();
      await initializeServer(harness.server);

      const response = await harness.server.handleMessage(makeRequest("resources/list", 5));
      const parsed = parseResponse(response!);
      const error = parsed.error as Record<string, unknown>;
      expect(error.code).toBe(JSON_RPC_ERRORS.METHOD_NOT_FOUND);
      expect(error.message).toContain("resources/list");
    });

    it("should return method not found for completely unknown method", async () => {
      harness = createTestHarness();
      await initializeServer(harness.server);

      const response = await harness.server.handleMessage(makeRequest("nonexistent/method", 6));
      const parsed = parseResponse(response!);
      const error = parsed.error as Record<string, unknown>;
      expect(error.code).toBe(JSON_RPC_ERRORS.METHOD_NOT_FOUND);
    });
  });

  // -------------------------------------------------------------------------
  // Ping
  // -------------------------------------------------------------------------

  describe("ping", () => {
    it("should respond to ping with empty result", async () => {
      harness = createTestHarness();
      await initializeServer(harness.server);

      const response = await harness.server.handleMessage(makeRequest("ping", 7));
      const parsed = parseResponse(response!);
      expect(parsed.result).toEqual({});
      expect(parsed.error).toBeUndefined();
    });
  });

  // -------------------------------------------------------------------------
  // Notifications
  // -------------------------------------------------------------------------

  describe("notifications", () => {
    it("should return null for notifications/initialized", async () => {
      harness = createTestHarness();
      const response = await harness.server.handleMessage(
        makeNotification("notifications/initialized"),
      );
      expect(response).toBeNull();
    });

    it("should return null for unknown notifications", async () => {
      harness = createTestHarness();
      const response = await harness.server.handleMessage(
        makeNotification("notifications/unknown"),
      );
      expect(response).toBeNull();
    });

    it("should return null for notifications with params", async () => {
      harness = createTestHarness();
      const response = await harness.server.handleMessage(
        makeNotification("notifications/initialized", { key: "value" }),
      );
      expect(response).toBeNull();
    });
  });

  // -------------------------------------------------------------------------
  // Multiple sequential requests
  // -------------------------------------------------------------------------

  describe("sequential requests", () => {
    it("should handle multiple requests in sequence", async () => {
      harness = createTestHarness([
        createMockTool("tool_a", {
          execute: async () => ({ output: "result_a", isError: false }),
        }),
        createMockTool("tool_b", {
          execute: async () => ({ output: "result_b", isError: false }),
        }),
      ]);
      await initializeServer(harness.server);

      // First request
      const response1 = await harness.server.handleMessage(
        makeRequest("tools/call", 10, { name: "tool_a", arguments: { input: "x" } }),
      );
      const parsed1 = parseResponse(response1!);
      const data1 = parsed1.result as { content: Array<{ text: string }> };
      expect(data1.content[0].text).toBe("result_a");

      // Second request
      const response2 = await harness.server.handleMessage(
        makeRequest("tools/call", 11, { name: "tool_b", arguments: { input: "y" } }),
      );
      const parsed2 = parseResponse(response2!);
      const data2 = parsed2.result as { content: Array<{ text: string }> };
      expect(data2.content[0].text).toBe("result_b");
    });

    it("should preserve correct request IDs across calls", async () => {
      harness = createTestHarness();
      await initializeServer(harness.server);

      const r1 = await harness.server.handleMessage(makeRequest("ping", "abc-123"));
      const r2 = await harness.server.handleMessage(makeRequest("ping", 999));

      expect(parseResponse(r1!).id).toBe("abc-123");
      expect(parseResponse(r2!).id).toBe(999);
    });

    it("should handle initialize then tools/list then tools/call", async () => {
      harness = createTestHarness([
        createMockTool("full_flow_tool", {
          execute: async () => ({ output: "full flow ok", isError: false }),
        }),
      ]);

      // Step 1: Initialize
      const initResp = await harness.server.handleMessage(
        makeRequest("initialize", 1, { protocolVersion: "2024-11-05", capabilities: {} }),
      );
      expect(parseResponse(initResp!).result).toBeDefined();

      // Step 2: List tools
      const listResp = await harness.server.handleMessage(makeRequest("tools/list", 2));
      const listData = parseResponse(listResp!).result as { tools: Array<{ name: string }> };
      expect(listData.tools).toHaveLength(1);

      // Step 3: Call tool
      const callResp = await harness.server.handleMessage(
        makeRequest("tools/call", 3, { name: "full_flow_tool", arguments: { input: "test" } }),
      );
      const callData = parseResponse(callResp!).result as { content: Array<{ text: string }> };
      expect(callData.content[0].text).toBe("full flow ok");
    });
  });

  // -------------------------------------------------------------------------
  // stdin/stdout integration
  // -------------------------------------------------------------------------

  describe("stdin/stdout integration", () => {
    it("should process messages from stdin and write responses to stdout", async () => {
      harness = createTestHarness([createMockTool("stream_tool")]);
      await harness.server.start();

      // Send initialize
      const initResponse = await sendAndReceive(
        harness,
        makeRequest("initialize", 1, { protocolVersion: "2024-11-05", capabilities: {} }),
      );
      const initParsed = parseResponse(initResponse);
      expect(initParsed.id).toBe(1);
      expect(initParsed.result).toBeDefined();

      // Send tools/list
      const listResponse = await sendAndReceive(harness, makeRequest("tools/list", 2));
      const listParsed = parseResponse(listResponse);
      const listData = listParsed.result as { tools: Array<{ name: string }> };
      expect(listData.tools).toHaveLength(1);
    });

    it("should ignore empty lines from stdin", async () => {
      harness = createTestHarness();
      await harness.server.start();

      // Write empty lines — should not produce output
      harness.stdin.write("\n");
      harness.stdin.write("   \n");

      // Now send a real request and verify it works
      const response = await sendAndReceive(
        harness,
        makeRequest("initialize", 1, { protocolVersion: "2024-11-05", capabilities: {} }),
      );
      const parsed = parseResponse(response);
      expect(parsed.id).toBe(1);
    });

    it("should stop when stdin closes", async () => {
      harness = createTestHarness();
      await harness.server.start();
      expect(harness.server.isRunning()).toBe(true);

      harness.stdin.end();

      // Give a tick for close event to fire
      await new Promise((r) => setTimeout(r, 50));
      expect(harness.server.isRunning()).toBe(false);
    });

    it("should handle invalid JSON on stdin", async () => {
      harness = createTestHarness();
      await harness.server.start();

      const response = await sendAndReceive(harness, "not valid json");
      const parsed = parseResponse(response);
      const error = parsed.error as Record<string, unknown>;
      expect(error.code).toBe(JSON_RPC_ERRORS.PARSE_ERROR);
    });
  });

  // -------------------------------------------------------------------------
  // Edge cases
  // -------------------------------------------------------------------------

  describe("edge cases", () => {
    it("should handle numeric request IDs", async () => {
      harness = createTestHarness();
      const response = await harness.server.handleMessage(
        makeRequest("initialize", 42, { protocolVersion: "2024-11-05" }),
      );
      const parsed = parseResponse(response!);
      expect(parsed.id).toBe(42);
    });

    it("should handle string request IDs", async () => {
      harness = createTestHarness();
      const response = await harness.server.handleMessage(
        makeRequest("initialize", "uuid-abc-123", { protocolVersion: "2024-11-05" }),
      );
      const parsed = parseResponse(response!);
      expect(parsed.id).toBe("uuid-abc-123");
    });

    it("should set null id in parse error responses", async () => {
      harness = createTestHarness();
      const response = await harness.server.handleMessage("invalid json}}");
      const parsed = parseResponse(response!);
      expect(parsed.id).toBeNull();
    });

    it("should handle tools/call with complex schema types", async () => {
      harness = createTestHarness([
        createMockTool("complex_tool", {
          schema: z.object({
            nested: z.object({
              items: z.array(z.string()),
              flag: z.boolean(),
            }),
          }),
          execute: async (params: unknown) => {
            const p = params as { nested: { items: string[]; flag: boolean } };
            return {
              output: `items=${p.nested.items.join(",")},flag=${p.nested.flag}`,
              isError: false,
            };
          },
        }),
      ]);
      await initializeServer(harness.server);

      const response = await harness.server.handleMessage(
        makeRequest("tools/call", 3, {
          name: "complex_tool",
          arguments: { nested: { items: ["a", "b"], flag: true } },
        }),
      );
      const parsed = parseResponse(response!);
      const data = parsed.result as { content: Array<{ text: string }> };
      expect(data.content[0].text).toBe("items=a,b,flag=true");
    });

    it("should expose default safe tools when no exposedTools specified", () => {
      const safeTool = createMockTool("safe_one", { permission: "safe" });
      const confirmTool = createMockTool("confirm_one", { permission: "confirm" });
      harness = createTestHarness([safeTool, confirmTool]);

      const exposed = harness.server.getExposedToolNames();
      expect(exposed.has("safe_one")).toBe(true);
      expect(exposed.has("confirm_one")).toBe(false);
    });

    it("should handle empty string message", async () => {
      harness = createTestHarness();
      // Empty string JSON is still invalid
      const response = await harness.server.handleMessage("");
      const parsed = parseResponse(response!);
      const error = parsed.error as Record<string, unknown>;
      expect(error.code).toBe(JSON_RPC_ERRORS.PARSE_ERROR);
    });
  });
});
