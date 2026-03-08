import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { webSearchTool } from "../../../../src/tools/definitions/web-search.js";

const context = {
  workingDirectory: process.cwd(),
  abortSignal: new AbortController().signal,
  timeoutMs: 10_000,
  platform: "darwin" as const,
};

describe("web_search tool", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    delete process.env.BRAVE_SEARCH_API_KEY;
  });

  it("should have correct metadata", () => {
    expect(webSearchTool.name).toBe("web_search");
    expect(webSearchTool.permissionLevel).toBe("safe");
    expect(webSearchTool.timeoutMs).toBe(10_000);
  });

  it("should validate query parameter is required", () => {
    const result = webSearchTool.parameterSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it("should accept valid query parameter", () => {
    const result = webSearchTool.parameterSchema.safeParse({ query: "TypeScript ESM" });
    expect(result.success).toBe(true);
  });

  it("should default max_results to 5", () => {
    const result = webSearchTool.parameterSchema.parse({ query: "test" });
    expect(result.max_results).toBe(5);
  });

  it("should reject max_results > 10", () => {
    const result = webSearchTool.parameterSchema.safeParse({ query: "test", max_results: 11 });
    expect(result.success).toBe(false);
  });

  it("should reject max_results < 1", () => {
    const result = webSearchTool.parameterSchema.safeParse({ query: "test", max_results: 0 });
    expect(result.success).toBe(false);
  });

  describe("Brave Search", () => {
    beforeEach(() => {
      process.env.BRAVE_SEARCH_API_KEY = "test-brave-key";
    });

    it("should use Brave Search when API key is set", async () => {
      const braveResponse = {
        web: {
          results: [
            {
              title: "TypeScript Docs",
              url: "https://typescriptlang.org",
              description: "TypeScript is a typed superset of JavaScript.",
            },
            {
              title: "ESM Guide",
              url: "https://nodejs.org/docs/esm",
              description: "Node.js ESM documentation.",
            },
          ],
        },
      };
      const mockResponse = new Response(JSON.stringify(braveResponse), {
        headers: { "content-type": "application/json" },
      });
      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(mockResponse);

      const result = await webSearchTool.execute(
        { query: "TypeScript ESM", max_results: 5 },
        context,
      );

      expect(result.isError).toBe(false);
      expect(result.output).toContain("TypeScript Docs");
      expect(result.output).toContain("https://typescriptlang.org");
      expect(result.output).toContain("ESM Guide");
      expect(result.metadata?.engine).toBe("Brave Search");
      expect(result.metadata?.resultCount).toBe(2);

      const fetchCall = vi.mocked(globalThis.fetch).mock.calls[0];
      expect(String(fetchCall[0])).toContain("api.search.brave.com");
      const headers = (fetchCall[1] as RequestInit).headers as Record<string, string>;
      expect(headers["X-Subscription-Token"]).toBe("test-brave-key");
    });

    it("should handle Brave API errors", async () => {
      const mockResponse = new Response("Unauthorized", { status: 401, statusText: "Unauthorized" });
      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(mockResponse);

      const result = await webSearchTool.execute(
        { query: "test query", max_results: 5 },
        context,
      );

      expect(result.isError).toBe(true);
      expect(result.output).toContain("Search failed");
      expect(result.output).toContain("401");
    });
  });

  describe("DuckDuckGo fallback", () => {
    it("should use DuckDuckGo when no API keys are set", async () => {
      const ddgHtml = `
        <div class="result">
          <a class="result__a" href="https://duckduckgo.com/l/?uddg=https%3A%2F%2Fexample.com%2Fesm&rut=abc">
            ESM <b>Guide</b>
          </a>
          <a class="result__snippet">Learn about <b>ESM</b> modules in Node.js</a>
        </div>
      `;
      const mockResponse = new Response(ddgHtml, {
        headers: { "content-type": "text/html" },
      });
      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(mockResponse);

      const result = await webSearchTool.execute(
        { query: "ESM modules", max_results: 5 },
        context,
      );

      expect(result.isError).toBe(false);
      expect(result.output).toContain("ESM Guide");
      expect(result.output).toContain("https://example.com/esm");
      expect(result.output).toContain("Learn about ESM modules in Node.js");
      expect(result.metadata?.engine).toBe("DuckDuckGo");
    });

    it("should handle DuckDuckGo HTTP errors", async () => {
      const mockResponse = new Response("Service Unavailable", {
        status: 503,
        statusText: "Service Unavailable",
      });
      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(mockResponse);

      const result = await webSearchTool.execute(
        { query: "test", max_results: 5 },
        context,
      );

      expect(result.isError).toBe(true);
      expect(result.output).toContain("Search failed");
    });

    it("should return no results message when HTML has no matches", async () => {
      const mockResponse = new Response("<html><body>No results</body></html>", {
        headers: { "content-type": "text/html" },
      });
      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(mockResponse);

      const result = await webSearchTool.execute(
        { query: "xyznonexistent123", max_results: 5 },
        context,
      );

      expect(result.isError).toBe(false);
      expect(result.output).toContain("No results found");
    });
  });

  it("should handle network errors gracefully", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValueOnce(new Error("Network error"));

    const result = await webSearchTool.execute(
      { query: "test", max_results: 5 },
      context,
    );

    expect(result.isError).toBe(true);
    expect(result.output).toContain("Search failed");
    expect(result.output).toContain("Network error");
  });

  it("should handle timeout (AbortError)", async () => {
    const abortError = new DOMException("The operation was aborted", "AbortError");
    vi.spyOn(globalThis, "fetch").mockRejectedValueOnce(abortError);

    const result = await webSearchTool.execute(
      { query: "slow query", max_results: 5 },
      context,
    );

    expect(result.isError).toBe(true);
    expect(result.output).toContain("Search timed out");
  });

  it("should respect max_results parameter with Brave", async () => {
    process.env.BRAVE_SEARCH_API_KEY = "test-key";
    const braveResponse = {
      web: {
        results: Array.from({ length: 10 }, (_, i) => ({
          title: `Result ${i + 1}`,
          url: `https://example.com/${i + 1}`,
          description: `Description ${i + 1}`,
        })),
      },
    };
    const mockResponse = new Response(JSON.stringify(braveResponse), {
      headers: { "content-type": "application/json" },
    });
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(mockResponse);

    const result = await webSearchTool.execute(
      { query: "test", max_results: 3 },
      context,
    );

    expect(result.isError).toBe(false);
    expect(result.metadata?.resultCount).toBe(3);
    expect(result.output).toContain("Result 1");
    expect(result.output).toContain("Result 3");
    expect(result.output).not.toContain("Result 4");
  });

  it("should format results with numbered list", async () => {
    process.env.BRAVE_SEARCH_API_KEY = "test-key";
    const braveResponse = {
      web: {
        results: [
          { title: "First", url: "https://first.com", description: "First desc" },
          { title: "Second", url: "https://second.com", description: "Second desc" },
        ],
      },
    };
    const mockResponse = new Response(JSON.stringify(braveResponse), {
      headers: { "content-type": "application/json" },
    });
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(mockResponse);

    const result = await webSearchTool.execute(
      { query: "test", max_results: 5 },
      context,
    );

    expect(result.output).toContain('Web search results for "test"');
    expect(result.output).toContain("1. [First](https://first.com)");
    expect(result.output).toContain("2. [Second](https://second.com)");
  });
});
