/**
 * Volume governor (P-1.16 §3, PRD §8.3).
 *
 * Team 1 — Phase 3. Pure, sync. Produces a `VolumePlan` that caps case
 * counts per plasmid × tier based on:
 *   1. `PipelineStrategies.validationVolume` (standard|governed|minimal)
 *   2. Plasmid tier (foundational > policy > tactical > agent-proposed)
 *   3. Validation level (L1..L4)
 *
 * Totals: standard ~150 / governed ~50 / minimal ~20 per PRD §8.3.
 *
 * Layer: Core. No I/O.
 */
import type { VolumeGovernorFn } from "../types.js";

export const buildVolumePlan: VolumeGovernorFn = () => {
  throw new Error("TODO Phase 3 Team 1: buildVolumePlan");
};
