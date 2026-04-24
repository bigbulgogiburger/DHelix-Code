/**
 * Runtime case executor (P-1.17).
 *
 * Team 2 — Phase 3. Wraps the skill-creator eval runner
 * (`src/skills/creator/evals/runner.ts::runEvals`) to execute each
 * `RuntimeCase` inside the CoW workspace. Key responsibilities:
 *   - Route through `resolveValidationModel` (cloud/local) to respect
 *     the strategy tier; local-small grading skips LLM judge downstream
 *   - Parallelism: cloud=10, local=1 (from `VolumePlan.parallelism`)
 *   - Time budget: enforce `timeBudgetMs` — remaining cases marked
 *     `status="timeout"`; emits `validation.time_budget_exceeded`
 *   - Early exit: if L1 accumulates ≥3 consecutive hard fails, skip
 *     remaining L2-L4 (reporter flags `earlyExit=true`)
 *   - Captures: output text, tool-call transcript, hook fires, file
 *     effects — all in a `RuntimeRunResult`
 *
 * Layer: Core. Spawns sub-agents via the reused runner.
 */
import type { RunCasesFn } from "../types.js";

export const runCases: RunCasesFn = async () => {
  throw new Error("TODO Phase 3 Team 2: runCases");
};
