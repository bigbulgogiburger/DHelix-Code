import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdir, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import {
  appendMemory,
  saveMemory,
  writeTopicFile,
  clearMemory,
} from "../../../src/memory/writer.js";
import { getMemoryDir, getMemoryFilePath } from "../../../src/memory/paths.js";

const tmpProjectRoot = join(process.cwd(), "test", "tmp", "memory-writer");

describe("memory/writer", () => {
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

  describe("appendMemory", () => {
    it("should create MEMORY.md with header on first write", async () => {
      const result = await appendMemory(tmpProjectRoot, {
        topic: "general",
        content: "First memory entry",
      });

      expect(result.written).toBe(true);
      expect(result.overflowed).toBe(false);

      const memoryFilePath = getMemoryFilePath(tmpProjectRoot);
      const content = await readFile(memoryFilePath, "utf-8");
      expect(content).toContain("# Project Memory");
      expect(content).toContain("## General");
      expect(content).toContain("- First memory entry");
    });

    it("should append to existing section", async () => {
      await appendMemory(tmpProjectRoot, { topic: "debugging", content: "Entry one" });
      await appendMemory(tmpProjectRoot, { topic: "debugging", content: "Entry two" });

      const memoryFilePath = getMemoryFilePath(tmpProjectRoot);
      const content = await readFile(memoryFilePath, "utf-8");
      expect(content).toContain("- Entry one");
      expect(content).toContain("- Entry two");

      // Should have only one "## Debugging" header
      const matches = content.match(/## Debugging/g);
      expect(matches).toHaveLength(1);
    });

    it("should create separate sections for different topics", async () => {
      await appendMemory(tmpProjectRoot, { topic: "debugging", content: "Debug tip" });
      await appendMemory(tmpProjectRoot, { topic: "patterns", content: "Pattern note" });

      const memoryFilePath = getMemoryFilePath(tmpProjectRoot);
      const content = await readFile(memoryFilePath, "utf-8");
      expect(content).toContain("## Debugging");
      expect(content).toContain("## Patterns");
    });

    it("should deduplicate identical content", async () => {
      await appendMemory(tmpProjectRoot, { topic: "general", content: "Duplicate check" });
      const result = await appendMemory(tmpProjectRoot, {
        topic: "general",
        content: "Duplicate check",
      });

      expect(result.written).toBe(false);
    });

    it("should be case-insensitive for deduplication", async () => {
      await appendMemory(tmpProjectRoot, { topic: "general", content: "Use TypeScript" });
      const result = await appendMemory(tmpProjectRoot, {
        topic: "general",
        content: "use typescript",
      });

      expect(result.written).toBe(false);
    });

    it("should not deduplicate different content", async () => {
      await appendMemory(tmpProjectRoot, { topic: "general", content: "Entry A" });
      const result = await appendMemory(tmpProjectRoot, { topic: "general", content: "Entry B" });

      expect(result.written).toBe(true);
    });

    it("should trigger overflow when exceeding max lines", async () => {
      // Create content that exceeds 10 lines
      const longContent = Array.from({ length: 8 }, (_, i) => `Line ${i + 1}`).join("\n");
      await saveMemory(
        tmpProjectRoot,
        `# Project Memory\n\n## Old\n\n${longContent}\n\n## Recent\n\n- Fresh entry\n`,
      );

      const result = await appendMemory(
        tmpProjectRoot,
        { topic: "newest", content: "Brand new" },
        10, // very low max to trigger overflow
      );

      expect(result.written).toBe(true);
      expect(result.overflowed).toBe(true);
    });
  });

  describe("saveMemory", () => {
    it("should create memory directory and file", async () => {
      await saveMemory(tmpProjectRoot, "# Test Memory\n\nContent here.");
      const memoryFilePath = getMemoryFilePath(tmpProjectRoot);
      const content = await readFile(memoryFilePath, "utf-8");
      expect(content).toBe("# Test Memory\n\nContent here.");
    });

    it("should overwrite existing content", async () => {
      await saveMemory(tmpProjectRoot, "First version");
      await saveMemory(tmpProjectRoot, "Second version");

      const memoryFilePath = getMemoryFilePath(tmpProjectRoot);
      const content = await readFile(memoryFilePath, "utf-8");
      expect(content).toBe("Second version");
    });
  });

  describe("writeTopicFile", () => {
    it("should create a topic file with normalized name", async () => {
      const fileName = await writeTopicFile(tmpProjectRoot, "My Topic!", "Topic content here.");
      expect(fileName).toBe("my-topic.md");

      const memoryDir = getMemoryDir(tmpProjectRoot);
      const content = await readFile(join(memoryDir, fileName), "utf-8");
      expect(content).toBe("Topic content here.");
    });

    it("should handle topic names with .md extension", async () => {
      const fileName = await writeTopicFile(tmpProjectRoot, "notes.md", "Notes here.");
      expect(fileName).toBe("notes.md");
    });
  });

  describe("clearMemory", () => {
    it("should clear MEMORY.md and remove topic files", async () => {
      await saveMemory(tmpProjectRoot, "Some memory content");
      await writeTopicFile(tmpProjectRoot, "debugging", "Debug notes");

      await clearMemory(tmpProjectRoot);

      const memoryFilePath = getMemoryFilePath(tmpProjectRoot);
      const content = await readFile(memoryFilePath, "utf-8");
      expect(content).toBe("");
    });

    it("should be a no-op when no memory exists", async () => {
      // Should not throw
      await clearMemory(tmpProjectRoot);
    });
  });
});
