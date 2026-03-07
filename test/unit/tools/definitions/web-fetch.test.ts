import { describe, it, expect, vi } from "vitest";
import { webFetchTool } from "../../../../src/tools/definitions/web-fetch.js";

const context = {
  workingDirectory: process.cwd(),
  abortSignal: new AbortController().signal,
  timeoutMs: 30_000,
  platform: "darwin" as const,
};

describe("web_fetch tool", () => {
  it("should have correct metadata", () => {
    expect(webFetchTool.name).toBe("web_fetch");
    expect(webFetchTool.permissionLevel).toBe("confirm");
    expect(webFetchTool.timeoutMs).toBe(30_000);
  });

  it("should validate url parameter", () => {
    const result = webFetchTool.parameterSchema.safeParse({ url: "not-a-url" });
    expect(result.success).toBe(false);
  });

  it("should accept valid url parameter", () => {
    const result = webFetchTool.parameterSchema.safeParse({ url: "https://example.com" });
    expect(result.success).toBe(true);
  });

  it("should default maxLength to 100000", () => {
    const result = webFetchTool.parameterSchema.parse({ url: "https://example.com" });
    expect(result.maxLength).toBe(100_000);
  });

  it("should handle network errors gracefully", async () => {
    const result = await webFetchTool.execute(
      { url: "https://localhost:1/nonexistent", maxLength: 100_000 },
      context,
    );
    expect(result.isError).toBe(true);
    expect(result.output).toContain("Fetch failed");
  });

  it("should strip HTML tags from HTML responses", async () => {
    const mockResponse = new Response(
      "<html><head><title>Test</title></head><body><p>Hello World</p></body></html>",
      { headers: { "content-type": "text/html; charset=utf-8" } },
    );
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(mockResponse);

    const result = await webFetchTool.execute(
      { url: "https://example.com", maxLength: 100_000 },
      context,
    );

    expect(result.isError).toBe(false);
    expect(result.output).toContain("Hello World");
    expect(result.output).not.toContain("<p>");

    vi.restoreAllMocks();
  });

  it("should truncate long responses", async () => {
    const longContent = "a".repeat(200);
    const mockResponse = new Response(longContent, {
      headers: { "content-type": "text/plain" },
    });
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(mockResponse);

    const result = await webFetchTool.execute(
      { url: "https://example.com", maxLength: 100 },
      context,
    );

    expect(result.isError).toBe(false);
    expect(result.output).toContain("[Truncated");
    expect(result.metadata?.truncated).toBe(true);

    vi.restoreAllMocks();
  });

  it("should handle HTTP error status codes", async () => {
    const mockResponse = new Response("Not Found", { status: 404, statusText: "Not Found" });
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(mockResponse);

    const result = await webFetchTool.execute(
      { url: "https://example.com/404", maxLength: 100_000 },
      context,
    );

    expect(result.isError).toBe(true);
    expect(result.output).toContain("404");

    vi.restoreAllMocks();
  });

  it("should strip script and style tags from HTML", async () => {
    const html = `<html><script>alert("xss")</script><style>body{color:red}</style><p>Content</p></html>`;
    const mockResponse = new Response(html, {
      headers: { "content-type": "text/html" },
    });
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(mockResponse);

    const result = await webFetchTool.execute(
      { url: "https://example.com", maxLength: 100_000 },
      context,
    );

    expect(result.isError).toBe(false);
    expect(result.output).toContain("Content");
    expect(result.output).not.toContain("alert");
    expect(result.output).not.toContain("color:red");

    vi.restoreAllMocks();
  });
});
