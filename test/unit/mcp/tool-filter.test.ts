import { describe, it, expect, beforeEach } from "vitest";
import {
  MCPToolFilter,
  MCPToolFilterError,
  type MCPToolFilterConfig,
} from "../../../src/mcp/tool-filter.js";
import { type MCPToolDefinition } from "../../../src/mcp/types.js";

/** Helper to create a mock tool definition */
function makeTool(name: string): MCPToolDefinition {
  return {
    name,
    description: `Tool: ${name}`,
    inputSchema: { type: "object", properties: {} },
  };
}

const TOOLS: readonly MCPToolDefinition[] = [
  makeTool("read"),
  makeTool("write"),
  makeTool("delete"),
  makeTool("list"),
  makeTool("search"),
];

describe("MCPToolFilter", () => {
  let filter: MCPToolFilter;

  beforeEach(() => {
    filter = new MCPToolFilter();
  });

  describe("setFilter / getFilter", () => {
    it("should store and retrieve a filter config", () => {
      const config: MCPToolFilterConfig = { allowlist: ["read", "write"] };
      filter.setFilter("server-a", config);
      expect(filter.getFilter("server-a")).toEqual(config);
    });

    it("should return undefined for unknown server", () => {
      expect(filter.getFilter("unknown")).toBeUndefined();
    });

    it("should overwrite existing filter", () => {
      filter.setFilter("server-a", { allowlist: ["read"] });
      filter.setFilter("server-a", { denylist: ["delete"] });
      expect(filter.getFilter("server-a")).toEqual({ denylist: ["delete"] });
    });

    it("should throw when allowlist and denylist overlap", () => {
      expect(() =>
        filter.setFilter("server-a", {
          allowlist: ["read", "write"],
          denylist: ["write", "delete"],
        }),
      ).toThrow(MCPToolFilterError);
    });
  });

  describe("filterTools", () => {
    it("should pass through all tools when no filter is set", () => {
      const result = filter.filterTools("unfiltered-server", TOOLS);
      expect(result).toEqual(TOOLS);
    });

    it("should filter with allowlist only", () => {
      filter.setFilter("server-a", { allowlist: ["read", "list"] });
      const result = filter.filterTools("server-a", TOOLS);
      expect(result).toHaveLength(2);
      expect(result.map((t) => t.name)).toEqual(["read", "list"]);
    });

    it("should filter with denylist only", () => {
      filter.setFilter("server-b", { denylist: ["delete", "write"] });
      const result = filter.filterTools("server-b", TOOLS);
      expect(result).toHaveLength(3);
      expect(result.map((t) => t.name)).toEqual(["read", "list", "search"]);
    });

    it("should apply allowlist first, then denylist when both are set", () => {
      // Allowlist keeps read, write, list, search (removes delete)
      // Denylist then removes search from the allowed set
      // Net effect: read, write, list survive
      filter.setFilter("server-c", {
        allowlist: ["read", "write", "list", "search"],
        denylist: ["delete"],
      });
      const result = filter.filterTools("server-c", TOOLS);
      // delete was not in the allowlist, so already excluded
      // denylist removes delete (no-op since already excluded)
      // Result: read, write, list, search
      expect(result).toHaveLength(4);
      expect(result.map((t) => t.name)).toEqual(["read", "write", "list", "search"]);
    });

    it("should handle empty tools array", () => {
      filter.setFilter("server-d", { allowlist: ["read"] });
      const result = filter.filterTools("server-d", []);
      expect(result).toHaveLength(0);
    });

    it("should handle allowlist with no matching tools", () => {
      filter.setFilter("server-e", { allowlist: ["nonexistent"] });
      const result = filter.filterTools("server-e", TOOLS);
      expect(result).toHaveLength(0);
    });

    it("should handle denylist with no matching tools", () => {
      filter.setFilter("server-f", { denylist: ["nonexistent"] });
      const result = filter.filterTools("server-f", TOOLS);
      expect(result).toHaveLength(5);
    });

    it("should not mutate the original tools array", () => {
      const originalTools = [...TOOLS];
      filter.setFilter("server-g", { denylist: ["delete"] });
      filter.filterTools("server-g", TOOLS);
      expect(TOOLS).toEqual(originalTools);
    });
  });

  describe("isToolAllowed", () => {
    it("should return true when no filter is set", () => {
      expect(filter.isToolAllowed("any-server", "any-tool")).toBe(true);
    });

    it("should return true for tool in allowlist", () => {
      filter.setFilter("server-a", { allowlist: ["read", "write"] });
      expect(filter.isToolAllowed("server-a", "read")).toBe(true);
    });

    it("should return false for tool not in allowlist", () => {
      filter.setFilter("server-a", { allowlist: ["read", "write"] });
      expect(filter.isToolAllowed("server-a", "delete")).toBe(false);
    });

    it("should return false for tool in denylist", () => {
      filter.setFilter("server-b", { denylist: ["delete"] });
      expect(filter.isToolAllowed("server-b", "delete")).toBe(false);
    });

    it("should return true for tool not in denylist", () => {
      filter.setFilter("server-b", { denylist: ["delete"] });
      expect(filter.isToolAllowed("server-b", "read")).toBe(true);
    });
  });

  describe("removeFilter / clear", () => {
    it("should remove a specific filter", () => {
      filter.setFilter("server-a", { allowlist: ["read"] });
      filter.setFilter("server-b", { denylist: ["write"] });
      filter.removeFilter("server-a");

      expect(filter.getFilter("server-a")).toBeUndefined();
      expect(filter.getFilter("server-b")).toEqual({ denylist: ["write"] });
    });

    it("should clear all filters", () => {
      filter.setFilter("server-a", { allowlist: ["read"] });
      filter.setFilter("server-b", { denylist: ["write"] });
      filter.clear();

      expect(filter.getFilter("server-a")).toBeUndefined();
      expect(filter.getFilter("server-b")).toBeUndefined();
    });
  });

  describe("loadFromConfig", () => {
    it("should load allowlist from allowedTools", () => {
      filter.loadFromConfig({
        "server-a": { allowedTools: ["read", "write"] },
      });

      expect(filter.getFilter("server-a")).toEqual({
        allowlist: ["read", "write"],
      });
    });

    it("should load denylist from blockedTools", () => {
      filter.loadFromConfig({
        "server-b": { blockedTools: ["delete"] },
      });

      expect(filter.getFilter("server-b")).toEqual({
        denylist: ["delete"],
      });
    });

    it("should load both allowedTools and blockedTools", () => {
      filter.loadFromConfig({
        "server-c": {
          allowedTools: ["read", "write"],
          blockedTools: ["delete"],
        },
      });

      const config = filter.getFilter("server-c");
      expect(config?.allowlist).toEqual(["read", "write"]);
      expect(config?.denylist).toEqual(["delete"]);
    });

    it("should skip servers with no filter config", () => {
      filter.loadFromConfig({
        "server-d": {},
      });

      expect(filter.getFilter("server-d")).toBeUndefined();
    });

    it("should load multiple servers", () => {
      filter.loadFromConfig({
        "server-a": { allowedTools: ["read"] },
        "server-b": { blockedTools: ["write"] },
        "server-c": {},
      });

      expect(filter.getFilter("server-a")).toEqual({ allowlist: ["read"] });
      expect(filter.getFilter("server-b")).toEqual({ denylist: ["write"] });
      expect(filter.getFilter("server-c")).toBeUndefined();
    });
  });
});

describe("MCPToolFilterError", () => {
  it("should have the correct error code and context", () => {
    const error = new MCPToolFilterError("test error", { server: "s1" });
    expect(error).toBeInstanceOf(Error);
    expect(error.code).toBe("MCP_TOOL_FILTER_ERROR");
    expect(error.message).toBe("test error");
    expect(error.context).toEqual({ server: "s1" });
  });
});
