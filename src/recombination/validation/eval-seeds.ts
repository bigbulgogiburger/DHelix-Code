/**
 * eval-seeds schema + loader (P-1.23).
 *
 * Team 1 — Phase 3. Extends the shared `evalCaseSchema` from
 * `src/skills/creator/evals/types.ts` with `tier` (L1-L4, required) and
 * reuses the existing `expectations` / `expected_output_contains` /
 * `expected_output_excludes` fields. Enforces the 20-seed per-plasmid cap
 * via Zod `.max(20)` + duplicate-id detection in `superRefine`.
 *
 * Legacy coexistence (P-1.23 §6): `expected_output_contains/excludes`
 * auto-rewritten to DSL `output contains / does NOT contain` prefixes at
 * load time so the grader sees a single shape.
 *
 * Layer: Core (Layer 2). Reads from disk.
 */
import type { PlasmidId } from "../../plasmids/types.js";
import type { RuntimeCase, ValidationLevel } from "../types.js";

export interface EvalSeed {
  readonly id: string;
  readonly tier: ValidationLevel;
  readonly prompt: string;
  readonly expectations: readonly string[];
  readonly tags?: readonly string[];
  readonly setupFiles?: readonly {
    readonly path: string;
    readonly content: string;
  }[];
}

export interface EvalSeedsFile {
  readonly plasmidId: PlasmidId;
  readonly version: number;
  readonly seeds: readonly EvalSeed[];
}

/** Resolve the eval-seeds file path for a plasmid, or return null if missing. */
export const evalSeedsPath: (
  workingDirectory: string,
  plasmidId: PlasmidId,
) => string = () => {
  throw new Error("TODO Phase 3 Team 1: evalSeedsPath");
};

/** Load + Zod-parse a plasmid's eval-seeds file, returning [] if absent. */
export const loadEvalSeeds: (
  workingDirectory: string,
  plasmidId: PlasmidId,
  signal?: AbortSignal,
) => Promise<readonly EvalSeed[]> = () => {
  throw new Error("TODO Phase 3 Team 1: loadEvalSeeds");
};

/** Project loaded seeds into RuntimeCase envelopes (fills origin + plasmidId). */
export const seedsToCases: (
  plasmidId: PlasmidId,
  seeds: readonly EvalSeed[],
) => readonly RuntimeCase[] = () => {
  throw new Error("TODO Phase 3 Team 1: seedsToCases");
};
