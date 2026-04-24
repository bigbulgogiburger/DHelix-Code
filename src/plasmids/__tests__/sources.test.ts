import { describe, expect, it } from "vitest";

import {
  canonicalizeUrl,
  dedupeByCanonicalUrl,
  rankByIntentOverlap,
  topN,
  type Candidate,
} from "../research/sources.js";

describe("canonicalizeUrl", () => {
  it("lowercases the host but preserves path casing", () => {
    expect(canonicalizeUrl("HTTPS://Example.COM/Docs/Page")).toBe(
      "https://example.com/Docs/Page",
    );
  });

  it("strips utm_*, gclid, fbclid, ref tracking params", () => {
    const out = canonicalizeUrl(
      "https://example.com/x?utm_source=feed&gclid=abc&fbclid=xyz&ref=hn&keep=1",
    );
    expect(out).toBe("https://example.com/x?keep=1");
  });

  it("strips trailing slash from non-root paths but keeps it for root", () => {
    expect(canonicalizeUrl("https://example.com/docs/")).toBe(
      "https://example.com/docs",
    );
    expect(canonicalizeUrl("https://example.com/")).toBe("https://example.com/");
  });

  it("sorts query parameters so equivalent URLs collapse", () => {
    const a = canonicalizeUrl("https://example.com/q?b=2&a=1");
    const b = canonicalizeUrl("https://example.com/q?a=1&b=2");
    expect(a).toBe(b);
  });

  it("preserves fragments and ports", () => {
    expect(canonicalizeUrl("https://example.com:8080/p#section")).toBe(
      "https://example.com:8080/p#section",
    );
  });

  it("returns the input verbatim for unparseable URLs", () => {
    expect(canonicalizeUrl("not a url at all")).toBe("not a url at all");
  });

  it("treats utm_* prefix case-insensitively", () => {
    const out = canonicalizeUrl("https://example.com/x?UTM_Source=foo&keep=1");
    expect(out).toBe("https://example.com/x?keep=1");
  });
});

describe("dedupeByCanonicalUrl", () => {
  it("collapses two URLs that differ only in tracking params", () => {
    const refs: readonly Candidate[] = [
      { url: "https://example.com/a?utm_source=hn", title: "A1" },
      { url: "https://example.com/a", title: "A2" },
    ];
    const out = dedupeByCanonicalUrl(refs);
    expect(out).toHaveLength(1);
    // First wins: keeps the first title.
    expect(out[0].title).toBe("A1");
    // URL is canonicalised in the output.
    expect(out[0].url).toBe("https://example.com/a");
  });

  it("preserves order across distinct URLs", () => {
    const refs: readonly Candidate[] = [
      { url: "https://a.example/", title: "A" },
      { url: "https://b.example/", title: "B" },
      { url: "https://c.example/", title: "C" },
    ];
    const out = dedupeByCanonicalUrl(refs);
    expect(out.map((r) => r.title)).toEqual(["A", "B", "C"]);
  });

  it("dedupes case-insensitive hosts and trailing-slash variants together", () => {
    const refs: readonly Candidate[] = [
      { url: "https://EXAMPLE.com/docs/", title: "first" },
      { url: "https://example.com/docs", title: "second" },
      { url: "https://example.com/docs?utm_source=x", title: "third" },
    ];
    const out = dedupeByCanonicalUrl(refs);
    expect(out).toHaveLength(1);
    expect(out[0].title).toBe("first");
  });
});

describe("rankByIntentOverlap", () => {
  it("ranks candidates with more title hits higher than snippet-only hits", () => {
    const refs: readonly Candidate[] = [
      { url: "https://1/", title: "Random unrelated topic", snippet: "owasp top 10 cheat" },
      { url: "https://2/", title: "OWASP Top 10 Guide", snippet: "intro" },
    ];
    const out = rankByIntentOverlap("OWASP top 10", refs);
    expect(out[0].url).toBe("https://2/");
  });

  it("returns input order when intent has no scoreable tokens", () => {
    const refs: readonly Candidate[] = [
      { url: "https://1/", title: "first" },
      { url: "https://2/", title: "second" },
    ];
    const out = rankByIntentOverlap("!! ?? ::", refs);
    expect(out.map((r) => r.url)).toEqual(["https://1/", "https://2/"]);
  });

  it("is stable: equal scores preserve input order", () => {
    const refs: readonly Candidate[] = [
      { url: "https://1/", title: "alpha unrelated", snippet: "" },
      { url: "https://2/", title: "beta unrelated", snippet: "" },
    ];
    const out = rankByIntentOverlap("kubernetes", refs);
    expect(out.map((r) => r.url)).toEqual(["https://1/", "https://2/"]);
  });

  it("handles unicode tokens (Korean) gracefully", () => {
    const refs: readonly Candidate[] = [
      { url: "https://1/", title: "보안 가이드", snippet: "" },
      { url: "https://2/", title: "unrelated cooking", snippet: "" },
    ];
    const out = rankByIntentOverlap("보안 점검", refs);
    expect(out[0].url).toBe("https://1/");
  });

  it("ignores tokens shorter than 2 chars (noise floor)", () => {
    const refs: readonly Candidate[] = [
      { url: "https://1/", title: "a b c d e", snippet: "" }, // single chars only
      { url: "https://2/", title: "kubernetes networking", snippet: "" },
    ];
    const out = rankByIntentOverlap("a b kubernetes", refs);
    expect(out[0].url).toBe("https://2/");
  });
});

describe("topN", () => {
  it("returns first n items", () => {
    expect(topN([1, 2, 3, 4, 5], 3)).toEqual([1, 2, 3]);
  });

  it("returns a fresh copy when n >= length", () => {
    const src = [1, 2, 3];
    const out = topN(src, 10);
    expect(out).toEqual([1, 2, 3]);
    expect(out).not.toBe(src);
  });

  it("returns empty list when n <= 0", () => {
    expect(topN([1, 2, 3], 0)).toEqual([]);
    expect(topN([1, 2, 3], -5)).toEqual([]);
  });
});
