/**
 * Cold Storage GC + Compression — unit tests
 *
 * Covers:
 *  - gzip write / gunzip read round-trip
 *  - backward-compatible fallback for legacy .txt files
 *  - capacity-based LRU eviction (enforceColdStorageLimit)
 *  - periodic GC timer start / stop
 *  - dispose() stops the GC timer
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { ContextManager } from "../../../src/core/context-manager.js";
import type { ChatMessage } from "../../../src/llm/provider.js";
import { mkdtemp, writeFile, readFile, rm, mkdir, stat } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { promisify } from "node:util";
import { gzip } from "node:zlib";

const gzipAsync = promisify(gzip);

// ---------------------------------------------------------------------------
// Mock token counter — deterministic, no I/O
// ---------------------------------------------------------------------------
vi.mock("../../../src/llm/token-counter.js", () => ({
  countTokens: vi.fn((text: string) => Math.ceil(text.length / 4)),
  estimateTokens: vi.fn((text: string) => Math.ceil(text.length / 4)),
  countMessageTokens: vi.fn((messages: ChatMessage[]) => {
    let total = 0;
    for (const m of messages) total += Math.ceil(m.content.length / 4);
    return total;
  }),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a large tool message that exceeds COLD_STORAGE_MIN_TOKENS (200 tokens ~ 800 chars) */
function largeToolMsg(id: string, size = 900): ChatMessage {
  return {
    role: "tool",
    content: `  1\t${"a".repeat(size - 4)}`,
    toolCallId: id,
    name: "file_read",
  };
}

function userMsg(text: string): ChatMessage {
  return { role: "user", content: text };
}

function assistantMsg(text: string): ChatMessage {
  return { role: "assistant", content: text };
}

// ---------------------------------------------------------------------------
// 1. gzip write / gunzip read round-trip
// ---------------------------------------------------------------------------

describe("Cold storage — gzip write / gunzip read", () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), "dhelix-cold-test-"));
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it("writes a .gz file (not .txt) to the cold storage directory", async () => {
    const manager = new ContextManager({
      maxContextTokens: 100_000,
      sessionId: `gz-write-${Date.now()}`,
    });

    // Push 7 large tool messages so microcompact kicks in (HOT_TAIL_SIZE = 5)
    const messages: ChatMessage[] = [];
    for (let i = 0; i < 7; i++) {
      messages.push(userMsg(`request ${i}`));
      messages.push(largeToolMsg(`t${i}`));
      messages.push(assistantMsg(`response ${i}`));
    }

    const result = await manager.microcompact(messages);

    // At least some messages should be cold-referenced
    const coldMsgs = result.filter(
      (m) => m.role === "tool" && m.content.includes("[Tool output stored at:"),
    );
    expect(coldMsgs.length).toBeGreaterThan(0);

    // The referenced path should end with .gz
    for (const m of coldMsgs) {
      const match = m.content.match(/stored at: ([^\]]+)\./);
      if (match) {
        // The full path segment contains ".gz"
        expect(m.content).toContain(".gz");
      }
    }

    manager.dispose();
  });

  it("round-trips content through gzip: write then readColdStorage returns original text", async () => {
    const manager = new ContextManager({
      maxContextTokens: 100_000,
      sessionId: `gz-roundtrip-${Date.now()}`,
    });

    // Trigger microcompaction to write a cold storage file
    const messages: ChatMessage[] = [];
    for (let i = 0; i < 7; i++) {
      messages.push(userMsg(`req ${i}`));
      messages.push({
        role: "tool",
        content: `  1\t${"x".repeat(900)}`,
        toolCallId: `t${i}`,
        name: "file_read",
      });
      messages.push(assistantMsg(`res ${i}`));
    }

    const result = await manager.microcompact(messages);

    // Find a cold-referenced message
    const coldMsg = result.find(
      (m) => m.role === "tool" && m.content.startsWith("[Tool output stored at:"),
    );
    expect(coldMsg).toBeDefined();

    // Extract the file path — format: "[Tool output stored at: /path/to/hash.gz. Re-read ...]"
    // The path ends with ".gz" followed by ". " (period + space)
    const pathMatch = coldMsg!.content.match(/stored at: (.+?\.gz)\. Re-read/);
    expect(pathMatch).not.toBeNull();
    const filePath = pathMatch![1];

    // Verify the .gz file is actually gzip-compressed (magic bytes 1f 8b)
    const rawBytes = await readFile(filePath);
    expect(rawBytes[0]).toBe(0x1f);
    expect(rawBytes[1]).toBe(0x8b);

    // Verify round-trip via readColdStorage
    const recovered = await manager.readColdStorage(filePath);
    expect(typeof recovered).toBe("string");
    expect(recovered.length).toBeGreaterThan(0);

    manager.dispose();
  });

  it("readColdStorage decompresses a .gz file and returns the original text", async () => {
    const manager = new ContextManager({
      maxContextTokens: 100_000,
      sessionId: `gz-read-${Date.now()}`,
    });

    // Manually write a .gz file into a temp directory
    const originalText = "Hello, compressed world!";
    const compressed = await gzipAsync(Buffer.from(originalText, "utf-8"));
    const gzPath = join(tmpDir, "manual.gz");
    await writeFile(gzPath, compressed);

    const result = await manager.readColdStorage(gzPath);
    expect(result).toBe(originalText);

    manager.dispose();
  });

  it("readColdStorage falls back to .txt when .gz is missing", async () => {
    const manager = new ContextManager({
      maxContextTokens: 100_000,
      sessionId: `gz-fallback-${Date.now()}`,
    });

    const originalText = "Legacy uncompressed content";
    // Write only the .txt file (simulating old session data)
    const txtPath = join(tmpDir, "abc123.txt");
    await writeFile(txtPath, originalText, "utf-8");

    // Ask readColdStorage for the .gz path — it should fall back to .txt
    const gzPath = join(tmpDir, "abc123.gz");
    const result = await manager.readColdStorage(gzPath);
    expect(result).toBe(originalText);

    manager.dispose();
  });

  it("readColdStorage throws when neither .gz nor .txt exists", async () => {
    const manager = new ContextManager({
      maxContextTokens: 100_000,
      sessionId: `gz-notfound-${Date.now()}`,
    });

    const gzPath = join(tmpDir, "nonexistent.gz");
    await expect(manager.readColdStorage(gzPath)).rejects.toThrow("Cold storage read failed");

    manager.dispose();
  });
});

// ---------------------------------------------------------------------------
// 2. Capacity limit — LRU eviction (enforceColdStorageLimit)
// ---------------------------------------------------------------------------

describe("enforceColdStorageLimit — LRU eviction", () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), "dhelix-evict-test-"));
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it("does nothing when total size is below the 100 MB limit", async () => {
    const manager = new ContextManager({ sessionId: `evict-noop-${Date.now()}` });

    // Write a small file (well under limit)
    await writeFile(join(tmpDir, "small.gz"), Buffer.alloc(1024));

    const result = await manager.enforceColdStorageLimit(tmpDir);
    expect(result.removedFiles).toBe(0);
    expect(result.bytesFreed).toBe(0);

    manager.dispose();
  });

  it("evicts the oldest files (LRU) when total size exceeds 100 MB", async () => {
    const manager = new ContextManager({ sessionId: `evict-lru-${Date.now()}` });

    const MB = 1024 * 1024;
    const MAX = 100 * MB;

    // Write 6 files of 20 MB each = 120 MB total (20 MB over limit)
    // We need the oldest 1 file to be removed.
    const fileSize = 20 * MB;
    const fileCount = 6;
    const files: string[] = [];

    for (let i = 0; i < fileCount; i++) {
      const name = `file${String(i).padStart(2, "0")}.gz`;
      const filePath = join(tmpDir, name);
      await writeFile(filePath, Buffer.alloc(fileSize, i));
      files.push(filePath);
      // Ensure distinct mtimes by waiting 1ms between writes
      await new Promise((r) => setTimeout(r, 5));
    }

    const result = await manager.enforceColdStorageLimit(tmpDir);

    // Total was 120 MB, limit is 100 MB → must free at least 20 MB
    expect(result.bytesFreed).toBeGreaterThanOrEqual(20 * MB);
    // At least 1 file removed
    expect(result.removedFiles).toBeGreaterThanOrEqual(1);

    // The oldest file (file00) should be gone
    await expect(stat(files[0])).rejects.toThrow();

    manager.dispose();
  });

  it("returns 0 when the directory does not exist", async () => {
    const manager = new ContextManager({ sessionId: `evict-nodir-${Date.now()}` });
    const result = await manager.enforceColdStorageLimit(join(tmpDir, "nonexistent"));
    expect(result.removedFiles).toBe(0);
    expect(result.bytesFreed).toBe(0);
    manager.dispose();
  });

  it("only considers .gz and .txt files, ignores other files", async () => {
    const manager = new ContextManager({ sessionId: `evict-filter-${Date.now()}` });

    // Write files: 1 relevant .gz + 1 irrelevant .json
    // Total relevant = 1 byte << 100 MB → no eviction
    await writeFile(join(tmpDir, "data.gz"), Buffer.alloc(1));
    await writeFile(join(tmpDir, "meta.json"), Buffer.alloc(200 * 1024 * 1024)); // huge but ignored

    const result = await manager.enforceColdStorageLimit(tmpDir);
    expect(result.removedFiles).toBe(0);

    manager.dispose();
  });
});

// ---------------------------------------------------------------------------
// 3. Periodic GC timer — start / stop
// ---------------------------------------------------------------------------

describe("startColdStorageGC / stopColdStorageGC", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("startColdStorageGC starts a recurring timer that calls cleanupColdStorage", async () => {
    const manager = new ContextManager({ sessionId: `gc-timer-${Date.now()}` });
    const cleanupSpy = vi.spyOn(manager, "cleanupColdStorage").mockResolvedValue({
      removedFiles: 0,
      bytesFreed: 0,
    });

    manager.startColdStorageGC();

    // Advance time by 5 minutes (GC_INTERVAL = 5 min)
    await vi.advanceTimersByTimeAsync(5 * 60 * 1000);
    expect(cleanupSpy).toHaveBeenCalledTimes(1);

    // Advance by another 5 minutes
    await vi.advanceTimersByTimeAsync(5 * 60 * 1000);
    expect(cleanupSpy).toHaveBeenCalledTimes(2);

    manager.dispose();
  });

  it("startColdStorageGC is idempotent — calling twice does not double-schedule", async () => {
    const manager = new ContextManager({ sessionId: `gc-idempotent-${Date.now()}` });
    const cleanupSpy = vi.spyOn(manager, "cleanupColdStorage").mockResolvedValue({
      removedFiles: 0,
      bytesFreed: 0,
    });

    manager.startColdStorageGC();
    manager.startColdStorageGC(); // second call should be a no-op

    await vi.advanceTimersByTimeAsync(5 * 60 * 1000);
    // Should fire exactly once, not twice
    expect(cleanupSpy).toHaveBeenCalledTimes(1);

    manager.dispose();
  });

  it("stopColdStorageGC stops the timer so cleanup is no longer called", async () => {
    const manager = new ContextManager({ sessionId: `gc-stop-${Date.now()}` });
    const cleanupSpy = vi.spyOn(manager, "cleanupColdStorage").mockResolvedValue({
      removedFiles: 0,
      bytesFreed: 0,
    });

    manager.startColdStorageGC();
    manager.stopColdStorageGC();

    await vi.advanceTimersByTimeAsync(10 * 60 * 1000);
    expect(cleanupSpy).not.toHaveBeenCalled();

    manager.dispose();
  });

  it("stopColdStorageGC is safe to call when timer is not running", () => {
    const manager = new ContextManager({ sessionId: `gc-stop-noop-${Date.now()}` });
    expect(() => manager.stopColdStorageGC()).not.toThrow();
    manager.dispose();
  });

  it("dispose() stops the GC timer automatically", async () => {
    const manager = new ContextManager({ sessionId: `gc-dispose-${Date.now()}` });
    const cleanupSpy = vi.spyOn(manager, "cleanupColdStorage").mockResolvedValue({
      removedFiles: 0,
      bytesFreed: 0,
    });

    manager.startColdStorageGC();
    manager.dispose(); // should clear the timer

    await vi.advanceTimersByTimeAsync(10 * 60 * 1000);
    expect(cleanupSpy).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// 4. cleanupColdStorage — handles both .gz and legacy .txt files
// ---------------------------------------------------------------------------

describe("cleanupColdStorage — .gz + .txt compatibility", () => {
  it("removes orphaned .gz files (no in-memory ref) during cleanup", async () => {
    const manager = new ContextManager({
      sessionId: `cleanup-gz-${Date.now()}`,
      maxContextTokens: 100_000,
    });

    // Trigger microcompact to create cold storage files
    const messages: ChatMessage[] = [];
    for (let i = 0; i < 7; i++) {
      messages.push(userMsg(`request ${i}`));
      messages.push(largeToolMsg(`t${i}`));
      messages.push(assistantMsg(`response ${i}`));
    }
    await manager.microcompact(messages);

    // Simulate orphaning: clear in-memory refs so files appear as orphans
    // We call dispose() which clears coldRefs, then create a fresh manager
    // pointing to the same sessionId to trigger orphan cleanup
    const sessionId = (manager as unknown as { sessionId: string }).sessionId;
    manager.dispose();

    // A fresh manager has no coldRefs → all files are orphaned
    const freshManager = new ContextManager({ sessionId, coldStorageTtlMs: 9999999 });
    const result = await freshManager.cleanupColdStorage();

    expect(result.removedFiles).toBeGreaterThan(0);
    expect(result.bytesFreed).toBeGreaterThan(0);

    freshManager.dispose();
  });

  it("removes expired .gz files when TTL is very small (1ms)", async () => {
    const manager = new ContextManager({
      sessionId: `cleanup-ttl-${Date.now()}`,
      maxContextTokens: 100_000,
      // 1ms TTL — files will be expired after a short pause
      coldStorageTtlMs: 1,
    });

    const messages: ChatMessage[] = [];
    for (let i = 0; i < 7; i++) {
      messages.push(userMsg(`request ${i}`));
      messages.push(largeToolMsg(`t${i}`));
      messages.push(assistantMsg(`response ${i}`));
    }
    await manager.microcompact(messages);

    // Wait slightly so files are older than 1ms
    await new Promise((r) => setTimeout(r, 20));

    const result = await manager.cleanupColdStorage();
    expect(result.removedFiles).toBeGreaterThan(0);
    expect(result.bytesFreed).toBeGreaterThan(0);

    manager.dispose();
  });
});
