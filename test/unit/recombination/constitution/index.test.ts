/**
 * Integration-ish test for the constitution barrel + `applyPlan`.
 *
 * Verifies:
 *   - `reorganize → applyPlan → verifyUserAreaInvariance` is I-9-safe end-to-end.
 *   - `applyPlan` preserves user sections byte-for-byte.
 *   - Barrel exposes every helper Team 5 will consume.
 *   - Cache key derivation is deterministic for equal inputs.
 */

import { describe, expect, it, vi } from "vitest";

import {
  REORG_VERSION,
  applyPlan,
  buildDeterministicPlan,
  hashConstitution,
  hashIntentGraph,
  listUserSections,
  parse,
  reorgCacheLocation,
  reorganize,
  verifyUserAreaInvariance,
} from "../../../../src/recombination/constitution/index.js";
import type {
  CompiledPlasmidIR,
  LLMCompletionFn,
  PipelineStrategies,
  ReorganizeRequest,
  ReorgFallback,
} from "../../../../src/recombination/types.js";
import type {
  PlasmidFingerprint,
  PlasmidId,
  PlasmidMetadata,
} from "../../../../src/plasmids/types.js";

function makeIR(plasmid: string, title: string, description: string): CompiledPlasmidIR {
  const meta: PlasmidMetadata = {
    id: plasmid as PlasmidId,
    name: plasmid,
    description: "",
    version: "1.0.0",
    tier: "L2",
    scope: "local",
    privacy: "local-only",
    created: "2026-01-01T00:00:00Z",
    updated: "2026-01-01T00:00:00Z",
  } as PlasmidMetadata;
  return {
    plasmidId: plasmid as PlasmidId,
    plasmidVersion: "1.0.0",
    metadata: meta,
    bodyFingerprint: "f1" as PlasmidFingerprint,
    summary: "",
    intents: [
      {
        id: "i1",
        sourcePlasmid: plasmid as PlasmidId,
        kind: "rule",
        title,
        description,
        constraints: [],
        evidence: [],
        params: {},
      },
    ],
    tier: "L2",
    interpretedAt: "2026-01-01T00:00:00Z",
    strategyUsed: "single-pass",
    cacheKey: `${plasmid}:f1`,
  };
}

function strategies(fallback: ReorgFallback): PipelineStrategies {
  return {
    interpreter: "single-pass",
    compression: "abstractive",
    reorgFallback: fallback,
    validationVolume: "standard",
    validationParallelism: 1,
    gradingTiers: ["deterministic"],
    passThresholds: { L1: 1, L2: 1, L3: 1, L4: 1 },
    projectProfile: "full-llm",
    artifactGeneration: "template-and-llm",
    interpreterRetries: 1,
  };
}

function makeRequest(
  existing: string,
  irs: readonly CompiledPlasmidIR[],
  fallback: ReorgFallback,
  llm: LLMCompletionFn,
): ReorganizeRequest {
  return {
    irs,
    existingConstitution: existing,
    strategies: strategies(fallback),
    workingDirectory: "/tmp",
    llm,
  };
}

describe("barrel exports", () => {
  it("exposes REORG_VERSION as a semver string", () => {
    expect(REORG_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
  });
});

describe("applyPlan — end-to-end with deterministic planner", () => {
  const existing = [
    "# Dhelix Code",
    "",
    "User preamble that must never change.",
    "",
    "## Commands",
    "",
    "npm test",
    "",
  ].join("\n");

  it("inserts new marker blocks without touching user content", async () => {
    const irs = [
      makeIR("owasp-gate", "Security Posture", "Enforce OWASP top-10."),
    ];
    const llm = vi.fn<LLMCompletionFn>().mockResolvedValue("{}");
    const plan = await reorganize(
      makeRequest(existing, irs, "deterministic-only", llm),
    );

    const { newConstitution, markerIdsWritten } = applyPlan(existing, plan);
    expect(markerIdsWritten).toEqual(["owasp-gate/security-posture"]);
    expect(newConstitution).toContain(
      "<!-- BEGIN plasmid-derived: owasp-gate/security-posture -->",
    );
    expect(newConstitution).toContain("User preamble that must never change.");
    expect(newConstitution).toContain("## Commands");

    verifyUserAreaInvariance(parse(existing), parse(newConstitution));
  });

  it("updates existing markers in place without user-content drift", async () => {
    const withMarker = [
      existing,
      "<!-- BEGIN plasmid-derived: owasp-gate/security-posture -->",
      "## Security Posture",
      "",
      "Outdated body.",
      "<!-- END plasmid-derived: owasp-gate/security-posture -->",
      "",
    ].join("\n");

    const irs = [
      makeIR("owasp-gate", "Security Posture", "Fresh body describing OWASP posture."),
    ];
    const llm = vi.fn<LLMCompletionFn>().mockResolvedValue("{}");
    const plan = await reorganize(
      makeRequest(withMarker, irs, "deterministic-only", llm),
    );
    expect(plan.ops.some((o) => o.kind === "update")).toBe(true);

    const { newConstitution } = applyPlan(withMarker, plan);
    expect(newConstitution).toContain("Fresh body describing OWASP posture.");
    expect(newConstitution).not.toContain("Outdated body.");

    // I-9: every user-section survives unchanged.
    verifyUserAreaInvariance(parse(withMarker), parse(newConstitution));
  });

  it("removes markers for plasmids that are no longer active", async () => {
    const withStale = [
      existing,
      "<!-- BEGIN plasmid-derived: gone/stale -->",
      "## Gone",
      "",
      "will be removed",
      "<!-- END plasmid-derived: gone/stale -->",
      "",
    ].join("\n");

    const plan = buildDeterministicPlan({
      beforeTree: parse(withStale),
      irs: [],
      preReorgContentHash: "c",
      intentGraphHash: "i",
    });
    const { newConstitution, markerIdsWritten } = applyPlan(withStale, plan);
    expect(markerIdsWritten).toEqual([]);
    expect(newConstitution).not.toContain("gone/stale");
    expect(newConstitution).toContain("User preamble that must never change.");
    verifyUserAreaInvariance(parse(withStale), parse(newConstitution));
  });

  it("is a no-op when the plan is empty", () => {
    const { newConstitution } = applyPlan(existing, {
      ops: [],
      keptMarkerIds: [],
      preReorgContentHash: "c",
      intentGraphHash: "i",
      fallbackTier: "deterministic-only",
    });
    expect(newConstitution).toBe(existing);
  });
});

describe("cache key derivation", () => {
  it("produces identical locations for identical inputs", () => {
    const a = reorgCacheLocation({
      intentGraphHash: "ig",
      constitutionHash: "ch",
      model: "gpt-x",
      reorgVersion: REORG_VERSION,
      reorgFallback: "llm-with-deterministic-fallback",
    });
    const b = reorgCacheLocation({
      intentGraphHash: "ig",
      constitutionHash: "ch",
      model: "gpt-x",
      reorgVersion: REORG_VERSION,
      reorgFallback: "llm-with-deterministic-fallback",
    });
    expect(a).toEqual(b);
    expect(a.file).toMatch(/\.dhelix\/recombination\/objects\/[0-9a-f]{2}\/[0-9a-f]{62}\.json/);
  });

  it("changes when any input changes", () => {
    const base = {
      intentGraphHash: "ig",
      constitutionHash: "ch",
      model: "gpt-x",
      reorgVersion: REORG_VERSION,
      reorgFallback: "llm-only" as ReorgFallback,
    };
    const a = reorgCacheLocation(base).key;
    expect(reorgCacheLocation({ ...base, model: "gpt-y" }).key).not.toBe(a);
    expect(reorgCacheLocation({ ...base, intentGraphHash: "other" }).key).not.toBe(a);
    expect(reorgCacheLocation({ ...base, constitutionHash: "other" }).key).not.toBe(a);
  });

  it("hashIntentGraph is order-independent", () => {
    const a = hashIntentGraph([
      { plasmidId: "a", cacheKey: "x" },
      { plasmidId: "b", cacheKey: "y" },
    ]);
    const b = hashIntentGraph([
      { plasmidId: "b", cacheKey: "y" },
      { plasmidId: "a", cacheKey: "x" },
    ]);
    expect(a).toBe(b);
  });

  it("hashConstitution is stable for identical strings", () => {
    expect(hashConstitution("hello")).toBe(hashConstitution("hello"));
    expect(hashConstitution("hello")).not.toBe(hashConstitution("world"));
  });
});

describe("user-section preservation", () => {
  it("`listUserSections` reports the same content hashes after an insert", () => {
    const existing = "# Root\n\nimmutable preamble\n";
    const irs = [makeIR("p1", "Section One", "hi")];
    const plan = buildDeterministicPlan({
      beforeTree: parse(existing),
      irs,
      preReorgContentHash: "c",
      intentGraphHash: "i",
    });
    const { newConstitution } = applyPlan(existing, plan);

    const beforeUserHashes = listUserSections(parse(existing))
      .map((s) => s.content)
      .sort();
    const afterUserHashes = listUserSections(parse(newConstitution))
      .map((s) => s.content)
      .filter((c) => c.trim().length > 0)
      .sort();
    expect(afterUserHashes).toEqual(beforeUserHashes);
  });
});
