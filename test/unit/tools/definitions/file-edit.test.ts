import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { fileEditTool } from "../../../../src/tools/definitions/file-edit.js";
import { writeFile, unlink } from "node:fs/promises";
import { join } from "node:path";

const tmpDir = join(process.cwd(), "test", "tmp");
const testFile = join(tmpDir, "test-edit-target.txt");
const context = {
  workingDirectory: tmpDir,
  signal: new AbortController().signal,
};

beforeEach(async () => {
  const { mkdir } = await import("node:fs/promises");
  await mkdir(tmpDir, { recursive: true });
  await writeFile(testFile, "line one\nline two\nline three\n", "utf-8");
});

afterEach(async () => {
  try {
    await unlink(testFile);
  } catch {
    // ignore
  }
});

describe("file_edit tool", () => {
  it("should have correct metadata", () => {
    expect(fileEditTool.name).toBe("file_edit");
    expect(fileEditTool.permissionLevel).toBe("confirm");
  });

  it("should replace a unique string", async () => {
    const result = await fileEditTool.execute(
      { path: "test-edit-target.txt", old_string: "line two", new_string: "LINE TWO" },
      context,
    );
    expect(result.isError).toBe(false);
    expect(result.output).toContain("Successfully edited");
  });

  it("should error on non-unique string without replace_all", async () => {
    await writeFile(testFile, "hello world\nhello world\n", "utf-8");
    const result = await fileEditTool.execute(
      { path: "test-edit-target.txt", old_string: "hello world", new_string: "hi" },
      context,
    );
    expect(result.isError).toBe(true);
    expect(result.output).toContain("occurrences");
  });

  it("should replace all with replace_all flag", async () => {
    await writeFile(testFile, "aaa bbb aaa\n", "utf-8");
    const result = await fileEditTool.execute(
      { path: "test-edit-target.txt", old_string: "aaa", new_string: "ccc", replace_all: true },
      context,
    );
    expect(result.isError).toBe(false);
  });

  it("should error when string not found", async () => {
    const result = await fileEditTool.execute(
      { path: "test-edit-target.txt", old_string: "does not exist", new_string: "x" },
      context,
    );
    expect(result.isError).toBe(true);
    expect(result.output).toContain("not found");
  });

  it("should error on non-existent file", async () => {
    const result = await fileEditTool.execute(
      { path: "no-such-file.txt", old_string: "a", new_string: "b" },
      context,
    );
    expect(result.isError).toBe(true);
  });
});
