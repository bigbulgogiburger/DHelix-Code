import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdir, writeFile, rm } from "node:fs/promises";
import { join } from "node:path";
import {
  loadProjectMemory,
  loadTopicMemory,
  listTopicFiles,
  MemoryLoadError,
} from "../../../src/memory/loader.js";
import { getMemoryDir, getMemoryFilePath } from "../../../src/memory/paths.js";

const tmpProjectRoot = join(process.cwd(), "test", "tmp", "memory-loader");

describe("memory/loader", () => {
  beforeEach(async () => {
    await mkdir(tmpProjectRoot, { recursive: true });
  });

  afterEach(async () => {
    try {
      await rm(tmpProjectRoot, { recursive: true, force: true });
      const memoryDir = getMemoryDir(tmpProjectRoot);
      await rm(memoryDir, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
  });

  describe("loadProjectMemory", () => {
    it("should return empty result when memory directory does not exist", async () => {
      const result = await loadProjectMemory(tmpProjectRoot);
      expect(result.exists).toBe(false);
      expect(result.content).toBe("");
      expect(result.topicFiles).toEqual([]);
    });

    it("should return empty result when MEMORY.md does not exist", async () => {
      const memoryDir = getMemoryDir(tmpProjectRoot);
      await mkdir(memoryDir, { recursive: true });
      // No MEMORY.md created

      const result = await loadProjectMemory(tmpProjectRoot);
      expect(result.exists).toBe(false);
      expect(result.content).toBe("");
    });

    it("should load content from MEMORY.md", async () => {
      const memoryDir = getMemoryDir(tmpProjectRoot);
      const memoryFile = getMemoryFilePath(tmpProjectRoot);
      await mkdir(memoryDir, { recursive: true });
      await writeFile(memoryFile, "# Project Memory\n\n## General\n\n- Remember this\n", "utf-8");

      const result = await loadProjectMemory(tmpProjectRoot);
      expect(result.exists).toBe(true);
      expect(result.content).toContain("Remember this");
      expect(result.content).toContain("# Project Memory");
    });

    it("should truncate content at maxLines", async () => {
      const memoryDir = getMemoryDir(tmpProjectRoot);
      const memoryFile = getMemoryFilePath(tmpProjectRoot);
      await mkdir(memoryDir, { recursive: true });

      const lines = Array.from({ length: 50 }, (_, i) => `Line ${i + 1}`);
      await writeFile(memoryFile, lines.join("\n"), "utf-8");

      const result = await loadProjectMemory(tmpProjectRoot, 10);
      const loadedLines = result.content.split("\n");
      expect(loadedLines.length).toBeLessThanOrEqual(10);
      expect(loadedLines[0]).toBe("Line 1");
    });

    it("should list topic files alongside memory", async () => {
      const memoryDir = getMemoryDir(tmpProjectRoot);
      const memoryFile = getMemoryFilePath(tmpProjectRoot);
      await mkdir(memoryDir, { recursive: true });
      await writeFile(memoryFile, "# Memory", "utf-8");
      await writeFile(join(memoryDir, "debugging.md"), "debug notes", "utf-8");
      await writeFile(join(memoryDir, "patterns.md"), "pattern notes", "utf-8");

      const result = await loadProjectMemory(tmpProjectRoot);
      expect(result.topicFiles).toContain("debugging.md");
      expect(result.topicFiles).toContain("patterns.md");
    });

    it("should not include MEMORY.md in topic files list", async () => {
      const memoryDir = getMemoryDir(tmpProjectRoot);
      const memoryFile = getMemoryFilePath(tmpProjectRoot);
      await mkdir(memoryDir, { recursive: true });
      await writeFile(memoryFile, "# Memory", "utf-8");

      const result = await loadProjectMemory(tmpProjectRoot);
      expect(result.topicFiles).not.toContain("MEMORY.md");
    });

    it("should return correct memoryFilePath", async () => {
      const result = await loadProjectMemory(tmpProjectRoot);
      expect(result.memoryFilePath).toContain("MEMORY.md");
    });

    it("should handle empty MEMORY.md", async () => {
      const memoryDir = getMemoryDir(tmpProjectRoot);
      const memoryFile = getMemoryFilePath(tmpProjectRoot);
      await mkdir(memoryDir, { recursive: true });
      await writeFile(memoryFile, "", "utf-8");

      const result = await loadProjectMemory(tmpProjectRoot);
      expect(result.exists).toBe(true);
      expect(result.content).toBe("");
    });
  });

  describe("loadTopicMemory", () => {
    it("should return null for non-existent topic", async () => {
      const content = await loadTopicMemory(tmpProjectRoot, "nonexistent");
      expect(content).toBeNull();
    });

    it("should load existing topic file content", async () => {
      const memoryDir = getMemoryDir(tmpProjectRoot);
      await mkdir(memoryDir, { recursive: true });
      await writeFile(join(memoryDir, "debugging.md"), "# Debugging\n\nSome debug notes.", "utf-8");

      const content = await loadTopicMemory(tmpProjectRoot, "debugging");
      expect(content).toContain("Debugging");
      expect(content).toContain("debug notes");
    });

    it("should handle topic names with .md extension", async () => {
      const memoryDir = getMemoryDir(tmpProjectRoot);
      await mkdir(memoryDir, { recursive: true });
      await writeFile(join(memoryDir, "patterns.md"), "Pattern notes", "utf-8");

      const content = await loadTopicMemory(tmpProjectRoot, "patterns.md");
      expect(content).toBe("Pattern notes");
    });
  });

  describe("listTopicFiles", () => {
    it("should return empty array when directory does not exist", async () => {
      const files = await listTopicFiles(tmpProjectRoot);
      expect(files).toEqual([]);
    });

    it("should return sorted list of .md files excluding MEMORY.md", async () => {
      const memoryDir = getMemoryDir(tmpProjectRoot);
      await mkdir(memoryDir, { recursive: true });
      await writeFile(join(memoryDir, "MEMORY.md"), "main memory", "utf-8");
      await writeFile(join(memoryDir, "debugging.md"), "debug", "utf-8");
      await writeFile(join(memoryDir, "patterns.md"), "patterns", "utf-8");
      await writeFile(join(memoryDir, "notes.txt"), "not a md file", "utf-8");

      const files = await listTopicFiles(tmpProjectRoot);
      expect(files).toEqual(["debugging.md", "patterns.md"]);
    });
  });

  describe("MemoryLoadError", () => {
    it("should have correct error code", () => {
      const err = new MemoryLoadError("test error", { path: "/test" });
      expect(err).toBeInstanceOf(Error);
      expect(err.code).toBe("MEMORY_LOAD_ERROR");
      expect(err.message).toBe("test error");
      expect(err.context).toEqual({ path: "/test" });
    });
  });
});
