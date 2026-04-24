/**
 * Case generator (P-1.16 + P-1.23 integration).
 *
 * Team 1 — Phase 3. For each plasmid × tier slot, fills the quota using
 * three sources in priority order (P-1.23 §7):
 *   1. eval-seeds file (loaded via eval-seeds.ts) — capped at 20/plasmid
 *   2. deterministic derivation from intent nodes (triggers, behavior,
 *      constraints, expression-conditions)
 *   3. LLM auto-generation — fills remaining quota, multilingual mix for
 *      L4 (50% body-language / 30% English / 20% other)
 *
 * Drops overflow cases by plasmid-tier priority and emits telemetry
 * `validation.constraint_cases_dropped`. Never exceeds `VolumePlan.perPlasmid`.
 *
 * Layer: Core. Calls LLM for L3-L4 auto-gen (optional, gated by strategy tier).
 */
import type { GenerateCasesFn } from "../types.js";

export const generateCases: GenerateCasesFn = async () => {
  throw new Error("TODO Phase 3 Team 1: generateCases");
};
