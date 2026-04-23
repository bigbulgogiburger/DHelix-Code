import { afterEach, describe, expect, it } from "vitest";

import { makePlasmidCommand } from "../../../../src/commands/plasmid/index.js";
import { fakeDeps, makeContext } from "./_fixtures.js";

describe("/plasmid dispatcher", () => {
  let cleanups: Array<() => Promise<void>> = [];
  afterEach(async () => {
    for (const fn of cleanups) await fn();
    cleanups = [];
  });

  it("returns usage when invoked with no arguments", async () => {
    const fx = await fakeDeps();
    cleanups.push(fx.cleanup);
    const cmd = makePlasmidCommand(fx.deps);
    const result = await cmd.execute("", makeContext(fx.workingDirectory));
    expect(result.success).toBe(true);
    expect(result.output).toContain("Usage: /plasmid");
    expect(result.output).toContain("list");
    expect(result.output).toContain("show");
    expect(result.output).toContain("validate");
    expect(result.output).toContain("activate");
    expect(result.output).toContain("deactivate");
    expect(result.output).toContain("edit");
  });

  it("returns usage when invoked with only whitespace", async () => {
    const fx = await fakeDeps();
    cleanups.push(fx.cleanup);
    const cmd = makePlasmidCommand(fx.deps);
    const result = await cmd.execute("   ", makeContext(fx.workingDirectory));
    expect(result.success).toBe(true);
    expect(result.output).toContain("Usage: /plasmid");
  });

  it("returns success:false with hint for unknown subcommand", async () => {
    const fx = await fakeDeps();
    cleanups.push(fx.cleanup);
    const cmd = makePlasmidCommand(fx.deps);
    const result = await cmd.execute("nope", makeContext(fx.workingDirectory));
    expect(result.success).toBe(false);
    expect(result.output).toContain("Unknown /plasmid subcommand");
    expect(result.output).toContain("'nope'");
    expect(result.output).toContain("Usage: /plasmid");
  });

  it("dispatches to list subcommand", async () => {
    const fx = await fakeDeps();
    cleanups.push(fx.cleanup);
    const cmd = makePlasmidCommand(fx.deps);
    const result = await cmd.execute("list", makeContext(fx.workingDirectory));
    expect(result.success).toBe(true);
    expect(fx.loadSpy.calls).toBeGreaterThanOrEqual(1);
  });

  it("dispatches to validate subcommand (no args)", async () => {
    const fx = await fakeDeps();
    cleanups.push(fx.cleanup);
    const cmd = makePlasmidCommand(fx.deps);
    const result = await cmd.execute("validate", makeContext(fx.workingDirectory));
    // empty registry, validate with no id -> success:true, hint about no plasmids
    expect(result.success).toBe(true);
    expect(result.output.toLowerCase()).toContain("no plasmids");
  });

  it("supports factory function form (depsOrFactory)", async () => {
    const fx = await fakeDeps();
    cleanups.push(fx.cleanup);
    let factoryCalls = 0;
    const cmd = makePlasmidCommand(() => {
      factoryCalls++;
      return fx.deps;
    });
    await cmd.execute("", makeContext(fx.workingDirectory));
    await cmd.execute("list", makeContext(fx.workingDirectory));
    expect(factoryCalls).toBe(2);
  });

  it("exposes metadata fields expected by the CLI registry", async () => {
    const fx = await fakeDeps();
    cleanups.push(fx.cleanup);
    const cmd = makePlasmidCommand(fx.deps);
    expect(cmd.name).toBe("plasmid");
    expect(cmd.description.length).toBeGreaterThan(0);
    expect(cmd.usage).toContain("/plasmid");
  });
});
