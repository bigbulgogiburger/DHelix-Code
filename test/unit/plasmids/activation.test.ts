import { beforeEach, describe, expect, it } from "vitest";
import { mkdtemp, readFile, rm, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  ActivationStore,
  ACTIVATION_FILE_NAME,
  asPlasmidId,
  detectExtendsCycle,
  intersectIds,
} from "../../../src/plasmids/activation.js";
import type { PlasmidId } from "../../../src/plasmids/types.js";

async function makeStore(): Promise<{
  readonly store: ActivationStore;
  readonly workingDirectory: string;
  readonly registryPath: string;
  readonly cleanup: () => Promise<void>;
}> {
  const workingDirectory = await mkdtemp(join(tmpdir(), "dhelix-plasmid-"));
  const registryPath = ".dhelix/plasmids";
  const store = new ActivationStore({ workingDirectory, registryPath });
  return {
    store,
    workingDirectory,
    registryPath,
    cleanup: async () => {
      await rm(workingDirectory, { recursive: true, force: true });
    },
  };
}

describe("ActivationStore", () => {
  let fixture: Awaited<ReturnType<typeof makeStore>>;

  beforeEach(async () => {
    fixture = await makeStore();
  });

  it("returns an empty state when the file does not exist", async () => {
    const state = await fixture.store.read();
    expect(state.activePlasmidIds).toEqual([]);
    expect(typeof state.updatedAt).toBe("string");
    await fixture.cleanup();
  });

  it("creates the parent directory on first write (atomic)", async () => {
    const state = {
      activePlasmidIds: [asPlasmidId("alpha"), asPlasmidId("beta")],
      updatedAt: new Date("2026-04-23T00:00:00Z").toISOString(),
    };
    await fixture.store.write(state);

    const expected = join(
      fixture.workingDirectory,
      fixture.registryPath,
      ".state",
      ACTIVATION_FILE_NAME,
    );
    expect(existsSync(expected)).toBe(true);

    const raw = await readFile(expected, "utf-8");
    const parsed = JSON.parse(raw);
    expect(parsed.activePlasmidIds).toEqual(["alpha", "beta"]);
    await fixture.cleanup();
  });

  it("activate() is set-union and updates updatedAt", async () => {
    await fixture.store.write({
      activePlasmidIds: [asPlasmidId("alpha")],
      updatedAt: new Date(0).toISOString(),
    });
    const next = await fixture.store.activate([
      asPlasmidId("alpha"), // duplicate — ignored
      asPlasmidId("beta"),
    ]);
    expect(next.activePlasmidIds).toEqual(["alpha", "beta"]);
    expect(next.updatedAt).not.toBe(new Date(0).toISOString());
    await fixture.cleanup();
  });

  it("deactivate() removes only requested ids; idempotent on unknowns", async () => {
    await fixture.store.write({
      activePlasmidIds: [
        asPlasmidId("alpha"),
        asPlasmidId("beta"),
        asPlasmidId("gamma"),
      ],
      updatedAt: new Date(0).toISOString(),
    });
    const next = await fixture.store.deactivate([
      asPlasmidId("beta"),
      asPlasmidId("not-active"),
    ]);
    expect(next.activePlasmidIds).toEqual(["alpha", "gamma"]);
    await fixture.cleanup();
  });

  it("clear() writes an empty state", async () => {
    await fixture.store.write({
      activePlasmidIds: [asPlasmidId("alpha")],
      updatedAt: new Date(0).toISOString(),
    });
    await fixture.store.clear();
    const state = await fixture.store.read();
    expect(state.activePlasmidIds).toEqual([]);
    await fixture.cleanup();
  });

  it("tolerates a corrupt file and recovers on the next write", async () => {
    const dir = join(fixture.workingDirectory, fixture.registryPath, ".state");
    await mkdir(dir, { recursive: true });
    await writeFile(join(dir, ACTIVATION_FILE_NAME), "not-json-at-all", "utf-8");

    const state = await fixture.store.read();
    expect(state.activePlasmidIds).toEqual([]);

    await fixture.store.activate([asPlasmidId("alpha")]);
    const after = await fixture.store.read();
    expect(after.activePlasmidIds).toEqual(["alpha"]);
    await fixture.cleanup();
  });

  it("preserves the existing profile across mutations", async () => {
    await fixture.store.write({
      activePlasmidIds: [],
      updatedAt: new Date(0).toISOString(),
      profile: "secure-dev",
    });
    const next = await fixture.store.activate([asPlasmidId("alpha")]);
    expect(next.profile).toBe("secure-dev");
    await fixture.cleanup();
  });
});

describe("detectExtendsCycle", () => {
  it("returns null for an acyclic graph", () => {
    const g = new Map<PlasmidId, PlasmidId | undefined>([
      [asPlasmidId("a"), asPlasmidId("b")],
      [asPlasmidId("b"), asPlasmidId("c")],
      [asPlasmidId("c"), undefined],
    ]);
    expect(detectExtendsCycle(g)).toBeNull();
  });

  it("detects a 2-node cycle", () => {
    const g = new Map<PlasmidId, PlasmidId | undefined>([
      [asPlasmidId("a"), asPlasmidId("b")],
      [asPlasmidId("b"), asPlasmidId("a")],
    ]);
    const cycle = detectExtendsCycle(g);
    expect(cycle).not.toBeNull();
    expect(cycle).toContain("a");
    expect(cycle).toContain("b");
  });

  it("detects a 3-node cycle", () => {
    const g = new Map<PlasmidId, PlasmidId | undefined>([
      [asPlasmidId("a"), asPlasmidId("b")],
      [asPlasmidId("b"), asPlasmidId("c")],
      [asPlasmidId("c"), asPlasmidId("a")],
    ]);
    const cycle = detectExtendsCycle(g);
    expect(cycle).not.toBeNull();
  });
});

describe("intersectIds", () => {
  it("returns empty when inputs don't overlap", () => {
    expect(
      intersectIds([asPlasmidId("a"), asPlasmidId("b")], [asPlasmidId("c")]),
    ).toEqual([]);
  });

  it("preserves the order of the first argument", () => {
    expect(
      intersectIds(
        [asPlasmidId("a"), asPlasmidId("b"), asPlasmidId("c")],
        [asPlasmidId("c"), asPlasmidId("a")],
      ),
    ).toEqual(["a", "c"]);
  });
});
