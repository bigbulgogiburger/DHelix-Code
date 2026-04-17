/**
 * Unit tests for the .dskill packager (src/skills/creator/packaging/package.ts).
 *
 * Strategy:
 *   - Use a real temp directory on disk for fs interactions (fast, deterministic).
 *   - Scaffold a minimal skill layout manually, then invoke packageSkill.
 *   - Verify: archive written, sha256 deterministic, file-count accurate,
 *     workspace/ excluded, missing README auto-generated, error codes.
 */

import * as fsp from "node:fs/promises";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  PackageError,
  packageSkill,
  readSkillFromDir,
} from "../../../../../src/skills/creator/packaging/package.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const VALID_FRONTMATTER = `---
name: demo-skill
description: A demonstration skill for packaging tests.
---

# Demo Skill

Body goes here.
`;

async function scaffoldSkill(
  skillDir: string,
  opts: {
    readonly skillMd?: string;
    readonly withEvals?: boolean;
    readonly withReadme?: boolean;
    readonly withWorkspace?: boolean;
    readonly withReferences?: boolean;
    readonly withHidden?: boolean;
  } = {},
): Promise<void> {
  await fsp.mkdir(skillDir, { recursive: true });
  await fsp.writeFile(
    join(skillDir, "SKILL.md"),
    opts.skillMd ?? VALID_FRONTMATTER,
    "utf8",
  );
  if (opts.withEvals !== false) {
    const evalsDir = join(skillDir, "evals");
    await fsp.mkdir(evalsDir, { recursive: true });
    await fsp.writeFile(
      join(evalsDir, "evals.json"),
      JSON.stringify({ skill_name: "demo-skill", version: 1, cases: [] }, null, 2),
      "utf8",
    );
  }
  if (opts.withReadme) {
    await fsp.writeFile(
      join(skillDir, "README.md"),
      "# Provided readme\n",
      "utf8",
    );
  }
  if (opts.withWorkspace) {
    const wsDir = join(skillDir, "workspace");
    await fsp.mkdir(wsDir, { recursive: true });
    await fsp.writeFile(join(wsDir, "iter-0.json"), "{}", "utf8");
  }
  if (opts.withReferences) {
    const refDir = join(skillDir, "references");
    await fsp.mkdir(refDir, { recursive: true });
    await fsp.writeFile(join(refDir, "note.md"), "reference note", "utf8");
  }
  if (opts.withHidden) {
    await fsp.writeFile(join(skillDir, ".DS_Store"), "noise", "utf8");
  }
}

async function makeTmpdir(prefix: string): Promise<string> {
  return mkdtemp(join(tmpdir(), `dhelix-pkg-${prefix}-`));
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("packageSkill — happy path", () => {
  let root: string;
  let skillDir: string;
  let outDir: string;

  beforeEach(async () => {
    root = await makeTmpdir("happy");
    skillDir = join(root, "skills", "demo-skill");
    outDir = join(root, "dist");
    await scaffoldSkill(skillDir, { withReferences: true });
  });

  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it("writes a .dskill archive to the output directory", async () => {
    const result = await packageSkill({ skillDir, outputDir: outDir });
    expect(result.outputPath.endsWith(`demo-skill-0.1.0.dskill`)).toBe(true);

    const stat = await fsp.stat(result.outputPath);
    expect(stat.isFile()).toBe(true);
    expect(stat.size).toBe(result.bytes);
    expect(result.fileCount).toBeGreaterThan(0);
  });

  it("produces a deterministic sha256 for the same input", async () => {
    const r1 = await packageSkill({ skillDir, outputDir: outDir });
    const r2 = await packageSkill({ skillDir, outputDir: outDir });
    expect(r1.sha256).toBe(r2.sha256);
    expect(r1.sha256).toMatch(/^[0-9a-f]{64}$/);
  });

  it("includes manifest.json first in the archive file list", async () => {
    const result = await packageSkill({ skillDir, outputDir: outDir });
    expect(result.manifest.files[0]).toBe("manifest.json");
  });

  it("propagates --version into the manifest and output filename", async () => {
    const result = await packageSkill({
      skillDir,
      outputDir: outDir,
      version: "2.3.4",
    });
    expect(result.manifest.version).toBe("2.3.4");
    expect(result.outputPath.endsWith("demo-skill-2.3.4.dskill")).toBe(true);
  });

  it("propagates --trust-level into the manifest", async () => {
    const result = await packageSkill({
      skillDir,
      outputDir: outDir,
      trustLevel: "community",
    });
    expect(result.manifest.trustLevel).toBe("community");
  });
});

describe("packageSkill — exclusions & generated files", () => {
  let root: string;
  let skillDir: string;
  let outDir: string;

  beforeEach(async () => {
    root = await makeTmpdir("excl");
    skillDir = join(root, "skills", "demo-skill");
    outDir = join(root, "dist");
  });

  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it("excludes workspace/ from the archive", async () => {
    await scaffoldSkill(skillDir, { withWorkspace: true });
    const result = await packageSkill({ skillDir, outputDir: outDir });
    for (const f of result.manifest.files) {
      expect(f.startsWith("workspace")).toBe(false);
    }
  });

  it("excludes hidden OS artefacts like .DS_Store", async () => {
    await scaffoldSkill(skillDir, { withHidden: true });
    const result = await packageSkill({ skillDir, outputDir: outDir });
    expect(result.manifest.files.some((f) => f.includes(".DS_Store"))).toBe(false);
  });

  it("generates a README.md when absent", async () => {
    await scaffoldSkill(skillDir, { withReadme: false });
    const result = await packageSkill({ skillDir, outputDir: outDir });
    expect(result.manifest.files).toContain("README.md");
  });

  it("uses user-provided README.md when present", async () => {
    await scaffoldSkill(skillDir, { withReadme: true });
    const result = await packageSkill({ skillDir, outputDir: outDir });
    expect(result.manifest.files).toContain("README.md");
    // Verify the archive bytes contain the provided readme marker somewhere.
    const buf = await fsp.readFile(result.outputPath);
    expect(buf.includes(Buffer.from("Provided readme"))).toBe(true);
  });
});

describe("packageSkill — error paths", () => {
  let root: string;
  let outDir: string;

  beforeEach(async () => {
    root = await makeTmpdir("err");
    outDir = join(root, "dist");
  });

  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it("throws SKILL_NOT_FOUND when skillDir is missing", async () => {
    const missing = join(root, "does-not-exist");
    await expect(
      packageSkill({ skillDir: missing, outputDir: outDir }),
    ).rejects.toMatchObject({ code: "SKILL_NOT_FOUND" });
  });

  it("throws SKILL_NOT_FOUND when SKILL.md is missing", async () => {
    const skillDir = join(root, "skills", "empty");
    await fsp.mkdir(skillDir, { recursive: true });
    await expect(
      packageSkill({ skillDir, outputDir: outDir }),
    ).rejects.toMatchObject({ code: "SKILL_NOT_FOUND" });
  });

  it("throws INVALID_MANIFEST when frontmatter block is absent", async () => {
    const skillDir = join(root, "skills", "noframe");
    await fsp.mkdir(skillDir, { recursive: true });
    await fsp.writeFile(join(skillDir, "SKILL.md"), "# just a heading\n", "utf8");
    await expect(
      packageSkill({ skillDir, outputDir: outDir }),
    ).rejects.toMatchObject({ code: "INVALID_MANIFEST" });
  });

  it("throws INVALID_MANIFEST when required fields are missing from frontmatter", async () => {
    const skillDir = join(root, "skills", "partial");
    const bad = `---\ndescription: missing name field\n---\nbody\n`;
    await fsp.mkdir(skillDir, { recursive: true });
    await fsp.writeFile(join(skillDir, "SKILL.md"), bad, "utf8");
    await expect(
      packageSkill({ skillDir, outputDir: outDir }),
    ).rejects.toMatchObject({ code: "INVALID_MANIFEST" });
  });

  it("throws IO_ERROR when output writeFile fails", async () => {
    const skillDir = join(root, "skills", "demo-skill");
    await scaffoldSkill(skillDir);
    const brokenFs = {
      ...fsp,
      writeFile: async () => {
        throw new Error("disk full");
      },
    } as unknown as typeof fsp;
    await expect(
      packageSkill({ skillDir, outputDir: outDir, fs: brokenFs }),
    ).rejects.toMatchObject({ code: "IO_ERROR" });
  });

  it("rejects with ABORTED when signal is already aborted", async () => {
    const skillDir = join(root, "skills", "demo-skill");
    await scaffoldSkill(skillDir);
    const controller = new AbortController();
    controller.abort();
    await expect(
      packageSkill({
        skillDir,
        outputDir: outDir,
        signal: controller.signal,
      }),
    ).rejects.toMatchObject({ code: "ABORTED" });
  });

  it("PackageError carries both code and message", () => {
    const err = new PackageError("IO_ERROR", "boom");
    expect(err.code).toBe("IO_ERROR");
    expect(err.message).toBe("boom");
    expect(err).toBeInstanceOf(Error);
  });
});

describe("readSkillFromDir", () => {
  let root: string;

  beforeEach(async () => {
    root = await makeTmpdir("read");
  });

  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it("returns skillMd, manifest, and sorted file list", async () => {
    const skillDir = join(root, "skills", "demo-skill");
    await scaffoldSkill(skillDir, { withReferences: true });
    const { skillMd, manifest, files } = await readSkillFromDir(skillDir);
    expect(skillMd).toContain("# Demo Skill");
    expect(manifest.name).toBe("demo-skill");
    expect(files).toEqual([...files].sort());
    expect(files).toContain("SKILL.md");
    expect(files).toContain("evals/evals.json");
    expect(files).toContain("references/note.md");
  });

  it("rejects with SKILL_NOT_FOUND for non-existent dir", async () => {
    await expect(readSkillFromDir(join(root, "nope"))).rejects.toMatchObject({
      code: "SKILL_NOT_FOUND",
    });
  });
});
