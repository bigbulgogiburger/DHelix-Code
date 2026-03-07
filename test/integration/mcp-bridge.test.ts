import { describe, it, expect, vi } from "vitest";
import { MCPToolBridge } from "../../src/mcp/tool-bridge.js";
import { type MCPClient } from "../../src/mcp/client.js";
import { ToolRegistry } from "../../src/tools/registry.js";
import { type MCPToolDefinition, type MCPToolCallResult } from "../../src/mcp/types.js";

/**
 * Create a mock MCPClient with predefined tools and call results.
 */
function createMockMCPClient(
  tools: readonly MCPToolDefinition[],
  callResults?: Map<string, MCPToolCallResult>,
): MCPClient {
  const client = {
    listTools: vi.fn(async () => tools),
    callTool: vi.fn(async (name: string, _args: Record<string, unknown>): Promise<MCPToolCallResult> => {
      const result = callResults?.get(name);
      if (result) return result;
      return {
        content: [{ type: "text" as const, text: `result from ${name}` }],
      };
    }),
    setToolsChangedCallback: vi.fn(),
    getState: vi.fn(() => "connected" as const),
    getCapabilities: vi.fn(() => null),
    connect: vi.fn(),
    disconnect: vi.fn(),
  } as unknown as MCPClient;

  return client;
}

describe("MCPToolBridge Integration", () => {
  it("should register MCP tools with correct namespace", async () => {
    const tools: MCPToolDefinition[] = [
      {
        name: "read_file",
        description: "Read a file from the filesystem",
        inputSchema: {
          type: "object",
          properties: {
            path: { type: "string" },
          },
          required: ["path"],
        },
      },
      {
        name: "list_dir",
        description: "List directory contents",
        inputSchema: {
          type: "object",
          properties: {
            path: { type: "string" },
          },
        },
      },
    ];

    const client = createMockMCPClient(tools);
    const registry = new ToolRegistry();
    const bridge = new MCPToolBridge(registry);

    const registeredNames = await bridge.registerTools(client, "filesystem");

    // Verify namespacing: mcp__<serverName>__<toolName>
    expect(registeredNames).toEqual([
      "mcp__filesystem__read_file",
      "mcp__filesystem__list_dir",
    ]);

    // Verify tools are in the registry
    expect(registry.has("mcp__filesystem__read_file")).toBe(true);
    expect(registry.has("mcp__filesystem__list_dir")).toBe(true);
    expect(registry.size).toBe(2);
  });

  it("should proxy tool execution to the MCP client", async () => {
    const tools: MCPToolDefinition[] = [
      {
        name: "search",
        description: "Search for content",
        inputSchema: {
          type: "object",
          properties: {
            query: { type: "string" },
            limit: { type: "number" },
          },
          required: ["query"],
        },
      },
    ];

    const callResults = new Map<string, MCPToolCallResult>([
      [
        "search",
        {
          content: [
            { type: "text", text: "Result 1: found match" },
            { type: "text", text: "Result 2: another match" },
          ],
        },
      ],
    ]);

    const client = createMockMCPClient(tools, callResults);
    const registry = new ToolRegistry();
    const bridge = new MCPToolBridge(registry);

    await bridge.registerTools(client, "search-server");

    // Get the registered tool and execute it
    const tool = registry.get("mcp__search-server__search");
    expect(tool).toBeDefined();

    const result = await tool!.execute(
      { query: "test query", limit: 10 },
      {
        workingDirectory: "/tmp",
        abortSignal: new AbortController().signal,
        timeoutMs: 30_000,
        platform: "darwin",
      },
    );

    // Verify the MCP client was called with the original tool name (not namespaced)
    expect(client.callTool).toHaveBeenCalledWith("search", {
      query: "test query",
      limit: 10,
    });

    // Verify result combines text content
    expect(result.output).toBe("Result 1: found match\nResult 2: another match");
    expect(result.isError).toBe(false);
    expect(result.metadata).toEqual({ serverName: "search-server" });
  });

  it("should handle MCP tool errors gracefully", async () => {
    const tools: MCPToolDefinition[] = [
      {
        name: "failing_tool",
        description: "A tool that fails",
        inputSchema: { type: "object", properties: {} },
      },
    ];

    const callResults = new Map<string, MCPToolCallResult>([
      [
        "failing_tool",
        {
          content: [{ type: "text", text: "Something went wrong" }],
          isError: true,
        },
      ],
    ]);

    const client = createMockMCPClient(tools, callResults);
    const registry = new ToolRegistry();
    const bridge = new MCPToolBridge(registry);

    await bridge.registerTools(client, "error-server");

    const tool = registry.get("mcp__error-server__failing_tool");
    const result = await tool!.execute(
      {},
      {
        workingDirectory: "/tmp",
        abortSignal: new AbortController().signal,
        timeoutMs: 30_000,
        platform: "darwin",
      },
    );

    expect(result.isError).toBe(true);
    expect(result.output).toBe("Something went wrong");
  });

  it("should handle MCP client throwing during tool call", async () => {
    const tools: MCPToolDefinition[] = [
      {
        name: "crash_tool",
        description: "Crashes during execution",
        inputSchema: { type: "object", properties: {} },
      },
    ];

    const client = createMockMCPClient(tools);
    // Override callTool to throw
    (client.callTool as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error("Connection lost"),
    );

    const registry = new ToolRegistry();
    const bridge = new MCPToolBridge(registry);

    await bridge.registerTools(client, "crash-server");

    const tool = registry.get("mcp__crash-server__crash_tool");
    const result = await tool!.execute(
      {},
      {
        workingDirectory: "/tmp",
        abortSignal: new AbortController().signal,
        timeoutMs: 30_000,
        platform: "darwin",
      },
    );

    expect(result.isError).toBe(true);
    expect(result.output).toContain("MCP tool error: Connection lost");
  });

  it("should skip duplicate registration on reconnect", async () => {
    const tools: MCPToolDefinition[] = [
      {
        name: "greet",
        description: "Greet someone",
        inputSchema: {
          type: "object",
          properties: { name: { type: "string" } },
          required: ["name"],
        },
      },
    ];

    const client = createMockMCPClient(tools);
    const registry = new ToolRegistry();
    const bridge = new MCPToolBridge(registry);

    // First registration
    await bridge.registerTools(client, "greeter");
    expect(registry.size).toBe(1);

    // Second registration (reconnect) — should not throw
    await bridge.registerTools(client, "greeter");
    expect(registry.size).toBe(1);
  });

  it("should register tools from multiple servers with distinct namespaces", async () => {
    const serverATools: MCPToolDefinition[] = [
      {
        name: "read",
        description: "Read from server A",
        inputSchema: { type: "object", properties: {} },
      },
    ];

    const serverBTools: MCPToolDefinition[] = [
      {
        name: "read",
        description: "Read from server B",
        inputSchema: { type: "object", properties: {} },
      },
    ];

    const clientA = createMockMCPClient(serverATools);
    const clientB = createMockMCPClient(serverBTools);

    const registry = new ToolRegistry();
    const bridge = new MCPToolBridge(registry);

    await bridge.registerTools(clientA, "server_a");
    await bridge.registerTools(clientB, "server_b");

    // Both should be registered with distinct names
    expect(registry.has("mcp__server_a__read")).toBe(true);
    expect(registry.has("mcp__server_b__read")).toBe(true);
    expect(registry.size).toBe(2);

    // Bridge should track servers
    expect(bridge.getRegisteredServers()).toEqual(["server_a", "server_b"]);
    expect(bridge.getServerTools("server_a")).toEqual(["mcp__server_a__read"]);
    expect(bridge.getServerTools("server_b")).toEqual(["mcp__server_b__read"]);
  });

  it("should set up tools/list_changed callback", async () => {
    const tools: MCPToolDefinition[] = [
      {
        name: "tool1",
        description: "First tool",
        inputSchema: { type: "object", properties: {} },
      },
    ];

    const client = createMockMCPClient(tools);
    const registry = new ToolRegistry();
    const bridge = new MCPToolBridge(registry);

    await bridge.registerTools(client, "dynamic");

    // setToolsChangedCallback should have been called
    expect(client.setToolsChangedCallback).toHaveBeenCalledTimes(1);
    expect(client.setToolsChangedCallback).toHaveBeenCalledWith(expect.any(Function));
  });

  it("should generate LLM-format definitions with MCP description prefix", async () => {
    const tools: MCPToolDefinition[] = [
      {
        name: "query",
        description: "Run a database query",
        inputSchema: {
          type: "object",
          properties: {
            sql: { type: "string" },
          },
          required: ["sql"],
        },
      },
    ];

    const client = createMockMCPClient(tools);
    const registry = new ToolRegistry();
    const bridge = new MCPToolBridge(registry);

    await bridge.registerTools(client, "database");

    const llmDefs = registry.getDefinitionsForLLM();
    expect(llmDefs).toHaveLength(1);
    expect(llmDefs[0].function.name).toBe("mcp__database__query");
    expect(llmDefs[0].function.description).toContain("[MCP: database]");
    expect(llmDefs[0].function.description).toContain("Run a database query");
  });

  it("shouldDeferTools returns true when MCP tools exceed 10% of context", () => {
    const registry = new ToolRegistry();
    const bridge = new MCPToolBridge(registry);

    // 15000 tokens of MCP tools with 100000 max context = 15% > 10%
    expect(bridge.shouldDeferTools(15_000, 100_000)).toBe(true);

    // 5000 tokens with 100000 max context = 5% < 10%
    expect(bridge.shouldDeferTools(5_000, 100_000)).toBe(false);

    // Edge case: exactly 10%
    expect(bridge.shouldDeferTools(10_000, 100_000)).toBe(false);
  });
});
