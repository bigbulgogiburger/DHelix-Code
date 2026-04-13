import { vi, describe, it, expect, beforeEach } from "vitest";

// Use vi.hoisted to create mock functions that can be used in vi.mock factory
const { mockBuildRepoMap } = vi.hoisted(() => ({
  mockBuildRepoMap: vi.fn(),
}));

vi.mock("../../../../src/indexing/repo-map.js", () => ({
  buildRepoMap: mockBuildRepoMap,
}));

// Mock readFile for signature extraction
vi.mock("node:fs/promises", async () => {
  const actual = await vi.importActual<typeof import("node:fs/promises")>("node:fs/promises");
  return {
    ...actual,
    readFile: vi.fn().mockResolvedValue("export function handleSubmit() {\n}\n"),
  };
});

import { symbolSearchTool } from "../../../../src/tools/definitions/symbol-search.js";
import type { ToolContext } from "../../../../src/tools/types.js";

const mockContext: ToolContext = {
  workingDirectory: "/project",
  abortSignal: new AbortController().signal,
  timeoutMs: 30_000,
  platform: "darwin",
};

describe("symbol_search tool", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should have correct metadata", () => {
    expect(symbolSearchTool.name).toBe("symbol_search");
    expect(symbolSearchTool.permissionLevel).toBe("safe");
  });

  describe("basic search", () => {
    it("should return matching symbols with names, paths, and line numbers", async () => {
      mockBuildRepoMap.mockResolvedValue({
        root: "/project",
        totalFiles: 3,
        totalSymbols: 5,
        files: [
          {
            filePath: "src/form.ts",
            symbols: [
              {
                name: "handleSubmit",
                kind: "function",
                file: "src/form.ts",
                line: 42,
                exported: true,
              },
              {
                name: "handleSubmitError",
                kind: "function",
                file: "src/form.ts",
                line: 78,
                exported: false,
              },
            ],
            imports: [],
          },
          {
            filePath: "src/utils.ts",
            symbols: [
              {
                name: "handleSubmitSuccess",
                kind: "function",
                file: "src/utils.ts",
                line: 15,
                exported: true,
              },
            ],
            imports: [],
          },
        ],
      });

      const result = await symbolSearchTool.execute({ query: "handleSubmit" }, mockContext);

      expect(result.isError).toBe(false);
      expect(result.output).toContain("handleSubmit");
      expect(result.output).toContain("handleSubmitError");
      expect(result.output).toContain("handleSubmitSuccess");
      expect(result.output).toContain("form.ts");
      expect(result.output).toContain("utils.ts");
      // Line numbers should appear
      expect(result.output).toMatch(/42/);
      expect(result.output).toMatch(/78/);
      expect(result.output).toMatch(/15/);
      // Metadata
      expect(result.metadata?.resultCount).toBe(3);
    });
  });

  describe("kind filter", () => {
    it("should return only symbols matching the specified kind", async () => {
      mockBuildRepoMap.mockResolvedValue({
        root: "/project",
        totalFiles: 1,
        totalSymbols: 2,
        files: [
          {
            filePath: "src/models/user.ts",
            symbols: [
              {
                name: "User",
                kind: "class",
                file: "src/models/user.ts",
                line: 10,
                exported: true,
              },
              {
                name: "createUser",
                kind: "function",
                file: "src/models/user.ts",
                line: 30,
                exported: true,
              },
            ],
            imports: [],
          },
        ],
      });

      const result = await symbolSearchTool.execute({ query: "User", kind: "class" }, mockContext);

      expect(result.isError).toBe(false);
      expect(result.output).toContain("User");
      expect(result.output).toContain("class");
      expect(result.metadata?.resultCount).toBe(1);
    });
  });

  describe("exported_only filter", () => {
    it("should exclude non-exported symbols when exported_only is true", async () => {
      mockBuildRepoMap.mockResolvedValue({
        root: "/project",
        totalFiles: 1,
        totalSymbols: 2,
        files: [
          {
            filePath: "src/helpers.ts",
            symbols: [
              {
                name: "PublicHelper",
                kind: "function",
                file: "src/helpers.ts",
                line: 5,
                exported: true,
              },
              {
                name: "PrivateHelper",
                kind: "function",
                file: "src/helpers.ts",
                line: 20,
                exported: false,
              },
            ],
            imports: [],
          },
        ],
      });

      const result = await symbolSearchTool.execute(
        { query: "Helper", exported_only: true },
        mockContext,
      );

      expect(result.isError).toBe(false);
      expect(result.output).toContain("PublicHelper");
      // Non-exported symbols should have been filtered
      expect(result.metadata?.resultCount).toBe(1);
    });
  });

  describe("max_results limit", () => {
    it("should cap results to the specified max_results", async () => {
      const symbols = Array.from({ length: 50 }, (_, i) => ({
        name: `symbol_${i}`,
        kind: "function" as const,
        file: `src/file_${i}.ts`,
        line: i + 1,
        exported: true,
      }));
      mockBuildRepoMap.mockResolvedValue({
        root: "/project",
        totalFiles: 50,
        totalSymbols: 50,
        files: [
          {
            filePath: "src/all.ts",
            symbols,
            imports: [],
          },
        ],
      });

      const result = await symbolSearchTool.execute(
        { query: "symbol", max_results: 10 },
        mockContext,
      );

      expect(result.isError).toBe(false);
      expect(result.metadata?.resultCount).toBeLessThanOrEqual(10);
    });
  });

  describe("no results", () => {
    it("should return a helpful message when no symbols found", async () => {
      mockBuildRepoMap.mockResolvedValue({
        root: "/project",
        totalFiles: 5,
        totalSymbols: 10,
        files: [
          {
            filePath: "src/app.ts",
            symbols: [
              {
                name: "main",
                kind: "function",
                file: "src/app.ts",
                line: 1,
                exported: true,
              },
            ],
            imports: [],
          },
        ],
      });

      const result = await symbolSearchTool.execute(
        { query: "nonExistentSymbol_xyz" },
        mockContext,
      );

      expect(result.isError).toBe(false);
      expect(result.output).toMatch(/[Nn]o symbols found/i);
    });
  });

  describe("fallback on engine failure", () => {
    it("should handle engine errors gracefully with fallback or helpful message", async () => {
      mockBuildRepoMap.mockRejectedValue(new Error("WASM initialization failed"));

      const result = await symbolSearchTool.execute({ query: "handleSubmit" }, mockContext);

      // Should not crash — either falls back to grep or returns a message
      expect(result.isError).toBeDefined();
      expect(typeof result.output).toBe("string");
      expect(result.output.length).toBeGreaterThan(0);
    });
  });
});
