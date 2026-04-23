/**
 * Adaptive budget + overflow governor (P-1.13 §7 / §8, GAL-1 Team-3 brief).
 *
 * Budget (Layer B + D combined) is:
 *
 *   `min(1500, max(300, activePlasmids × 150))`
 *
 * Layers A and C are tiny compared to B/D, so they do not participate in
 * the arithmetic; any overshoot they contribute is absorbed by the cap.
 *
 * Overflow governor behaviour:
 *   - Sort plasmids by tier ASCENDING (L1 first — cheapest to drop) then
 *     plasmid id ASCENDING (deterministic).
 *   - While the cumulative Layer-B token sum exceeds `budget`, drop the
 *     next plasmid off the front. The dropped plasmid stays "active"
 *     (its artifacts still work — see brief); only its summary section
 *     is omitted from generated prompt files.
 *   - `droppedPlasmidIds` is captured so `CompressionOutput` can report
 *     it faithfully. `CompressionOutput` has no `warnings` field so the
 *     caller is expected to inspect this array directly.
 */

import type { PlasmidId, PlasmidTier } from "../../plasmids/types.js";
import type { CompressedPlasmidSummary } from "../types.js";
import {
  COMPRESSION_DEFAULT_BUDGET_TOKENS,
  COMPRESSION_MIN_BUDGET_TOKENS,
  COMPRESSION_PER_PLASMID_TOKENS,
} from "../types.js";

/** Per-plasmid target size by tier — P-1.13 §6.1 (L1 is the cheapest). */
export const TIER_TARGET_TOKENS: Readonly<Record<PlasmidTier, number>> = {
  L1: 50,
  L2: 100,
  L3: 150,
  L4: 250,
};

/** Tier drop ordering — lower priority plasmids leave first. */
const TIER_DROP_ORDER: Readonly<Record<PlasmidTier, number>> = {
  L1: 0,
  L2: 1,
  L3: 2,
  L4: 3,
};

/** Adaptive budget formula — see module header. */
export function computeBudget(activePlasmids: number): number {
  const raw = activePlasmids * COMPRESSION_PER_PLASMID_TOKENS;
  return Math.max(
    COMPRESSION_MIN_BUDGET_TOKENS,
    Math.min(COMPRESSION_DEFAULT_BUDGET_TOKENS, raw),
  );
}

/** Overflow governor output — deterministic given the input ordering. */
export interface OverflowResolution {
  readonly kept: readonly CompressedPlasmidSummary[];
  readonly droppedPlasmidIds: readonly PlasmidId[];
  readonly keptTokens: number;
}

/**
 * Apply overflow governor to a collection of Layer-B summaries.
 *
 * @param summaries — unsorted Layer B outputs.
 * @param budget    — Layer-B portion of the token budget (Layer D separate).
 */
export function resolveOverflow(
  summaries: readonly CompressedPlasmidSummary[],
  budget: number,
): OverflowResolution {
  // Sort ASC: lowest tier first (drop candidates), then plasmid id.
  const ordered = [...summaries].sort((a, b) => {
    const tierDelta = TIER_DROP_ORDER[a.tier] - TIER_DROP_ORDER[b.tier];
    if (tierDelta !== 0) return tierDelta;
    return a.plasmidId.localeCompare(b.plasmidId);
  });

  const totalTokens = ordered.reduce((sum, s) => sum + s.tokenEstimate, 0);
  if (totalTokens <= budget) {
    // Restore original ordering for deterministic output.
    return {
      kept: sortByInputOrder(summaries, ordered),
      droppedPlasmidIds: [],
      keptTokens: totalTokens,
    };
  }

  let overshoot = totalTokens - budget;
  const dropped: PlasmidId[] = [];
  const keptSet = new Set<PlasmidId>(ordered.map((s) => s.plasmidId));

  for (const summary of ordered) {
    if (overshoot <= 0) break;
    dropped.push(summary.plasmidId);
    keptSet.delete(summary.plasmidId);
    overshoot -= summary.tokenEstimate;
  }

  const keptList = summaries.filter((s) => keptSet.has(s.plasmidId));
  const keptTokens = keptList.reduce((sum, s) => sum + s.tokenEstimate, 0);
  return {
    kept: keptList,
    droppedPlasmidIds: dropped,
    keptTokens,
  };
}

/** Preserve caller-provided ordering given a keeper set. */
function sortByInputOrder(
  original: readonly CompressedPlasmidSummary[],
  ordered: readonly CompressedPlasmidSummary[],
): readonly CompressedPlasmidSummary[] {
  const keeperIds = new Set(ordered.map((o) => o.plasmidId));
  return original.filter((s) => keeperIds.has(s.plasmidId));
}
