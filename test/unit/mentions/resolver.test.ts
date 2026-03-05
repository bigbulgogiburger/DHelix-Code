import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { resolveMentions, buildMentionContext } from "../../../src/mentions/resolver.js";
import { type ParsedMention } from "../../../src/mentions/parser.js";
import { mkdir, writeFile, rm } from "node:fs/promises";
import { join } from "node:path";

const tmpDir = join(process.cwd(), "test", "tmp", "mentions-resolver");

describe("mentions/resolver", () => {
  beforeEach(async () => {
    await mkdir(tmpDir, { recursive: true });
  });

  afterEach(async () => {
    try {
      await rm(tmpDir, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
  });

  describe("resolveMentions", () => {
    it("should resolve file mentions", async () => {
      await writeFile(join(tmpDir, "test.txt"), "hello world", "utf-8");
      const mentions: ParsedMention[] = [{ type: "file", value: "test.txt", raw: "@test.txt" }];

      const resolved = await resolveMentions(mentions, {
        workingDirectory: tmpDir,
      });

      expect(resolved).toHaveLength(1);
      expect(resolved[0].success).toBe(true);
      expect(resolved[0].content).toContain("hello world");
      expect(resolved[0].content).toContain("test.txt");
    });

    it("should handle missing file mentions gracefully", async () => {
      const mentions: ParsedMention[] = [
        { type: "file", value: "nonexistent.txt", raw: "@nonexistent.txt" },
      ];

      const resolved = await resolveMentions(mentions, {
        workingDirectory: tmpDir,
      });

      expect(resolved).toHaveLength(1);
      expect(resolved[0].success).toBe(false);
      expect(resolved[0].error).toContain("Failed to read file");
    });

    it("should resolve absolute file paths", async () => {
      const filePath = join(tmpDir, "abs.txt");
      await writeFile(filePath, "absolute content", "utf-8");
      const mentions: ParsedMention[] = [{ type: "file", value: filePath, raw: `@${filePath}` }];

      const resolved = await resolveMentions(mentions, {
        workingDirectory: tmpDir,
      });

      expect(resolved[0].success).toBe(true);
      expect(resolved[0].content).toContain("absolute content");
    });

    it("should handle MCP mentions without resolver", async () => {
      const mentions: ParsedMention[] = [
        { type: "mcp", value: "resource-uri", raw: "@mcp:resource-uri", server: "test-server" },
      ];

      const resolved = await resolveMentions(mentions, {
        workingDirectory: tmpDir,
      });

      expect(resolved[0].success).toBe(false);
      expect(resolved[0].error).toContain("MCP resolution not available");
    });

    it("should handle MCP mentions with resolver", async () => {
      const mentions: ParsedMention[] = [
        { type: "mcp", value: "resource-uri", raw: "@mcp:resource-uri", server: "test-server" },
      ];

      const resolved = await resolveMentions(mentions, {
        workingDirectory: tmpDir,
        mcpResolver: async (_server, _uri) => "mcp content here",
      });

      expect(resolved[0].success).toBe(true);
      expect(resolved[0].content).toContain("mcp content here");
    });

    it("should handle MCP resolver errors", async () => {
      const mentions: ParsedMention[] = [
        { type: "mcp", value: "resource-uri", raw: "@mcp:resource-uri", server: "test-server" },
      ];

      const resolved = await resolveMentions(mentions, {
        workingDirectory: tmpDir,
        mcpResolver: async () => {
          throw new Error("connection failed");
        },
      });

      expect(resolved[0].success).toBe(false);
      expect(resolved[0].error).toContain("MCP resolve failed");
    });

    it("should handle MCP mentions without server field", async () => {
      const mentions: ParsedMention[] = [
        { type: "mcp", value: "resource-uri", raw: "@mcp:resource-uri" },
      ];

      const resolved = await resolveMentions(mentions, {
        workingDirectory: tmpDir,
        mcpResolver: async () => "should not be called",
      });

      expect(resolved[0].success).toBe(false);
    });

    it("should resolve multiple mentions in parallel", async () => {
      await writeFile(join(tmpDir, "a.txt"), "content a", "utf-8");
      await writeFile(join(tmpDir, "b.txt"), "content b", "utf-8");

      const mentions: ParsedMention[] = [
        { type: "file", value: "a.txt", raw: "@a.txt" },
        { type: "file", value: "b.txt", raw: "@b.txt" },
      ];

      const resolved = await resolveMentions(mentions, {
        workingDirectory: tmpDir,
      });

      expect(resolved).toHaveLength(2);
      expect(resolved[0].success).toBe(true);
      expect(resolved[1].success).toBe(true);
    });
  });

  describe("buildMentionContext", () => {
    it("should return empty string for no successful resolutions", () => {
      const result = buildMentionContext([
        {
          mention: { type: "file", value: "x", raw: "@x" },
          content: "",
          success: false,
          error: "err",
        },
      ]);
      expect(result).toBe("");
    });

    it("should build context from successful resolutions", () => {
      const result = buildMentionContext([
        {
          mention: { type: "file", value: "a.txt", raw: "@a.txt" },
          content: "--- a.txt ---\nhello",
          success: true,
        },
        {
          mention: { type: "file", value: "b.txt", raw: "@b.txt" },
          content: "--- b.txt ---\nworld",
          success: true,
        },
      ]);
      expect(result).toContain("<referenced-content>");
      expect(result).toContain("hello");
      expect(result).toContain("world");
      expect(result).toContain("</referenced-content>");
    });

    it("should skip failed resolutions in context", () => {
      const result = buildMentionContext([
        {
          mention: { type: "file", value: "a.txt", raw: "@a.txt" },
          content: "--- a.txt ---\nhello",
          success: true,
        },
        {
          mention: { type: "file", value: "b.txt", raw: "@b.txt" },
          content: "",
          success: false,
          error: "not found",
        },
      ]);
      expect(result).toContain("hello");
      expect(result).not.toContain("not found");
    });

    it("should return empty for empty array", () => {
      expect(buildMentionContext([])).toBe("");
    });
  });
});
