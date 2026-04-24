/**
 * Cure restorer — executes a `CurePlan` atomically (PRD §6.4).
 *
 * Team 4 — Phase 3. Steps:
 *   1. Acquire `.dhelix/recombination/.lock` (reentrant)
 *   2. (Optional) Suggest `git add -A && git commit` anchor — `dryRun`
 *      previews; user `[y]` confirms via approvalMode
 *   3. Delete files listed in plan — skip + record warning on
 *      `CURE_CONFLICT` (current hash ≠ expectedHash) unless user overrides
 *   4. Re-parse DHELIX.md + construct a *reverse* `ReorgPlan` (one
 *      `kind:"remove"` op per markerId), call `applyConstitutionPlan`
 *      from `../constitution/index.js`
 *   5. Run `verifyUserAreaInvariance(beforeTree, afterTree)` — abort with
 *      `REORG_USER_AREA_VIOLATION` on failure (I-9)
 *   6. When `purge=true`, move plasmid `.md` to archive + clear refs/
 *   7. Append audit.log entry (I-5) + release lock
 *
 * Layer: Core. Heavy I/O; must be atomic per-step.
 */
import type { RestoreCureFn } from "../types.js";

export const restoreCure: RestoreCureFn = async () => {
  throw new Error("TODO Phase 3 Team 4: restoreCure");
};
