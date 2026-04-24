import { afterEach, describe, expect, it } from "vitest";

import { validateSubcommand } from "../../../../src/commands/plasmid/validate.js";
import type { PlasmidId } from "../../../../src/plasmids/types.js";
import { fakeDeps, makeContext, makeLoaded, makeMetadata } from "./_fixtures.js";

describe("/plasmid validate", () => {
  let cleanups: Array<() => Promise<void>> = [];
  afterEach(async () => {
    for (const fn of cleanups) await fn();
    cleanups = [];
  });

  it("reports 'no plasmids' when registry is empty and no id supplied", async () => {
    const fx = await fakeDeps();
    cleanups.push(fx.cleanup);
    const result = await validateSubcommand(
      [],
      makeContext(fx.workingDirectory),
      fx.deps,
    );
    expect(result.success).toBe(true);
    expect(result.output).toContain("No plasmids loaded");
  });

  it("returns success when all loaded plasmids pass cross-ref", async () => {
    const fx = await fakeDeps({
      loaded: [
        makeLoaded(
          makeMetadata({ id: "alpha" as PlasmidId }),
          { evalCases: [{ id: "e1", description: "d", input: "i", expectations: [] }] },
        ),
      ],
    });
    cleanups.push(fx.cleanup);
    const result = await validateSubcommand(
      [],
      makeContext(fx.workingDirectory),
      fx.deps,
    );
    expect(result.success).toBe(true);
    expect(result.output).toContain("[OK  ]");
    expect(result.output).toContain("alpha");
    expect(result.output).toContain("pass=1");
  });

  it("flags an unknown 'extends' target as fail", async () => {
    const fx = await fakeDeps({
      loaded: [
        makeLoaded(
          makeMetadata({ id: "child" as PlasmidId, extends: "missing-parent" as PlasmidId }),
          { evalCases: [{ id: "e1", description: "d", input: "i", expectations: [] }] },
        ),
      ],
    });
    cleanups.push(fx.cleanup);
    const result = await validateSubcommand(
      [],
      makeContext(fx.workingDirectory),
      fx.deps,
    );
    expect(result.success).toBe(false);
    expect(result.output).toContain("[FAIL]");
    expect(result.output).toContain("extends unknown plasmid");
    expect(result.output).toContain("fail=1");
  });

  it("flags an unknown 'requires' target as fail", async () => {
    const fx = await fakeDeps({
      loaded: [
        makeLoaded(
          makeMetadata({
            id: "alpha" as PlasmidId,
            requires: ["missing" as PlasmidId],
          }),
          { evalCases: [{ id: "e1", description: "d", input: "i", expectations: [] }] },
        ),
      ],
    });
    cleanups.push(fx.cleanup);
    const result = await validateSubcommand(
      [],
      makeContext(fx.workingDirectory),
      fx.deps,
    );
    expect(result.success).toBe(false);
    expect(result.output).toContain("requires unknown plasmid");
  });

  it("soft-warns on unknown 'conflicts' target", async () => {
    const fx = await fakeDeps({
      loaded: [
        makeLoaded(
          makeMetadata({
            id: "alpha" as PlasmidId,
            conflicts: ["phantom" as PlasmidId],
          }),
          { evalCases: [{ id: "e1", description: "d", input: "i", expectations: [] }] },
        ),
      ],
    });
    cleanups.push(fx.cleanup);
    const result = await validateSubcommand(
      [],
      makeContext(fx.workingDirectory),
      fx.deps,
    );
    expect(result.success).toBe(true);
    expect(result.output).toContain("[WARN]");
    expect(result.output).toContain("soft warning");
    expect(result.output).toContain("warn=1");
  });

  it("warns when no eval cases are defined", async () => {
    const fx = await fakeDeps({
      loaded: [makeLoaded(makeMetadata({ id: "alpha" as PlasmidId }))],
    });
    cleanups.push(fx.cleanup);
    const result = await validateSubcommand(
      [],
      makeContext(fx.workingDirectory),
      fx.deps,
    );
    expect(result.success).toBe(true);
    expect(result.output).toContain("[WARN]");
    expect(result.output).toContain("no eval cases");
  });

  it("returns single-plasmid finding when id is provided", async () => {
    const fx = await fakeDeps({
      loaded: [
        makeLoaded(
          makeMetadata({ id: "alpha" as PlasmidId }),
          { evalCases: [{ id: "e1", description: "d", input: "i", expectations: [] }] },
        ),
        makeLoaded(
          makeMetadata({ id: "beta" as PlasmidId }),
          { evalCases: [{ id: "e1", description: "d", input: "i", expectations: [] }] },
        ),
      ],
    });
    cleanups.push(fx.cleanup);
    const result = await validateSubcommand(
      ["alpha"],
      makeContext(fx.workingDirectory),
      fx.deps,
    );
    expect(result.success).toBe(true);
    expect(result.output).toContain("alpha");
    expect(result.output).not.toContain("[OK  ] beta");
  });

  it("returns not-found for an unknown id", async () => {
    const fx = await fakeDeps({
      loaded: [makeLoaded(makeMetadata({ id: "alpha" as PlasmidId }))],
    });
    cleanups.push(fx.cleanup);
    const result = await validateSubcommand(
      ["ghost"],
      makeContext(fx.workingDirectory),
      fx.deps,
    );
    // 'not found' is reported as success:false because we asked for a specific id
    expect(result.success).toBe(false);
    expect(result.output).toContain("Plasmid not found");
  });

  it("rejects unknown flags", async () => {
    const fx = await fakeDeps();
    cleanups.push(fx.cleanup);
    const result = await validateSubcommand(
      ["--wat"],
      makeContext(fx.workingDirectory),
      fx.deps,
    );
    expect(result.success).toBe(false);
    expect(result.output).toContain("Unknown flag");
  });
});
