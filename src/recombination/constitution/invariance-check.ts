/**
 * I-9 invariance enforcement for DHELIX.md reorg (Stage 2d, P-1.15).
 *
 * Two guardrails, deployed in sequence:
 *   1. {@link validateUpdateTargets} — structural pre-check. Rejects plans
 *      whose `update` / `remove` ops reference marker-ids that don't exist
 *      in the current DHELIX.md (most common LLM-I-9-violation pattern).
 *   2. {@link verifyUserAreaInvariance} — semantic post-check. Compares the
 *      hashed user-sections of (before → after) trees; any mismatch aborts.
 *
 * The hash set is the ground truth, not pointer equality: line-offsets shift
 * when markers are inserted / removed, so we normalise user text and compare
 * multiset equality.
 *
 * Layer: Core (Layer 2). Leaf-pure (Node crypto + utils/hash only).
 */

import { createHash } from "node:crypto";

import type { ReorgPlan } from "../types.js";
import {
  ReorgInvalidUpdateTargetError,
  ReorgUserAreaViolationError,
} from "./errors.js";
import type { SectionTree } from "./section-tree.js";
import { listUserSections } from "./section-tree.js";

/**
 * Normalise a user-authored string for hashing. Minimal — only the things
 * that should never count as a "change":
 *   - trim trailing whitespace per line (editors add/strip)
 *   - collapse CRLF to LF
 *   - strip a single trailing newline (presence is captured by `trailingNewline` in the tree)
 *
 * No other normalisation. Case, punctuation, leading whitespace all significant.
 */
export function normalizeUserText(s: string): string {
  const lf = s.replace(/\r\n/g, "\n");
  const trimmed = lf
    .split("\n")
    .map((line) => line.replace(/[ \t]+$/, ""))
    .join("\n");
  return trimmed.endsWith("\n") ? trimmed.slice(0, -1) : trimmed;
}

/** SHA-256 hex of the normalised text. Stable across OS / editor variants. */
export function hashUserText(s: string): string {
  return createHash("sha256").update(normalizeUserText(s), "utf8").digest("hex");
}

/**
 * Throws {@link ReorgInvalidUpdateTargetError} if any `update` or `remove` op
 * in `plan` targets a `markerId` not present in `existingMarkerIds`.
 *
 * `insert` and `keep` ops are not checked here — insert creates a new marker
 * and keep is a no-op.
 */
export function validateUpdateTargets(
  plan: ReorgPlan,
  existingMarkerIds: ReadonlySet<string>,
): void {
  const violations: Array<{ kind: string; markerId: string }> = [];
  for (const op of plan.ops) {
    if (op.kind !== "update" && op.kind !== "remove") continue;
    if (!existingMarkerIds.has(op.markerId)) {
      violations.push({ kind: op.kind, markerId: op.markerId });
    }
  }
  if (violations.length > 0) {
    const summary = violations
      .map((v) => `${v.kind}:${v.markerId}`)
      .join(", ");
    throw new ReorgInvalidUpdateTargetError(
      `REORG_INVALID_UPDATE_TARGET: plan targets non-existent marker(s) ${summary}. Possible I-9 violation attempt.`,
      { violations, existingMarkers: Array.from(existingMarkerIds).sort() },
    );
  }
}

/**
 * Semantic I-9 enforcement. After applying the plan, every user section that
 * existed in `before` must still exist (by normalised-content hash) in
 * `after`, and `after` must not introduce any user section not present in
 * `before`. Violations throw {@link ReorgUserAreaViolationError}.
 *
 * Multiset semantics — if the same user text appears twice in `before` (rare
 * but legal: two empty sections), it must still appear twice in `after`.
 */
export function verifyUserAreaInvariance(
  beforeTree: SectionTree,
  afterTree: SectionTree,
): void {
  const beforeCounts = hashCounts(beforeTree);
  const afterCounts = hashCounts(afterTree);

  const missing: string[] = [];
  const added: string[] = [];

  for (const [hash, count] of beforeCounts) {
    const afterCount = afterCounts.get(hash) ?? 0;
    if (afterCount < count) missing.push(hash);
  }
  for (const [hash, count] of afterCounts) {
    const beforeCount = beforeCounts.get(hash) ?? 0;
    if (count > beforeCount) added.push(hash);
  }

  if (missing.length === 0 && added.length === 0) return;

  throw new ReorgUserAreaViolationError(
    `REORG_USER_AREA_VIOLATION: user-authored DHELIX.md region would change ` +
      `(missing=${missing.length}, added=${added.length}). Plan rejected.`,
    { missingHashes: missing, addedHashes: added },
  );
}

function hashCounts(tree: SectionTree): Map<string, number> {
  const counts = new Map<string, number>();
  for (const section of listUserSections(tree)) {
    // Skip truly empty user sections (pure whitespace) — they are filler
    // between markers, not "content". Without this, an inserted marker that
    // happens to land adjacent to another marker looks like it "added" a
    // blank user section.
    const normalized = normalizeUserText(section.content);
    if (normalized.length === 0) continue;
    const hash = hashUserText(section.content);
    counts.set(hash, (counts.get(hash) ?? 0) + 1);
  }
  return counts;
}
