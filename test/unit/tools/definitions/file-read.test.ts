import { describe, it, expect } from "vitest";
import { fileReadTool } from "../../../../src/tools/definitions/file-read.js";

const context = {
  workingDirectory: process.cwd(),
  signal: new AbortController().signal,
};

describe("file_read tool", () => {
  it("should have correct metadata", () => {
    expect(fileReadTool.name).toBe("file_read");
    expect(fileReadTool.permissionLevel).toBe("safe");
  });

  it("should read a file with line numbers", async () => {
    const result = await fileReadTool.execute({ path: "package.json" }, context);
    expect(result.isError).toBe(false);
    expect(result.output).toContain("dbcode");
    expect(result.output).toMatch(/^\s+1 \|/m);
  });

  it("should support offset and limit", async () => {
    const result = await fileReadTool.execute(
      { path: "package.json", offset: 0, limit: 3 },
      context,
    );
    expect(result.isError).toBe(false);
    const lines = result.output.split("\n");
    expect(lines.length).toBeLessThanOrEqual(3);
  });

  it("should handle non-existent file", async () => {
    const result = await fileReadTool.execute({ path: "non-existent-file-12345.txt" }, context);
    expect(result.isError).toBe(true);
    expect(result.output).toContain("Failed to read file");
  });

  it("should include metadata with path and line info", async () => {
    const result = await fileReadTool.execute({ path: "package.json" }, context);
    expect(result.metadata).toBeDefined();
    expect(result.metadata!.totalLines).toBeGreaterThan(0);
  });
});
