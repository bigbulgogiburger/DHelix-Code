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
    const result = await globSearchTool.execute({ pattern: "**/*.nonexistent" }, context);
    expect(result.isError).toBe(false);
    expect(result.output).toContain("No files found");
  });

  it("should search in specific directory", async () => {
    const result = await globSearchTool.execute({ pattern: "*.ts", path: "src/utils" }, context);
    expect(result.isError).toBe(false);
    expect(result.output).toContain("error.ts");
  });
});
