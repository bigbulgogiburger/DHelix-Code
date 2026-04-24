/**
 * Volume governor (P-1.16 §3, PRD §8.3).
 *
 * Team 1 — Phase 3. Pure, sync. Produces a `VolumePlan` that caps case
 * counts per plasmid × tier based on:
 *   1. `PipelineStrategies.validationVolume` (standard|governed|minimal)
 *   2. Plasmid category (foundational > policy > tactical > agent-proposed)
 *   3. Validation level (L1..L4)
 *
 * Totals: standard ~150 / governed ~50 / minimal ~20 per PRD §8.3.
 *
 * Layer: Core. No I/O.
 */
import type { PlasmidId, PlasmidMetadata } from "../../plasmids/types.js";
import type {
  PlasmidQuota,
  VolumeGovernorFn,
  VolumePlan,
} from "../types.js";

/** Plasmid category used to index the §8.3 volume matrix. */
export type PlasmidCategory =
  | "foundational"
  | "policy"
  | "tactical"
  | "agent-proposed";

/**
 * Cloud/standard volume matrix per PRD §8.3 (per plasmid × L1..L4).
 * The numbers here sum to 60 / 28 / 10 / 6 across L1..L4 for the four
 * categories respectively (total ~150 for a 10-plasmid scenario).
 */
const STANDARD_MATRIX: Readonly<Record<PlasmidCategory, PlasmidQuota>> = {
  foundational: { L1: 20, L2: 15, L3: 10, L4: 15 },
  policy: { L1: 10, L2: 8, L3: 5, L4: 5 },
  tactical: { L1: 5, L2: 3, L3: 2, L4: 0 },
  "agent-proposed": { L1: 3, L2: 2, L3: 1, L4: 0 },
};

/** Scaling factor by profile — standard is 1.0, others per spec. */
const PROFILE_SCALE: Readonly<Record<"standard" | "governed" | "minimal", number>> = {
  standard: 1,
  governed: 0.33,
  minimal: 0.13,
};

/** Wall-clock budget (ms) per profile. */
const TIME_BUDGET_MS: Readonly<
  Record<"standard" | "governed" | "minimal", number>
> = {
  standard: 300_000,
  governed: 300_000,
  minimal: 180_000,
};

const scaleQuota = (base: PlasmidQuota, scale: number): PlasmidQuota => ({
  // `ceil` so e.g. `5 * 0.13 ≈ 0.65 → 1` case survives in minimal profile.
  // `0 * scale === 0`, so categories with L4=0 stay at 0.
  L1: base.L1 === 0 ? 0 : Math.ceil(base.L1 * scale),
  L2: base.L2 === 0 ? 0 : Math.ceil(base.L2 * scale),
  L3: base.L3 === 0 ? 0 : Math.ceil(base.L3 * scale),
  L4: base.L4 === 0 ? 0 : Math.ceil(base.L4 * scale),
});

/** Derive the PRD §8.3 category from a plasmid's metadata. */
export const categorizePlasmid = (meta: PlasmidMetadata): PlasmidCategory => {
  if (meta.foundational === true || meta.tier === "L4") {
    return "foundational";
  }
  if (meta.tier === "L3") return "tactical";
  // L1/L2 default to policy. Callers can still override by setting
  // metadata.foundational or adjusting tier before calling.
  return "policy";
};

const sumQuota = (q: PlasmidQuota): number => q.L1 + q.L2 + q.L3 + q.L4;

export const buildVolumePlan: VolumeGovernorFn = (req): VolumePlan => {
  const { irs, strategies } = req;
  const profile = strategies.validationVolume;
  const scale = PROFILE_SCALE[profile];
  const timeBudgetMs = TIME_BUDGET_MS[profile];

  const perPlasmid = new Map<PlasmidId, PlasmidQuota>();
  let totalBudget = 0;

  for (const ir of irs) {
    const category = categorizePlasmid(ir.metadata);
    const base = STANDARD_MATRIX[category];
    const scaled = scaleQuota(base, scale);
    perPlasmid.set(ir.plasmidId, scaled);
    totalBudget += sumQuota(scaled);
  }

  return {
    profile,
    totalBudget,
    perPlasmid,
    timeBudgetMs,
    parallelism: Math.max(1, strategies.validationParallelism | 0),
  };
};
