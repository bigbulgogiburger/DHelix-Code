/**
 * Three-way line merge (diff3) — Team 4 Phase 4 (Cure v1).
 *
 * Pure function. Given `base`, `current`, and `target` strings (split by `\n`)
 * it computes line-level diffs of (base → current) and (base → target) using
 * the O(ND) Myers algorithm, then walks the shared base lines in lock-step
 * to decide each region:
 *
 *   - Both sides identical to base → keep base line.
 *   - Only current changed         → take current hunk (clean-merge).
 *   - Only target changed          → take target hunk (clean-merge).
 *   - Both changed identically     → take current hunk (clean-merge).
 *   - Both changed divergently     → emit conflict markers (git style).
 *
 * Cure-specific semantics (`target === ""`):
 *   - When the user never touched the file (current === base) the delete
 *     proceeds cleanly (`clean-merge` with `mergedContent = ""`).
 *   - When the user edited the file (current !== base) we DO NOT delete —
 *     Phase-4 policy: user edits win over delete-target. Outcome is
 *     `kept-user` and `mergedContent = current`.
 *
 * No fs — this module is purely in-memory. See `./object-store.ts` for the
 * blob loader the restorer composes with.
 *
 * Layer: Core (Layer 2). No imports outside `../types.js`.
 */

import type {
  ThreeWayMergeConflict,
  ThreeWayMergeResult,
} from "../types.js";

// ─── Myers O(ND) diff ────────────────────────────────────────────────────────
//
// Produces a list of "shared index pairs" `(aIdx, bIdx)` into arrays `a` and
// `b`, one per common line. The LCS is then used to split both sequences into
// matched / unmatched regions.

interface LcsPair {
  readonly a: number;
  readonly b: number;
}

function myersLcs(a: readonly string[], b: readonly string[]): readonly LcsPair[] {
  const n = a.length;
  const m = b.length;
  const max = n + m;
  if (max === 0) return [];

  // `trace[d][k + max]` = furthest x reached on diagonal k after d edits.
  const trace: number[][] = [];
  const v: number[] = new Array(2 * max + 1).fill(0);

  for (let d = 0; d <= max; d++) {
    trace.push(v.slice());
    for (let k = -d; k <= d; k += 2) {
      let x: number;
      const kIdx = k + max;
      if (k === -d || (k !== d && v[kIdx - 1] < v[kIdx + 1])) {
        x = v[kIdx + 1];
      } else {
        x = v[kIdx - 1] + 1;
      }
      let y = x - k;
      while (x < n && y < m && a[x] === b[y]) {
        x++;
        y++;
      }
      v[kIdx] = x;
      if (x >= n && y >= m) {
        return backtrack(trace, d, n, m, max);
      }
    }
  }
  return [];
}

function backtrack(
  trace: readonly number[][],
  dFinal: number,
  n: number,
  m: number,
  max: number,
): readonly LcsPair[] {
  const pairs: LcsPair[] = [];
  let x = n;
  let y = m;
  for (let d = dFinal; d > 0; d--) {
    const v = trace[d];
    const k = x - y;
    const kIdx = k + max;
    let prevK: number;
    if (k === -d || (k !== d && v[kIdx - 1] < v[kIdx + 1])) {
      prevK = k + 1;
    } else {
      prevK = k - 1;
    }
    const prevX = v[prevK + max];
    const prevY = prevX - prevK;
    while (x > prevX && y > prevY) {
      pairs.push({ a: x - 1, b: y - 1 });
      x--;
      y--;
    }
    x = prevX;
    y = prevY;
  }
  while (x > 0 && y > 0) {
    pairs.push({ a: x - 1, b: y - 1 });
    x--;
    y--;
  }
  pairs.reverse();
  return pairs;
}

// ─── Split helpers ───────────────────────────────────────────────────────────

function splitLines(text: string): readonly string[] {
  // Always split on `\n`; callers join back with `\n`. Preserves trailing
  // empty line semantics: "a\n" → ["a", ""], "" → [""]. Matching this
  // exactly is important so `current === base` string-equality survives a
  // split / join round-trip.
  return text.split("\n");
}

function joinLines(lines: readonly string[]): string {
  return lines.join("\n");
}

/**
 * Which base lines each side kept verbatim. `baseKeptByOther[i]` is true iff
 * base line i appears in `other`'s LCS with base. A false entry indicates the
 * side deleted (or replaced) that line.
 */
function buildBaseMask(
  base: readonly string[],
  other: readonly string[],
): {
  readonly baseKept: readonly boolean[];
  readonly pairs: readonly LcsPair[];
} {
  const pairs = myersLcs(base, other);
  const baseKept: boolean[] = new Array(base.length).fill(false);
  for (const p of pairs) baseKept[p.a] = true;
  return { baseKept, pairs };
}

// ─── Region walker ───────────────────────────────────────────────────────────
//
// We walk base from i=0..base.length in lock-step with `current` and `target`
// using the two LCS maps. A "sync point" is a base index where BOTH sides
// matched that base line (unchanged in both). Between consecutive sync points
// we have a hunk where at least one side diverged.

interface SyncAnchor {
  readonly baseIdx: number; // -1 = virtual start, base.length = virtual end
  readonly currentIdx: number;
  readonly targetIdx: number;
}

function collectSyncAnchors(
  base: readonly string[],
  current: readonly string[],
  target: readonly string[],
  currentPairs: readonly LcsPair[],
  targetPairs: readonly LcsPair[],
): readonly SyncAnchor[] {
  // Index of base line → position in `current` (or -1 if not kept there).
  const baseToCurrent: number[] = new Array(base.length).fill(-1);
  for (const p of currentPairs) baseToCurrent[p.a] = p.b;
  const baseToTarget: number[] = new Array(base.length).fill(-1);
  for (const p of targetPairs) baseToTarget[p.a] = p.b;

  const anchors: SyncAnchor[] = [
    { baseIdx: -1, currentIdx: -1, targetIdx: -1 },
  ];
  for (let i = 0; i < base.length; i++) {
    const c = baseToCurrent[i];
    const t = baseToTarget[i];
    if (c >= 0 && t >= 0) {
      anchors.push({ baseIdx: i, currentIdx: c, targetIdx: t });
    }
  }
  anchors.push({
    baseIdx: base.length,
    currentIdx: current.length,
    targetIdx: target.length,
  });
  return anchors;
}

function sliceExclusive(
  arr: readonly string[],
  startExcl: number,
  endExcl: number,
): readonly string[] {
  const from = startExcl + 1;
  const to = endExcl; // exclusive
  if (from >= to) return [];
  return arr.slice(from, to);
}

function arraysEqual(a: readonly string[], b: readonly string[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

function conflictBlock(
  currentHunk: readonly string[],
  baseHunk: readonly string[],
  targetHunk: readonly string[],
): readonly string[] {
  const out: string[] = [];
  out.push("<<<<<<< current");
  for (const l of currentHunk) out.push(l);
  out.push("||||||| base");
  for (const l of baseHunk) out.push(l);
  out.push("=======");
  for (const l of targetHunk) out.push(l);
  out.push(">>>>>>> target");
  return out;
}

// ─── Main entry ──────────────────────────────────────────────────────────────

/**
 * Three-way merge of `base`, `current`, `target` by line.
 *
 * Contract: see file header comment + `ThreeWayMergeResult` in `../types.ts`.
 */
export function threeWayMerge(
  base: string,
  current: string,
  target: string,
): ThreeWayMergeResult {
  // Fast paths — pure string equality.
  if (current === base && target === base) {
    return {
      outcome: "identical",
      mergedContent: base,
      conflicts: [],
      userEditDetected: false,
    };
  }

  // Cure delete-case special handling BEFORE generic fast paths so we can
  // emit `kept-user` correctly when target === "" and current diverges.
  if (target === "") {
    if (current === base) {
      return {
        outcome: "clean-merge",
        mergedContent: "",
        conflicts: [],
        userEditDetected: false,
      };
    }
    return {
      outcome: "kept-user",
      mergedContent: current,
      conflicts: [],
      userEditDetected: true,
    };
  }

  if (current === base) {
    return {
      outcome: "clean-merge",
      mergedContent: target,
      conflicts: [],
      userEditDetected: false,
    };
  }
  if (target === base) {
    return {
      outcome: "clean-merge",
      mergedContent: current,
      conflicts: [],
      userEditDetected: true,
    };
  }

  const baseLines = splitLines(base);
  const currentLines = splitLines(current);
  const targetLines = splitLines(target);

  const { pairs: currentPairs } = buildBaseMask(baseLines, currentLines);
  const { pairs: targetPairs } = buildBaseMask(baseLines, targetLines);

  const anchors = collectSyncAnchors(
    baseLines,
    currentLines,
    targetLines,
    currentPairs,
    targetPairs,
  );

  const merged: string[] = [];
  const conflicts: ThreeWayMergeConflict[] = [];

  for (let i = 0; i < anchors.length - 1; i++) {
    const a = anchors[i];
    const b = anchors[i + 1];

    // Emit the sync line itself (except for the virtual start anchor).
    // Actually: we emit the UN-synced region BEFORE b, then b's own line.
    const baseHunk = sliceExclusive(baseLines, a.baseIdx, b.baseIdx);
    const currentHunk = sliceExclusive(currentLines, a.currentIdx, b.currentIdx);
    const targetHunk = sliceExclusive(targetLines, a.targetIdx, b.targetIdx);

    const currentChanged = !arraysEqual(currentHunk, baseHunk);
    const targetChanged = !arraysEqual(targetHunk, baseHunk);

    if (!currentChanged && !targetChanged) {
      // No-op region — keep base hunk verbatim.
      for (const l of baseHunk) merged.push(l);
    } else if (currentChanged && !targetChanged) {
      for (const l of currentHunk) merged.push(l);
    } else if (!currentChanged && targetChanged) {
      for (const l of targetHunk) merged.push(l);
    } else if (arraysEqual(currentHunk, targetHunk)) {
      // Both sides agree.
      for (const l of currentHunk) merged.push(l);
    } else {
      // Divergent — emit conflict block.
      const startLine = merged.length + 1;
      const block = conflictBlock(currentHunk, baseHunk, targetHunk);
      for (const l of block) merged.push(l);
      conflicts.push({
        startLine,
        endLine: merged.length,
        baseHunk,
        currentHunk,
        targetHunk,
      });
    }

    // Emit the sync line for b unless it's the virtual end anchor.
    if (b.baseIdx < baseLines.length) {
      merged.push(baseLines[b.baseIdx]);
    }
  }

  const outcome: ThreeWayMergeResult["outcome"] =
    conflicts.length > 0 ? "conflict-markers" : "clean-merge";

  return {
    outcome,
    mergedContent: joinLines(merged),
    conflicts,
    userEditDetected: current !== base,
  };
}
