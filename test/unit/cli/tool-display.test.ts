import { describe, it, expect } from "vitest";
import {
  getToolDisplayText,
  getToolStatusIcon,
  getToolPreview,
  SPINNER_FRAMES,
  SPINNER_INTERVAL_MS,
} from "../../../src/cli/renderer/tool-display.js";

describe("getToolDisplayText", () => {
  describe("file_read", () => {
    it("should show 'Reading' with file path when running", () => {
      expect(
        getToolDisplayText("file_read", "running", { file_path: "/src/index.ts" }),
      ).toBe("Reading /src/index.ts");
    });

    it("should show 'Read' with file path when complete", () => {
      expect(
        getToolDisplayText("file_read", "complete", { file_path: "/src/index.ts" }),
      ).toBe("Read /src/index.ts");
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
      expect(
        getToolDisplayText("file_write", "running", { file_path: "/out.txt" }),
      ).toBe("Writing /out.txt");
    });

    it("should show 'Wrote' when complete", () => {
      expect(
        getToolDisplayText("file_write", "complete", { file_path: "/out.txt" }),
      ).toBe("Wrote /out.txt");
    });
  });

  describe("file_edit", () => {
    it("should show 'Editing' when running", () => {
      expect(
        getToolDisplayText("file_edit", "running", { file_path: "/app.ts" }),
      ).toBe("Editing /app.ts");
    });

    it("should show 'Edited' when complete", () => {
      expect(
        getToolDisplayText("file_edit", "complete", { file_path: "/app.ts" }),
      ).toBe("Edited /app.ts");
    });
  });

  describe("bash_exec", () => {
    it("should show 'Running' with command when running", () => {
      expect(
        getToolDisplayText("bash_exec", "running", { command: "npm test" }),
      ).toBe("Running npm test");
    });

    it("should show 'Ran' with command when complete", () => {
      expect(
        getToolDisplayText("bash_exec", "complete", { command: "npm test" }),
      ).toBe("Ran npm test");
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
      expect(
        getToolDisplayText("glob_search", "running", { pattern: "**/*.ts" }),
      ).toBe('Searching files "**/*.ts"');
    });

    it("should show file count with pattern when complete", () => {
      const output = "/src/a.ts\n/src/b.ts\n/src/c.ts\n";
      expect(
        getToolDisplayText("glob_search", "complete", { pattern: "**/*.ts" }, output),
      ).toBe('Found 3 files matching "**/*.ts"');
    });

    it("should show singular 'file' for single result", () => {
      const output = "/src/index.ts\n";
      expect(
        getToolDisplayText("glob_search", "complete", { pattern: "index.ts" }, output),
      ).toBe('Found 1 file matching "index.ts"');
    });

    it("should fall back to pattern when no output", () => {
      expect(
        getToolDisplayText("glob_search", "complete", { pattern: "**/*.ts" }),
      ).toBe('Found "**/*.ts"');
    });

    it("should handle empty output by falling back to pattern", () => {
      expect(
        getToolDisplayText("glob_search", "complete", { pattern: "*.xyz" }, ""),
      ).toBe('Found "*.xyz"');
    });
  });

  describe("grep_search", () => {
    it("should show pattern when running", () => {
      expect(
        getToolDisplayText("grep_search", "running", { pattern: "TODO" }),
      ).toBe('Searching "TODO"');
    });

    it("should show result count when complete with output", () => {
      expect(
        getToolDisplayText("grep_search", "complete", { pattern: "TODO" }, "match1\nmatch2"),
      ).toBe('Searched "TODO" — 2 results');
    });

    it("should show pattern only when complete without output", () => {
      expect(
        getToolDisplayText("grep_search", "complete", { pattern: "TODO" }),
      ).toBe('Searched "TODO"');
    });
  });

  describe("mkdir", () => {
    it("should show 'Creating directory' with path when running", () => {
      expect(
        getToolDisplayText("mkdir", "running", { path: "/src/utils" }),
      ).toBe("Creating directory /src/utils");
    });

    it("should show 'Created directory' with path when complete", () => {
      expect(
        getToolDisplayText("mkdir", "complete", { path: "/src/utils" }),
      ).toBe("Created directory /src/utils");
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
      expect(
        getToolDisplayText("file_read", "error", { file_path: "/fail.ts" }),
      ).toBe("Read /fail.ts");
    });

    it("should use complete verb for denied status", () => {
      expect(
        getToolDisplayText("file_write", "denied", { file_path: "/secret.ts" }),
      ).toBe("Wrote /secret.ts");
    });
  });
});

describe("getToolPreview", () => {
  it("should return diff preview for file_edit", () => {
    const preview = getToolPreview("file_edit", "complete", {
      old_string: "const x = 1;",
      new_string: "const x = 2;",
    });
    expect(preview).toContain("- const x = 1;");
    expect(preview).toContain("+ const x = 2;");
  });

  it("should return undefined for file_edit when running", () => {
    expect(getToolPreview("file_edit", "running", {
      old_string: "a",
      new_string: "b",
    })).toBeUndefined();
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
