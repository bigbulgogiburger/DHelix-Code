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
    it("should extract import paths", () => {
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

    it("should handle mixed content", () => {
      const content = '# Title\n@import "./a.md"\nSome text\n@import "./b.md"\nMore text';
      const imports = extractImports(content);
      expect(imports).toEqual(["./a.md", "./b.md"]);
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

    it("should replace missing import with comment", async () => {
      const content = '@import "./nonexistent-file-xyz.md"';
      const result = await resolveImports(content, process.cwd());
      expect(result).toContain("import not found");
    });

    it("should resolve existing file import", async () => {
      await writeFile(join(parserTmpDir, "rules.md"), "Rule content here", "utf-8");
      const content = '@import "./rules.md"\nMore text';
      const result = await resolveImports(content, parserTmpDir);
      expect(result).toContain("Rule content here");
      expect(result).toContain("More text");
    });

    it("should resolve nested imports", async () => {
      await writeFile(join(parserTmpDir, "inner.md"), "Inner content", "utf-8");
      await writeFile(join(parserTmpDir, "outer.md"), '@import "./inner.md"\nOuter text', "utf-8");
      const content = '@import "./outer.md"';
      const result = await resolveImports(content, parserTmpDir);
      expect(result).toContain("Inner content");
      expect(result).toContain("Outer text");
    });

    it("should detect circular imports and skip them", async () => {
      await writeFile(join(parserTmpDir, "a.md"), '@import "./b.md"\nContent A', "utf-8");
      await writeFile(join(parserTmpDir, "b.md"), '@import "./a.md"\nContent B', "utf-8");
      const content = '@import "./a.md"';
      const result = await resolveImports(content, parserTmpDir);
      expect(result).toContain("Content A");
      expect(result).toContain("Content B");
      expect(result).toContain("circular import skipped");
    });

    it("should throw on max import depth exceeded", async () => {
      // Create a deep chain: each file imports a next one, 11+ levels deep
      for (let i = 0; i < 12; i++) {
        const nextImport = i < 11 ? `@import "./level${i + 1}.md"` : "end";
        await writeFile(join(parserTmpDir, `level${i}.md`), nextImport, "utf-8");
      }
      const content = '@import "./level0.md"';
      await expect(resolveImports(content, parserTmpDir)).rejects.toThrow("Maximum import depth");
    });
  });

  describe("parseInstructions", () => {
    it("should parse plain content", async () => {
      const result = await parseInstructions("Hello", process.cwd());
      expect(result).toBe("Hello");
    });
  });
});
