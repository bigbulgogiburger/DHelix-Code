import { describe, it, expect } from "vitest";
import {
  getToolDisplayText,
  getToolStatusIcon,
  getToolPreview,
  formatDuration,
  SPINNER_FRAMES,
  SPINNER_INTERVAL_MS,
} from "../../../../src/cli/renderer/tool-display.js";

describe("tool-display", () => {
  describe("formatDuration", () => {
    it("should format sub-second durations in ms", () => {
      expect(formatDuration(50)).toBe("50ms");
      expect(formatDuration(999)).toBe("999ms");
    });

    it("should format seconds with one decimal", () => {
      expect(formatDuration(1000)).toBe("1.0s");
      expect(formatDuration(1500)).toBe("1.5s");
      expect(formatDuration(3200)).toBe("3.2s");
      expect(formatDuration(59999)).toBe("60.0s");
    });

    it("should format minutes and seconds", () => {
      expect(formatDuration(60_000)).toBe("1m 0s");
      expect(formatDuration(65_000)).toBe("1m 5s");
      expect(formatDuration(90_000)).toBe("1m 30s");
      expect(formatDuration(120_000)).toBe("2m 0s");
      expect(formatDuration(125_000)).toBe("2m 5s");
    });

    it("should round ms values", () => {
      expect(formatDuration(0.7)).toBe("1ms");
      expect(formatDuration(0)).toBe("0ms");
    });
  });

  describe("getToolDisplayText", () => {
    it("should return formatted name for unknown tools", () => {
      expect(getToolDisplayText("unknown_tool", "running")).toBe("Running unknown_tool");
      expect(getToolDisplayText("unknown_tool", "complete")).toBe("Completed unknown_tool");
    });

    it("should append duration for completed unknown tools", () => {
      expect(getToolDisplayText("custom_tool", "complete", undefined, undefined, 250)).toBe(
        "Completed custom_tool (250ms)",
      );
    });

    it("should show running for unknown tools without duration", () => {
      expect(getToolDisplayText("custom_tool", "running")).toBe("Running custom_tool");
    });

    it("should not append duration when running", () => {
      expect(
        getToolDisplayText("file_read", "running", { file_path: "/a.ts" }, undefined, 1500),
      ).toBe("Reading /a.ts");
    });

    it("should not append duration when undefined", () => {
      expect(getToolDisplayText("file_read", "complete", { file_path: "/a.ts" })).toBe(
        "Read /a.ts",
      );
    });

    describe("file_read", () => {
      it("should show 'Reading' when running with file path", () => {
        expect(getToolDisplayText("file_read", "running", { file_path: "/src/index.ts" })).toBe(
          "Reading /src/index.ts",
        );
      });

      it("should show 'Read' when complete with file path", () => {
        expect(getToolDisplayText("file_read", "complete", { file_path: "/src/index.ts" })).toBe(
          "Read /src/index.ts",
        );
      });

      it("should show verb only when no args", () => {
        expect(getToolDisplayText("file_read", "running")).toBe("Reading");
      });

      it("should show totalLines from metadata", () => {
        const result = getToolDisplayText(
          "file_read",
          "complete",
          { file_path: "src/index.ts" },
          "line1\nline2",
          10,
          { path: "src/index.ts", totalLines: 237 },
        );
        expect(result).toContain("src/index.ts");
        expect(result).toContain("237 lines");
        expect(result).toContain("10ms");
      });

      it("should show line range when offset is specified via metadata", () => {
        const result = getToolDisplayText(
          "file_read",
          "complete",
          { file_path: "src/big.ts", offset: 100, limit: 50 },
          "content",
          undefined,
          { path: "src/big.ts", totalLines: 500, readFrom: 100, readTo: 150 },
        );
        expect(result).toContain("lines 100-150");
        expect(result).toContain("500");
      });

      it("should show image type from metadata", () => {
        const result = getToolDisplayText(
          "file_read",
          "complete",
          { file_path: "logo.png" },
          "[Image]",
          undefined,
          { path: "logo.png", type: "image" },
        );
        expect(result).toContain("image");
      });

      it("should show PDF type with pages from metadata", () => {
        const result = getToolDisplayText(
          "file_read",
          "complete",
          { file_path: "doc.pdf" },
          "content",
          undefined,
          { path: "doc.pdf", type: "pdf", totalPages: 47 },
        );
        expect(result).toContain("PDF");
        expect(result).toContain("47 pages");
      });

      it("should show notebook type with cells from metadata", () => {
        const result = getToolDisplayText(
          "file_read",
          "complete",
          { file_path: "analysis.ipynb" },
          "content",
          undefined,
          { path: "analysis.ipynb", type: "notebook", cellCount: 12 },
        );
        expect(result).toContain("notebook");
        expect(result).toContain("12 cells");
      });

      it("should show running status without metadata", () => {
        const result = getToolDisplayText("file_read", "running", {
          file_path: "src/index.ts",
        });
        expect(result).toContain("Reading");
        expect(result).toContain("src/index.ts");
      });

      it("should fallback to output line counting without metadata", () => {
        const result = getToolDisplayText(
          "file_read",
          "complete",
          { file_path: "/src/index.ts" },
          "line1\nline2\nline3\n",
        );
        expect(result).toContain("3 lines");
      });

      it("should prefer metadata path over args file_path", () => {
        const result = getToolDisplayText(
          "file_read",
          "complete",
          { file_path: "wrong/path.ts" },
          "content",
          undefined,
          { path: "correct/path.ts", totalLines: 10 },
        );
        expect(result).toContain("correct/path.ts");
      });

      it("should shorten long file paths", () => {
        const longPath = "src/very/deeply/nested/directory/structure/that/is/way/too/long/file.ts";
        const result = getToolDisplayText(
          "file_read",
          "complete",
          { file_path: longPath },
          "content",
        );
        // Should be shortened with ellipsis
        expect(result).toContain("file.ts");
      });
    });

    describe("file_write", () => {
      it("should show 'Writing' when running", () => {
        expect(getToolDisplayText("file_write", "running", { file_path: "/out.ts" })).toBe(
          "Writing /out.ts",
        );
      });

      it("should show 'Wrote' when complete with line count from metadata", () => {
        expect(
          getToolDisplayText(
            "file_write",
            "complete",
            { file_path: "/out.ts" },
            undefined,
            undefined,
            { path: "/out.ts", lineCount: 42 },
          ),
        ).toBe("Wrote /out.ts \u2014 42 lines");
      });

      it("should show lineCount from metadata with duration", () => {
        const result = getToolDisplayText(
          "file_write",
          "complete",
          { file_path: "output.ts" },
          "wrote",
          35000,
          { path: "output.ts", lineCount: 303 },
        );
        expect(result).toContain("output.ts");
        expect(result).toContain("303 lines");
        expect(result).toContain("35.0s");
      });

      it("should fallback to counting content lines without metadata", () => {
        expect(
          getToolDisplayText("file_write", "complete", {
            file_path: "/out.ts",
            content: "hello",
          }),
        ).toBe("Wrote /out.ts \u2014 1 lines");
      });

      it("should fallback to counting multi-line content", () => {
        const content = "line1\nline2\nline3";
        expect(
          getToolDisplayText("file_write", "complete", { file_path: "/out.ts", content }),
        ).toBe("Wrote /out.ts \u2014 3 lines");
      });

      it("should show just the path when no content or metadata", () => {
        const result = getToolDisplayText("file_write", "complete", {
          file_path: "output.ts",
        });
        expect(result).toContain("output.ts");
      });
    });

    describe("file_edit", () => {
      it("should show 'Editing' when running", () => {
        expect(getToolDisplayText("file_edit", "running", { file_path: "/a.ts" })).toBe(
          "Editing /a.ts",
        );
      });

      it("should show 'Edited' when complete with no old/new_string", () => {
        expect(getToolDisplayText("file_edit", "complete", { file_path: "/a.ts" })).toBe(
          "Edited /a.ts",
        );
      });

      it("should show +/- line counts from metadata", () => {
        const result = getToolDisplayText(
          "file_edit",
          "complete",
          { file_path: "src/core/activity.ts" },
          "success",
          800,
          { path: "src/core/activity.ts", linesAdded: 2, linesRemoved: 3 },
        );
        expect(result).toContain("(+2 -3)");
        expect(result).toContain("800ms");
      });

      it("should show change summary when complete with old/new_string and no metadata", () => {
        expect(
          getToolDisplayText("file_edit", "complete", {
            file_path: "/a.ts",
            old_string: "const a = 1;",
            new_string: "const a = 2;\nconst b = 3;\nconst c = 4;",
          }),
        ).toBe("Edited /a.ts \u2014 Added 3 lines, removed 1 line");
      });

      it("should show 'replace all' when replace_all is true and no metadata", () => {
        expect(
          getToolDisplayText("file_edit", "complete", { file_path: "/a.ts", replace_all: true }),
        ).toBe("Edited /a.ts (replace all)");
      });

      it("should prefer metadata over args for path", () => {
        const result = getToolDisplayText(
          "file_edit",
          "complete",
          { file_path: "wrong.ts" },
          "ok",
          100,
          { path: "correct.ts", linesAdded: 1, linesRemoved: 0 },
        );
        expect(result).toContain("correct.ts");
      });
    });

    describe("bash_exec", () => {
      it("should show 'Running' with command", () => {
        expect(getToolDisplayText("bash_exec", "running", { command: "npm test" })).toBe(
          "Running npm test",
        );
      });

      it("should show 'Ran' when complete", () => {
        expect(getToolDisplayText("bash_exec", "complete", { command: "npm test" })).toBe(
          "Ran npm test",
        );
      });

      it("should show command and exit code from metadata", () => {
        const result = getToolDisplayText(
          "bash_exec",
          "complete",
          { command: "npm test" },
          "passed",
          3200,
          { exitCode: 0, command: "npm test" },
        );
        expect(result).toContain("npm test");
        expect(result).toContain("exit 0");
        expect(result).toContain("3.2s");
      });

      it("should show non-zero exit code from metadata", () => {
        const result = getToolDisplayText(
          "bash_exec",
          "complete",
          { command: "tsc --noEmit" },
          "error",
          5100,
          { exitCode: 1, command: "tsc --noEmit" },
        );
        expect(result).toContain("exit 1");
      });

      it("should truncate commands longer than 80 chars", () => {
        const longCmd = "a".repeat(90);
        const result = getToolDisplayText("bash_exec", "running", { command: longCmd });
        expect(result).toBe("Running " + "a".repeat(77) + "\u2026");
      });

      it("should show multi-line command count", () => {
        const cmd = "echo line1\necho line2\necho line3";
        const result = getToolDisplayText("bash_exec", "running", { command: cmd });
        expect(result).toBe("Running echo line1 (+2 lines)");
      });

      it("should show verb only when no command arg", () => {
        expect(getToolDisplayText("bash_exec", "running", {})).toBe("Running");
      });
    });

    describe("grep_search", () => {
      it("should show pattern when running", () => {
        expect(getToolDisplayText("grep_search", "running", { pattern: "TODO" })).toBe(
          'Searching "TODO"',
        );
      });

      it("should show pattern, path, and match count from metadata", () => {
        const result = getToolDisplayText(
          "grep_search",
          "complete",
          { pattern: "copilot", path: "src/" },
          "match1",
          43,
          { matchCount: 4, pattern: "copilot" },
        );
        expect(result).toContain('"copilot"');
        expect(result).toContain("src/");
        expect(result).toContain("4 match");
      });

      it("should show zero matches from metadata", () => {
        const result = getToolDisplayText(
          "grep_search",
          "complete",
          { pattern: "nonexistent" },
          "",
          5,
          { matchCount: 0, pattern: "nonexistent" },
        );
        expect(result).toContain("0 match");
      });

      it("should show singular match for one result from metadata", () => {
        const result = getToolDisplayText(
          "grep_search",
          "complete",
          { pattern: "unique" },
          "one line",
          10,
          { matchCount: 1, pattern: "unique" },
        );
        expect(result).toContain("1 match");
        // Should not say "matches" (plural) for 1
        expect(result).not.toContain("1 matches");
      });

      it("should fallback to output counting without metadata", () => {
        expect(
          getToolDisplayText("grep_search", "complete", { pattern: "TODO" }, "line1\nline2"),
        ).toBe('Searched "TODO" \u2014 2 results');
      });
    });

    describe("glob_search", () => {
      it("should show pattern when running", () => {
        expect(getToolDisplayText("glob_search", "running", { pattern: "**/*.ts" })).toBe(
          'Searching files "**/*.ts"',
        );
      });

      it("should show pattern and file count from metadata", () => {
        const result = getToolDisplayText(
          "glob_search",
          "complete",
          { pattern: "**/*.test.ts" },
          "file1\nfile2",
          8,
          { count: 24, pattern: "**/*.test.ts" },
        );
        expect(result).toContain("24 files");
        expect(result).toContain('"**/*.test.ts"');
      });

      it("should show singular file for count of 1 from metadata", () => {
        const result = getToolDisplayText(
          "glob_search",
          "complete",
          { pattern: "*.md" },
          "README.md",
          5,
          { count: 1, pattern: "*.md" },
        );
        expect(result).toContain("1 file ");
        expect(result).not.toContain("1 files");
      });

      it("should fallback to output file counting without metadata", () => {
        const output = "file1.ts\nfile2.ts\nfile3.ts";
        expect(getToolDisplayText("glob_search", "complete", { pattern: "**/*.ts" }, output)).toBe(
          'Found 3 files matching "**/*.ts"',
        );
      });

      it("should show singular 'file' for one result in fallback", () => {
        expect(getToolDisplayText("glob_search", "complete", { pattern: "*.md" }, "file1.ts")).toBe(
          'Found 1 file matching "*.md"',
        );
      });
    });

    describe("list_dir", () => {
      it("should show directory path and entry count from metadata", () => {
        const result = getToolDisplayText(
          "list_dir",
          "complete",
          { path: "src/commands/" },
          "file1\nfile2\nfile3",
          6,
          { path: "src/commands/", entryCount: 12 },
        );
        expect(result).toContain("src/commands/");
        expect(result).toContain("12 entries");
      });

      it("should fallback to output line counting without metadata", () => {
        const result = getToolDisplayText(
          "list_dir",
          "complete",
          { path: "src/" },
          "file1\nfile2\nfile3",
        );
        expect(result).toContain("src/");
        expect(result).toContain("3 entries");
      });

      it("should show path only when no output and no metadata", () => {
        const result = getToolDisplayText("list_dir", "complete", { path: "src/" });
        expect(result).toContain("src/");
      });
    });

    describe("web_fetch", () => {
      it("should show URL and KB size for larger output", () => {
        const result = getToolDisplayText(
          "web_fetch",
          "complete",
          { url: "https://api.example.com/docs" },
          "x".repeat(2400),
          1200,
          { url: "https://api.example.com/docs" },
        );
        expect(result).toContain("api.example.com");
        expect(result).toContain("KB");
      });

      it("should show bytes for small content", () => {
        const result = getToolDisplayText(
          "web_fetch",
          "complete",
          { url: "https://example.com" },
          "hi",
          50,
          { url: "https://example.com" },
        );
        expect(result).toContain("B");
      });

      it("should truncate long URLs", () => {
        const longUrl = "https://example.com/" + "a".repeat(80);
        const result = getToolDisplayText(
          "web_fetch",
          "complete",
          { url: longUrl },
          "content",
          100,
          { url: longUrl },
        );
        expect(result).toContain("\u2026");
      });

      it("should show just URL when no output", () => {
        const result = getToolDisplayText(
          "web_fetch",
          "complete",
          { url: "https://example.com" },
          undefined,
          100,
          { url: "https://example.com" },
        );
        expect(result).toContain("example.com");
      });
    });

    describe("web_search", () => {
      it("should show query and result count from metadata", () => {
        const result = getToolDisplayText(
          "web_search",
          "complete",
          { query: "gpt-5 tokenizer" },
          "result1\nresult2",
          800,
          { query: "gpt-5 tokenizer", resultCount: 8 },
        );
        expect(result).toContain('"gpt-5 tokenizer"');
        expect(result).toContain("8 results");
      });

      it("should show singular result for count of 1 from metadata", () => {
        const result = getToolDisplayText(
          "web_search",
          "complete",
          { query: "unique query" },
          "one result",
          100,
          { resultCount: 1, query: "unique query" },
        );
        expect(result).toContain("1 result");
        expect(result).not.toContain("1 results");
      });

      it("should fallback to output counting without metadata", () => {
        const result = getToolDisplayText(
          "web_search",
          "complete",
          { query: "test query" },
          "result1\nresult2\nresult3",
        );
        expect(result).toContain("3 results");
      });
    });

    describe("agent", () => {
      it("should show agent type and description from metadata", () => {
        const result = getToolDisplayText(
          "agent",
          "complete",
          { description: "analyze codebase", type: "explore" },
          "done",
          5000,
          { type: "explore" },
        );
        expect(result).toContain("explore");
        expect(result).toContain("analyze codebase");
      });

      it("should show description only when no type metadata", () => {
        const result = getToolDisplayText(
          "agent",
          "complete",
          { description: "run analysis" },
          "done",
          1000,
        );
        expect(result).toContain("run analysis");
      });

      it("should show type from args when no metadata", () => {
        const result = getToolDisplayText(
          "agent",
          "complete",
          { description: "plan feature", type: "plan" },
          "done",
          2000,
        );
        expect(result).toContain("plan");
        expect(result).toContain("plan feature");
      });
    });

    describe("todo_write", () => {
      it("should show completion status from metadata", () => {
        const result = getToolDisplayText("todo_write", "complete", {}, "tasks", 100, {
          total: 5,
          completed: 3,
        });
        expect(result).toContain("3/5");
      });

      it("should show verb only when no metadata", () => {
        const result = getToolDisplayText("todo_write", "complete", {}, "tasks", 50);
        expect(result).toBe("Updated tasks (50ms)");
      });

      it("should show 'Updating tasks' when running", () => {
        const result = getToolDisplayText("todo_write", "running");
        expect(result).toBe("Updating tasks");
      });
    });

    describe("mkdir", () => {
      it("should show 'Creating directory' when running", () => {
        expect(getToolDisplayText("mkdir", "running", { path: "/src/new" })).toBe(
          "Creating directory /src/new",
        );
      });

      it("should show 'Created directory' when complete", () => {
        expect(getToolDisplayText("mkdir", "complete", { path: "/src/new" })).toBe(
          "Created directory /src/new",
        );
      });
    });

    describe("ask_user", () => {
      it("should show question text", () => {
        const result = getToolDisplayText("ask_user", "running", {
          question: "What model do you want?",
        });
        expect(result).toContain("What model do you want?");
      });

      it("should truncate long questions", () => {
        const longQuestion = "A".repeat(80);
        const result = getToolDisplayText("ask_user", "running", { question: longQuestion });
        expect(result).toContain("\u2026");
      });
    });

    describe("notebook_edit", () => {
      it("should show file path when editing", () => {
        const result = getToolDisplayText("notebook_edit", "running", {
          file_path: "analysis.ipynb",
        });
        expect(result).toContain("analysis.ipynb");
      });
    });

    describe("duration appended to completed tools", () => {
      it("should append duration for completed known tools", () => {
        expect(
          getToolDisplayText("file_read", "complete", { file_path: "/a.ts" }, undefined, 1500),
        ).toBe("Read /a.ts (1.5s)");
      });

      it("should append duration for completed unknown tools", () => {
        expect(getToolDisplayText("custom_tool", "complete", undefined, undefined, 250)).toBe(
          "Completed custom_tool (250ms)",
        );
      });
    });
  });

  describe("getToolPreview", () => {
    it("should return diff preview for file_edit when complete with line numbers", () => {
      const preview = getToolPreview("file_edit", "complete", {
        old_string: "const a = 1;",
        new_string: "const a = 2;",
      });
      expect(preview).toContain("- const a = 1;");
      expect(preview).toContain("+ const a = 2;");
      // Should contain line numbers
      expect(preview).toMatch(/\d+\s+-/);
      expect(preview).toMatch(/\d+\s+\+/);
    });

    it("should use _lineNumber from args for line numbering", () => {
      const preview = getToolPreview("file_edit", "complete", {
        old_string: "const a = 1;",
        new_string: "const a = 2;",
        _lineNumber: 42,
      });
      expect(preview).toContain("42 - const a = 1;");
      expect(preview).toContain("42 + const a = 2;");
    });

    it("should render context lines when _contextLines and _contextStartLine are provided", () => {
      const preview = getToolPreview("file_edit", "complete", {
        old_string: "const a = 1;",
        new_string: "const a = 2;\nconst b = 3;",
        _lineNumber: 5,
        _contextLines: [
          "import foo;",
          "import bar;",
          "// setup",
          "const a = 2;",
          "const b = 3;",
          "return a;",
          "return b;",
          "}",
        ],
        _contextStartLine: 2,
      });
      // Before context (lines 2-4)
      expect(preview).toContain("   2   import foo;");
      expect(preview).toContain("   3   import bar;");
      expect(preview).toContain("   4   // setup");
      // Removed line
      expect(preview).toContain("   5 - const a = 1;");
      // Added lines
      expect(preview).toContain("   5 + const a = 2;");
      expect(preview).toContain("   6 + const b = 3;");
      // After context (lines 7-9)
      expect(preview).toContain("   7   return a;");
      expect(preview).toContain("   8   return b;");
      expect(preview).toContain("   9   }");
    });

    it("should return diff preview for file_edit with _lineNumber", () => {
      const preview = getToolPreview("file_edit", "complete", {
        old_string: "old line",
        new_string: "new line",
        _lineNumber: 10,
      });
      expect(preview).toBeDefined();
      expect(preview).toContain("-");
      expect(preview).toContain("+");
    });

    it("should return undefined for file_edit when running", () => {
      const preview = getToolPreview("file_edit", "running", {
        old_string: "old",
        new_string: "new",
      });
      expect(preview).toBeUndefined();
    });

    it("should return output preview for bash_exec when complete", () => {
      const preview = getToolPreview(
        "bash_exec",
        "complete",
        { command: "echo test" },
        "test output line 1\nline 2\nline 3",
      );
      expect(preview).toBeDefined();
      expect(preview).toContain("test output line 1");
    });

    it("should return undefined for bash_exec when running", () => {
      const preview = getToolPreview("bash_exec", "running", { command: "echo test" }, undefined);
      expect(preview).toBeUndefined();
    });

    it("should truncate long bash output to 5 lines", () => {
      const output = Array.from({ length: 20 }, (_, i) => `line${i}`).join("\n");
      const preview = getToolPreview("bash_exec", "complete", {}, output);
      expect(preview).toContain("more lines");
    });

    it("should return undefined for tools without preview", () => {
      expect(
        getToolPreview("file_read", "complete", { file_path: "test.ts" }, "content"),
      ).toBeUndefined();
      expect(getToolPreview("file_write", "complete")).toBeUndefined();
      expect(getToolPreview("glob_search", "complete")).toBeUndefined();
      expect(getToolPreview("grep_search", "complete")).toBeUndefined();
      expect(getToolPreview("file_read", "complete")).toBeUndefined();
    });

    it("should return undefined for file_edit with no old/new strings", () => {
      const preview = getToolPreview("file_edit", "complete", { file_path: "test.ts" });
      expect(preview).toBeUndefined();
    });

    it("should handle file_edit with only new_string (insert)", () => {
      const preview = getToolPreview("file_edit", "complete", {
        new_string: "inserted line",
        _lineNumber: 5,
      });
      expect(preview).toBeDefined();
      expect(preview).toContain("+ inserted line");
    });
  });

  describe("getToolStatusIcon", () => {
    it("should return braille spinner char for running", () => {
      expect(getToolStatusIcon("running")).toBe("\u280B");
    });

    it("should return checkmark for complete", () => {
      expect(getToolStatusIcon("complete")).toBe("\u2713");
    });

    it("should return X mark for error", () => {
      expect(getToolStatusIcon("error")).toBe("\u2717");
    });

    it("should return ! for denied", () => {
      expect(getToolStatusIcon("denied")).toBe("!");
    });
  });

  describe("SPINNER_FRAMES", () => {
    it("should have 10 frames", () => {
      expect(SPINNER_FRAMES).toHaveLength(10);
    });

    it("should start with the same char as running icon", () => {
      expect(SPINNER_FRAMES[0]).toBe(getToolStatusIcon("running"));
    });
  });

  describe("SPINNER_INTERVAL_MS", () => {
    it("should be 200ms", () => {
      expect(SPINNER_INTERVAL_MS).toBe(200);
    });
  });
});
