/**
 * `.dhelix/recombination/refs/plasmids/<id>` index (PRD §7.1).
 *
 * Team 4 — Phase 3. Plasmid-to-latest-transcript map. Written at Stage 7
 * by the recombination executor (Team 5 wires this) and read by
 * `/cure --plasmid <id>`.
 *
 * Format: single-line file, `<transcript-id>\n`. Overwritten atomically
 * each time (not append-only — this is a single-valued ref, not audit).
 *
 * Layer: Core. Atomic write via tmp+rename.
 */
import type { PlasmidId } from "../../plasmids/types.js";

export const writePlasmidRef: (
  workingDirectory: string,
  plasmidId: PlasmidId,
  transcriptId: string,
  signal?: AbortSignal,
) => Promise<void> = () => {
  throw new Error("TODO Phase 3 Team 4: writePlasmidRef");
};

export const readPlasmidRef: (
  workingDirectory: string,
  plasmidId: PlasmidId,
  signal?: AbortSignal,
) => Promise<string | null> = () => {
  throw new Error("TODO Phase 3 Team 4: readPlasmidRef");
};

export const clearPlasmidRef: (
  workingDirectory: string,
  plasmidId: PlasmidId,
  signal?: AbortSignal,
) => Promise<void> = () => {
  throw new Error("TODO Phase 3 Team 4: clearPlasmidRef");
};

export const listPlasmidRefs: (
  workingDirectory: string,
  signal?: AbortSignal,
) => Promise<ReadonlyMap<PlasmidId, string>> = () => {
  throw new Error("TODO Phase 3 Team 4: listPlasmidRefs");
};
