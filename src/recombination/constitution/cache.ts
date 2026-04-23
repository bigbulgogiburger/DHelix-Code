/**
 * Plan cache for the constitution reorganizer (Stage 2d).
 *
 * Key derivation only — this module does not perform I/O. Team 5 resolves the
 * returned `{dir, file}` relative to the working directory and implements
 * the read/write (same pattern as the other stage caches).
 *
 * Key components (SHA-256 of `|`-joined fields):
 *   - `intentGraphHash`   — stable hash of the IR graph
 *   - `constitutionHash`  — SHA-256 of the pre-reorg DHELIX.md
 *   - `model`             — model id (so model swaps invalidate)
 *   - `reorgVersion`      — module version (bumped on prompt change)
 *   - `reorgFallback`     — strategy string (llm-only / …)
 *
 * Layer: Core (Layer 2). Leaf-pure (Node crypto only).
 */

import { createHash } from "node:crypto";

import {
  RECOMBINATION_OBJECTS_DIR,
  type ReorgFallback,
} from "../types.js";

export interface CacheKeyInput {
  readonly intentGraphHash: string;
  readonly constitutionHash: string;
  readonly model: string;
  readonly reorgVersion: string;
  readonly reorgFallback: ReorgFallback;
}

export interface CacheLocation {
  /** SHA-256 hex of the composite key. */
  readonly key: string;
  /** Relative directory under the working dir — `.dhelix/recombination/objects/<first2>`. */
  readonly dir: string;
  /** Relative path including filename — `<dir>/<rest>.json`. */
  readonly file: string;
}

/** Compute the cache location for a reorg plan. Pure. */
export function reorgCacheLocation(input: CacheKeyInput): CacheLocation {
  const key = createHash("sha256")
    .update(
      [
        input.intentGraphHash,
        input.constitutionHash,
        input.model,
        input.reorgVersion,
        input.reorgFallback,
      ].join("|"),
      "utf8",
    )
    .digest("hex");

  const dir = `${RECOMBINATION_OBJECTS_DIR}/${key.slice(0, 2)}`;
  const file = `${dir}/${key.slice(2)}.json`;
  return { key, dir, file };
}

/** Hash DHELIX.md content — exposed so Team 5 can pre-compute before calling. */
export function hashConstitution(constitutionMd: string): string {
  return createHash("sha256").update(constitutionMd, "utf8").digest("hex");
}

/**
 * Hash the interpreter IR graph — deterministic across runs. Uses the stable
 * per-IR `cacheKey` (already includes body fingerprint + strategy + model).
 */
export function hashIntentGraph(
  irs: readonly { readonly cacheKey: string; readonly plasmidId: string }[],
): string {
  const sorted = [...irs]
    .map((ir) => `${ir.plasmidId}:${ir.cacheKey}`)
    .sort();
  return createHash("sha256").update(sorted.join("\n"), "utf8").digest("hex");
}
