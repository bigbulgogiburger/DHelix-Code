import { afterEach, describe, expect, it } from "vitest";

import { listSubcommand } from "../../../../src/commands/plasmid/list.js";
import { asPlasmidId } from "../../../../src/plasmids/activation.js";
import type { PlasmidId } from "../../../../src/plasmids/types.js";
import { fakeDeps, makeContext, makeLoaded, makeMetadata } from "./_fixtures.js";

describe("/plasmid list", () => {
  let cleanups: Array<() => Promise<void>> = [];
  afterEach(async () => {
    for (const fn of cleanups) await fn();
    cleanups = [];
  });

  it("returns 'no plasmids loaded' on empty registry", async () => {
    const fx = await fakeDeps();
    cleanups.push(fx.cleanup);
    const result = await listSubcommand([], makeContext(fx.workingDirectory), fx.deps);
    expect(result.success).toBe(true);
    expect(result.output).toContain("No plasmids loaded");
  });

  it("renders a table header + rows for loaded plasmids", async () => {
    const fx = await fakeDeps({
      loaded: [
        makeLoaded(makeMetadata({ id: "alpha" as PlasmidId, tier: "L1" })),
        makeLoaded(makeMetadata({ id: "beta" as PlasmidId, tier: "L3", privacy: "local-only" })),
      ],
    });
    cleanups.push(fx.cleanup);
    const result = await listSubcommand([], makeContext(fx.workingDirectory), fx.deps);
    expect(result.success).toBe(true);
    expect(result.output).toContain("id");
    expect(result.output).toContain("alpha");
    expect(result.output).toContain("beta");
    expect(result.output).toContain("L1");
    expect(result.output).toContain("L3");
    expect(result.output).toContain("local-only");
  });

  it("filters by --tier", async () => {
    const fx = await fakeDeps({
      loaded: [
        makeLoaded(makeMetadata({ id: "alpha" as PlasmidId, tier: "L1" })),
        makeLoaded(makeMetadata({ id: "beta" as PlasmidId, tier: "L3" })),
      ],
    });
    cleanups.push(fx.cleanup);
    const result = await listSubcommand(
      ["--tier", "L1"],
      makeContext(fx.workingDirectory),
      fx.deps,
    );
    expect(result.success).toBe(true);
    expect(result.output).toContain("alpha");
    expect(result.output).not.toContain("beta");
  });

  it("filters by --scope", async () => {
    const fx = await fakeDeps({
      loaded: [
        makeLoaded(makeMetadata({ id: "alpha" as PlasmidId }), { scopeOrigin: "local" }),
        makeLoaded(makeMetadata({ id: "beta" as PlasmidId }), { scopeOrigin: "shared" }),
      ],
    });
    cleanups.push(fx.cleanup);
    const result = await listSubcommand(
      ["--scope", "shared"],
      makeContext(fx.workingDirectory),
      fx.deps,
    );
    expect(result.success).toBe(true);
    expect(result.output).toContain("beta");
    expect(result.output).not.toContain("alpha");
  });

  it("filters by --active (only lists currently active ids)", async () => {
    const fx = await fakeDeps({
      loaded: [
        makeLoaded(makeMetadata({ id: "alpha" as PlasmidId })),
        makeLoaded(makeMetadata({ id: "beta" as PlasmidId })),
      ],
    });
    cleanups.push(fx.cleanup);
    await fx.deps.activationStore.activate([asPlasmidId("beta")]);
    const result = await listSubcommand(
      ["--active"],
      makeContext(fx.workingDirectory),
      fx.deps,
    );
    expect(result.success).toBe(true);
    expect(result.output).toContain("beta");
    expect(result.output).not.toContain("alpha ");
  });

  it("rejects an unknown flag", async () => {
    const fx = await fakeDeps();
    cleanups.push(fx.cleanup);
    const result = await listSubcommand(
      ["--bogus"],
      makeContext(fx.workingDirectory),
      fx.deps,
    );
    expect(result.success).toBe(false);
    expect(result.output).toContain("Unknown flag");
  });

  it("rejects an invalid --tier value", async () => {
    const fx = await fakeDeps();
    cleanups.push(fx.cleanup);
    const result = await listSubcommand(
      ["--tier", "L9"],
      makeContext(fx.workingDirectory),
      fx.deps,
    );
    expect(result.success).toBe(false);
    expect(result.output).toContain("Invalid --tier");
  });

  it("includes a failure tail when some plasmids failed to load", async () => {
    const fx = await fakeDeps({
      loaded: [makeLoaded(makeMetadata({ id: "alpha" as PlasmidId }))],
      failed: [
        {
          path: "/fake/broken/metadata.yaml",
          reason: "invalid frontmatter",
          code: "PLASMID_SCHEMA_INVALID",
        },
      ],
    });
    cleanups.push(fx.cleanup);
    const result = await listSubcommand([], makeContext(fx.workingDirectory), fx.deps);
    expect(result.success).toBe(true);
    expect(result.output).toContain("1 plasmid(s) failed to load");
  });
});
