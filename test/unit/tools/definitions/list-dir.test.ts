import { describe, it, expect } from "vitest";
import { listDirTool } from "../../../../src/tools/definitions/list-dir.js";

const context = {
  workingDirectory: process.cwd(),
  abortSignal: new AbortController().signal,
  timeoutMs: 30_000,
  platform: "darwin" as const,
};

describe("list_dir tool", () => {
  it("should have correct metadata", () => {
    expect(listDirTool.name).toBe("list_dir");
    expect(listDirTool.permissionLevel).toBe("safe");
  });

  it("should list the current directory", async () => {
    const result = await listDirTool.execute({ path: ".", recursive: false, maxDepth: 3 }, context);
    expect(result.isError).toBe(false);
    expect(result.output).toContain("src/");
    expect(result.output).toContain("package.json");
  });

  it("should use tree formatting with connectors", async () => {
    const result = await listDirTool.execute({ path: ".", recursive: false, maxDepth: 3 }, context);
    expect(result.isError).toBe(false);
    expect(result.output).toMatch(/[├└]──/);
  });

  it("should exclude .git and node_modules", async () => {
    const result = await listDirTool.execute({ path: ".", recursive: false, maxDepth: 3 }, context);
    expect(result.isError).toBe(false);
    expect(result.output).not.toContain(".git/");
    expect(result.output).not.toContain("node_modules/");
  });

  it("should sort directories before files", async () => {
    const result = await listDirTool.execute({ path: ".", recursive: false, maxDepth: 3 }, context);
    expect(result.isError).toBe(false);
    const lines = result.output.split("\n");
    const srcIndex = lines.findIndex((l) => l.includes("src/"));
    const pkgIndex = lines.findIndex((l) => l.includes("package.json"));
    expect(srcIndex).toBeLessThan(pkgIndex);
  });

  it("should support recursive listing", async () => {
    const result = await listDirTool.execute(
      { path: "src/tools", recursive: true, maxDepth: 2 },
      context,
    );
    expect(result.isError).toBe(false);
    expect(result.output).toContain("definitions/");
    expect(result.output).toContain("types.ts");
  });

  it("should handle non-existent directory", async () => {
    const result = await listDirTool.execute(
      { path: "non-existent-dir-12345", recursive: false, maxDepth: 3 },
      context,
    );
    expect(result.isError).toBe(true);
    expect(result.output).toContain("Failed to list directory");
  });

  it("should default recursive to false and maxDepth to 3", () => {
    const result = listDirTool.parameterSchema.parse({ path: "." });
    expect(result.recursive).toBe(false);
    expect(result.maxDepth).toBe(3);
  });
});
