import { describe, expect, it } from "vitest";

import {
  computeBudget,
  resolveOverflow,
} from "../../../../src/recombination/compression/budget.js";
import type {
  PlasmidId,
  PlasmidTier,
} from "../../../../src/plasmids/types.js";
import type { CompressedPlasmidSummary } from "../../../../src/recombination/types.js";

function makeSummary(
  id: string,
  tier: PlasmidTier,
  tokenEstimate: number,
): CompressedPlasmidSummary {
  return {
    plasmidId: id as PlasmidId,
    bucket: "constraints",
    tier,
    markdown: `## ${id}\n`,
    tokenEstimate,
    preservedConstraints: [],
    cacheKey: `ck-${id}`,
  };
}

describe("computeBudget", () => {
  it("returns the floor (300) for zero plasmids", () => {
    expect(computeBudget(0)).toBe(300);
  });

  it("scales linearly 150 per plasmid in the band", () => {
    expect(computeBudget(4)).toBe(600);
    expect(computeBudget(6)).toBe(900);
  });

  it("caps at the ceiling (1500)", () => {
    expect(computeBudget(50)).toBe(1500);
  });

  it("returns the floor (300) for small plasmid counts", () => {
    expect(computeBudget(1)).toBe(300);
  });
});

describe("resolveOverflow", () => {
  it("keeps everyone under budget", () => {
    const summaries = [
      makeSummary("alpha", "L2", 100),
      makeSummary("beta", "L3", 150),
    ];
    const resolved = resolveOverflow(summaries, 500);
    expect(resolved.kept).toHaveLength(2);
    expect(resolved.droppedPlasmidIds).toHaveLength(0);
    expect(resolved.keptTokens).toBe(250);
  });

  it("drops L1 before L2 before L3", () => {
    const summaries = [
      makeSummary("c-l3", "L3", 200),
      makeSummary("a-l1", "L1", 50),
      makeSummary("b-l2", "L2", 150),
    ];
    const resolved = resolveOverflow(summaries, 200);
    const dropped = resolved.droppedPlasmidIds;
    expect(dropped[0]).toBe("a-l1");
    expect(dropped[1]).toBe("b-l2");
    expect(resolved.kept.map((s) => s.plasmidId)).toEqual(["c-l3"]);
  });

  it("breaks ties alphabetically on plasmid id", () => {
    const summaries = [
      makeSummary("zeta", "L1", 100),
      makeSummary("alpha", "L1", 100),
      makeSummary("beta", "L1", 100),
    ];
    const resolved = resolveOverflow(summaries, 100);
    expect(resolved.droppedPlasmidIds[0]).toBe("alpha");
    expect(resolved.droppedPlasmidIds[1]).toBe("beta");
    expect(resolved.kept.map((s) => s.plasmidId)).toEqual(["zeta"]);
  });

  it("returns input ordering for kept summaries", () => {
    const summaries = [
      makeSummary("a", "L3", 100),
      makeSummary("b", "L1", 200),
      makeSummary("c", "L2", 100),
    ];
    const resolved = resolveOverflow(summaries, 250);
    expect(resolved.kept.map((s) => s.plasmidId)).toEqual(["a", "c"]);
    expect(resolved.droppedPlasmidIds).toEqual(["b"]);
  });
});
