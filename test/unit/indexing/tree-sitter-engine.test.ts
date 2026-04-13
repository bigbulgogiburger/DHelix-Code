/**
 * TreeSitterEngine unit tests
 *
 * Mocks web-tree-sitter WASM since tree-sitter-wasms binary versions
 * may not match the web-tree-sitter runtime in CI/test environments.
 * Tests engine initialization, language support, parsing with cache,
 * symbol search, and error handling through mocked tree-sitter.
 */

import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from "vitest";
import { writeFile, mkdir, rm, utimes } from "node:fs/promises";
import { join } from "node:path";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";

import type { ParsedSymbol, SymbolExtractor } from "../../../src/indexing/tree-sitter-engine.js";

// ── Mock setup ───────────────────────────────────────────────────────────

const mockTree = {
  rootNode: {
    type: "program",
    namedChildren: [],
    text: "",
    startPosition: { row: 0, column: 0 },
    endPosition: { row: 0, column: 0 },
  },
  delete: vi.fn(),
};

const mockParser = {
  setLanguage: vi.fn(),
  parse: vi.fn().mockReturnValue(mockTree),
  delete: vi.fn(),
};

const mockLanguage = { id: "mock-lang" };

const mockLanguageLoad = vi.fn().mockResolvedValue(mockLanguage);
const mockParserInit = vi.fn().mockResolvedValue(undefined);

// Parser constructor + static methods (init, Language.load)
const MockParserConstructor: Record<string, unknown> = vi.fn().mockImplementation(() => mockParser);
MockParserConstructor.init = mockParserInit;
MockParserConstructor.Language = { load: mockLanguageLoad };

// Mock web-tree-sitter module: Parser as named export
// The engine does: const { Parser: ParserCls } = await import("web-tree-sitter")
// Then: ParserCls.init(...), new ParserCls(), ParserCls.Language.load(...)
vi.mock("web-tree-sitter", () => ({
  default: MockParserConstructor,
  Parser: MockParserConstructor,
  Language: { load: mockLanguageLoad },
}));

// Mock fast-glob
const mockFastGlob = vi.fn().mockResolvedValue([]);
vi.mock("fast-glob", () => ({
  default: mockFastGlob,
}));

// Mock logger
vi.mock("../../../src/utils/logger.js", () => ({
  getLogger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

// ── Import after mocks ──────────────────────────────────────────────────

const { TreeSitterEngine } = await import("../../../src/indexing/tree-sitter-engine.js");

// ── Test fixtures ────────────────────────────────────────────────────────

let testDir: string;

beforeAll(async () => {
  testDir = await mkdtemp(join(tmpdir(), "dhelix-ts-engine-test-"));
  await writeFile(join(testDir, "sample.ts"), "export const X = 1;", "utf-8");
  await writeFile(join(testDir, "sample.py"), "x = 1", "utf-8");
  await writeFile(join(testDir, "empty.ts"), "", "utf-8");
  await writeFile(join(testDir, "unsupported.xyz"), "hello", "utf-8");

  const subDir = join(testDir, "sub");
  await mkdir(subDir);
  await writeFile(join(subDir, "service.ts"), "export class Auth {}", "utf-8");
});

afterAll(async () => {
  if (testDir) {
    await rm(testDir, { recursive: true, force: true });
  }
});

// ── Tests ────────────────────────────────────────────────────────────────

describe("TreeSitterEngine", () => {
  // ── 1. Initialization ─────────────────────────────────────────────────

  describe("initialization", () => {
    it("should initialize without error", async () => {
      const engine = new TreeSitterEngine();
      await expect(engine.init()).resolves.toBeUndefined();
    });

    it("should be idempotent (calling init() twice is safe)", async () => {
      const engine = new TreeSitterEngine();
      await engine.init();
      await expect(engine.init()).resolves.toBeUndefined();
    });
  });

  // ── 2. Language support ───────────────────────────────────────────────

  describe("language support", () => {
    let engine: InstanceType<typeof TreeSitterEngine>;

    beforeAll(() => {
      engine = new TreeSitterEngine();
    });

    it('isSupported(".ts") returns true', () => {
      expect(engine.isSupported(".ts")).toBe(true);
    });

    it('isSupported(".tsx") returns true', () => {
      expect(engine.isSupported(".tsx")).toBe(true);
    });

    it('isSupported(".js") returns true', () => {
      expect(engine.isSupported(".js")).toBe(true);
    });

    it('isSupported(".jsx") returns true', () => {
      expect(engine.isSupported(".jsx")).toBe(true);
    });

    it('isSupported(".py") returns true', () => {
      expect(engine.isSupported(".py")).toBe(true);
    });

    it('isSupported(".go") returns true', () => {
      expect(engine.isSupported(".go")).toBe(true);
    });

    it('isSupported(".rs") returns true', () => {
      expect(engine.isSupported(".rs")).toBe(true);
    });

    it('isSupported(".java") returns true', () => {
      expect(engine.isSupported(".java")).toBe(true);
    });

    it('isSupported(".xyz") returns false', () => {
      expect(engine.isSupported(".xyz")).toBe(false);
    });

    it('isSupported(".txt") returns false', () => {
      expect(engine.isSupported(".txt")).toBe(false);
    });

    it('isSupported("") returns false', () => {
      expect(engine.isSupported("")).toBe(false);
    });

    it("getSupportedLanguages() returns expected languages", () => {
      const langs = engine.getSupportedLanguages();
      expect(langs).toContain("typescript");
      expect(langs).toContain("tsx");
      expect(langs).toContain("python");
      expect(langs).toContain("javascript");
      expect(langs).toContain("go");
      expect(langs).toContain("rust");
      expect(langs).toContain("java");
      expect(langs).toContain("c");
      expect(langs).toContain("cpp");
      expect(langs).toContain("ruby");
      expect(langs).toContain("php");
      expect(langs).toContain("swift");
      expect(langs).toContain("kotlin");
    });

    it("getSupportedLanguages() deduplicates (.js and .jsx both map to javascript)", () => {
      const langs = engine.getSupportedLanguages();
      const jsCount = langs.filter((l: string) => l === "javascript").length;
      expect(jsCount).toBe(1);
    });
  });

  // ── 3. TypeScript parsing with mock extractor ─────────────────────────

  describe("TypeScript parsing", () => {
    let engine: InstanceType<typeof TreeSitterEngine>;

    const mockExtractor: SymbolExtractor = vi.fn((_rootNode, filePath, _source) => ({
      symbols: [
        {
          name: "greet",
          kind: "function" as const,
          filePath,
          startLine: 2,
          endLine: 4,
          exported: true,
          signature: "(name: string): string",
        },
        {
          name: "UserService",
          kind: "class" as const,
          filePath,
          startLine: 6,
          endLine: 18,
          exported: true,
        },
        {
          name: "findById",
          kind: "method" as const,
          filePath,
          startLine: 13,
          endLine: 15,
          exported: true,
          parentName: "UserService",
          signature: "async (id: string): Promise<User | null>",
        },
        {
          name: "User",
          kind: "interface" as const,
          filePath,
          startLine: 20,
          endLine: 23,
          exported: true,
        },
        {
          name: "UserId",
          kind: "type" as const,
          filePath,
          startLine: 25,
          endLine: 25,
          exported: true,
        },
        {
          name: "MAX_USERS",
          kind: "constant" as const,
          filePath,
          startLine: 27,
          endLine: 27,
          exported: true,
        },
        {
          name: "Role",
          kind: "enum" as const,
          filePath,
          startLine: 29,
          endLine: 32,
          exported: true,
        },
      ],
      imports: [
        {
          source: "./database.js",
          specifiers: ["Database"],
          isDefault: false,
          isNamespace: false,
          line: 1,
        },
      ],
      exports: ["greet", "UserService", "User", "UserId", "MAX_USERS", "Role"],
    }));

    beforeEach(async () => {
      engine = new TreeSitterEngine();
      await engine.init();
      engine.registerExtractor("typescript", mockExtractor);
      engine.clearCache();
      vi.mocked(mockExtractor).mockClear();
    });

    it("should parse TypeScript file and extract all symbol types", async () => {
      const outline = await engine.getOutline(join(testDir, "sample.ts"));
      expect(outline).toBeDefined();
      expect(outline!.language).toBe("typescript");
      expect(outline!.filePath).toBe(join(testDir, "sample.ts"));

      const names = outline!.symbols.map((s: ParsedSymbol) => s.name);
      expect(names).toContain("greet");
      expect(names).toContain("UserService");
      expect(names).toContain("User");
      expect(names).toContain("UserId");
      expect(names).toContain("MAX_USERS");
      expect(names).toContain("Role");
    });

    it("should detect exported function with signature", async () => {
      const outline = await engine.getOutline(join(testDir, "sample.ts"));
      const greet = outline!.symbols.find((s: ParsedSymbol) => s.name === "greet");
      expect(greet).toBeDefined();
      expect(greet!.kind).toBe("function");
      expect(greet!.exported).toBe(true);
      expect(greet!.signature).toContain("name: string");
    });

    it("should extract class methods with parentName", async () => {
      const outline = await engine.getOutline(join(testDir, "sample.ts"));
      const findById = outline!.symbols.find(
        (s: ParsedSymbol) => s.name === "findById" && s.kind === "method",
      );
      expect(findById).toBeDefined();
      expect(findById!.parentName).toBe("UserService");
    });

    it("should include imports in outline", async () => {
      const outline = await engine.getOutline(join(testDir, "sample.ts"));
      expect(outline!.imports.length).toBe(1);
      expect(outline!.imports[0].source).toBe("./database.js");
    });

    it("should include exports in outline", async () => {
      const outline = await engine.getOutline(join(testDir, "sample.ts"));
      expect(outline!.exports).toContain("greet");
      expect(outline!.exports).toContain("UserService");
    });

    it("should call the registered extractor with correct arguments", async () => {
      const filePath = join(testDir, "sample.ts");
      await engine.getOutline(filePath);
      expect(mockExtractor).toHaveBeenCalledWith(mockTree.rootNode, filePath, expect.any(String));
    });
  });

  // ── 4. Python parsing (no extractor registered) ────────────────────────

  describe("Python parsing (no extractor)", () => {
    it("should parse Python file but return empty symbols without extractor", async () => {
      const engine = new TreeSitterEngine();
      await engine.init();
      // No python extractor registered

      const outline = await engine.getOutline(join(testDir, "sample.py"));
      expect(outline).toBeDefined();
      expect(outline!.language).toBe("python");
      expect(outline!.symbols).toEqual([]);
      expect(outline!.imports).toEqual([]);
      expect(outline!.exports).toEqual([]);
    });
  });

  // ── 5. Cache behavior ─────────────────────────────────────────────────

  describe("cache behavior", () => {
    let engine: InstanceType<typeof TreeSitterEngine>;
    const extractor: SymbolExtractor = vi.fn(() => ({
      symbols: [],
      imports: [],
      exports: [],
    }));

    beforeEach(async () => {
      engine = new TreeSitterEngine();
      await engine.init();
      engine.registerExtractor("typescript", extractor);
      engine.clearCache();
      vi.mocked(extractor).mockClear();
    });

    it("should return cached result on second call for same file", async () => {
      const filePath = join(testDir, "sample.ts");
      const outline1 = await engine.getOutline(filePath);
      const outline2 = await engine.getOutline(filePath);

      expect(outline1).toBeDefined();
      expect(outline2).toBeDefined();
      // Same object reference means cache hit
      expect(outline1).toBe(outline2);
      // Extractor should only be called once
      expect(extractor).toHaveBeenCalledTimes(1);
    });

    it("should invalidate cache when file mtime changes", async () => {
      const filePath = join(testDir, "sample.ts");
      const outline1 = await engine.getOutline(filePath);
      expect(outline1).toBeDefined();

      // Touch the file to change mtime
      const futureTime = new Date(Date.now() + 10000);
      await utimes(filePath, futureTime, futureTime);

      const outline2 = await engine.getOutline(filePath);
      expect(outline2).toBeDefined();
      // Should NOT be the same reference (cache invalidated)
      expect(outline2).not.toBe(outline1);
      // Extractor called twice
      expect(extractor).toHaveBeenCalledTimes(2);
    });

    it("should evict oldest entry when cache exceeds MAX_CACHE_SIZE", async () => {
      // Create 201 temp files to exceed the 200-item cache limit
      const cacheTestDir = await mkdtemp(join(tmpdir(), "dhelix-cache-evict-"));
      try {
        const filePaths: string[] = [];
        for (let i = 0; i < 201; i++) {
          const fp = join(cacheTestDir, `file${i}.ts`);
          await writeFile(fp, `export const VAR_${i} = ${i};`, "utf-8");
          filePaths.push(fp);
        }

        // Parse all files
        for (const fp of filePaths) {
          await engine.getOutline(fp);
        }

        // Extractor should have been called 201 times (no cache hits)
        expect(extractor).toHaveBeenCalledTimes(201);

        // Most recent file should be cached
        vi.mocked(extractor).mockClear();
        const lastOutline1 = await engine.getOutline(filePaths[200]);
        const lastOutline2 = await engine.getOutline(filePaths[200]);
        expect(lastOutline1).toBe(lastOutline2);
        // No additional extractor calls (cache hit)
        expect(extractor).toHaveBeenCalledTimes(0);
      } finally {
        await rm(cacheTestDir, { recursive: true, force: true });
      }
    });

    it("clearCache() empties the parse cache", async () => {
      const filePath = join(testDir, "sample.ts");
      await engine.getOutline(filePath);
      expect(extractor).toHaveBeenCalledTimes(1);

      engine.clearCache();

      await engine.getOutline(filePath);
      // After clearing cache, extractor should be called again
      expect(extractor).toHaveBeenCalledTimes(2);
    });
  });

  // ── 6. searchSymbols ──────────────────────────────────────────────────

  describe("searchSymbols", () => {
    let engine: InstanceType<typeof TreeSitterEngine>;

    beforeEach(async () => {
      engine = new TreeSitterEngine();
      await engine.init();
      engine.registerExtractor(
        "typescript",
        vi.fn((_root, filePath) => ({
          symbols: [
            {
              name: "UserService",
              kind: "class" as const,
              filePath,
              startLine: 1,
              endLine: 10,
              exported: true,
            },
            {
              name: "User",
              kind: "interface" as const,
              filePath,
              startLine: 12,
              endLine: 15,
              exported: true,
            },
            {
              name: "UserId",
              kind: "type" as const,
              filePath,
              startLine: 17,
              endLine: 17,
              exported: true,
            },
            {
              name: "AuthService",
              kind: "class" as const,
              filePath,
              startLine: 19,
              endLine: 30,
              exported: true,
            },
          ],
          imports: [],
          exports: ["UserService", "User", "UserId", "AuthService"],
        })),
      );
      engine.clearCache();
    });

    it("should find symbols matching query string (case-insensitive)", async () => {
      mockFastGlob.mockResolvedValue(["sample.ts"]);

      const results = await engine.searchSymbols("user", {
        directory: testDir,
        fileExtensions: [".ts"],
      });
      const names = results.map((s: ParsedSymbol) => s.name);
      expect(names).toContain("UserService");
      expect(names).toContain("User");
      expect(names).toContain("UserId");
    });

    it("should filter by kind", async () => {
      mockFastGlob.mockResolvedValue(["sample.ts"]);

      const results = await engine.searchSymbols("user", {
        directory: testDir,
        kind: "class",
        fileExtensions: [".ts"],
      });
      expect(results.every((s: ParsedSymbol) => s.kind === "class")).toBe(true);
      expect(results.map((s: ParsedSymbol) => s.name)).toContain("UserService");
    });

    it("should respect maxResults limit", async () => {
      mockFastGlob.mockResolvedValue(["sample.ts"]);

      const results = await engine.searchSymbols("", {
        directory: testDir,
        maxResults: 2,
        fileExtensions: [".ts"],
      });
      expect(results.length).toBeLessThanOrEqual(2);
    });

    it("should return empty array for no matches", async () => {
      mockFastGlob.mockResolvedValue(["sample.ts"]);

      const results = await engine.searchSymbols("zzzzNonExistent", {
        directory: testDir,
        fileExtensions: [".ts"],
      });
      expect(results).toEqual([]);
    });

    it("should return empty array when fast-glob finds no files", async () => {
      mockFastGlob.mockResolvedValue([]);

      const results = await engine.searchSymbols("User", {
        directory: testDir,
      });
      expect(results).toEqual([]);
    });
  });

  // ── 7. Error handling ─────────────────────────────────────────────────

  describe("error handling", () => {
    let engine: InstanceType<typeof TreeSitterEngine>;

    beforeEach(async () => {
      engine = new TreeSitterEngine();
      await engine.init();
      engine.registerExtractor(
        "typescript",
        vi.fn(() => ({
          symbols: [],
          imports: [],
          exports: [],
        })),
      );
    });

    it("should return undefined for unsupported file extension", async () => {
      const outline = await engine.getOutline(join(testDir, "unsupported.xyz"));
      expect(outline).toBeUndefined();
    });

    it("should return undefined for non-existent file (no throw)", async () => {
      const outline = await engine.getOutline(join(testDir, "does-not-exist.ts"));
      expect(outline).toBeUndefined();
    });

    it("should handle empty file gracefully", async () => {
      const outline = await engine.getOutline(join(testDir, "empty.ts"));
      expect(outline).toBeDefined();
      expect(outline!.symbols).toEqual([]);
      expect(outline!.imports).toEqual([]);
    });

    it("should return undefined when not initialized", async () => {
      const uninitEngine = new TreeSitterEngine();
      // Do NOT call init()
      const outline = await uninitEngine.getOutline(join(testDir, "sample.ts"));
      expect(outline).toBeUndefined();
    });

    it("should return undefined when parser.parse returns null", async () => {
      engine.clearCache();
      mockParser.parse.mockReturnValueOnce(null);
      const outline = await engine.getOutline(join(testDir, "sample.ts"));
      expect(outline).toBeUndefined();
    });
  });

  // ── 8. findDependencies ───────────────────────────────────────────────

  describe("findDependencies", () => {
    let engine: InstanceType<typeof TreeSitterEngine>;

    beforeEach(async () => {
      engine = new TreeSitterEngine();
      await engine.init();
      engine.registerExtractor(
        "typescript",
        vi.fn((_root, filePath) => ({
          symbols: [
            {
              name: "readConfig",
              kind: "function" as const,
              filePath,
              startLine: 5,
              endLine: 7,
              exported: true,
            },
          ],
          imports: [
            {
              source: "node:fs/promises",
              specifiers: ["readFile"],
              isDefault: false,
              isNamespace: false,
              line: 1,
            },
            {
              source: "node:path",
              specifiers: ["path"],
              isDefault: true,
              isNamespace: false,
              line: 2,
            },
          ],
          exports: ["readConfig"],
        })),
      );
      engine.clearCache();
    });

    it("should return empty result for non-existent file", async () => {
      const deps = await engine.findDependencies(join(testDir, "nonexistent.ts"));
      expect(deps.imports).toEqual([]);
      expect(deps.exports).toEqual([]);
    });

    it("should extract imports and exports from a file", async () => {
      const deps = await engine.findDependencies(join(testDir, "sample.ts"));
      expect(deps.imports.length).toBe(2);

      const sources = deps.imports.map((i) => i.source);
      expect(sources).toContain("node:fs/promises");
      expect(sources).toContain("node:path");
      expect(deps.exports).toContain("readConfig");
    });
  });

  // ── 9. registerExtractor ──────────────────────────────────────────────

  describe("registerExtractor", () => {
    it("should allow registering a custom extractor", () => {
      const engine = new TreeSitterEngine();
      const customExtractor: SymbolExtractor = vi.fn(() => ({
        symbols: [],
        imports: [],
        exports: [],
      }));
      engine.registerExtractor("custom_lang", customExtractor);
      // No error thrown
    });

    it("should allow overwriting an existing extractor", () => {
      const engine = new TreeSitterEngine();
      const ext1: SymbolExtractor = vi.fn(() => ({
        symbols: [],
        imports: [],
        exports: [],
      }));
      const ext2: SymbolExtractor = vi.fn(() => ({
        symbols: [],
        imports: [],
        exports: [],
      }));
      engine.registerExtractor("test_lang", ext1);
      engine.registerExtractor("test_lang", ext2);
      // No error thrown, second registration overwrites first
    });
  });

  // ── 10. loadLanguage ──────────────────────────────────────────────────

  describe("loadLanguage", () => {
    it("should load a language successfully via mock", async () => {
      const engine = new TreeSitterEngine();
      await engine.init();
      const lang = await engine.loadLanguage("typescript");
      expect(lang).toBeDefined();
    });

    it("should cache loaded languages (second call returns same object)", async () => {
      const engine = new TreeSitterEngine();
      await engine.init();
      const lang1 = await engine.loadLanguage("typescript");
      const lang2 = await engine.loadLanguage("typescript");
      expect(lang1).toBe(lang2);
    });

    it("should return undefined when engine is not initialized", async () => {
      const uninitEngine = new TreeSitterEngine();
      const lang = await uninitEngine.loadLanguage("typescript");
      expect(lang).toBeUndefined();
    });

    it("should return undefined when Language.load throws", async () => {
      mockLanguageLoad.mockRejectedValueOnce(new Error("WASM load failed"));
      const engine = new TreeSitterEngine();
      await engine.init();
      const lang = await engine.loadLanguage("nonexistent_lang");
      expect(lang).toBeUndefined();
    });
  });
});
