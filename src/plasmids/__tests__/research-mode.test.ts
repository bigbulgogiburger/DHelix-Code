import { describe, expect, it, vi } from "vitest";

import {
  PlasmidResearchError,
  runResearchMode,
  type ResearchDeps,
  type ResearchInput,
  type WebFetchFn,
  type WebSearchFn,
} from "../research-mode.js";
import type { PlasmidMetadata } from "../types.js";

// ─── Test helpers ──────────────────────────────────────────────────────────

interface DepsOverrides {
  search?: WebSearchFn;
  fetch?: WebFetchFn;
  llm?: ResearchDeps["llm"];
  now?: () => Date;
  allowNetwork?: boolean;
}

const FIXED_NOW = new Date("2026-04-24T12:00:00Z");

function makeDeps(over: DepsOverrides = {}): ResearchDeps {
  return {
    search:
      over.search ??
      vi.fn(async () => [
        { url: "https://a.example/x", title: "A doc kubernetes", snippet: "k8s intro" },
        { url: "https://b.example/y", title: "B doc kubernetes", snippet: "k8s deep" },
        { url: "https://c.example/z", title: "C doc kubernetes", snippet: "k8s tips" },
      ]),
    fetch:
      over.fetch ??
      vi.fn(async ({ url }) => ({
        body: `body of ${url}`,
        contentSha256: "f".repeat(64),
      })),
    llm: over.llm ?? vi.fn(async () => "## Synthesised body\n\nGrounded in [1] and [2]."),
    now: over.now ?? (() => FIXED_NOW),
    allowNetwork: over.allowNetwork,
  };
}

function makeInput(over: Partial<ResearchInput> = {}): ResearchInput {
  return {
    intent: "kubernetes networking best practices",
    ...over,
  };
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe("runResearchMode — happy path", () => {
  it("returns 3 references with contentSha256 when 3 results all fetch successfully", async () => {
    const deps = makeDeps();
    const result = await runResearchMode(makeInput(), deps, new AbortController().signal);

    expect(result.sources.references).toHaveLength(3);
    for (const ref of result.sources.references) {
      expect(ref.contentSha256).toBe("f".repeat(64));
      expect(ref.fetchedAt).toBe(FIXED_NOW.toISOString());
    }
    expect(result.sources.engine).toBe("web");
    expect(result.sources.query).toBe("kubernetes networking best practices");
    expect(result.synthesizedDraft).toContain("Synthesised body");
    expect(deps.llm).toHaveBeenCalledTimes(1);
  });

  it("passes a system prompt that embeds source bodies and instructs inline citations", async () => {
    const llmSpy: ResearchDeps["llm"] = vi.fn(async () => "ok");
    const deps = makeDeps({ llm: llmSpy });
    await runResearchMode(makeInput(), deps, new AbortController().signal);

    const mock = vi.mocked(llmSpy);
    expect(mock).toHaveBeenCalledTimes(1);
    const call = mock.mock.calls[0]![0];
    expect(call.system).toMatch(/\[1\]/);
    expect(call.system).toMatch(/\[2\]/);
    expect(call.system).toMatch(/cite source IDs inline as \[1\], \[2\]/);
    expect(call.system).toContain("body of https://a.example/x");
    expect(call.user).toContain("kubernetes networking best practices");
  });
});

describe("runResearchMode — privacy gate", () => {
  it("throws PLASMID_RESEARCH_PRIVACY_BLOCKED when currentDraft.privacy is local-only (BEFORE any DI call)", async () => {
    const deps = makeDeps();
    const draft: Partial<PlasmidMetadata> = { privacy: "local-only" };

    await expect(
      runResearchMode(
        makeInput({ currentDraft: draft }),
        deps,
        new AbortController().signal,
      ),
    ).rejects.toMatchObject({
      name: "PlasmidResearchError",
      code: "PLASMID_RESEARCH_PRIVACY_BLOCKED",
    });
    expect(deps.search).not.toHaveBeenCalled();
    expect(deps.fetch).not.toHaveBeenCalled();
    expect(deps.llm).not.toHaveBeenCalled();
  });

  it("throws PLASMID_RESEARCH_PRIVACY_BLOCKED when deps.allowNetwork === false (BEFORE any DI call)", async () => {
    const deps = makeDeps({ allowNetwork: false });

    const error = await runResearchMode(makeInput(), deps, new AbortController().signal).catch(
      (e: unknown) => e,
    );
    expect(error).toBeInstanceOf(PlasmidResearchError);
    expect((error as PlasmidResearchError).code).toBe("PLASMID_RESEARCH_PRIVACY_BLOCKED");
    expect(deps.search).not.toHaveBeenCalled();
    expect(deps.fetch).not.toHaveBeenCalled();
    expect(deps.llm).not.toHaveBeenCalled();
  });
});

describe("runResearchMode — empty search", () => {
  it("returns an empty synthesizedDraft + warning, NO error, when search yields 0 results", async () => {
    const deps = makeDeps({ search: vi.fn(async () => []) });
    const result = await runResearchMode(makeInput(), deps, new AbortController().signal);

    expect(result.synthesizedDraft).toBe("");
    expect(result.sources.references).toHaveLength(0);
    expect(result.warnings.length).toBeGreaterThan(0);
    expect(result.warnings[0]).toMatch(/0 results/);
    expect(deps.fetch).not.toHaveBeenCalled();
    expect(deps.llm).not.toHaveBeenCalled();
  });
});

describe("runResearchMode — partial fetch failure", () => {
  it("records 3 refs with the failing one missing contentSha256", async () => {
    const fetchMock = vi.fn(async ({ url }) => {
      if (url.includes("b.example")) throw new Error("network down");
      return { body: `body of ${url}`, contentSha256: "a".repeat(64) };
    });
    const deps = makeDeps({ fetch: fetchMock });
    const result = await runResearchMode(makeInput(), deps, new AbortController().signal);

    expect(result.sources.references).toHaveLength(3);
    const failed = result.sources.references.filter((r) => r.contentSha256 === undefined);
    expect(failed).toHaveLength(1);
    expect(failed[0].url).toContain("b.example");
    // LLM still ran since at least one fetch succeeded.
    expect(deps.llm).toHaveBeenCalledTimes(1);
    expect(result.warnings.some((w) => w.includes("Fetch failed"))).toBe(true);
  });
});

describe("runResearchMode — dedupe", () => {
  it("collapses 5 results with 2 duplicate canonical URLs into <=3 refs", async () => {
    const deps = makeDeps({
      search: vi.fn(async () => [
        { url: "https://a.example/x?utm_source=hn", title: "A1", snippet: "k8s" },
        { url: "https://a.example/x", title: "A2", snippet: "k8s" }, // dup of A1
        { url: "https://b.example/y", title: "B kubernetes", snippet: "" },
        { url: "https://b.example/y/", title: "B2 dup", snippet: "" }, // dup of B
        { url: "https://c.example/z", title: "C kubernetes", snippet: "" },
      ]),
    });
    const result = await runResearchMode(makeInput(), deps, new AbortController().signal);
    expect(result.sources.references.length).toBeLessThanOrEqual(3);
    const urls = result.sources.references.map((r) => r.url);
    // No duplicate URLs in output.
    expect(new Set(urls).size).toBe(urls.length);
  });
});

describe("runResearchMode — abort propagation", () => {
  it("propagates AbortError when signal is aborted mid-fetch", async () => {
    const controller = new AbortController();
    const fetchMock = vi.fn(async ({ url }) => {
      if (url.includes("b.example")) {
        controller.abort();
        const err = new Error("aborted");
        err.name = "AbortError";
        throw err;
      }
      return { body: `body of ${url}`, contentSha256: "1".repeat(64) };
    });
    const deps = makeDeps({ fetch: fetchMock });

    await expect(
      runResearchMode(makeInput(), deps, controller.signal),
    ).rejects.toMatchObject({ name: "AbortError" });
  });

  it("throws immediately when signal is already aborted before search runs", async () => {
    const controller = new AbortController();
    controller.abort();
    const deps = makeDeps();

    await expect(runResearchMode(makeInput(), deps, controller.signal)).rejects.toBeDefined();
    expect(deps.search).not.toHaveBeenCalled();
  });
});

describe("runResearchMode — tier defaulting", () => {
  it("defaults metadataPatch.tier to 'L2' when currentDraft.tier is absent", async () => {
    const deps = makeDeps();
    const result = await runResearchMode(makeInput(), deps, new AbortController().signal);
    expect(result.metadataPatch.tier).toBe("L2");
  });

  it("inherits currentDraft.tier when present (e.g. L3)", async () => {
    const deps = makeDeps();
    const result = await runResearchMode(
      makeInput({ currentDraft: { tier: "L3" } }),
      deps,
      new AbortController().signal,
    );
    expect(result.metadataPatch.tier).toBe("L3");
  });

  it("never defaults to L4 even with no draft", async () => {
    const deps = makeDeps();
    const result = await runResearchMode(makeInput(), deps, new AbortController().signal);
    expect(result.metadataPatch.tier).not.toBe("L4");
  });
});

describe("runResearchMode — caps + budgets", () => {
  it("caps maxSources at the hard ceiling (8) and warns", async () => {
    // Search returns 12 distinct results.
    const many = Array.from({ length: 12 }, (_, i) => ({
      url: `https://site${i}.example/`,
      title: `kubernetes guide ${i}`,
      snippet: "",
    }));
    const deps = makeDeps({ search: vi.fn(async () => many) });
    const result = await runResearchMode(
      makeInput({ maxSources: 50 }),
      deps,
      new AbortController().signal,
    );
    expect(result.sources.references.length).toBeLessThanOrEqual(8);
    expect(result.warnings.some((w) => w.includes("hard ceiling"))).toBe(true);
  });

  it("references include canonicalised URLs (tracking params stripped)", async () => {
    const deps = makeDeps({
      search: vi.fn(async () => [
        { url: "https://a.example/x?utm_source=feed&keep=1", title: "A kubernetes", snippet: "" },
      ]),
    });
    const result = await runResearchMode(makeInput(), deps, new AbortController().signal);
    expect(result.sources.references[0].url).toBe("https://a.example/x?keep=1");
  });
});

describe("runResearchMode — no fetch succeeded", () => {
  it("skips LLM synthesis and warns when every fetch fails", async () => {
    const deps = makeDeps({
      fetch: vi.fn(async () => {
        throw new Error("nope");
      }),
    });
    const result = await runResearchMode(makeInput(), deps, new AbortController().signal);
    expect(result.synthesizedDraft).toBe("");
    expect(deps.llm).not.toHaveBeenCalled();
    expect(result.sources.references).toHaveLength(3);
    for (const ref of result.sources.references) {
      expect(ref.contentSha256).toBeUndefined();
    }
    expect(result.warnings.some((w) => w.includes("No source body"))).toBe(true);
  });
});
