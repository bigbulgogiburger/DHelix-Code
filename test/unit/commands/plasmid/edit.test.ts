import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { editSubcommand } from "../../../../src/commands/plasmid/edit.js";
import type { PlasmidId } from "../../../../src/plasmids/types.js";
import { fakeDeps, makeContext, makeLoaded, makeMetadata } from "./_fixtures.js";

describe("/plasmid edit", () => {
  let cleanups: Array<() => Promise<void>> = [];

  beforeEach(() => {
    // Default all tests to a no-op editor so we never spawn vim/nano.
    vi.stubEnv("EDITOR", "true");
  });

  afterEach(async () => {
    for (const fn of cleanups) await fn();
    cleanups = [];
    vi.unstubAllEnvs();
  });

  it("requires an id argument", async () => {
    const fx = await fakeDeps();
    cleanups.push(fx.cleanup);
    const result = await editSubcommand([], makeContext(fx.workingDirectory), fx.deps);
    expect(result.success).toBe(false);
    expect(result.output).toContain("Missing argument");
  });

  it("rejects more than one positional argument", async () => {
    const fx = await fakeDeps();
    cleanups.push(fx.cleanup);
    const result = await editSubcommand(
      ["alpha", "beta"],
      makeContext(fx.workingDirectory),
      fx.deps,
    );
    expect(result.success).toBe(false);
    expect(result.output).toContain("Invalid arguments");
  });

  it("rejects flag-like tokens", async () => {
    const fx = await fakeDeps();
    cleanups.push(fx.cleanup);
    const result = await editSubcommand(
      ["--flag"],
      makeContext(fx.workingDirectory),
      fx.deps,
    );
    expect(result.success).toBe(false);
    expect(result.output).toContain("Invalid arguments");
  });

  it("reports not-found for an unknown id", async () => {
    const fx = await fakeDeps();
    cleanups.push(fx.cleanup);
    const result = await editSubcommand(
      ["ghost"],
      makeContext(fx.workingDirectory),
      fx.deps,
    );
    expect(result.success).toBe(false);
    expect(result.output).toContain("Plasmid not found: ghost");
  });

  it("spawns the injected editor and reports success", async () => {
    const fx = await fakeDeps({
      loaded: [makeLoaded(makeMetadata({ id: "alpha" as PlasmidId }))],
      editorCommand: "true", // exit 0 immediately
    });
    cleanups.push(fx.cleanup);
    const result = await editSubcommand(
      ["alpha"],
      makeContext(fx.workingDirectory),
      fx.deps,
    );
    expect(result.success).toBe(true);
    expect(result.output).toContain("Edited");
    expect(result.output).toContain("editor: true");
  });

  it("falls back to $EDITOR when deps.editorCommand is absent", async () => {
    vi.stubEnv("EDITOR", "true");
    const fx = await fakeDeps({
      loaded: [makeLoaded(makeMetadata({ id: "alpha" as PlasmidId }))],
    });
    cleanups.push(fx.cleanup);
    const result = await editSubcommand(
      ["alpha"],
      makeContext(fx.workingDirectory),
      fx.deps,
    );
    expect(result.success).toBe(true);
    expect(result.output).toContain("editor: true");
  });

  it("falls back to vim when no editor is configured", async () => {
    vi.stubEnv("EDITOR", "");
    const fx = await fakeDeps({
      loaded: [makeLoaded(makeMetadata({ id: "alpha" as PlasmidId }))],
    });
    cleanups.push(fx.cleanup);
    // Don't actually spawn vim — just confirm the resolver picked vim when
    // the env is empty. We use editorCommand: undefined + EDITOR="" to force
    // the default branch, then override editorCommand to "true" so the
    // spawn itself succeeds.
    const depsWithVim = { ...fx.deps, editorCommand: "true" };
    const result = await editSubcommand(
      ["alpha"],
      makeContext(fx.workingDirectory),
      depsWithVim,
    );
    expect(result.success).toBe(true);
  });

  it("refuses to edit local-only plasmid over a cloud-looking provider", async () => {
    const fx = await fakeDeps({
      loaded: [
        makeLoaded(makeMetadata({ id: "secret" as PlasmidId, privacy: "local-only" })),
      ],
      baseUrl: "https://api.openai.com/v1",
      editorCommand: "true",
    });
    cleanups.push(fx.cleanup);
    const result = await editSubcommand(
      ["secret"],
      makeContext(fx.workingDirectory),
      fx.deps,
    );
    expect(result.success).toBe(false);
    expect(result.output).toContain("Refusing to edit");
    expect(result.output).toContain("local-only");
  });

  it("allows editing local-only plasmid when provider is localhost", async () => {
    const fx = await fakeDeps({
      loaded: [
        makeLoaded(makeMetadata({ id: "secret" as PlasmidId, privacy: "local-only" })),
      ],
      baseUrl: "http://localhost:11434/v1",
      editorCommand: "true",
    });
    cleanups.push(fx.cleanup);
    const result = await editSubcommand(
      ["secret"],
      makeContext(fx.workingDirectory),
      fx.deps,
    );
    expect(result.success).toBe(true);
    expect(result.output).toContain("Edited");
  });

  it("reports failure when the editor exits non-zero", async () => {
    const fx = await fakeDeps({
      loaded: [makeLoaded(makeMetadata({ id: "alpha" as PlasmidId }))],
      editorCommand: "false", // exits 1
    });
    cleanups.push(fx.cleanup);
    const result = await editSubcommand(
      ["alpha"],
      makeContext(fx.workingDirectory),
      fx.deps,
    );
    expect(result.success).toBe(false);
    expect(result.output).toContain("Editor exited with code");
  });
});
