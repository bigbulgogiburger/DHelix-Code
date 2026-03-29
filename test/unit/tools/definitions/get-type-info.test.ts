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

import { getTypeInfoTool } from "../../../../src/tools/definitions/get-type-info.js";
import type { ToolContext } from "../../../../src/tools/types.js";

const mockContext: ToolContext = {
  workingDirectory: "/project",
  abortSignal: new AbortController().signal,
  timeoutMs: 30_000,
  platform: "darwin",
};

describe("get_type_info tool", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDetectAvailableServers.mockResolvedValue(["typescript"]);
  });

  it("should have correct metadata", () => {
    expect(getTypeInfoTool.name).toBe("get_type_info");
    expect(getTypeInfoTool.permissionLevel).toBe("safe");
  });

  it("should return type information on success", async () => {
    // The session's getTypeInfo returns { type, documentation?, signature? }
    mockAcquire.mockResolvedValue({
      getTypeInfo: vi.fn().mockResolvedValue({
        type: "(method) Array<number>.map<string>(callbackfn: (value: number) => string): string[]",
        documentation: "Calls a defined callback function on each element of an array.",
      }),
    });

    const result = await getTypeInfoTool.execute(
      { file_path: "src/app.ts", line: 10, column: 8 },
      mockContext,
    );

    expect(result.isError).toBe(false);
    expect(result.output).toContain("Type:");
    expect(result.output).toContain("Array<number>.map");
    expect(result.output).toContain("Documentation:");
    expect(result.output).toContain("callback function");
  });

  it("should return type without documentation when none available", async () => {
    mockAcquire.mockResolvedValue({
      getTypeInfo: vi.fn().mockResolvedValue({
        type: "const x: number",
      }),
    });

    const result = await getTypeInfoTool.execute(
      { file_path: "src/app.ts", line: 1, column: 7 },
      mockContext,
    );

    expect(result.isError).toBe(false);
    expect(result.output).toContain("Type: const x: number");
    expect(result.output).not.toContain("Documentation:");
  });

  it("should return helpful message when no type info available", async () => {
    mockAcquire.mockResolvedValue({
      getTypeInfo: vi.fn().mockResolvedValue(undefined),
    });

    const result = await getTypeInfoTool.execute(
      { file_path: "src/app.ts", line: 1, column: 1 },
      mockContext,
    );

    expect(result.isError).toBe(false);
    // Source outputs "No type information available at ..."
    expect(result.output).toMatch(/No type information/);
  });

  it("should fallback for non-existent file when LSP unavailable", async () => {
    // When LSP unavailable (acquireSession returns undefined), falls back to regex extraction
    mockDetectAvailableServers.mockResolvedValue([]);
    mockReadFile.mockRejectedValue(new Error("ENOENT"));

    const result = await getTypeInfoTool.execute(
      { file_path: "src/missing.ts", line: 1, column: 1 },
      mockContext,
    );

    // Falls back to regex extraction which may fail too, but doesn't set isError: true
    expect(result.isError).toBe(false);
    // Output mentions inability to read or fallback
    expect(result.output).toMatch(/Could not|LSP is not available|regex/i);
  });

  it("should fallback gracefully when LSP is unavailable", async () => {
    // acquireSession returns undefined
    mockDetectAvailableServers.mockResolvedValue([]);
    mockReadFile.mockResolvedValue("const x: number = 42;\n");

    const result = await getTypeInfoTool.execute(
      { file_path: "src/app.ts", line: 1, column: 7 },
      mockContext,
    );

    expect(result.isError).toBe(false);
    // Falls back to regex-based type extraction
    expect(result.output).toContain("const x: number = 42;");
    expect(result.output).toContain("LSP is not available");
  });

  it("should handle unsupported file type with fallback", async () => {
    // For unsupported extension, acquireSession returns undefined, falls back to regex
    mockReadFile.mockRejectedValue(new Error("ENOENT"));

    const result = await getTypeInfoTool.execute(
      { file_path: "data/config.xyz", line: 1, column: 1 },
      mockContext,
    );

    // Not an error -- falls back to regex extraction
    expect(result.isError).toBe(false);
  });
});
