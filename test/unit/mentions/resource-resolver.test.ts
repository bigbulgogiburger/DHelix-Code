import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  MCPResourceResolver,
  ResourceResolverError,
  type ResolvedResourceContext,
  type ResourceSuggestion,
  type ResourceResolutionResult,
} from "../../../src/mentions/resource-resolver.js";
import { type MCPResourceManager, type ResourceMention } from "../../../src/mcp/resources.js";
import { type MCPClient } from "../../../src/mcp/client.js";
import { type MCPResource } from "../../../src/mcp/types.js";

/** Create a mock MCPResourceManager */
function createMockResourceManager(
  overrides: Partial<MCPResourceManager> = {},
): MCPResourceManager {
  return {
    parseResourceMentions: vi.fn().mockReturnValue([]),
    discoverResources: vi.fn().mockResolvedValue([]),
    readResource: vi.fn().mockResolvedValue(""),
    resolveResourceMentions: vi.fn().mockResolvedValue([]),
    formatResourcesForContext: vi.fn().mockReturnValue(""),
    ...overrides,
  } as unknown as MCPResourceManager;
}

/** Create a mock MCPClient */
function createMockClient(name = "test-server"): MCPClient {
  return {
    getState: vi.fn().mockReturnValue("connected"),
    listResources: vi.fn().mockResolvedValue([]),
    readResource: vi.fn().mockResolvedValue(""),
    connect: vi.fn().mockResolvedValue(undefined),
    disconnect: vi.fn().mockResolvedValue(undefined),
  } as unknown as MCPClient;
}

/** Create a ResourceMention for testing */
function createMention(serverName: string, uri: string, _startIndex = 0): ResourceMention {
  return {
    serverName,
    uri,
  };
}

/** Create a mock MCPResource */
function createMCPResource(
  uri: string,
  name: string,
  description?: string,
  mimeType?: string,
): MCPResource {
  return { uri, name, description, mimeType };
}

describe("mentions/resource-resolver", () => {
  let mockManager: MCPResourceManager;
  let mockClient: MCPClient;
  let clients: Map<string, MCPClient>;
  let resolver: MCPResourceResolver;

  beforeEach(() => {
    mockManager = createMockResourceManager();
    mockClient = createMockClient();
    clients = new Map([["testserver", mockClient]]);
    resolver = new MCPResourceResolver({
      resourceManager: mockManager,
      clients,
    });
  });

  describe("ResourceResolverError", () => {
    it("should have proper error code", () => {
      const err = new ResourceResolverError("test error");
      expect(err).toBeInstanceOf(Error);
      expect(err.code).toBe("RESOURCE_RESOLVER_ERROR");
      expect(err.message).toBe("test error");
    });

    it("should include context", () => {
      const err = new ResourceResolverError("failed", { server: "pg" });
      expect(err.context).toEqual({ server: "pg" });
    });

    it("should have empty context by default", () => {
      const err = new ResourceResolverError("no context");
      expect(err.context).toEqual({});
    });
  });

  describe("parseMentions", () => {
    it("should delegate to resourceManager.parseResourceMentions", () => {
      const mentions = [createMention("pg", "sql://users")];
      (mockManager.parseResourceMentions as ReturnType<typeof vi.fn>).mockReturnValue(mentions);

      const result = resolver.parseMentions("@pg:sql://users");

      expect(mockManager.parseResourceMentions).toHaveBeenCalledWith("@pg:sql://users");
      expect(result).toEqual(mentions);
    });

    it("should return empty array for text without mentions", () => {
      (mockManager.parseResourceMentions as ReturnType<typeof vi.fn>).mockReturnValue([]);

      const result = resolver.parseMentions("no mentions here");
      expect(result).toEqual([]);
    });

    it("should return multiple mentions", () => {
      const mentions = [
        createMention("pg", "sql://users", 0),
        createMention("redis", "cache://session", 20),
      ];
      (mockManager.parseResourceMentions as ReturnType<typeof vi.fn>).mockReturnValue(mentions);

      const result = resolver.parseMentions("@pg:sql://users @redis:cache://session");
      expect(result).toHaveLength(2);
    });
  });

  describe("resolveAll", () => {
    it("should return empty result for text without mentions", async () => {
      (mockManager.parseResourceMentions as ReturnType<typeof vi.fn>).mockReturnValue([]);

      const result = await resolver.resolveAll("no mentions");

      expect(result.resolvedResources).toHaveLength(0);
      expect(result.failedResources).toHaveLength(0);
      expect(result.contextXml).toBe("");
      expect(result.strippedText).toBe("no mentions");
      expect(result.totalTokensEstimate).toBe(0);
    });

    it("should resolve a single mention successfully", async () => {
      const mention = createMention("testserver", "sql://users", 5);
      (mockManager.parseResourceMentions as ReturnType<typeof vi.fn>).mockReturnValue([mention]);
      (mockManager.readResource as ReturnType<typeof vi.fn>).mockResolvedValue("user data here");

      const result = await resolver.resolveAll("text @testserver:sql://users end");

      expect(result.resolvedResources).toHaveLength(1);
      expect(result.resolvedResources[0].serverName).toBe("testserver");
      expect(result.resolvedResources[0].resourceUri).toBe("sql://users");
      expect(result.resolvedResources[0].content).toBe("user data here");
      expect(result.resolvedResources[0].truncated).toBe(false);
      expect(result.resolvedResources[0].originalLength).toBe(14);
      expect(result.failedResources).toHaveLength(0);
    });

    it("should resolve multiple mentions in parallel", async () => {
      const mention1 = createMention("testserver", "sql://users", 0);
      const mention2 = createMention("testserver", "sql://orders", 25);
      (mockManager.parseResourceMentions as ReturnType<typeof vi.fn>).mockReturnValue([
        mention1,
        mention2,
      ]);
      (mockManager.readResource as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce("users data")
        .mockResolvedValueOnce("orders data");

      const result = await resolver.resolveAll("@testserver:sql://users @testserver:sql://orders");

      expect(result.resolvedResources).toHaveLength(2);
      expect(result.resolvedResources[0].content).toBe("users data");
      expect(result.resolvedResources[1].content).toBe("orders data");
    });

    it("should handle partial failures", async () => {
      const mention1 = createMention("testserver", "sql://users", 0);
      const mention2 = createMention("testserver", "sql://broken", 25);
      (mockManager.parseResourceMentions as ReturnType<typeof vi.fn>).mockReturnValue([
        mention1,
        mention2,
      ]);
      (mockManager.readResource as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce("users data")
        .mockRejectedValueOnce(new Error("resource not found"));

      const result = await resolver.resolveAll("@testserver:sql://users @testserver:sql://broken");

      expect(result.resolvedResources).toHaveLength(1);
      expect(result.resolvedResources[0].content).toBe("users data");
      expect(result.failedResources).toHaveLength(1);
      expect(result.failedResources[0].mention).toBe("@testserver:sql://broken");
      expect(result.failedResources[0].error).toContain("resource not found");
    });

    it("should fail for disconnected server", async () => {
      const mention = createMention("unknown", "sql://users", 0);
      (mockManager.parseResourceMentions as ReturnType<typeof vi.fn>).mockReturnValue([mention]);

      const result = await resolver.resolveAll("@unknown:sql://users");

      expect(result.resolvedResources).toHaveLength(0);
      expect(result.failedResources).toHaveLength(1);
      expect(result.failedResources[0].error).toContain("not connected");
    });

    it("should truncate content exceeding maxContentLength", async () => {
      const shortResolver = new MCPResourceResolver({
        resourceManager: mockManager,
        clients,
        maxContentLength: 20,
      });

      const mention = createMention("testserver", "sql://users", 0);
      (mockManager.parseResourceMentions as ReturnType<typeof vi.fn>).mockReturnValue([mention]);
      (mockManager.readResource as ReturnType<typeof vi.fn>).mockResolvedValue("a".repeat(50));

      const result = await shortResolver.resolveAll("@testserver:sql://users");

      expect(result.resolvedResources[0].truncated).toBe(true);
      expect(result.resolvedResources[0].originalLength).toBe(50);
      expect(result.resolvedResources[0].content).toContain("[truncated]");
      expect(result.resolvedResources[0].content.length).toBeLessThan(50);
    });

    it("should not truncate content within maxContentLength", async () => {
      const mention = createMention("testserver", "sql://users", 0);
      (mockManager.parseResourceMentions as ReturnType<typeof vi.fn>).mockReturnValue([mention]);
      (mockManager.readResource as ReturnType<typeof vi.fn>).mockResolvedValue("short content");

      const result = await resolver.resolveAll("@testserver:sql://users");

      expect(result.resolvedResources[0].truncated).toBe(false);
      expect(result.resolvedResources[0].content).toBe("short content");
    });

    it("should build XML context for resolved resources", async () => {
      const mention = createMention("testserver", "sql://users", 0);
      (mockManager.parseResourceMentions as ReturnType<typeof vi.fn>).mockReturnValue([mention]);
      (mockManager.readResource as ReturnType<typeof vi.fn>).mockResolvedValue("data");

      const result = await resolver.resolveAll("@testserver:sql://users");

      expect(result.contextXml).toContain("<mcp-resources>");
      expect(result.contextXml).toContain("</mcp-resources>");
      expect(result.contextXml).toContain('<resource server="testserver" uri="sql://users">');
      expect(result.contextXml).toContain("data");
      expect(result.contextXml).toContain("</resource>");
    });

    it("should produce empty contextXml when all mentions fail", async () => {
      const mention = createMention("unknown", "sql://x", 0);
      (mockManager.parseResourceMentions as ReturnType<typeof vi.fn>).mockReturnValue([mention]);

      const result = await resolver.resolveAll("@unknown:sql://x");

      expect(result.contextXml).toBe("");
    });

    it("should produce stripped text with placeholders", async () => {
      const text = "Check @testserver:sql://users for info";
      const mention = createMention("testserver", "sql://users", 6);
      (mockManager.parseResourceMentions as ReturnType<typeof vi.fn>).mockReturnValue([mention]);
      (mockManager.readResource as ReturnType<typeof vi.fn>).mockResolvedValue("data");

      const result = await resolver.resolveAll(text);

      expect(result.strippedText).toContain("[resource: testserver/sql://users]");
      expect(result.strippedText).not.toContain("@testserver:sql://users");
    });

    it("should estimate tokens from context XML", async () => {
      const mention = createMention("testserver", "sql://users", 0);
      (mockManager.parseResourceMentions as ReturnType<typeof vi.fn>).mockReturnValue([mention]);
      (mockManager.readResource as ReturnType<typeof vi.fn>).mockResolvedValue("some data");

      const result = await resolver.resolveAll("@testserver:sql://users");

      expect(result.totalTokensEstimate).toBe(Math.ceil(result.contextXml.length / 4));
      expect(result.totalTokensEstimate).toBeGreaterThan(0);
    });

    it("should handle non-Error rejection in readResource", async () => {
      const mention = createMention("testserver", "sql://users", 0);
      (mockManager.parseResourceMentions as ReturnType<typeof vi.fn>).mockReturnValue([mention]);
      (mockManager.readResource as ReturnType<typeof vi.fn>).mockRejectedValue("string error");

      const result = await resolver.resolveAll("@testserver:sql://users");

      expect(result.failedResources).toHaveLength(1);
      expect(result.failedResources[0].error).toBe("string error");
    });

    it("should use default maxContentLength of 50000", async () => {
      const mention = createMention("testserver", "sql://users", 0);
      (mockManager.parseResourceMentions as ReturnType<typeof vi.fn>).mockReturnValue([mention]);
      // Content exactly at limit should not be truncated
      const contentAtLimit = "x".repeat(50_000);
      (mockManager.readResource as ReturnType<typeof vi.fn>).mockResolvedValue(contentAtLimit);

      const result = await resolver.resolveAll("@testserver:sql://users");

      expect(result.resolvedResources[0].truncated).toBe(false);
    });

    it("should truncate content just over maxContentLength", async () => {
      const mention = createMention("testserver", "sql://users", 0);
      (mockManager.parseResourceMentions as ReturnType<typeof vi.fn>).mockReturnValue([mention]);
      const contentOverLimit = "x".repeat(50_001);
      (mockManager.readResource as ReturnType<typeof vi.fn>).mockResolvedValue(contentOverLimit);

      const result = await resolver.resolveAll("@testserver:sql://users");

      expect(result.resolvedResources[0].truncated).toBe(true);
    });

    it("should build XML with multiple resources", async () => {
      const mention1 = createMention("testserver", "sql://a", 0);
      const mention2 = createMention("testserver", "sql://b", 22);
      (mockManager.parseResourceMentions as ReturnType<typeof vi.fn>).mockReturnValue([
        mention1,
        mention2,
      ]);
      (mockManager.readResource as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce("alpha")
        .mockResolvedValueOnce("beta");

      const result = await resolver.resolveAll("@testserver:sql://a @testserver:sql://b");

      expect(result.contextXml).toContain("alpha");
      expect(result.contextXml).toContain("beta");
      expect(result.contextXml.match(/<resource /g)).toHaveLength(2);
    });
  });

  describe("getSuggestions", () => {
    it("should return empty for input without @", async () => {
      const suggestions = await resolver.getSuggestions("no at sign");
      expect(suggestions).toHaveLength(0);
    });

    it("should return all servers for just '@'", async () => {
      const suggestions = await resolver.getSuggestions("@");
      expect(suggestions).toHaveLength(1);
      expect(suggestions[0].display).toBe("@testserver:");
      expect(suggestions[0].serverName).toBe("testserver");
    });

    it("should filter servers by prefix", async () => {
      const client2 = createMockClient("other");
      const multiClients = new Map([
        ["testserver", mockClient],
        ["postgres", client2],
      ]);
      const multiResolver = new MCPResourceResolver({
        resourceManager: mockManager,
        clients: multiClients,
      });

      const suggestions = await multiResolver.getSuggestions("@test");
      expect(suggestions).toHaveLength(1);
      expect(suggestions[0].serverName).toBe("testserver");
    });

    it("should return all servers when prefix is empty after @", async () => {
      const client2 = createMockClient("other");
      const multiClients = new Map([
        ["testserver", mockClient],
        ["postgres", client2],
      ]);
      const multiResolver = new MCPResourceResolver({
        resourceManager: mockManager,
        clients: multiClients,
      });

      const suggestions = await multiResolver.getSuggestions("@");
      expect(suggestions).toHaveLength(2);
    });

    it("should return resources for '@server:'", async () => {
      const resources: MCPResource[] = [
        createMCPResource("sql://users", "users", "User table"),
        createMCPResource("sql://orders", "orders", "Order table"),
      ];
      (mockManager.discoverResources as ReturnType<typeof vi.fn>).mockResolvedValue(resources);

      const suggestions = await resolver.getSuggestions("@testserver:");

      expect(suggestions).toHaveLength(2);
      expect(suggestions[0].display).toBe("@testserver:sql://users");
      expect(suggestions[0].description).toBe("User table");
      expect(suggestions[1].display).toBe("@testserver:sql://orders");
    });

    it("should filter resources by partial URI", async () => {
      const resources: MCPResource[] = [
        createMCPResource("sql://users", "users", "User table"),
        createMCPResource("sql://orders", "orders", "Order table"),
        createMCPResource("cache://session", "session", "Session cache"),
      ];
      (mockManager.discoverResources as ReturnType<typeof vi.fn>).mockResolvedValue(resources);

      const suggestions = await resolver.getSuggestions("@testserver:sql");

      expect(suggestions).toHaveLength(2);
      expect(suggestions.every((s) => s.uri.includes("sql"))).toBe(true);
    });

    it("should return empty for unknown server with colon", async () => {
      const suggestions = await resolver.getSuggestions("@nonexistent:");
      expect(suggestions).toHaveLength(0);
    });

    it("should use cached resources on subsequent calls", async () => {
      const resources: MCPResource[] = [createMCPResource("sql://users", "users", "User table")];
      (mockManager.discoverResources as ReturnType<typeof vi.fn>).mockResolvedValue(resources);

      await resolver.getSuggestions("@testserver:");
      await resolver.getSuggestions("@testserver:");

      // discoverResources should only be called once due to caching
      expect(mockManager.discoverResources).toHaveBeenCalledTimes(1);
    });

    it("should handle discovery failure gracefully", async () => {
      (mockManager.discoverResources as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error("discovery failed"),
      );

      const suggestions = await resolver.getSuggestions("@testserver:");
      expect(suggestions).toHaveLength(0);
    });

    it("should be case-insensitive when filtering servers", async () => {
      const suggestions = await resolver.getSuggestions("@TEST");
      expect(suggestions).toHaveLength(1);
      expect(suggestions[0].serverName).toBe("testserver");
    });

    it("should be case-insensitive when filtering resources", async () => {
      const resources: MCPResource[] = [createMCPResource("SQL://USERS", "USERS", "User table")];
      (mockManager.discoverResources as ReturnType<typeof vi.fn>).mockResolvedValue(resources);

      const suggestions = await resolver.getSuggestions("@testserver:sql");
      expect(suggestions).toHaveLength(1);
    });

    it("should use last @ in partial for suggestion context", async () => {
      const suggestions = await resolver.getSuggestions("some text @test");
      expect(suggestions).toHaveLength(1);
      expect(suggestions[0].serverName).toBe("testserver");
    });

    it("should return no servers when prefix matches none", async () => {
      const suggestions = await resolver.getSuggestions("@zzz");
      expect(suggestions).toHaveLength(0);
    });
  });

  describe("refreshCatalog", () => {
    it("should discover resources from all connected servers", async () => {
      const resources: MCPResource[] = [createMCPResource("sql://users", "users", "Users table")];
      (mockManager.discoverResources as ReturnType<typeof vi.fn>).mockResolvedValue(resources);

      await resolver.refreshCatalog();

      expect(mockManager.discoverResources).toHaveBeenCalledWith(mockClient, "testserver");
      const cached = resolver.getServerResources("testserver");
      expect(cached).toHaveLength(1);
      expect(cached[0].uri).toBe("sql://users");
    });

    it("should clear existing cache before refreshing", async () => {
      const resources1: MCPResource[] = [createMCPResource("sql://old", "old", "Old resource")];
      (mockManager.discoverResources as ReturnType<typeof vi.fn>).mockResolvedValue(resources1);
      await resolver.refreshCatalog();

      const resources2: MCPResource[] = [createMCPResource("sql://new", "new", "New resource")];
      (mockManager.discoverResources as ReturnType<typeof vi.fn>).mockResolvedValue(resources2);
      await resolver.refreshCatalog();

      const cached = resolver.getServerResources("testserver");
      expect(cached).toHaveLength(1);
      expect(cached[0].uri).toBe("sql://new");
    });

    it("should handle discovery failure gracefully", async () => {
      (mockManager.discoverResources as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error("discovery failed"),
      );

      await resolver.refreshCatalog();

      const cached = resolver.getServerResources("testserver");
      expect(cached).toHaveLength(0);
    });

    it("should refresh multiple servers in parallel", async () => {
      const client2 = createMockClient("redis");
      const multiClients = new Map([
        ["testserver", mockClient],
        ["redis", client2],
      ]);
      const multiResolver = new MCPResourceResolver({
        resourceManager: mockManager,
        clients: multiClients,
      });

      const resources: MCPResource[] = [createMCPResource("sql://data", "data", "Some data")];
      (mockManager.discoverResources as ReturnType<typeof vi.fn>).mockResolvedValue(resources);

      await multiResolver.refreshCatalog();

      expect(mockManager.discoverResources).toHaveBeenCalledTimes(2);
      expect(multiResolver.getServerResources("testserver")).toHaveLength(1);
      expect(multiResolver.getServerResources("redis")).toHaveLength(1);
    });
  });

  describe("hasMentions", () => {
    it("should return true when text has mentions", () => {
      (mockManager.parseResourceMentions as ReturnType<typeof vi.fn>).mockReturnValue([
        createMention("pg", "sql://users"),
      ]);

      expect(resolver.hasMentions("@pg:sql://users")).toBe(true);
    });

    it("should return false when text has no mentions", () => {
      (mockManager.parseResourceMentions as ReturnType<typeof vi.fn>).mockReturnValue([]);

      expect(resolver.hasMentions("no mentions")).toBe(false);
    });

    it("should return false for empty string", () => {
      (mockManager.parseResourceMentions as ReturnType<typeof vi.fn>).mockReturnValue([]);

      expect(resolver.hasMentions("")).toBe(false);
    });

    it("should return true when text has multiple mentions", () => {
      (mockManager.parseResourceMentions as ReturnType<typeof vi.fn>).mockReturnValue([
        createMention("a", "x://1"),
        createMention("b", "y://2"),
      ]);

      expect(resolver.hasMentions("@a:x://1 @b:y://2")).toBe(true);
    });
  });

  describe("stripMentions", () => {
    it("should replace mentions with placeholders", () => {
      const mention = createMention("pg", "sql://users", 5);
      (mockManager.parseResourceMentions as ReturnType<typeof vi.fn>).mockReturnValue([mention]);

      const result = resolver.stripMentions("Read @pg:sql://users table");

      expect(result).toContain("[resource: pg/sql://users]");
      expect(result).not.toContain("@pg:sql://users");
    });

    it("should return original text when no mentions", () => {
      (mockManager.parseResourceMentions as ReturnType<typeof vi.fn>).mockReturnValue([]);

      const result = resolver.stripMentions("no mentions here");
      expect(result).toBe("no mentions here");
    });

    it("should handle multiple mentions", () => {
      const mention1 = createMention("pg", "sql://users", 0);
      const mention2 = createMention("redis", "cache://x", 20);
      (mockManager.parseResourceMentions as ReturnType<typeof vi.fn>).mockReturnValue([
        mention1,
        mention2,
      ]);

      const text = "@pg:sql://users and @redis:cache://x";
      const result = resolver.stripMentions(text);

      expect(result).toContain("[resource: pg/sql://users]");
      expect(result).toContain("[resource: redis/cache://x]");
    });

    it("should preserve surrounding text", () => {
      const mention = createMention("pg", "sql://users", 7);
      (mockManager.parseResourceMentions as ReturnType<typeof vi.fn>).mockReturnValue([mention]);

      const result = resolver.stripMentions("before @pg:sql://users after");

      expect(result).toContain("before ");
      expect(result).toContain(" after");
    });
  });

  describe("updateClients", () => {
    it("should replace clients map", () => {
      const newClient = createMockClient("new");
      const newClients = new Map([["newserver", newClient]]);

      resolver.updateClients(newClients);

      expect(resolver.getAvailableServers()).toEqual(["newserver"]);
    });

    it("should remove cache entries for disconnected servers", async () => {
      // First, populate cache
      const resources: MCPResource[] = [createMCPResource("sql://data", "data", "Data")];
      (mockManager.discoverResources as ReturnType<typeof vi.fn>).mockResolvedValue(resources);
      await resolver.refreshCatalog();
      expect(resolver.getServerResources("testserver")).toHaveLength(1);

      // Now disconnect testserver
      resolver.updateClients(new Map());

      expect(resolver.getServerResources("testserver")).toHaveLength(0);
    });

    it("should keep cache entries for servers that remain connected", async () => {
      // Populate cache
      const resources: MCPResource[] = [createMCPResource("sql://data", "data", "Data")];
      (mockManager.discoverResources as ReturnType<typeof vi.fn>).mockResolvedValue(resources);
      await resolver.refreshCatalog();

      // Update with same server still present
      const newClients = new Map([["testserver", mockClient]]);
      resolver.updateClients(newClients);

      expect(resolver.getServerResources("testserver")).toHaveLength(1);
    });

    it("should not mutate the original clients map", () => {
      const newClients = new Map([["a", createMockClient("a")]]);
      resolver.updateClients(newClients);
      newClients.set("b", createMockClient("b"));

      // Resolver should not see the mutation
      expect(resolver.getAvailableServers()).toEqual(["a"]);
    });
  });

  describe("getAvailableServers", () => {
    it("should return server names from clients", () => {
      expect(resolver.getAvailableServers()).toEqual(["testserver"]);
    });

    it("should return empty array when no clients", () => {
      const emptyResolver = new MCPResourceResolver({
        resourceManager: mockManager,
        clients: new Map(),
      });
      expect(emptyResolver.getAvailableServers()).toEqual([]);
    });

    it("should return multiple server names", () => {
      const multiClients = new Map([
        ["alpha", createMockClient("alpha")],
        ["beta", createMockClient("beta")],
        ["gamma", createMockClient("gamma")],
      ]);
      const multiResolver = new MCPResourceResolver({
        resourceManager: mockManager,
        clients: multiClients,
      });

      const servers = multiResolver.getAvailableServers();
      expect(servers).toHaveLength(3);
      expect(servers).toContain("alpha");
      expect(servers).toContain("beta");
      expect(servers).toContain("gamma");
    });
  });

  describe("getServerResources", () => {
    it("should return empty array for unknown server", () => {
      expect(resolver.getServerResources("nonexistent")).toEqual([]);
    });

    it("should return cached resources after refresh", async () => {
      const resources: MCPResource[] = [
        createMCPResource("sql://users", "users", "User table"),
        createMCPResource("sql://orders", "orders"),
      ];
      (mockManager.discoverResources as ReturnType<typeof vi.fn>).mockResolvedValue(resources);

      await resolver.refreshCatalog();

      const cached = resolver.getServerResources("testserver");
      expect(cached).toHaveLength(2);
      expect(cached[0].display).toBe("@testserver:sql://users");
      expect(cached[0].insert).toBe("@testserver:sql://users");
      expect(cached[0].description).toBe("User table");
      expect(cached[0].serverName).toBe("testserver");
      expect(cached[0].uri).toBe("sql://users");
    });

    it("should use resource name as description when description is missing", async () => {
      const resources: MCPResource[] = [createMCPResource("sql://data", "my-data")];
      (mockManager.discoverResources as ReturnType<typeof vi.fn>).mockResolvedValue(resources);

      await resolver.refreshCatalog();

      const cached = resolver.getServerResources("testserver");
      expect(cached[0].description).toBe("my-data");
    });
  });

  describe("constructor", () => {
    it("should use default maxContentLength of 50000", async () => {
      const mention = createMention("testserver", "sql://users", 0);
      (mockManager.parseResourceMentions as ReturnType<typeof vi.fn>).mockReturnValue([mention]);
      const content = "x".repeat(50_000);
      (mockManager.readResource as ReturnType<typeof vi.fn>).mockResolvedValue(content);

      const result = await resolver.resolveAll("@testserver:sql://users");
      expect(result.resolvedResources[0].truncated).toBe(false);
    });

    it("should accept custom maxContentLength", async () => {
      const customResolver = new MCPResourceResolver({
        resourceManager: mockManager,
        clients,
        maxContentLength: 10,
      });

      const mention = createMention("testserver", "sql://users", 0);
      (mockManager.parseResourceMentions as ReturnType<typeof vi.fn>).mockReturnValue([mention]);
      (mockManager.readResource as ReturnType<typeof vi.fn>).mockResolvedValue("a".repeat(20));

      const result = await customResolver.resolveAll("@testserver:sql://users");
      expect(result.resolvedResources[0].truncated).toBe(true);
      // 10 chars + "\n[truncated]"
      expect(result.resolvedResources[0].content).toBe("a".repeat(10) + "\n[truncated]");
    });

    it("should not mutate the original clients map", () => {
      const originalClients = new Map([["test", mockClient]]);
      const r = new MCPResourceResolver({
        resourceManager: mockManager,
        clients: originalClients,
      });

      originalClients.set("extra", createMockClient("extra"));
      // Resolver should not see the mutation
      expect(r.getAvailableServers()).toEqual(["test"]);
    });
  });

  describe("token estimation", () => {
    it("should estimate 1 token per 4 characters", async () => {
      const mention = createMention("testserver", "sql://users", 0);
      (mockManager.parseResourceMentions as ReturnType<typeof vi.fn>).mockReturnValue([mention]);
      (mockManager.readResource as ReturnType<typeof vi.fn>).mockResolvedValue("data");

      const result = await resolver.resolveAll("@testserver:sql://users");

      // Token estimate should be ceil(contextXml.length / 4)
      const expected = Math.ceil(result.contextXml.length / 4);
      expect(result.totalTokensEstimate).toBe(expected);
    });

    it("should return 0 tokens for empty context", async () => {
      (mockManager.parseResourceMentions as ReturnType<typeof vi.fn>).mockReturnValue([]);

      const result = await resolver.resolveAll("no mentions");
      expect(result.totalTokensEstimate).toBe(0);
    });

    it("should round up token estimate", async () => {
      const mention = createMention("testserver", "sql://users", 0);
      (mockManager.parseResourceMentions as ReturnType<typeof vi.fn>).mockReturnValue([mention]);
      // Use content that won't divide evenly by 4
      (mockManager.readResource as ReturnType<typeof vi.fn>).mockResolvedValue("x");

      const result = await resolver.resolveAll("@testserver:sql://users");

      // contextXml length won't be divisible by 4, so ceil should round up
      expect(result.totalTokensEstimate).toBe(Math.ceil(result.contextXml.length / 4));
    });
  });

  describe("empty resource list handling", () => {
    it("should handle server with no resources", async () => {
      (mockManager.discoverResources as ReturnType<typeof vi.fn>).mockResolvedValue([]);

      await resolver.refreshCatalog();

      const cached = resolver.getServerResources("testserver");
      expect(cached).toHaveLength(0);
    });

    it("should return empty suggestions for server with no resources", async () => {
      (mockManager.discoverResources as ReturnType<typeof vi.fn>).mockResolvedValue([]);

      const suggestions = await resolver.getSuggestions("@testserver:");
      expect(suggestions).toHaveLength(0);
    });
  });

  describe("edge cases", () => {
    it("should handle empty text in resolveAll", async () => {
      (mockManager.parseResourceMentions as ReturnType<typeof vi.fn>).mockReturnValue([]);

      const result = await resolver.resolveAll("");
      expect(result.strippedText).toBe("");
      expect(result.contextXml).toBe("");
    });

    it("should handle empty text in hasMentions", () => {
      (mockManager.parseResourceMentions as ReturnType<typeof vi.fn>).mockReturnValue([]);
      expect(resolver.hasMentions("")).toBe(false);
    });

    it("should handle empty text in stripMentions", () => {
      (mockManager.parseResourceMentions as ReturnType<typeof vi.fn>).mockReturnValue([]);
      expect(resolver.stripMentions("")).toBe("");
    });

    it("should handle resolveAll with all mentions failing", async () => {
      const mention1 = createMention("unknown1", "sql://a", 0);
      const mention2 = createMention("unknown2", "sql://b", 20);
      (mockManager.parseResourceMentions as ReturnType<typeof vi.fn>).mockReturnValue([
        mention1,
        mention2,
      ]);

      const result = await resolver.resolveAll("@unknown1:sql://a @unknown2:sql://b");

      expect(result.resolvedResources).toHaveLength(0);
      expect(result.failedResources).toHaveLength(2);
      expect(result.contextXml).toBe("");
      expect(result.totalTokensEstimate).toBe(0);
    });

    it("should handle resource content that is exactly maxContentLength", async () => {
      const customResolver = new MCPResourceResolver({
        resourceManager: mockManager,
        clients,
        maxContentLength: 100,
      });

      const mention = createMention("testserver", "sql://users", 0);
      (mockManager.parseResourceMentions as ReturnType<typeof vi.fn>).mockReturnValue([mention]);
      (mockManager.readResource as ReturnType<typeof vi.fn>).mockResolvedValue("x".repeat(100));

      const result = await customResolver.resolveAll("@testserver:sql://users");
      expect(result.resolvedResources[0].truncated).toBe(false);
      expect(result.resolvedResources[0].content).toBe("x".repeat(100));
    });

    it("should handle empty content from readResource", async () => {
      const mention = createMention("testserver", "sql://empty", 0);
      (mockManager.parseResourceMentions as ReturnType<typeof vi.fn>).mockReturnValue([mention]);
      (mockManager.readResource as ReturnType<typeof vi.fn>).mockResolvedValue("");

      const result = await resolver.resolveAll("@testserver:sql://empty");

      expect(result.resolvedResources).toHaveLength(1);
      expect(result.resolvedResources[0].content).toBe("");
      expect(result.resolvedResources[0].truncated).toBe(false);
      expect(result.resolvedResources[0].originalLength).toBe(0);
    });
  });
});
