/**
 * Drafts store — ephemeral `.drafts/` cache for Quick mode.
 *
 * Design: P-1.5 §Q3 ("임시 저장 경로 명확하게 분리").
 *
 * Layer: Leaf (Layer 4) — no cross-layer imports. Only node fs + path helpers.
 *
 * Invariants:
 *  - Atomic writes via temp file + rename (no half-written drafts).
 *  - AbortSignal is respected before irrevocable rename; if aborted
 *    mid-write the temp file is cleaned up.
 *  - Drafts directory is created lazily; `list` on a missing directory
 *    returns `[]` (not an error — ephemeral is the natural state).
 */

import { mkdir, readdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { randomBytes } from "node:crypto";
import { joinPath, resolvePath, isAbsolutePath } from "../utils/path.js";
import type { PlasmidId } from "./types.js";

const DRAFT_EXTENSION = ".md";

/**
 * Construction options for `DraftsStore`.
 *
 * `draftsPath` comes from `config.plasmid.draftsPath` (Zod default
 * `.dhelix/plasmids/.drafts`). If relative, it is resolved against
 * `workingDirectory`.
 */
export interface DraftsStoreOptions {
  readonly workingDirectory: string;
  readonly draftsPath: string;
}

/**
 * Persistent-ish cache of Quick mode drafts. "Ephemeral" here means
 * user-mutable and cleaned up outside the store (7-day retention per
 * P-1.5 §Q3); the store itself provides CRUD-without-U semantics
 * (save replaces, delete removes).
 */
export class DraftsStore {
  private readonly baseDir: string;

  constructor(opts: DraftsStoreOptions) {
    this.baseDir = isAbsolutePath(opts.draftsPath)
      ? resolvePath(opts.draftsPath)
      : resolvePath(opts.workingDirectory, opts.draftsPath);
  }

  /** Absolute path where drafts are persisted. */
  get directory(): string {
    return this.baseDir;
  }

  /**
   * Atomic write of a draft's markdown content.
   *
   * Returns the absolute path of the saved file. Pipeline:
   *   1. ensure directory exists
   *   2. write to `<id>.md.tmp-<rand>` (fsync implicit on close)
   *   3. throw on abort *before* rename, cleaning up temp
   *   4. rename → atomic on POSIX and recent Windows
   */
  async save(id: PlasmidId, content: string, signal?: AbortSignal): Promise<string> {
    signal?.throwIfAborted();
    ensureSafeId(id);
    await mkdir(this.baseDir, { recursive: true });

    const finalPath = joinPath(this.baseDir, `${id}${DRAFT_EXTENSION}`);
    const tempPath = `${finalPath}.tmp-${randomBytes(6).toString("hex")}`;

    // Write into a temp sibling, then rename. If the caller aborts before
    // rename we best-effort clean the temp file. Errors inside cleanup are
    // swallowed deliberately — the original abort/write error is what the
    // caller wants to see.
    try {
      await writeFile(tempPath, content, { encoding: "utf8", signal });
      signal?.throwIfAborted();
      await rename(tempPath, finalPath);
      return finalPath;
    } catch (err) {
      await rm(tempPath, { force: true }).catch(() => undefined);
      throw err;
    }
  }

  /** Read a draft. Returns `null` if missing. */
  async load(id: PlasmidId, signal?: AbortSignal): Promise<string | null> {
    signal?.throwIfAborted();
    ensureSafeId(id);
    const path = joinPath(this.baseDir, `${id}${DRAFT_EXTENSION}`);
    try {
      return await readFile(path, { encoding: "utf8", signal });
    } catch (err) {
      if (isNotFound(err)) return null;
      throw err;
    }
  }

  /**
   * List all draft ids. A missing directory yields `[]`; anything else
   * (EACCES, ENOTDIR, etc.) surfaces to the caller.
   */
  async list(signal?: AbortSignal): Promise<readonly PlasmidId[]> {
    signal?.throwIfAborted();
    let entries: string[];
    try {
      entries = await readdir(this.baseDir);
    } catch (err) {
      if (isNotFound(err)) return [];
      throw err;
    }
    const ids: PlasmidId[] = [];
    for (const entry of entries) {
      if (!entry.endsWith(DRAFT_EXTENSION)) continue;
      if (entry.includes(".tmp-")) continue;
      ids.push(entry.slice(0, -DRAFT_EXTENSION.length) as PlasmidId);
    }
    ids.sort();
    return ids;
  }

  /** Delete a draft. Returns `true` if it existed and was removed. */
  async delete(id: PlasmidId, signal?: AbortSignal): Promise<boolean> {
    signal?.throwIfAborted();
    ensureSafeId(id);
    const path = joinPath(this.baseDir, `${id}${DRAFT_EXTENSION}`);
    try {
      await rm(path, { force: false });
      return true;
    } catch (err) {
      if (isNotFound(err)) return false;
      throw err;
    }
  }
}

/**
 * Defensive check for path traversal / directory separator leakage.
 * The schema-level slugify in `quick-mode.ts` already guarantees the
 * safe charset, but this module is used by other teams too.
 */
function ensureSafeId(id: PlasmidId): void {
  if (!id || id.includes("/") || id.includes("\\") || id === "." || id === "..") {
    throw new Error(`Invalid plasmid id for draft store: ${JSON.stringify(id)}`);
  }
}

function isNotFound(err: unknown): boolean {
  return typeof err === "object" && err !== null && (err as { code?: string }).code === "ENOENT";
}
