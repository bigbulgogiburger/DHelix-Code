import { stat } from "node:fs/promises";
import { createHash } from "node:crypto";

/**
 * Caches the built system prompt to avoid rebuilding every agent loop iteration.
 * Key is based on instruction file mtimes.
 * Invalidates when files change.
 */
export class SystemPromptCache {
  private cached: string | null = null;
  private cacheKey: string | null = null;

  /**
   * Get a cached prompt if the key matches.
   * Returns null on cache miss.
   */
  get(key: string): string | null {
    if (this.cacheKey === key && this.cached !== null) {
      return this.cached;
    }
    return null;
  }

  /**
   * Store a prompt in the cache with the given key.
   */
  set(key: string, prompt: string): void {
    this.cacheKey = key;
    this.cached = prompt;
  }

  /**
   * Invalidate the cache, clearing stored prompt and key.
   */
  invalidate(): void {
    this.cached = null;
    this.cacheKey = null;
  }

  /**
   * Build a cache key from instruction file mtimes.
   * The key is a hash of all file paths and their modification timestamps.
   * Missing files are included with mtime "0" so that deletions also invalidate the cache.
   */
  static async buildKey(instructionFiles: readonly string[]): Promise<string> {
    const parts: string[] = [];

    for (const filePath of instructionFiles) {
      try {
        const fileStat = await stat(filePath);
        parts.push(`${filePath}:${fileStat.mtimeMs}`);
      } catch {
        // File does not exist or is inaccessible — use sentinel value
        parts.push(`${filePath}:0`);
      }
    }

    const hash = createHash("sha256");
    hash.update(parts.join("\n"));
    return hash.digest("hex").slice(0, 16);
  }
}
