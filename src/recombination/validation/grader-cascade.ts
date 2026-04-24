/**
 * Grader cascade (PRD §8.4).
 *
 * Team 2 — Phase 3. For each `(RuntimeCase, RuntimeRunResult)` pair,
 * parses expectations (via expectation-dsl) and routes each to the
 * strictest applicable handler from `strategies.gradingTiers`:
 *
 *   deterministic → output-contains / excludes / file-exists /
 *                   file-modified / exit-code
 *   semi          → tool-called / hook-fired (reads `toolCalls` /
 *                   `hookFires` from the runner's transcript)
 *   llm           → free-text (Anthropic judge, confidence parsed from
 *                   JSON; SKIPPED when `"llm"` not in gradingTiers —
 *                   e.g. local-small profile)
 *
 * Returns `handler: "skipped"` for expectations with no available
 * handler (e.g. `tool:` expectation under deterministic-only grading).
 *
 * Layer: Core. Calls LLM only for free-text expectations under `"llm"`.
 */
import type { GradeCasesFn } from "../types.js";

export const gradeCases: GradeCasesFn = async () => {
  throw new Error("TODO Phase 3 Team 2: gradeCases");
};
