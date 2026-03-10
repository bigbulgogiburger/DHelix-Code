import { describe, it, expect } from "vitest";
import {
  parsePermissionPattern,
  matchesPermissionPattern,
  PatternParseError,
} from "../../../src/permissions/pattern-parser.js";

describe("parsePermissionPattern", () => {
  it("should parse a bare tool name", () => {
    const result = parsePermissionPattern("Bash");
    expect(result.toolName).toBe("Bash");
    expect(result.argPattern).toBeUndefined();
  });

  it("should parse a tool name with underscore", () => {
    const result = parsePermissionPattern("file_read");
    expect(result.toolName).toBe("file_read");
    expect(result.argPattern).toBeUndefined();
  });

  it("should parse a tool name with argument glob", () => {
    const result = parsePermissionPattern("Bash(npm *)");
    expect(result.toolName).toBe("Bash");
    expect(result.argPattern).toBe("npm *");
  });

  it("should parse Edit with path glob", () => {
    const result = parsePermissionPattern("Edit(/src/**)");
    expect(result.toolName).toBe("Edit");
    expect(result.argPattern).toBe("/src/**");
  });

  it("should parse Bash with complex glob", () => {
    const result = parsePermissionPattern("Bash(git push *)");
    expect(result.toolName).toBe("Bash");
    expect(result.argPattern).toBe("git push *");
  });

  it("should trim whitespace from pattern", () => {
    const result = parsePermissionPattern("  Bash( npm * )  ");
    expect(result.toolName).toBe("Bash");
    expect(result.argPattern).toBe("npm *");
  });

  it("should throw on empty string", () => {
    expect(() => parsePermissionPattern("")).toThrow(PatternParseError);
    expect(() => parsePermissionPattern("  ")).toThrow(PatternParseError);
  });

  it("should throw on unmatched closing paren", () => {
    expect(() => parsePermissionPattern("Bash)")).toThrow(PatternParseError);
  });

  it("should throw on opening paren without closing", () => {
    expect(() => parsePermissionPattern("Bash(npm")).toThrow(PatternParseError);
  });

  it("should throw on empty tool name before parens", () => {
    expect(() => parsePermissionPattern("(npm *)")).toThrow(PatternParseError);
  });

  it("should throw on empty argument pattern in parens", () => {
    expect(() => parsePermissionPattern("Bash()")).toThrow(PatternParseError);
  });

  it("should throw with PatternParseError subclass of BaseError", () => {
    try {
      parsePermissionPattern("");
    } catch (error) {
      expect(error).toBeInstanceOf(PatternParseError);
      expect((error as PatternParseError).code).toBe("PATTERN_PARSE_ERROR");
    }
  });
});

describe("matchesPermissionPattern", () => {
  describe("tool-name-only patterns", () => {
    it("should match exact tool name", () => {
      const pattern = parsePermissionPattern("Bash");
      expect(matchesPermissionPattern(pattern, "Bash")).toBe(true);
    });

    it("should not match different tool name", () => {
      const pattern = parsePermissionPattern("Bash");
      expect(matchesPermissionPattern(pattern, "Edit")).toBe(false);
    });

    it("should match with wildcard tool name", () => {
      const pattern = parsePermissionPattern("file_*");
      expect(matchesPermissionPattern(pattern, "file_read")).toBe(true);
      expect(matchesPermissionPattern(pattern, "file_write")).toBe(true);
      expect(matchesPermissionPattern(pattern, "bash_exec")).toBe(false);
    });

    it("should match tool name regardless of args", () => {
      const pattern = parsePermissionPattern("Bash");
      expect(matchesPermissionPattern(pattern, "Bash", { command: "ls" })).toBe(true);
      expect(matchesPermissionPattern(pattern, "Bash", {})).toBe(true);
      expect(matchesPermissionPattern(pattern, "Bash")).toBe(true);
    });
  });

  describe("tool-name with argument pattern", () => {
    it("should match when string arg matches glob", () => {
      const pattern = parsePermissionPattern("Bash(npm *)");
      expect(matchesPermissionPattern(pattern, "Bash", { command: "npm install" })).toBe(true);
      expect(matchesPermissionPattern(pattern, "Bash", { command: "npm test" })).toBe(true);
    });

    it("should not match when arg does not match glob", () => {
      const pattern = parsePermissionPattern("Bash(npm *)");
      expect(matchesPermissionPattern(pattern, "Bash", { command: "yarn install" })).toBe(false);
    });

    it("should not match when no args provided", () => {
      const pattern = parsePermissionPattern("Bash(npm *)");
      expect(matchesPermissionPattern(pattern, "Bash")).toBe(false);
      expect(matchesPermissionPattern(pattern, "Bash", {})).toBe(false);
    });

    it("should match path globs with **", () => {
      const pattern = parsePermissionPattern("Edit(/src/**)");
      expect(matchesPermissionPattern(pattern, "Edit", { path: "/src/foo.ts" })).toBe(true);
      expect(matchesPermissionPattern(pattern, "Edit", { path: "/src/a/b/c.ts" })).toBe(true);
      expect(matchesPermissionPattern(pattern, "Edit", { path: "/test/foo.ts" })).toBe(false);
    });

    it("should match path globs with * (matches any chars including /)", () => {
      const pattern = parsePermissionPattern("Edit(/src/*.ts)");
      expect(matchesPermissionPattern(pattern, "Edit", { path: "/src/foo.ts" })).toBe(true);
      // * matches any characters including path separators (consistent with rules.ts)
      expect(matchesPermissionPattern(pattern, "Edit", { path: "/src/a/foo.ts" })).toBe(true);
    });

    it("should match ? as single character", () => {
      const pattern = parsePermissionPattern("Bash(npm ?)");
      expect(matchesPermissionPattern(pattern, "Bash", { command: "npm i" })).toBe(true);
      expect(matchesPermissionPattern(pattern, "Bash", { command: "npm install" })).toBe(false);
    });

    it("should check all string args for match", () => {
      const pattern = parsePermissionPattern("Bash(npm *)");
      // The pattern should match against any string argument value
      expect(
        matchesPermissionPattern(pattern, "Bash", {
          timeout: 5000,
          command: "npm install",
          flag: true,
        }),
      ).toBe(true);
    });

    it("should not match non-string args", () => {
      const pattern = parsePermissionPattern("Bash(npm *)");
      expect(matchesPermissionPattern(pattern, "Bash", { count: 42 })).toBe(false);
    });

    it("should match rm -rf pattern for deny rules", () => {
      const pattern = parsePermissionPattern("Bash(rm -rf *)");
      expect(matchesPermissionPattern(pattern, "Bash", { command: "rm -rf /" })).toBe(true);
      expect(matchesPermissionPattern(pattern, "Bash", { command: "rm -rf /home" })).toBe(true);
      expect(matchesPermissionPattern(pattern, "Bash", { command: "rm file.txt" })).toBe(false);
    });

    it("should not match when tool name does not match", () => {
      const pattern = parsePermissionPattern("Bash(npm *)");
      expect(matchesPermissionPattern(pattern, "Edit", { command: "npm install" })).toBe(false);
    });
  });
});
