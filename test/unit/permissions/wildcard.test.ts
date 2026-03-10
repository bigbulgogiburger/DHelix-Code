import { describe, it, expect } from "vitest";
import {
  matchWildcard,
  parseRuleString,
  formatRuleString,
  matchToolArgs,
} from "../../../src/permissions/wildcard.js";

describe("wildcard", () => {
  // -----------------------------------------------------------------------
  // matchWildcard
  // -----------------------------------------------------------------------

  describe("matchWildcard()", () => {
    describe("single star (*) — matches non-path-separator characters", () => {
      it("matches 'npm install' against 'npm *'", () => {
        expect(matchWildcard("npm install", "npm *")).toBe(true);
      });

      it("does not match 'npm' against 'npm *' (no args after npm)", () => {
        expect(matchWildcard("npm", "npm *")).toBe(false);
      });

      it("matches 'npm run test' against 'npm *'", () => {
        // "npm *" with single star matches any non-separator sequence after "npm "
        // "run test" contains a space but no path separators
        expect(matchWildcard("npm run test", "npm *")).toBe(true);
      });

      it("matches 'git commit -m hello' against 'git *'", () => {
        expect(matchWildcard("git commit -m hello", "git *")).toBe(true);
      });

      it("matches 'anything' against '*'", () => {
        expect(matchWildcard("anything", "*")).toBe(true);
      });

      it("matches 'file.ts' against '*.ts'", () => {
        expect(matchWildcard("file.ts", "*.ts")).toBe(true);
      });

      it("does not match 'file.js' against '*.ts'", () => {
        expect(matchWildcard("file.js", "*.ts")).toBe(false);
      });

      it("does not match path with separator against single star", () => {
        expect(matchWildcard("src/file.ts", "*.ts")).toBe(false);
      });
    });

    describe("double star (**) — matches including path separators", () => {
      it("matches '/src/foo.ts' against '/src/**'", () => {
        expect(matchWildcard("/src/foo.ts", "/src/**")).toBe(true);
      });

      it("does not match '/test/foo.ts' against '/src/**'", () => {
        expect(matchWildcard("/test/foo.ts", "/src/**")).toBe(false);
      });

      it("matches nested paths with '**'", () => {
        expect(matchWildcard("/src/utils/path.ts", "/src/**")).toBe(true);
      });

      it("matches deeply nested paths", () => {
        expect(matchWildcard("/src/a/b/c/d/e.ts", "/src/**")).toBe(true);
      });
    });

    describe("exact matching", () => {
      it("matches exact strings", () => {
        expect(matchWildcard("exact", "exact")).toBe(true);
      });

      it("does not match different strings", () => {
        expect(matchWildcard("not-exact", "exact")).toBe(false);
      });

      it("does not match partial strings", () => {
        expect(matchWildcard("exactly", "exact")).toBe(false);
      });

      it("does not match substrings", () => {
        expect(matchWildcard("exa", "exact")).toBe(false);
      });
    });

    describe("question mark (?) — matches single character", () => {
      it("matches single character", () => {
        expect(matchWildcard("file1.ts", "file?.ts")).toBe(true);
      });

      it("does not match no character", () => {
        expect(matchWildcard("file.ts", "file?.ts")).toBe(false);
      });

      it("does not match path separator", () => {
        expect(matchWildcard("file/.ts", "file?.ts")).toBe(false);
      });
    });

    describe("special regex characters", () => {
      it("handles dots in patterns", () => {
        expect(matchWildcard("package.json", "package.json")).toBe(true);
        expect(matchWildcard("packageXjson", "package.json")).toBe(false);
      });

      it("handles parentheses in patterns", () => {
        expect(matchWildcard("fn()", "fn()")).toBe(true);
      });

      it("handles brackets in patterns", () => {
        expect(matchWildcard("arr[0]", "arr[0]")).toBe(true);
      });
    });

    describe("empty strings", () => {
      it("matches empty value against empty pattern", () => {
        expect(matchWildcard("", "")).toBe(true);
      });

      it("does not match non-empty value against empty pattern", () => {
        expect(matchWildcard("something", "")).toBe(false);
      });
    });
  });

  // -----------------------------------------------------------------------
  // parseRuleString
  // -----------------------------------------------------------------------

  describe("parseRuleString()", () => {
    it("parses 'Bash(npm *)' correctly", () => {
      const result = parseRuleString("Bash(npm *)");
      expect(result.tool).toBe("Bash");
      expect(result.pattern).toBe("npm *");
    });

    it("parses 'file_read' (no pattern) correctly", () => {
      const result = parseRuleString("file_read");
      expect(result.tool).toBe("file_read");
      expect(result.pattern).toBeUndefined();
    });

    it("parses 'Edit(/src/**)' correctly", () => {
      const result = parseRuleString("Edit(/src/**)");
      expect(result.tool).toBe("Edit");
      expect(result.pattern).toBe("/src/**");
    });

    it("handles whitespace in tool name", () => {
      const result = parseRuleString("  file_read  ");
      expect(result.tool).toBe("file_read");
    });

    it("handles whitespace around pattern", () => {
      const result = parseRuleString("Bash( npm * )");
      expect(result.tool).toBe("Bash");
      expect(result.pattern).toBe("npm *");
    });

    it("handles pattern with special characters", () => {
      const result = parseRuleString("Bash(npm run build:prod)");
      expect(result.tool).toBe("Bash");
      expect(result.pattern).toBe("npm run build:prod");
    });

    it("returns frozen object", () => {
      const result = parseRuleString("file_read");
      expect(Object.isFrozen(result)).toBe(true);
    });
  });

  // -----------------------------------------------------------------------
  // formatRuleString
  // -----------------------------------------------------------------------

  describe("formatRuleString()", () => {
    it("formats 'Bash' with pattern 'npm *'", () => {
      expect(formatRuleString("Bash", "npm *")).toBe("Bash(npm *)");
    });

    it("formats 'file_read' without pattern", () => {
      expect(formatRuleString("file_read")).toBe("file_read");
    });

    it("formats 'Edit' with path pattern", () => {
      expect(formatRuleString("Edit", "/src/**")).toBe("Edit(/src/**)");
    });

    it("handles undefined pattern", () => {
      expect(formatRuleString("file_read", undefined)).toBe("file_read");
    });

    it("handles empty string pattern (treated as no pattern)", () => {
      expect(formatRuleString("file_read", "")).toBe("file_read");
    });

    it("roundtrips with parseRuleString", () => {
      const original = "Bash(npm run *)";
      const parsed = parseRuleString(original);
      const formatted = formatRuleString(parsed.tool, parsed.pattern);
      expect(formatted).toBe(original);
    });

    it("roundtrips simple tool name", () => {
      const original = "file_read";
      const parsed = parseRuleString(original);
      const formatted = formatRuleString(parsed.tool, parsed.pattern);
      expect(formatted).toBe(original);
    });
  });

  // -----------------------------------------------------------------------
  // matchToolArgs
  // -----------------------------------------------------------------------

  describe("matchToolArgs()", () => {
    describe("bash_exec / Bash — matches command arg", () => {
      it("matches 'npm *' against command 'npm install'", () => {
        expect(matchToolArgs("bash_exec", "npm *", { command: "npm install" })).toBe(true);
      });

      it("does not match 'npm *' against command 'yarn install'", () => {
        expect(matchToolArgs("bash_exec", "npm *", { command: "yarn install" })).toBe(false);
      });

      it("matches via Bash alias", () => {
        expect(matchToolArgs("Bash", "git *", { command: "git status" })).toBe(true);
      });
    });

    describe("file_edit / Edit — matches file_path arg", () => {
      it("matches '/src/**' against file_path '/src/foo.ts'", () => {
        expect(matchToolArgs("file_edit", "/src/**", { file_path: "/src/foo.ts" })).toBe(true);
      });

      it("does not match '/src/**' against file_path '/test/bar.ts'", () => {
        expect(matchToolArgs("file_edit", "/src/**", { file_path: "/test/bar.ts" })).toBe(false);
      });

      it("matches via Edit alias", () => {
        expect(matchToolArgs("Edit", "/src/**", { file_path: "/src/utils.ts" })).toBe(true);
      });
    });

    describe("file_read / Read — matches file_path arg", () => {
      it("matches path pattern", () => {
        expect(matchToolArgs("file_read", "/src/**", { file_path: "/src/index.ts" })).toBe(true);
      });

      it("does not match wrong path", () => {
        expect(matchToolArgs("file_read", "/src/**", { file_path: "/test/bar.ts" })).toBe(false);
      });

      it("matches via Read alias", () => {
        expect(matchToolArgs("Read", "*.ts", { file_path: "utils.ts" })).toBe(true);
      });
    });

    describe("file_write / Write — matches file_path arg", () => {
      it("matches path pattern", () => {
        expect(matchToolArgs("file_write", "/src/**", { file_path: "/src/new-file.ts" })).toBe(
          true,
        );
      });

      it("matches via Write alias", () => {
        expect(matchToolArgs("Write", "/src/**", { file_path: "/src/output.json" })).toBe(true);
      });
    });

    describe("glob_search / grep_search — matches pattern arg", () => {
      it("matches glob_search pattern", () => {
        expect(matchToolArgs("glob_search", "*.test.*", { pattern: "*.test.ts" })).toBe(true);
      });

      it("matches grep_search pattern", () => {
        expect(matchToolArgs("grep_search", "TODO*", { pattern: "TODO: fix" })).toBe(true);
      });
    });

    describe("edge cases", () => {
      it("returns false when args is undefined", () => {
        expect(matchToolArgs("bash_exec", "npm *", undefined)).toBe(false);
      });

      it("returns false when args is empty", () => {
        expect(matchToolArgs("bash_exec", "npm *", {})).toBe(false);
      });

      it("returns false when arg value is not a string", () => {
        expect(matchToolArgs("bash_exec", "npm *", { command: 123 })).toBe(false);
      });

      it("falls back to matching any string arg for unknown tools", () => {
        expect(matchToolArgs("custom_tool", "hello*", { data: "hello world" })).toBe(true);
      });

      it("fallback does not match non-string args", () => {
        expect(matchToolArgs("custom_tool", "hello*", { data: 42 })).toBe(false);
      });

      it("fallback returns false when no string args match", () => {
        expect(matchToolArgs("custom_tool", "hello*", { data: "goodbye world" })).toBe(false);
      });
    });
  });
});
