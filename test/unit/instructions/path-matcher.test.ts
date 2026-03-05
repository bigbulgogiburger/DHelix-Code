import { describe, it, expect } from "vitest";
import {
  matchPath,
  filterMatchingRules,
  collectMatchingContent,
  type PathRule,
} from "../../../src/instructions/path-matcher.js";

describe("path-matcher", () => {
  describe("matchPath", () => {
    it("should match exact paths", () => {
      expect(matchPath("src/index.ts", "src/index.ts")).toBe(true);
    });

    it("should match single wildcard", () => {
      expect(matchPath("src/index.ts", "src/*.ts")).toBe(true);
      expect(matchPath("src/utils/path.ts", "src/*.ts")).toBe(false);
    });

    it("should match double wildcard", () => {
      expect(matchPath("src/utils/path.ts", "src/**/*.ts")).toBe(true);
      expect(matchPath("src/deep/nested/file.ts", "src/**/*.ts")).toBe(true);
    });

    it("should match question mark", () => {
      expect(matchPath("src/a.ts", "src/?.ts")).toBe(true);
      expect(matchPath("src/ab.ts", "src/?.ts")).toBe(false);
    });

    it("should normalize backslashes", () => {
      expect(matchPath("src\\utils\\path.ts", "src/**/*.ts")).toBe(true);
    });

    it("should not match different extensions", () => {
      expect(matchPath("src/file.js", "src/*.ts")).toBe(false);
    });
  });

  describe("filterMatchingRules", () => {
    const rules: PathRule[] = [
      { pattern: "src/**/*.ts", content: "TypeScript rule" },
      { pattern: "test/**/*.test.ts", content: "Test rule" },
      { pattern: "*.json", content: "JSON rule" },
    ];

    it("should filter matching rules", () => {
      const matched = filterMatchingRules(rules, "src/index.ts");
      expect(matched).toHaveLength(1);
      expect(matched[0].content).toBe("TypeScript rule");
    });

    it("should return empty for no matches", () => {
      const matched = filterMatchingRules(rules, "README.md");
      expect(matched).toHaveLength(0);
    });

    it("should match multiple rules", () => {
      const matched = filterMatchingRules(
        [
          { pattern: "**/*.ts", content: "All TS" },
          { pattern: "src/**", content: "All src" },
        ],
        "src/index.ts",
      );
      expect(matched).toHaveLength(2);
    });
  });

  describe("collectMatchingContent", () => {
    it("should join matching content", () => {
      const rules: PathRule[] = [
        { pattern: "**/*.ts", content: "Rule A" },
        { pattern: "**/*.ts", content: "Rule B" },
      ];
      const content = collectMatchingContent(rules, "test.ts");
      expect(content).toContain("Rule A");
      expect(content).toContain("Rule B");
    });

    it("should return empty for no matches", () => {
      const rules: PathRule[] = [{ pattern: "*.py", content: "Python rule" }];
      expect(collectMatchingContent(rules, "test.ts")).toBe("");
    });
  });
});
