import * as fsp from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { scaffoldSkill } from "../../../../src/skills/creator/scaffold.js";
import { ScaffoldError } from "../../../../src/skills/creator/types.js";

const validOpts = {
  name: "demo-skill",
  intent: "Generate a demo artifact",
  triggers: ["create demo", "demo please", "test skill"],
  antiTriggers: ["run production"],
  fork: false,
  requiredTools: ["Write"],
  minModelTier: "medium" as const,
  workflowSteps: ["Parse args", "Generate", "Report"],
  outputDir: "",
  force: false,
};

describe("scaffoldSkill", () => {
  let outputDir: string;

  beforeEach(async () => {
    outputDir = await fsp.mkdtemp(join(tmpdir(), "dhelix-scaffold-"));
  });

  afterEach(async () => {
    await fsp.rm(outputDir, { recursive: true, force: true });
  });

  it("creates directory layout and files for a valid input", async () => {
    const result = await scaffoldSkill({ ...validOpts, outputDir });
    expect(result.skillDir).toBe(join(outputDir, "demo-skill"));
    expect(result.skillMdPath).toBe(join(outputDir, "demo-skill", "SKILL.md"));
    expect(result.evalsPath).toBe(join(outputDir, "demo-skill", "evals", "evals.json"));

    const skillExists = await fsp
      .stat(result.skillMdPath)
      .then(() => true)
      .catch(() => false);
    const evalsExists = await fsp
      .stat(result.evalsPath)
      .then(() => true)
      .catch(() => false);
    const refsExists = await fsp
      .stat(join(result.skillDir, "references"))
      .then(() => true)
      .catch(() => false);

    expect(skillExists).toBe(true);
    expect(evalsExists).toBe(true);
    expect(refsExists).toBe(true);

    expect(result.created.length).toBeGreaterThanOrEqual(5);
  });

  it("writes UTF-8 SKILL.md with expected frontmatter", async () => {
    const result = await scaffoldSkill({ ...validOpts, outputDir });
    const body = await fsp.readFile(result.skillMdPath, "utf8");
    expect(body).toContain("name: demo-skill");
    expect(body).toContain("description:");
    expect(body).toContain("## Mission");
  });

  it("writes valid JSON to evals.json", async () => {
    const result = await scaffoldSkill({ ...validOpts, outputDir });
    const text = await fsp.readFile(result.evalsPath, "utf8");
    const parsed = JSON.parse(text) as { skill_name: string; cases: unknown[] };
    expect(parsed.skill_name).toBe("demo-skill");
    expect(parsed.cases.length).toBeGreaterThanOrEqual(2);
  });

  it("rejects non-kebab-case name with INVALID_NAME", async () => {
    await expect(
      scaffoldSkill({ ...validOpts, name: "BadName", outputDir }),
    ).rejects.toMatchObject({ code: "INVALID_NAME" });
  });

  it("rejects underscore names with INVALID_NAME", async () => {
    await expect(
      scaffoldSkill({ ...validOpts, name: "bad_name", outputDir }),
    ).rejects.toMatchObject({ code: "INVALID_NAME" });
  });

  it("throws NAME_COLLISION when dir exists and force=false", async () => {
    await scaffoldSkill({ ...validOpts, outputDir });
    await expect(scaffoldSkill({ ...validOpts, outputDir })).rejects.toMatchObject({
      code: "NAME_COLLISION",
    });
  });

  it("overwrites when force=true", async () => {
    await scaffoldSkill({ ...validOpts, outputDir });
    const result = await scaffoldSkill({ ...validOpts, force: true, outputDir });
    expect(result.skillMdPath).toBeTruthy();
  });

  it("surfaces IO_ERROR when fs.mkdir fails", async () => {
    const failingFs = {
      ...fsp,
      mkdir: vi.fn().mockRejectedValue(new Error("disk full")),
    } as unknown as typeof fsp;
    await expect(
      scaffoldSkill({ ...validOpts, outputDir }, { fs: failingFs }),
    ).rejects.toMatchObject({ code: "IO_ERROR" });
  });

  it("surfaces IO_ERROR when fs.writeFile fails", async () => {
    const failingFs = {
      ...fsp,
      writeFile: vi.fn().mockRejectedValue(new Error("readonly fs")),
    } as unknown as typeof fsp;
    await expect(
      scaffoldSkill({ ...validOpts, outputDir }, { fs: failingFs }),
    ).rejects.toMatchObject({ code: "IO_ERROR" });
  });

  it("rejects empty triggers array via zod", async () => {
    await expect(
      scaffoldSkill({ ...validOpts, triggers: [], outputDir }),
    ).rejects.toBeInstanceOf(ScaffoldError);
  });

  it("rejects empty workflowSteps via zod", async () => {
    await expect(
      scaffoldSkill({ ...validOpts, workflowSteps: [], outputDir }),
    ).rejects.toBeInstanceOf(ScaffoldError);
  });

  it("returns absolute paths in created[]", async () => {
    const result = await scaffoldSkill({ ...validOpts, outputDir });
    for (const p of result.created) {
      expect(p.startsWith(outputDir)).toBe(true);
    }
  });
});
