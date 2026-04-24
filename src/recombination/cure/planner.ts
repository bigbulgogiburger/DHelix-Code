/**
 * Cure planner — builds a `CurePlan` from one or more transcripts (PRD §6.4).
 *
 * Team 4 — Phase 3. For each transcript consumed:
 *   1. Emit `delete-file` steps for every `writtenFiles[].path` whose op
 *      was `"create"` or `"update"` (with `expectedHash` for conflict check)
 *   2. Emit `remove-marker` steps for every `reorgMarkerIds[]` — these are
 *      the markers *actually* rendered into DHELIX.md (see recombination-
 *      pipeline.md §통합 함정 #3)
 *   3. When `purge=true`, emit `archive-plasmid` + `clear-refs` steps
 *
 * Warning generation (non-blocking):
 *   - `transcript-orphan` if transcript has no matching `.md` files on disk
 *   - `later-transcript` if a newer transcript references the same plasmids
 *   - `manual-edit` per file whose current hash ≠ expectedHash
 *
 * Layer: Core. Reads from disk (transcripts + artifact files).
 */
import type { PlanCureFn } from "../types.js";

export const planCure: PlanCureFn = async () => {
  throw new Error("TODO Phase 3 Team 4: planCure");
};
