/**
 * Unit tests for `src/recombination/validation/volume-governor.ts`.
 *
 * Covers the 3-profile × category × level matrix (PRD §8.3), time-budget
 * selection, and parallelism propagation.
 */
import { describe, expect, it } from "vitest";

import type {
  PlasmidFingerprint,
  PlasmidId,
  PlasmidMetadata,
} from "../../../../src/plasmids/types.js";
import type {
  CompiledPlasmidIR,
  PipelineStrategies,
  ValidationVolumeProfile,
} from "../../../../src/recombination/types.js";
import {
  buildVolumePlan,
  categorizePlasmid,
} from "../../../../src/recombination/validation/volume-governor.js";

function meta(
  id: string,
  overrides: Partial<PlasmidMetadata> = {},
): PlasmidMetadata {
  return {
    id: id as PlasmidId,
    name: id,
    description: "d",
    version: "1.0.0",
    tier: "L1",
    scope: "local",
    privacy: "local-only",
    created: "2026-04-24T00:00:00Z",
    updated: "2026-04-24T00:00:00Z",
    ...overrides,
  };
}

function ir(
  id: string,
  metaOverrides: Partial<PlasmidMetadata> = {},
): CompiledPlasmidIR {
  const m = meta(id, metaOverrides);
  return {
    plasmidId: m.id,
    plasmidVersion: m.version,
    metadata: m,
    bodyFingerprint: "fp" as PlasmidFingerprint,
    summary: "",
    intents: [],
    tier: m.tier,
    interpretedAt: m.created,
    strategyUsed: "single-pass",
    cacheKey: "key",
  };
}

function strategies(
  profile: ValidationVolumeProfile,
  parallelism = 10,
): PipelineStrategies {
  return {
    interpreter: "single-pass",
    compression: "abstractive",
    reorgFallback: "llm-with-deterministic-fallback",
    validationVolume: profile,
    validationParallelism: parallelism,
    gradingTiers: ["deterministic", "semi", "llm"],
    passThresholds: { L1: 1, L2: 0.9, L3: 0.8, L4: 0.7 },
    projectProfile: "full-llm",
    artifactGeneration: "template-and-llm",
    interpreterRetries: 0,
  };
}

describe("categorizePlasmid", () => {
  it("foundational: true → foundational", () => {
    expect(
      categorizePlasmid(meta("x", { tier: "L4", foundational: true })),
    ).toBe("foundational");
  });
  it("tier=L4 → foundational", () => {
    expect(categorizePlasmid(meta("x", { tier: "L4" }))).toBe("foundational");
  });
  it("tier=L3 → tactical", () => {
    expect(categorizePlasmid(meta("x", { tier: "L3" }))).toBe("tactical");
  });
  it("tier=L1/L2 → policy", () => {
    expect(categorizePlasmid(meta("x", { tier: "L1" }))).toBe("policy");
    expect(categorizePlasmid(meta("x", { tier: "L2" }))).toBe("policy");
  });
});

describe("buildVolumePlan — standard profile", () => {
  it("foundational plasmid gets 20/15/10/15", () => {
    const plan = buildVolumePlan({
      irs: [ir("fnd", { tier: "L4", foundational: true })],
      strategies: strategies("standard"),
    });
    const q = plan.perPlasmid.get("fnd" as PlasmidId);
    expect(q).toEqual({ L1: 20, L2: 15, L3: 10, L4: 15 });
  });

  it("policy plasmid gets 10/8/5/5", () => {
    const plan = buildVolumePlan({
      irs: [ir("pol", { tier: "L1" })],
      strategies: strategies("standard"),
    });
    const q = plan.perPlasmid.get("pol" as PlasmidId);
    expect(q).toEqual({ L1: 10, L2: 8, L3: 5, L4: 5 });
  });

  it("tactical plasmid gets 5/3/2/0", () => {
    const plan = buildVolumePlan({
      irs: [ir("tac", { tier: "L3" })],
      strategies: strategies("standard"),
    });
    const q = plan.perPlasmid.get("tac" as PlasmidId);
    expect(q).toEqual({ L1: 5, L2: 3, L3: 2, L4: 0 });
  });

  it("uses 300_000ms budget + propagates parallelism", () => {
    const plan = buildVolumePlan({
      irs: [ir("a")],
      strategies: strategies("standard", 7),
    });
    expect(plan.timeBudgetMs).toBe(300_000);
    expect(plan.parallelism).toBe(7);
  });
});

describe("buildVolumePlan — governed profile (0.33 scaling)", () => {
  it("foundational scales 20→7 / 15→5 / 10→4 / 15→5", () => {
    const plan = buildVolumePlan({
      irs: [ir("fnd", { tier: "L4", foundational: true })],
      strategies: strategies("governed"),
    });
    const q = plan.perPlasmid.get("fnd" as PlasmidId);
    expect(q).toEqual({ L1: 7, L2: 5, L3: 4, L4: 5 });
  });

  it("policy scales 10→4 / 8→3 / 5→2 / 5→2", () => {
    const plan = buildVolumePlan({
      irs: [ir("pol", { tier: "L1" })],
      strategies: strategies("governed"),
    });
    const q = plan.perPlasmid.get("pol" as PlasmidId);
    expect(q).toEqual({ L1: 4, L2: 3, L3: 2, L4: 2 });
  });

  it("tactical scales 5→2 / 3→1 / 2→1 / 0→0", () => {
    const plan = buildVolumePlan({
      irs: [ir("tac", { tier: "L3" })],
      strategies: strategies("governed"),
    });
    const q = plan.perPlasmid.get("tac" as PlasmidId);
    expect(q).toEqual({ L1: 2, L2: 1, L3: 1, L4: 0 });
  });
});

describe("buildVolumePlan — minimal profile (0.13 + 180s)", () => {
  it("foundational scales 20→3 / 15→2 / 10→2 / 15→2", () => {
    const plan = buildVolumePlan({
      irs: [ir("fnd", { tier: "L4", foundational: true })],
      strategies: strategies("minimal"),
    });
    const q = plan.perPlasmid.get("fnd" as PlasmidId);
    expect(q).toEqual({ L1: 3, L2: 2, L3: 2, L4: 2 });
  });

  it("uses 180_000ms time budget", () => {
    const plan = buildVolumePlan({
      irs: [ir("a")],
      strategies: strategies("minimal"),
    });
    expect(plan.timeBudgetMs).toBe(180_000);
  });
});

describe("buildVolumePlan — aggregate", () => {
  it("totalBudget sums all plasmids' quotas", () => {
    const plan = buildVolumePlan({
      irs: [
        ir("fnd", { tier: "L4", foundational: true }), // 60
        ir("pol"), // L1 → policy 28
        ir("tac", { tier: "L3" }), // tactical 10
      ],
      strategies: strategies("standard"),
    });
    expect(plan.totalBudget).toBe(60 + 28 + 10);
  });

  it("echoes profile", () => {
    const plan = buildVolumePlan({
      irs: [ir("a")],
      strategies: strategies("governed"),
    });
    expect(plan.profile).toBe("governed");
  });

  it("floors parallelism at 1 when strategy asks for 0", () => {
    const plan = buildVolumePlan({
      irs: [ir("a")],
      strategies: strategies("standard", 0),
    });
    expect(plan.parallelism).toBe(1);
  });
});
