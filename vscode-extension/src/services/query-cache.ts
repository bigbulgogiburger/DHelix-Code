/**
 * FIFO cache with TTL for LSP query results.
 *
 * Reduces redundant VS Code command executions for frequently accessed
 * symbols/definitions during a single agent loop iteration.
 */

interface CacheEntry<T> {
  readonly value: T;
  readonly timestamp: number;
}

export class QueryCache<T> {
  private readonly cache: Map<string, CacheEntry<T>>;
  private readonly maxEntries: number;
  private readonly ttlMs: number;

  constructor(maxEntries: number = 500, ttlMs: number = 30_000) {
    this.cache = new Map();
    this.maxEntries = maxEntries;
    this.ttlMs = ttlMs;
  }

  /** Returns cached value if present and not expired, otherwise undefined. */
  get(key: string): T | undefined {
    const entry = this.cache.get(key);
    if (!entry) return undefined;

    if (Date.now() - entry.timestamp > this.ttlMs) {
      this.cache.delete(key);
      return undefined;
    }

    return entry.value;
  }

  /** Stores a value. Evicts the oldest entry (FIFO) when at capacity. */
  set(key: string, value: T): void {
    // Delete first so re-insertion moves it to the end of Map iteration order
    if (this.cache.has(key)) {
      this.cache.delete(key);
    }

    if (this.cache.size >= this.maxEntries) {
      // Map iterates in insertion order; first key is the oldest
      const oldest = this.cache.keys().next().value;
      if (oldest !== undefined) {
        this.cache.delete(oldest);
      }
    }

    this.cache.set(key, { value, timestamp: Date.now() });
  }

  /** Remove a single entry by exact key. */
  invalidate(key: string): void {
    this.cache.delete(key);
  }

  /**
   * Remove all entries whose key starts with the given prefix.
   * Useful for invalidating all cached results for a specific file path.
   *
   * @example cache.invalidateByPrefix("/workspace/src/foo.ts:")
   */
  invalidateByPrefix(prefix: string): void {
    for (const key of [...this.cache.keys()]) {
      if (key.startsWith(prefix)) {
        this.cache.delete(key);
      }
    }
  }

  /** Remove all entries. */
  clear(): void {
    this.cache.clear();
  }

  /** Number of entries currently in the cache (including potentially expired ones). */
  get size(): number {
    return this.cache.size;
  }
}
