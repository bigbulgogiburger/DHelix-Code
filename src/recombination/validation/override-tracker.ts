/**
 * Override audit ledger (`.dhelix/recombination/validation-overrides.jsonl`).
 *
 * Team 3 — Phase 3. Append-only (I-5). Whenever a user keeps a failed
 * validation via the grace-period prompt, an `OverrideRecord` is appended.
 * Phase 3 is read-only auditing; Phase 4+ may block after N overrides.
 *
 * Layer: Core. Atomic append via `{ flag: "a" }`.
 */
import type { OverrideRecord } from "../types.js";
import type { PlasmidId } from "../../plasmids/types.js";

export const recordOverride: (
  workingDirectory: string,
  record: OverrideRecord,
  signal?: AbortSignal,
) => Promise<void> = () => {
  throw new Error("TODO Phase 3 Team 3: recordOverride");
};

export interface OverrideQuery {
  readonly plasmidId: PlasmidId;
  readonly sinceDays?: number;
}

export const countOverrides: (
  workingDirectory: string,
  query: OverrideQuery,
  signal?: AbortSignal,
) => Promise<number> = () => {
  throw new Error("TODO Phase 3 Team 3: countOverrides");
};
