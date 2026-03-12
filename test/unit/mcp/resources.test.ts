import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  MCPResourceManager,
  MCPResourceError,
  type ResolvedResource,
} from "../../../src/mcp/resources.js";
import { type MCPClient } from "../../../src/mcp/client.js";
import { type MCPResource } from "../../../src/mcp/types.js";

/** Create a mock MCPClient with configurable listResources and readResource */
function createMockClient(
  resources: readonly MCPResource[] = [],
  readContent: string = "mock content",
): MCPClient {
  return {
    listResources: vi.fn().mockResolvedValue(resources),
    readResource: vi.fn().mockResolvedValue(readContent),
    // Unused methods — typed as unknown to satisfy the interface shape
    connect: vi.fn(),
    disconnect: vi.fn(),
    listTools: vi.fn(),
    callTool: vi.fn(),
    getState: vi.fn().mockReturnValue("connected"),
    getCapabilities: vi.fn().mockReturnValue(null),
    setToolsChangedCallback: vi.fn(),
  } as unknown as MCPClient;
}

describe("MCPResourceManager", () => {
  let manager: MCPResourceManager;

  beforeEach(() => {
    manager = new MCPResourceManager();
  });

  describe("parseResourceMentions", () => {
    it("should parse a single @server:protocol://path mention", () => {
      const mentions = manager.parseResourceMentions("Check @myserver:file:///home/user/data.txt");

      expect(mentions).toHaveLength(1);
      expect(mentions[0]).toEqual({
        serverName: "myserver",
        uri: "file:///home/user/data.txt",
      });
    });

    it("should parse @server:name style mentions", () => {
      const mentions = manager.parseResourceMentions("Load @db:my-resource");

      expect(mentions).toHaveLength(1);
      expect(mentions[0]).toEqual({
        serverName: "db",
        uri: "my-resource",
      });
    });

    it("should parse multiple mentions in a single text", () => {
      const text = "Compare @server1:file:///a.txt with @server2:file:///b.txt";
      const mentions = manager.parseResourceMentions(text);

      expect(mentions).toHaveLength(2);
      expect(mentions[0].serverName).toBe("server1");
      expect(mentions[1].serverName).toBe("server2");
    });

    it("should return empty array when no mentions exist", () => {
      const mentions = manager.parseResourceMentions("No mentions here");

      expect(mentions).toHaveLength(0);
    });

    it("should deduplicate identical mentions", () => {
      const text = "@srv:file:///a.txt and again @srv:file:///a.txt";
      const mentions = manager.parseResourceMentions(text);

      expect(mentions).toHaveLength(1);
    });

    it("should handle server names with hyphens", () => {
      const mentions = manager.parseResourceMentions("@my-server:resource-name");

      expect(mentions).toHaveLength(1);
      expect(mentions[0].serverName).toBe("my-server");
      expect(mentions[0].uri).toBe("resource-name");
    });

    it("should handle URIs with path separators", () => {
      const mentions = manager.parseResourceMentions("@srv:docs/api/reference");

      expect(mentions).toHaveLength(1);
      expect(mentions[0].uri).toBe("docs/api/reference");
    });

    it("should handle postgres-style URIs", () => {
      const mentions = manager.parseResourceMentions("@db:postgres://localhost/mydb");

      expect(mentions).toHaveLength(1);
      expect(mentions[0].serverName).toBe("db");
      expect(mentions[0].uri).toBe("postgres://localhost/mydb");
    });

    it("should stop URI at whitespace boundary", () => {
      const mentions = manager.parseResourceMentions("@srv:file:///path/to/file.txt next word");

      expect(mentions).toHaveLength(1);
      expect(mentions[0].uri).toBe("file:///path/to/file.txt");
    });

    it("should handle empty string input", () => {
      const mentions = manager.parseResourceMentions("");

      expect(mentions).toHaveLength(0);
    });

    it("should not match bare @ without server:uri pattern", () => {
      const mentions = manager.parseResourceMentions("email@example.com is not a mention");

      // email@example does not match because : is required after server name
      expect(mentions.every((m) => m.serverName !== "example" || m.uri !== "com")).toBe(true);
    });
  });

  describe("discoverResources", () => {
    it("should call listResources on the client", async () => {
      const mockResources: MCPResource[] = [
        { uri: "test://hello", name: "hello", description: "A test resource" },
      ];
      const client = createMockClient(mockResources);

      const result = await manager.discoverResources(client, "test-server");

      expect(client.listResources).toHaveBeenCalledOnce();
      expect(result).toEqual(mockResources);
    });

    it("should return empty array when server has no resources", async () => {
      const client = createMockClient([]);

      const result = await manager.discoverResources(client, "empty-server");

      expect(result).toHaveLength(0);
    });

    it("should wrap client errors in MCPResourceError", async () => {
      const client = createMockClient();
      vi.mocked(client.listResources).mockRejectedValue(new Error("Connection lost"));

      await expect(manager.discoverResources(client, "broken-server")).rejects.toThrow(
        MCPResourceError,
      );
      await expect(manager.discoverResources(client, "broken-server")).rejects.toThrow(
        /Failed to discover resources from server "broken-server"/,
      );
    });
  });

  describe("readResource", () => {
    it("should fetch from client on cache miss", async () => {
      const client = createMockClient([], "hello world");

      const content = await manager.readResource(client, "srv", "test://doc");

      expect(content).toBe("hello world");
      expect(client.readResource).toHaveBeenCalledWith("test://doc");
    });

    it("should return cached content on cache hit", async () => {
      const client = createMockClient([], "first read");

      // First call — cache miss
      await manager.readResource(client, "srv", "test://doc");
      // Second call — cache hit
      const content = await manager.readResource(client, "srv", "test://doc");

      expect(content).toBe("first read");
      expect(client.readResource).toHaveBeenCalledOnce();
    });

    it("should refetch when cache entry is expired", async () => {
      // Use a very short TTL
      const shortTtlManager = new MCPResourceManager(1);
      const client = createMockClient([], "fresh content");

      // First call — cache miss
      await shortTtlManager.readResource(client, "srv", "test://doc");

      // Wait for TTL to expire
      await new Promise((r) => setTimeout(r, 10));

      // Second call — cache expired, should refetch
      vi.mocked(client.readResource).mockResolvedValue("updated content");
      const content = await shortTtlManager.readResource(client, "srv", "test://doc");

      expect(content).toBe("updated content");
      expect(client.readResource).toHaveBeenCalledTimes(2);
    });

    it("should throw MCPResourceError when client fails", async () => {
      const client = createMockClient();
      vi.mocked(client.readResource).mockRejectedValue(new Error("Not found"));

      await expect(manager.readResource(client, "srv", "test://missing")).rejects.toThrow(
        MCPResourceError,
      );
      await expect(manager.readResource(client, "srv", "test://missing")).rejects.toThrow(
        /Failed to read resource "test:\/\/missing" from server "srv"/,
      );
    });

    it("should track cache hits and misses", async () => {
      const client = createMockClient([], "content");

      // Miss
      await manager.readResource(client, "srv", "test://a");
      // Hit
      await manager.readResource(client, "srv", "test://a");
      // Miss (different URI)
      await manager.readResource(client, "srv", "test://b");

      const stats = manager.getCacheStats();
      expect(stats.hits).toBe(1);
      expect(stats.misses).toBe(2);
    });

    it("should use separate cache entries per server", async () => {
      const client1 = createMockClient([], "from server 1");
      const client2 = createMockClient([], "from server 2");

      const content1 = await manager.readResource(client1, "srv1", "test://doc");
      const content2 = await manager.readResource(client2, "srv2", "test://doc");

      expect(content1).toBe("from server 1");
      expect(content2).toBe("from server 2");
      expect(manager.getCacheStats().misses).toBe(2);
    });
  });

  describe("resolveResourceMentions", () => {
    it("should resolve mentions from multiple servers", async () => {
      const resource1: MCPResource = {
        uri: "file:///a.txt",
        name: "a.txt",
        description: "File A",
      };
      const resource2: MCPResource = {
        uri: "file:///b.txt",
        name: "b.txt",
      };

      const client1 = createMockClient([resource1], "content A");
      const client2 = createMockClient([resource2], "content B");

      const clients = new Map<string, MCPClient>([
        ["server1", client1],
        ["server2", client2],
      ]);

      const resolved = await manager.resolveResourceMentions(
        "Compare @server1:file:///a.txt with @server2:file:///b.txt",
        clients,
      );

      expect(resolved).toHaveLength(2);
      expect(resolved[0].serverName).toBe("server1");
      expect(resolved[0].content).toBe("content A");
      expect(resolved[1].serverName).toBe("server2");
      expect(resolved[1].content).toBe("content B");
    });

    it("should skip unknown servers without failing other resolutions", async () => {
      const resource: MCPResource = { uri: "test://hello", name: "hello" };
      const client = createMockClient([resource], "valid content");

      const clients = new Map<string, MCPClient>([["known", client]]);

      const resolved = await manager.resolveResourceMentions(
        "@known:test://hello and @unknown:test://missing",
        clients,
      );

      expect(resolved).toHaveLength(1);
      expect(resolved[0].serverName).toBe("known");
    });

    it("should return empty array when no mentions in text", async () => {
      const clients = new Map<string, MCPClient>();
      const resolved = await manager.resolveResourceMentions("no mentions here", clients);

      expect(resolved).toHaveLength(0);
    });

    it("should resolve by resource name as well as URI", async () => {
      const resource: MCPResource = {
        uri: "custom://internal/hello",
        name: "hello",
        description: "Hello resource",
      };
      const client = createMockClient([resource], "hello content");
      const clients = new Map<string, MCPClient>([["srv", client]]);

      const resolved = await manager.resolveResourceMentions("@srv:hello", clients);

      expect(resolved).toHaveLength(1);
      expect(resolved[0].uri).toBe("custom://internal/hello");
      expect(resolved[0].content).toBe("hello content");
    });

    it("should skip resources that are not found on the server", async () => {
      const resource: MCPResource = { uri: "test://exists", name: "exists" };
      const client = createMockClient([resource], "content");
      const clients = new Map<string, MCPClient>([["srv", client]]);

      const resolved = await manager.resolveResourceMentions(
        "@srv:test://exists and @srv:test://missing",
        clients,
      );

      expect(resolved).toHaveLength(1);
      expect(resolved[0].uri).toBe("test://exists");
    });

    it("should handle empty clients map", async () => {
      const clients = new Map<string, MCPClient>();
      const resolved = await manager.resolveResourceMentions("@srv:test://doc", clients);

      expect(resolved).toHaveLength(0);
    });
  });

  describe("formatResourcesForContext", () => {
    it("should format a single resource with XML tags", () => {
      const resources: readonly ResolvedResource[] = [
        {
          serverName: "myserver",
          uri: "file:///data.txt",
          resource: { uri: "file:///data.txt", name: "data.txt" },
          content: "Hello, world!",
        },
      ];

      const formatted = manager.formatResourcesForContext(resources);

      expect(formatted).toContain('<resource server="myserver" uri="file:///data.txt">');
      expect(formatted).toContain("Hello, world!");
      expect(formatted).toContain("</resource>");
    });

    it("should format multiple resources separated by blank lines", () => {
      const resources: readonly ResolvedResource[] = [
        {
          serverName: "srv1",
          uri: "test://a",
          resource: { uri: "test://a", name: "a" },
          content: "Content A",
        },
        {
          serverName: "srv2",
          uri: "test://b",
          resource: { uri: "test://b", name: "b" },
          content: "Content B",
        },
      ];

      const formatted = manager.formatResourcesForContext(resources);
      const parts = formatted.split("\n\n");

      expect(parts).toHaveLength(2);
      expect(parts[0]).toContain("Content A");
      expect(parts[1]).toContain("Content B");
    });

    it("should return empty string for empty array", () => {
      const formatted = manager.formatResourcesForContext([]);

      expect(formatted).toBe("");
    });

    it("should include description attribute when present", () => {
      const resources: readonly ResolvedResource[] = [
        {
          serverName: "srv",
          uri: "test://doc",
          resource: {
            uri: "test://doc",
            name: "doc",
            description: "API documentation",
          },
          content: "docs content",
        },
      ];

      const formatted = manager.formatResourcesForContext(resources);

      expect(formatted).toContain('description="API documentation"');
    });

    it("should include mimeType attribute when present", () => {
      const resources: readonly ResolvedResource[] = [
        {
          serverName: "srv",
          uri: "test://data.json",
          resource: {
            uri: "test://data.json",
            name: "data.json",
            mimeType: "application/json",
          },
          content: '{"key": "value"}',
        },
      ];

      const formatted = manager.formatResourcesForContext(resources);

      expect(formatted).toContain('mimeType="application/json"');
    });

    it("should escape XML special characters in attributes", () => {
      const resources: readonly ResolvedResource[] = [
        {
          serverName: "srv",
          uri: "test://doc",
          resource: {
            uri: "test://doc",
            name: "doc",
            description: 'Contains "quotes" & <brackets>',
          },
          content: "content",
        },
      ];

      const formatted = manager.formatResourcesForContext(resources);

      expect(formatted).toContain("&quot;quotes&quot;");
      expect(formatted).toContain("&amp;");
      expect(formatted).toContain("&lt;brackets&gt;");
    });
  });

  describe("getCacheStats", () => {
    it("should start with zero stats", () => {
      const stats = manager.getCacheStats();

      expect(stats).toEqual({ size: 0, hits: 0, misses: 0 });
    });

    it("should track size correctly after reads", async () => {
      const client = createMockClient([], "content");

      await manager.readResource(client, "srv", "test://a");
      await manager.readResource(client, "srv", "test://b");

      expect(manager.getCacheStats().size).toBe(2);
    });

    it("should increment hits on cache hit", async () => {
      const client = createMockClient([], "content");

      await manager.readResource(client, "srv", "test://a");
      await manager.readResource(client, "srv", "test://a");
      await manager.readResource(client, "srv", "test://a");

      const stats = manager.getCacheStats();
      expect(stats.hits).toBe(2);
      expect(stats.misses).toBe(1);
    });
  });

  describe("clearCache", () => {
    it("should clear all cache entries", async () => {
      const client = createMockClient([], "content");

      await manager.readResource(client, "srv", "test://a");
      await manager.readResource(client, "srv", "test://b");
      expect(manager.getCacheStats().size).toBe(2);

      manager.clearCache();

      expect(manager.getCacheStats()).toEqual({ size: 0, hits: 0, misses: 0 });
    });

    it("should reset hit/miss counters", async () => {
      const client = createMockClient([], "content");

      await manager.readResource(client, "srv", "test://a");
      await manager.readResource(client, "srv", "test://a");

      manager.clearCache();

      const stats = manager.getCacheStats();
      expect(stats.hits).toBe(0);
      expect(stats.misses).toBe(0);
    });
  });

  describe("clearExpiredCache", () => {
    it("should remove expired entries", async () => {
      const shortTtlManager = new MCPResourceManager(1);
      const client = createMockClient([], "content");

      await shortTtlManager.readResource(client, "srv", "test://a");
      expect(shortTtlManager.getCacheStats().size).toBe(1);

      // Wait for TTL to expire
      await new Promise((r) => setTimeout(r, 10));

      shortTtlManager.clearExpiredCache();

      expect(shortTtlManager.getCacheStats().size).toBe(0);
    });

    it("should keep non-expired entries", async () => {
      // Use a long TTL so entries never expire during test
      const longTtlManager = new MCPResourceManager(60_000);
      const client = createMockClient([], "content");

      await longTtlManager.readResource(client, "srv", "test://a");

      longTtlManager.clearExpiredCache();

      expect(longTtlManager.getCacheStats().size).toBe(1);
    });

    it("should handle empty cache gracefully", () => {
      // Should not throw
      manager.clearExpiredCache();
      expect(manager.getCacheStats().size).toBe(0);
    });
  });

  describe("MCPResourceError", () => {
    it("should be an instance of Error with proper code", () => {
      const error = new MCPResourceError("test error", { uri: "test://doc" });

      expect(error).toBeInstanceOf(Error);
      expect(error.code).toBe("MCP_RESOURCE_ERROR");
      expect(error.message).toBe("test error");
      expect(error.context).toEqual({ uri: "test://doc" });
    });

    it("should freeze context object", () => {
      const error = new MCPResourceError("test", { key: "value" });

      expect(Object.isFrozen(error.context)).toBe(true);
    });
  });
});
