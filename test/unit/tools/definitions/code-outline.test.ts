import { vi, describe, it, expect, beforeEach } from "vitest";

// Use vi.hoisted to create mock functions that can be used in vi.mock factory
const { mockStat, mockReadFile } = vi.hoisted(() => ({
  mockStat: vi.fn(),
  mockReadFile: vi.fn(),
}));

vi.mock("node:fs/promises", async () => {
  const actual = await vi.importActual<typeof import("node:fs/promises")>("node:fs/promises");
  return {
    ...actual,
    stat: mockStat,
    readFile: mockReadFile,
  };
});

import { codeOutlineTool } from "../../../../src/tools/definitions/code-outline.js";
import type { ToolContext } from "../../../../src/tools/types.js";

const mockContext: ToolContext = {
  workingDirectory: "/project",
  abortSignal: new AbortController().signal,
  timeoutMs: 30_000,
  platform: "darwin",
};

describe("code_outline tool", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: file exists and is a regular file with some size
    mockStat.mockResolvedValue({ isFile: () => true, size: 100 });
  });

  it("should have correct metadata", () => {
    expect(codeOutlineTool.name).toBe("code_outline");
    expect(codeOutlineTool.permissionLevel).toBe("safe");
  });

  describe("basic outline", () => {
    it("should return tree-style outline with functions and classes", async () => {
      const tsContent = `
export class App {
  constructor() {}
  render() {
    return "hello";
  }
}

export function createApp() {
  return new App();
}
`.trim();
      mockReadFile.mockResolvedValue(tsContent);

      const result = await codeOutlineTool.execute({ file_path: "src/app.ts" }, mockContext);

      expect(result.isError).toBe(false);
      // Tree-style formatting
      expect(result.output).toMatch(/[├└]/);
      // Symbol names
      expect(result.output).toContain("App");
      expect(result.output).toContain("createApp");
    });
  });

  describe("with imports", () => {
    it("should include imports section when include_imports is true", async () => {
      const tsContent = `
import { useState, useEffect } from "react";
import { formatDate } from "./utils.js";

export function main() {
  return "hello";
}
`.trim();
      mockReadFile.mockResolvedValue(tsContent);

      const result = await codeOutlineTool.execute(
        { file_path: "src/app.ts", include_imports: true },
        mockContext,
      );

      expect(result.isError).toBe(false);
      expect(result.output).toContain("react");
      expect(result.output).toContain("./utils.js");
    });
  });

  describe("without signatures", () => {
    it("should omit signatures when include_signatures is false", async () => {
      const tsContent = `
export function add(a: number, b: number): number {
  return a + b;
}
`.trim();
      mockReadFile.mockResolvedValue(tsContent);

      const resultWith = await codeOutlineTool.execute(
        { file_path: "src/math.ts", include_signatures: true },
        mockContext,
      );

      const resultWithout = await codeOutlineTool.execute(
        { file_path: "src/math.ts", include_signatures: false },
        mockContext,
      );

      expect(resultWith.isError).toBe(false);
      expect(resultWithout.isError).toBe(false);
      // The output without signatures should be shorter or lack type info
      expect(resultWithout.output.length).toBeLessThanOrEqual(resultWith.output.length);
    });
  });

  describe("file not found", () => {
    it("should return a helpful error for non-existent file", async () => {
      mockStat.mockRejectedValue(new Error("ENOENT: no such file or directory"));

      const result = await codeOutlineTool.execute(
        { file_path: "src/nonexistent.ts" },
        mockContext,
      );

      expect(result.isError).toBe(true);
      expect(result.output).toMatch(/[Nn]ot found|[Dd]oes not exist|ENOENT/i);
    });
  });

  describe("unsupported language", () => {
    it("should return fallback outline for unsupported file extension", async () => {
      mockReadFile.mockResolvedValue("some content xyz\n");

      const result = await codeOutlineTool.execute({ file_path: "data/config.xyz" }, mockContext);

      // The tool doesn't error on unsupported files; it returns an outline with Unknown language
      expect(result.isError).toBe(false);
      expect(result.output).toMatch(/Unknown/i);
    });
  });

  describe("empty file", () => {
    it("should report no symbols found for an empty file", async () => {
      mockStat.mockResolvedValue({ isFile: () => true, size: 0 });
      mockReadFile.mockResolvedValue("");

      const result = await codeOutlineTool.execute({ file_path: "src/empty.ts" }, mockContext);

      expect(result.isError).toBe(false);
      // Empty file returns a special message
      expect(result.output).toMatch(/[Ee]mpty file/i);
    });
  });
});
