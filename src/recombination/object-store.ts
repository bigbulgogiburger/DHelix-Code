/**
 * Content-addressed object store — write side (Team 5, Phase 4).
 *
 * Every artifact written at Stage 4 also gets archived by sha256 hash under
 * `.dhelix/recombination/objects/<fan>/<rest>` (I-8 blocked from runtime).
 * Cure v1 (Team 4) reads these blobs as the `base` leg of its 3-way merge.
 *
 * Contract (PRD §B.3 / types.ts §Object store):
 *   - Write is atomic (tmp + rename) so cross-process readers never see a
 *     half-written blob.
 *   - Idempotent: if the target already exists, skip the write (hash-keyed ⇒
 *     identical bytes by definition).
 *   - Best-effort: callers must wrap calls in try/catch — a failed blob write
 *     never fails the outer Stage 4 pipeline (see executor).
 *
 * Layer: Core. Node `fs/promises` only.
 */
import { mkdir, rename, stat, unlink, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

import { objectStorePath } from "./types.js";

interface NodeError extends Error {
  code?: string;
}

function isNodeError(err: unknown): err is NodeError {
  return err instanceof Error && typeof (err as NodeError).code === "string";
}

/**
 * Atomically write `contents` into the object store under `hash`.
 *
 * Idempotent — if a blob already exists at the target path we skip the
 * write entirely (content-addressed storage: same hash ⇒ same bytes).
 *
 * @param cwd       project root (absolute)
 * @param hash      sha256 hex digest used as the content-address key
 * @param contents  raw bytes to persist (UTF-8)
 * @param signal    optional cancellation — observed before the write
 */
export async function writeBlob(
  cwd: string,
  hash: string,
  contents: string,
  signal?: AbortSignal,
): Promise<void> {
  if (signal?.aborted) {
    throw new Error("writeBlob: aborted");
  }
  if (hash === "") {
    // Phase-2 transcripts can have empty hashes on some artifacts; there is
    // no sensible address for them so skip rather than poisoning the tree.
    return;
  }

  const target = objectStorePath(cwd, hash);

  // Fast exit on existing blob — hash collision is astronomically unlikely
  // and any mismatch would mean upstream hashing is broken, not us.
  try {
    await stat(target);
    return;
  } catch (err) {
    if (!(isNodeError(err) && err.code === "ENOENT")) {
      throw err;
    }
  }

  await mkdir(dirname(target), { recursive: true });
  const tmp = `${target}.tmp.${process.pid}.${Date.now()}`;
  try {
    await writeFile(tmp, contents, "utf-8");
    await rename(tmp, target);
  } catch (err) {
    try {
      await unlink(tmp);
    } catch {
      /* best effort */
    }
    // EEXIST on rename — another writer beat us to the target. Idempotent
    // by design; swallow.
    if (isNodeError(err) && (err.code === "EEXIST" || err.code === "ENOTEMPTY")) {
      return;
    }
    throw err;
  }
}
