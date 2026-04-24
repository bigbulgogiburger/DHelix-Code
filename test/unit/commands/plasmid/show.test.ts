import { afterEach, describe, expect, it } from "vitest";

import { showSubcommand } from "../../../../src/commands/plasmid/show.js";
import { asPlasmidId } from "../../../../src/plasmids/activation.js";
import type { PlasmidId } from "../../../../src/plasmids/types.js";
import { fakeDeps, makeContext, makeLoaded, makeMetadata } from "./_fixtures.js";

describe("/plasmid show", () => {
  let cleanups: Array<() => Promise<void>> = [];
  afterEach(async () => {
    for (const fn of cleanups) await fn();
    cleanups = [];
  });

  it("prints metadata + eval-case count for an existing id", async () => {
    const fx = await fakeDeps({
      loaded: [
        makeLoaded(
          makeMetadata({ id: "alpha" as PlasmidId, tier: "L2", tags: ["x", "y"] }),
          { evalCases: [{ id: "e1", description: "d", input: "i", expectations: [] }] },
        ),
      ],
    });
    cleanups.push(fx.cleanup);
    const result = await showSubcommand(
      ["alpha"],
      makeContext(fx.workingDirectory),
      fx.deps,
    );
    expect(result.success).toBe(true);
    expect(result.output).toContain("id:          alpha");
    expect(result.output).toContain("tier:        L2");
    expect(result.output).toContain("eval cases:  1");
    expect(result.output).toContain("tags:        x, y");
    expect(result.output).not.toContain("---"); // no body separator without --body
  });

  it("reports not-found for an unknown id", async () => {
    const fx = await fakeDeps();
    cleanups.push(fx.cleanup);
    const result = await showSubcommand(
      ["ghost"],
      makeContext(fx.workingDirectory),
      fx.deps,
    );
    expect(result.success).toBe(false);
    expect(result.output).toContain("Plasmid not found: ghost");
  });

  it("requires an id argument", async () => {
    const fx = await fakeDeps();
    cleanups.push(fx.cleanup);
    const result = await showSubcommand([], makeContext(fx.workingDirectory), fx.deps);
    expect(result.success).toBe(false);
    expect(result.output).toContain("Missing argument");
  });

  it("rejects more than one positional id", async () => {
    const fx = await fakeDeps();
    cleanups.push(fx.cleanup);
    const result = await showSubcommand(
      ["alpha", "beta"],
      makeContext(fx.workingDirectory),
      fx.deps,
    );
    expect(result.success).toBe(false);
    expect(result.output).toContain("Only one plasmid id");
  });

  it("shows body tail with --body on cloud-ok plasmid", async () => {
    const body = Array.from({ length: 50 }, (_, i) => `line-${i + 1}`).join("\n");
    const fx = await fakeDeps({
      loaded: [
        makeLoaded(makeMetadata({ id: "alpha" as PlasmidId, privacy: "cloud-ok" }), {
          body,
        }),
      ],
    });
    cleanups.push(fx.cleanup);
    const result = await showSubcommand(
      ["alpha", "--body"],
      makeContext(fx.workingDirectory),
      fx.deps,
    );
    expect(result.success).toBe(true);
    expect(result.output).toContain("---");
    expect(result.output).toContain("line-50");
    // only tail lines — first line should be gone
    expect(result.output).not.toContain("line-1\n");
  });

  it("refuses body display for local-only when provider looks cloud", async () => {
    const fx = await fakeDeps({
      loaded: [
        makeLoaded(makeMetadata({ id: "alpha" as PlasmidId, privacy: "local-only" })),
      ],
      baseUrl: "https://api.openai.com/v1",
    });
    cleanups.push(fx.cleanup);
    const result = await showSubcommand(
      ["alpha", "--body"],
      makeContext(fx.workingDirectory),
      fx.deps,
    );
    expect(result.success).toBe(true); // metadata still printed
    expect(result.output).toContain("body hidden");
    expect(result.output).toContain("--force");
  });

  it("allows body display with --force even when provider looks cloud", async () => {
    const body = "secret\nstuff";
    const fx = await fakeDeps({
      loaded: [
        makeLoaded(makeMetadata({ id: "alpha" as PlasmidId, privacy: "local-only" }), {
          body,
        }),
      ],
      baseUrl: "https://api.openai.com/v1",
    });
    cleanups.push(fx.cleanup);
    const result = await showSubcommand(
      ["alpha", "--body", "--force"],
      makeContext(fx.workingDirectory),
      fx.deps,
    );
    expect(result.success).toBe(true);
    expect(result.output).toContain("[warn] local-only body shown over cloud");
    expect(result.output).toContain("secret");
  });

  it("allows body display for local-only when provider is localhost", async () => {
    const fx = await fakeDeps({
      loaded: [
        makeLoaded(makeMetadata({ id: "alpha" as PlasmidId, privacy: "local-only" }), {
          body: "local-body-content",
        }),
      ],
      baseUrl: "http://localhost:11434/v1",
    });
    cleanups.push(fx.cleanup);
    const result = await showSubcommand(
      ["alpha", "--body"],
      makeContext(fx.workingDirectory),
      fx.deps,
    );
    expect(result.success).toBe(true);
    expect(result.output).toContain("local-body-content");
  });

  it("reports active=yes when id is in activation set", async () => {
    const fx = await fakeDeps({
      loaded: [makeLoaded(makeMetadata({ id: "alpha" as PlasmidId }))],
    });
    cleanups.push(fx.cleanup);
    await fx.deps.activationStore.activate([asPlasmidId("alpha")]);
    const result = await showSubcommand(
      ["alpha"],
      makeContext(fx.workingDirectory),
      fx.deps,
    );
    expect(result.success).toBe(true);
    expect(result.output).toContain("active:      yes");
  });
});
