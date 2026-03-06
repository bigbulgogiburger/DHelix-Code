import { describe, it, expect } from "vitest";
import {
  buildLintFeedback,
  extractMutatedFiles,
  registerAutoLint,
  DEFAULT_AUTO_LINT_CONFIG,
  type AutoLintResult,
} from "../../../src/hooks/auto-lint.js";
import { createEventEmitter } from "../../../src/utils/events.js";
import { HookRunner } from "../../../src/hooks/runner.js";

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

    it("should fallback to file path pattern when no action verb", () => {
      const result = {
        id: "5",
        name: "file_write",
        output: "src/utils/helper.ts",
        isError: false,
      };
      expect(extractMutatedFiles("file_write", result)).toBe("src/utils/helper.ts");
    });

    it("should return null when no path extractable", () => {
      const result = {
        id: "6",
        name: "file_write",
        output: "ok",
        isError: false,
      };
      expect(extractMutatedFiles("file_write", result)).toBeNull();
    });
  });

  describe("registerAutoLint", () => {
    it("should emit lint:request on file_write tool:complete", () => {
      const events = createEventEmitter();
      const hookRunner = new HookRunner({});
      const lintRequests: unknown[] = [];

      events.on("lint:request", (data) => lintRequests.push(data));
      registerAutoLint(events, hookRunner);

      events.emit("tool:complete", { name: "file_write", id: "tc_1", isError: false });

      expect(lintRequests).toHaveLength(1);
      expect(lintRequests[0]).toEqual({
        toolName: "file_write",
        toolId: "tc_1",
        lintCommand: DEFAULT_AUTO_LINT_CONFIG.lintCommand,
        testCommand: undefined,
      });
    });

    it("should emit lint:request on file_edit tool:complete", () => {
      const events = createEventEmitter();
      const hookRunner = new HookRunner({});
      const lintRequests: unknown[] = [];

      events.on("lint:request", (data) => lintRequests.push(data));
      registerAutoLint(events, hookRunner);

      events.emit("tool:complete", { name: "file_edit", id: "tc_2", isError: false });

      expect(lintRequests).toHaveLength(1);
    });

    it("should not emit for non-file-mutating tools", () => {
      const events = createEventEmitter();
      const hookRunner = new HookRunner({});
      const lintRequests: unknown[] = [];

      events.on("lint:request", (data) => lintRequests.push(data));
      registerAutoLint(events, hookRunner);

      events.emit("tool:complete", { name: "file_read", id: "tc_3", isError: false });

      expect(lintRequests).toHaveLength(0);
    });

    it("should not emit for errored tool calls", () => {
      const events = createEventEmitter();
      const hookRunner = new HookRunner({});
      const lintRequests: unknown[] = [];

      events.on("lint:request", (data) => lintRequests.push(data));
      registerAutoLint(events, hookRunner);

      events.emit("tool:complete", { name: "file_write", id: "tc_4", isError: true });

      expect(lintRequests).toHaveLength(0);
    });

    it("should not register when disabled", () => {
      const events = createEventEmitter();
      const hookRunner = new HookRunner({});
      const lintRequests: unknown[] = [];

      events.on("lint:request", (data) => lintRequests.push(data));
      registerAutoLint(events, hookRunner, { ...DEFAULT_AUTO_LINT_CONFIG, enabled: false });

      events.emit("tool:complete", { name: "file_write", id: "tc_5", isError: false });

      expect(lintRequests).toHaveLength(0);
    });
  });
});
