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

// ---------------------------------------------------------------------------
// Glob pattern matching tests
// ---------------------------------------------------------------------------

describe("MCPToolFilter — glob pattern matching", () => {
  let filter: MCPToolFilter;

  /** Extended tool set for glob matching scenarios */
  const GLOB_TOOLS: readonly MCPToolDefinition[] = [
    makeTool("github_create_issue"),
    makeTool("github_list_issues"),
    makeTool("github_delete_repo"),
    makeTool("slack_send_message"),
    makeTool("slack_delete_channel"),
    makeTool("fs_read_file"),
    makeTool("fs_write_file"),
    makeTool("fs_delete_file"),
    makeTool("exact_name"),
  ];

  beforeEach(() => {
    filter = new MCPToolFilter();
  });

  // -------------------------------------------------------------------------
  // Prefix wildcard: "github_*"
  // -------------------------------------------------------------------------
  describe("prefix wildcard (github_*)", () => {
    it("should allow only tools starting with 'github_' when used as allowlist", () => {
      filter.setFilter("srv", { allowlist: ["github_*"] });
      const result = filter.filterTools("srv", GLOB_TOOLS);
      expect(result.map((t) => t.name)).toEqual([
        "github_create_issue",
        "github_list_issues",
        "github_delete_repo",
      ]);
    });

    it("should block all tools starting with 'github_' when used as denylist", () => {
      filter.setFilter("srv", { denylist: ["github_*"] });
      const result = filter.filterTools("srv", GLOB_TOOLS);
      expect(result.map((t) => t.name)).not.toContain("github_create_issue");
      expect(result.map((t) => t.name)).not.toContain("github_list_issues");
      expect(result.map((t) => t.name)).not.toContain("github_delete_repo");
      expect(result).toHaveLength(GLOB_TOOLS.length - 3);
    });
  });

  // -------------------------------------------------------------------------
  // Infix wildcard: "*_delete_*"
  // -------------------------------------------------------------------------
  describe("infix wildcard (*_delete_*)", () => {
    it("should match tool names containing '_delete_'", () => {
      filter.setFilter("srv", { denylist: ["*_delete_*"] });
      const result = filter.filterTools("srv", GLOB_TOOLS);
      // github_delete_repo does NOT contain "_delete_" as infix (no trailing underscore)
      // slack_delete_channel does NOT either — pattern is *_delete_* meaning delete must be surrounded by _
      // But fs_delete_file: fs _ delete _ file → matches
      expect(result.map((t) => t.name)).not.toContain("fs_delete_file");
    });

    it("should match tools with delete surrounded by underscores", () => {
      const tools = [
        makeTool("my_delete_op"),
        makeTool("delete_op"),
        makeTool("op_delete"),
        makeTool("op_delete_me"),
      ];
      filter.setFilter("srv", { allowlist: ["*_delete_*"] });
      const result = filter.filterTools("srv", tools);
      expect(result.map((t) => t.name)).toEqual(["my_delete_op", "op_delete_me"]);
    });
  });

  // -------------------------------------------------------------------------
  // Suffix wildcard: "*_file"
  // -------------------------------------------------------------------------
  describe("suffix wildcard (*_file)", () => {
    it("should allow only tools ending with '_file'", () => {
      filter.setFilter("srv", { allowlist: ["*_file"] });
      const result = filter.filterTools("srv", GLOB_TOOLS);
      expect(result.map((t) => t.name)).toEqual([
        "fs_read_file",
        "fs_write_file",
        "fs_delete_file",
      ]);
    });
  });

  // -------------------------------------------------------------------------
  // Universal wildcard: "*"
  // -------------------------------------------------------------------------
  describe("universal wildcard (*)", () => {
    it("should match all tools when '*' is in allowlist", () => {
      filter.setFilter("srv", { allowlist: ["*"] });
      const result = filter.filterTools("srv", GLOB_TOOLS);
      expect(result).toHaveLength(GLOB_TOOLS.length);
    });

    it("should block all tools when '*' is in denylist", () => {
      filter.setFilter("srv", { denylist: ["*"] });
      const result = filter.filterTools("srv", GLOB_TOOLS);
      expect(result).toHaveLength(0);
    });
  });

  // -------------------------------------------------------------------------
  // Exact match still works alongside glob patterns
  // -------------------------------------------------------------------------
  describe("exact match alongside glob", () => {
    it("should match exact tool name without wildcard", () => {
      filter.setFilter("srv", { allowlist: ["exact_name"] });
      const result = filter.filterTools("srv", GLOB_TOOLS);
      expect(result.map((t) => t.name)).toEqual(["exact_name"]);
    });

    it("should allow exact match combined with glob in allowlist", () => {
      filter.setFilter("srv", { allowlist: ["exact_name", "slack_*"] });
      const result = filter.filterTools("srv", GLOB_TOOLS);
      expect(result.map((t) => t.name)).toEqual([
        "slack_send_message",
        "slack_delete_channel",
        "exact_name",
      ]);
    });
  });

  // -------------------------------------------------------------------------
  // Deny-first evaluation order
  // -------------------------------------------------------------------------
  describe("deny-first evaluation order", () => {
    it("deny pattern should override allow pattern for the same tool", () => {
      // Allow all github tools, but deny the delete one specifically
      filter.setFilter("srv", {
        allowlist: ["github_*"],
        denylist: ["github_delete_repo"],
      });
      const result = filter.filterTools("srv", GLOB_TOOLS);
      expect(result.map((t) => t.name)).toEqual(["github_create_issue", "github_list_issues"]);
    });

    it("deny glob should take precedence over allow glob", () => {
      // Allow all fs tools, but deny all delete tools
      filter.setFilter("srv", {
        allowlist: ["fs_*"],
        denylist: ["*delete*"],
      });
      const result = filter.filterTools("srv", GLOB_TOOLS);
      expect(result.map((t) => t.name)).toEqual(["fs_read_file", "fs_write_file"]);
    });

    it("denylist only — no allowlist → only matching tools are blocked", () => {
      filter.setFilter("srv", { denylist: ["slack_*"] });
      const result = filter.filterTools("srv", GLOB_TOOLS);
      expect(result.map((t) => t.name)).not.toContain("slack_send_message");
      expect(result.map((t) => t.name)).not.toContain("slack_delete_channel");
      // All non-slack tools should pass through
      expect(result.map((t) => t.name)).toContain("github_create_issue");
    });

    it("allowlist only — tools not matching any pattern are blocked", () => {
      filter.setFilter("srv", { allowlist: ["fs_*"] });
      const result = filter.filterTools("srv", GLOB_TOOLS);
      expect(result).toHaveLength(3);
      expect(result.map((t) => t.name)).toEqual([
        "fs_read_file",
        "fs_write_file",
        "fs_delete_file",
      ]);
    });
  });

  // -------------------------------------------------------------------------
  // isToolAllowed with glob patterns
  // -------------------------------------------------------------------------
  describe("isToolAllowed with glob patterns", () => {
    it("should return true for tool matching glob allowlist pattern", () => {
      filter.setFilter("srv", { allowlist: ["github_*"] });
      expect(filter.isToolAllowed("srv", "github_create_issue")).toBe(true);
      expect(filter.isToolAllowed("srv", "github_delete_repo")).toBe(true);
    });

    it("should return false for tool not matching glob allowlist pattern", () => {
      filter.setFilter("srv", { allowlist: ["github_*"] });
      expect(filter.isToolAllowed("srv", "slack_send_message")).toBe(false);
    });

    it("should return false for tool matching glob denylist pattern", () => {
      filter.setFilter("srv", { denylist: ["*delete*"] });
      expect(filter.isToolAllowed("srv", "github_delete_repo")).toBe(false);
      expect(filter.isToolAllowed("srv", "fs_delete_file")).toBe(false);
    });

    it("should return true for tool NOT matching glob denylist pattern", () => {
      filter.setFilter("srv", { denylist: ["*delete*"] });
      expect(filter.isToolAllowed("srv", "github_create_issue")).toBe(true);
    });

    it("deny-first: returns false even if tool matches allowlist glob", () => {
      filter.setFilter("srv", {
        allowlist: ["github_*"],
        denylist: ["github_delete_*"],
      });
      expect(filter.isToolAllowed("srv", "github_delete_repo")).toBe(false);
      expect(filter.isToolAllowed("srv", "github_create_issue")).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // Empty filter → all tools pass
  // -------------------------------------------------------------------------
  describe("empty filter", () => {
    it("should pass all tools when no filter is registered for the server", () => {
      const result = filter.filterTools("no-filter-srv", GLOB_TOOLS);
      expect(result).toEqual(GLOB_TOOLS);
    });
  });

  // -------------------------------------------------------------------------
  // loadFromConfig with glob patterns
  // -------------------------------------------------------------------------
  describe("loadFromConfig with glob patterns", () => {
    it("should load glob patterns from allowedTools", () => {
      filter.loadFromConfig({
        "github-srv": { allowedTools: ["github_*", "exact_name"] },
      });
      expect(filter.getFilter("github-srv")).toEqual({
        allowlist: ["github_*", "exact_name"],
      });
    });

    it("should load glob patterns from blockedTools", () => {
      filter.loadFromConfig({
        "fs-srv": { blockedTools: ["*_delete_*", "*_write_*"] },
      });
      expect(filter.getFilter("fs-srv")).toEqual({
        denylist: ["*_delete_*", "*_write_*"],
      });
    });
  });
});
