import { describe, it, expect } from "vitest";
import {
  extractImports,
  resolveImports,
  parseInstructions,
} from "../../../src/instructions/parser.js";

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
  });

  describe("parseInstructions", () => {
    it("should parse plain content", async () => {
      const result = await parseInstructions("Hello", process.cwd());
      expect(result).toBe("Hello");
    });
  });
});
