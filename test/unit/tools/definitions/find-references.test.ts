import { vi, describe, it, expect, beforeEach } from "vitest";

const { mockReadFile } = vi.hoisted(() => ({
  mockReadFile: vi.fn(),
}));

const { mockAcquire, mockDetectAvailableServers } = vi.hoisted(() => ({
  mockAcquire: vi.fn(),
  mockDetectAvailableServers: vi.fn(),
}));

const { mockExecFileAsync } = vi.hoisted(() => ({
  mockExecFileAsync: vi.fn(),
}));

vi.mock("node:fs/promises", async () => {
  const actual = await vi.importActual<typeof import("node:fs/promises")>("node:fs/promises");
  return {
    ...actual,
    readFile: mockReadFile,
  };
});

vi.mock("../../../../src/lsp/manager.js", () => ({
  getLSPManager: vi.fn(() => ({
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

import { findReferencesTool } from "../../../../src/tools/definitions/find-references.js";
import type { ToolContext } from "../../../../src/tools/types.js";

const mockContext: ToolContext = {
  workingDirectory: "/project",
  abortSignal: new AbortController().signal,
  timeoutMs: 30_000,
  platform: "darwin",
};

describe("find_references tool", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDetectAvailableServers.mockResolvedValue(["typescript"]);
  });

  it("should have correct metadata", () => {
    expect(findReferencesTool.name).toBe("find_references");
    expect(findReferencesTool.permissionLevel).toBe("safe");
  });

  it("should return references on success", async () => {
    mockAcquire.mockResolvedValue({
      findReferences: vi.fn().mockResolvedValue([
        { filePath: "/project/src/a.ts", line: 1, column: 10, context: "import { foo } from", isDefinition: false },
        { filePath: "/project/src/b.ts", line: 5, column: 3, context: "foo()", isDefinition: false },
        { filePath: "/project/src/c.ts", line: 12, column: 7, context: "const x = foo()", isDefinition: false },
      ]),
    });

    const result = await findReferencesTool.execute(
      { file_path: "src/utils.ts", line: 3, column: 17 },
      mockContext,
    );

    expect(result.isError).toBe(false);
    // Source outputs "Found 3 references (0 definitions, 3 usages) across N files:"
    expect(result.output).toContain("Found 3 reference");
    expect(result.output).toContain("src/a.ts");
    expect(result.output).toContain("src/b.ts");
    expect(result.output).toContain("src/c.ts");
  });

  it("should return helpful message when no references found", async () => {
    mockAcquire.mockResolvedValue({
      findReferences: vi.fn().mockResolvedValue([]),
    });

    const result = await findReferencesTool.execute(
      { file_path: "src/app.ts", line: 1, column: 1 },
      mockContext,
    );

    expect(result.isError).toBe(false);
    expect(result.output).toMatch(/No references found/);
  });

  it("should fallback to grep for non-existent file when LSP unavailable", async () => {
    // When LSP is unavailable, falls back to extractSymbolAtPosition + grep
    mockDetectAvailableServers.mockResolvedValue([]);
    mockReadFile.mockRejectedValue(new Error("ENOENT"));

    const result = await findReferencesTool.execute(
      { file_path: "src/missing.ts", line: 1, column: 1 },
      mockContext,
    );

    // Falls back to grep, doesn't return isError: true
    expect(result.isError).toBe(false);
    // Output contains grep fallback message
    expect(result.output).toMatch(/No references found|grep fallback|LSP is not available/);
  });

  it("should fallback gracefully when LSP is unavailable", async () => {
    // acquireSession returns undefined when LSP unavailable
    mockDetectAvailableServers.mockResolvedValue([]);
    mockReadFile.mockResolvedValue("function hello() {}\nhello();\n");

    const result = await findReferencesTool.execute(
      { file_path: "src/app.ts", line: 1, column: 10 },
      mockContext,
    );

    expect(result.isError).toBe(false);
    // Falls back to grep with "No references found" or "grep fallback" message
    expect(result.output).toMatch(/references|grep/i);
  });

  it("should pass include_declaration option to LSP server", async () => {
    const mockFindRefs = vi.fn().mockResolvedValue([]);
    mockAcquire.mockResolvedValue({
      findReferences: mockFindRefs,
    });

    await findReferencesTool.execute(
      { file_path: "src/app.ts", line: 1, column: 1, include_declaration: false },
      mockContext,
    );

    expect(mockFindRefs).toHaveBeenCalledWith(
      expect.any(String),
      1,
      1,
      false,
    );
  });

  it("should handle unsupported file type with fallback", async () => {
    // For unsupported extension, acquireSession returns undefined, falls back to grep
    mockReadFile.mockRejectedValue(new Error("ENOENT"));

    const result = await findReferencesTool.execute(
      { file_path: "data/config.xyz", line: 1, column: 1 },
      mockContext,
    );

    // Not an error -- falls back to grep
    expect(result.isError).toBe(false);
    expect(result.output).toMatch(/No references found|grep fallback|LSP is not available/);
  });
});
