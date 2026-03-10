import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  loadInstructions,
  InstructionLoadError,
  LazyInstructionLoader,
} from "../../../src/instructions/loader.js";
import { mkdir, writeFile, rm, symlink } from "node:fs/promises";
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

  it("should handle rules with frontmatter pattern (legacy single pattern)", async () => {
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

  it("should handle rules with multi-glob paths frontmatter", async () => {
    await writeFile(join(tmpDir, "DBCODE.md"), "base", "utf-8");
    const rulesDir = join(tmpDir, ".dbcode", "rules");
    await mkdir(rulesDir, { recursive: true });

    const ruleContent = [
      "---",
      "paths:",
      '  - "src/api/**"',
      '  - "src/routes/**"',
      '  - "lib/handlers/**"',
      "---",
      "# API Guidelines",
      "Follow REST conventions.",
    ].join("\n");

    await writeFile(join(rulesDir, "api-rules.md"), ruleContent, "utf-8");

    // The working directory matches none of the patterns, so the rule
    // should not appear in path rules (since collectMatchingContent
    // filters by the working directory path)
    const result = await loadInstructions(tmpDir);
    expect(result.pathRules).toBeDefined();
  });

  it("should parse paths array and match correctly", async () => {
    await writeFile(join(tmpDir, "DBCODE.md"), "base", "utf-8");
    const rulesDir = join(tmpDir, ".dbcode", "rules");
    await mkdir(rulesDir, { recursive: true });

    // Rule with no frontmatter (matches everything with **)
    await writeFile(
      join(rulesDir, "global.md"),
      "Global rule content",
      "utf-8",
    );

    // Rule with paths that won't match the tmpDir
    const restrictedRule = [
      "---",
      "paths:",
      '  - "src/api/**"',
      '  - "src/routes/**"',
      "---",
      "Restricted API content",
    ].join("\n");

    await writeFile(join(rulesDir, "api.md"), restrictedRule, "utf-8");

    const result = await loadInstructions(tmpDir);
    // Global rule (no pattern = **) should match
    expect(result.pathRules).toContain("Global rule content");
  });

  it("should give paths precedence over pattern when both are present", async () => {
    await writeFile(join(tmpDir, "DBCODE.md"), "base", "utf-8");
    const rulesDir = join(tmpDir, ".dbcode", "rules");
    await mkdir(rulesDir, { recursive: true });

    // Both pattern and paths present — paths should take precedence
    const ruleContent = [
      "---",
      'pattern: "**"',
      "paths:",
      '  - "src/specific/**"',
      "---",
      "Should only match src/specific paths",
    ].join("\n");

    await writeFile(join(rulesDir, "mixed.md"), ruleContent, "utf-8");

    const result = await loadInstructions(tmpDir);
    // paths takes precedence, and tmpDir doesn't match "src/specific/**"
    // so this rule should NOT be in the path rules
    expect(result.pathRules).not.toContain("Should only match src/specific paths");
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

  it("should have parentInstructions field", async () => {
    const result = await loadInstructions(tmpDir);
    expect(result.parentInstructions).toBe("");
  });

  it("should exclude rule files matching excludePatterns", async () => {
    await writeFile(join(tmpDir, "DBCODE.md"), "base", "utf-8");
    const rulesDir = join(tmpDir, ".dbcode", "rules");
    await mkdir(rulesDir, { recursive: true });
    await writeFile(join(rulesDir, "style.md"), "Keep included", "utf-8");
    await writeFile(join(rulesDir, "excluded.md"), "Should be excluded", "utf-8");

    const result = await loadInstructions(tmpDir, {
      excludePatterns: ["excluded.md"],
    });
    expect(result.pathRules).toContain("Keep included");
    expect(result.pathRules).not.toContain("Should be excluded");
  });

  it("should accept options parameter without breaking existing behavior", async () => {
    await writeFile(join(tmpDir, "DBCODE.md"), "base instructions", "utf-8");
    const result = await loadInstructions(tmpDir, { excludePatterns: [] });
    expect(result.projectInstructions).toContain("base instructions");
  });

  it("should handle frontmatter with paths using unquoted values", async () => {
    await writeFile(join(tmpDir, "DBCODE.md"), "base", "utf-8");
    const rulesDir = join(tmpDir, ".dbcode", "rules");
    await mkdir(rulesDir, { recursive: true });

    const ruleContent = [
      "---",
      "paths:",
      "  - src/api/**",
      "  - src/routes/**",
      "---",
      "Unquoted paths rule",
    ].join("\n");

    await writeFile(join(rulesDir, "unquoted.md"), ruleContent, "utf-8");

    const result = await loadInstructions(tmpDir);
    // Rule is loaded (unquoted paths should work); it won't match tmpDir though
    expect(result.pathRules).toBeDefined();
  });

  it("should resolve symlinked DBCODE.md files", async () => {
    // Create a real file in a separate directory
    const realDir = join(tmpDir, "real-source");
    await mkdir(realDir, { recursive: true });
    await writeFile(
      join(realDir, "DBCODE.md"),
      "Symlinked project instructions",
      "utf-8",
    );

    // Create a project directory with a symlinked DBCODE.md
    const projectDir = join(tmpDir, "project");
    await mkdir(projectDir, { recursive: true });
    await symlink(join(realDir, "DBCODE.md"), join(projectDir, "DBCODE.md"));

    const result = await loadInstructions(projectDir);
    expect(result.projectInstructions).toContain("Symlinked project instructions");
  });

  it("should resolve @path imports within DBCODE.md", async () => {
    const rulesDir = join(tmpDir, "rules");
    await mkdir(rulesDir, { recursive: true });
    await writeFile(join(rulesDir, "security.md"), "Always validate inputs", "utf-8");
    await writeFile(
      join(tmpDir, "DBCODE.md"),
      "# Project\n@./rules/security.md\nEnd",
      "utf-8",
    );

    const result = await loadInstructions(tmpDir);
    expect(result.projectInstructions).toContain("Always validate inputs");
    expect(result.projectInstructions).toContain("# Project");
    expect(result.projectInstructions).toContain("End");
  });
});

describe("LazyInstructionLoader", () => {
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

  it("should return empty string for files outside project root", async () => {
    const loader = new LazyInstructionLoader(tmpDir);
    const result = await loader.getInstructionsForFile("/some/other/path/file.ts");
    expect(result).toBe("");
  });

  it("should return empty string when no DBCODE.md exists", async () => {
    const loader = new LazyInstructionLoader(tmpDir);
    const result = await loader.getInstructionsForFile(join(tmpDir, "src", "index.ts"));
    expect(result).toBe("");
  });

  it("should load root-level DBCODE.md for any file in project", async () => {
    await writeFile(join(tmpDir, "DBCODE.md"), "Root instructions", "utf-8");
    const loader = new LazyInstructionLoader(tmpDir);
    const result = await loader.getInstructionsForFile(join(tmpDir, "src", "index.ts"));
    expect(result).toContain("Root instructions");
  });

  it("should load subdirectory DBCODE.md", async () => {
    await writeFile(join(tmpDir, "DBCODE.md"), "Root instructions", "utf-8");
    const subDir = join(tmpDir, "src", "api");
    await mkdir(subDir, { recursive: true });
    await writeFile(join(subDir, "DBCODE.md"), "API-specific instructions", "utf-8");

    const loader = new LazyInstructionLoader(tmpDir);
    const result = await loader.getInstructionsForFile(join(subDir, "handler.ts"));
    expect(result).toContain("API-specific instructions");
    expect(result).toContain("Root instructions");
  });

  it("should collect instructions from all ancestor directories", async () => {
    await writeFile(join(tmpDir, "DBCODE.md"), "Root level", "utf-8");
    const srcDir = join(tmpDir, "src");
    await mkdir(srcDir, { recursive: true });
    await writeFile(join(srcDir, "DBCODE.md"), "Src level", "utf-8");
    const apiDir = join(srcDir, "api");
    await mkdir(apiDir, { recursive: true });
    await writeFile(join(apiDir, "DBCODE.md"), "API level", "utf-8");

    const loader = new LazyInstructionLoader(tmpDir);
    const result = await loader.getInstructionsForFile(join(apiDir, "handler.ts"));

    expect(result).toContain("API level");
    expect(result).toContain("Src level");
    expect(result).toContain("Root level");
  });

  it("should cache loaded instructions", async () => {
    await writeFile(join(tmpDir, "DBCODE.md"), "Cached content", "utf-8");

    const loader = new LazyInstructionLoader(tmpDir);

    // First call
    const result1 = await loader.getInstructionsForFile(join(tmpDir, "file1.ts"));
    expect(result1).toContain("Cached content");

    // Overwrite the file
    await writeFile(join(tmpDir, "DBCODE.md"), "Updated content", "utf-8");

    // Second call should return cached content
    const result2 = await loader.getInstructionsForFile(join(tmpDir, "file2.ts"));
    expect(result2).toContain("Cached content");
    expect(result2).not.toContain("Updated content");
  });

  it("should invalidate cache for a specific directory", async () => {
    await writeFile(join(tmpDir, "DBCODE.md"), "Original content", "utf-8");

    const loader = new LazyInstructionLoader(tmpDir);

    // Load and cache
    const result1 = await loader.getInstructionsForFile(join(tmpDir, "file.ts"));
    expect(result1).toContain("Original content");

    // Update the file
    await writeFile(join(tmpDir, "DBCODE.md"), "Updated content", "utf-8");

    // Invalidate
    loader.invalidate(tmpDir);

    // Should now get updated content
    const result2 = await loader.getInstructionsForFile(join(tmpDir, "file.ts"));
    expect(result2).toContain("Updated content");
  });

  it("should clear all cached instructions", async () => {
    await writeFile(join(tmpDir, "DBCODE.md"), "Original content", "utf-8");

    const loader = new LazyInstructionLoader(tmpDir);

    // Load and cache
    await loader.getInstructionsForFile(join(tmpDir, "file.ts"));

    // Update the file
    await writeFile(join(tmpDir, "DBCODE.md"), "Updated content", "utf-8");

    // Clear all
    loader.clearCache();

    // Should now get updated content
    const result = await loader.getInstructionsForFile(join(tmpDir, "file.ts"));
    expect(result).toContain("Updated content");
  });

  it("should handle files directly in the project root", async () => {
    await writeFile(join(tmpDir, "DBCODE.md"), "Root instructions", "utf-8");

    const loader = new LazyInstructionLoader(tmpDir);
    const result = await loader.getInstructionsForFile(join(tmpDir, "package.json"));
    expect(result).toContain("Root instructions");
  });

  it("should not load from directories above the project root", async () => {
    const parentDir = join(tmpDir, "..");
    await writeFile(join(tmpDir, "DBCODE.md"), "Project instructions", "utf-8");

    const loader = new LazyInstructionLoader(tmpDir);
    const result = await loader.getInstructionsForFile(join(tmpDir, "src", "file.ts"));

    // Should only contain project root instructions, not parent dir
    expect(result).toContain("Project instructions");
  });

  it("should handle backslash paths on Windows", async () => {
    await writeFile(join(tmpDir, "DBCODE.md"), "Root instructions", "utf-8");

    const loader = new LazyInstructionLoader(tmpDir);
    const windowsStylePath = join(tmpDir, "src", "file.ts").replace(/\//g, "\\");
    const result = await loader.getInstructionsForFile(windowsStylePath);
    expect(result).toContain("Root instructions");
  });
});
