import { describe, it, expect, vi, beforeEach } from "vitest";
import { webFetchTool, clearCache } from "../../../../src/tools/definitions/web-fetch.js";

const context = {
  workingDirectory: process.cwd(),
  abortSignal: new AbortController().signal,
  timeoutMs: 30_000,
  platform: "darwin" as const,
};

describe("web_fetch tool", () => {
  beforeEach(() => {
    clearCache();
    vi.restoreAllMocks();
  });

  // --- Metadata ---

  it("should have correct metadata", () => {
    expect(webFetchTool.name).toBe("web_fetch");
    expect(webFetchTool.permissionLevel).toBe("confirm");
    expect(webFetchTool.timeoutMs).toBe(30_000);
  });

  // --- Parameter validation ---

  it("should validate url parameter", () => {
    const result = webFetchTool.parameterSchema.safeParse({ url: "not-a-url" });
    expect(result.success).toBe(false);
  });

  it("should accept valid url parameter", () => {
    const result = webFetchTool.parameterSchema.safeParse({ url: "https://example.com" });
    expect(result.success).toBe(true);
  });

  it("should default maxLength to 50000", () => {
    const result = webFetchTool.parameterSchema.parse({ url: "https://example.com" });
    expect(result.maxLength).toBe(50_000);
  });

  it("should accept optional prompt parameter", () => {
    const result = webFetchTool.parameterSchema.parse({
      url: "https://example.com",
      prompt: "Extract the main heading",
    });
    expect(result.prompt).toBe("Extract the main heading");
  });

  // --- HTML stripping ---

  it("should strip HTML tags from HTML responses", async () => {
    const mockResponse = new Response(
      "<html><head><title>Test</title></head><body><p>Hello World</p></body></html>",
      { headers: { "content-type": "text/html; charset=utf-8" }, status: 200 },
    );
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(mockResponse);

    const result = await webFetchTool.execute(
      { url: "https://example.com", maxLength: 50_000 },
      context,
    );

    expect(result.isError).toBe(false);
    expect(result.output).toContain("Hello World");
    expect(result.output).not.toContain("<p>");
  });

  it("should strip script and style tags from HTML", async () => {
    const html = `<html><script>alert("xss")</script><style>body{color:red}</style><p>Content</p></html>`;
    const mockResponse = new Response(html, {
      headers: { "content-type": "text/html" },
      status: 200,
    });
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(mockResponse);

    const result = await webFetchTool.execute(
      { url: "https://example.com", maxLength: 50_000 },
      context,
    );

    expect(result.isError).toBe(false);
    expect(result.output).toContain("Content");
    expect(result.output).not.toContain("alert");
    expect(result.output).not.toContain("color:red");
  });

  it("should strip nav, footer, and header tags from HTML", async () => {
    const html = `<html><body>
      <nav><a href="/">Home</a><a href="/about">About</a></nav>
      <header><h1>Site Title</h1></header>
      <main><p>Main content here</p></main>
      <footer><p>Copyright 2024</p></footer>
    </body></html>`;
    const mockResponse = new Response(html, {
      headers: { "content-type": "text/html" },
      status: 200,
    });
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(mockResponse);

    const result = await webFetchTool.execute(
      { url: "https://example.com", maxLength: 50_000 },
      context,
    );

    expect(result.isError).toBe(false);
    expect(result.output).toContain("Main content here");
    expect(result.output).not.toContain("Home");
    expect(result.output).not.toContain("Copyright 2024");
    expect(result.output).not.toContain("Site Title");
  });

  // --- Truncation ---

  it("should truncate long responses", async () => {
    const longContent = "a".repeat(200);
    const mockResponse = new Response(longContent, {
      headers: { "content-type": "text/plain" },
      status: 200,
    });
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(mockResponse);

    const result = await webFetchTool.execute(
      { url: "https://example.com", maxLength: 100 },
      context,
    );

    expect(result.isError).toBe(false);
    expect(result.output).toContain("[Truncated");
    expect(result.metadata?.truncated).toBe(true);
  });

  // --- Error handling ---

  it("should handle HTTP 404 error", async () => {
    const mockResponse = new Response("Not Found", { status: 404, statusText: "Not Found" });
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(mockResponse);

    const result = await webFetchTool.execute(
      { url: "https://example.com/404", maxLength: 50_000 },
      context,
    );

    expect(result.isError).toBe(true);
    expect(result.output).toContain("404");
    expect(result.output).toContain("does not exist");
  });

  it("should handle HTTP 403 error", async () => {
    const mockResponse = new Response("Forbidden", { status: 403, statusText: "Forbidden" });
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(mockResponse);

    const result = await webFetchTool.execute(
      { url: "https://example.com/secret", maxLength: 50_000 },
      context,
    );

    expect(result.isError).toBe(true);
    expect(result.output).toContain("403");
    expect(result.output).toContain("Forbidden");
  });

  it("should handle HTTP 500 error", async () => {
    const mockResponse = new Response("Error", {
      status: 500,
      statusText: "Internal Server Error",
    });
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(mockResponse);

    const result = await webFetchTool.execute(
      { url: "https://example.com/error", maxLength: 50_000 },
      context,
    );

    expect(result.isError).toBe(true);
    expect(result.output).toContain("500");
    expect(result.output).toContain("Internal Server Error");
  });

  it("should handle network errors gracefully", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValueOnce(new Error("ECONNREFUSED"));

    const result = await webFetchTool.execute(
      { url: "https://localhost:1/nonexistent", maxLength: 50_000 },
      context,
    );

    expect(result.isError).toBe(true);
    expect(result.output).toContain("Fetch failed");
  });

  it("should handle timeout with descriptive message", async () => {
    const abortError = new Error("The operation was aborted");
    abortError.name = "AbortError";
    vi.spyOn(globalThis, "fetch").mockRejectedValueOnce(abortError);

    const result = await webFetchTool.execute(
      { url: "https://slow-server.example.com", maxLength: 50_000 },
      context,
    );

    expect(result.isError).toBe(true);
    expect(result.output).toContain("timed out");
  });

  // --- Caching ---

  it("should cache responses and return cached on second call", async () => {
    const mockResponse = new Response("Hello cached world", {
      headers: { "content-type": "text/plain" },
      status: 200,
    });
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(mockResponse);

    // First fetch
    const result1 = await webFetchTool.execute(
      { url: "https://example.com/cached", maxLength: 50_000 },
      context,
    );
    expect(result1.isError).toBe(false);
    expect(result1.metadata?.cached).toBe(false);

    // Second fetch — should come from cache, no additional fetch call
    const result2 = await webFetchTool.execute(
      { url: "https://example.com/cached", maxLength: 50_000 },
      context,
    );
    expect(result2.isError).toBe(false);
    expect(result2.output).toContain("[Cached response]");
    expect(result2.output).toContain("Hello cached world");
    expect(result2.metadata?.cached).toBe(true);

    // fetch should have been called only once
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
  });

  it("should evict oldest cache entry when cache is full (50 entries)", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");

    // Fill cache with 50 entries
    for (let i = 0; i < 50; i++) {
      fetchSpy.mockResolvedValueOnce(
        new Response(`content-${i}`, {
          headers: { "content-type": "text/plain" },
          status: 200,
        }),
      );
      await webFetchTool.execute(
        { url: `https://example.com/page-${i}`, maxLength: 50_000 },
        context,
      );
    }

    // All 50 should be cached — verify first entry is cached
    const checkFirst = await webFetchTool.execute(
      { url: "https://example.com/page-0", maxLength: 50_000 },
      context,
    );
    expect(checkFirst.metadata?.cached).toBe(true);

    // Add 51st entry — should evict page-0
    fetchSpy.mockResolvedValueOnce(
      new Response("content-50", {
        headers: { "content-type": "text/plain" },
        status: 200,
      }),
    );
    await webFetchTool.execute({ url: "https://example.com/page-50", maxLength: 50_000 }, context);

    // page-0 should now be evicted — fetch will be called again
    fetchSpy.mockResolvedValueOnce(
      new Response("content-0-refetched", {
        headers: { "content-type": "text/plain" },
        status: 200,
      }),
    );
    const evictedResult = await webFetchTool.execute(
      { url: "https://example.com/page-0", maxLength: 50_000 },
      context,
    );
    expect(evictedResult.metadata?.cached).toBe(false);
    expect(evictedResult.output).toContain("content-0-refetched");

    // page-2 should still be cached (page-1 was evicted when page-0 was re-added)
    const stillCached = await webFetchTool.execute(
      { url: "https://example.com/page-2", maxLength: 50_000 },
      context,
    );
    expect(stillCached.metadata?.cached).toBe(true);
  });

  // --- Prompt parameter ---

  it("should include extraction prompt in output when provided", async () => {
    const mockResponse = new Response("Some article content about TypeScript", {
      headers: { "content-type": "text/plain" },
      status: 200,
    });
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(mockResponse);

    const result = await webFetchTool.execute(
      {
        url: "https://example.com/article",
        maxLength: 50_000,
        prompt: "Extract the main topic",
      },
      context,
    );

    expect(result.isError).toBe(false);
    expect(result.output).toContain("[Extraction prompt: Extract the main topic]");
    expect(result.output).toContain("Some article content about TypeScript");
  });

  // --- Redirect tracking ---

  it("should track redirects and report final URL", async () => {
    const redirectResponse = new Response(null, {
      status: 301,
      headers: { location: "https://example.com/final" },
    });
    const finalResponse = new Response("Final destination", {
      headers: { "content-type": "text/plain" },
      status: 200,
    });
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    fetchSpy.mockResolvedValueOnce(redirectResponse);
    fetchSpy.mockResolvedValueOnce(finalResponse);

    const result = await webFetchTool.execute(
      { url: "https://example.com/redirect", maxLength: 50_000 },
      context,
    );

    expect(result.isError).toBe(false);
    expect(result.output).toContain("[Redirected to: https://example.com/final]");
    expect(result.output).toContain("Final destination");
    expect(result.metadata?.finalUrl).toBe("https://example.com/final");
  });

  it("should fail on too many redirects", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    // Create 6 redirect responses (exceeds limit of 5)
    for (let i = 0; i < 6; i++) {
      fetchSpy.mockResolvedValueOnce(
        new Response(null, {
          status: 302,
          headers: { location: `https://example.com/redirect-${i + 1}` },
        }),
      );
    }

    const result = await webFetchTool.execute(
      { url: "https://example.com/loop", maxLength: 50_000 },
      context,
    );

    expect(result.isError).toBe(true);
    expect(result.output).toContain("Too many redirects");
  });

  // --- HTTP → HTTPS upgrade ---

  it("should upgrade HTTP to HTTPS when possible", async () => {
    const httpsResponse = new Response("Secure content", {
      headers: { "content-type": "text/plain" },
      status: 200,
    });
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(httpsResponse);

    const result = await webFetchTool.execute(
      { url: "http://example.com/page", maxLength: 50_000 },
      context,
    );

    expect(result.isError).toBe(false);
    expect(result.output).toContain("[Upgraded to HTTPS]");
    expect(result.output).toContain("Secure content");
  });

  it("should fall back to HTTP if HTTPS fails", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    // HTTPS attempt fails
    fetchSpy.mockRejectedValueOnce(new Error("ECONNREFUSED"));
    // HTTP fallback succeeds
    fetchSpy.mockResolvedValueOnce(
      new Response("HTTP content", {
        headers: { "content-type": "text/plain" },
        status: 200,
      }),
    );

    const result = await webFetchTool.execute(
      { url: "http://example.com/http-only", maxLength: 50_000 },
      context,
    );

    expect(result.isError).toBe(false);
    expect(result.output).toContain("HTTP content");
    expect(result.output).not.toContain("[Upgraded to HTTPS]");
  });
});
