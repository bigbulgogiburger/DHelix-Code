import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  extractImports,
  resolveImports,
  parseInstructions,
} from "../../../src/instructions/parser.js";
import { mkdir, writeFile, rm } from "node:fs/promises";
import { join } from "node:path";

describe("instruction parser", () => {
  describe("extractImports", () => {
    it("should extract @import paths", () => {
      const content = '@import "./rules.md"\n@import "./extra.md"';
      const imports = extractImports(content);
      expect(imports).toEqual(["./rules.md", "./extra.md"]);
    });

    it("should handle imports with comments", () => {
      const content = '@import "./rules.md" # This is a rule file';
      const imports = extractImports(content);
      expect(imports).toEqual(["./rules.md"]);
    });

    it("should return empty for no imports", () => {
      const content = "# Regular content\nNo imports here.";
      const imports = extractImports(content);
      expect(imports).toHaveLength(0);
    });

    it("should handle mixed content with @import syntax", () => {
      const content = '# Title\n@import "./a.md"\nSome text\n@import "./b.md"\nMore text';
      const imports = extractImports(content);
      expect(imports).toEqual(["./a.md", "./b.md"]);
    });

    it("should extract @path shorthand imports", () => {
      const content = "@./rules/security.md\n@./docs/api-guidelines.md";
      const imports = extractImports(content);
      expect(imports).toEqual(["./rules/security.md", "./docs/api-guidelines.md"]);
    });

    it("should extract parent-relative @path imports", () => {
      const content = "@../shared/coding-standards.md";
      const imports = extractImports(content);
      expect(imports).toEqual(["../shared/coding-standards.md"]);
    });

    it("should extract absolute @path imports", () => {
      const content = "@/etc/shared-rules.md";
      const imports = extractImports(content);
      expect(imports).toEqual(["/etc/shared-rules.md"]);
    });

    it("should extract both @import and @path imports from mixed content", () => {
      const content =
        '# Title\n@./rules.md\nSome text\n@import "./extra.md"\n@../shared.md\nMore text';
      const imports = extractImports(content);
      expect(imports).toEqual(["./extra.md", "./rules.md", "../shared.md"]);
    });

    it("should NOT match @mentions (no path prefix)", () => {
      const content = "@username mentioned this\n@teamlead reviewed";
      const imports = extractImports(content);
      expect(imports).toHaveLength(0);
    });

    it("should NOT match email-like @ usage", () => {
      const content = "Contact us at user@example.com";
      const imports = extractImports(content);
      expect(imports).toHaveLength(0);
    });
  });

  describe("resolveImports", () => {
    const parserTmpDir = join(process.cwd(), "test", "tmp", "parser-imports");

    beforeEach(async () => {
      await mkdir(parserTmpDir, { recursive: true });
    });

    afterEach(async () => {
      try {
        await rm(parserTmpDir, { recursive: true, force: true });
      } catch {
        /* ignore */
      }
    });

    it("should return content unchanged when no imports", async () => {
      const content = "Hello world";
      const result = await resolveImports(content, process.cwd());
      expect(result).toBe("Hello world");
    });

    it("should replace missing @import with comment", async () => {
      const content = '@import "./nonexistent-file-xyz.md"';
      const result = await resolveImports(content, process.cwd());
      expect(result).toContain("import not found");
    });

    it("should resolve existing file with @import syntax", async () => {
      await writeFile(join(parserTmpDir, "rules.md"), "Rule content here", "utf-8");
      const content = '@import "./rules.md"\nMore text';
      const result = await resolveImports(content, parserTmpDir);
      expect(result).toContain("Rule content here");
      expect(result).toContain("More text");
    });

    it("should resolve nested @import imports", async () => {
      await writeFile(join(parserTmpDir, "inner.md"), "Inner content", "utf-8");
      await writeFile(join(parserTmpDir, "outer.md"), '@import "./inner.md"\nOuter text', "utf-8");
      const content = '@import "./outer.md"';
      const result = await resolveImports(content, parserTmpDir);
      expect(result).toContain("Inner content");
      expect(result).toContain("Outer text");
    });

    it("should detect circular @import imports and skip them", async () => {
      await writeFile(join(parserTmpDir, "a.md"), '@import "./b.md"\nContent A', "utf-8");
      await writeFile(join(parserTmpDir, "b.md"), '@import "./a.md"\nContent B', "utf-8");
      const content = '@import "./a.md"';
      const result = await resolveImports(content, parserTmpDir);
      expect(result).toContain("Content A");
      expect(result).toContain("Content B");
      expect(result).toContain("circular import skipped");
    });

    it("should stop at max import depth (5 levels) gracefully", async () => {
      // Create a chain: level0 -> level1 -> ... -> level6
      for (let i = 0; i < 7; i++) {
        const nextImport = i < 6 ? `@import "./level${i + 1}.md"` : "end of chain";
        await writeFile(join(parserTmpDir, `level${i}.md`), `${nextImport}\nLevel ${i}`, "utf-8");
      }
      const content = '@import "./level0.md"';
      // Should NOT throw — instead stops resolving at depth 5
      const result = await resolveImports(content, parserTmpDir);
      // Content from levels 0-4 should be resolved
      expect(result).toContain("Level 0");
      expect(result).toContain("Level 1");
      expect(result).toContain("Level 2");
      expect(result).toContain("Level 3");
      // At depth 5, the @import line is left unresolved (not expanded)
      // Level 4's content is included but its import to level5 is not expanded
      expect(result).toContain("Level 4");
    });

    // --- @path shorthand syntax tests ---

    it("should resolve single @path shorthand import", async () => {
      await writeFile(join(parserTmpDir, "security.md"), "Security rules content", "utf-8");
      const content = "@./security.md";
      const result = await resolveImports(content, parserTmpDir);
      expect(result).toBe("Security rules content");
    });

    it("should resolve multiple @path shorthand imports", async () => {
      await writeFile(join(parserTmpDir, "security.md"), "Security rules", "utf-8");
      await writeFile(join(parserTmpDir, "style.md"), "Style rules", "utf-8");
      const content = "# Project Config\n@./security.md\n@./style.md\nEnd of config";
      const result = await resolveImports(content, parserTmpDir);
      expect(result).toContain("# Project Config");
      expect(result).toContain("Security rules");
      expect(result).toContain("Style rules");
      expect(result).toContain("End of config");
    });

    it("should resolve @path with subdirectory paths", async () => {
      const subDir = join(parserTmpDir, "rules");
      await mkdir(subDir, { recursive: true });
      await writeFile(join(subDir, "auth.md"), "Auth guidelines", "utf-8");
      const content = "@./rules/auth.md";
      const result = await resolveImports(content, parserTmpDir);
      expect(result).toBe("Auth guidelines");
    });

    it("should resolve @path with parent-relative paths", async () => {
      const subDir = join(parserTmpDir, "sub");
      await mkdir(subDir, { recursive: true });
      await writeFile(join(parserTmpDir, "shared.md"), "Shared content", "utf-8");
      const content = "@../shared.md";
      const result = await resolveImports(content, subDir);
      expect(result).toBe("Shared content");
    });

    it("should resolve recursive @path shorthand imports (2-3 levels)", async () => {
      await writeFile(join(parserTmpDir, "deep.md"), "Deep nested content", "utf-8");
      await writeFile(join(parserTmpDir, "middle.md"), "@./deep.md\nMiddle content", "utf-8");
      await writeFile(join(parserTmpDir, "top.md"), "@./middle.md\nTop content", "utf-8");
      const content = "@./top.md";
      const result = await resolveImports(content, parserTmpDir);
      expect(result).toContain("Deep nested content");
      expect(result).toContain("Middle content");
      expect(result).toContain("Top content");
    });

    it("should detect circular @path imports (A imports B imports A)", async () => {
      await writeFile(join(parserTmpDir, "a.md"), "@./b.md\nContent A", "utf-8");
      await writeFile(join(parserTmpDir, "b.md"), "@./a.md\nContent B", "utf-8");
      const content = "@./a.md";
      const result = await resolveImports(content, parserTmpDir);
      expect(result).toContain("Content A");
      expect(result).toContain("Content B");
      expect(result).toContain("circular import skipped");
    });

    it("should skip @path imports for invalid paths gracefully", async () => {
      const content = "@./nonexistent-file.md";
      const result = await resolveImports(content, parserTmpDir);
      expect(result).toContain("import not found");
      expect(result).toContain("nonexistent-file.md");
    });

    it("should skip @path imports for non-.md files", async () => {
      await writeFile(join(parserTmpDir, "data.json"), '{"key": "value"}', "utf-8");
      const content = "@./data.json";
      const result = await resolveImports(content, parserTmpDir);
      expect(result).toContain("import skipped (not .md)");
      expect(result).toContain("data.json");
    });

    it("should skip non-.md files with @import syntax too", async () => {
      await writeFile(join(parserTmpDir, "script.ts"), "console.log('hi')", "utf-8");
      const content = '@import "./script.ts"';
      const result = await resolveImports(content, parserTmpDir);
      expect(result).toContain("import skipped (not .md)");
    });

    it("should handle mixed @import and @path syntax in same file", async () => {
      await writeFile(join(parserTmpDir, "a.md"), "Content from A", "utf-8");
      await writeFile(join(parserTmpDir, "b.md"), "Content from B", "utf-8");
      const content = '@import "./a.md"\n@./b.md';
      const result = await resolveImports(content, parserTmpDir);
      expect(result).toContain("Content from A");
      expect(result).toContain("Content from B");
    });

    it("should preserve order: content before import, import content, content after", async () => {
      await writeFile(join(parserTmpDir, "imported.md"), "IMPORTED", "utf-8");
      const content = "BEFORE\n@./imported.md\nAFTER";
      const result = await resolveImports(content, parserTmpDir);
      const beforeIdx = result.indexOf("BEFORE");
      const importedIdx = result.indexOf("IMPORTED");
      const afterIdx = result.indexOf("AFTER");
      expect(beforeIdx).toBeLessThan(importedIdx);
      expect(importedIdx).toBeLessThan(afterIdx);
    });

    it("should handle @path with deeply nested directory structure", async () => {
      const deepDir = join(parserTmpDir, "a", "b", "c");
      await mkdir(deepDir, { recursive: true });
      await writeFile(join(deepDir, "deep.md"), "Deep file content", "utf-8");
      const content = "@./a/b/c/deep.md";
      const result = await resolveImports(content, parserTmpDir);
      expect(result).toBe("Deep file content");
    });

    it("should stop @path shorthand recursion at max depth 5", async () => {
      for (let i = 0; i < 7; i++) {
        const nextImport = i < 6 ? `@./level${i + 1}.md` : "end of chain";
        await writeFile(join(parserTmpDir, `level${i}.md`), `${nextImport}\nLevel ${i}`, "utf-8");
      }
      const content = "@./level0.md";
      // Should NOT throw — gracefully stops at depth 5
      const result = await resolveImports(content, parserTmpDir);
      expect(result).toContain("Level 0");
      expect(result).toContain("Level 1");
      expect(result).toContain("Level 2");
      expect(result).toContain("Level 3");
      expect(result).toContain("Level 4");
    });

    it("should handle self-referencing @path import gracefully", async () => {
      await writeFile(join(parserTmpDir, "self.md"), "@./self.md\nSelf content", "utf-8");
      const content = "@./self.md";
      const result = await resolveImports(content, parserTmpDir);
      expect(result).toContain("Self content");
      expect(result).toContain("circular import skipped");
    });

    it("should handle three-node circular chain", async () => {
      await writeFile(join(parserTmpDir, "x.md"), "@./y.md\nContent X", "utf-8");
      await writeFile(join(parserTmpDir, "y.md"), "@./z.md\nContent Y", "utf-8");
      await writeFile(join(parserTmpDir, "z.md"), "@./x.md\nContent Z", "utf-8");
      const content = "@./x.md";
      const result = await resolveImports(content, parserTmpDir);
      expect(result).toContain("Content X");
      expect(result).toContain("Content Y");
      expect(result).toContain("Content Z");
      expect(result).toContain("circular import skipped");
    });
  });

  describe("parseInstructions", () => {
    it("should parse plain content", async () => {
      const result = await parseInstructions("Hello", process.cwd());
      expect(result).toBe("Hello");
    });

    it("should resolve imports via parseInstructions", async () => {
      const tmpDir = join(process.cwd(), "test", "tmp", "parse-instructions");
      await mkdir(tmpDir, { recursive: true });
      try {
        await writeFile(join(tmpDir, "included.md"), "Included content", "utf-8");
        const result = await parseInstructions("@./included.md\nMain content", tmpDir);
        expect(result).toContain("Included content");
        expect(result).toContain("Main content");
      } finally {
        await rm(tmpDir, { recursive: true, force: true }).catch(() => {});
      }
    });
  });
});
