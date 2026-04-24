import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { createTemplateResolver } from "../../../../src/recombination/generators/template-resolver.js";

describe("template resolver", () => {
  let workDir = "";
  let primitivesRoot = "";

  beforeEach(async () => {
    workDir = await mkdtemp(path.join(os.tmpdir(), "gen-resolver-"));
    primitivesRoot = await mkdtemp(path.join(os.tmpdir(), "gen-prim-"));
    await writeFile(
      path.join(primitivesRoot, "rule.basic.hbs"),
      "PRIM rule",
      "utf8",
    );
  });

  afterEach(async () => {
    await rm(workDir, { recursive: true, force: true });
    await rm(primitivesRoot, { recursive: true, force: true });
  });

  it("rejects a relative working directory", () => {
    expect(() =>
      createTemplateResolver({ workingDirectory: "relative" }),
    ).toThrow(/absolute path/);
  });

  it("rejects basenames containing path separators", async () => {
    const r = createTemplateResolver({
      workingDirectory: workDir,
      primitivesRoot,
    });
    await expect(r.resolve("../evil.hbs")).rejects.toThrow(/invalid template/);
    await expect(r.resolve("sub/file.hbs")).rejects.toThrow(/invalid template/);
  });

  it("falls back to primitives when project/patterns are missing", async () => {
    const r = createTemplateResolver({
      workingDirectory: workDir,
      primitivesRoot,
    });
    const got = await r.resolve("rule.basic.hbs");
    expect(got.layer).toBe("primitives");
    expect(got.templateId).toBe("primitives/rule.basic.hbs");
    expect(got.content).toBe("PRIM rule");
    expect(got.hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("prefers project over patterns over primitives", async () => {
    const patternsDir = path.join(workDir, ".dhelix", "templates", "patterns");
    const projectDir = path.join(workDir, ".dhelix", "templates", "project");
    await mkdir(patternsDir, { recursive: true });
    await mkdir(projectDir, { recursive: true });
    await writeFile(
      path.join(patternsDir, "rule.basic.hbs"),
      "PAT rule",
      "utf8",
    );
    await writeFile(
      path.join(projectDir, "rule.basic.hbs"),
      "PROJ rule",
      "utf8",
    );

    const r = createTemplateResolver({
      workingDirectory: workDir,
      primitivesRoot,
    });
    const got = await r.resolve("rule.basic.hbs");
    expect(got.layer).toBe("project");
    expect(got.content).toBe("PROJ rule");
  });

  it("uses patterns when project is absent", async () => {
    const patternsDir = path.join(workDir, ".dhelix", "templates", "patterns");
    await mkdir(patternsDir, { recursive: true });
    await writeFile(
      path.join(patternsDir, "rule.basic.hbs"),
      "PAT rule",
      "utf8",
    );
    const r = createTemplateResolver({
      workingDirectory: workDir,
      primitivesRoot,
    });
    const got = await r.resolve("rule.basic.hbs");
    expect(got.layer).toBe("patterns");
  });

  it("tryResolve returns null when the template is missing", async () => {
    const r = createTemplateResolver({
      workingDirectory: workDir,
      primitivesRoot,
    });
    const hit = await r.tryResolve("does-not-exist.hbs");
    expect(hit).toBeNull();
  });

  it("resolve throws when nothing matches", async () => {
    const r = createTemplateResolver({
      workingDirectory: workDir,
      primitivesRoot,
    });
    await expect(r.resolve("unknown.hbs")).rejects.toThrow(/not found/);
  });

  it("drift hash changes when content changes", async () => {
    const r1 = createTemplateResolver({
      workingDirectory: workDir,
      primitivesRoot,
    });
    const a = await r1.resolve("rule.basic.hbs");
    await writeFile(
      path.join(primitivesRoot, "rule.basic.hbs"),
      "PRIM rule v2",
      "utf8",
    );
    const r2 = createTemplateResolver({
      workingDirectory: workDir,
      primitivesRoot,
    });
    const b = await r2.resolve("rule.basic.hbs");
    expect(b.hash).not.toBe(a.hash);
  });
});
