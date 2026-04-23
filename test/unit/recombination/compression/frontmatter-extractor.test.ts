import { describe, expect, it } from "vitest";

import { extractFrontmatter } from "../../../../src/recombination/compression/frontmatter-extractor.js";

import { makeIR } from "./_fixtures.js";

describe("extractFrontmatter", () => {
  it("produces an identity line with id · tier · scope · description", () => {
    const ir = makeIR({
      id: "owasp-gate",
      tier: "L2",
      description: "Gate code reviews on OWASP Top 10 findings.",
    });
    const result = extractFrontmatter(ir);
    expect(result.line).toContain("owasp-gate");
    expect(result.line).toContain(" · L2 · ");
    expect(result.line).toContain("local");
    expect(result.line).toContain("OWASP");
    expect(result.tokenEstimate).toBeGreaterThan(0);
  });

  it("truncates long descriptions with an ellipsis", () => {
    const long = "x".repeat(400);
    const ir = makeIR({ description: long });
    const { line } = extractFrontmatter(ir);
    expect(line.endsWith("…")).toBe(true);
    expect(line.length).toBeLessThan(long.length);
  });

  it("collapses internal whitespace in the description", () => {
    const ir = makeIR({ description: "multi\n\n\nline\t description" });
    const { line } = extractFrontmatter(ir);
    expect(line).toContain("multi line description");
  });

  it("stays deterministic given the same metadata", () => {
    const ir = makeIR();
    const a = extractFrontmatter(ir);
    const b = extractFrontmatter(ir);
    expect(a).toEqual(b);
  });
});
