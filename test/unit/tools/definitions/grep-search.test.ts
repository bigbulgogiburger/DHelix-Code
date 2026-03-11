import { describe, it, expect, beforeEach } from "vitest";
import {
  grepSearchTool,
  isRipgrepAvailable,
  _resetRipgrepCache,
} from "../../../../src/tools/definitions/grep-search.js";

const context = {
  workingDirectory: process.cwd(),
  signal: new AbortController().signal,
};

describe("grep_search tool", () => {
  it("should have correct metadata", () => {
    expect(grepSearchTool.name).toBe("grep_search");
    expect(grepSearchTool.permissionLevel).toBe("safe");
  });

  it("should find pattern in files", async () => {
    const result = await grepSearchTool.execute(
      { pattern: "APP_NAME", path: "src", include: "constants.ts" },
      context,
    );
    expect(result.isError).toBe(false);
    expect(result.output).toContain("APP_NAME");
    expect(result.metadata?.matchCount).toBeGreaterThan(0);
  });

  it("should return no matches for non-existent pattern", async () => {
    const result = await grepSearchTool.execute(
      { pattern: "ZZZZZ_NONEXISTENT_PATTERN_ZZZZZ", path: "src", include: "constants.ts" },
      context,
    );
    expect(result.isError).toBe(false);
    expect(result.output).toContain("No matches found");
  });

  it("should handle invalid regex", async () => {
    const result = await grepSearchTool.execute({ pattern: "[invalid", path: "src" }, context);
    expect(result.isError).toBe(true);
    expect(result.output).toContain("Grep search failed");
  });

  it("should search working directory by default", async () => {
    const result = await grepSearchTool.execute(
      { pattern: "dbcode", include: "package.json" },
      context,
    );
    expect(result.isError).toBe(false);
    expect(result.output).toContain("dbcode");
  });

  describe("ripgrep detection", () => {
    beforeEach(() => {
      _resetRipgrepCache();
    });

    it("should detect ripgrep availability", async () => {
      const available = await isRipgrepAvailable();
      expect(typeof available).toBe("boolean");
    });

    it("should cache ripgrep availability", async () => {
      const first = await isRipgrepAvailable();
      const second = await isRipgrepAvailable();
      expect(first).toBe(second);
    });
  });

  describe("new parameters", () => {
    it("should support case-insensitive search", async () => {
      const result = await grepSearchTool.execute(
        { pattern: "app_name", path: "src", include: "constants.ts", caseSensitive: false },
        context,
      );
      expect(result.isError).toBe(false);
      expect(result.output).toContain("APP_NAME");
    });

    it("should support file type filter", async () => {
      const result = await grepSearchTool.execute(
        { pattern: "export", path: "src", fileType: "ts" },
        context,
      );
      expect(result.isError).toBe(false);
      expect(result.metadata?.matchCount).toBeGreaterThan(0);
    });

    it("should support context lines", async () => {
      const result = await grepSearchTool.execute(
        { pattern: "APP_NAME", path: "src", include: "constants.ts", contextLines: 1 },
        context,
      );
      expect(result.isError).toBe(false);
      expect(result.output).toContain("APP_NAME");
    });
  });

  describe("backend metadata", () => {
    it("should include backend info in metadata", async () => {
      const result = await grepSearchTool.execute(
        { pattern: "APP_NAME", path: "src", include: "constants.ts" },
        context,
      );
      expect(result.isError).toBe(false);
      expect(result.metadata?.backend).toBeDefined();
      expect(["ripgrep", "javascript"]).toContain(result.metadata?.backend);
    });
  });
});
