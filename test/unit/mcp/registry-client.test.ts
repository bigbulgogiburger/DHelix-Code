import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  McpRegistryClient,
  McpRegistryClientError,
  type RegistryServer,
  type RegistrySearchOptions,
} from "../../../src/mcp/registry-client.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Create a minimal valid RegistryServer fixture */
function makeServer(
  partial: Partial<RegistryServer> & { id: string; name: string },
): RegistryServer {
  return {
    description: "A test server",
    version: "1.0.0",
    transport: "stdio",
    tools: [],
    tags: [],
    updatedAt: "2026-01-01T00:00:00Z",
    ...partial,
  };
}

/** Build a Response-like object for fetch mocks */
function makeResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as unknown as Response;
}

// ---------------------------------------------------------------------------
// Fetch mock setup
// ---------------------------------------------------------------------------

const fetchMock = vi.fn<typeof fetch>();

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockReset();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

// ---------------------------------------------------------------------------
// McpRegistryClientError
// ---------------------------------------------------------------------------

describe("McpRegistryClientError", () => {
  it("should extend BaseError with correct code", () => {
    const err = new McpRegistryClientError("fail", { serverId: "x" });
    expect(err.message).toBe("fail");
    expect(err.code).toBe("MCP_REGISTRY_CLIENT_ERROR");
    expect(err.context).toEqual({ serverId: "x" });
    expect(err.name).toBe("McpRegistryClientError");
  });

  it("should default to empty context", () => {
    const err = new McpRegistryClientError("oops");
    expect(err.context).toEqual({});
  });
});

// ---------------------------------------------------------------------------
// Constructor / config
// ---------------------------------------------------------------------------

describe("McpRegistryClient — constructor", () => {
  it("should be instantiated without arguments", () => {
    const client = new McpRegistryClient();
    expect(client).toBeInstanceOf(McpRegistryClient);
  });

  it("should accept custom config", () => {
    const client = new McpRegistryClient({
      registryUrl: "https://custom.example.com/api",
      cacheDir: "/tmp/test-cache",
      cacheTtlMs: 5_000,
    });
    expect(client).toBeInstanceOf(McpRegistryClient);
  });
});

// ---------------------------------------------------------------------------
// search()
// ---------------------------------------------------------------------------

describe("McpRegistryClient — search()", () => {
  it("should return an empty array when the registry returns no servers", async () => {
    fetchMock.mockResolvedValueOnce(makeResponse({ servers: [] }));

    const client = new McpRegistryClient();
    const results = await client.search();

    expect(results).toEqual([]);
  });

  it("should return parsed servers from the registry", async () => {
    const server = makeServer({ id: "s1", name: "Server One" });
    fetchMock.mockResolvedValueOnce(makeResponse({ servers: [server] }));

    const client = new McpRegistryClient();
    const results = await client.search();

    expect(results).toHaveLength(1);
    expect(results[0].id).toBe("s1");
    expect(results[0].name).toBe("Server One");
  });

  it("should skip items missing required fields", async () => {
    fetchMock.mockResolvedValueOnce(
      makeResponse({
        servers: [
          {
            id: "ok",
            name: "Good Server",
            transport: "stdio",
            tools: [],
            tags: [],
            updatedAt: "2026-01-01T00:00:00Z",
          },
          { name: "Missing ID" }, // no id
          { id: "missing-name" }, // no name
        ],
      }),
    );

    const client = new McpRegistryClient();
    const results = await client.search();

    expect(results).toHaveLength(1);
    expect(results[0].id).toBe("ok");
  });

  it("should fall back to empty array on network error", async () => {
    fetchMock.mockRejectedValueOnce(new Error("Network failure"));

    const client = new McpRegistryClient();
    const results = await client.search();

    expect(results).toEqual([]);
  });

  it("should fall back to empty array on non-2xx response", async () => {
    fetchMock.mockResolvedValueOnce(makeResponse({}, 500));

    const client = new McpRegistryClient();
    const results = await client.search();

    expect(results).toEqual([]);
  });

  it("should cache results and not fetch again within TTL", async () => {
    const server = makeServer({ id: "s1", name: "Server One" });
    fetchMock.mockResolvedValue(makeResponse({ servers: [server] }));

    const client = new McpRegistryClient({ cacheTtlMs: 60_000 });
    const opts: RegistrySearchOptions = { query: "foo" };

    await client.search(opts);
    await client.search(opts);

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("should fetch again after cache TTL expires", async () => {
    vi.useFakeTimers();
    const server = makeServer({ id: "s1", name: "Server One" });
    fetchMock.mockResolvedValue(makeResponse({ servers: [server] }));

    const client = new McpRegistryClient({ cacheTtlMs: 100 });
    const opts: RegistrySearchOptions = { query: "bar" };

    await client.search(opts);

    vi.advanceTimersByTime(200);
    await client.search(opts);

    vi.useRealTimers();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("should include query, tags, transport, sortBy, limit, offset in URL", async () => {
    fetchMock.mockResolvedValueOnce(makeResponse({ servers: [] }));

    const client = new McpRegistryClient();
    await client.search({
      query: "github",
      tags: ["vcs", "git"],
      transport: "stdio",
      sortBy: "downloads",
      limit: 10,
      offset: 5,
    });

    const calledUrl = (fetchMock.mock.calls[0] as [string, ...unknown[]])[0];
    expect(calledUrl).toContain("q=github");
    expect(calledUrl).toContain("tag=vcs");
    expect(calledUrl).toContain("tag=git");
    expect(calledUrl).toContain("transport=stdio");
    expect(calledUrl).toContain("sortBy=downloads");
    expect(calledUrl).toContain("limit=10");
    expect(calledUrl).toContain("offset=5");
  });

  it("should default transport to stdio when absent in response", async () => {
    fetchMock.mockResolvedValueOnce(
      makeResponse({
        servers: [
          {
            id: "x",
            name: "X",
            description: "d",
            version: "1.0.0",
            tools: [],
            tags: [],
            updatedAt: "2026-01-01T00:00:00Z",
          },
        ],
      }),
    );

    const client = new McpRegistryClient();
    const [server] = await client.search();

    expect(server.transport).toBe("stdio");
  });

  it("should update lastFetched stat after a successful fetch", async () => {
    fetchMock.mockResolvedValueOnce(makeResponse({ servers: [] }));

    const client = new McpRegistryClient();
    expect(client.getStats().lastFetched).toBeNull();

    await client.search();
    expect(client.getStats().lastFetched).toBeInstanceOf(Date);
  });
});

// ---------------------------------------------------------------------------
// getServerDetail()
// ---------------------------------------------------------------------------

describe("McpRegistryClient — getServerDetail()", () => {
  it("should return server detail on success", async () => {
    const server = makeServer({
      id: "github-srv",
      name: "GitHub Server",
      installCommand: "npx @mcp/server-github",
    });
    fetchMock.mockResolvedValueOnce(makeResponse(server));

    const client = new McpRegistryClient();
    const result = await client.getServerDetail("github-srv");

    expect(result).not.toBeNull();
    expect(result!.id).toBe("github-srv");
    expect(result!.installCommand).toBe("npx @mcp/server-github");
  });

  it("should return null for a 404 response", async () => {
    fetchMock.mockResolvedValueOnce(makeResponse({}, 404));

    const client = new McpRegistryClient();
    const result = await client.getServerDetail("nonexistent");

    expect(result).toBeNull();
  });

  it("should return null for network error", async () => {
    fetchMock.mockRejectedValueOnce(new Error("timeout"));

    const client = new McpRegistryClient();
    const result = await client.getServerDetail("some-server");

    expect(result).toBeNull();
  });

  it("should return null for empty serverId", async () => {
    const client = new McpRegistryClient();
    const result = await client.getServerDetail("");

    expect(result).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("should cache detail results within TTL", async () => {
    const server = makeServer({ id: "s1", name: "S1" });
    fetchMock.mockResolvedValue(makeResponse(server));

    const client = new McpRegistryClient({ cacheTtlMs: 60_000 });

    await client.getServerDetail("s1");
    await client.getServerDetail("s1");

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("should URL-encode the serverId in the request", async () => {
    fetchMock.mockResolvedValueOnce(makeResponse(null, 404));

    const client = new McpRegistryClient({ registryUrl: "https://reg.test/api/v1" });
    await client.getServerDetail("my server/v2");

    const calledUrl = (fetchMock.mock.calls[0] as [string, ...unknown[]])[0];
    expect(calledUrl).toContain(encodeURIComponent("my server/v2"));
  });
});

// ---------------------------------------------------------------------------
// install()
// ---------------------------------------------------------------------------

describe("McpRegistryClient — install()", () => {
  it("should throw McpRegistryClientError when server is not found", async () => {
    fetchMock.mockResolvedValueOnce(makeResponse({}, 404));

    const client = new McpRegistryClient();
    await expect(client.install("missing-id")).rejects.toThrow(McpRegistryClientError);
  });

  it("should throw McpRegistryClientError when installCommand is absent", async () => {
    const server = makeServer({ id: "no-cmd", name: "No Command" });
    // no installCommand
    fetchMock.mockResolvedValueOnce(makeResponse(server));

    const client = new McpRegistryClient();
    await expect(client.install("no-cmd")).rejects.toThrow(McpRegistryClientError);
  });

  it("should execute installCommand and return result", async () => {
    const server = makeServer({
      id: "gh",
      name: "GitHub",
      installCommand: "echo installed",
    });
    fetchMock.mockResolvedValueOnce(makeResponse(server));

    const client = new McpRegistryClient();
    const result = await client.install("gh");

    expect(result.success).toBe(true);
    expect(result.command).toBe("echo installed");
    expect(result.output).toContain("installed");
  });

  it("should add the server id to listInstalled() after success", async () => {
    const server = makeServer({
      id: "gh",
      name: "GitHub",
      installCommand: "echo installed",
    });
    fetchMock.mockResolvedValueOnce(makeResponse(server));

    const client = new McpRegistryClient();
    expect(client.listInstalled()).toHaveLength(0);

    await client.install("gh");
    expect(client.listInstalled()).toContain("gh");
  });
});

// ---------------------------------------------------------------------------
// listInstalled()
// ---------------------------------------------------------------------------

describe("McpRegistryClient — listInstalled()", () => {
  it("should return empty list initially", () => {
    const client = new McpRegistryClient();
    expect(client.listInstalled()).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// clearCache()
// ---------------------------------------------------------------------------

describe("McpRegistryClient — clearCache()", () => {
  it("should clear search cache so next call re-fetches", async () => {
    fetchMock.mockResolvedValue(makeResponse({ servers: [] }));

    const client = new McpRegistryClient({ cacheTtlMs: 60_000 });
    await client.search({ query: "foo" });

    client.clearCache();
    await client.search({ query: "foo" });

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("should clear detail cache", async () => {
    const server = makeServer({ id: "s1", name: "S1" });
    fetchMock.mockResolvedValue(makeResponse(server));

    const client = new McpRegistryClient({ cacheTtlMs: 60_000 });
    await client.getServerDetail("s1");

    client.clearCache();
    await client.getServerDetail("s1");

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

// ---------------------------------------------------------------------------
// getStats()
// ---------------------------------------------------------------------------

describe("McpRegistryClient — getStats()", () => {
  it("should report zero cached items initially", () => {
    const client = new McpRegistryClient();
    expect(client.getStats().cached).toBe(0);
    expect(client.getStats().lastFetched).toBeNull();
  });

  it("should count cached search and detail entries", async () => {
    const server = makeServer({ id: "s1", name: "S1" });
    fetchMock.mockResolvedValue(makeResponse({ servers: [server] }));

    const client = new McpRegistryClient({ cacheTtlMs: 60_000 });
    await client.search({ query: "a" });
    await client.search({ query: "b" });

    const stats = client.getStats();
    expect(stats.cached).toBe(2);
    expect(stats.lastFetched).toBeInstanceOf(Date);
  });

  it("should reflect zero cached entries after clearCache", async () => {
    fetchMock.mockResolvedValue(makeResponse({ servers: [] }));

    const client = new McpRegistryClient({ cacheTtlMs: 60_000 });
    await client.search();

    client.clearCache();
    expect(client.getStats().cached).toBe(0);
  });
});
