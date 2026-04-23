/**
 * Bucket router — Layer C sub-component (P-1.13 §4).
 *
 * Given an interpreted plasmid (tier + intent kinds), pick a single
 * `PromptSectionBucket`. The router is deterministic, pure, and exposed
 * separately so tests pin the mapping explicitly.
 *
 * Rules (from GAL-1 Team-3 brief, Phase 2):
 *   1. `intent.kind === "harness"` → `principles` (broad-policy signal).
 *   2. tier `L3` or `L4` AND no actionable kind in {agent,skill,command,hook}
 *      → `principles` (strategic / foundational guidance).
 *   3. any `intent.kind === "rule"` → `constraints` (constraints-heavy).
 *   4. any `intent.kind` in {agent, skill, command, hook} → `capabilities`.
 *   5. fallback → `domain-knowledge`.
 *
 * Priority ordering matters: harness wins over broad-policy, which wins
 * over rule, which wins over capabilities. A plasmid with both `harness`
 * and `skill` intents lands in `principles` because harness carries the
 * strongest prompt-level intent.
 */

import type {
  CompiledPlasmidIR,
  IntentKind,
  PromptSectionBucket,
} from "../types.js";

const CAPABILITY_KINDS: ReadonlySet<IntentKind> = new Set<IntentKind>([
  "agent",
  "skill",
  "command",
  "hook",
]);

/** Pure classifier — same input → same bucket. */
export function routeBucket(ir: CompiledPlasmidIR): PromptSectionBucket {
  const kinds = new Set<IntentKind>(ir.intents.map((i) => i.kind));

  if (kinds.has("harness")) return "principles";

  const hasActionable = Array.from(kinds).some((k) =>
    CAPABILITY_KINDS.has(k),
  );
  if ((ir.tier === "L3" || ir.tier === "L4") && !hasActionable) {
    return "principles";
  }

  if (kinds.has("rule")) return "constraints";

  if (hasActionable) return "capabilities";

  return "domain-knowledge";
}
