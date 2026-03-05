import { describe, it, expect, afterEach } from "vitest";
import { fileWriteTool } from "../../../../src/tools/definitions/file-write.js";
import { unlink, readFile } from "node:fs/promises";
import { join } from "node:path";

const tmpDir = join(process.cwd(), "test", "tmp");
const context = {
  workingDirectory: tmpDir,
  signal: new AbortController().signal,
};

const testFile = join(tmpDir, "test-write-output.txt");

afterEach(async () => {
  try {
    await unlink(testFile);
  } catch {
    // ignore
  }
});

describe("file_write tool", () => {
  it("should have correct metadata", () => {
    expect(fileWriteTool.name).toBe("file_write");
    expect(fileWriteTool.permissionLevel).toBe("confirm");
  });

  it("should write content to a file", async () => {
    const result = await fileWriteTool.execute(
      { path: "test-write-output.txt", content: "hello\nworld" },
      context,
    );
    expect(result.isError).toBe(false);
    expect(result.output).toContain("Successfully wrote");
    expect(result.output).toContain("2 lines");

    const written = await readFile(testFile, "utf-8");
    expect(written).toBe("hello\nworld");
  });

  it("should create parent directories", async () => {
    const nestedPath = join(tmpDir, "nested", "deep", "file.txt");
    const result = await fileWriteTool.execute(
      { path: "nested/deep/file.txt", content: "test" },
      context,
    );
    expect(result.isError).toBe(false);

    // Cleanup
    const { unlink: ul, rmdir } = await import("node:fs/promises");
    await ul(nestedPath);
    await rmdir(join(tmpDir, "nested", "deep"));
    await rmdir(join(tmpDir, "nested"));
  });
});
