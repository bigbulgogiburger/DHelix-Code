import { describe, it, expect, vi } from "vitest";
import { z } from "zod";
import { ToolRegistry } from "../../../src/tools/registry.js";
import { type ToolDefinition } from "../../../src/tools/types.js";
import { type MCPToolSearch } from "../../../src/mcp/tool-search.js";

function createMockTool(name: string): ToolDefinition {
  return {
    name,
    description: `Mock tool: ${name}`,
    parameterSchema: z.object({ input: z.string() }),
    permissionLevel: "safe",
    execute: async () => ({ output: "ok", isError: false }),
  };
}

describe("ToolRegistry", () => {
  it("should register and retrieve tools", () => {
    const registry = new ToolRegistry();
    const tool = createMockTool("test_tool");
    registry.register(tool);

    expect(registry.has("test_tool")).toBe(true);
    expect(registry.get("test_tool")).toBe(tool);
    expect(registry.size).toBe(1);
  });

  it("should throw on duplicate registration", () => {
    const registry = new ToolRegistry();
    registry.register(createMockTool("dup"));
    expect(() => registry.register(createMockTool("dup"))).toThrow("Tool already registered");
  });

  it("should require tool by name or throw", () => {
    const registry = new ToolRegistry();
    registry.register(createMockTool("exists"));

    expect(registry.require("exists").name).toBe("exists");
    expect(() => registry.require("missing")).toThrow("Tool not found");
  });

  it("should return all tool names", () => {
    const registry = new ToolRegistry();
    registry.registerAll([createMockTool("a"), createMockTool("b"), createMockTool("c")]);

    expect(registry.getNames()).toEqual(["a", "b", "c"]);
  });

  it("should convert to LLM definitions", () => {
    const registry = new ToolRegistry();
    registry.register(createMockTool("my_tool"));

    const defs = registry.getDefinitionsForLLM();
    expect(defs).toHaveLength(1);
    expect(defs[0].type).toBe("function");
    expect(defs[0].function.name).toBe("my_tool");
    expect(defs[0].function.description).toBe("Mock tool: my_tool");
    expect(defs[0].function.parameters).toBeDefined();
  });
});

/** Create a mock MCPToolSearch with configurable tools */
function createMockToolSearch(tools: { name: string; description: string; serverName: string }[]): MCPToolSearch {
  const mockSearch = {
    size: tools.length,
    generateDeferredToolsSummary: vi.fn(() => {
      if (tools.length === 0) return "";
      const lines = ["<available-deferred-tools>"];
      for (const t of tools) {
        lines.push(`mcp__${t.serverName}__${t.name}`);
      }
      lines.push("</available-deferred-tools>");
      return lines.join("\n");
    }),
    getToolDefinition: vi.fn((namespacedName: string) => {
      const tool = tools.find((t) => `mcp__${t.serverName}__${t.name}` === namespacedName);
      if (!tool) return undefined;
      return {
        tool: {
          name: tool.name,
          description: tool.description,
          inputSchema: { type: "object", properties: { query: { type: "string" } } },
        },
        serverName: tool.serverName,
        namespacedName,
        score: 1.0,
      };
    }),
    search: vi.fn((query: string, maxResults?: number) => {
      const matching = tools.filter(
        (t) => t.name.includes(query) || t.description.includes(query),
      );
      return matching.slice(0, maxResults ?? 5).map((t) => ({
        tool: {
          name: t.name,
          description: t.description,
          inputSchema: { type: "object", properties: { query: { type: "string" } } },
        },
        serverName: t.serverName,
        namespacedName: `mcp__${t.serverName}__${t.name}`,
        score: 0.8,
      }));
    }),
    has: vi.fn((name: string) => tools.some((t) => `mcp__${t.serverName}__${t.name}` === name)),
    clear: vi.fn(),
  } as unknown as MCPToolSearch;
  return mockSearch;
}

describe("Deferred tool loading", () => {
  it("should not be in deferred mode by default", () => {
    const registry = new ToolRegistry();
    expect(registry.isDeferredMode).toBe(false);
  });

  it("should enter deferred mode when toolSearch is set with tools", () => {
    const registry = new ToolRegistry();
    const mockSearch = createMockToolSearch([
      { name: "navigate_page", description: "Navigate to URL", serverName: "chrome" },
    ]);
    registry.setToolSearch(mockSearch);
    expect(registry.isDeferredMode).toBe(true);
  });

  it("should not be in deferred mode when toolSearch has no tools", () => {
    const registry = new ToolRegistry();
    const mockSearch = createMockToolSearch([]);
    registry.setToolSearch(mockSearch);
    expect(registry.isDeferredMode).toBe(false);
  });

  it("getHotDefinitionsForLLM should return only hot tools and non-MCP tools", () => {
    const registry = new ToolRegistry();
    // Register a hot tool
    registry.register(createMockTool("file_read"));
    // Register a non-hot, non-MCP tool
    registry.register(createMockTool("ask_user"));
    // Register an MCP tool (should be excluded by getHotDefinitionsForLLM)
    registry.register(createMockTool("mcp__chrome__click"));

    const mockSearch = createMockToolSearch([
      { name: "click", description: "Click element", serverName: "chrome" },
    ]);
    registry.setToolSearch(mockSearch);

    const hotDefs = registry.getHotDefinitionsForLLM();
    const hotNames = hotDefs.map((d) => d.function.name);

    // file_read is a hot tool — included
    expect(hotNames).toContain("file_read");
    // ask_user is non-MCP — included
    expect(hotNames).toContain("ask_user");
    // mcp__chrome__click starts with "mcp__" and is not a hot tool — excluded
    expect(hotNames).not.toContain("mcp__chrome__click");
  });

  it("should delegate getDeferredToolsSummary to toolSearch", () => {
    const registry = new ToolRegistry();
    const mockSearch = createMockToolSearch([
      { name: "navigate_page", description: "Navigate to URL", serverName: "chrome" },
      { name: "take_screenshot", description: "Take screenshot", serverName: "chrome" },
    ]);
    registry.setToolSearch(mockSearch);

    const summary = registry.getDeferredToolsSummary();
    expect(summary).toContain("mcp__chrome__navigate_page");
    expect(summary).toContain("mcp__chrome__take_screenshot");
    expect(mockSearch.generateDeferredToolsSummary).toHaveBeenCalled();
  });

  it("should return empty string for getDeferredToolsSummary when no toolSearch", () => {
    const registry = new ToolRegistry();
    const summary = registry.getDeferredToolsSummary();
    expect(summary).toBe("");
  });

  it("should resolve deferred tool by namespaced name", () => {
    const registry = new ToolRegistry();
    const mockSearch = createMockToolSearch([
      { name: "navigate_page", description: "Navigate to URL", serverName: "chrome" },
    ]);
    registry.setToolSearch(mockSearch);

    const resolved = registry.resolveDeferredTool("mcp__chrome__navigate_page");
    expect(resolved).toBeDefined();
    expect(resolved!.type).toBe("function");
    expect(resolved!.function.name).toBe("mcp__chrome__navigate_page");
    expect(resolved!.function.description).toBe("Navigate to URL");
    expect(resolved!.function.parameters).toEqual({
      type: "object",
      properties: { query: { type: "string" } },
    });
  });

  it("should return undefined for unknown deferred tool", () => {
    const registry = new ToolRegistry();
    const mockSearch = createMockToolSearch([]);
    registry.setToolSearch(mockSearch);

    const resolved = registry.resolveDeferredTool("mcp__unknown__tool");
    expect(resolved).toBeUndefined();
  });

  it("should return undefined for resolveDeferredTool when no toolSearch", () => {
    const registry = new ToolRegistry();
    const resolved = registry.resolveDeferredTool("mcp__chrome__click");
    expect(resolved).toBeUndefined();
  });

  it("searchDeferredTools should delegate to toolSearch.search", () => {
    const registry = new ToolRegistry();
    const mockSearch = createMockToolSearch([
      { name: "navigate_page", description: "Navigate to URL", serverName: "chrome" },
      { name: "take_screenshot", description: "Take screenshot", serverName: "chrome" },
    ]);
    registry.setToolSearch(mockSearch);

    const results = registry.searchDeferredTools("navigate", 3);
    expect(results).toHaveLength(1);
    expect(results[0].function.name).toBe("mcp__chrome__navigate_page");
    expect(mockSearch.search).toHaveBeenCalledWith("navigate", 3);
  });

  it("searchDeferredTools should return empty array when no toolSearch", () => {
    const registry = new ToolRegistry();
    const results = registry.searchDeferredTools("test");
    expect(results).toEqual([]);
  });
});
