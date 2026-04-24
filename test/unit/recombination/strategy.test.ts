/**
 * Unit tests for `src/recombination/strategy.ts` — `selectStrategies` and
 * `enforcePrivacy`. Pure functions; no I/O.
 */
import { describe, expect, it } from "vitest";

import { getModelCapabilities, type ModelCapabilities } from "../../../src/llm/model-capabilities.js";
import type { LoadedPlasmid, PlasmidFingerprint, PlasmidId } from "../../../src/plasmids/types.js";
import { RecombinationError } from "../../../src/recombination/errors.js";
import { enforcePrivacy, selectStrategies } from "../../../src/recombination/strategy.js";

function makeCaps(overrides: Partial<ModelCapabilities> = {}): ModelCapabilities {
  const base = getModelCapabilities("gpt-4o");
  return { ...base, ...overrides };
}

function makeLoaded(
  id: string,
  privacy: LoadedPlasmid["metadata"]["privacy"],
): LoadedPlasmid {
  const plasmidId = id as PlasmidId;
  return {
    metadata: {
      id: plasmidId,
      name: id,
      description: `Plasmid ${id} for testing.`,
      version: "0.1.0",
      tier: "L2",
      scope: "local",
      privacy,
      created: "2026-04-01T00:00:00Z",
      updated: "2026-04-01T00:00:00Z",
    },
    body: "# body\n",
    bodyFingerprint: "fp" as PlasmidFingerprint,
    evalCases: [],
    sourcePath: `/fake/${id}/body.md`,
    metadataPath: `/fake/${id}/metadata.yaml`,
    scopeOrigin: "local",
  };
}

describe("selectStrategies (P-1.19 matrix)", () => {
  it("returns tier A defaults for a cloud-native model (gpt-4.1 → tier A)", () => {
    const caps = makeCaps({
      strategyTier: "A",
      supportsJsonMode: true,
      toolCallReliability: "strong",
    });
    const s = selectStrategies(caps);
    expect(s.interpreter).toBe("single-pass");
    expect(s.compression).toBe("abstractive");
    expect(s.reorgFallback).toBe("llm-only");
    expect(s.validationVolume).toBe("standard");
    expect(s.validationParallelism).toBe(10);
    expect(s.gradingTiers).toEqual(["deterministic", "semi", "llm"]);
    expect(s.projectProfile).toBe("full-llm");
    expect(s.artifactGeneration).toBe("template-and-llm");
    expect(s.interpreterRetries).toBe(1);
  });

  it("returns tier B defaults for a mid-tier model", () => {
    const caps = makeCaps({
      strategyTier: "B",
      supportsJsonMode: true,
      toolCallReliability: "strong",
    });
    const s = selectStrategies(caps);
    expect(s.interpreter).toBe("chunked");
    expect(s.reorgFallback).toBe("llm-with-xml-fallback");
    expect(s.validationVolume).toBe("governed");
    expect(s.gradingTiers).toEqual(["deterministic", "semi"]);
    expect(s.interpreterRetries).toBe(2);
  });

  it("returns tier C defaults (deterministic-only) for small local models", () => {
    const caps = makeCaps({
      strategyTier: "C",
      supportsJsonMode: false,
      toolCallReliability: "none",
    });
    const s = selectStrategies(caps);
    expect(s.interpreter).toBe("field-by-field");
    expect(s.compression).toBe("extractive");
    expect(s.reorgFallback).toBe("deterministic-only");
    expect(s.artifactGeneration).toBe("template-only");
    expect(s.projectProfile).toBe("static-template");
    expect(s.interpreterRetries).toBe(3);
  });

  it("weakens reorg fallback by one tier when supportsJsonMode is false (A → xml-fallback)", () => {
    const caps = makeCaps({
      strategyTier: "A",
      supportsJsonMode: false,
      toolCallReliability: "strong",
    });
    const s = selectStrategies(caps);
    expect(s.reorgFallback).toBe("llm-with-xml-fallback");
  });

  it("weakens reorg fallback by one tier when supportsJsonMode is false (B → deterministic-fallback)", () => {
    const caps = makeCaps({
      strategyTier: "B",
      supportsJsonMode: false,
      toolCallReliability: "strong",
    });
    const s = selectStrategies(caps);
    expect(s.reorgFallback).toBe("llm-with-deterministic-fallback");
  });

  it("tier-C weakening is a no-op (already deterministic-only)", () => {
    const caps = makeCaps({
      strategyTier: "C",
      supportsJsonMode: false,
    });
    const s = selectStrategies(caps);
    expect(s.reorgFallback).toBe("deterministic-only");
  });

  it("forces artifactGeneration=template-only when toolCallReliability is 'none'", () => {
    const caps = makeCaps({
      strategyTier: "A",
      supportsJsonMode: true,
      toolCallReliability: "none",
    });
    const s = selectStrategies(caps);
    expect(s.artifactGeneration).toBe("template-only");
  });

  it("returns a fresh object — callers can mutate copies without affecting matrix", () => {
    const caps = makeCaps({ strategyTier: "A" });
    const a = selectStrategies(caps);
    const b = selectStrategies(caps);
    expect(a).not.toBe(b);
    expect(a.gradingTiers).not.toBe(b.gradingTiers);
    expect(a.passThresholds).not.toBe(b.passThresholds);
  });
});

describe("enforcePrivacy (I-7 gate)", () => {
  it("passes when caps.privacyTier is 'local' regardless of plasmid privacy", () => {
    const caps = makeCaps({ privacyTier: "local" });
    const plasmids = [makeLoaded("secret", "local-only")];
    expect(() => enforcePrivacy(caps, plasmids)).not.toThrow();
  });

  it("passes when no plasmid is local-only under cloud caps", () => {
    const caps = makeCaps({ privacyTier: "cloud" });
    const plasmids = [makeLoaded("p1", "cloud-ok"), makeLoaded("p2", "no-network")];
    expect(() => enforcePrivacy(caps, plasmids)).not.toThrow();
  });

  it("throws PRIVACY_CLOUD_BLOCKED when a local-only plasmid meets cloud caps", () => {
    const caps = makeCaps({ privacyTier: "cloud" });
    const plasmids = [makeLoaded("cloud-ok-1", "cloud-ok"), makeLoaded("secret", "local-only")];
    try {
      enforcePrivacy(caps, plasmids);
      throw new Error("expected enforcePrivacy to throw");
    } catch (err) {
      expect(err).toBeInstanceOf(RecombinationError);
      if (err instanceof RecombinationError) {
        expect(err.code).toBe("PRIVACY_CLOUD_BLOCKED");
        expect(err.context.plasmidId).toBe("secret");
      }
    }
  });

  it("blocks local-only under unknown privacy tier (fail-safe)", () => {
    const caps = makeCaps({ privacyTier: "unknown" });
    const plasmids = [makeLoaded("only-local", "local-only")];
    expect(() => enforcePrivacy(caps, plasmids)).toThrow(RecombinationError);
  });

  it("is a no-op for empty plasmid set", () => {
    const caps = makeCaps({ privacyTier: "cloud" });
    expect(() => enforcePrivacy(caps, [])).not.toThrow();
  });
});
