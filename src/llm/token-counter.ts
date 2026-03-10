import { getEncoding } from "js-tiktoken";

let encoder: ReturnType<typeof getEncoding> | undefined;

/**
 * Get or create the tiktoken encoder instance.
 * Uses o200k_base encoding (GPT-5, GPT-4.1, GPT-4o and newer models).
 */
function getEncoder(): ReturnType<typeof getEncoding> {
  if (!encoder) {
    encoder = getEncoding("o200k_base");
  }
  return encoder;
}

/**
 * Simple string hash for LRU cache keys.
 * Uses FNV-1a variant for fast, low-collision hashing.
 */
function hashString(str: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = (hash * 0x01000193) >>> 0;
  }
  return hash.toString(36);
}

/** LRU cache statistics */
export interface TokenCacheStats {
  readonly hits: number;
  readonly misses: number;
  readonly size: number;
}

/**
 * Map-based LRU cache for token counts.
 * Exploits Map insertion order for LRU eviction.
 */
export class TokenCountCache {
  private readonly cache = new Map<string, number>();
  private readonly maxSize: number;
  private hits = 0;
  private misses = 0;

  constructor(maxSize = 100) {
    this.maxSize = maxSize;
  }

  get(key: string): number | undefined {
    const value = this.cache.get(key);
    if (value !== undefined) {
      this.hits++;
      // Move to end (most recently used) by re-inserting
      this.cache.delete(key);
      this.cache.set(key, value);
      return value;
    }
    this.misses++;
    return undefined;
  }

  set(key: string, count: number): void {
    // If key exists, delete first to update insertion order
    if (this.cache.has(key)) {
      this.cache.delete(key);
    } else if (this.cache.size >= this.maxSize) {
      // Evict oldest entry (first key in Map)
      const firstKey = this.cache.keys().next().value;
      if (firstKey !== undefined) {
        this.cache.delete(firstKey);
      }
    }
    this.cache.set(key, count);
  }

  /** Get cache hit/miss statistics */
  getStats(): TokenCacheStats {
    return {
      hits: this.hits,
      misses: this.misses,
      size: this.cache.size,
    };
  }

  /** Clear all cached entries and reset stats */
  clear(): void {
    this.cache.clear();
    this.hits = 0;
    this.misses = 0;
  }
}

/** Singleton token count cache */
const tokenCache = new TokenCountCache(100);

/**
 * Count tokens in a text string using tiktoken (accurate).
 * Results are cached using an LRU cache for repeated lookups.
 */
export function countTokens(text: string): number {
  const key = hashString(text);
  const cached = tokenCache.get(key);
  if (cached !== undefined) {
    return cached;
  }

  const enc = getEncoder();
  const count = enc.encode(text).length;
  tokenCache.set(key, count);
  return count;
}

/** Get the token cache statistics (for diagnostics) */
export function getTokenCacheStats(): TokenCacheStats {
  return tokenCache.getStats();
}

/** Reset the token cache (useful for testing) */
export function resetTokenCache(): void {
  tokenCache.clear();
}

/**
 * Estimate token count using character-based heuristic (fast, ~10% error).
 * Useful for real-time display while streaming.
 */
export function estimateTokens(text: string): number {
  // English: ~4 chars per token; CJK/Korean: ~2 chars per token
  // Use weighted average based on character type detection
  let asciiChars = 0;
  let wideChars = 0;

  for (const ch of text) {
    const code = ch.codePointAt(0) ?? 0;
    if (code > 0x2e80) {
      wideChars++;
    } else {
      asciiChars++;
    }
  }

  return Math.ceil(asciiChars / 4 + wideChars / 2);
}

/**
 * Count tokens for a chat message array (includes role/formatting overhead).
 */
export function countMessageTokens(messages: readonly { role: string; content: string }[]): number {
  let total = 0;
  for (const msg of messages) {
    // Each message has ~4 tokens overhead for role/formatting
    total += 4;
    total += countTokens(msg.content);
  }
  // Final assistant priming token
  total += 2;
  return total;
}
