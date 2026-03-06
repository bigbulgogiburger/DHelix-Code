import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { loadInstructions, InstructionLoadError } from "../../../src/instructions/loader.js";
import { mkdir, writeFile, rm } from "node:fs/promises";
import { join } from "node:path";

const tmpDir = join(process.cwd(), "test", "tmp", "instructions-loader");

describe("instructions/loader", () => {
  beforeEach(async () => {
    await mkdir(tmpDir, { recursive: true });
  });

  afterEach(async () => {
    try {
      await rm(tmpDir, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
  });

  it("should return empty instructions when no DBCODE.md exists", async () => {
    const result = await loadInstructions(tmpDir);
    expect(result.projectInstructions).toBe("");
    expect(result.pathRules).toBe("");
    expect(result.combined).toBe("");
  });

  it("should load DBCODE.md as project instructions", async () => {
    await writeFile(join(tmpDir, "DBCODE.md"), "# Project Rules\nAlways use TypeScript.", "utf-8");
    const result = await loadInstructions(tmpDir);
    expect(result.projectInstructions).toContain("Project Rules");
    expect(result.projectInstructions).toContain("TypeScript");
    expect(result.combined).toContain("Project Rules");
  });

  it("should load path rules from .dbcode/rules/ directory", async () => {
    // Create DBCODE.md so project root is found
    await writeFile(join(tmpDir, "DBCODE.md"), "base instructions", "utf-8");
    const rulesDir = join(tmpDir, ".dbcode", "rules");
    await mkdir(rulesDir, { recursive: true });
    await writeFile(join(rulesDir, "style.md"), "Use functional patterns.", "utf-8");

    const result = await loadInstructions(tmpDir);
    expect(result.pathRules).toContain("functional patterns");
  });

  it("should handle rules with frontmatter pattern", async () => {
    await writeFile(join(tmpDir, "DBCODE.md"), "base", "utf-8");
    const rulesDir = join(tmpDir, ".dbcode", "rules");
    await mkdir(rulesDir, { recursive: true });
    await writeFile(
      join(rulesDir, "tests.md"),
      '---\npattern: "test/**"\n---\nAlways write tests first.',
      "utf-8",
    );

    const result = await loadInstructions(tmpDir);
    // The rule should be loaded (pattern matching applies at filter time)
    expect(result.pathRules).toBeDefined();
  });

  it("should skip non-.md files in rules directory", async () => {
    await writeFile(join(tmpDir, "DBCODE.md"), "base", "utf-8");
    const rulesDir = join(tmpDir, ".dbcode", "rules");
    await mkdir(rulesDir, { recursive: true });
    await writeFile(join(rulesDir, "notes.txt"), "not a rule", "utf-8");
    await writeFile(join(rulesDir, "style.md"), "is a rule", "utf-8");

    const result = await loadInstructions(tmpDir);
    // Only .md files should be included
    expect(result.pathRules).not.toContain("not a rule");
  });

  it("should combine project instructions and path rules", async () => {
    await writeFile(join(tmpDir, "DBCODE.md"), "Project config", "utf-8");
    const rulesDir = join(tmpDir, ".dbcode", "rules");
    await mkdir(rulesDir, { recursive: true });
    await writeFile(join(rulesDir, "code.md"), "Code style rule", "utf-8");

    const result = await loadInstructions(tmpDir);
    expect(result.combined).toContain("Project config");
    // path rules are collected and included if matching
    expect(result.combined.length).toBeGreaterThan(0);
  });

  it("should handle empty DBCODE.md", async () => {
    await writeFile(join(tmpDir, "DBCODE.md"), "", "utf-8");
    const result = await loadInstructions(tmpDir);
    expect(result.projectInstructions).toBe("");
  });

  it("should handle missing rules directory gracefully", async () => {
    await writeFile(join(tmpDir, "DBCODE.md"), "base", "utf-8");
    // No .dbcode/rules/ directory
    const result = await loadInstructions(tmpDir);
    expect(result.pathRules).toBe("");
  });

  it("should have InstructionLoadError with proper code", () => {
    const err = new InstructionLoadError("load failed", { path: "/test" });
    expect(err).toBeInstanceOf(Error);
    expect(err.code).toBe("INSTRUCTION_LOAD_ERROR");
    expect(err.message).toBe("load failed");
  });
});
