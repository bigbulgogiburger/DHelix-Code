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
import { mkdir, readFile, readdir, rename, unlink, writeFile } from "node:fs/promises";
import { join } from "node:path";

import type { PlasmidId } from "../../plasmids/types.js";
import { RECOMBINATION_REFS_DIR } from "../types.js";

interface NodeError extends Error {
  code?: string;
}

function isNodeError(err: unknown): err is NodeError {
  return err instanceof Error && typeof (err as NodeError).code === "string";
}

function refPath(workingDirectory: string, plasmidId: PlasmidId): string {
  return join(workingDirectory, RECOMBINATION_REFS_DIR, String(plasmidId));
}

function refsDir(workingDirectory: string): string {
  return join(workingDirectory, RECOMBINATION_REFS_DIR);
}

function assertNotAborted(signal?: AbortSignal): void {
  if (signal?.aborted) {
    throw new Error("refs: aborted");
  }
}

export const writePlasmidRef: (
  workingDirectory: string,
  plasmidId: PlasmidId,
  transcriptId: string,
  signal?: AbortSignal,
) => Promise<void> = async (workingDirectory, plasmidId, transcriptId, signal) => {
  assertNotAborted(signal);
  const dir = refsDir(workingDirectory);
  await mkdir(dir, { recursive: true });
  const target = refPath(workingDirectory, plasmidId);
  const tmp = `${target}.tmp.${process.pid}.${Date.now()}`;
  try {
    await writeFile(tmp, `${transcriptId}\n`, "utf-8");
    await rename(tmp, target);
  } catch (err) {
    try {
      await unlink(tmp);
    } catch {
      /* best effort */
    }
    throw err;
  }
};

export const readPlasmidRef: (
  workingDirectory: string,
  plasmidId: PlasmidId,
  signal?: AbortSignal,
) => Promise<string | null> = async (workingDirectory, plasmidId, signal) => {
  assertNotAborted(signal);
  try {
    const raw = await readFile(refPath(workingDirectory, plasmidId), "utf-8");
    const trimmed = raw.trim();
    return trimmed.length === 0 ? null : trimmed;
  } catch (err) {
    if (isNodeError(err) && err.code === "ENOENT") return null;
    throw err;
  }
};

export const clearPlasmidRef: (
  workingDirectory: string,
  plasmidId: PlasmidId,
  signal?: AbortSignal,
) => Promise<void> = async (workingDirectory, plasmidId, signal) => {
  assertNotAborted(signal);
  try {
    await unlink(refPath(workingDirectory, plasmidId));
  } catch (err) {
    if (isNodeError(err) && err.code === "ENOENT") return;
    throw err;
  }
};

export const listPlasmidRefs: (
  workingDirectory: string,
  signal?: AbortSignal,
) => Promise<ReadonlyMap<PlasmidId, string>> = async (workingDirectory, signal) => {
  assertNotAborted(signal);
  const dir = refsDir(workingDirectory);
  const out = new Map<PlasmidId, string>();
  let entries: readonly string[];
  try {
    entries = await readdir(dir);
  } catch (err) {
    if (isNodeError(err) && err.code === "ENOENT") return out;
    throw err;
  }
  for (const entry of entries) {
    try {
      const raw = await readFile(join(dir, entry), "utf-8");
      const trimmed = raw.trim();
      if (trimmed.length > 0) {
        out.set(entry as PlasmidId, trimmed);
      }
    } catch (err) {
      if (isNodeError(err) && err.code === "ENOENT") continue;
      throw err;
    }
  }
  return out;
};
