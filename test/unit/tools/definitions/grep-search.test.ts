import { describe, it, expect } from "vitest";
import { grepSearchTool } from "../../../../src/tools/definitions/grep-search.js";

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
});
