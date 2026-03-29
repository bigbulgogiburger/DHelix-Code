import { vi, describe, it, expect, beforeEach } from "vitest";

const { mockReadFile } = vi.hoisted(() => ({
  mockReadFile: vi.fn(),
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

import { gotoDefinitionTool } from "../../../../src/tools/definitions/goto-definition.js";
import type { ToolContext } from "../../../../src/tools/types.js";

const mockContext: ToolContext = {
  workingDirectory: "/project",
  abortSignal: new AbortController().signal,
  timeoutMs: 30_000,
  platform: "darwin",
};

describe("goto_definition tool", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDetectAvailableServers.mockResolvedValue(["typescript"]);
  });

  it("should have correct metadata", () => {
    expect(gotoDefinitionTool.name).toBe("goto_definition");
    expect(gotoDefinitionTool.permissionLevel).toBe("safe");
  });

  it("should return definition locations on success", async () => {
    mockAcquire.mockResolvedValue({
      gotoDefinition: vi.fn().mockResolvedValue([
        {
          filePath: "/project/src/utils.ts",
          line: 10,
          column: 5,
          preview: "export function handleSubmit() {",
        },
      ]),
    });

    const result = await gotoDefinitionTool.execute(
      { file_path: "src/app.ts", line: 5, column: 12 },
      mockContext,
    );

    expect(result.isError).toBe(false);
    // Source outputs "Definition of ... found:"
    expect(result.output).toContain("Definition");
    expect(result.output).toContain("found");
    expect(result.output).toContain("utils.ts");
    expect(result.output).toContain("handleSubmit");
  });

  it("should return helpful message when no definition found", async () => {
    mockAcquire.mockResolvedValue({
      gotoDefinition: vi.fn().mockResolvedValue([]),
    });

    const result = await gotoDefinitionTool.execute(
      { file_path: "src/app.ts", line: 1, column: 1 },
      mockContext,
    );

    expect(result.isError).toBe(false);
    // Source outputs "No definition found at ..."
    expect(result.output).toMatch(/No definition found/);
  });

  it("should return fallback message for non-existent file when LSP is unavailable", async () => {
    // When LSP is unavailable (acquireSession returns undefined), tool falls back to grep
    // acquireSession catches errors, so it returns undefined
    mockDetectAvailableServers.mockResolvedValue([]);
    mockReadFile.mockRejectedValue(new Error("ENOENT"));

    const result = await gotoDefinitionTool.execute(
      { file_path: "src/nonexistent.ts", line: 1, column: 1 },
      mockContext,
    );

    // When LSP unavailable and no symbol_name, output says "LSP is not available"
    expect(result.isError).toBe(false);
    expect(result.output).toContain("LSP is not available");
  });

  it("should fallback gracefully when LSP is unavailable", async () => {
    // acquireSession catches errors internally and returns undefined
    mockDetectAvailableServers.mockResolvedValue([]);
    mockReadFile.mockResolvedValue("const x = 1;\nconst y = 2;\n");

    const result = await gotoDefinitionTool.execute(
      { file_path: "src/app.ts", line: 1, column: 7 },
      mockContext,
    );

    expect(result.isError).toBe(false);
    // Falls back with "LSP is not available" message
    expect(result.output).toContain("LSP is not available");
  });

  it("should handle unsupported file type with fallback", async () => {
    // For unsupported extension (.xyz), acquireSession returns undefined (no lang mapping)
    // Then it falls back to grep or "LSP is not available" message
    mockReadFile.mockRejectedValue(new Error("ENOENT"));

    const result = await gotoDefinitionTool.execute(
      { file_path: "data/config.xyz", line: 1, column: 1 },
      mockContext,
    );

    // Not an error -- just falls back
    expect(result.isError).toBe(false);
    expect(result.output).toContain("LSP is not available");
  });
});
