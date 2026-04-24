/**
 * I-10 rollback decision matrix (PRD §8.5).
 *
 * Team 3 — Phase 3. Pure, sync. Evaluates a `ValidationReport` against the
 * tier × plasmid-tier matrix:
 *
 *     Tier   Deterministic         LLM-judge fallback
 *     L1     1 fail = rollback     confidence ≥0.8 fail → rollback
 *     L2     <threshold = rollback confidence ≥0.7 fail → count
 *     L3     <threshold = warn     skip
 *     L4     warn only             skip
 *
 * Special case (`foundationalL4Triggered`): a foundational plasmid's L4
 * fail rate ≥5% elevates to `rollback`.
 *
 * When no rollback required, `action: "continue"`. When rollback is
 * triggered but executor runs in `--validate=ci` (strict), this still
 * returns `rollback`; the executor decides UX (auto vs grace prompt).
 *
 * Layer: Core. No I/O, no LLM.
 */
import type {
  CompiledPlasmidIR,
  DecideRollbackFn,
  PlasmidValidationSummary,
  RollbackDecision,
  TierStats,
  ValidationLevel,
} from "../types.js";
import { FOUNDATIONAL_L4_ROLLBACK_THRESHOLD } from "../types.js";
import type { PlasmidId } from "../../plasmids/types.js";

/**
 * Find the first plasmid id whose per-level stats for `tier` fail its
 * threshold. Returns `undefined` when no plasmid-level miss is recorded —
 * e.g. when the per-plasmid breakdown was not emitted for this tier.
 */
const firstFailingPlasmid = (
  summaries: readonly PlasmidValidationSummary[],
  tier: ValidationLevel,
): PlasmidId | undefined => {
  for (const summary of summaries) {
    const stats = summary.perLevel.get(tier);
    if (stats && !stats.meetsThreshold) {
      return summary.plasmidId;
    }
  }
  return undefined;
};

/**
 * Check foundational plasmids for L4 failure rate ≥ FOUNDATIONAL_L4_ROLLBACK_THRESHOLD.
 * Returns the first foundational plasmid id whose L4 fail-rate breaches, or
 * `undefined` if none do.
 */
const foundationalL4Breach = (
  summaries: readonly PlasmidValidationSummary[],
  plasmids: readonly CompiledPlasmidIR[],
): PlasmidId | undefined => {
  const foundationalIds = new Set(
    plasmids
      .filter((p) => p.metadata.foundational === true)
      .map((p) => p.plasmidId),
  );
  for (const summary of summaries) {
    if (!foundationalIds.has(summary.plasmidId)) continue;
    const l4 = summary.perLevel.get("L4");
    if (!l4 || l4.total === 0) continue;
    const failRate = 1 - l4.rate;
    if (failRate >= FOUNDATIONAL_L4_ROLLBACK_THRESHOLD) {
      return summary.plasmidId;
    }
  }
  return undefined;
};

const findTier = (
  perTier: readonly TierStats[],
  tier: ValidationLevel,
): TierStats | undefined => perTier.find((t) => t.tier === tier);

export const decideRollback: DecideRollbackFn = ({ report, plasmids }) => {
  const { perTier, perPlasmid } = report;

  // L1 miss → rollback (highest priority).
  const l1 = findTier(perTier, "L1");
  if (l1 && !l1.meetsThreshold) {
    const failingPlasmidId = firstFailingPlasmid(perPlasmid, "L1");
    const decision: RollbackDecision = {
      action: "rollback",
      reason: `L1 direct test failure: ${l1.passed}/${l1.total} passed (rate ${(l1.rate * 100).toFixed(1)}% < threshold ${(l1.threshold * 100).toFixed(1)}%)`,
      failingTier: "L1",
      ...(failingPlasmidId !== undefined ? { failingPlasmidId } : {}),
      foundationalL4Triggered: false,
    };
    return decision;
  }

  // L2 miss → rollback.
  const l2 = findTier(perTier, "L2");
  if (l2 && !l2.meetsThreshold) {
    const failingPlasmidId = firstFailingPlasmid(perPlasmid, "L2");
    const decision: RollbackDecision = {
      action: "rollback",
      reason: `L2 indirect test failure: ${l2.passed}/${l2.total} passed (rate ${(l2.rate * 100).toFixed(1)}% < threshold ${(l2.threshold * 100).toFixed(1)}%)`,
      failingTier: "L2",
      ...(failingPlasmidId !== undefined ? { failingPlasmidId } : {}),
      foundationalL4Triggered: false,
    };
    return decision;
  }

  // Foundational L4 ≥ 5% failure → rollback (overrides L4 warn).
  const foundationalBreachId = foundationalL4Breach(perPlasmid, plasmids);
  if (foundationalBreachId !== undefined) {
    return {
      action: "rollback",
      reason: `Foundational plasmid '${foundationalBreachId}' L4 failure rate ≥ ${(
        FOUNDATIONAL_L4_ROLLBACK_THRESHOLD * 100
      ).toFixed(0)}%`,
      failingTier: "L4",
      failingPlasmidId: foundationalBreachId,
      foundationalL4Triggered: true,
    };
  }

  // L3 or non-foundational L4 miss → warn.
  const l3 = findTier(perTier, "L3");
  if (l3 && !l3.meetsThreshold) {
    const failingPlasmidId = firstFailingPlasmid(perPlasmid, "L3");
    const decision: RollbackDecision = {
      action: "warn",
      reason: `L3 conditional threshold not met: ${l3.passed}/${l3.total} (${(l3.rate * 100).toFixed(1)}%)`,
      failingTier: "L3",
      ...(failingPlasmidId !== undefined ? { failingPlasmidId } : {}),
      foundationalL4Triggered: false,
    };
    return decision;
  }

  const l4 = findTier(perTier, "L4");
  if (l4 && !l4.meetsThreshold) {
    const failingPlasmidId = firstFailingPlasmid(perPlasmid, "L4");
    const decision: RollbackDecision = {
      action: "warn",
      reason: `L4 adversarial threshold not met: ${l4.passed}/${l4.total} (${(l4.rate * 100).toFixed(1)}%)`,
      failingTier: "L4",
      ...(failingPlasmidId !== undefined ? { failingPlasmidId } : {}),
      foundationalL4Triggered: false,
    };
    return decision;
  }

  return {
    action: "continue",
    reason: "all thresholds met",
    foundationalL4Triggered: false,
  };
};
