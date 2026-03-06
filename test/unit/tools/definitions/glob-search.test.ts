import { describe, it, expect } from "vitest";
import { globSearchTool } from "../../../../src/tools/definitions/glob-search.js";

const context = {
  workingDirectory: process.cwd(),
  signal: new AbortController().signal,
};

describe("glob_search tool", () => {
  it("should have correct metadata", () => {
    expect(globSearchTool.name).toBe("glob_search");
    expect(globSearchTool.permissionLevel).toBe("safe");
  });

  it("should find TypeScript files", async () => {
    const result = await globSearchTool.execute({ pattern: "src/**/*.ts", path: "." }, context);
    expect(result.isError).toBe(false);
    expect(result.output).toContain("constants.ts");
    expect(result.metadata?.count).toBeGreaterThan(0);
  });

  it("should return empty for no matches", async () => {
    const result = await globSearchTool.execute({ pattern: "*.nonexistent", path: "src" }, context);
    expect(result.isError).toBe(false);
    expect(result.output).toContain("No files found");
  }, 10000);

  it("should search in specific directory", async () => {
    const result = await globSearchTool.execute({ pattern: "*.ts", path: "src/utils" }, context);
    expect(result.isError).toBe(false);
    expect(result.output).toContain("error.ts");
  });

  it("should search without path parameter (uses cwd)", async () => {
    const result = await globSearchTool.execute({ pattern: "package.json" }, context);
    expect(result.isError).toBe(false);
    expect(result.output).toContain("package.json");
  });

  it("should handle nonexistent search directory gracefully", async () => {
    const result = await globSearchTool.execute(
      { pattern: "*.ts", path: "/nonexistent/path/xyz" },
      context,
    );
    // Either empty results or error — both are valid
    expect(typeof result.output).toBe("string");
  });

  it("should handle glob error gracefully", async () => {
    // Use a null-byte pattern that will cause an error
    const result = await globSearchTool.execute({ pattern: "\0invalid", path: "." }, context);
    // Should return error without crashing
    expect(typeof result.output).toBe("string");
  });
});
