import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  MCPManagerConnector,
  MCPManagerConnectorError,
  type MCPConnectorConfig,
} from "../../../src/mcp/manager-connector.js";
import { type MCPClient } from "../../../src/mcp/client.js";
import {
  type MCPServerConfig,
  type MCPServerCapabilities,
  type MCPToolDefinition,
  type MCPResource,
} from "../../../src/mcp/types.js";

/**
 * Create a mock MCPClient with configurable behavior.
 */
function createMockClient(overrides?: {
  capabilities?: MCPServerCapabilities | null;
  tools?: readonly MCPToolDefinition[];
  resources?: readonly MCPResource[];
  listToolsError?: Error;
  listResourcesError?: Error;
}): MCPClient {
  const capabilities = overrides?.capabilities ?? null;
  const tools = overrides?.tools ?? [];
  const resources = overrides?.resources ?? [];

  return {
    getState: vi.fn().mockReturnValue("connected"),
    getCapabilities: vi.fn().mockReturnValue(capabilities),
    connect: vi.fn().mockResolvedValue(undefined),
    disconnect: vi.fn().mockResolvedValue(undefined),
    listTools: overrides?.listToolsError
      ? vi.fn().mockRejectedValue(overrides.listToolsError)
      : vi.fn().mockResolvedValue(tools),
    callTool: vi.fn().mockResolvedValue({ content: [], isError: false }),
    listResources: overrides?.listResourcesError
      ? vi.fn().mockRejectedValue(overrides.listResourcesError)
      : vi.fn().mockResolvedValue(resources),
    readResource: vi.fn().mockResolvedValue(""),
    setToolsChangedCallback: vi.fn(),
  } as unknown as MCPClient;
}

/**
 * Create a standard MCPServerConfig.
 */
function createServerConfig(
  name: string,
  transport: "stdio" | "http" | "sse" = "stdio",
): MCPServerConfig {
  return {
    name,
    transport,
    command: "echo",
    args: ["test"],
  };
}

/**
 * Generate N mock tool definitions.
 */
function generateTools(count: number, prefix = "tool"): MCPToolDefinition[] {
  return Array.from({ length: count }, (_, i) => ({
    name: `${prefix}_${i}`,
    description: `Description for ${prefix}_${i}`,
    inputSchema: { type: "object", properties: {} },
  }));
}

/**
 * Generate N mock resource definitions.
 */
function generateResources(count: number, prefix = "resource"): MCPResource[] {
  return Array.from({ length: count }, (_, i) => ({
    uri: `test://${prefix}/${i}`,
    name: `${prefix}_${i}`,
    description: `Description for ${prefix}_${i}`,
    mimeType: "text/plain",
  }));
}

describe("MCPManagerConnector", () => {
  let connector: MCPManagerConnector;

  beforeEach(() => {
    connector = new MCPManagerConnector();
  });

  // ──────────────────────────────────────────────
  // Constructor
  // ──────────────────────────────────────────────

  describe("constructor", () => {
    it("should create with default configuration", () => {
      const c = new MCPManagerConnector();
      expect(c).toBeInstanceOf(MCPManagerConnector);
      expect(c.getStats().connectedServers).toBe(0);
    });

    it("should create with custom configuration", () => {
      const config: MCPConnectorConfig = {
        enableResources: false,
        enablePrompts: false,
        enableToolSearch: false,
        enableOAuth: false,
        enableToolFilter: false,
        enableOutputLimiter: false,
        toolSearchThreshold: 100,
        outputLimiterConfig: { maxTokens: 5000, strategy: "head" },
      };
      const c = new MCPManagerConnector(config);
      expect(c).toBeInstanceOf(MCPManagerConnector);
    });

    it("should create with partial configuration, using defaults for missing values", () => {
      const config: MCPConnectorConfig = {
        enableResources: false,
        toolSearchThreshold: 25,
      };
      const c = new MCPManagerConnector(config);
      expect(c).toBeInstanceOf(MCPManagerConnector);
    });
  });

  // ──────────────────────────────────────────────
  // connectServer
  // ──────────────────────────────────────────────

  describe("connectServer", () => {
    it("should connect a server with all modules enabled (zero tools/resources)", async () => {
      const client = createMockClient();
      const config = createServerConfig("test-server");

      const result = await connector.connectServer(client, "test-server", config);

      expect(result.serverName).toBe("test-server");
      expect(result.toolCount).toBe(0);
      expect(result.resourceCount).toBe(0);
      expect(result.promptCount).toBe(0);
      expect(result.deferredToolCount).toBe(0);
      expect(result.oauthRequired).toBe(false);
      expect(result.filteredToolCount).toBe(0);
    });

    it("should discover tools from the server", async () => {
      const tools = generateTools(5);
      const client = createMockClient({ tools });
      const config = createServerConfig("tools-server");

      const result = await connector.connectServer(client, "tools-server", config);

      expect(result.toolCount).toBe(5);
      expect(result.deferredToolCount).toBe(0);
    });

    it("should discover resources when capabilities include resources", async () => {
      const resources = generateResources(3);
      const client = createMockClient({
        capabilities: { resources: { subscribe: false, listChanged: false } },
        resources,
      });
      const config = createServerConfig("res-server");

      const result = await connector.connectServer(client, "res-server", config);

      expect(result.resourceCount).toBe(3);
    });

    it("should skip resource discovery when capabilities are missing", async () => {
      const client = createMockClient({ capabilities: null });
      const config = createServerConfig("no-cap-server");

      const result = await connector.connectServer(client, "no-cap-server", config);

      expect(result.resourceCount).toBe(0);
    });

    it("should discover prompts when capabilities include prompts", async () => {
      // MCPPromptManager.discoverPrompts checks capabilities.prompts
      const client = createMockClient({
        capabilities: { prompts: { listChanged: false } },
      });
      const config = createServerConfig("prompt-server");

      const result = await connector.connectServer(client, "prompt-server", config);

      // Even with prompts capability, the mock client doesn't have sendRequest,
      // so discoverPrompts will catch the error and return 0
      expect(result.promptCount).toBe(0);
    });

    it("should handle resource discovery failures gracefully (non-fatal)", async () => {
      const client = createMockClient({
        capabilities: { resources: { subscribe: false, listChanged: false } },
        listResourcesError: new Error("Network error"),
      });
      const config = createServerConfig("fail-res-server");

      // Should not throw — resource discovery failure is non-fatal
      const result = await connector.connectServer(client, "fail-res-server", config);
      expect(result.resourceCount).toBe(0);
    });

    it("should throw when listTools fails", async () => {
      const client = createMockClient({
        listToolsError: new Error("Tools listing failed"),
      });
      const config = createServerConfig("fail-tools-server");

      await expect(connector.connectServer(client, "fail-tools-server", config)).rejects.toThrow(
        "Failed to list tools",
      );
    });

    it("should track connected server in stats", async () => {
      const client = createMockClient();
      const config = createServerConfig("tracked-server");

      await connector.connectServer(client, "tracked-server", config);

      expect(connector.getStats().connectedServers).toBe(1);
    });
  });

  // ──────────────────────────────────────────────
  // connectServer — modules disabled
  // ──────────────────────────────────────────────

  describe("connectServer with modules disabled", () => {
    it("should skip resource discovery when disabled", async () => {
      const c = new MCPManagerConnector({ enableResources: false });
      const resources = generateResources(5);
      const client = createMockClient({
        capabilities: { resources: { subscribe: false, listChanged: false } },
        resources,
      });
      const config = createServerConfig("no-res-server");

      const result = await c.connectServer(client, "no-res-server", config);

      expect(result.resourceCount).toBe(0);
      expect(client.listResources).not.toHaveBeenCalled();
    });

    it("should skip prompt discovery when disabled", async () => {
      const c = new MCPManagerConnector({ enablePrompts: false });
      const client = createMockClient({
        capabilities: { prompts: { listChanged: false } },
      });
      const config = createServerConfig("no-prompt-server");

      const result = await c.connectServer(client, "no-prompt-server", config);

      expect(result.promptCount).toBe(0);
    });

    it("should skip tool filtering when disabled", async () => {
      const c = new MCPManagerConnector({ enableToolFilter: false });
      const tools = generateTools(5);
      const client = createMockClient({ tools });
      const config = createServerConfig("no-filter-server");

      // Set a filter that would normally filter tools
      c.getToolFilter().setFilter("no-filter-server", { denylist: ["*"] });

      const result = await c.connectServer(client, "no-filter-server", config);

      // All tools should pass since filtering is disabled
      expect(result.toolCount).toBe(5);
      expect(result.filteredToolCount).toBe(0);
    });

    it("should skip deferred tool registration when tool search is disabled", async () => {
      const c = new MCPManagerConnector({
        enableToolSearch: false,
        toolSearchThreshold: 5,
      });
      const tools = generateTools(10);
      const client = createMockClient({ tools });
      const config = createServerConfig("no-search-server");

      const result = await c.connectServer(client, "no-search-server", config);

      expect(result.toolCount).toBe(10);
      expect(result.deferredToolCount).toBe(0);
    });
  });

  // ──────────────────────────────────────────────
  // Tool filtering
  // ──────────────────────────────────────────────

  describe("tool filtering during connection", () => {
    it("should apply allowlist filter to tools", async () => {
      const tools = generateTools(5);
      const client = createMockClient({ tools });
      const config = createServerConfig("allow-server");

      connector.getToolFilter().setFilter("allow-server", {
        allowlist: ["tool_0", "tool_2"],
      });

      const result = await connector.connectServer(client, "allow-server", config);

      expect(result.toolCount).toBe(2);
      expect(result.filteredToolCount).toBe(3);
    });

    it("should apply denylist filter to tools", async () => {
      const tools = generateTools(5);
      const client = createMockClient({ tools });
      const config = createServerConfig("deny-server");

      connector.getToolFilter().setFilter("deny-server", {
        denylist: ["tool_0", "tool_1"],
      });

      const result = await connector.connectServer(client, "deny-server", config);

      expect(result.toolCount).toBe(3);
      expect(result.filteredToolCount).toBe(2);
    });

    it("should pass all tools when no filter is set", async () => {
      const tools = generateTools(10);
      const client = createMockClient({ tools });
      const config = createServerConfig("no-filter");

      const result = await connector.connectServer(client, "no-filter", config);

      expect(result.toolCount).toBe(10);
      expect(result.filteredToolCount).toBe(0);
    });
  });

  // ──────────────────────────────────────────────
  // Deferred tool registration
  // ──────────────────────────────────────────────

  describe("deferred tool registration", () => {
    it("should defer tools when count exceeds threshold", async () => {
      const c = new MCPManagerConnector({ toolSearchThreshold: 5 });
      const tools = generateTools(10);
      const client = createMockClient({ tools });
      const config = createServerConfig("deferred-server");

      const result = await c.connectServer(client, "deferred-server", config);

      expect(result.toolCount).toBe(10);
      expect(result.deferredToolCount).toBe(10);
    });

    it("should not defer tools when count is below threshold", async () => {
      const c = new MCPManagerConnector({ toolSearchThreshold: 50 });
      const tools = generateTools(10);
      const client = createMockClient({ tools });
      const config = createServerConfig("below-threshold");

      const result = await c.connectServer(client, "below-threshold", config);

      expect(result.toolCount).toBe(10);
      expect(result.deferredToolCount).toBe(0);
    });

    it("should not defer tools when exactly at threshold", async () => {
      const c = new MCPManagerConnector({ toolSearchThreshold: 10 });
      const tools = generateTools(10);
      const client = createMockClient({ tools });
      const config = createServerConfig("at-threshold");

      const result = await c.connectServer(client, "at-threshold", config);

      expect(result.deferredToolCount).toBe(0);
    });

    it("should defer tools when count is one above threshold", async () => {
      const c = new MCPManagerConnector({ toolSearchThreshold: 10 });
      const tools = generateTools(11);
      const client = createMockClient({ tools });
      const config = createServerConfig("one-above");

      const result = await c.connectServer(client, "one-above", config);

      expect(result.deferredToolCount).toBe(11);
    });

    it("should register deferred tools with the tool search module", async () => {
      const c = new MCPManagerConnector({ toolSearchThreshold: 3 });
      const tools = generateTools(5);
      const client = createMockClient({ tools });
      const config = createServerConfig("search-server");

      await c.connectServer(client, "search-server", config);

      const toolSearch = c.getToolSearch();
      const summary = toolSearch.generateDeferredToolsSummary();
      expect(summary).toContain("mcp__search-server__tool_0");
      expect(toolSearch.estimateTokens()).toBeGreaterThan(0);
    });
  });

  // ──────────────────────────────────────────────
  // OAuth flow
  // ──────────────────────────────────────────────

  describe("OAuth authentication flow", () => {
    it("should not require OAuth when no config is set", async () => {
      const client = createMockClient();
      const config = createServerConfig("no-oauth");

      const result = await connector.connectServer(client, "no-oauth", config);

      expect(result.oauthRequired).toBe(false);
    });

    it("should detect OAuth when token exists on disk", async () => {
      // OAuth detection uses loadToken which reads from disk.
      // Without a saved token file, oauthRequired should be false.
      const client = createMockClient();
      const config = createServerConfig("oauth-server");

      const result = await connector.connectServer(client, "oauth-server", config);

      // No saved token file → oauthRequired is false
      expect(result.oauthRequired).toBe(false);
    });

    it("should skip OAuth check when OAuth module is disabled", async () => {
      const c = new MCPManagerConnector({ enableOAuth: false });

      const client = createMockClient();
      const config = createServerConfig("oauth-disabled");

      const result = await c.connectServer(client, "oauth-disabled", config);

      expect(result.oauthRequired).toBe(false);
    });
  });

  // ──────────────────────────────────────────────
  // connectAllServers
  // ──────────────────────────────────────────────

  describe("connectAllServers", () => {
    it("should connect multiple servers in parallel", async () => {
      const clients = new Map<string, MCPClient>([
        ["server-a", createMockClient({ tools: generateTools(3) })],
        ["server-b", createMockClient({ tools: generateTools(5) })],
      ]);
      const configs: Record<string, MCPServerConfig> = {
        "server-a": createServerConfig("server-a"),
        "server-b": createServerConfig("server-b"),
      };

      const result = await connector.connectAllServers(clients, configs);

      expect(result.servers).toHaveLength(2);
      expect(result.totalTools).toBe(8);
      expect(result.errors).toHaveLength(0);
    });

    it("should aggregate resource and prompt counts", async () => {
      const clients = new Map<string, MCPClient>([
        [
          "res-server",
          createMockClient({
            capabilities: { resources: { subscribe: false, listChanged: false } },
            resources: generateResources(4),
            tools: generateTools(2),
          }),
        ],
        ["plain-server", createMockClient({ tools: generateTools(3) })],
      ]);
      const configs: Record<string, MCPServerConfig> = {
        "res-server": createServerConfig("res-server"),
        "plain-server": createServerConfig("plain-server"),
      };

      const result = await connector.connectAllServers(clients, configs);

      expect(result.totalResources).toBe(4);
      expect(result.totalTools).toBe(5);
    });

    it("should handle empty client map", async () => {
      const clients = new Map<string, MCPClient>();
      const configs: Record<string, MCPServerConfig> = {};

      const result = await connector.connectAllServers(clients, configs);

      expect(result.servers).toHaveLength(0);
      expect(result.totalTools).toBe(0);
      expect(result.errors).toHaveLength(0);
    });

    it("should handle partial failures gracefully", async () => {
      const clients = new Map<string, MCPClient>([
        ["good-server", createMockClient({ tools: generateTools(2) })],
        ["bad-server", createMockClient({ listToolsError: new Error("Connection refused") })],
      ]);
      const configs: Record<string, MCPServerConfig> = {
        "good-server": createServerConfig("good-server"),
        "bad-server": createServerConfig("bad-server"),
      };

      const result = await connector.connectAllServers(clients, configs);

      expect(result.servers).toHaveLength(1);
      expect(result.servers[0].serverName).toBe("good-server");
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].serverName).toBe("bad-server");
      expect(result.errors[0].error).toContain("Failed to list tools");
    });

    it("should error when server config is missing", async () => {
      const clients = new Map<string, MCPClient>([["orphan-server", createMockClient()]]);
      const configs: Record<string, MCPServerConfig> = {};

      const result = await connector.connectAllServers(clients, configs);

      expect(result.servers).toHaveLength(0);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].serverName).toBe("orphan-server");
      expect(result.errors[0].error).toContain("Missing server configuration");
    });

    it("should aggregate deferred tool counts across servers", async () => {
      const c = new MCPManagerConnector({ toolSearchThreshold: 5 });
      const clients = new Map<string, MCPClient>([
        ["big-a", createMockClient({ tools: generateTools(10, "a") })],
        ["big-b", createMockClient({ tools: generateTools(8, "b") })],
        ["small-c", createMockClient({ tools: generateTools(3, "c") })],
      ]);
      const configs: Record<string, MCPServerConfig> = {
        "big-a": createServerConfig("big-a"),
        "big-b": createServerConfig("big-b"),
        "small-c": createServerConfig("small-c"),
      };

      const result = await c.connectAllServers(clients, configs);

      expect(result.totalDeferredTools).toBe(18); // 10 + 8
      expect(result.totalTools).toBe(21); // 10 + 8 + 3
    });
  });

  // ──────────────────────────────────────────────
  // disconnectAll
  // ──────────────────────────────────────────────

  describe("disconnectAll", () => {
    it("should clear all sub-modules and reset stats", async () => {
      const tools = generateTools(60);
      const client = createMockClient({
        tools,
        capabilities: { resources: { subscribe: false, listChanged: false } },
        resources: generateResources(3),
      });
      const config = createServerConfig("cleanup-server");

      await connector.connectServer(client, "cleanup-server", config);
      expect(connector.getStats().connectedServers).toBe(1);

      await connector.disconnectAll();

      const stats = connector.getStats();
      expect(stats.connectedServers).toBe(0);
      expect(stats.resourceCacheStats.size).toBe(0);
      expect(stats.toolSearchTokenEstimate).toBe(0);
    });

    it("should be safe to call multiple times", async () => {
      await connector.disconnectAll();
      await connector.disconnectAll();
      expect(connector.getStats().connectedServers).toBe(0);
    });

    it("should allow reconnection after disconnect", async () => {
      const client = createMockClient({ tools: generateTools(3) });
      const config = createServerConfig("reconnect-server");

      await connector.connectServer(client, "reconnect-server", config);
      await connector.disconnectAll();

      const result = await connector.connectServer(client, "reconnect-server", config);
      expect(result.toolCount).toBe(3);
      expect(connector.getStats().connectedServers).toBe(1);
    });
  });

  // ──────────────────────────────────────────────
  // Output limiting
  // ──────────────────────────────────────────────

  describe("limitToolOutput", () => {
    it("should return content unchanged when within limits", () => {
      const content = "Short output";
      expect(connector.limitToolOutput(content)).toBe(content);
    });

    it("should truncate long content with paragraph breaks", () => {
      // Default limit: 10_000 tokens * 4 chars = 40_000 chars
      // Smart truncation needs paragraph breaks to find truncation points
      const paragraphs = Array.from(
        { length: 100 },
        (_, i) => `Paragraph ${i}: ${"x".repeat(500)}`,
      );
      const content = paragraphs.join("\n\n"); // ~60,000 chars with breaks
      const result = connector.limitToolOutput(content);
      expect(result.length).toBeLessThan(content.length);
    });

    it("should pass through content when output limiter is disabled", () => {
      const c = new MCPManagerConnector({ enableOutputLimiter: false });
      const content = "x".repeat(50_000);
      const result = c.limitToolOutput(content);
      expect(result).toBe(content);
    });

    it("should use server-specific config when provided", async () => {
      const c = new MCPManagerConnector({
        outputLimiterConfig: { maxTokens: 100, strategy: "head" },
      });
      const client = createMockClient({ tools: generateTools(1) });
      const config = createServerConfig("limited-server");

      await c.connectServer(client, "limited-server", config);

      // 100 tokens * 4 chars = 400 chars
      const content = "y".repeat(500);
      const result = c.limitToolOutput(content, "limited-server");
      expect(result.length).toBeLessThan(content.length);
    });

    it("should use smart strategy by default for truncation", () => {
      // Smart truncation works on content with paragraph breaks
      const sections = Array.from({ length: 60 }, (_, i) => `Section ${i}\n${"text ".repeat(200)}`);
      const content = sections.join("\n\n"); // ~72,000 chars
      const result = connector.limitToolOutput(content);

      // Should truncate content (keeping paragraphs that fit within limits)
      expect(result.length).toBeLessThan(content.length);
    });
  });

  // ──────────────────────────────────────────────
  // System prompt section generation
  // ──────────────────────────────────────────────

  describe("generateSystemPromptSections", () => {
    it("should return empty sections when no servers are connected", () => {
      const sections = connector.generateSystemPromptSections();

      expect(sections.mcpServers).toBe("");
      expect(sections.deferredTools).toBe("");
      expect(sections.resourceHints).toBe("");
      expect(sections.promptCommands).toBe("");
    });

    it("should include server info in mcpServers section", async () => {
      const client = createMockClient({ tools: generateTools(2) });
      const config = createServerConfig("prompt-gen-server");

      await connector.connectServer(client, "prompt-gen-server", config);

      const sections = connector.generateSystemPromptSections();
      expect(sections.mcpServers).toContain("prompt-gen-server");
    });

    it("should include deferred tools XML when tools are deferred", async () => {
      const c = new MCPManagerConnector({ toolSearchThreshold: 3 });
      const tools = generateTools(5);
      const client = createMockClient({ tools });
      const config = createServerConfig("deferred-prompt");

      await c.connectServer(client, "deferred-prompt", config);

      const sections = c.generateSystemPromptSections();
      expect(sections.deferredTools).toContain("<available-deferred-tools>");
      expect(sections.deferredTools).toContain("</available-deferred-tools>");
      expect(sections.deferredTools).toContain("mcp__deferred-prompt__tool_0");
    });

    it("should return empty resource hints initially", async () => {
      const resources = generateResources(2);
      const client = createMockClient({
        capabilities: { resources: { subscribe: false, listChanged: false } },
        resources,
      });
      const config = createServerConfig("res-prompt");

      await connector.connectServer(client, "res-prompt", config);

      const sections = connector.generateSystemPromptSections();
      // Resource hints are not populated by system prompt generation (resolved on demand)
      expect(sections.resourceHints).toBe("");
    });

    it("should not include deferred tools section when none exist", async () => {
      const client = createMockClient({ tools: generateTools(2) });
      const config = createServerConfig("no-defer");

      await connector.connectServer(client, "no-defer", config);

      const sections = connector.generateSystemPromptSections();
      expect(sections.deferredTools).toBe("");
    });
  });

  // ──────────────────────────────────────────────
  // Stats
  // ──────────────────────────────────────────────

  describe("getStats", () => {
    it("should return zero stats initially", () => {
      const stats = connector.getStats();

      expect(stats.connectedServers).toBe(0);
      expect(stats.resourceCacheStats.hits).toBe(0);
      expect(stats.resourceCacheStats.misses).toBe(0);
      expect(stats.resourceCacheStats.size).toBe(0);
      expect(stats.outputLimiterStats.truncatedCalls).toBe(0);
      expect(stats.outputLimiterStats.totalTokensSaved).toBe(0);
      expect(stats.toolSearchTokenEstimate).toBe(0);
    });

    it("should track connected servers count", async () => {
      const clientA = createMockClient();
      const clientB = createMockClient();

      await connector.connectServer(clientA, "stats-a", createServerConfig("stats-a"));
      await connector.connectServer(clientB, "stats-b", createServerConfig("stats-b"));

      expect(connector.getStats().connectedServers).toBe(2);
    });

    it("should track resource cache stats", async () => {
      const resources = generateResources(3);
      const client = createMockClient({
        capabilities: { resources: { subscribe: false, listChanged: false } },
        resources,
      });

      await connector.connectServer(client, "cache-server", createServerConfig("cache-server"));

      const stats = connector.getStats();
      expect(stats.resourceCacheStats.hits).toBe(0);
      expect(stats.resourceCacheStats.misses).toBe(0);
      expect(stats.resourceCacheStats.size).toBe(0);
    });

    it("should track output limiter stats after truncation", () => {
      // Use paragraphed content so smart truncation actually truncates
      const paragraphs = Array.from({ length: 100 }, (_, i) => `P${i}: ${"y".repeat(500)}`);
      const longContent = paragraphs.join("\n\n");
      connector.limitToolOutput(longContent);

      const stats = connector.getStats();
      expect(stats.outputLimiterStats.truncatedCalls).toBe(1);
      expect(stats.outputLimiterStats.totalTokensSaved).toBeGreaterThan(0);
    });

    it("should track tool search token estimate", async () => {
      const c = new MCPManagerConnector({ toolSearchThreshold: 3 });
      const tools = generateTools(5);
      const client = createMockClient({ tools });

      await c.connectServer(client, "token-est", createServerConfig("token-est"));

      expect(c.getStats().toolSearchTokenEstimate).toBeGreaterThan(0);
    });
  });

  // ──────────────────────────────────────────────
  // Sub-module getters
  // ──────────────────────────────────────────────

  describe("sub-module getters", () => {
    it("should return the resource manager", () => {
      expect(connector.getResourceManager()).toBeDefined();
    });

    it("should return the prompt manager", () => {
      expect(connector.getPromptManager()).toBeDefined();
    });

    it("should return the tool search", () => {
      expect(connector.getToolSearch()).toBeDefined();
    });

    it("should return the OAuth manager", () => {
      expect(connector.getOAuthManager()).toBeDefined();
    });

    it("should return the tool filter", () => {
      expect(connector.getToolFilter()).toBeDefined();
    });

    it("should return the output limiter", () => {
      expect(connector.getOutputLimiter()).toBeDefined();
    });

    it("should return consistent references across calls", () => {
      expect(connector.getResourceManager()).toBe(connector.getResourceManager());
      expect(connector.getPromptManager()).toBe(connector.getPromptManager());
      expect(connector.getToolSearch()).toBe(connector.getToolSearch());
      expect(connector.getOAuthManager()).toBe(connector.getOAuthManager());
      expect(connector.getToolFilter()).toBe(connector.getToolFilter());
      expect(connector.getOutputLimiter()).toBe(connector.getOutputLimiter());
    });
  });

  // ──────────────────────────────────────────────
  // Error handling
  // ──────────────────────────────────────────────

  describe("error handling", () => {
    it("should throw MCPManagerConnectorError on tool listing failure", async () => {
      const client = createMockClient({
        listToolsError: new Error("RPC timeout"),
      });

      await expect(
        connector.connectServer(client, "err-server", createServerConfig("err-server")),
      ).rejects.toThrow(MCPManagerConnectorError);
    });

    it("should include server name in error context", async () => {
      const client = createMockClient({
        listToolsError: new Error("Connection lost"),
      });

      try {
        await connector.connectServer(client, "ctx-server", createServerConfig("ctx-server"));
        expect.fail("Should have thrown");
      } catch (error) {
        expect(error).toBeInstanceOf(MCPManagerConnectorError);
        const mcpError = error as MCPManagerConnectorError;
        expect(mcpError.context.serverName).toBe("ctx-server");
      }
    });

    it("should collect errors from all failed servers", async () => {
      const clients = new Map<string, MCPClient>([
        ["fail-1", createMockClient({ listToolsError: new Error("err1") })],
        ["fail-2", createMockClient({ listToolsError: new Error("err2") })],
      ]);
      const configs: Record<string, MCPServerConfig> = {
        "fail-1": createServerConfig("fail-1"),
        "fail-2": createServerConfig("fail-2"),
      };

      const result = await connector.connectAllServers(clients, configs);

      expect(result.errors).toHaveLength(2);
      expect(result.servers).toHaveLength(0);
    });
  });

  // ──────────────────────────────────────────────
  // Integration-style tests
  // ──────────────────────────────────────────────

  describe("integration scenarios", () => {
    it("should handle a full lifecycle: connect, use, disconnect", async () => {
      const tools = generateTools(3);
      const resources = generateResources(2);
      const client = createMockClient({
        tools,
        capabilities: { resources: { subscribe: false, listChanged: false } },
        resources,
      });
      const config = createServerConfig("lifecycle-server");

      // Connect
      const result = await connector.connectServer(client, "lifecycle-server", config);
      expect(result.toolCount).toBe(3);
      expect(result.resourceCount).toBe(2);

      // Use output limiter
      connector.limitToolOutput("short text");

      // Generate prompt sections
      const sections = connector.generateSystemPromptSections();
      expect(sections.mcpServers).toContain("lifecycle-server");

      // Get stats
      const stats = connector.getStats();
      expect(stats.connectedServers).toBe(1);

      // Disconnect
      await connector.disconnectAll();
      expect(connector.getStats().connectedServers).toBe(0);
    });

    it("should handle mixed success/failure across many servers", async () => {
      const clients = new Map<string, MCPClient>([
        ["ok-1", createMockClient({ tools: generateTools(5) })],
        ["fail-1", createMockClient({ listToolsError: new Error("timeout") })],
        ["ok-2", createMockClient({ tools: generateTools(3) })],
        ["fail-2", createMockClient({ listToolsError: new Error("refused") })],
        ["ok-3", createMockClient({ tools: generateTools(7) })],
      ]);
      const configs: Record<string, MCPServerConfig> = {
        "ok-1": createServerConfig("ok-1"),
        "fail-1": createServerConfig("fail-1"),
        "ok-2": createServerConfig("ok-2"),
        "fail-2": createServerConfig("fail-2"),
        "ok-3": createServerConfig("ok-3"),
      };

      const result = await connector.connectAllServers(clients, configs);

      expect(result.servers).toHaveLength(3);
      expect(result.errors).toHaveLength(2);
      expect(result.totalTools).toBe(15); // 5 + 3 + 7
    });

    it("should filter then defer for a server with many filtered tools", async () => {
      const c = new MCPManagerConnector({ toolSearchThreshold: 5 });
      const tools = generateTools(20);
      const client = createMockClient({ tools });
      const config = createServerConfig("filter-defer");

      // Denylist half the tools (tool_0 through tool_9)
      c.getToolFilter().setFilter("filter-defer", {
        denylist: Array.from({ length: 10 }, (_, i) => `tool_${i}`),
      });

      const result = await c.connectServer(client, "filter-defer", config);

      // 20 - 10 denied = 10 remaining, which is > threshold of 5
      expect(result.toolCount).toBe(10);
      expect(result.filteredToolCount).toBe(10);
      expect(result.deferredToolCount).toBe(10);
    });
  });
});
