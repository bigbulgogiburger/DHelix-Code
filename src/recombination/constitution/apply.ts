/**
 * Pure `applyPlan` helper — takes an existing DHELIX.md string + a {@link ReorgPlan}
 * and produces the new constitution string. No I/O.
 *
 * Reused by the reorganizer's internal deterministic-simulator (for `insert
 * location.after` resolution) and called by Team 5 at Stage 4 to produce the
 * file to write.
 *
 * Order of op application:
 *   1. `remove` — drop the marker block entirely (including its EOL framing).
 *   2. `update` — replace the body of an existing marker, preserving id + frame.
 *   3. `insert` — append new marker block after the anchor (or EOF).
 *   4. `keep` — no-op (sanity audit only).
 *
 * User sections are never touched; the section tree round-trips byte-for-byte
 * through `render()` after op application.
 *
 * Layer: Core (Layer 2). Leaf-pure.
 */

import type { ReorgOp, ReorgPlan } from "../types.js";
import type { MarkerSection, Section, SectionTree, UserSection } from "./section-tree.js";
import { findMarker, listMarkerIds, parse, render } from "./section-tree.js";

export interface ApplyResult {
  readonly newConstitution: string;
  readonly markerIdsWritten: readonly string[];
}

/**
 * Apply `plan` to `existingConstitution`. Pure: does not touch disk.
 *
 * Throws via the section-tree parser if `existingConstitution` is malformed.
 * Silently ignores `update` / `remove` ops whose target is missing — callers
 * are expected to have run {@link validateUpdateTargets} first; we stay
 * robust here so partial plans still produce a stable output.
 */
export function applyPlan(
  existingConstitution: string,
  plan: ReorgPlan,
): ApplyResult {
  const tree = parse(existingConstitution);

  // 1 + 2. remove + update: mutate the existing section list in place.
  const removedIds = new Set<string>();
  const updatedBodies = new Map<string, { heading: string; body: string }>();
  for (const op of plan.ops) {
    if (op.kind === "remove") {
      removedIds.add(op.markerId);
    } else if (op.kind === "update") {
      updatedBodies.set(op.markerId, {
        heading: op.heading,
        body: op.body,
      });
    }
  }

  const afterRemoveUpdate: Section[] = [];
  for (const section of tree.sections) {
    if (section.kind === "marker") {
      if (removedIds.has(section.markerId)) continue;
      const update = updatedBodies.get(section.markerId);
      if (update) {
        afterRemoveUpdate.push({
          kind: "marker",
          markerId: section.markerId,
          heading: update.heading,
          body: update.body,
          startLine: section.startLine,
          endLine: section.endLine,
          ...(section.sourcePlasmidIdHint
            ? { sourcePlasmidIdHint: section.sourcePlasmidIdHint }
            : {}),
        });
        continue;
      }
    }
    afterRemoveUpdate.push(section);
  }

  let workingTree: SectionTree = {
    sections: afterRemoveUpdate,
    lineEnding: tree.lineEnding,
    trailingNewline: tree.trailingNewline || afterRemoveUpdate.length > 0,
  };

  // 3. insert: one op at a time so each insert anchors against the latest state.
  const inserted: string[] = [];
  for (const op of plan.ops) {
    if (op.kind !== "insert") continue;
    workingTree = insertMarker(workingTree, op);
    inserted.push(op.markerId);
  }

  // 4. keep — no-op.

  const remainingIds = listMarkerIds(workingTree);
  const updatedIds = Array.from(updatedBodies.keys()).filter((id) =>
    remainingIds.has(id),
  );
  const markerIdsWritten = [...updatedIds, ...inserted];

  return {
    newConstitution: render(workingTree),
    markerIdsWritten,
  };
}

function insertMarker(tree: SectionTree, op: ReorgOp): SectionTree {
  if (op.kind !== "insert") return tree;

  const newMarker: MarkerSection = {
    kind: "marker",
    markerId: op.markerId,
    heading: op.heading,
    body: op.body,
    startLine: -1,
    endLine: -1,
    ...(extractHintFromId(op.markerId)
      ? { sourcePlasmidIdHint: extractHintFromId(op.markerId) as string }
      : {}),
  };

  const anchor = op.locationAfter;
  const anchorIdx = anchor ? resolveAnchor(tree, anchor) : -1;

  const next: Section[] = [];
  let inserted = false;

  if (anchorIdx >= 0) {
    for (let i = 0; i < tree.sections.length; i++) {
      next.push(tree.sections[i]);
      if (i === anchorIdx && !inserted) {
        next.push(spacerIfNeeded(tree.sections[i], newMarker));
        next.push(newMarker);
        inserted = true;
      }
    }
  } else {
    // append at EOF
    for (const s of tree.sections) next.push(s);
  }

  if (!inserted) {
    if (next.length > 0) {
      const last = next[next.length - 1];
      next.push(spacerIfNeeded(last, newMarker));
    }
    next.push(newMarker);
  }

  // Strip `undefined` spacers that `spacerIfNeeded` may have emitted.
  const filtered = next.filter(Boolean) as Section[];
  return {
    sections: filtered,
    lineEnding: tree.lineEnding,
    trailingNewline: true,
  };
}

function spacerIfNeeded(prev: Section, _next: MarkerSection): Section {
  // Only inject a spacer between adjacent markers, to keep the rendered file
  // readable. User sections carry their own trailing newlines.
  if (prev.kind === "marker") {
    const blank: UserSection = {
      kind: "user",
      content: "",
      startLine: -1,
      endLine: -1,
    };
    return blank;
  }
  // Returning the previous section doubles it; use a zero-width marker via
  // undefined cast that insertMarker filters out.
  return undefined as unknown as Section;
}

function resolveAnchor(tree: SectionTree, anchor: string): number {
  // Three resolution strategies, tried in order:
  //   1. marker-id equality
  //   2. user-section heading equality (case-insensitive, trimmed)
  //   3. "__END_OF_FILE__" sentinel → -1 so the caller appends
  if (anchor === "__END_OF_FILE__") return -1;

  for (let i = 0; i < tree.sections.length; i++) {
    const s = tree.sections[i];
    if (s.kind === "marker" && s.markerId === anchor) return i;
  }

  const needle = anchor.toLowerCase().trim();
  const stripped = needle.replace(/^#+\s*/, "").trim();
  for (let i = 0; i < tree.sections.length; i++) {
    const s = tree.sections[i];
    if (s.kind !== "user") continue;
    const heading = (s.heading ?? "").toLowerCase().trim();
    if (heading.length > 0 && (heading === needle || heading === stripped)) {
      return i;
    }
  }
  return -1;
}

function extractHintFromId(id: string): string | undefined {
  const slash = id.indexOf("/");
  return slash > 0 ? id.slice(0, slash) : undefined;
}

/** Helper for tests / Team 5 — does the plan touch any user area? */
export function planTouchesUserArea(
  existingConstitution: string,
  plan: ReorgPlan,
): boolean {
  const before = parse(existingConstitution);
  for (const op of plan.ops) {
    if (op.kind === "update" || op.kind === "remove") {
      if (!findMarker(before, op.markerId)) return true;
    }
  }
  return false;
}
