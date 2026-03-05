import { describe, it, expect } from "vitest";
import {
  buildLintFeedback,
  extractMutatedFiles,
  type AutoLintResult,
} from "../../../src/hooks/auto-lint.js";

describe("auto-lint", () => {
  describe("buildLintFeedback", () => {
    it("should return null when no errors", () => {
      const results: AutoLintResult[] = [{ filePath: "test.ts", lintOutput: "", hasErrors: false }];
      expect(buildLintFeedback(results)).toBeNull();
    });

    it("should build feedback for lint errors", () => {
      const results: AutoLintResult[] = [
        {
          filePath: "src/index.ts",
          lintOutput: "error: no-unused-vars",
          hasErrors: true,
        },
      ];
      const feedback = buildLintFeedback(results);
      expect(feedback).toContain("Auto-lint detected issues");
      expect(feedback).toContain("src/index.ts");
      expect(feedback).toContain("no-unused-vars");
    });

    it("should build feedback for test failures", () => {
      const results: AutoLintResult[] = [
        {
          filePath: "src/utils.ts",
          lintOutput: "",
          hasErrors: false,
          testOutput: "FAIL: expected true to be false",
          testFailed: true,
        },
      ];
      const feedback = buildLintFeedback(results);
      expect(feedback).toContain("Test failures");
      expect(feedback).toContain("FAIL");
    });

    it("should combine lint and test feedback", () => {
      const results: AutoLintResult[] = [
        {
          filePath: "src/a.ts",
          lintOutput: "lint error",
          hasErrors: true,
          testOutput: "test error",
          testFailed: true,
        },
      ];
      const feedback = buildLintFeedback(results);
      expect(feedback).toContain("Lint errors");
      expect(feedback).toContain("Test failures");
    });

    it("should handle empty results array", () => {
      expect(buildLintFeedback([])).toBeNull();
    });
  });

  describe("extractMutatedFiles", () => {
    it("should extract path from file_write result", () => {
      const result = {
        id: "1",
        name: "file_write",
        output: "Wrote src/test.ts",
        isError: false,
      };
      expect(extractMutatedFiles("file_write", result)).toBe("src/test.ts");
    });

    it("should extract path from file_edit result", () => {
      const result = {
        id: "2",
        name: "file_edit",
        output: "Edited src/main.ts successfully",
        isError: false,
      };
      expect(extractMutatedFiles("file_edit", result)).toBe("src/main.ts");
    });

    it("should return null for non-mutating tools", () => {
      const result = {
        id: "3",
        name: "file_read",
        output: "contents of file",
        isError: false,
      };
      expect(extractMutatedFiles("file_read", result)).toBeNull();
    });

    it("should return null for error results", () => {
      const result = {
        id: "4",
        name: "file_write",
        output: "Error: file not found",
        isError: true,
      };
      expect(extractMutatedFiles("file_write", result)).toBeNull();
    });
  });
});
