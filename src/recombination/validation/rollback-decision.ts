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
import type { DecideRollbackFn } from "../types.js";

export const decideRollback: DecideRollbackFn = () => {
  throw new Error("TODO Phase 3 Team 3: decideRollback");
};
