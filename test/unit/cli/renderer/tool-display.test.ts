import { describe, it, expect } from "vitest";
import {
  getToolDisplayText,
  getToolStatusIcon,
  formatDuration,
  SPINNER_FRAMES,
  SPINNER_INTERVAL_MS,
} from "../../../../src/cli/renderer/tool-display.js";

describe("tool-display", () => {
  describe("getToolDisplayText", () => {
    it("should return formatted name for unknown tools", () => {
      expect(getToolDisplayText("unknown_tool", "running")).toBe("Running unknown_tool");
      expect(getToolDisplayText("unknown_tool", "complete")).toBe("Completed unknown_tool");
    });

    describe("file_read", () => {
      it("should show 'Reading' when running with file path", () => {
        expect(
          getToolDisplayText("file_read", "running", { file_path: "/src/index.ts" }),
        ).toBe("Reading /src/index.ts");
      });

      it("should show 'Read' when complete with file path", () => {
        expect(
          getToolDisplayText("file_read", "complete", { file_path: "/src/index.ts" }),
        ).toBe("Read /src/index.ts");
      });

      it("should show verb only when no args", () => {
        expect(getToolDisplayText("file_read", "running")).toBe("Reading");
      });

      it("should show line count when complete with output", () => {
        const output = "line1\nline2\nline3\n";
        expect(
          getToolDisplayText("file_read", "complete", { file_path: "/src/index.ts" }, output),
        ).toBe("Read /src/index.ts (3 lines)");
      });
    });

    describe("file_write", () => {
      it("should show 'Writing' when running", () => {
        expect(
          getToolDisplayText("file_write", "running", { file_path: "/out.ts" }),
        ).toBe("Writing /out.ts");
      });

      it("should show 'Wrote' when complete", () => {
        expect(
          getToolDisplayText("file_write", "complete", { file_path: "/out.ts" }),
        ).toBe("Wrote /out.ts");
      });

      it("should show byte size when content is provided", () => {
        expect(
          getToolDisplayText("file_write", "complete", { file_path: "/out.ts", content: "hello" }),
        ).toBe("Wrote /out.ts (5 B)");
      });

      it("should show KB for larger content", () => {
        const content = "x".repeat(2048);
        expect(
          getToolDisplayText("file_write", "complete", { file_path: "/out.ts", content }),
        ).toBe("Wrote /out.ts (2.0 KB)");
      });
    });

    describe("file_edit", () => {
      it("should show 'Editing' when running", () => {
        expect(
          getToolDisplayText("file_edit", "running", { file_path: "/a.ts" }),
        ).toBe("Editing /a.ts");
      });

      it("should show 'Edited' when complete", () => {
        expect(
          getToolDisplayText("file_edit", "complete", { file_path: "/a.ts" }),
        ).toBe("Edited /a.ts");
      });
    });

    describe("bash_exec", () => {
      it("should show 'Running' with command", () => {
        expect(
          getToolDisplayText("bash_exec", "running", { command: "npm test" }),
        ).toBe("Running npm test");
      });

      it("should show 'Ran' when complete", () => {
        expect(
          getToolDisplayText("bash_exec", "complete", { command: "npm test" }),
        ).toBe("Ran npm test");
      });

      it("should truncate commands longer than 50 chars", () => {
        const longCmd = "a".repeat(60);
        const result = getToolDisplayText("bash_exec", "running", { command: longCmd });
        expect(result).toBe("Running " + "a".repeat(50) + "...");
      });

      it("should show verb only when no command arg", () => {
        expect(getToolDisplayText("bash_exec", "running", {})).toBe("Running");
      });
    });

    describe("glob_search", () => {
      it("should show 'Searching for' with pattern when running", () => {
        expect(
          getToolDisplayText("glob_search", "running", { pattern: "**/*.ts" }),
        ).toBe("Searching for **/*.ts");
      });

      it("should show file count when complete with output", () => {
        const output = "file1.ts\nfile2.ts\nfile3.ts";
        expect(
          getToolDisplayText("glob_search", "complete", {}, output),
        ).toBe("Found 3 files");
      });

      it("should show singular 'file' for one result", () => {
        expect(
          getToolDisplayText("glob_search", "complete", {}, "file1.ts"),
        ).toBe("Found 1 file");
      });

      it("should fall back to pattern when no output", () => {
        expect(
          getToolDisplayText("glob_search", "complete", { pattern: "*.md" }),
        ).toBe("Found *.md");
      });
    });

    describe("grep_search", () => {
      it("should show 'Searching for' with quoted pattern when running", () => {
        expect(
          getToolDisplayText("grep_search", "running", { pattern: "TODO" }),
        ).toBe('Searching for "TODO"');
      });

      it("should show 'Searched for' with quoted pattern when complete", () => {
        expect(
          getToolDisplayText("grep_search", "complete", { pattern: "TODO" }),
        ).toBe('Searched for "TODO"');
      });
    });

    describe("mkdir", () => {
      it("should show 'Creating' with path when running", () => {
        expect(
          getToolDisplayText("mkdir", "running", { path: "/src/new" }),
        ).toBe("Creating /src/new");
      });

      it("should show 'Created' when complete", () => {
        expect(
          getToolDisplayText("mkdir", "complete", { path: "/src/new" }),
        ).toBe("Created /src/new");
      });
    });

    describe("error and denied states use complete verb", () => {
      it("should use complete verb for error status", () => {
        expect(
          getToolDisplayText("file_read", "error", { file_path: "/x.ts" }),
        ).toBe("Read /x.ts");
      });

      it("should use complete verb for denied status", () => {
        expect(
          getToolDisplayText("file_write", "denied", { file_path: "/x.ts" }),
        ).toBe("Wrote /x.ts");
      });
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

  describe("formatDuration", () => {
    it("should format sub-second durations in ms", () => {
      expect(formatDuration(50)).toBe("50ms");
      expect(formatDuration(999)).toBe("999ms");
    });

    it("should format seconds with one decimal", () => {
      expect(formatDuration(1000)).toBe("1.0s");
      expect(formatDuration(1500)).toBe("1.5s");
      expect(formatDuration(59999)).toBe("60.0s");
    });

    it("should format minutes and seconds", () => {
      expect(formatDuration(60_000)).toBe("1m 0s");
      expect(formatDuration(90_000)).toBe("1m 30s");
      expect(formatDuration(125_000)).toBe("2m 5s");
    });

    it("should round ms values", () => {
      expect(formatDuration(0.7)).toBe("1ms");
      expect(formatDuration(0)).toBe("0ms");
    });
  });

  describe("getToolDisplayText with duration", () => {
    it("should append duration for completed known tools", () => {
      expect(
        getToolDisplayText("file_read", "complete", { file_path: "/a.ts" }, undefined, 1500),
      ).toBe("Read /a.ts (1.5s)");
    });

    it("should append duration for completed unknown tools", () => {
      expect(
        getToolDisplayText("custom_tool", "complete", undefined, undefined, 250),
      ).toBe("Completed custom_tool (250ms)");
    });

    it("should not append duration when running", () => {
      expect(
        getToolDisplayText("file_read", "running", { file_path: "/a.ts" }, undefined, 1500),
      ).toBe("Reading /a.ts");
    });

    it("should not append duration when undefined", () => {
      expect(
        getToolDisplayText("file_read", "complete", { file_path: "/a.ts" }),
      ).toBe("Read /a.ts");
    });
  });
});
