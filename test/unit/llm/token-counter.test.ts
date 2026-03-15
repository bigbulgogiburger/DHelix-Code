import { describe, it, expect, beforeEach } from "vitest";
import {
  countTokens,
  estimateTokens,
  countMessageTokens,
  TokenCountCache,
  getTokenCacheStats,
  resetTokenCache,
} from "../../../src/llm/token-counter.js";

describe("countTokens", () => {
  it("should count tokens for simple English text", () => {
    const count = countTokens("Hello, world!");
    expect(count).toBeGreaterThan(0);
    expect(count).toBeLessThan(10);
  });

  it("should count tokens for empty string", () => {
    expect(countTokens("")).toBe(0);
  });

  it("should count tokens for longer text", () => {
    const text = "The quick brown fox jumps over the lazy dog.";
    const count = countTokens(text);
    expect(count).toBeGreaterThan(5);
    expect(count).toBeLessThan(20);
  });
});

describe("estimateTokens", () => {
  it("should estimate tokens for English text", () => {
    const estimate = estimateTokens("Hello world this is a test");
    expect(estimate).toBeGreaterThan(0);
  });

  it("should return 0 for empty string", () => {
    expect(estimateTokens("")).toBe(0);
  });

  it("should handle CJK characters", () => {
    const estimate = estimateTokens("안녕하세요 세계");
    expect(estimate).toBeGreaterThan(0);
  });
});

describe("countMessageTokens", () => {
  it("should include overhead per message", () => {
    const messages = [
      { role: "user", content: "Hi" },
      { role: "assistant", content: "Hello!" },
    ];
    const total = countMessageTokens(messages);
    // At minimum: 2 messages x 4 overhead + 2 priming + actual tokens
    expect(total).toBeGreaterThanOrEqual(10);
  });

  it("should handle empty messages array", () => {
    const total = countMessageTokens([]);
    expect(total).toBe(2); // Just the priming token
  });
});

describe("TokenCountCache", () => {
  it("should cache and retrieve values", () => {
    const cache = new TokenCountCache(10);
    cache.set("key1", 42);
    expect(cache.get("key1")).toBe(42);
  });

  it("should return undefined for missing keys", () => {
    const cache = new TokenCountCache(10);
    expect(cache.get("missing")).toBeUndefined();
  });

  it("should evict oldest entry when maxSize is exceeded", () => {
    const cache = new TokenCountCache(3);
    cache.set("a", 1);
    cache.set("b", 2);
    cache.set("c", 3);
    cache.set("d", 4); // Should evict "a"

    expect(cache.get("a")).toBeUndefined();
    expect(cache.get("b")).toBe(2);
    expect(cache.get("d")).toBe(4);
  });

  it("should move accessed entry to most-recently-used", () => {
    const cache = new TokenCountCache(3);
    cache.set("a", 1);
    cache.set("b", 2);
    cache.set("c", 3);

    // Access "a" to make it most recently used
    cache.get("a");

    // Add "d" — should evict "b" (now the oldest) instead of "a"
    cache.set("d", 4);

    expect(cache.get("a")).toBe(1);
    expect(cache.get("b")).toBeUndefined();
  });

  it("should track hits, misses, and hitRate", () => {
    const cache = new TokenCountCache(10);
    cache.set("x", 10);

    cache.get("x"); // hit
    cache.get("x"); // hit
    cache.get("y"); // miss

    const stats = cache.getStats();
    expect(stats.hits).toBe(2);
    expect(stats.misses).toBe(1);
    expect(stats.hitRate).toBeCloseTo(2 / 3);
    expect(stats.size).toBe(1);
  });

  it("should return hitRate of 0 when no lookups performed", () => {
    const cache = new TokenCountCache(10);
    const stats = cache.getStats();
    expect(stats.hitRate).toBe(0);
  });

  it("should clear cache and reset stats", () => {
    const cache = new TokenCountCache(10);
    cache.set("x", 10);
    cache.get("x");
    cache.clear();

    const stats = cache.getStats();
    expect(stats.hits).toBe(0);
    expect(stats.misses).toBe(0);
    expect(stats.size).toBe(0);
    expect(cache.get("x")).toBeUndefined();
  });

  it("should update existing key without growing size", () => {
    const cache = new TokenCountCache(3);
    cache.set("a", 1);
    cache.set("b", 2);
    cache.set("a", 10); // Update existing key

    expect(cache.get("a")).toBe(10);
    expect(cache.getStats().size).toBe(2);
  });
});

describe("countTokens LRU caching integration", () => {
  beforeEach(() => {
    resetTokenCache();
  });

  it("should return same result on repeated calls (cache hit)", () => {
    const text = "This is a test for caching.";
    const first = countTokens(text);
    const second = countTokens(text);
    expect(first).toBe(second);
  });

  it("should show cache stats after repeated calls", () => {
    resetTokenCache();
    const text = "Count me once, count me twice.";
    countTokens(text);
    countTokens(text);

    const stats = getTokenCacheStats();
    expect(stats.hits).toBeGreaterThanOrEqual(1);
    expect(stats.size).toBeGreaterThanOrEqual(1);
  });
});
