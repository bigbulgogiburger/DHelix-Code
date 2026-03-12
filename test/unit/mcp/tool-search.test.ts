import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  MCPToolSearch,
  MCPToolSearchError,
  type ToolSearchableClient,
} from "../../../src/mcp/tool-search.js";
import { type MCPToolDefinition } from "../../../src/mcp/types.js";

/** Helper to create a mock MCP tool definition */
function createMockTool(
  name: string,
  description: string,
  properties: Record<string, unknown> = {},
): MCPToolDefinition {
  return {
    name,
    description,
    inputSchema: {
      type: "object",
      properties,
    },
  };
}

/** Helper to create a mock ToolSearchableClient */
function createMockClient(tools: readonly MCPToolDefinition[]): ToolSearchableClient {
  return {
    listTools: vi.fn().mockResolvedValue(tools),
  };
}

describe("MCPToolSearch", () => {
  let search: MCPToolSearch;

  beforeEach(() => {
    search = new MCPToolSearch();
  });

  describe("MCPToolSearchError", () => {
    it("should extend BaseError with correct code", () => {
      const error = new MCPToolSearchError("test error", { tool: "test" });
      expect(error.message).toBe("test error");
      expect(error.code).toBe("MCP_TOOL_SEARCH_ERROR");
      expect(error.context).toEqual({ tool: "test" });
      expect(error.name).toBe("MCPToolSearchError");
    });

    it("should default to empty context", () => {
      const error = new MCPToolSearchError("test error");
      expect(error.context).toEqual({});
    });
  });

  describe("registerDeferredTools", () => {
    it("should register tools from a client and return deferred entries", async () => {
      const tools = [
        createMockTool("read_file", "Read a file from disk"),
        createMockTool("write_file", "Write content to a file"),
      ];
      const client = createMockClient(tools);

      const result = await search.registerDeferredTools(client, "filesystem");

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        name: "read_file",
        namespacedName: "mcp__filesystem__read_file",
        description: "Read a file from disk",
        serverName: "filesystem",
      });
      expect(result[1]).toEqual({
        name: "write_file",
        namespacedName: "mcp__filesystem__write_file",
        description: "Write content to a file",
        serverName: "filesystem",
      });
    });

    it("should call client.listTools exactly once", async () => {
      const tools = [createMockTool("test_tool", "A test tool")];
      const client = createMockClient(tools);

      await search.registerDeferredTools(client, "test-server");

      expect(client.listTools).toHaveBeenCalledTimes(1);
    });

    it("should update size after registration", async () => {
      expect(search.size).toBe(0);

      const tools = [
        createMockTool("tool_a", "Tool A"),
        createMockTool("tool_b", "Tool B"),
        createMockTool("tool_c", "Tool C"),
      ];
      const client = createMockClient(tools);

      await search.registerDeferredTools(client, "server1");

      expect(search.size).toBe(3);
    });

    it("should handle empty tool list from client", async () => {
      const client = createMockClient([]);

      const result = await search.registerDeferredTools(client, "empty-server");

      expect(result).toHaveLength(0);
      expect(search.size).toBe(0);
    });

    it("should register tools from multiple servers", async () => {
      const client1 = createMockClient([createMockTool("tool_a", "Tool A")]);
      const client2 = createMockClient([createMockTool("tool_b", "Tool B")]);

      await search.registerDeferredTools(client1, "server1");
      await search.registerDeferredTools(client2, "server2");

      expect(search.size).toBe(2);
      expect(search.has("mcp__server1__tool_a")).toBe(true);
      expect(search.has("mcp__server2__tool_b")).toBe(true);
    });

    it("should overwrite tools from the same server on re-registration", async () => {
      const client1 = createMockClient([createMockTool("tool_a", "Original description")]);
      await search.registerDeferredTools(client1, "server1");

      const client2 = createMockClient([createMockTool("tool_a", "Updated description")]);
      await search.registerDeferredTools(client2, "server1");

      expect(search.size).toBe(1);
      const result = search.getToolDefinition("mcp__server1__tool_a");
      expect(result?.tool.description).toBe("Updated description");
    });
  });

  describe("search", () => {
    beforeEach(async () => {
      const tools = [
        createMockTool("read_file", "Read a file from disk"),
        createMockTool("write_file", "Write content to a file"),
        createMockTool("list_directory", "List files in a directory"),
        createMockTool("search_code", "Search code with regex patterns"),
        createMockTool("execute_command", "Execute a shell command"),
        createMockTool("git_status", "Show git repository status"),
        createMockTool("git_diff", "Show git diff output"),
      ];
      const client = createMockClient(tools);
      await search.registerDeferredTools(client, "dev-tools");
    });

    it("should return exact name match with score 1.0", () => {
      const results = search.search("read_file");

      expect(results.length).toBeGreaterThanOrEqual(1);
      expect(results[0].tool.name).toBe("read_file");
      expect(results[0].score).toBe(1.0);
    });

    it("should return partial name match", () => {
      const results = search.search("read");

      expect(results.length).toBeGreaterThanOrEqual(1);
      const readFileResult = results.find((r) => r.tool.name === "read_file");
      expect(readFileResult).toBeDefined();
      expect(readFileResult!.score).toBeGreaterThan(0);
    });

    it("should match against description", () => {
      const results = search.search("regex");

      expect(results.length).toBeGreaterThanOrEqual(1);
      const searchCodeResult = results.find((r) => r.tool.name === "search_code");
      expect(searchCodeResult).toBeDefined();
      expect(searchCodeResult!.score).toBeGreaterThan(0);
    });

    it("should return empty array for no match", () => {
      const results = search.search("nonexistent_xyz_12345");

      expect(results).toHaveLength(0);
    });

    it("should return empty array for empty query", () => {
      const results = search.search("");

      expect(results).toHaveLength(0);
    });

    it("should return empty array for whitespace-only query", () => {
      const results = search.search("   ");

      expect(results).toHaveLength(0);
    });

    it("should respect maxResults limit", () => {
      const results = search.search("file", 2);

      expect(results.length).toBeLessThanOrEqual(2);
    });

    it("should default maxResults to 5", () => {
      // Register many tools that match "tool"
      const manyTools = Array.from({ length: 10 }, (_, i) =>
        createMockTool(`tool_${i}`, `Tool number ${i}`),
      );
      const searchWithMany = new MCPToolSearch();
      const client = createMockClient(manyTools);

      // Use async IIFE to register then search
      return client.listTools().then(async () => {
        await searchWithMany.registerDeferredTools(client, "many");
        const results = searchWithMany.search("tool");
        expect(results.length).toBeLessThanOrEqual(5);
      });
    });

    it("should be case insensitive", () => {
      const results = search.search("READ_FILE");

      expect(results.length).toBeGreaterThanOrEqual(1);
      expect(results[0].tool.name).toBe("read_file");
      expect(results[0].score).toBe(1.0);
    });

    it("should sort results by score descending", () => {
      const results = search.search("git");

      expect(results.length).toBeGreaterThanOrEqual(2);
      for (let i = 1; i < results.length; i++) {
        expect(results[i - 1].score).toBeGreaterThanOrEqual(results[i].score);
      }
    });

    it("should include correct namespaced name and server name", () => {
      const results = search.search("read_file");

      expect(results[0].namespacedName).toBe("mcp__dev-tools__read_file");
      expect(results[0].serverName).toBe("dev-tools");
    });

    it("should handle select: syntax", () => {
      const results = search.search("select:read_file,write_file");

      expect(results).toHaveLength(2);
      const names = results.map((r) => r.tool.name);
      expect(names).toContain("read_file");
      expect(names).toContain("write_file");
    });

    it("should handle select: syntax with unknown names", () => {
      const results = search.search("select:read_file,nonexistent");

      expect(results).toHaveLength(1);
      expect(results[0].tool.name).toBe("read_file");
    });

    it("should match multiple git tools by word overlap", () => {
      const results = search.search("git");

      const gitTools = results.filter((r) => r.tool.name.startsWith("git_"));
      expect(gitTools.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe("getToolDefinition", () => {
    it("should return full tool definition for existing namespaced name", async () => {
      const tools = [createMockTool("read_file", "Read a file", { path: { type: "string" } })];
      const client = createMockClient(tools);
      await search.registerDeferredTools(client, "fs");

      const result = search.getToolDefinition("mcp__fs__read_file");

      expect(result).toBeDefined();
      expect(result!.tool.name).toBe("read_file");
      expect(result!.tool.description).toBe("Read a file");
      expect(result!.tool.inputSchema).toEqual({
        type: "object",
        properties: { path: { type: "string" } },
      });
      expect(result!.serverName).toBe("fs");
      expect(result!.namespacedName).toBe("mcp__fs__read_file");
      expect(result!.score).toBe(1.0);
    });

    it("should return undefined for non-existent tool", () => {
      const result = search.getToolDefinition("mcp__fs__nonexistent");

      expect(result).toBeUndefined();
    });

    it("should return undefined for empty string", () => {
      const result = search.getToolDefinition("");

      expect(result).toBeUndefined();
    });
  });

  describe("resolveByNames", () => {
    beforeEach(async () => {
      const tools = [
        createMockTool("tool_alpha", "Alpha tool"),
        createMockTool("tool_beta", "Beta tool"),
        createMockTool("tool_gamma", "Gamma tool"),
      ];
      const client = createMockClient(tools);
      await search.registerDeferredTools(client, "greek");
    });

    it("should resolve a single tool by plain name", () => {
      const results = search.resolveByNames(["tool_alpha"]);

      expect(results).toHaveLength(1);
      expect(results[0].tool.name).toBe("tool_alpha");
      expect(results[0].score).toBe(1.0);
    });

    it("should resolve multiple tools by plain name", () => {
      const results = search.resolveByNames(["tool_alpha", "tool_beta"]);

      expect(results).toHaveLength(2);
      const names = results.map((r) => r.tool.name);
      expect(names).toContain("tool_alpha");
      expect(names).toContain("tool_beta");
    });

    it("should resolve by namespaced name", () => {
      const results = search.resolveByNames(["mcp__greek__tool_gamma"]);

      expect(results).toHaveLength(1);
      expect(results[0].tool.name).toBe("tool_gamma");
      expect(results[0].namespacedName).toBe("mcp__greek__tool_gamma");
    });

    it("should skip unknown names silently", () => {
      const results = search.resolveByNames(["tool_alpha", "unknown_tool", "tool_beta"]);

      expect(results).toHaveLength(2);
    });

    it("should skip empty and whitespace-only names", () => {
      const results = search.resolveByNames(["tool_alpha", "", "  ", "tool_beta"]);

      expect(results).toHaveLength(2);
    });

    it("should return empty array for all unknown names", () => {
      const results = search.resolveByNames(["unknown1", "unknown2"]);

      expect(results).toHaveLength(0);
    });

    it("should return empty array for empty input", () => {
      const results = search.resolveByNames([]);

      expect(results).toHaveLength(0);
    });

    it("should find tools from same name across multiple servers", async () => {
      const client2 = createMockClient([createMockTool("tool_alpha", "Alpha from server2")]);
      await search.registerDeferredTools(client2, "other");

      const results = search.resolveByNames(["tool_alpha"]);

      // Should find from both servers
      expect(results.length).toBeGreaterThanOrEqual(2);
      const servers = results.map((r) => r.serverName);
      expect(servers).toContain("greek");
      expect(servers).toContain("other");
    });
  });

  describe("generateDeferredToolsSummary", () => {
    it("should return empty string when no tools registered", () => {
      const summary = search.generateDeferredToolsSummary();

      expect(summary).toBe("");
    });

    it("should generate XML-wrapped summary with namespaced names", async () => {
      const tools = [
        createMockTool("read_file", "Read a file"),
        createMockTool("write_file", "Write a file"),
      ];
      const client = createMockClient(tools);
      await search.registerDeferredTools(client, "fs");

      const summary = search.generateDeferredToolsSummary();

      expect(summary).toContain("<available-deferred-tools>");
      expect(summary).toContain("</available-deferred-tools>");
      expect(summary).toContain("mcp__fs__read_file");
      expect(summary).toContain("mcp__fs__write_file");
    });

    it("should group tools by server", async () => {
      const client1 = createMockClient([createMockTool("tool_a", "Tool A")]);
      const client2 = createMockClient([createMockTool("tool_b", "Tool B")]);
      await search.registerDeferredTools(client1, "server1");
      await search.registerDeferredTools(client2, "server2");

      const summary = search.generateDeferredToolsSummary();

      expect(summary).toContain("mcp__server1__tool_a");
      expect(summary).toContain("mcp__server2__tool_b");
    });
  });

  describe("estimateTokens", () => {
    it("should return 0 for empty tool set", () => {
      expect(search.estimateTokens()).toBe(0);
    });

    it("should estimate tokens based on summary length", async () => {
      const tools = [
        createMockTool("read_file", "Read a file from disk"),
        createMockTool("write_file", "Write content to a file"),
      ];
      const client = createMockClient(tools);
      await search.registerDeferredTools(client, "fs");

      const tokens = search.estimateTokens();
      const summary = search.generateDeferredToolsSummary();

      // Should be approximately summary.length / 4, rounded up
      expect(tokens).toBe(Math.ceil(summary.length / 4));
      expect(tokens).toBeGreaterThan(0);
    });
  });

  describe("has", () => {
    it("should return false for non-existent tool", () => {
      expect(search.has("mcp__server__nonexistent")).toBe(false);
    });

    it("should return true for registered tool", async () => {
      const client = createMockClient([createMockTool("test", "Test tool")]);
      await search.registerDeferredTools(client, "server");

      expect(search.has("mcp__server__test")).toBe(true);
    });

    it("should return false for plain name (requires namespaced)", async () => {
      const client = createMockClient([createMockTool("test", "Test tool")]);
      await search.registerDeferredTools(client, "server");

      expect(search.has("test")).toBe(false);
    });
  });

  describe("size", () => {
    it("should return 0 initially", () => {
      expect(search.size).toBe(0);
    });

    it("should reflect total registered tools", async () => {
      const client = createMockClient([createMockTool("a", "A"), createMockTool("b", "B")]);
      await search.registerDeferredTools(client, "s");

      expect(search.size).toBe(2);
    });
  });

  describe("clear", () => {
    it("should remove all deferred tools", async () => {
      const client = createMockClient([
        createMockTool("tool_a", "Tool A"),
        createMockTool("tool_b", "Tool B"),
      ]);
      await search.registerDeferredTools(client, "server");

      expect(search.size).toBe(2);

      search.clear();

      expect(search.size).toBe(0);
      expect(search.has("mcp__server__tool_a")).toBe(false);
      expect(search.has("mcp__server__tool_b")).toBe(false);
    });

    it("should also clear the full tool cache", async () => {
      const client = createMockClient([createMockTool("tool", "A tool")]);
      await search.registerDeferredTools(client, "server");

      search.clear();

      const result = search.getToolDefinition("mcp__server__tool");
      expect(result).toBeUndefined();
    });

    it("should allow re-registration after clear", async () => {
      const client1 = createMockClient([createMockTool("old", "Old tool")]);
      await search.registerDeferredTools(client1, "server");

      search.clear();

      const client2 = createMockClient([createMockTool("new", "New tool")]);
      await search.registerDeferredTools(client2, "server");

      expect(search.size).toBe(1);
      expect(search.has("mcp__server__new")).toBe(true);
      expect(search.has("mcp__server__old")).toBe(false);
    });
  });

  describe("relevance scoring (via search result ordering)", () => {
    it("should rank exact name match above partial match", async () => {
      const tools = [
        createMockTool("file_reader", "A file reading utility"),
        createMockTool("file", "Generic file operations"),
      ];
      const client = createMockClient(tools);
      await search.registerDeferredTools(client, "s");

      const results = search.search("file");

      expect(results.length).toBeGreaterThanOrEqual(2);
      // Exact match "file" should be first
      expect(results[0].tool.name).toBe("file");
      expect(results[0].score).toBe(1.0);
    });

    it("should rank name match above description-only match", async () => {
      const tools = [
        createMockTool("unrelated_name", "Searches for files on disk"),
        createMockTool("search_tool", "Find items by criteria"),
      ];
      const client = createMockClient(tools);
      await search.registerDeferredTools(client, "s");

      const results = search.search("search");

      expect(results.length).toBeGreaterThanOrEqual(2);
      // Name contains "search" should rank higher than description containing "search"
      const searchToolResult = results.find((r) => r.tool.name === "search_tool");
      const unrelatedResult = results.find((r) => r.tool.name === "unrelated_name");
      expect(searchToolResult!.score).toBeGreaterThan(unrelatedResult!.score);
    });

    it("should give score 0 for completely unrelated query", async () => {
      const tools = [createMockTool("alpha", "Does alpha things")];
      const client = createMockClient(tools);
      await search.registerDeferredTools(client, "s");

      const results = search.search("zzzzz_no_match_here");

      expect(results).toHaveLength(0);
    });
  });
});
