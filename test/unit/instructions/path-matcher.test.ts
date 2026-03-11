import { describe, it, expect } from "vitest";
import {
  matchPath,
  matchAnyPattern,
  filterMatchingRules,
  collectMatchingContent,
  normalizeLegacyRule,
  type PathRule,
  type LegacyPathRule,
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

  describe("matchAnyPattern", () => {
    it("should return true if any pattern matches", () => {
      expect(matchAnyPattern("src/api/handler.ts", ["src/api/**", "src/routes/**"])).toBe(true);
    });

    it("should return true for second pattern match", () => {
      expect(matchAnyPattern("src/routes/index.ts", ["src/api/**", "src/routes/**"])).toBe(true);
    });

    it("should return false if no patterns match", () => {
      expect(matchAnyPattern("src/utils/path.ts", ["src/api/**", "src/routes/**"])).toBe(false);
    });

    it("should return false for empty patterns array", () => {
      expect(matchAnyPattern("src/index.ts", [])).toBe(false);
    });

    it("should match with single pattern in array", () => {
      expect(matchAnyPattern("src/index.ts", ["src/**"])).toBe(true);
    });

    it("should handle mixed pattern types", () => {
      expect(
        matchAnyPattern("lib/handlers/auth.ts", ["src/api/**", "src/routes/**", "lib/handlers/**"]),
      ).toBe(true);
    });
  });

  describe("normalizeLegacyRule", () => {
    it("should convert a single pattern rule to multi-pattern", () => {
      const legacy: LegacyPathRule = {
        pattern: "src/**/*.ts",
        content: "TypeScript rule",
        description: "ts-rule",
      };
      const normalized = normalizeLegacyRule(legacy);
      expect(normalized.patterns).toEqual(["src/**/*.ts"]);
      expect(normalized.content).toBe("TypeScript rule");
      expect(normalized.description).toBe("ts-rule");
    });

    it("should preserve undefined description", () => {
      const legacy: LegacyPathRule = {
        pattern: "**",
        content: "Global rule",
      };
      const normalized = normalizeLegacyRule(legacy);
      expect(normalized.description).toBeUndefined();
    });
  });

  describe("filterMatchingRules", () => {
    it("should filter rules with single pattern in patterns array", () => {
      const rules: PathRule[] = [
        { patterns: ["src/**/*.ts"], content: "TypeScript rule" },
        { patterns: ["test/**/*.test.ts"], content: "Test rule" },
        { patterns: ["*.json"], content: "JSON rule" },
      ];

      const matched = filterMatchingRules(rules, "src/index.ts");
      expect(matched).toHaveLength(1);
      expect(matched[0].content).toBe("TypeScript rule");
    });

    it("should return empty for no matches", () => {
      const rules: PathRule[] = [{ patterns: ["src/**/*.ts"], content: "TypeScript rule" }];
      const matched = filterMatchingRules(rules, "README.md");
      expect(matched).toHaveLength(0);
    });

    it("should match multiple rules", () => {
      const matched = filterMatchingRules(
        [
          { patterns: ["**/*.ts"], content: "All TS" },
          { patterns: ["src/**"], content: "All src" },
        ],
        "src/index.ts",
      );
      expect(matched).toHaveLength(2);
    });

    it("should match rule with multiple patterns (multi-glob)", () => {
      const rules: PathRule[] = [
        {
          patterns: ["src/api/**", "src/routes/**", "lib/handlers/**"],
          content: "API Guidelines",
          description: "api-rules",
        },
      ];

      // Matches first pattern
      expect(filterMatchingRules(rules, "src/api/users.ts")).toHaveLength(1);
      // Matches second pattern
      expect(filterMatchingRules(rules, "src/routes/index.ts")).toHaveLength(1);
      // Matches third pattern
      expect(filterMatchingRules(rules, "lib/handlers/auth.ts")).toHaveLength(1);
      // Matches none
      expect(filterMatchingRules(rules, "src/utils/path.ts")).toHaveLength(0);
    });

    it("should handle mix of single and multi-pattern rules", () => {
      const rules: PathRule[] = [
        { patterns: ["src/**/*.ts"], content: "TypeScript rule" },
        { patterns: ["src/api/**", "lib/api/**"], content: "API rule" },
      ];

      const matched = filterMatchingRules(rules, "src/api/handler.ts");
      expect(matched).toHaveLength(2);
      expect(matched.map((r) => r.content)).toContain("TypeScript rule");
      expect(matched.map((r) => r.content)).toContain("API rule");
    });
  });

  describe("collectMatchingContent", () => {
    it("should join matching content", () => {
      const rules: PathRule[] = [
        { patterns: ["**/*.ts"], content: "Rule A" },
        { patterns: ["**/*.ts"], content: "Rule B" },
      ];
      const content = collectMatchingContent(rules, "test.ts");
      expect(content).toContain("Rule A");
      expect(content).toContain("Rule B");
    });

    it("should return empty for no matches", () => {
      const rules: PathRule[] = [{ patterns: ["*.py"], content: "Python rule" }];
      expect(collectMatchingContent(rules, "test.ts")).toBe("");
    });

    it("should collect content from multi-glob rules", () => {
      const rules: PathRule[] = [
        {
          patterns: ["src/api/**", "src/routes/**"],
          content: "REST conventions",
        },
        {
          patterns: ["src/**/*.test.ts"],
          content: "Test conventions",
        },
      ];

      const content = collectMatchingContent(rules, "src/api/users.ts");
      expect(content).toContain("REST conventions");
      expect(content).not.toContain("Test conventions");
    });
  });
});
