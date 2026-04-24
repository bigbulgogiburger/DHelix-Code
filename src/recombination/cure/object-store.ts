/**
 * Content-addressed blob reader — Team 4 Phase 4 (Cure v1).
 *
 * Thin async wrapper around `fs.readFile(objectStorePath(cwd, hash))`.
 * Returns `null` on ENOENT so callers can gracefully fall back when a blob
 * is missing (e.g. Phase-2/3 transcripts that predate the object store).
 *
 * Writes to the object store are Team 5's responsibility (Stage 4). This
 * module is strictly read-only.
 *
 * Layer: Core (Layer 2). Uses `node:fs/promises`; respects `AbortSignal`.
 */
import { readFile } from "node:fs/promises";

import { objectStorePath } from "../types.js";

interface NodeError extends Error {
  code?: string;
}

function isNodeError(err: unknown): err is NodeError {
  return err instanceof Error && typeof (err as NodeError).code === "string";
}

/**
 * Read a blob from the content-addressed store.
 *
 * @param cwd - project root (objects live under `<cwd>/.dhelix/recombination/objects/`).
 * @param hash - full sha256 hex. Must be non-empty.
 * @param signal - optional abort signal propagated to `fs.readFile`.
 * @returns the blob body (utf-8), or `null` if the blob file does not exist.
 */
export async function readBlob(
  cwd: string,
  hash: string,
  signal?: AbortSignal,
): Promise<string | null> {
  if (hash === "") return null;
  const path = objectStorePath(cwd, hash);
  try {
    return await readFile(path, { encoding: "utf-8", signal });
  } catch (err) {
    if (isNodeError(err) && err.code === "ENOENT") return null;
    throw err;
  }
}
