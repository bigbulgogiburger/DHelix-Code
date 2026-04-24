/**
 * Phase 5 — One-shot override queue at
 * `.dhelix/governance/overrides.pending.json`.
 *
 * Atomic write (tmp + rename) — this file is a small mutable cache, NOT a
 * log. `consumeOverride` is idempotent: returns `true` exactly once per
 * pending entry, then `false`.
 *
 * Concurrency model: a single CLI process owns this file at a time. We use
 * `writeFile` to a unique `.tmp-<rand>` sibling followed by `rename`, which
 * is atomic on POSIX and Windows (when the destination exists, Node 16+
 * uses the equivalent of `MoveFileEx` with replace semantics).
 *
 * Layer: Leaf — depends only on `node:fs/promises`, `node:crypto`,
 * `node:path`, the public type module, and the local `./types.js` schema.
 *
 * Owned by Team 3 — Phase 5 GAL-1 dev-guide §4.
 */

import { randomBytes, createHash } from "node:crypto";
import { mkdir, readFile, rename, unlink, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

import {
  OVERRIDE_PENDING_PATH,
  type OverridePending,
  type PlasmidId,
} from "../types.js";
import { overridesPendingFileSchema } from "./types.js";

type AsyncSignal = AbortSignal | undefined;

interface OverridesPendingFile {
  readonly pending: readonly OverridePending[];
}

const EMPTY_FILE: OverridesPendingFile = Object.freeze({ pending: Object.freeze([]) });

function throwIfAborted(signal: AsyncSignal): void {
  if (signal?.aborted) {
    throw signal.reason instanceof Error
      ? signal.reason
      : Object.assign(new Error("The operation was aborted"), { name: "AbortError" });
  }
}

/**
 * Mutable cache of one-shot overrides queued for the next `/recombination`
 * run. See class doc for the atomicity contract.
 */
export class OverridesPendingStore {
  private readonly filePath: string;

  constructor(opts: { workingDirectory: string }) {
    this.filePath = join(opts.workingDirectory, OVERRIDE_PENDING_PATH);
  }

  /**
   * Append a new pending override. The rationale text itself is NEVER
   * persisted — only its sha256 — so the queue file remains safe to
   * inspect without leaking the user's free-form prose.
   */
  async enqueueOverride(
    plasmidId: PlasmidId,
    rationale: string,
    signal?: AbortSignal,
  ): Promise<OverridePending> {
    throwIfAborted(signal);

    const entry: OverridePending = Object.freeze({
      plasmidId,
      queuedAt: new Date().toISOString(),
      rationaleSha256: createHash("sha256").update(rationale, "utf8").digest("hex"),
    });

    const current = await this.readFile(signal);
    const next: OverridesPendingFile = { pending: [...current.pending, entry] };
    await this.writeAtomic(next, signal);
    return entry;
  }

  /**
   * Idempotent consume: removes (and reports `true` for) the FIRST pending
   * entry matching `plasmidId`; returns `false` when none match.
   *
   * FIFO across multiple enqueues for the same plasmid: the oldest
   * matching entry is consumed first.
   */
  async consumeOverride(plasmidId: PlasmidId, signal?: AbortSignal): Promise<boolean> {
    throwIfAborted(signal);

    const current = await this.readFile(signal);
    const index = current.pending.findIndex((entry) => entry.plasmidId === plasmidId);
    if (index === -1) {
      return false;
    }

    const next: OverridesPendingFile = {
      pending: [...current.pending.slice(0, index), ...current.pending.slice(index + 1)],
    };
    await this.writeAtomic(next, signal);
    return true;
  }

  /** Snapshot the current queue. Returns an empty array when the file is missing. */
  async peekPending(signal?: AbortSignal): Promise<readonly OverridePending[]> {
    const current = await this.readFile(signal);
    return current.pending;
  }

  /** Test helper: drop the entire queue (atomic write of an empty payload). */
  async clear(signal?: AbortSignal): Promise<void> {
    throwIfAborted(signal);
    await this.writeAtomic(EMPTY_FILE, signal);
  }

  // ─── internals ──────────────────────────────────────────────────────────

  private async readFile(signal: AsyncSignal): Promise<OverridesPendingFile> {
    throwIfAborted(signal);

    let raw: string;
    try {
      raw = await readFile(this.filePath, { encoding: "utf8", signal });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        return EMPTY_FILE;
      }
      throw error;
    }

    if (raw.trim().length === 0) {
      return EMPTY_FILE;
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch (error) {
      throw new Error(
        `overrides.pending.json is not valid JSON: ${(error as Error).message}`,
      );
    }

    const validated = overridesPendingFileSchema.safeParse(parsed);
    if (!validated.success) {
      throw new Error(
        `overrides.pending.json failed schema validation: ${validated.error.issues
          .map((issue) => issue.message)
          .join("; ")}`,
      );
    }

    // Cast through the validated structural type → branded `PlasmidId`.
    // The id was branded upstream when first enqueued; round-tripping
    // through JSON loses the brand but the value is byte-identical.
    return {
      pending: Object.freeze(
        validated.data.pending.map(
          (entry): OverridePending => ({
            plasmidId: entry.plasmidId as PlasmidId,
            queuedAt: entry.queuedAt,
            rationaleSha256: entry.rationaleSha256,
          }),
        ),
      ),
    };
  }

  private async writeAtomic(
    payload: OverridesPendingFile,
    signal: AsyncSignal,
  ): Promise<void> {
    throwIfAborted(signal);

    await mkdir(dirname(this.filePath), { recursive: true });
    throwIfAborted(signal);

    // Unique sibling so concurrent (mis)users do not stomp each other's
    // staged write. `randomBytes` is sync-cheap.
    const tmpPath = `${this.filePath}.tmp-${randomBytes(8).toString("hex")}`;
    const serialised = `${JSON.stringify(payload, null, 2)}\n`;

    try {
      await writeFile(tmpPath, serialised, { encoding: "utf8", signal });
      throwIfAborted(signal);
      await rename(tmpPath, this.filePath);
    } catch (error) {
      // Best-effort cleanup of the staged file so the dir does not grow
      // unbounded on repeated failures.
      try {
        await unlink(tmpPath);
      } catch {
        // Ignore — the tmp file may never have been created.
      }
      throw error;
    }
  }
}

// ─── Module-level helper for the recombination executor ─────────────────────
//
// `executor.ts` Stage 1 dynamic-imports this module and looks for a top-level
// `consumeOverride` function — a narrow contract that lets the executor stay
// decoupled from the class shape. Without this wrapper the consume path
// silently no-ops in production (the executor's `typeof !== "function"`
// guard returns early), so foundational override entries enqueued by
// `/plasmid challenge` would never actually be consumed.
//
// Each call instantiates its own store; the store carries no in-memory state
// that needs to outlive the call (the on-disk JSON file IS the state).

/**
 * Executor-facing wrapper around {@link OverridesPendingStore.consumeOverride}.
 *
 * Returns `true` exactly once per pending entry for the given `plasmidId`,
 * then `false` on subsequent calls — the same one-shot semantics the class
 * method provides.
 *
 * The `workingDirectory` arg lets the caller (executor) point at any project
 * root; in practice this is always the recombination working directory.
 */
export async function consumeOverride(req: {
  readonly workingDirectory: string;
  readonly plasmidId: PlasmidId;
  readonly signal?: AbortSignal;
}): Promise<boolean> {
  const store = new OverridesPendingStore({ workingDirectory: req.workingDirectory });
  return store.consumeOverride(req.plasmidId, req.signal);
}
