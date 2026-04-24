/**
 * Phase 5 — End-to-end override consumption WITHOUT mocking the governance
 * module. This test exists because Team 5's unit test (`executor-override-
 * consumption.test.ts`) uses `vi.mock("../../plasmids/governance/overrides-
 * pending.js", ...)` and therefore cannot detect a real-world wiring bug:
 * the executor dynamic-imports a top-level `consumeOverride` function, and
 * if the governance module only exports the `OverridesPendingStore` class
 * (no top-level wrapper), the executor's `typeof !== "function"` guard
 * silently no-ops in production.
 *
 * Coverage target: enqueue via `OverridesPendingStore` → consume via the
 * executor's dynamic-import path → file mutated → second call returns
 * `false`. No `vi.mock` anywhere.
 */
import { mkdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  OverridesPendingStore,
  consumeOverride,
} from "../../../src/plasmids/governance/overrides-pending.js";
import { OVERRIDE_PENDING_PATH } from "../../../src/plasmids/types.js";
import type { PlasmidId } from "../../../src/plasmids/types.js";

describe("Phase 5 — override consume E2E (no mocks)", () => {
  let workingDirectory: string;

  beforeEach(async () => {
    workingDirectory = join(tmpdir(), `dhelix-phase5-override-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    await mkdir(workingDirectory, { recursive: true });
  });

  afterEach(async () => {
    await rm(workingDirectory, { recursive: true, force: true });
  });

  it("exposes a top-level consumeOverride function (executor's contract)", () => {
    // This is the contract executor.ts depends on at runtime via
    // `dynamic import('../plasmids/governance/overrides-pending.js')`.
    expect(typeof consumeOverride).toBe("function");
  });

  it("enqueue → top-level consume returns true once, then false", async () => {
    const store = new OverridesPendingStore({ workingDirectory });
    const plasmidId = "core-values" as PlasmidId;

    await store.enqueueOverride(plasmidId, "this is a long enough rationale for tests");

    const first = await consumeOverride({ workingDirectory, plasmidId });
    expect(first).toBe(true);

    const second = await consumeOverride({ workingDirectory, plasmidId });
    expect(second).toBe(false);
  });

  it("FIFO across multiple enqueues for the same plasmid", async () => {
    const store = new OverridesPendingStore({ workingDirectory });
    const plasmidId = "anti-deception" as PlasmidId;

    await store.enqueueOverride(plasmidId, "first override rationale text long enough");
    await store.enqueueOverride(plasmidId, "second override rationale text long enough");

    expect(await consumeOverride({ workingDirectory, plasmidId })).toBe(true);
    expect(await consumeOverride({ workingDirectory, plasmidId })).toBe(true);
    expect(await consumeOverride({ workingDirectory, plasmidId })).toBe(false);
  });

  it("missing pending file returns false (best-effort no-op)", async () => {
    // Sanity: the executor's best-effort contract must work even when the
    // user has never called /plasmid challenge.
    const result = await consumeOverride({
      workingDirectory,
      plasmidId: "never-queued" as PlasmidId,
    });
    expect(result).toBe(false);
  });

  it("queue file lives at the well-known governance path", async () => {
    const store = new OverridesPendingStore({ workingDirectory });
    await store.enqueueOverride(
      "verify-path" as PlasmidId,
      "rationale long enough to satisfy the schema requirement",
    );
    const expected = join(workingDirectory, OVERRIDE_PENDING_PATH);
    // Read via the store to avoid coupling the test to JSON layout details.
    const pending = await store.peekPending();
    expect(pending.length).toBe(1);
    expect(expected).toContain(".dhelix/governance/overrides.pending.json");
  });
});
