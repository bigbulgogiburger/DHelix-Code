/**
 * Advisory lock for /recombination — P-1.1 v0.2 + P-1.2 concurrency model.
 *
 * File: `<workingDirectory>/.dhelix/recombination/.lock`.
 *
 * Invariants
 * - I-7  Every mutation under this lock.
 * - Atomic create via `open(..., "wx")` (O_CREAT | O_EXCL). Two processes
 *   racing will see exactly one winner; the loser reads the existing file
 *   and either throws `RECOMBINATION_LOCK_BUSY` (live owner) or performs a
 *   takeover (stale: expired TTL or dead pid) with a warning.
 * - Reentrant on the same pid: {@link acquire} called twice in the same
 *   process increments a refcount, {@link release} decrements it. Final
 *   `release()` removes the on-disk file.
 * - `release()` is idempotent — safe to call N times.
 *
 * Layer: Core. Depends only on Node built-ins + `./types.js` + `./errors.js`.
 */
import { hostname as osHostname } from "node:os";
import {
  mkdir,
  open,
  readFile,
  rename,
  unlink,
  writeFile,
} from "node:fs/promises";
import type { FileHandle } from "node:fs/promises";
import { join } from "node:path";

import { lockBusy } from "./errors.js";
import { RECOMBINATION_DIR, RECOMBINATION_LOCK_FILE } from "./types.js";

/** Default TTL for a held lock (15 min). Configurable via {@link acquire}. */
export const DEFAULT_TTL_SEC = 15 * 60;

/** Serialized lock payload. */
export interface LockPayload {
  readonly pid: number;
  readonly hostname: string;
  readonly startedAt: string; // ISO-8601
  readonly ttlSec: number;
}

/** Options for {@link acquire}. */
export interface AcquireOptions {
  /** TTL for this hold in seconds. Defaults to {@link DEFAULT_TTL_SEC}. */
  readonly ttlSec?: number;
  /**
   * Clock injection for tests. Receives no arg, returns the current time
   * (used as the `startedAt` value and for expiry checks). Defaults to
   * `() => new Date()`.
   */
  readonly now?: () => Date;
  /**
   * Pid injection for tests. Allows simulating foreign pids. Defaults to
   * `() => process.pid`.
   */
  readonly pid?: () => number;
  /**
   * Predicate deciding whether a pid is still alive. Defaults to
   * `process.kill(pid, 0)`.
   */
  readonly isPidAlive?: (pid: number) => boolean;
}

/** Public handle returned by {@link acquire}. */
export interface LockHandle {
  readonly payload: LockPayload;
  readonly path: string;
  /** Indicates this call took over a stale lock (previous owner gone). */
  readonly tookOverStale: boolean;
  /** Release the lock (idempotent). */
  release(): Promise<void>;
}

/** Pid-keyed reentrant state for the current process. */
interface ReentrantState {
  count: number;
  payload: LockPayload;
  path: string;
}

const REENTRANT: Map<string, ReentrantState> = new Map();

function defaultIsPidAlive(pid: number): boolean {
  try {
    // Signal 0 probes for existence / permission. Throws ESRCH if pid gone.
    process.kill(pid, 0);
    return true;
  } catch (err) {
    if (isNodeError(err)) {
      // EPERM means the process exists but belongs to another user — still
      // alive from the machine's perspective.
      if (err.code === "EPERM") return true;
      if (err.code === "ESRCH") return false;
    }
    return false;
  }
}

/**
 * Acquire the /recombination advisory lock. See module doc for semantics.
 *
 * @param workingDirectory - project root (absolute).
 * @param opts - optional TTL / test hooks.
 * @returns A {@link LockHandle}; caller is responsible for `release()`.
 * @throws {@link RecombinationError} `RECOMBINATION_LOCK_BUSY` when a live
 *   foreign pid holds an unexpired lock.
 */
export async function acquire(
  workingDirectory: string,
  opts: AcquireOptions = {},
): Promise<LockHandle> {
  if (!workingDirectory) {
    throw new Error("acquire: workingDirectory is required");
  }

  const ttlSec = opts.ttlSec ?? DEFAULT_TTL_SEC;
  const now = opts.now ?? (() => new Date());
  const pidFn = opts.pid ?? (() => process.pid);
  const isAlive = opts.isPidAlive ?? defaultIsPidAlive;

  const lockPath = join(workingDirectory, RECOMBINATION_LOCK_FILE);
  const lockDir = join(workingDirectory, RECOMBINATION_DIR);
  const myPid = pidFn();
  const reentrantKey = lockPath;

  // Reentrant fast path — same pid already holds this lock.
  const existing = REENTRANT.get(reentrantKey);
  if (existing !== undefined && existing.payload.pid === myPid) {
    existing.count += 1;
    return makeHandle(existing, reentrantKey, false);
  }

  await mkdir(lockDir, { recursive: true });

  const newPayload: LockPayload = {
    pid: myPid,
    hostname: osHostname(),
    startedAt: now().toISOString(),
    ttlSec,
  };

  const attemptCreate = async (): Promise<"created" | "exists"> => {
    let fh: FileHandle | undefined;
    try {
      fh = await open(lockPath, "wx");
      await fh.writeFile(JSON.stringify(newPayload, null, 2) + "\n", "utf-8");
      return "created";
    } catch (err) {
      if (isNodeError(err) && err.code === "EEXIST") return "exists";
      throw err;
    } finally {
      if (fh !== undefined) await fh.close();
    }
  };

  const first = await attemptCreate();

  if (first === "created") {
    const state: ReentrantState = { count: 1, payload: newPayload, path: lockPath };
    REENTRANT.set(reentrantKey, state);
    return makeHandle(state, reentrantKey, false);
  }

  // EEXIST path — inspect the incumbent.
  const incumbent = await readIncumbent(lockPath);
  const stale = isStale(incumbent, now(), isAlive);

  if (!stale) {
    throw lockBusy(incumbent.pid, incumbent.hostname);
  }

  // Stale → take over via atomic tmp + rename. We overwrite the file.
  // eslint-disable-next-line no-console
  console.error(
    `[recombination] taking over stale lock at ${lockPath} (prev pid=${incumbent.pid}, startedAt=${incumbent.startedAt})`,
  );
  const tmpPath = `${lockPath}.tmp.${myPid}.${Date.now()}`;
  try {
    await writeFile(tmpPath, JSON.stringify(newPayload, null, 2) + "\n", "utf-8");
    await rename(tmpPath, lockPath);
  } catch (err) {
    try {
      await unlink(tmpPath);
    } catch {
      /* ignore */
    }
    throw err;
  }

  const state: ReentrantState = { count: 1, payload: newPayload, path: lockPath };
  REENTRANT.set(reentrantKey, state);
  return makeHandle(state, reentrantKey, true);
}

/** `acquire(...)` then run `fn`; guaranteed `release()` via try/finally. */
export async function withLock<T>(
  workingDirectory: string,
  opts: AcquireOptions,
  fn: (handle: LockHandle) => Promise<T>,
): Promise<T> {
  const handle = await acquire(workingDirectory, opts);
  try {
    return await fn(handle);
  } finally {
    await handle.release();
  }
}

// ─── internals ───────────────────────────────────────────────────────────────

function makeHandle(
  state: ReentrantState,
  key: string,
  tookOverStale: boolean,
): LockHandle {
  let released = false;
  return {
    payload: state.payload,
    path: state.path,
    tookOverStale,
    async release(): Promise<void> {
      if (released) return;
      released = true;
      const live = REENTRANT.get(key);
      if (live === undefined) return;
      live.count -= 1;
      if (live.count > 0) return;
      REENTRANT.delete(key);
      try {
        await unlink(live.path);
      } catch (err) {
        if (isNodeError(err) && err.code === "ENOENT") return;
        // Swallow — we don't want `release` to throw in finally blocks.
        // eslint-disable-next-line no-console
        console.error(
          `[recombination] failed to remove lock ${live.path}: ${
            err instanceof Error ? err.message : String(err)
          }`,
        );
      }
    },
  };
}

async function readIncumbent(lockPath: string): Promise<LockPayload> {
  let raw: string;
  try {
    raw = await readFile(lockPath, "utf-8");
  } catch (err) {
    // File vanished between EEXIST and read — treat as stale so the caller
    // retries acquisition. Return a synthetic 'expired' incumbent.
    if (isNodeError(err) && err.code === "ENOENT") {
      return {
        pid: 0,
        hostname: "",
        startedAt: new Date(0).toISOString(),
        ttlSec: 0,
      };
    }
    throw err;
  }
  return parsePayload(raw);
}

function parsePayload(raw: string): LockPayload {
  const trimmed = raw.trim();
  if (trimmed === "") {
    return { pid: 0, hostname: "", startedAt: new Date(0).toISOString(), ttlSec: 0 };
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    return { pid: 0, hostname: "", startedAt: new Date(0).toISOString(), ttlSec: 0 };
  }
  if (!isObject(parsed)) {
    return { pid: 0, hostname: "", startedAt: new Date(0).toISOString(), ttlSec: 0 };
  }
  return {
    pid: typeof parsed.pid === "number" ? parsed.pid : 0,
    hostname: typeof parsed.hostname === "string" ? parsed.hostname : "",
    startedAt:
      typeof parsed.startedAt === "string" ? parsed.startedAt : new Date(0).toISOString(),
    ttlSec: typeof parsed.ttlSec === "number" ? parsed.ttlSec : 0,
  };
}

function isStale(
  incumbent: LockPayload,
  now: Date,
  isAlive: (pid: number) => boolean,
): boolean {
  if (incumbent.pid <= 0) return true;
  const started = Date.parse(incumbent.startedAt);
  if (Number.isFinite(started)) {
    const expiryMs = started + incumbent.ttlSec * 1000;
    if (now.getTime() >= expiryMs) return true;
  }
  return !isAlive(incumbent.pid);
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

interface NodeError extends Error {
  code?: string;
}

function isNodeError(err: unknown): err is NodeError {
  return err instanceof Error && typeof (err as NodeError).code === "string";
}

// Testing seam — clears the per-process reentrant map. Not exported via
// barrel; tests import explicitly.
/* c8 ignore start */
export function __resetReentrantForTests(): void {
  REENTRANT.clear();
}
/* c8 ignore stop */

