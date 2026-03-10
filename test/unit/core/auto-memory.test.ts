import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm, readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  MemoryManager,
  MemoryError,
  computeProjectHash,
  normalizeTopicFileName,
} from "../../../src/core/auto-memory.js";

describe("MemoryManager", () => {
  let tempDir: string;
  let manager: MemoryManager;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "dbcode-auto-memory-"));
    manager = new MemoryManager(tempDir);
  });

  afterEach(async () => {
    // Clean up the temp directory used as project root
    await rm(tempDir, { recursive: true, force: true });
    // Clean up the memory directory that MemoryManager creates under ~/.dbcode/projects/...
    try {
      await rm(manager.getMemoryDir(), { recursive: true, force: true });
    } catch {
      // Ignore if it doesn't exist
    }
  });

  // ---------------------------------------------------------------------------
  // Constructor and hashing
  // ---------------------------------------------------------------------------

  it("should compute a deterministic project hash", () => {
    const m1 = new MemoryManager(tempDir);
    const m2 = new MemoryManager(tempDir);
    expect(m1.projectHash).toBe(m2.projectHash);
    expect(m1.projectHash).toHaveLength(12);
    expect(/^[a-f0-9]{12}$/.test(m1.projectHash)).toBe(true);
  });

  it("should produce different hashes for different paths", () => {
    const m1 = new MemoryManager("/some/path/a");
    const m2 = new MemoryManager("/some/path/b");
    expect(m1.projectHash).not.toBe(m2.projectHash);
  });

  // ---------------------------------------------------------------------------
  // loadMainMemory
  // ---------------------------------------------------------------------------

  it("should return empty string for non-existent memory file", async () => {
    const content = await manager.loadMainMemory();
    expect(content).toBe("");
  });

  it("should load previously saved content", async () => {
    await manager.saveMainMemory("# Memory\n\n- Item 1\n- Item 2");
    const loaded = await manager.loadMainMemory();
    expect(loaded).toContain("# Memory");
    expect(loaded).toContain("Item 1");
    expect(loaded).toContain("Item 2");
  });

  it("should truncate to 200 lines on load when file is longer", async () => {
    // Create content with 250 lines
    const lines = Array.from({ length: 250 }, (_, i) => `Line ${i + 1}`);
    const content = lines.join("\n");

    // Write directly (bypassing saveMainMemory to avoid save-time truncation)
    const { mkdir: mkdirFs, writeFile: writeF } = await import("node:fs/promises");
    const memDir = manager.getMemoryDir();
    await mkdirFs(memDir, { recursive: true });
    await writeF(join(memDir, "MEMORY.md"), content, "utf-8");

    const loaded = await manager.loadMainMemory();
    const loadedLines = loaded.split("\n");
    expect(loadedLines.length).toBe(200);
    expect(loadedLines[0]).toBe("Line 1");
    expect(loadedLines[199]).toBe("Line 200");
  });

  // ---------------------------------------------------------------------------
  // saveMainMemory
  // ---------------------------------------------------------------------------

  it("should create file and directories on first save", async () => {
    await manager.saveMainMemory("Hello, memory!");
    const memDir = manager.getMemoryDir();
    const entries = await readdir(memDir);
    expect(entries).toContain("MEMORY.md");

    const content = await readFile(join(memDir, "MEMORY.md"), "utf-8");
    expect(content).toBe("Hello, memory!");
  });

  it("should truncate content exceeding 200 lines on save", async () => {
    const lines = Array.from({ length: 250 }, (_, i) => `Line ${i + 1}`);
    const content = lines.join("\n");

    await manager.saveMainMemory(content);

    const memDir = manager.getMemoryDir();
    const saved = await readFile(join(memDir, "MEMORY.md"), "utf-8");

    // Should have truncation warning prepended
    expect(saved).toContain("WARNING: Content was truncated to 200 lines");

    // Should have at most 200 lines of actual content (plus the warning line)
    const savedLines = saved.split("\n");
    // Warning line + 200 content lines = 201
    expect(savedLines.length).toBe(201);
  });

  it("should not truncate content at or under 200 lines", async () => {
    const lines = Array.from({ length: 200 }, (_, i) => `Line ${i + 1}`);
    const content = lines.join("\n");

    await manager.saveMainMemory(content);

    const memDir = manager.getMemoryDir();
    const saved = await readFile(join(memDir, "MEMORY.md"), "utf-8");
    expect(saved).not.toContain("WARNING");
    expect(saved).toBe(content);
  });

  it("should overwrite existing memory on save", async () => {
    await manager.saveMainMemory("First version");
    await manager.saveMainMemory("Second version");

    const loaded = await manager.loadMainMemory();
    expect(loaded).toBe("Second version");
  });

  // ---------------------------------------------------------------------------
  // Topic memory
  // ---------------------------------------------------------------------------

  it("should return null for non-existent topic", async () => {
    const result = await manager.loadTopicMemory("debugging");
    expect(result).toBeNull();
  });

  it("should save and load topic memory", async () => {
    await manager.saveTopicMemory("debugging", "Use verbose logging for tracing");
    const loaded = await manager.loadTopicMemory("debugging");
    expect(loaded).toBe("Use verbose logging for tracing");
  });

  it("should reject invalid topic names", async () => {
    await expect(manager.loadTopicMemory("")).rejects.toThrow(MemoryError);
    await expect(manager.saveTopicMemory("", "content")).rejects.toThrow(MemoryError);
    await expect(manager.saveTopicMemory("123invalid", "content")).rejects.toThrow(MemoryError);
  });

  it("should reject empty content on saveTopicMemory", async () => {
    await expect(manager.saveTopicMemory("valid-topic", "")).rejects.toThrow(MemoryError);
  });

  it("should save multiple topics independently", async () => {
    await manager.saveTopicMemory("debugging", "Debug notes");
    await manager.saveTopicMemory("patterns", "Pattern notes");

    const debug = await manager.loadTopicMemory("debugging");
    const patterns = await manager.loadTopicMemory("patterns");

    expect(debug).toBe("Debug notes");
    expect(patterns).toBe("Pattern notes");
  });

  // ---------------------------------------------------------------------------
  // listTopics
  // ---------------------------------------------------------------------------

  it("should return empty array when no topics exist", async () => {
    const topics = await manager.listTopics();
    expect(topics).toEqual([]);
  });

  it("should list all topics excluding MEMORY.md", async () => {
    await manager.saveMainMemory("Main memory content");
    await manager.saveTopicMemory("debugging", "Debug notes");
    await manager.saveTopicMemory("patterns", "Pattern notes");

    const topics = await manager.listTopics();
    expect(topics).toContain("debugging");
    expect(topics).toContain("patterns");
    expect(topics).not.toContain("MEMORY"); // MEMORY.md should be excluded
  });

  it("should return topics in sorted order", async () => {
    await manager.saveTopicMemory("zebra", "z content");
    await manager.saveTopicMemory("alpha", "a content");
    await manager.saveTopicMemory("middle", "m content");

    const topics = await manager.listTopics();
    expect(topics).toEqual(["alpha", "middle", "zebra"]);
  });

  // ---------------------------------------------------------------------------
  // getMemoryDir
  // ---------------------------------------------------------------------------

  it("should return correct path format with project hash", () => {
    const dir = manager.getMemoryDir();
    expect(dir).toContain("projects");
    expect(dir).toContain(manager.projectHash);
    expect(dir).toContain("memory");
  });

  // ---------------------------------------------------------------------------
  // deleteTopic
  // ---------------------------------------------------------------------------

  it("should delete a topic file", async () => {
    await manager.saveTopicMemory("temp-topic", "temporary data");
    await manager.deleteTopic("temp-topic");
    const loaded = await manager.loadTopicMemory("temp-topic");
    expect(loaded).toBeNull();
  });

  it("should be a no-op when deleting non-existent topic", async () => {
    await expect(manager.deleteTopic("nonexistent")).resolves.toBeUndefined();
  });

  // ---------------------------------------------------------------------------
  // clearAll
  // ---------------------------------------------------------------------------

  it("should clear all memory including topics", async () => {
    await manager.saveMainMemory("Main content");
    await manager.saveTopicMemory("debugging", "Debug content");

    await manager.clearAll();

    const main = await manager.loadMainMemory();
    const topics = await manager.listTopics();
    expect(main).toBe("");
    expect(topics).toEqual([]);
  });

  it("should be a no-op when clearing non-existent memory dir", async () => {
    await expect(manager.clearAll()).resolves.toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Pure helper functions
// ---------------------------------------------------------------------------

describe("computeProjectHash", () => {
  it("should return a 12-character hex string", () => {
    const hash = computeProjectHash("/some/project/path");
    expect(hash).toHaveLength(12);
    expect(/^[a-f0-9]{12}$/.test(hash)).toBe(true);
  });

  it("should be deterministic", () => {
    const h1 = computeProjectHash("/my/project");
    const h2 = computeProjectHash("/my/project");
    expect(h1).toBe(h2);
  });

  it("should differ for different paths", () => {
    const h1 = computeProjectHash("/path/a");
    const h2 = computeProjectHash("/path/b");
    expect(h1).not.toBe(h2);
  });
});

describe("normalizeTopicFileName", () => {
  it("should lowercase and add .md extension", () => {
    expect(normalizeTopicFileName("Debugging")).toBe("debugging.md");
  });

  it("should replace spaces with hyphens", () => {
    expect(normalizeTopicFileName("My Topic")).toBe("my-topic.md");
  });

  it("should collapse consecutive hyphens", () => {
    expect(normalizeTopicFileName("foo--bar---baz")).toBe("foo-bar-baz.md");
  });

  it("should strip leading and trailing hyphens", () => {
    expect(normalizeTopicFileName("-leading-trailing-")).toBe("leading-trailing.md");
  });

  it("should not double-add .md extension", () => {
    expect(normalizeTopicFileName("topic.md")).toBe("topic.md");
  });

  it("should handle underscores", () => {
    expect(normalizeTopicFileName("my_topic")).toBe("my_topic.md");
  });

  it("should return untitled.md for empty base name", () => {
    expect(normalizeTopicFileName("---")).toBe("untitled.md");
  });
});
