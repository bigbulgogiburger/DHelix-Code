import { vi, describe, it, expect, beforeEach } from "vitest";

const { mockReadFile, mockWriteFile } = vi.hoisted(() => ({
  mockReadFile: vi.fn(),
  mockWriteFile: vi.fn(),
}));

const { mockAcquire, mockDetectAvailableServers } = vi.hoisted(() => ({
  mockAcquire: vi.fn(),
  mockDetectAvailableServers: vi.fn(),
}));

vi.mock("node:fs/promises", async () => {
  const actual = await vi.importActual<typeof import("node:fs/promises")>("node:fs/promises");
  return {
    ...actual,
    readFile: mockReadFile,
    writeFile: mockWriteFile,
  };
});

vi.mock("../../../../src/lsp/manager.js", () => ({
  LSPManager: vi.fn().mockImplementation(() => ({
    acquire: mockAcquire,
    detectAvailableServers: mockDetectAvailableServers,
  })),
}));

vi.mock("../../../../src/utils/path.js", () => ({
  resolvePath: (...segments: string[]) => {
    const { resolve } = require("node:path");
    return resolve(...segments);
  },
}));

import { safeRenameTool } from "../../../../src/tools/definitions/safe-rename.js";
import type { ToolContext } from "../../../../src/tools/types.js";

const mockContext: ToolContext = {
  workingDirectory: "/project",
  abortSignal: new AbortController().signal,
  timeoutMs: 30_000,
  platform: "darwin",
};

describe("safe_rename tool", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockWriteFile.mockResolvedValue(undefined);
    mockDetectAvailableServers.mockResolvedValue(["typescript"]);
  });

  it("should have correct metadata", () => {
    expect(safeRenameTool.name).toBe("safe_rename");
    expect(safeRenameTool.permissionLevel).toBe("confirm");
  });

  it("should show preview in dry_run mode (default)", async () => {
    // The session.rename returns RenameEdit[] with { filePath, edits: [...] }
    mockAcquire.mockResolvedValue({
      rename: vi.fn().mockResolvedValue([
        {
          filePath: "/project/src/app.ts",
          edits: [{ startLine: 1, startColumn: 10, endLine: 1, endColumn: 13, newText: "bar" }],
        },
        {
          filePath: "/project/src/index.ts",
          edits: [{ startLine: 3, startColumn: 5, endLine: 3, endColumn: 8, newText: "bar" }],
        },
      ]),
    });

    const result = await safeRenameTool.execute(
      { file_path: "src/app.ts", line: 1, column: 10, new_name: "bar", dry_run: true },
      mockContext,
    );

    expect(result.isError).toBe(false);
    // Source outputs "Rename preview: N edits across M files:"
    expect(result.output).toContain("Rename preview");
    expect(result.output).toContain("2 edit");
    expect(result.output).toContain("src/app.ts");
    expect(result.output).toContain("src/index.ts");
    expect(result.output).toContain("dry_run=false");
    // Should NOT write files
    expect(mockWriteFile).not.toHaveBeenCalled();
  });

  it("should apply edits when dry_run is false", async () => {
    mockAcquire.mockResolvedValue({
      rename: vi.fn().mockResolvedValue([
        {
          filePath: "/project/src/app.ts",
          edits: [{ startLine: 1, startColumn: 10, endLine: 1, endColumn: 13, newText: "bar" }],
        },
      ]),
    });
    mockReadFile.mockResolvedValue("function foo() {\n  return 1;\n}\n");

    const result = await safeRenameTool.execute(
      { file_path: "src/app.ts", line: 1, column: 10, new_name: "bar", dry_run: false },
      mockContext,
    );

    expect(result.isError).toBe(false);
    // Source outputs "Rename applied: N edits across M files."
    expect(result.output).toContain("Rename applied");
    expect(result.output).toContain("1 edit");
    expect(mockWriteFile).toHaveBeenCalled();
  });

  it("should return helpful message when no rename changes found", async () => {
    mockAcquire.mockResolvedValue({
      rename: vi.fn().mockResolvedValue([]),
    });

    const result = await safeRenameTool.execute(
      { file_path: "src/app.ts", line: 1, column: 1, new_name: "newName" },
      mockContext,
    );

    expect(result.isError).toBe(false);
    // Source outputs "No rename edits generated at ..."
    expect(result.output).toMatch(/No rename edits/);
  });

  it("should fallback for non-existent file when LSP unavailable", async () => {
    mockDetectAvailableServers.mockResolvedValue([]);
    mockReadFile.mockRejectedValue(new Error("ENOENT"));

    const result = await safeRenameTool.execute(
      { file_path: "src/missing.ts", line: 1, column: 1, new_name: "newName" },
      mockContext,
    );

    // Falls back to grep suggestion, not isError: true
    expect(result.isError).toBe(false);
    expect(result.output).toMatch(/LSP is not available|could not/i);
  });

  it("should fallback when LSP is unavailable", async () => {
    // acquireSession returns undefined
    mockDetectAvailableServers.mockResolvedValue([]);
    mockReadFile.mockResolvedValue("function foo() {}\n");

    const result = await safeRenameTool.execute(
      { file_path: "src/app.ts", line: 1, column: 10, new_name: "newName" },
      mockContext,
    );

    expect(result.isError).toBe(false);
    // Falls back to suggestion
    expect(result.output).toContain("LSP is not available");
  });

  it("should handle unsupported file type with fallback", async () => {
    // For unsupported extension, acquireSession returns undefined
    mockReadFile.mockRejectedValue(new Error("ENOENT"));

    const result = await safeRenameTool.execute(
      { file_path: "data/config.xyz", line: 1, column: 1, new_name: "newName" },
      mockContext,
    );

    // Not an error -- falls back
    expect(result.isError).toBe(false);
    expect(result.output).toMatch(/LSP is not available|could not/i);
  });
});
