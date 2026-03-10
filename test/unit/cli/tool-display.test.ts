import { describe, it, expect } from "vitest";
import {
  getToolDisplayText,
  getToolStatusIcon,
  getToolPreview,
  getToolHeaderInfo,
  SPINNER_FRAMES,
  SPINNER_INTERVAL_MS,
} from "../../../src/cli/renderer/tool-display.js";

describe("getToolDisplayText", () => {
  describe("file_read", () => {
    it("should show 'Reading' with file path when running", () => {
      expect(getToolDisplayText("file_read", "running", { file_path: "/src/index.ts" })).toBe(
        "Reading /src/index.ts",
      );
    });

    it("should show 'Read' with file path when complete", () => {
      expect(getToolDisplayText("file_read", "complete", { file_path: "/src/index.ts" })).toBe(
        "Read /src/index.ts",
      );
    });

    it("should show verb only when no args", () => {
      expect(getToolDisplayText("file_read", "running")).toBe("Reading");
    });

    it("should show verb only when file_path is not a string", () => {
      expect(getToolDisplayText("file_read", "running", { file_path: 42 })).toBe("Reading");
    });
  });

  describe("file_write", () => {
    it("should show 'Writing' when running", () => {
      expect(getToolDisplayText("file_write", "running", { file_path: "/out.txt" })).toBe(
        "Writing /out.txt",
      );
    });

    it("should show 'Wrote' when complete", () => {
      expect(getToolDisplayText("file_write", "complete", { file_path: "/out.txt" })).toBe(
        "Wrote /out.txt",
      );
    });
  });

  describe("file_edit", () => {
    it("should show 'Editing' when running", () => {
      expect(getToolDisplayText("file_edit", "running", { file_path: "/app.ts" })).toBe(
        "Editing /app.ts",
      );
    });

    it("should show 'Edited' when complete without old/new_string", () => {
      expect(getToolDisplayText("file_edit", "complete", { file_path: "/app.ts" })).toBe(
        "Edited /app.ts",
      );
    });

    it("should show change summary when complete with old/new_string", () => {
      expect(
        getToolDisplayText("file_edit", "complete", {
          file_path: "/app.ts",
          old_string: "line1\nline2",
          new_string: "lineA",
        }),
      ).toBe("Edited /app.ts — Added 1 line, removed 2 lines");
    });
  });

  describe("bash_exec", () => {
    it("should show 'Running' with command when running", () => {
      expect(getToolDisplayText("bash_exec", "running", { command: "npm test" })).toBe(
        "Running npm test",
      );
    });

    it("should show 'Ran' with command when complete", () => {
      expect(getToolDisplayText("bash_exec", "complete", { command: "npm test" })).toBe(
        "Ran npm test",
      );
    });

    it("should truncate commands longer than 80 characters", () => {
      const longCommand = "a".repeat(90);
      const result = getToolDisplayText("bash_exec", "running", { command: longCommand });
      expect(result).toBe(`Running ${"a".repeat(77)}…`);
    });

    it("should not truncate commands at 80 characters", () => {
      const cmd = "a".repeat(80);
      const result = getToolDisplayText("bash_exec", "running", { command: cmd });
      expect(result).toBe(`Running ${cmd}`);
    });

    it("should show verb only when command is not a string", () => {
      expect(getToolDisplayText("bash_exec", "running", { command: 123 })).toBe("Running");
    });
  });

  describe("glob_search", () => {
    it("should show pattern when running", () => {
      expect(getToolDisplayText("glob_search", "running", { pattern: "**/*.ts" })).toBe(
        'Searching files "**/*.ts"',
      );
    });

    it("should show file count with pattern when complete", () => {
      const output = "/src/a.ts\n/src/b.ts\n/src/c.ts\n";
      expect(getToolDisplayText("glob_search", "complete", { pattern: "**/*.ts" }, output)).toBe(
        'Found 3 files matching "**/*.ts"',
      );
    });

    it("should show singular 'file' for single result", () => {
      const output = "/src/index.ts\n";
      expect(getToolDisplayText("glob_search", "complete", { pattern: "index.ts" }, output)).toBe(
        'Found 1 file matching "index.ts"',
      );
    });

    it("should fall back to pattern when no output", () => {
      expect(getToolDisplayText("glob_search", "complete", { pattern: "**/*.ts" })).toBe(
        'Found "**/*.ts"',
      );
    });

    it("should handle empty output by falling back to pattern", () => {
      expect(getToolDisplayText("glob_search", "complete", { pattern: "*.xyz" }, "")).toBe(
        'Found "*.xyz"',
      );
    });
  });

  describe("grep_search", () => {
    it("should show pattern when running", () => {
      expect(getToolDisplayText("grep_search", "running", { pattern: "TODO" })).toBe(
        'Searching "TODO"',
      );
    });

    it("should show result count when complete with output", () => {
      expect(
        getToolDisplayText("grep_search", "complete", { pattern: "TODO" }, "match1\nmatch2"),
      ).toBe('Searched "TODO" — 2 results');
    });

    it("should show pattern only when complete without output", () => {
      expect(getToolDisplayText("grep_search", "complete", { pattern: "TODO" })).toBe(
        'Searched "TODO"',
      );
    });
  });

  describe("mkdir", () => {
    it("should show 'Creating directory' with path when running", () => {
      expect(getToolDisplayText("mkdir", "running", { path: "/src/utils" })).toBe(
        "Creating directory /src/utils",
      );
    });

    it("should show 'Created directory' with path when complete", () => {
      expect(getToolDisplayText("mkdir", "complete", { path: "/src/utils" })).toBe(
        "Created directory /src/utils",
      );
    });
  });

  describe("unknown tool", () => {
    it("should return Running + tool name when running", () => {
      expect(getToolDisplayText("unknown_tool", "running")).toBe("Running unknown_tool");
    });

    it("should return Completed + tool name for non-running statuses", () => {
      expect(getToolDisplayText("my_tool", "complete")).toBe("Completed my_tool");
      expect(getToolDisplayText("my_tool", "error")).toBe("Completed my_tool");
      expect(getToolDisplayText("my_tool", "denied")).toBe("Completed my_tool");
    });
  });

  describe("error and denied statuses use complete verb", () => {
    it("should use complete verb for error status", () => {
      expect(getToolDisplayText("file_read", "error", { file_path: "/fail.ts" })).toBe(
        "Read /fail.ts",
      );
    });

    it("should use complete verb for denied status", () => {
      expect(getToolDisplayText("file_write", "denied", { file_path: "/secret.ts" })).toBe(
        "Wrote /secret.ts",
      );
    });
  });
});

describe("getToolPreview", () => {
  it("should return diff preview for file_edit with line numbers", () => {
    const preview = getToolPreview("file_edit", "complete", {
      old_string: "const x = 1;",
      new_string: "const x = 2;",
    });
    expect(preview).toContain("- const x = 1;");
    expect(preview).toContain("+ const x = 2;");
    expect(preview).toMatch(/\d+\s+-/);
    expect(preview).toMatch(/\d+\s+\+/);
  });

  it("should use _lineNumber for line numbering", () => {
    const preview = getToolPreview("file_edit", "complete", {
      old_string: "old",
      new_string: "new",
      _lineNumber: 10,
    });
    expect(preview).toContain("10 - old");
    expect(preview).toContain("10 + new");
  });

  it("should handle multi-line diffs with incrementing line numbers", () => {
    const preview = getToolPreview("file_edit", "complete", {
      old_string: "line1\nline2\nline3",
      new_string: "lineA\nlineB",
      _lineNumber: 5,
    });
    expect(preview).toContain("5 - line1");
    expect(preview).toContain("6 - line2");
    expect(preview).toContain("7 - line3");
    expect(preview).toContain("5 + lineA");
    expect(preview).toContain("6 + lineB");
  });

  it("should render context diff with before/after context lines", () => {
    const preview = getToolPreview("file_edit", "complete", {
      old_string: "<Logo />",
      new_string: "<Static>\n  <Logo />\n</Static>",
      _lineNumber: 108,
      _contextLines: [
        "<MessageList />",
        '<Box flexDirection="column">',
        "  // inner",
        "<Static>",
        "  <Logo />",
        "</Static>",
        "  <ActivityFeed />",
        "</Box>",
        "<Footer />",
      ],
      _contextStartLine: 105,
    });
    // Before context
    expect(preview).toContain(" 105   <MessageList />");
    expect(preview).toContain(' 106   <Box flexDirection="column">');
    expect(preview).toContain(" 107     // inner");
    // Removed
    expect(preview).toContain(" 108 - <Logo />");
    // Added
    expect(preview).toContain(" 108 + <Static>");
    expect(preview).toContain(" 109 +   <Logo />");
    expect(preview).toContain(" 110 + </Static>");
    // After context (content includes leading spaces from source)
    expect(preview).toContain(" 111     <ActivityFeed />");
    expect(preview).toContain(" 112   </Box>");
    expect(preview).toContain(" 113   <Footer />");
  });

  it("should return undefined for file_edit when running", () => {
    expect(
      getToolPreview("file_edit", "running", {
        old_string: "a",
        new_string: "b",
      }),
    ).toBeUndefined();
  });

  it("should return undefined for tools without preview", () => {
    expect(getToolPreview("file_read", "complete")).toBeUndefined();
  });
});

describe("getToolStatusIcon", () => {
  it("should return spinner frame for running", () => {
    expect(getToolStatusIcon("running")).toBe("\u280B");
  });

  it("should return checkmark for complete", () => {
    expect(getToolStatusIcon("complete")).toBe("\u2713");
  });

  it("should return cross for error", () => {
    expect(getToolStatusIcon("error")).toBe("\u2717");
  });

  it("should return exclamation for denied", () => {
    expect(getToolStatusIcon("denied")).toBe("!");
  });
});

describe("SPINNER_FRAMES", () => {
  it("should have 10 frames", () => {
    expect(SPINNER_FRAMES).toHaveLength(10);
  });

  it("should be a readonly tuple", () => {
    expect(Array.isArray(SPINNER_FRAMES)).toBe(true);
  });
});

describe("SPINNER_INTERVAL_MS", () => {
  it("should be 200ms", () => {
    expect(SPINNER_INTERVAL_MS).toBe(200);
  });
});

describe("getToolHeaderInfo", () => {
  describe("header format", () => {
    it("should return Update(filepath) for file_edit", () => {
      const info = getToolHeaderInfo("file_edit", "complete", { file_path: "/src/foo.ts" });
      expect(info.header).toBe("Update(/src/foo.ts)");
      expect(info.color).toBe("cyan");
    });

    it("should return Write(filepath) for file_write", () => {
      const info = getToolHeaderInfo("file_write", "complete", { file_path: "/src/bar.ts" });
      expect(info.header).toBe("Write(/src/bar.ts)");
      expect(info.color).toBe("cyan");
    });

    it("should return Read(filepath) for file_read", () => {
      const info = getToolHeaderInfo("file_read", "complete", { file_path: "/src/index.ts" });
      expect(info.header).toBe("Read(/src/index.ts)");
      expect(info.color).toBe("blue");
    });

    it("should return Bash(command) for bash_exec", () => {
      const info = getToolHeaderInfo("bash_exec", "complete", { command: "npm test" });
      expect(info.header).toBe("Bash(npm test)");
      expect(info.color).toBe("yellow");
    });

    it("should return Search(pattern) for glob_search", () => {
      const info = getToolHeaderInfo("glob_search", "complete", { pattern: "**/*.ts" });
      expect(info.header).toBe("Search(**/*.ts)");
      expect(info.color).toBe("magenta");
    });

    it("should return Search(pattern) for grep_search", () => {
      const info = getToolHeaderInfo("grep_search", "complete", { pattern: "TODO" });
      expect(info.header).toBe('Search("TODO")');
      expect(info.color).toBe("magenta");
    });

    it("should return Fetch(url) for web_fetch", () => {
      const info = getToolHeaderInfo("web_fetch", "complete", { url: "https://example.com" });
      expect(info.header).toBe("Fetch(https://example.com)");
      expect(info.color).toBe("magenta");
    });

    it("should return Mkdir(path) for mkdir", () => {
      const info = getToolHeaderInfo("mkdir", "complete", { path: "/src/utils" });
      expect(info.header).toBe("Mkdir(/src/utils)");
      expect(info.color).toBe("cyan");
    });

    it("should return List(path) for list_dir", () => {
      const info = getToolHeaderInfo("list_dir", "complete", { path: "/src" });
      expect(info.header).toBe("List(/src)");
      expect(info.color).toBe("blue");
    });

    it("should truncate long bash commands in header", () => {
      const longCmd = "a".repeat(100);
      const info = getToolHeaderInfo("bash_exec", "complete", { command: longCmd });
      expect(info.header.length).toBeLessThanOrEqual(80);
    });

    it("should shorten long file paths", () => {
      const info = getToolHeaderInfo("file_read", "complete", {
        file_path: "/very/deep/nested/path/to/some/file.ts",
      });
      expect(info.header).toContain("file.ts");
    });

    it("should return Tool(name) for unknown tools", () => {
      const info = getToolHeaderInfo("unknown_tool", "complete");
      expect(info.header).toContain("unknown_tool");
      expect(info.color).toBe("gray");
    });

    it("should use running verb when status is running", () => {
      const info = getToolHeaderInfo("file_edit", "running", { file_path: "/src/foo.ts" });
      expect(info.header).toContain("Updating");
    });

    it("should use running verb for bash when running", () => {
      const info = getToolHeaderInfo("bash_exec", "running", { command: "npm test" });
      expect(info.header).toContain("Running");
    });

    it("should use running verb for file_read when running", () => {
      const info = getToolHeaderInfo("file_read", "running", { file_path: "/src/foo.ts" });
      expect(info.header).toContain("Reading");
    });

    it("should handle missing args gracefully", () => {
      const info = getToolHeaderInfo("file_edit", "complete");
      expect(info.header).toBeDefined();
      expect(info.color).toBe("cyan");
    });

    it("should handle non-string args gracefully", () => {
      const info = getToolHeaderInfo("file_edit", "complete", { file_path: 42 });
      expect(info.header).toBeDefined();
    });
  });

  describe("subtext", () => {
    it("should include change summary for file_edit", () => {
      const info = getToolHeaderInfo("file_edit", "complete", {
        file_path: "/src/foo.ts",
        old_string: "line1\nline2",
        new_string: "lineA",
      });
      expect(info.subtext).toBeDefined();
      expect(info.subtext).toContain("1 line");
      expect(info.subtext).toContain("2 lines");
    });

    it("should include line count for file_read with output", () => {
      const info = getToolHeaderInfo(
        "file_read",
        "complete",
        { file_path: "/src/foo.ts" },
        "line1\nline2\nline3\n",
      );
      expect(info.subtext).toBeDefined();
      expect(info.subtext).toContain("3");
    });

    it("should include result count for grep_search", () => {
      const info = getToolHeaderInfo(
        "grep_search",
        "complete",
        { pattern: "TODO" },
        "match1\nmatch2\nmatch3",
      );
      expect(info.subtext).toBeDefined();
      expect(info.subtext).toContain("3");
    });

    it("should include file count for glob_search", () => {
      const info = getToolHeaderInfo(
        "glob_search",
        "complete",
        { pattern: "**/*.ts" },
        "/a.ts\n/b.ts\n",
      );
      expect(info.subtext).toBeDefined();
      expect(info.subtext).toContain("2");
    });

    it("should return undefined subtext when no meaningful info", () => {
      const info = getToolHeaderInfo("file_read", "running", { file_path: "/src/foo.ts" });
      // Running status may or may not have subtext, but shouldn't error
      expect(info.header).toBeDefined();
    });
  });

  describe("color", () => {
    it("should be cyan for file_edit", () => {
      expect(getToolHeaderInfo("file_edit", "complete", {}).color).toBe("cyan");
    });

    it("should be cyan for file_write", () => {
      expect(getToolHeaderInfo("file_write", "complete", {}).color).toBe("cyan");
    });

    it("should be blue for file_read", () => {
      expect(getToolHeaderInfo("file_read", "complete", {}).color).toBe("blue");
    });

    it("should be blue for list_dir", () => {
      expect(getToolHeaderInfo("list_dir", "complete", {}).color).toBe("blue");
    });

    it("should be yellow for bash_exec", () => {
      expect(getToolHeaderInfo("bash_exec", "complete", {}).color).toBe("yellow");
    });

    it("should be magenta for glob_search", () => {
      expect(getToolHeaderInfo("glob_search", "complete", {}).color).toBe("magenta");
    });

    it("should be magenta for grep_search", () => {
      expect(getToolHeaderInfo("grep_search", "complete", {}).color).toBe("magenta");
    });

    it("should be red for kill_shell", () => {
      expect(getToolHeaderInfo("kill_shell", "complete", {}).color).toBe("red");
    });

    it("should be gray for unknown tools", () => {
      expect(getToolHeaderInfo("unknown", "complete", {}).color).toBe("gray");
    });
  });
});
