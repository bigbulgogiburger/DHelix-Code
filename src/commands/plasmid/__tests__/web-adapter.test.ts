/**
 * Phase 5 — Unit tests for `src/commands/plasmid/web-adapter.ts`.
 *
 * The adapter lives at Layer 5 (Platform / commands) because it wraps Layer-3
 * tool definitions (`web_search`, `web_fetch`). Placing it under `plasmids/`
 * would reach upward across layers (Leaf → Infrastructure) and is forbidden
 * by the CLAUDE.md dependency rule.
 *
 * Coverage matrix (Team-2 owns this surface — dev-guide §3):
 *   1. parseWebSearchOutput — Brave/DDG markdown shape (single + multi-hit)
 *   2. parseWebSearchOutput — empty-result sentinel
 *   3. computeContentSha256 — deterministic, stable for the same body
 *   4. stripFetchAnnotations — discards `[Cached response]` etc., keeps body
 *   5. webSearchAdapter — error mapping → PLASMID_RESEARCH_NETWORK_ERROR
 */
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  computeContentSha256,
  parseWebSearchOutput,
  stripFetchAnnotations,
  webFetchAdapter,
  webSearchAdapter,
} from "../web-adapter.js";
import { PlasmidError } from "../../../plasmids/errors.js";
import { webSearchTool } from "../../../tools/definitions/web-search.js";
import { webFetchTool } from "../../../tools/definitions/web-fetch.js";

describe("parseWebSearchOutput", () => {
  it("parses the canonical Brave/DDG markdown layout into structured hits", () => {
    const output = [
      'Web search results for "OWASP top 10":',
      "",
      "1. [OWASP Top Ten — A01:2021 Broken Access Control](https://owasp.org/Top10/A01_2021)",
      "   The most prevalent web app risk; missing access control checks.",
      "",
      "2. [OWASP Top Ten 2021 Overview](https://owasp.org/Top10/)",
      "   Annual ranking of the top 10 web app security risks.",
      "",
      "3. [Cheat Sheet: Access Control](https://cheatsheetseries.owasp.org/access_control)",
      "   Practical guidance for implementing access checks.",
    ].join("\n");

    const hits = parseWebSearchOutput(output);
    expect(hits).toHaveLength(3);
    expect(hits[0]).toEqual({
      title: "OWASP Top Ten — A01:2021 Broken Access Control",
      url: "https://owasp.org/Top10/A01_2021",
      snippet: "The most prevalent web app risk; missing access control checks.",
    });
    expect(hits[1]?.snippet).toMatch(/Annual ranking/u);
    // Snippet may be omitted when not present
    expect(hits[2]?.url).toBe("https://cheatsheetseries.owasp.org/access_control");
  });

  it("returns an empty array for the 'No results found' sentinel", () => {
    expect(parseWebSearchOutput('No results found for "obscure query".')).toEqual([]);
    expect(parseWebSearchOutput("")).toEqual([]);
    expect(parseWebSearchOutput("   ")).toEqual([]);
  });

  it("tolerates missing snippet lines (title-only rows)", () => {
    const output = [
      'Web search results for "x":',
      "",
      "1. [Title only](https://example.com/a)",
      "",
      "2. [Another title](https://example.com/b)",
    ].join("\n");
    const hits = parseWebSearchOutput(output);
    expect(hits).toHaveLength(2);
    expect(hits[0]).toEqual({ title: "Title only", url: "https://example.com/a" });
    expect(hits[0]?.snippet).toBeUndefined();
    expect(hits[1]?.title).toBe("Another title");
  });
});

describe("computeContentSha256", () => {
  it("computes a stable 64-char hex digest", () => {
    const digest = computeContentSha256("hello world");
    expect(digest).toMatch(/^[0-9a-f]{64}$/u);
    // Reference vector: sha256("hello world")
    expect(digest).toBe("b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9");
  });

  it("produces different digests for different bodies", () => {
    expect(computeContentSha256("a")).not.toBe(computeContentSha256("b"));
  });
});

describe("stripFetchAnnotations", () => {
  it("removes leading bracketed annotations", () => {
    const raw = [
      "[Cached response]",
      "",
      "[Extraction prompt: foo]",
      "",
      "Real body content",
      "",
      "Second paragraph",
    ].join("\n");
    expect(stripFetchAnnotations(raw)).toBe("Real body content\n\nSecond paragraph");
  });

  it("leaves bodies without annotations untouched", () => {
    const body = "Just a body\nwith two lines";
    expect(stripFetchAnnotations(body)).toBe(body);
  });

  it("does not strip unknown bracketed lines (avoids eating real content)", () => {
    const raw = "[unknown-marker]\n\nbody";
    expect(stripFetchAnnotations(raw)).toBe("[unknown-marker]\n\nbody");
  });
});

describe("webSearchAdapter — error mapping", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("maps tool failure into a typed PLASMID_RESEARCH_NETWORK_ERROR", async () => {
    vi.spyOn(webSearchTool, "execute").mockResolvedValueOnce({
      output: "Search timed out",
      isError: true,
      metadata: { engine: "DuckDuckGo" },
    });
    const ctrl = new AbortController();
    await expect(
      webSearchAdapter({ query: "anything", maxResults: 1, signal: ctrl.signal }),
    ).rejects.toMatchObject({
      code: "PLASMID_RESEARCH_NETWORK_ERROR",
    });
  });

  it("returned error is a PlasmidError instance (typed catch-friendly)", async () => {
    vi.spyOn(webSearchTool, "execute").mockResolvedValueOnce({
      output: "transport closed",
      isError: true,
    });
    const ctrl = new AbortController();
    try {
      await webSearchAdapter({ query: "x", maxResults: 1, signal: ctrl.signal });
      throw new Error("expected the adapter to throw");
    } catch (err) {
      expect(err).toBeInstanceOf(PlasmidError);
      expect((err as PlasmidError).code).toBe("PLASMID_RESEARCH_NETWORK_ERROR");
    }
  });

  it("happy path: parses tool output into structured hits", async () => {
    vi.spyOn(webSearchTool, "execute").mockResolvedValueOnce({
      output: [
        'Web search results for "x":',
        "",
        "1. [Title](https://example.com/p)",
        "   Description here.",
      ].join("\n"),
      isError: false,
    });
    const ctrl = new AbortController();
    const hits = await webSearchAdapter({ query: "x", maxResults: 1, signal: ctrl.signal });
    expect(hits).toEqual([
      { title: "Title", url: "https://example.com/p", snippet: "Description here." },
    ]);
  });
});

describe("webFetchAdapter — error mapping + sha256", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("maps tool failure into PLASMID_RESEARCH_NETWORK_ERROR", async () => {
    vi.spyOn(webFetchTool, "execute").mockResolvedValueOnce({
      output: "HTTP 404 Not Found",
      isError: true,
    });
    const ctrl = new AbortController();
    await expect(
      webFetchAdapter({ url: "https://example.com/missing", signal: ctrl.signal }),
    ).rejects.toMatchObject({ code: "PLASMID_RESEARCH_NETWORK_ERROR" });
  });

  it("strips annotations and computes a stable sha256 over the canonical body", async () => {
    const body = "Hello world";
    vi.spyOn(webFetchTool, "execute").mockResolvedValueOnce({
      output: ["[Cached response]", "", body].join("\n"),
      isError: false,
    });
    const ctrl = new AbortController();
    const result = await webFetchAdapter({ url: "https://example.com/", signal: ctrl.signal });
    expect(result.body).toBe(body);
    expect(result.contentSha256).toBe(computeContentSha256(body));
  });
});
