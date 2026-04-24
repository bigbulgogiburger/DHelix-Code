/**
 * Local fixture builders for the Phase-4 generator tests living inside
 * `src/recombination/generators/__tests__/`. Mirrors the shape of
 * `test/unit/recombination/generators/_fixtures.ts` but is colocated so
 * Team 2's tests don't cross into the legacy tree.
 */

import type {
  CompiledPlasmidIR,
  IntentKind,
  PipelineStrategies,
  PlasmidIntentNode,
} from "../../types.js";
import type {
  PlasmidFingerprint,
  PlasmidId,
  PlasmidMetadata,
  PlasmidTier,
} from "../../../plasmids/types.js";

export function makeMetadata(
  overrides: Partial<PlasmidMetadata> = {},
): PlasmidMetadata {
  return {
    id: "owasp-gate" as PlasmidId,
    name: "owasp-gate",
    description: "Enforce OWASP Top 10 checks before every commit.",
    version: "0.1.0",
    tier: "L2",
    scope: "shared",
    privacy: "local-only",
    created: "2026-04-22T00:00:00Z",
    updated: "2026-04-22T00:00:00Z",
    tags: ["security", "owasp"],
    author: "test",
    ...overrides,
  };
}

export function makeIR(
  overrides: Partial<CompiledPlasmidIR> = {},
): CompiledPlasmidIR {
  const metadata = overrides.metadata ?? makeMetadata();
  return {
    plasmidId: metadata.id,
    plasmidVersion: metadata.version,
    metadata,
    bodyFingerprint: "deadbeef" as PlasmidFingerprint,
    summary: "Run OWASP scan before every commit; block critical findings.",
    intents: overrides.intents ?? [],
    tier: (overrides.tier ?? metadata.tier) as PlasmidTier,
    interpretedAt: "2026-04-23T00:00:00Z",
    strategyUsed: "single-pass",
    cacheKey: "cache-key-stub",
    ...overrides,
  };
}

export function makeIntent(
  kind: IntentKind,
  overrides: Partial<PlasmidIntentNode> = {},
): PlasmidIntentNode {
  return {
    id: `${kind}-intent-1`,
    sourcePlasmid: "owasp-gate" as PlasmidId,
    kind,
    title: "Enforce OWASP gate",
    description: "Block commits that contain OWASP Top 10 violations.",
    constraints: ["checks must run offline", "timeout < 60s"],
    evidence: ["OWASP A01", "OWASP A03"],
    params: {},
    ...overrides,
  };
}

export function makeStrategies(
  overrides: Partial<PipelineStrategies> = {},
): PipelineStrategies {
  return {
    interpreter: "single-pass",
    compression: "abstractive",
    reorgFallback: "llm-only",
    validationVolume: "standard",
    validationParallelism: 10,
    gradingTiers: ["deterministic", "semi", "llm"],
    passThresholds: { L1: 0.95, L2: 0.8, L3: 0.7, L4: 0.6 },
    projectProfile: "full-llm",
    artifactGeneration: "template-only",
    interpreterRetries: 1,
    ...overrides,
  };
}
