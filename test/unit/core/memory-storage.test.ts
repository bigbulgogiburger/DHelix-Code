import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm, readFile, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

import {
  getMemoryPaths,
  readMainMemory,
  writeMainMemory,
  readTopicMemory,
  writeTopicMemory,
  listMemoryFiles,
  deleteMemoryFile,
  readGlobalMemory,
  writeGlobalMemory,
  MemoryStorageError,
  type MemoryConfig,
} from "../../../src/core/memory-storage.js";

describe("memory-storage", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "dbcode-mem-test-"));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  /**
   * Helper to create a MemoryConfig pointing at the temp directory.
   */
  function makeConfig(overrides?: Partial<MemoryConfig>): MemoryConfig {
    return {
      projectDir: tempDir,
      globalDir: join(tempDir, "global-memory"),
      maxMainLines: overrides?.maxMainLines ?? 200,
      maxTopicLines: overrides?.maxTopicLines ?? 500,
      ...overrides,
    };
  }

  // -----------------------------------------------------------------------
  // getMemoryPaths
  // -----------------------------------------------------------------------

  describe("getMemoryPaths()", () => {
    it("returns correct structure for a project directory", () => {
      const paths = getMemoryPaths("/some/project");

      expect(paths).toHaveProperty("projectDir");
      expect(paths).toHaveProperty("globalDir");
      expect(paths).toHaveProperty("maxMainLines");
      expect(paths).toHaveProperty("maxTopicLines");
      expect(paths.maxMainLines).toBe(200);
      expect(paths.maxTopicLines).toBe(500);
    });

    it("normalizes the project directory path", () => {
      const paths = getMemoryPaths("/some/project");
      // normalizePath converts backslashes to forward slashes on Windows
      expect(paths.projectDir).not.toContain("\\");
    });

    it("sets globalDir under the user home directory", () => {
      const paths = getMemoryPaths("/any/dir");
      expect(paths.globalDir).toContain("dbcode");
      expect(paths.globalDir).toContain("memory");
    });
  });

  // -----------------------------------------------------------------------
  // writeMainMemory + readMainMemory
  // -----------------------------------------------------------------------

  describe("writeMainMemory()", () => {
    it("creates MEMORY.md and directories if they don't exist", async () => {
      const config = makeConfig();
      await writeMainMemory(config, "# Project Memory\n\nSome notes.");

      // Verify the file was created
      const memDir = join(tempDir, ".dbcode", "memory");
      const content = await readFile(join(memDir, "MEMORY.md"), "utf-8");
      expect(content).toBe("# Project Memory\n\nSome notes.");
    });

    it("overwrites existing content", async () => {
      const config = makeConfig();
      await writeMainMemory(config, "first content");
      await writeMainMemory(config, "second content");

      const result = await readMainMemory(config);
      expect(result).toBe("second content");
    });
  });

  describe("readMainMemory()", () => {
    it("returns empty string for non-existent file", async () => {
      const config = makeConfig();
      const result = await readMainMemory(config);
      expect(result).toBe("");
    });

    it("truncates to maxMainLines", async () => {
      const config = makeConfig({ maxMainLines: 5 });
      const lines = Array.from({ length: 10 }, (_, i) => `Line ${i + 1}`);
      await writeMainMemory(config, lines.join("\n"));

      const result = await readMainMemory(config);
      const resultLines = result.split("\n");
      expect(resultLines).toHaveLength(5);
      expect(resultLines[0]).toBe("Line 1");
      expect(resultLines[4]).toBe("Line 5");
    });

    it("returns full content when within line limit", async () => {
      const config = makeConfig({ maxMainLines: 200 });
      const content = "# Memory\n\nJust a few lines.";
      await writeMainMemory(config, content);

      const result = await readMainMemory(config);
      expect(result).toBe(content);
    });

    it("roundtrips content correctly", async () => {
      const config = makeConfig();
      const original = "# Project Memory\n\n## Architecture\n\n- ESM only\n- TypeScript 5.x";
      await writeMainMemory(config, original);

      const retrieved = await readMainMemory(config);
      expect(retrieved).toBe(original);
    });
  });

  // -----------------------------------------------------------------------
  // writeTopicMemory + readTopicMemory
  // -----------------------------------------------------------------------

  describe("writeTopicMemory()", () => {
    it("creates topic file in memory directory", async () => {
      const config = makeConfig();
      await writeTopicMemory(config, "debugging", "Some debugging notes.");

      const filePath = join(tempDir, ".dbcode", "memory", "debugging.md");
      const content = await readFile(filePath, "utf-8");
      expect(content).toBe("Some debugging notes.");
    });

    it("appends .md extension if not present", async () => {
      const config = makeConfig();
      await writeTopicMemory(config, "patterns", "Pattern notes.");

      const filePath = join(tempDir, ".dbcode", "memory", "patterns.md");
      const content = await readFile(filePath, "utf-8");
      expect(content).toBe("Pattern notes.");
    });

    it("does not double-append .md extension", async () => {
      const config = makeConfig();
      await writeTopicMemory(config, "patterns.md", "Content.");

      const filePath = join(tempDir, ".dbcode", "memory", "patterns.md");
      const content = await readFile(filePath, "utf-8");
      expect(content).toBe("Content.");
    });
  });

  describe("readTopicMemory()", () => {
    it("returns null for non-existent topic", async () => {
      const config = makeConfig();
      const result = await readTopicMemory(config, "nonexistent");
      expect(result).toBeNull();
    });

    it("reads existing topic file", async () => {
      const config = makeConfig();
      const content = "## Debugging Insights\n\nRoot cause was X.";
      await writeTopicMemory(config, "debugging", content);

      const result = await readTopicMemory(config, "debugging");
      expect(result).toBe(content);
    });

    it("truncates to maxTopicLines", async () => {
      const config = makeConfig({ maxTopicLines: 3 });
      const lines = Array.from({ length: 10 }, (_, i) => `Topic line ${i + 1}`);
      await writeTopicMemory(config, "big-topic", lines.join("\n"));

      const result = await readTopicMemory(config, "big-topic");
      expect(result).not.toBeNull();
      const resultLines = result!.split("\n");
      expect(resultLines).toHaveLength(3);
    });
  });

  // -----------------------------------------------------------------------
  // readGlobalMemory + writeGlobalMemory
  // -----------------------------------------------------------------------

  describe("global memory", () => {
    it("readGlobalMemory returns empty string for non-existent file", async () => {
      const config = makeConfig();
      const result = await readGlobalMemory(config);
      expect(result).toBe("");
    });

    it("writeGlobalMemory + readGlobalMemory roundtrip", async () => {
      const config = makeConfig();
      const content = "# Global patterns\n\n- Always use ESM";
      await writeGlobalMemory(config, content);

      const result = await readGlobalMemory(config);
      expect(result).toBe(content);
    });
  });

  // -----------------------------------------------------------------------
  // listMemoryFiles
  // -----------------------------------------------------------------------

  describe("listMemoryFiles()", () => {
    it("returns empty array for empty/non-existent directory", async () => {
      const config = makeConfig();
      const files = await listMemoryFiles(config);
      expect(files).toEqual([]);
    });

    it("returns correct metadata for memory files", async () => {
      const config = makeConfig();
      await writeMainMemory(config, "Line 1\nLine 2\nLine 3");
      await writeTopicMemory(config, "debugging", "Debug line 1\nDebug line 2");

      const files = await listMemoryFiles(config);

      expect(files.length).toBe(2);

      // Files are sorted by name
      const debugFile = files.find((f) => f.name === "debugging.md");
      const memoryFile = files.find((f) => f.name === "MEMORY.md");

      expect(debugFile).toBeDefined();
      expect(debugFile!.lineCount).toBe(2);
      expect(debugFile!.sizeBytes).toBeGreaterThan(0);
      expect(debugFile!.modifiedAt).toBeInstanceOf(Date);

      expect(memoryFile).toBeDefined();
      expect(memoryFile!.lineCount).toBe(3);
      expect(memoryFile!.sizeBytes).toBeGreaterThan(0);
    });

    it("only returns .md files", async () => {
      const config = makeConfig();
      const memDir = join(tempDir, ".dbcode", "memory");
      await mkdir(memDir, { recursive: true });
      await writeFile(join(memDir, "MEMORY.md"), "notes", "utf-8");
      await writeFile(join(memDir, "notes.txt"), "not markdown", "utf-8");
      await writeFile(join(memDir, "data.json"), "{}", "utf-8");

      const files = await listMemoryFiles(config);
      expect(files).toHaveLength(1);
      expect(files[0]!.name).toBe("MEMORY.md");
    });

    it("returns files sorted by name", async () => {
      const config = makeConfig();
      await writeTopicMemory(config, "zebra", "z content");
      await writeTopicMemory(config, "alpha", "a content");
      await writeMainMemory(config, "main content");

      const files = await listMemoryFiles(config);
      const names = files.map((f) => f.name);
      expect(names).toEqual(["alpha.md", "MEMORY.md", "zebra.md"]);
    });
  });

  // -----------------------------------------------------------------------
  // deleteMemoryFile
  // -----------------------------------------------------------------------

  describe("deleteMemoryFile()", () => {
    it("removes the file", async () => {
      const config = makeConfig();
      await writeTopicMemory(config, "temp-notes", "temporary content");

      // Verify it exists
      const beforeFiles = await listMemoryFiles(config);
      expect(beforeFiles.some((f) => f.name === "temp-notes.md")).toBe(true);

      await deleteMemoryFile(config, "temp-notes");

      const afterFiles = await listMemoryFiles(config);
      expect(afterFiles.some((f) => f.name === "temp-notes.md")).toBe(false);
    });

    it("throws MemoryStorageError for non-existent file", async () => {
      const config = makeConfig();
      await expect(deleteMemoryFile(config, "does-not-exist")).rejects.toThrow(MemoryStorageError);
    });

    it("handles .md extension in filename", async () => {
      const config = makeConfig();
      await writeTopicMemory(config, "notes", "content");

      // Should work with or without .md
      await deleteMemoryFile(config, "notes.md");
      const files = await listMemoryFiles(config);
      expect(files.some((f) => f.name === "notes.md")).toBe(false);
    });
  });

  // -----------------------------------------------------------------------
  // Concurrent writes
  // -----------------------------------------------------------------------

  describe("concurrent operations", () => {
    it("concurrent writes don't corrupt data", async () => {
      const config = makeConfig();

      // Write multiple topic files concurrently
      const writes = Array.from({ length: 10 }, (_, i) =>
        writeTopicMemory(config, `topic-${i}`, `Content for topic ${i}`),
      );

      await Promise.all(writes);

      const files = await listMemoryFiles(config);
      expect(files.length).toBe(10);

      // Verify all files are readable
      for (let i = 0; i < 10; i++) {
        const content = await readTopicMemory(config, `topic-${i}`);
        expect(content).toBe(`Content for topic ${i}`);
      }
    });
  });

  // -----------------------------------------------------------------------
  // Edge cases
  // -----------------------------------------------------------------------

  describe("edge cases", () => {
    it("handles empty content", async () => {
      const config = makeConfig();
      await writeMainMemory(config, "");
      const result = await readMainMemory(config);
      expect(result).toBe("");
    });

    it("handles content with special characters", async () => {
      const config = makeConfig();
      const content = "# Special chars: <>&\"' `code` *bold* _italic_\n\n```ts\nconst x = 1;\n```";
      await writeMainMemory(config, content);
      const result = await readMainMemory(config);
      expect(result).toBe(content);
    });

    it("handles unicode content", async () => {
      const config = makeConfig();
      const content = "Notes with unicode: \u2714 \u2718 \u2605 \u2764 \u2192";
      await writeTopicMemory(config, "unicode-test", content);
      const result = await readTopicMemory(config, "unicode-test");
      expect(result).toBe(content);
    });
  });
});
