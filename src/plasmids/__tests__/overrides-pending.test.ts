/**
 * Tests for `src/plasmids/governance/overrides-pending.ts`.
 *
 * Each test gets a fresh tmp working directory. We verify enqueue/consume
 * idempotency, FIFO ordering, atomic-write resilience (no `.tmp-*` left
 * visible after a successful write), and `clear()` semantics.
 */

import { createHash } from "node:crypto";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { OverridesPendingStore } from "../governance/overrides-pending.js";
import { OVERRIDE_PENDING_PATH, type PlasmidId } from "../types.js";

let workingDir: string;
let store: OverridesPendingStore;

const ID_A = "core-values" as unknown as PlasmidId;
const ID_B = "no-secrets" as unknown as PlasmidId;
const RATIONALE = "legacy migration script intentionally uses raw SQL — see ticket DB-123";

beforeEach(async () => {
  workingDir = await mkdtemp(join(tmpdir(), "dhelix-overrides-pending-"));
  store = new OverridesPendingStore({ workingDirectory: workingDir });
});

afterEach(async () => {
  await rm(workingDir, { recursive: true, force: true });
});

function expectedSha(rationale: string): string {
  return createHash("sha256").update(rationale, "utf8").digest("hex");
}

describe("enqueueOverride", () => {
  it("creates the file and returns the queued entry", async () => {
    const before = await store.peekPending();
    expect(before).toEqual([]);

    const entry = await store.enqueueOverride(ID_A, RATIONALE);
    expect(entry.plasmidId).toBe(ID_A);
    expect(entry.rationaleSha256).toBe(expectedSha(RATIONALE));
    expect(entry.queuedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);

    const filePath = join(workingDir, OVERRIDE_PENDING_PATH);
    const raw = await readFile(filePath, "utf8");
    const parsed = JSON.parse(raw);
    expect(parsed.pending).toHaveLength(1);
    expect(parsed.pending[0].plasmidId).toBe(ID_A);
  });

  it("never persists the rationale plaintext", async () => {
    await store.enqueueOverride(ID_A, RATIONALE);
    const filePath = join(workingDir, OVERRIDE_PENDING_PATH);
    const raw = await readFile(filePath, "utf8");
    expect(raw).not.toContain("legacy migration");
    expect(raw).toContain(expectedSha(RATIONALE));
  });

  it("rejects when the abort signal is already aborted", async () => {
    const ctrl = new AbortController();
    ctrl.abort();
    await expect(store.enqueueOverride(ID_A, RATIONALE, ctrl.signal)).rejects.toThrow(
      /aborted/i,
    );
    await expect(store.peekPending()).resolves.toEqual([]);
  });
});

describe("consumeOverride", () => {
  it("returns true exactly once per pending entry, then false", async () => {
    await store.enqueueOverride(ID_A, RATIONALE);
    expect(await store.consumeOverride(ID_A)).toBe(true);
    expect(await store.consumeOverride(ID_A)).toBe(false);
    expect(await store.consumeOverride(ID_A)).toBe(false);
  });

  it("returns false when no pending entry matches the plasmid", async () => {
    await store.enqueueOverride(ID_A, RATIONALE);
    expect(await store.consumeOverride(ID_B)).toBe(false);
    // The unrelated entry must remain in the queue.
    const remaining = await store.peekPending();
    expect(remaining.map((e) => e.plasmidId)).toEqual([ID_A]);
  });

  it("returns false when the file does not exist yet", async () => {
    expect(await store.consumeOverride(ID_A)).toBe(false);
  });

  it("consumes FIFO when the same plasmid is enqueued twice", async () => {
    const first = await store.enqueueOverride(ID_A, "rationale-one-padding-padding-padding");
    // Force a different timestamp by waiting one tick.
    await new Promise((resolve) => setTimeout(resolve, 5));
    const second = await store.enqueueOverride(ID_A, "rationale-two-padding-padding-padding");

    expect(first.queuedAt <= second.queuedAt).toBe(true);

    expect(await store.consumeOverride(ID_A)).toBe(true);
    const afterFirst = await store.peekPending();
    expect(afterFirst).toHaveLength(1);
    expect(afterFirst[0]?.rationaleSha256).toBe(second.rationaleSha256);

    expect(await store.consumeOverride(ID_A)).toBe(true);
    expect(await store.peekPending()).toEqual([]);
  });
});

describe("peekPending", () => {
  it("returns the queued overrides in insertion order", async () => {
    await store.enqueueOverride(ID_A, RATIONALE);
    await store.enqueueOverride(ID_B, RATIONALE + "-other");
    const pending = await store.peekPending();
    expect(pending.map((e) => e.plasmidId)).toEqual([ID_A, ID_B]);
  });

  it("returns [] when the file is missing", async () => {
    expect(await store.peekPending()).toEqual([]);
  });
});

describe("atomic write semantics", () => {
  it("never leaves a .tmp-* sibling after a successful write", async () => {
    await store.enqueueOverride(ID_A, RATIONALE);
    await store.enqueueOverride(ID_B, RATIONALE + "-other");
    await store.consumeOverride(ID_A);

    const dir = dirname(join(workingDir, OVERRIDE_PENDING_PATH));
    const entries = await readdir(dir);
    const tmpSiblings = entries.filter((name) => name.includes(".tmp-"));
    expect(tmpSiblings).toEqual([]);
  });

  it("survives a race between two concurrent enqueues (last writer wins, no corruption)", async () => {
    // The store does NOT serialise concurrent callers — it relies on a
    // single-process owner (the CLI). But the atomic rename guarantees the
    // file is never half-written. We assert the survivor parses cleanly.
    await Promise.all([
      store.enqueueOverride(ID_A, RATIONALE + "-a"),
      store.enqueueOverride(ID_B, RATIONALE + "-b"),
    ]);

    const filePath = join(workingDir, OVERRIDE_PENDING_PATH);
    const raw = await readFile(filePath, "utf8");
    const parsed = JSON.parse(raw); // Must not throw → no partial write visible.
    expect(Array.isArray(parsed.pending)).toBe(true);
    // At least one of the two writes survived; the file is well-formed
    // regardless of which one won the rename race.
    expect(parsed.pending.length).toBeGreaterThanOrEqual(1);
  });
});

describe("clear", () => {
  it("empties the queue", async () => {
    await store.enqueueOverride(ID_A, RATIONALE);
    await store.enqueueOverride(ID_B, RATIONALE + "-other");
    await store.clear();
    expect(await store.peekPending()).toEqual([]);
    // Subsequent enqueue still works after a clear.
    await store.enqueueOverride(ID_A, RATIONALE + "-redo");
    expect(await store.peekPending()).toHaveLength(1);
  });
});
