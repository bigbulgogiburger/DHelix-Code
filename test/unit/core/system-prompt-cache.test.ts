import { describe, it, expect, beforeEach, vi } from "vitest";
import { SystemPromptCache } from "../../../src/core/system-prompt-cache.js";

describe("SystemPromptCache", () => {
  let cache: SystemPromptCache;

  beforeEach(() => {
    cache = new SystemPromptCache();
  });

  describe("get", () => {
    it("should return null on cache miss (empty cache)", () => {
      expect(cache.get("some-key")).toBeNull();
    });

    it("should return null when key does not match", () => {
      cache.set("key-a", "prompt content");
      expect(cache.get("key-b")).toBeNull();
    });

    it("should return cached prompt when key matches", () => {
      cache.set("key-a", "prompt content");
      expect(cache.get("key-a")).toBe("prompt content");
    });

    it("should return latest prompt after overwrite", () => {
      cache.set("key-a", "first prompt");
      cache.set("key-b", "second prompt");
      expect(cache.get("key-a")).toBeNull();
      expect(cache.get("key-b")).toBe("second prompt");
    });
  });

  describe("set", () => {
    it("should store a prompt with its key", () => {
      cache.set("my-key", "my-prompt");
      expect(cache.get("my-key")).toBe("my-prompt");
    });

    it("should overwrite previous entry", () => {
      cache.set("k", "v1");
      cache.set("k", "v2");
      expect(cache.get("k")).toBe("v2");
    });
  });

  describe("invalidate", () => {
    it("should clear the cache", () => {
      cache.set("key", "prompt");
      cache.invalidate();
      expect(cache.get("key")).toBeNull();
    });

    it("should be safe to call on empty cache", () => {
      cache.invalidate();
      expect(cache.get("anything")).toBeNull();
    });
  });

  describe("buildKey", () => {
    it("should return a hex string", async () => {
      const key = await SystemPromptCache.buildKey([]);
      expect(key).toMatch(/^[0-9a-f]{16}$/);
    });

    it("should return consistent key for same inputs", async () => {
      // Use a file that exists in the project
      const files = ["/dev/null"] as const;
      const key1 = await SystemPromptCache.buildKey(files);
      const key2 = await SystemPromptCache.buildKey(files);
      expect(key1).toBe(key2);
    });

    it("should return different keys for different file lists", async () => {
      const key1 = await SystemPromptCache.buildKey(["/dev/null"]);
      const key2 = await SystemPromptCache.buildKey(["/dev/null", "/tmp"]);
      expect(key1).not.toBe(key2);
    });

    it("should handle missing files gracefully", async () => {
      const key = await SystemPromptCache.buildKey(["/nonexistent/file/that/does/not/exist.md"]);
      expect(key).toMatch(/^[0-9a-f]{16}$/);
    });

    it("should produce different key when file is missing vs present", async () => {
      const keyMissing = await SystemPromptCache.buildKey(["/nonexistent/file/abc.md"]);
      const keyPresent = await SystemPromptCache.buildKey(["/dev/null"]);
      expect(keyMissing).not.toBe(keyPresent);
    });
  });
});
