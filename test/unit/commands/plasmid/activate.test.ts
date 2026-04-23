import { afterEach, describe, expect, it } from "vitest";

import { activateSubcommand } from "../../../../src/commands/plasmid/activate.js";
import { asPlasmidId } from "../../../../src/plasmids/activation.js";
import type { PlasmidId } from "../../../../src/plasmids/types.js";
import { fakeDeps, makeContext, makeLoaded, makeMetadata } from "./_fixtures.js";

describe("/plasmid activate", () => {
  let cleanups: Array<() => Promise<void>> = [];
  afterEach(async () => {
    for (const fn of cleanups) await fn();
    cleanups = [];
  });

  it("requires at least one id", async () => {
    const fx = await fakeDeps();
    cleanups.push(fx.cleanup);
    const result = await activateSubcommand(
      [],
      makeContext(fx.workingDirectory),
      fx.deps,
    );
    expect(result.success).toBe(false);
    expect(result.output).toContain("Missing argument");
  });

  it("activates a known plasmid and persists state", async () => {
    const fx = await fakeDeps({
      loaded: [makeLoaded(makeMetadata({ id: "alpha" as PlasmidId }))],
    });
    cleanups.push(fx.cleanup);
    const result = await activateSubcommand(
      ["alpha"],
      makeContext(fx.workingDirectory),
      fx.deps,
    );
    expect(result.success).toBe(true);
    expect(result.output).toContain("Activated: alpha");
    const state = await fx.deps.activationStore.read();
    expect(state.activePlasmidIds).toEqual(["alpha"]);
  });

  it("refuses when any id is not found", async () => {
    const fx = await fakeDeps({
      loaded: [makeLoaded(makeMetadata({ id: "alpha" as PlasmidId }))],
    });
    cleanups.push(fx.cleanup);
    const result = await activateSubcommand(
      ["alpha", "ghost"],
      makeContext(fx.workingDirectory),
      fx.deps,
    );
    expect(result.success).toBe(false);
    expect(result.output).toContain("Plasmid not found: ghost");
    const state = await fx.deps.activationStore.read();
    // nothing should have been persisted
    expect(state.activePlasmidIds).toEqual([]);
  });

  it("refuses on a cycle in the extends graph", async () => {
    const fx = await fakeDeps({
      loaded: [
        makeLoaded(
          makeMetadata({ id: "a" as PlasmidId, extends: "b" as PlasmidId }),
        ),
        makeLoaded(
          makeMetadata({ id: "b" as PlasmidId, extends: "a" as PlasmidId }),
        ),
      ],
    });
    cleanups.push(fx.cleanup);
    const result = await activateSubcommand(
      ["a", "b"],
      makeContext(fx.workingDirectory),
      fx.deps,
    );
    expect(result.success).toBe(false);
    expect(result.output).toContain("cycle");
    const state = await fx.deps.activationStore.read();
    expect(state.activePlasmidIds).toEqual([]);
  });

  it("refuses when requested plasmid declares a conflict with an active plasmid", async () => {
    const fx = await fakeDeps({
      loaded: [
        makeLoaded(makeMetadata({ id: "alpha" as PlasmidId })),
        makeLoaded(
          makeMetadata({
            id: "beta" as PlasmidId,
            conflicts: ["alpha" as PlasmidId],
          }),
        ),
      ],
    });
    cleanups.push(fx.cleanup);
    await fx.deps.activationStore.activate([asPlasmidId("alpha")]);
    const result = await activateSubcommand(
      ["beta"],
      makeContext(fx.workingDirectory),
      fx.deps,
    );
    expect(result.success).toBe(false);
    expect(result.output.toLowerCase()).toContain("conflict");
    expect(result.output).toContain("beta");
    expect(result.output).toContain("alpha");
    const state = await fx.deps.activationStore.read();
    expect(state.activePlasmidIds).toEqual(["alpha"]);
  });

  it("refuses when active plasmid declares a conflict with a requested one", async () => {
    const fx = await fakeDeps({
      loaded: [
        makeLoaded(
          makeMetadata({
            id: "alpha" as PlasmidId,
            conflicts: ["beta" as PlasmidId],
          }),
        ),
        makeLoaded(makeMetadata({ id: "beta" as PlasmidId })),
      ],
    });
    cleanups.push(fx.cleanup);
    await fx.deps.activationStore.activate([asPlasmidId("alpha")]);
    const result = await activateSubcommand(
      ["beta"],
      makeContext(fx.workingDirectory),
      fx.deps,
    );
    expect(result.success).toBe(false);
    expect(result.output.toLowerCase()).toContain("conflict");
  });

  it("activates multiple ids in one call (set-union)", async () => {
    const fx = await fakeDeps({
      loaded: [
        makeLoaded(makeMetadata({ id: "alpha" as PlasmidId })),
        makeLoaded(makeMetadata({ id: "beta" as PlasmidId })),
      ],
    });
    cleanups.push(fx.cleanup);
    const result = await activateSubcommand(
      ["alpha", "beta"],
      makeContext(fx.workingDirectory),
      fx.deps,
    );
    expect(result.success).toBe(true);
    const state = await fx.deps.activationStore.read();
    expect([...state.activePlasmidIds].sort()).toEqual(["alpha", "beta"]);
  });
});
