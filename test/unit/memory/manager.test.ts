import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdir, writeFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { MemoryManager } from "../../../src/memory/manager.js";
import { getMemoryDir, getMemoryFilePath } from "../../../src/memory/paths.js";

const tmpProjectRoot = join(process.cwd(), "test", "tmp", "memory-manager");

describe("memory/manager", () => {
  let manager: MemoryManager;

  beforeEach(async () => {
    await mkdir(tmpProjectRoot, { recursive: true });
    manager = new MemoryManager(tmpProjectRoot);
  });

  afterEach(async () => {
    try {
      await rm(tmpProjectRoot, { recursive: true, force: true });
      // Also clean up the ~/.dbcode/projects/... directory created during tests
      const memoryDir = getMemoryDir(tmpProjectRoot);
      await rm(memoryDir, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
  });

  it("should have default config values", () => {
    expect(manager.config.maxLoadLines).toBe(200);
    expect(manager.config.maxMemoryLines).toBe(200);
  });

  it("should accept custom config overrides", () => {
    const custom = new MemoryManager(tmpProjectRoot, { maxLoadLines: 100 });
    expect(custom.config.maxLoadLines).toBe(100);
    expect(custom.config.maxMemoryLines).toBe(200);
  });

  it("should return consistent project hash for same root", () => {
    const hash1 = manager.getProjectHash();
    const hash2 = manager.getProjectHash();
    expect(hash1).toBe(hash2);
    expect(hash1).toHaveLength(16);
    expect(/^[a-f0-9]{16}$/.test(hash1)).toBe(true);
  });

  it("should produce different hashes for different roots", () => {
    const other = new MemoryManager("/some/other/path");
    expect(manager.getProjectHash()).not.toBe(other.getProjectHash());
  });

  it("should return empty content when no memory exists", async () => {
    const result = await manager.loadMemory();
    expect(result.exists).toBe(false);
    expect(result.content).toBe("");
    expect(result.topicFiles).toEqual([]);
  });

  it("should save and load memory content", async () => {
    await manager.saveMemory("# Project Memory\n\n## General\n\n- Remember this\n");
    const result = await manager.loadMemory();
    expect(result.exists).toBe(true);
    expect(result.content).toContain("Remember this");
  });

  it("should append memory entries", async () => {
    const res1 = await manager.appendMemory({ topic: "debugging", content: "Use verbose logging" });
    expect(res1.written).toBe(true);

    const res2 = await manager.appendMemory({ topic: "debugging", content: "Check error codes" });
    expect(res2.written).toBe(true);

    const loaded = await manager.loadMemory();
    expect(loaded.content).toContain("Use verbose logging");
    expect(loaded.content).toContain("Check error codes");
  });

  it("should deduplicate identical entries", async () => {
    await manager.appendMemory({ topic: "patterns", content: "Use immutable data" });
    const res = await manager.appendMemory({ topic: "patterns", content: "Use immutable data" });
    expect(res.written).toBe(false);
  });

  it("should write and read topic files", async () => {
    const fileName = await manager.writeTopicFile("debugging", "# Debugging Notes\n\nSome notes here.");
    expect(fileName).toBe("debugging.md");

    const content = await manager.readTopicFile("debugging");
    expect(content).toContain("Debugging Notes");
  });

  it("should return null for non-existent topic files", async () => {
    const content = await manager.readTopicFile("nonexistent");
    expect(content).toBeNull();
  });

  it("should list topic files", async () => {
    await manager.writeTopicFile("debugging", "debug content");
    await manager.writeTopicFile("patterns", "pattern content");

    const topics = await manager.getTopicFiles();
    expect(topics).toContain("debugging.md");
    expect(topics).toContain("patterns.md");
  });

  it("should clear all memory", async () => {
    await manager.saveMemory("# Memory\n\nSome content");
    await manager.writeTopicFile("test-topic", "topic content");

    await manager.clearMemory();

    const loaded = await manager.loadMemory();
    expect(loaded.content).toBe("");

    const topics = await manager.getTopicFiles();
    expect(topics).toEqual([]);
  });

  it("should return memory directory path", () => {
    const dir = manager.getMemoryDir();
    expect(dir).toContain("memory");
    expect(dir).toContain(manager.getProjectHash());
  });

  it("should return MEMORY.md file path", () => {
    const path = manager.getMemoryFilePath();
    expect(path).toContain("MEMORY.md");
  });
});
