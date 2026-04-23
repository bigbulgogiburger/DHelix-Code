import { afterEach, describe, expect, it } from "vitest";

import { deactivateSubcommand } from "../../../../src/commands/plasmid/deactivate.js";
import { asPlasmidId } from "../../../../src/plasmids/activation.js";
import type { PlasmidId } from "../../../../src/plasmids/types.js";
import { fakeDeps, makeContext, makeLoaded, makeMetadata } from "./_fixtures.js";

describe("/plasmid deactivate", () => {
  let cleanups: Array<() => Promise<void>> = [];
  afterEach(async () => {
    for (const fn of cleanups) await fn();
    cleanups = [];
  });

  it("requires at least one id", async () => {
    const fx = await fakeDeps();
    cleanups.push(fx.cleanup);
    const result = await deactivateSubcommand(
      [],
      makeContext(fx.workingDirectory),
      fx.deps,
    );
    expect(result.success).toBe(false);
    expect(result.output).toContain("Missing argument");
  });

  it("deactivates an active id and persists state", async () => {
    const fx = await fakeDeps({
      loaded: [makeLoaded(makeMetadata({ id: "alpha" as PlasmidId }))],
    });
    cleanups.push(fx.cleanup);
    await fx.deps.activationStore.activate([asPlasmidId("alpha")]);

    const result = await deactivateSubcommand(
      ["alpha"],
      makeContext(fx.workingDirectory),
      fx.deps,
    );
    expect(result.success).toBe(true);
    expect(result.output).toContain("Deactivated: alpha");
    const state = await fx.deps.activationStore.read();
    expect(state.activePlasmidIds).toEqual([]);
  });

  it("is idempotent for ids that are not currently active", async () => {
    const fx = await fakeDeps({
      loaded: [makeLoaded(makeMetadata({ id: "alpha" as PlasmidId }))],
    });
    cleanups.push(fx.cleanup);
    const result = await deactivateSubcommand(
      ["alpha"],
      makeContext(fx.workingDirectory),
      fx.deps,
    );
    expect(result.success).toBe(true);
  });

  it("refuses to deactivate an L4 (foundational-by-tier) plasmid", async () => {
    const fx = await fakeDeps({
      loaded: [makeLoaded(makeMetadata({ id: "core" as PlasmidId, tier: "L4" }))],
    });
    cleanups.push(fx.cleanup);
    await fx.deps.activationStore.activate([asPlasmidId("core")]);

    const result = await deactivateSubcommand(
      ["core"],
      makeContext(fx.workingDirectory),
      fx.deps,
    );
    expect(result.success).toBe(false);
    expect(result.output).toContain("PLASMID_FOUNDATIONAL_CHALLENGE_REQUIRED");
    expect(result.output).toContain("core");
    expect(result.output).toContain("challenge");

    const state = await fx.deps.activationStore.read();
    expect(state.activePlasmidIds).toEqual(["core"]);
  });

  it("refuses to deactivate a foundational:true plasmid regardless of tier", async () => {
    const fx = await fakeDeps({
      loaded: [
        makeLoaded(
          makeMetadata({ id: "root" as PlasmidId, tier: "L2", foundational: true }),
        ),
      ],
    });
    cleanups.push(fx.cleanup);
    await fx.deps.activationStore.activate([asPlasmidId("root")]);

    const result = await deactivateSubcommand(
      ["root"],
      makeContext(fx.workingDirectory),
      fx.deps,
    );
    expect(result.success).toBe(false);
    expect(result.output).toContain("PLASMID_FOUNDATIONAL_CHALLENGE_REQUIRED");
  });

  it("refuses the whole batch if any id is foundational", async () => {
    const fx = await fakeDeps({
      loaded: [
        makeLoaded(makeMetadata({ id: "alpha" as PlasmidId })),
        makeLoaded(makeMetadata({ id: "core" as PlasmidId, tier: "L4" })),
      ],
    });
    cleanups.push(fx.cleanup);
    await fx.deps.activationStore.activate([
      asPlasmidId("alpha"),
      asPlasmidId("core"),
    ]);

    const result = await deactivateSubcommand(
      ["alpha", "core"],
      makeContext(fx.workingDirectory),
      fx.deps,
    );
    expect(result.success).toBe(false);
    const state = await fx.deps.activationStore.read();
    // batch failure must not have removed alpha either
    expect([...state.activePlasmidIds].sort()).toEqual(["alpha", "core"]);
  });
});
