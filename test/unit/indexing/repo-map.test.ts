import { describe, it, expect } from "vitest";
import {
  buildRepoMap,
  renderRepoMap,
  RepoMapError,
  type RepoMap,
} from "../../../src/indexing/repo-map.js";
import { join } from "node:path";

describe("repo-map", () => {
  describe("buildRepoMap", () => {
    it("should build repo map from the src directory", async () => {
      const rootDir = join(process.cwd(), "src");
      const map = await buildRepoMap(rootDir);
      expect(map.totalFiles).toBeGreaterThan(0);
      expect(map.totalSymbols).toBeGreaterThan(0);
      expect(map.root).toBe(rootDir);
    });

    it("should extract symbols from TypeScript files", async () => {
      const rootDir = join(process.cwd(), "src");
      const map = await buildRepoMap(rootDir);

      // Should find constants.ts with its exported constants
      const constantsFile = map.files.find((f) => f.path.includes("constants.ts"));
      expect(constantsFile).toBeDefined();
      expect(constantsFile!.symbols.length).toBeGreaterThan(0);
    });

    it("should skip node_modules and dist", async () => {
      const rootDir = process.cwd();
      const map = await buildRepoMap(rootDir);
      const hasNodeModules = map.files.some((f) => f.path.includes("node_modules"));
      const hasDist = map.files.some((f) => f.path.includes("dist"));
      expect(hasNodeModules).toBe(false);
      expect(hasDist).toBe(false);
    });

    it("should handle non-existent directory", async () => {
      const map = await buildRepoMap("/nonexistent/path/that/doesnt/exist");
      expect(map.totalFiles).toBe(0);
      expect(map.totalSymbols).toBe(0);
    });
  });

  describe("renderRepoMap", () => {
    it("should render file-symbol structure", () => {
      const map: RepoMap = {
        root: "/test",
        files: [
          {
            path: "src/index.ts",
            symbols: [
              { name: "main", kind: "function", file: "src/index.ts", line: 1, exported: true },
              { name: "Config", kind: "interface", file: "src/index.ts", line: 10, exported: true },
            ],
            imports: [],
            size: 100,
          },
        ],
        totalSymbols: 2,
        totalFiles: 1,
      };
      const output = renderRepoMap(map, 10000);
      expect(output).toContain("src/index.ts");
      expect(output).toContain("main");
      expect(output).toContain("Config");
    });

    it("should respect token budget", () => {
      const files = [];
      for (let i = 0; i < 100; i++) {
        files.push({
          path: `src/file${i}.ts`,
          symbols: [
            {
              name: `Function${i}`,
              kind: "function" as const,
              file: `src/file${i}.ts`,
              line: 1,
              exported: true,
            },
            {
              name: `Class${i}`,
              kind: "class" as const,
              file: `src/file${i}.ts`,
              line: 10,
              exported: true,
            },
          ],
          imports: [],
          size: 500,
        });
      }
      const map: RepoMap = { root: "/test", files, totalSymbols: 200, totalFiles: 100 };
      const output = renderRepoMap(map, 50);
      // Should be limited to ~200 chars (50 tokens * 4 chars)
      expect(output.length).toBeLessThan(400);
    });

    it("should skip files with no exported symbols", () => {
      const map: RepoMap = {
        root: "/test",
        files: [
          {
            path: "src/internal.ts",
            symbols: [
              {
                name: "helper",
                kind: "function",
                file: "src/internal.ts",
                line: 1,
                exported: false,
              },
            ],
            imports: [],
            size: 50,
          },
        ],
        totalSymbols: 1,
        totalFiles: 1,
      };
      const output = renderRepoMap(map, 10000);
      expect(output).not.toContain("internal.ts");
    });

    it("should have RepoMapError with proper code", () => {
      const err = new RepoMapError("map failed", { root: "/test" });
      expect(err).toBeInstanceOf(Error);
      expect(err.code).toBe("REPO_MAP_ERROR");
      expect(err.message).toBe("map failed");
    });

    it("should return header for empty map", () => {
      const map: RepoMap = { root: "/test", files: [], totalSymbols: 0, totalFiles: 0 };
      const output = renderRepoMap(map, 10000);
      expect(output).toContain("0 files");
    });
  });
});
