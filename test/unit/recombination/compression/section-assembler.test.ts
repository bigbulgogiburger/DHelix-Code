import { describe, expect, it } from "vitest";

import { assembleSections } from "../../../../src/recombination/compression/section-assembler.js";
import type {
  PlasmidId,
  PlasmidTier,
} from "../../../../src/plasmids/types.js";
import type {
  CompressedPlasmidSummary,
  PromptSectionBucket,
} from "../../../../src/recombination/types.js";

function makeSummary(
  id: string,
  bucket: PromptSectionBucket,
  opts: { readonly tier?: PlasmidTier; readonly markdown?: string } = {},
): CompressedPlasmidSummary {
  return {
    plasmidId: id as PlasmidId,
    bucket,
    tier: opts.tier ?? "L2",
    markdown: opts.markdown ?? `body of ${id}`,
    tokenEstimate: 40,
    preservedConstraints: [],
    cacheKey: `ck-${id}`,
  };
}

describe("assembleSections", () => {
  it("returns an empty array for an empty input", () => {
    expect(assembleSections([])).toEqual([]);
  });

  it("skips project-profile summaries (Layer D owns that bucket)", () => {
    const sections = assembleSections([
      makeSummary("a", "project-profile"),
    ]);
    expect(sections).toEqual([]);
  });

  it("groups summaries by bucket into separate files", () => {
    const sections = assembleSections([
      makeSummary("alpha", "constraints"),
      makeSummary("beta", "capabilities"),
      makeSummary("gamma", "constraints"),
    ]);
    expect(sections).toHaveLength(2);
    const byBucket = Object.fromEntries(
      sections.map((s) => [s.bucket, s] as const),
    );
    expect(byBucket.constraints?.memberPlasmidIds).toEqual(["alpha", "gamma"]);
    expect(byBucket.capabilities?.memberPlasmidIds).toEqual(["beta"]);
  });

  it("produces BEGIN/END markers for each plasmid", () => {
    const [section] = assembleSections([
      makeSummary("alpha", "constraints", { markdown: "line A" }),
      makeSummary("beta", "constraints", { markdown: "line B" }),
    ]);
    expect(section?.markdown).toContain("<!-- BEGIN plasmid: alpha -->");
    expect(section?.markdown).toContain("<!-- END plasmid: alpha -->");
    expect(section?.markdown).toContain("<!-- BEGIN plasmid: beta -->");
    expect(section?.markdown).toContain("line A");
    expect(section?.markdown).toContain("line B");
  });

  it("emits the canonical generated path per bucket", () => {
    const [section] = assembleSections([makeSummary("alpha", "principles")]);
    expect(section?.relativePath).toBe(
      ".dhelix/prompt-sections/generated/60-principles.md",
    );
  });

  it("orders member plasmid ids alphabetically within a bucket", () => {
    const [section] = assembleSections([
      makeSummary("zulu", "constraints"),
      makeSummary("alpha", "constraints"),
      makeSummary("mike", "constraints"),
    ]);
    expect(section?.memberPlasmidIds).toEqual(["alpha", "mike", "zulu"]);
  });

  it("outputs a header comment listing sources", () => {
    const [section] = assembleSections([
      makeSummary("alpha", "constraints"),
      makeSummary("beta", "constraints"),
    ]);
    expect(section?.markdown).toContain("Sources: alpha, beta");
  });
});
