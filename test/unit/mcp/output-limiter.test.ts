import { describe, it, expect, beforeEach } from "vitest";
import { MCPOutputLimiter, MCPOutputLimiterError } from "../../../src/mcp/output-limiter.js";

describe("MCPOutputLimiter", () => {
  let limiter: MCPOutputLimiter;

  beforeEach(() => {
    limiter = new MCPOutputLimiter();
  });

  describe("MCPOutputLimiterError", () => {
    it("should extend Error with proper code", () => {
      const error = new MCPOutputLimiterError("test error", { detail: "info" });
      expect(error).toBeInstanceOf(Error);
      expect(error.message).toBe("test error");
      expect(error.code).toBe("MCP_OUTPUT_LIMITER_ERROR");
      expect(error.context).toEqual({ detail: "info" });
    });
  });

  describe("estimateTokens", () => {
    it("should estimate tokens at 4 chars per token", () => {
      expect(limiter.estimateTokens("")).toBe(0);
      expect(limiter.estimateTokens("a")).toBe(1);
      expect(limiter.estimateTokens("abcd")).toBe(1);
      expect(limiter.estimateTokens("abcde")).toBe(2);
      expect(limiter.estimateTokens("a".repeat(100))).toBe(25);
    });

    it("should round up for partial tokens", () => {
      expect(limiter.estimateTokens("ab")).toBe(1);
      expect(limiter.estimateTokens("abc")).toBe(1);
      expect(limiter.estimateTokens("abcde")).toBe(2);
    });
  });

  describe("limitOutput", () => {
    it("should not truncate short content", () => {
      const result = limiter.limitOutput("Hello, world!");
      expect(result.wasTruncated).toBe(false);
      expect(result.content).toBe("Hello, world!");
      expect(result.originalTokens).toBe(limiter.estimateTokens("Hello, world!"));
      expect(result.resultTokens).toBe(result.originalTokens);
      expect(result.originalCharacters).toBe(13);
      expect(result.truncationMessage).toBeUndefined();
    });

    it("should truncate content exceeding token limit", () => {
      // Default maxTokens = 10000 (40000 chars). Build content with multiple paragraphs
      // so smart truncation can actually drop paragraphs.
      const paragraph = "x".repeat(10_000);
      const longContent = Array.from({ length: 6 }, () => paragraph).join("\n\n");
      const result = limiter.limitOutput(longContent);
      expect(result.wasTruncated).toBe(true);
      expect(result.content.length).toBeLessThan(longContent.length);
      expect(result.originalTokens).toBeGreaterThan(10_000);
      expect(result.truncationMessage).toBeDefined();
    });

    it("should truncate content exceeding character limit", () => {
      // Use a low maxCharacters config
      const smallLimiter = new MCPOutputLimiter({
        maxTokens: 1_000_000,
        maxCharacters: 100,
        strategy: "head",
      });
      const content = "a".repeat(200);
      const result = smallLimiter.limitOutput(content);
      expect(result.wasTruncated).toBe(true);
      expect(result.originalCharacters).toBe(200);
    });

    it("should not truncate content exactly at limit", () => {
      const exactLimiter = new MCPOutputLimiter({
        maxTokens: 10,
        maxCharacters: 40,
      });
      // 40 chars = exactly 10 tokens
      const content = "a".repeat(40);
      const result = exactLimiter.limitOutput(content);
      expect(result.wasTruncated).toBe(false);
    });

    it("should use per-server config override", () => {
      limiter.setServerLimit("strict-server", {
        maxTokens: 5,
        maxCharacters: 20,
        strategy: "head",
      });

      const content = "a".repeat(100);

      // Without server name: uses default (should not truncate at 100 chars)
      const defaultResult = limiter.limitOutput(content);
      expect(defaultResult.wasTruncated).toBe(false);

      // With server name: uses strict limit
      const serverResult = limiter.limitOutput(content, "strict-server");
      expect(serverResult.wasTruncated).toBe(true);
    });

    it("should apply head strategy", () => {
      const headLimiter = new MCPOutputLimiter({
        maxTokens: 5,
        maxCharacters: 20,
        strategy: "head",
        includeSummary: true,
      });
      const content = "abcdefghijklmnopqrstuvwxyz0123456789";
      const result = headLimiter.limitOutput(content);
      expect(result.wasTruncated).toBe(true);
      expect(result.content).toContain("abcdefghijklmnopqrst");
      expect(result.truncationMessage).toMatch(/kept first/);
    });

    it("should apply tail strategy", () => {
      const tailLimiter = new MCPOutputLimiter({
        maxTokens: 5,
        maxCharacters: 20,
        strategy: "tail",
        includeSummary: true,
      });
      const content = "abcdefghijklmnopqrstuvwxyz0123456789";
      const result = tailLimiter.limitOutput(content);
      expect(result.wasTruncated).toBe(true);
      expect(result.content).toContain("qrstuvwxyz0123456789");
      expect(result.truncationMessage).toMatch(/kept last/);
    });

    it("should apply smart strategy by default", () => {
      const smartLimiter = new MCPOutputLimiter({
        maxTokens: 5,
        maxCharacters: 20,
      });
      const content = "First paragraph.\n\nSecond paragraph that is much longer.";
      const result = smartLimiter.limitOutput(content);
      expect(result.wasTruncated).toBe(true);
    });

    it("should omit summary when includeSummary is false", () => {
      const noSummaryLimiter = new MCPOutputLimiter({
        maxTokens: 5,
        maxCharacters: 20,
        strategy: "head",
        includeSummary: false,
      });
      const content = "a".repeat(100);
      const result = noSummaryLimiter.limitOutput(content);
      expect(result.wasTruncated).toBe(true);
      expect(result.truncationMessage).toBeUndefined();
      // Content should be just the truncated text, no summary appended
      expect(result.content).toBe("a".repeat(20));
    });
  });

  describe("headTruncate", () => {
    it("should keep beginning of content", () => {
      expect(limiter.headTruncate("abcdefgh", 4)).toBe("abcd");
    });

    it("should return full content when under limit", () => {
      expect(limiter.headTruncate("abc", 10)).toBe("abc");
    });

    it("should handle empty string", () => {
      expect(limiter.headTruncate("", 10)).toBe("");
    });
  });

  describe("tailTruncate", () => {
    it("should keep end of content", () => {
      expect(limiter.tailTruncate("abcdefgh", 4)).toBe("efgh");
    });

    it("should return full content when under limit", () => {
      expect(limiter.tailTruncate("abc", 10)).toBe("abc");
    });

    it("should handle empty string", () => {
      expect(limiter.tailTruncate("", 10)).toBe("");
    });
  });

  describe("smartTruncate", () => {
    describe("JSON content", () => {
      it("should preserve top-level object keys within limit", () => {
        const json = JSON.stringify(
          {
            name: "test",
            description: "A test object",
            data: "x".repeat(200),
          },
          null,
          2,
        );
        const result = limiter.smartTruncate(json, 100);
        expect(result.truncated).toContain("name");
        expect(result.summary).toContain("top-level keys");
      });

      it("should handle JSON arrays", () => {
        const items = Array.from({ length: 50 }, (_, i) => ({
          id: i,
          value: `item-${i}`,
        }));
        const json = JSON.stringify(items, null, 2);
        const result = limiter.smartTruncate(json, 200);
        expect(result.summary).toContain("array items");

        // Should keep some items but not all
        const parsed = JSON.parse(result.truncated) as unknown[];
        expect(parsed.length).toBeLessThan(50);
        expect(parsed.length).toBeGreaterThan(0);
      });

      it("should add placeholder for truncated keys", () => {
        const json = JSON.stringify(
          {
            small: "ok",
            big: "x".repeat(500),
          },
          null,
          2,
        );
        const result = limiter.smartTruncate(json, 80);
        // Should attempt to include "big" key with [truncated] placeholder
        expect(result.truncated).toBeDefined();
        expect(result.summary).toContain("Truncated");
      });

      it("should fall through to plain text for invalid JSON", () => {
        const fakeJson = '{ not valid json "key": broken }';
        const result = limiter.smartTruncate(fakeJson, 15);
        // Should not throw and should return something reasonable
        expect(result.truncated.length).toBeLessThanOrEqual(fakeJson.length);
        expect(result.summary).toContain("Truncated");
      });
    });

    describe("markdown content", () => {
      it("should preserve headings and truncate body sections", () => {
        const markdown = [
          "# Title",
          "Introduction paragraph.",
          "",
          "## Section 1",
          "Content for section 1 " + "x".repeat(100),
          "",
          "## Section 2",
          "Content for section 2 " + "x".repeat(100),
          "",
          "## Section 3",
          "Content for section 3 " + "x".repeat(100),
        ].join("\n");

        const result = limiter.smartTruncate(markdown, 120);
        expect(result.truncated).toContain("# Title");
        expect(result.summary).toContain("sections");
      });

      it("should keep at least one section", () => {
        const markdown = [
          "# Very Long Title That Is Actually Quite Short",
          "Some body text.",
          "",
          "## Another Section",
          "More text here " + "x".repeat(500),
        ].join("\n");

        const result = limiter.smartTruncate(markdown, 30);
        expect(result.truncated.length).toBeGreaterThan(0);
      });
    });

    describe("plain text content", () => {
      it("should truncate at paragraph boundary", () => {
        const text = [
          "First paragraph with some text.",
          "",
          "Second paragraph with more text.",
          "",
          "Third paragraph with even more text " + "x".repeat(200),
        ].join("\n");

        const result = limiter.smartTruncate(text, 80);
        expect(result.truncated).toContain("First paragraph");
        expect(result.summary).toContain("lines");
      });

      it("should handle single paragraph", () => {
        const text = "A single long paragraph " + "x".repeat(200);
        const result = limiter.smartTruncate(text, 50);
        // Should keep first paragraph even if over limit (since it's the only one)
        expect(result.truncated.length).toBeGreaterThan(0);
      });
    });

    it("should return content as-is when under maxChars", () => {
      const result = limiter.smartTruncate("short text", 1000);
      expect(result.truncated).toBe("short text");
      expect(result.summary).toBe("");
    });
  });

  describe("setServerLimit / getEffectiveConfig", () => {
    it("should return global config for unknown server", () => {
      const config = limiter.getEffectiveConfig("unknown-server");
      expect(config.maxTokens).toBe(10_000);
      expect(config.maxCharacters).toBe(40_000);
      expect(config.strategy).toBe("smart");
      expect(config.includeSummary).toBe(true);
    });

    it("should return server-specific config when set", () => {
      limiter.setServerLimit("custom-server", {
        maxTokens: 5_000,
        strategy: "tail",
      });

      const config = limiter.getEffectiveConfig("custom-server");
      expect(config.maxTokens).toBe(5_000);
      expect(config.strategy).toBe("tail");
      // Should inherit defaults for unspecified fields
      expect(config.maxCharacters).toBe(40_000);
      expect(config.includeSummary).toBe(true);
    });

    it("should allow overriding all config fields", () => {
      limiter.setServerLimit("full-custom", {
        maxTokens: 1_000,
        maxCharacters: 4_000,
        strategy: "head",
        includeSummary: false,
      });

      const config = limiter.getEffectiveConfig("full-custom");
      expect(config.maxTokens).toBe(1_000);
      expect(config.maxCharacters).toBe(4_000);
      expect(config.strategy).toBe("head");
      expect(config.includeSummary).toBe(false);
    });

    it("should support multiple server configs independently", () => {
      limiter.setServerLimit("server-a", { maxTokens: 1_000 });
      limiter.setServerLimit("server-b", { maxTokens: 2_000 });

      expect(limiter.getEffectiveConfig("server-a").maxTokens).toBe(1_000);
      expect(limiter.getEffectiveConfig("server-b").maxTokens).toBe(2_000);
    });
  });

  describe("getStats / resetStats", () => {
    it("should start with zero stats", () => {
      const stats = limiter.getStats();
      expect(stats.totalCalls).toBe(0);
      expect(stats.truncatedCalls).toBe(0);
      expect(stats.totalTokensSaved).toBe(0);
      expect(stats.averageOriginalTokens).toBe(0);
    });

    it("should track calls without truncation", () => {
      limiter.limitOutput("short");
      limiter.limitOutput("also short");

      const stats = limiter.getStats();
      expect(stats.totalCalls).toBe(2);
      expect(stats.truncatedCalls).toBe(0);
      expect(stats.totalTokensSaved).toBe(0);
      expect(stats.averageOriginalTokens).toBeGreaterThan(0);
    });

    it("should track truncated calls", () => {
      const smallLimiter = new MCPOutputLimiter({
        maxTokens: 5,
        maxCharacters: 20,
        strategy: "head",
      });

      smallLimiter.limitOutput("short");
      smallLimiter.limitOutput("a".repeat(200));
      smallLimiter.limitOutput("b".repeat(300));

      const stats = smallLimiter.getStats();
      expect(stats.totalCalls).toBe(3);
      expect(stats.truncatedCalls).toBe(2);
      expect(stats.totalTokensSaved).toBeGreaterThan(0);
    });

    it("should calculate average original tokens", () => {
      limiter.limitOutput("a".repeat(40)); // 10 tokens
      limiter.limitOutput("b".repeat(80)); // 20 tokens

      const stats = limiter.getStats();
      expect(stats.averageOriginalTokens).toBe(15); // (10 + 20) / 2
    });

    it("should reset all stats to zero", () => {
      limiter.limitOutput("some content");
      expect(limiter.getStats().totalCalls).toBe(1);

      limiter.resetStats();

      const stats = limiter.getStats();
      expect(stats.totalCalls).toBe(0);
      expect(stats.truncatedCalls).toBe(0);
      expect(stats.totalTokensSaved).toBe(0);
      expect(stats.averageOriginalTokens).toBe(0);
    });

    it("should accumulate stats across multiple calls", () => {
      const smallLimiter = new MCPOutputLimiter({
        maxTokens: 5,
        maxCharacters: 20,
        strategy: "head",
        includeSummary: false,
      });

      for (let i = 0; i < 10; i++) {
        smallLimiter.limitOutput("a".repeat(200));
      }

      const stats = smallLimiter.getStats();
      expect(stats.totalCalls).toBe(10);
      expect(stats.truncatedCalls).toBe(10);
    });
  });

  describe("constructor", () => {
    it("should use default config when no options provided", () => {
      const defaultLimiter = new MCPOutputLimiter();
      const config = defaultLimiter.getEffectiveConfig("any-server");
      expect(config.maxTokens).toBe(10_000);
      expect(config.maxCharacters).toBe(40_000);
      expect(config.strategy).toBe("smart");
      expect(config.includeSummary).toBe(true);
    });

    it("should merge partial config with defaults", () => {
      const customLimiter = new MCPOutputLimiter({ maxTokens: 5_000 });
      const config = customLimiter.getEffectiveConfig("any-server");
      expect(config.maxTokens).toBe(5_000);
      expect(config.maxCharacters).toBe(40_000);
      expect(config.strategy).toBe("smart");
    });

    it("should accept full custom config", () => {
      const customLimiter = new MCPOutputLimiter({
        maxTokens: 1_000,
        maxCharacters: 4_000,
        strategy: "tail",
        includeSummary: false,
      });
      const config = customLimiter.getEffectiveConfig("any-server");
      expect(config.maxTokens).toBe(1_000);
      expect(config.maxCharacters).toBe(4_000);
      expect(config.strategy).toBe("tail");
      expect(config.includeSummary).toBe(false);
    });
  });

  describe("edge cases", () => {
    it("should handle empty string input", () => {
      const result = limiter.limitOutput("");
      expect(result.wasTruncated).toBe(false);
      expect(result.content).toBe("");
      expect(result.originalTokens).toBe(0);
      expect(result.originalCharacters).toBe(0);
    });

    it("should handle single character input", () => {
      const result = limiter.limitOutput("x");
      expect(result.wasTruncated).toBe(false);
      expect(result.content).toBe("x");
      expect(result.originalTokens).toBe(1);
    });

    it("should handle content with only whitespace", () => {
      const result = limiter.limitOutput("   \n\n   ");
      expect(result.wasTruncated).toBe(false);
      expect(result.content).toBe("   \n\n   ");
    });

    it("should handle content with unicode characters", () => {
      const unicode = "\u{1F600}".repeat(100); // emoji characters
      const result = limiter.limitOutput(unicode);
      expect(result.originalCharacters).toBe(unicode.length);
    });

    it("should handle very small token limit", () => {
      const tinyLimiter = new MCPOutputLimiter({
        maxTokens: 1,
        maxCharacters: 4,
        strategy: "head",
        includeSummary: false,
      });
      const result = tinyLimiter.limitOutput("a long string that exceeds the limit");
      expect(result.wasTruncated).toBe(true);
      expect(result.content).toBe("a lo");
    });

    it("should use min of character and token limits", () => {
      // maxTokens=10 => 40 chars, maxCharacters=20 => min is 20
      const mixedLimiter = new MCPOutputLimiter({
        maxTokens: 10,
        maxCharacters: 20,
        strategy: "head",
        includeSummary: false,
      });
      const content = "a".repeat(50);
      const result = mixedLimiter.limitOutput(content);
      expect(result.wasTruncated).toBe(true);
      expect(result.content).toBe("a".repeat(20));
    });
  });
});
