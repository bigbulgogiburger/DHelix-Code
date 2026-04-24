/**
 * Unit tests for `src/recombination/lock.ts`.
 *
 * Exports under test: `acquire`, `withLock`, `__resetReentrantForTests`.
 * NOTE — the source uses `acquire`/`release()` rather than the design-doc
 * `acquireLock`/`releaseLock` helpers; the tests follow the actual API.
 */
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { RecombinationError } from "../../../src/recombination/errors.js";
import {
  acquire,
  withLock,
  __resetReentrantForTests,
} from "../../../src/recombination/lock.js";
import { RECOMBINATION_LOCK_FILE } from "../../../src/recombination/types.js";

let workdir: string;

beforeEach(async () => {
  workdir = await mkdtemp(join(tmpdir(), "dhelix-lock-"));
  __resetReentrantForTests();
});

afterEach(async () => {
  __resetReentrantForTests();
  await rm(workdir, { recursive: true, force: true });
});

describe("acquire + release", () => {
  it("writes the lock file and releases it cleanly", async () => {
    const handle = await acquire(workdir);
    const lockPath = join(workdir, RECOMBINATION_LOCK_FILE);
    const raw = await readFile(lockPath, "utf-8");
    const parsed = JSON.parse(raw) as { pid: number; ttlSec: number };
    expect(parsed.pid).toBe(process.pid);
    expect(parsed.ttlSec).toBeGreaterThan(0);
    expect(handle.tookOverStale).toBe(false);
    expect(handle.path).toBe(lockPath);

    await handle.release();

    // File should be gone after final release
    let vanished = false;
    try {
      await readFile(lockPath, "utf-8");
    } catch (err) {
      vanished = (err as NodeJS.ErrnoException).code === "ENOENT";
    }
    expect(vanished).toBe(true);
  });

  it("is reentrant for the same pid (counted refs)", async () => {
    const a = await acquire(workdir);
    const b = await acquire(workdir);
    await a.release();
    // Lock must still exist after first release (refcount=1 left).
    const lockPath = join(workdir, RECOMBINATION_LOCK_FILE);
    const still = await readFile(lockPath, "utf-8");
    expect(still.length).toBeGreaterThan(0);
    await b.release();

    // Now file should be removed.
    let vanished = false;
    try {
      await readFile(lockPath, "utf-8");
    } catch (err) {
      vanished = (err as NodeJS.ErrnoException).code === "ENOENT";
    }
    expect(vanished).toBe(true);
  });

  it("release is idempotent — extra calls are harmless", async () => {
    const handle = await acquire(workdir);
    await handle.release();
    await handle.release(); // should not throw
    await handle.release(); // still ok
  });

  it("throws RECOMBINATION_LOCK_BUSY when a live foreign pid holds the lock", async () => {
    // Simulate an incumbent from another pid that is alive.
    __resetReentrantForTests();
    const foreignHandle = await acquire(workdir, {
      pid: () => 99_999,
      isPidAlive: () => true,
    });
    expect(foreignHandle.payload.pid).toBe(99_999);
    __resetReentrantForTests(); // Clear our tracking so next acquire races the file

    try {
      await acquire(workdir, { isPidAlive: () => true });
      throw new Error("expected RECOMBINATION_LOCK_BUSY");
    } catch (err) {
      expect(err).toBeInstanceOf(RecombinationError);
      if (err instanceof RecombinationError) {
        expect(err.code).toBe("RECOMBINATION_LOCK_BUSY");
        expect(err.context.pid).toBe(99_999);
      }
    }

    // Cleanup — remove the fake lock by hand.
    await rm(join(workdir, RECOMBINATION_LOCK_FILE), { force: true });
  });

  it("takes over a stale lock when the incumbent pid is dead", async () => {
    // Plant a dead foreign lock manually.
    const lockPath = join(workdir, RECOMBINATION_LOCK_FILE);
    await mkdir(dirname(lockPath), { recursive: true });
    await writeFile(
      lockPath,
      JSON.stringify({
        pid: 99_998,
        hostname: "ghost",
        startedAt: new Date().toISOString(),
        ttlSec: 900,
      }),
      "utf-8",
    );

    const handle = await acquire(workdir, { isPidAlive: () => false });
    expect(handle.tookOverStale).toBe(true);
    expect(handle.payload.pid).toBe(process.pid);
    await handle.release();
  });

  it("takes over an expired lock even if the pid appears alive", async () => {
    const lockPath = join(workdir, RECOMBINATION_LOCK_FILE);
    await mkdir(dirname(lockPath), { recursive: true });
    // startedAt 1h ago, ttlSec=60s → expired
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    await writeFile(
      lockPath,
      JSON.stringify({
        pid: 99_997,
        hostname: "old-host",
        startedAt: oneHourAgo,
        ttlSec: 60,
      }),
      "utf-8",
    );
    const handle = await acquire(workdir, {
      isPidAlive: () => true, // still marked alive but TTL expired
    });
    expect(handle.tookOverStale).toBe(true);
    await handle.release();
  });

  it("throws a plain Error when workingDirectory is empty", async () => {
    await expect(acquire("")).rejects.toThrow(/workingDirectory is required/);
  });
});

describe("withLock", () => {
  it("runs the function and releases the lock afterwards", async () => {
    let seenPath: string | undefined;
    const result = await withLock(workdir, {}, async (h) => {
      seenPath = h.path;
      return 42;
    });
    expect(result).toBe(42);
    expect(seenPath).toContain(".dhelix/recombination/.lock");

    // Lock file should be gone.
    let vanished = false;
    try {
      await readFile(seenPath!, "utf-8");
    } catch (err) {
      vanished = (err as NodeJS.ErrnoException).code === "ENOENT";
    }
    expect(vanished).toBe(true);
  });

  it("releases the lock even when fn throws", async () => {
    await expect(
      withLock(workdir, {}, async () => {
        throw new Error("boom");
      }),
    ).rejects.toThrow("boom");

    const lockPath = join(workdir, RECOMBINATION_LOCK_FILE);
    let vanished = false;
    try {
      await readFile(lockPath, "utf-8");
    } catch (err) {
      vanished = (err as NodeJS.ErrnoException).code === "ENOENT";
    }
    expect(vanished).toBe(true);
  });
});
