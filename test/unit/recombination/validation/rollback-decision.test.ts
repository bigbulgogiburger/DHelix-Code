/**
 * Unit tests for `src/recombination/validation/rollback-decision.ts`.
 *
 * Covers all cells of PRD §8.5 matrix: L1/L2 → rollback, L3 → warn,
 * L4 non-foundational → warn, foundational L4 ≥5% → rollback, all pass →
 * continue. Plus failingTier selection + failingPlasmidId propagation.
 */
import { describe, expect, it } from "vitest";

import { decideRollback } from "../../../../src/recombination/validation/rollback-decision.js";
import type {
  CompiledPlasmidIR,
  PipelineStrategies,
  PlasmidValidationSummary,
  TierStats,
  ValidationLevel,
  ValidationReport,
} from "../../../../src/recombination/types.js";
import type {
  PlasmidFingerprint,
  PlasmidId,
  PlasmidMetadata,
} from "../../../../src/plasmids/types.js";

const pid = (s: string): PlasmidId => s as PlasmidId;

const tier = (
  level: ValidationLevel,
  passed: number,
  total: number,
  threshold: number,
): TierStats => {
  const rate = total === 0 ? 1 : passed / total;
  return {
    tier: level,
    total,
    passed,
    rate,
    threshold,
    meetsThreshold: rate >= threshold,
    skipped: 0,
  };
};

const summary = (
  plasmidId: string,
  levels: ReadonlyMap<ValidationLevel, TierStats>,
): PlasmidValidationSummary => ({
  plasmidId: pid(plasmidId),
  tier: "L2",
  perLevel: levels,
  overallPassed: [...levels.values()].every((s) => s.meetsThreshold),
});

const buildReport = (
  perTier: readonly TierStats[],
  perPlasmid: readonly PlasmidValidationSummary[] = [],
): ValidationReport => ({
  startedAt: "2026-04-24T10:00:00Z",
  finishedAt: "2026-04-24T10:01:00Z",
  durationMs: 60_000,
  profile: "local",
  plan: {
    profile: "standard",
    totalBudget: 100,
    perPlasmid: new Map(),
    timeBudgetMs: 300_000,
    parallelism: 1,
  },
  totalCases: perTier.reduce((sum, t) => sum + t.total, 0),
  perTier,
  perPlasmid,
  caseGradings: [],
  earlyExit: false,
  timeBudgetExceeded: false,
  overallPassed: perTier.every((t) => t.meetsThreshold),
  dropped: [],
});

const mkPlasmid = (
  id: string,
  foundational: boolean,
): CompiledPlasmidIR => {
  const metadata: PlasmidMetadata = {
    id: pid(id),
    name: id,
    description: "",
    version: "1.0.0",
    tier: "L2",
    scope: "local",
    privacy: "local-only",
    created: "2026-01-01T00:00:00Z",
    updated: "2026-01-01T00:00:00Z",
    foundational,
  };
  return {
    plasmidId: pid(id),
    plasmidVersion: "1.0.0",
    metadata,
    bodyFingerprint: "deadbeef" as PlasmidFingerprint,
    summary: "",
    intents: [],
    tier: "L2",
    interpretedAt: "2026-04-24T09:00:00Z",
    strategyUsed: "single-pass",
    cacheKey: "cache-1",
  };
};

const strategies: PipelineStrategies = {
  interpreter: "single-pass",
  compression: "abstractive",
  reorgFallback: "llm-with-xml-fallback",
  validationVolume: "standard",
  validationParallelism: 1,
  gradingTiers: ["deterministic", "semi", "llm"],
  passThresholds: { L1: 1.0, L2: 0.9, L3: 0.8, L4: 0.7 },
  projectProfile: "full-llm",
  artifactGeneration: "template-and-llm",
  interpreterRetries: 1,
};

describe("decideRollback", () => {
  it("returns continue when all thresholds met", () => {
    const report = buildReport([
      tier("L1", 50, 50, 1.0),
      tier("L2", 25, 25, 0.9),
      tier("L3", 10, 10, 0.8),
      tier("L4", 5, 5, 0.7),
    ]);
    const result = decideRollback({ report, plasmids: [], strategies });
    expect(result.action).toBe("continue");
    expect(result.failingTier).toBeUndefined();
  });

  it("rollback on L1 miss", () => {
    const perPlasmid = [
      summary(
        "p-alpha",
        new Map<ValidationLevel, TierStats>([["L1", tier("L1", 48, 50, 1.0)]]),
      ),
    ];
    const report = buildReport(
      [tier("L1", 48, 50, 1.0), tier("L2", 25, 25, 0.9)],
      perPlasmid,
    );
    const result = decideRollback({ report, plasmids: [], strategies });
    expect(result.action).toBe("rollback");
    expect(result.failingTier).toBe("L1");
    expect(result.failingPlasmidId).toBe("p-alpha");
    expect(result.foundationalL4Triggered).toBe(false);
  });

  it("rollback on L2 miss when L1 passes", () => {
    const perPlasmid = [
      summary(
        "p-beta",
        new Map<ValidationLevel, TierStats>([["L2", tier("L2", 20, 25, 0.9)]]),
      ),
    ];
    const report = buildReport(
      [tier("L1", 50, 50, 1.0), tier("L2", 20, 25, 0.9)],
      perPlasmid,
    );
    const result = decideRollback({ report, plasmids: [], strategies });
    expect(result.action).toBe("rollback");
    expect(result.failingTier).toBe("L2");
    expect(result.failingPlasmidId).toBe("p-beta");
  });

  it("L1 miss takes priority over L2 miss", () => {
    const report = buildReport([
      tier("L1", 48, 50, 1.0),
      tier("L2", 20, 25, 0.9),
    ]);
    const result = decideRollback({ report, plasmids: [], strategies });
    expect(result.failingTier).toBe("L1");
  });

  it("warn on L3 miss only", () => {
    const report = buildReport([
      tier("L1", 50, 50, 1.0),
      tier("L2", 25, 25, 0.9),
      tier("L3", 5, 10, 0.8),
    ]);
    const result = decideRollback({ report, plasmids: [], strategies });
    expect(result.action).toBe("warn");
    expect(result.failingTier).toBe("L3");
  });

  it("warn on non-foundational L4 miss", () => {
    const plasmids = [mkPlasmid("tactical-a", false)];
    const perPlasmid = [
      summary(
        "tactical-a",
        new Map<ValidationLevel, TierStats>([["L4", tier("L4", 3, 5, 0.7)]]),
      ),
    ];
    const report = buildReport(
      [
        tier("L1", 50, 50, 1.0),
        tier("L2", 25, 25, 0.9),
        tier("L3", 10, 10, 0.8),
        tier("L4", 3, 5, 0.7),
      ],
      perPlasmid,
    );
    const result = decideRollback({ report, plasmids, strategies });
    expect(result.action).toBe("warn");
    expect(result.failingTier).toBe("L4");
    expect(result.foundationalL4Triggered).toBe(false);
  });

  it("rollback when foundational plasmid L4 fail rate ≥5%", () => {
    const plasmids = [mkPlasmid("owasp-gate", true)];
    // 19/20 = 95% pass → 5% fail → breach threshold.
    const perPlasmid = [
      summary(
        "owasp-gate",
        new Map<ValidationLevel, TierStats>([
          ["L4", tier("L4", 19, 20, 0.7)],
        ]),
      ),
    ];
    const report = buildReport(
      [
        tier("L1", 50, 50, 1.0),
        tier("L2", 25, 25, 0.9),
        tier("L3", 10, 10, 0.8),
        tier("L4", 19, 20, 0.7),
      ],
      perPlasmid,
    );
    const result = decideRollback({ report, plasmids, strategies });
    expect(result.action).toBe("rollback");
    expect(result.failingTier).toBe("L4");
    expect(result.foundationalL4Triggered).toBe(true);
    expect(result.failingPlasmidId).toBe("owasp-gate");
  });

  it("no rollback when foundational L4 fail rate below 5%", () => {
    const plasmids = [mkPlasmid("owasp-gate", true)];
    // 49/50 = 98% pass → 2% fail → below 5%.
    const perPlasmid = [
      summary(
        "owasp-gate",
        new Map<ValidationLevel, TierStats>([
          ["L4", tier("L4", 49, 50, 0.7)],
        ]),
      ),
    ];
    const report = buildReport(
      [
        tier("L1", 50, 50, 1.0),
        tier("L2", 25, 25, 0.9),
        tier("L3", 10, 10, 0.8),
        tier("L4", 49, 50, 0.7),
      ],
      perPlasmid,
    );
    const result = decideRollback({ report, plasmids, strategies });
    expect(result.action).toBe("continue");
  });

  it("foundational L4 rollback wins over L3 warn", () => {
    const plasmids = [mkPlasmid("foundation-a", true)];
    const perPlasmid = [
      summary(
        "foundation-a",
        new Map<ValidationLevel, TierStats>([
          ["L4", tier("L4", 9, 10, 0.7)],
        ]),
      ),
    ];
    const report = buildReport(
      [
        tier("L1", 50, 50, 1.0),
        tier("L2", 25, 25, 0.9),
        tier("L3", 5, 10, 0.8),
        tier("L4", 9, 10, 0.7),
      ],
      perPlasmid,
    );
    const result = decideRollback({ report, plasmids, strategies });
    expect(result.action).toBe("rollback");
    expect(result.foundationalL4Triggered).toBe(true);
  });
});
