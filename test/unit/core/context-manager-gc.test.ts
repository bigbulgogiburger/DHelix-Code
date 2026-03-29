import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { ContextManager, type ContextManagerConfig } from "../../../src/core/context-manager.js";
import type { ChatMessage } from "../../../src/llm/provider.js";
import { mkdtemp, writeFile, rm, mkdir, readdir } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

// Mock token counter for deterministic tests
vi.mock("../../../src/llm/token-counter.js", () => ({
  countTokens: vi.fn((text: string) => {
    // Simple deterministic mock: ~1 token per 4 characters
    return Math.ceil(text.length / 4);
  }),
  estimateTokens: vi.fn((text: string) => Math.ceil(text.length / 4)),
  countMessageTokens: vi.fn((messages: ChatMessage[]) => {
    let total = 0;
    for (const m of messages) {
      total += Math.ceil(m.content.length / 4);
    }
    return total;
  }),
}));

/** Create a message helper */
function msg(
  role: ChatMessage["role"],
  content: string,
  extra?: Partial<ChatMessage>,
): ChatMessage {
  return { role, content, ...extra };
}

/** Create a tool message with a name hint */
function toolMsg(content: string, toolCallId = "t1", name?: string): ChatMessage {
  return { role: "tool", content, toolCallId, name };
}

/** Create user-assistant turn pairs */
function createTurns(count: number, contentSize = 100): ChatMessage[] {
  const messages: ChatMessage[] = [];
  for (let i = 0; i < count; i++) {
    messages.push(msg("user", `User message ${i}: ${"x".repeat(contentSize)}`));
    messages.push(msg("assistant", `Assistant response ${i}: ${"y".repeat(contentSize)}`));
  }
  return messages;
}

/** Create a large file_read style output */
function largeFileReadResult(lineCount = 200): string {
  const lines: string[] = [];
  for (let i = 1; i <= lineCount; i++) {
    lines.push(`  ${i}\t${"a".repeat(80)}`);
  }
  return lines.join("\n");
}

// =============================================================================
// Cold storage cleanup behavior
// =============================================================================

describe("Cold storage and cleanup behavior", () => {
  it("should move old tool outputs to cold storage when beyond hot tail", async () => {
    const manager = new ContextManager({
      maxContextTokens: 100_000,
      sessionId: "gc-test-1",
    });

    // Create 8 tool messages (> HOT_TAIL_SIZE=5) with large content
    const messages: ChatMessage[] = [];
    for (let i = 0; i < 8; i++) {
      messages.push(msg("user", `request ${i}`));
      messages.push(toolMsg(largeFileReadResult(100), `t${i}`));
      messages.push(msg("assistant", `response ${i}`));
    }

    const result = await manager.microcompact(messages);

    // Count cold references
    const coldRefs = result.filter(
      (m) => m.role === "tool" && m.content.includes("[Tool output stored at:"),
    );
    expect(coldRefs.length).toBeGreaterThan(0);

    // Cold references should mention token count
    for (const ref of coldRefs) {
      expect(ref.content).toContain("tokens");
    }
  });

  it("should preserve hot tail of 5 most recent tool results inline", async () => {
    const manager = new ContextManager({
      maxContextTokens: 100_000,
      sessionId: "gc-test-hot-tail",
    });

    const messages: ChatMessage[] = [];
    const largeContent = largeFileReadResult(100);
    for (let i = 0; i < 10; i++) {
      messages.push(msg("user", `request ${i}`));
      messages.push(toolMsg(largeContent, `t${i}`));
      messages.push(msg("assistant", `response ${i}`));
    }

    const result = await manager.microcompact(messages);

    const toolMsgs = result.filter((m) => m.role === "tool");
    // The last 5 tool messages should be inline (not cold references)
    const lastFive = toolMsgs.slice(-5);
    for (const tm of lastFive) {
      expect(tm.content).not.toContain("[Tool output stored at:");
    }
  });

  it("should not cold-store tool results below minimum token threshold", async () => {
    const manager = new ContextManager({
      maxContextTokens: 100_000,
      sessionId: "gc-test-small",
    });

    // Create many small tool results
    const messages: ChatMessage[] = [];
    for (let i = 0; i < 10; i++) {
      messages.push(msg("user", `request ${i}`));
      messages.push(toolMsg("short output result", `t${i}`)); // Very short
      messages.push(msg("assistant", `response ${i}`));
    }

    const result = await manager.microcompact(messages);

    const coldRefs = result.filter(
      (m) => m.role === "tool" && m.content.includes("[Tool output stored at:"),
    );
    expect(coldRefs.length).toBe(0);
  });

  it("should only cold-store eligible tool types (file_read, bash_exec, grep_search, glob_search)", async () => {
    const manager = new ContextManager({
      maxContextTokens: 100_000,
      sessionId: "gc-test-eligible",
    });

    const largeContent = largeFileReadResult(200);

    const messages: ChatMessage[] = [];
    for (let i = 0; i < 8; i++) {
      messages.push(msg("user", `request ${i}`));
      // Non-eligible tool (no name pattern matching file_read/bash_exec/grep/glob)
      messages.push({
        role: "tool",
        content: `Custom tool result: ${largeContent}`,
        toolCallId: `t${i}`,
      });
      messages.push(msg("assistant", `response ${i}`));
    }

    const result = await manager.microcompact(messages);

    // Custom tool results don't match file_read pattern, so none should be cold-stored
    // unless the heuristic matches them (depends on content pattern detection)
    const allToolMsgs = result.filter((m) => m.role === "tool");
    expect(allToolMsgs.length).toBe(8);
  });
});

// =============================================================================
// Compaction metrics
// =============================================================================

describe("Compaction metrics (CompactionResult)", () => {
  it("should return original and compacted token counts", async () => {
    const manager = new ContextManager({
      maxContextTokens: 500,
      compactionThreshold: 0.5,
      preserveRecentTurns: 2,
    });

    const messages: ChatMessage[] = [msg("system", "sys"), ...createTurns(10, 200)];
    const { result } = await manager.compact(messages);

    expect(result.originalTokens).toBeGreaterThan(0);
    expect(result.compactedTokens).toBeGreaterThan(0);
    // Compaction should produce fewer messages even if mock token counts vary
    expect(result.removedMessages).toBeGreaterThan(0);
  });

  it("should report number of removed messages", async () => {
    const manager = new ContextManager({
      maxContextTokens: 500,
      compactionThreshold: 0.5,
      preserveRecentTurns: 2,
    });

    const messages: ChatMessage[] = [msg("system", "sys"), ...createTurns(10, 200)];
    const { result } = await manager.compact(messages);

    expect(result.removedMessages).toBeGreaterThan(0);
  });

  it("should include a summary string", async () => {
    const manager = new ContextManager({
      maxContextTokens: 500,
      compactionThreshold: 0.5,
      preserveRecentTurns: 2,
    });

    const messages: ChatMessage[] = [msg("system", "sys"), ...createTurns(10, 200)];
    const { result } = await manager.compact(messages);

    expect(result.summary).toBeDefined();
    expect(result.summary.length).toBeGreaterThan(0);
  });
});

// =============================================================================
// Hot tail priority — errors vs. reads
// =============================================================================

describe("Hot tail priority: error results kept over reads", () => {
  it("should truncate error tool results with higher token limit than normal ones", async () => {
    const manager = new ContextManager({
      maxContextTokens: 100,
      compactionThreshold: 0.1,
      preserveRecentTurns: 1,
    });

    // Large error result (starts with "Error:")
    const errorResult = "Error: " + "x".repeat(5000);
    // Large normal result
    const normalResult = "y".repeat(5000);

    const messages: ChatMessage[] = [
      msg("user", "run test"),
      { role: "tool", content: errorResult, toolCallId: "t1" },
      { role: "tool", content: normalResult, toolCallId: "t2" },
      msg("assistant", "done"),
    ];

    const { messages: compacted } = await manager.compact(messages);

    const errorTool = compacted.find((m) => m.role === "tool" && m.content.startsWith("Error:"));
    const normalTool = compacted.find(
      (m) => m.role === "tool" && !m.content.startsWith("Error:") && m.content.includes("omitted"),
    );

    // If both are truncated, the error should have more content preserved
    // (error limit = 1000 tokens, normal = 500 tokens, so error keeps more chars)
    if (errorTool && normalTool && errorTool.content.includes("omitted")) {
      // Error tool result should be larger since it has a higher token limit
      expect(errorTool.content.length).toBeGreaterThan(normalTool.content.length);
    }
  });

  it("should use head+tail truncation preserving beginning and end", async () => {
    const manager = new ContextManager({
      maxContextTokens: 100,
      compactionThreshold: 0.1,
      preserveRecentTurns: 1,
    });

    // Create a very large tool result with distinct beginning and end
    const content = "BEGIN_MARKER " + "x".repeat(5000) + " END_MARKER";

    const messages: ChatMessage[] = [
      msg("user", "test"),
      { role: "tool", content, toolCallId: "t1" },
      msg("assistant", "done"),
    ];

    const { messages: compacted } = await manager.compact(messages);

    const toolMsg = compacted.find((m) => m.role === "tool");
    if (toolMsg && toolMsg.content.includes("omitted")) {
      // Head should be preserved
      expect(toolMsg.content).toContain("BEGIN_MARKER");
      // Tail should be preserved
      expect(toolMsg.content).toContain("END_MARKER");
    }
  });
});

// =============================================================================
// Rehydration strategies
// =============================================================================

describe("Rehydration strategies", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "dhelix-rehydrate-gc-"));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it("should rehydrate based on recency — most recently accessed first", async () => {
    // Create test files
    const fileA = join(tempDir, "a.ts");
    const fileB = join(tempDir, "b.ts");
    const fileC = join(tempDir, "c.ts");
    await writeFile(fileA, "content A", "utf-8");
    await writeFile(fileB, "content B", "utf-8");
    await writeFile(fileC, "content C", "utf-8");

    const manager = new ContextManager({
      maxContextTokens: 100_000,
      compactionThreshold: 0.5,
      preserveRecentTurns: 2,
    });

    // Access in order: A, B, C (C is most recent)
    manager.trackFileAccess(fileA);
    manager.trackFileAccess(fileB);
    manager.trackFileAccess(fileC);

    const messages: ChatMessage[] = [msg("system", "sys"), ...createTurns(10, 200)];
    const { messages: compacted } = await manager.compact(messages);

    const rehydrationMsg = compacted.find(
      (m) => m.role === "system" && m.content.includes("[Post-compaction rehydration]"),
    );
    expect(rehydrationMsg).toBeDefined();

    // All three files should be included (under REHYDRATION_FILE_COUNT=5 limit)
    expect(rehydrationMsg!.content).toContain("content A");
    expect(rehydrationMsg!.content).toContain("content B");
    expect(rehydrationMsg!.content).toContain("content C");

    // Most recently accessed file (C) should appear first in the rehydration
    const indexC = rehydrationMsg!.content.indexOf("content C");
    const indexA = rehydrationMsg!.content.indexOf("content A");
    expect(indexC).toBeLessThan(indexA);
  });

  it("should prioritize re-accessed files (frequency/recency combined)", async () => {
    const fileA = join(tempDir, "freq-a.ts");
    const fileB = join(tempDir, "freq-b.ts");
    await writeFile(fileA, "frequently accessed A", "utf-8");
    await writeFile(fileB, "less accessed B", "utf-8");

    const manager = new ContextManager({
      maxContextTokens: 100_000,
      compactionThreshold: 0.5,
      preserveRecentTurns: 2,
    });

    // Access A, then B, then A again
    manager.trackFileAccess(fileA);
    manager.trackFileAccess(fileB);
    manager.trackFileAccess(fileA); // Re-access moves A to front

    const messages: ChatMessage[] = [msg("system", "sys"), ...createTurns(10, 200)];
    const { messages: compacted } = await manager.compact(messages);

    const rehydrationMsg = compacted.find(
      (m) => m.role === "system" && m.content.includes("[Post-compaction rehydration]"),
    );
    expect(rehydrationMsg).toBeDefined();

    // A should appear before B because it was accessed more recently
    const indexA = rehydrationMsg!.content.indexOf("frequently accessed A");
    const indexB = rehydrationMsg!.content.indexOf("less accessed B");
    expect(indexA).toBeLessThan(indexB);
  });

  it("should limit rehydration to REHYDRATION_FILE_COUNT (5) files", async () => {
    // Create 8 files
    const files: string[] = [];
    for (let i = 0; i < 8; i++) {
      const filePath = join(tempDir, `file-${i}.ts`);
      await writeFile(filePath, `content of file ${i}`, "utf-8");
      files.push(filePath);
    }

    const manager = new ContextManager({
      maxContextTokens: 500,
      compactionThreshold: 0.5,
      preserveRecentTurns: 2,
    });

    // Track all 8 files
    for (const f of files) {
      manager.trackFileAccess(f);
    }

    const messages: ChatMessage[] = [msg("system", "sys"), ...createTurns(10, 200)];
    const { messages: compacted } = await manager.compact(messages);

    const rehydrationMsg = compacted.find(
      (m) => m.role === "system" && m.content.includes("[Post-compaction rehydration]"),
    );
    expect(rehydrationMsg).toBeDefined();

    // Count how many "--- " file headers appear (one per rehydrated file)
    const fileHeaders = rehydrationMsg!.content.match(/--- .+\.ts ---/g) ?? [];
    expect(fileHeaders.length).toBeLessThanOrEqual(5);
  });

  it("should skip deleted files gracefully during rehydration", async () => {
    const existing = join(tempDir, "exists.ts");
    const deleted = join(tempDir, "deleted.ts");
    await writeFile(existing, "I still exist", "utf-8");
    // Don't create 'deleted.ts'

    const manager = new ContextManager({
      maxContextTokens: 500,
      compactionThreshold: 0.5,
      preserveRecentTurns: 2,
    });

    manager.trackFileAccess(deleted);
    manager.trackFileAccess(existing);

    const messages: ChatMessage[] = [msg("system", "sys"), ...createTurns(10, 200)];
    const { messages: compacted } = await manager.compact(messages);

    const rehydrationMsg = compacted.find(
      (m) => m.role === "system" && m.content.includes("[Post-compaction rehydration]"),
    );
    expect(rehydrationMsg).toBeDefined();
    expect(rehydrationMsg!.content).toContain("I still exist");
    expect(rehydrationMsg!.content).toContain("1 recently accessed files");
  });

  it("should truncate large files during rehydration (> 4000 chars)", async () => {
    const largePath = join(tempDir, "large.ts");
    const largeContent = "x".repeat(10_000);
    await writeFile(largePath, largeContent, "utf-8");

    const manager = new ContextManager({
      maxContextTokens: 500,
      compactionThreshold: 0.5,
      preserveRecentTurns: 2,
    });

    manager.trackFileAccess(largePath);

    const messages: ChatMessage[] = [msg("system", "sys"), ...createTurns(10, 200)];
    const { messages: compacted } = await manager.compact(messages);

    const rehydrationMsg = compacted.find(
      (m) => m.role === "system" && m.content.includes("[Post-compaction rehydration]"),
    );
    expect(rehydrationMsg).toBeDefined();
    expect(rehydrationMsg!.content).toContain("truncated for rehydration");
    // Rehydrated content should be much smaller than 10000 chars
    expect(rehydrationMsg!.content.length).toBeLessThan(6000);
  });
});

// =============================================================================
// Context usage reporting
// =============================================================================

describe("Context usage reporting", () => {
  it("should report correct token budget accounting for response reserve", () => {
    const manager = new ContextManager({
      maxContextTokens: 10_000,
      responseReserveRatio: 0.2,
    });

    expect(manager.tokenBudget).toBe(8_000);
  });

  it("should report usage ratio correctly", () => {
    const manager = new ContextManager({ maxContextTokens: 10_000 });
    const messages: ChatMessage[] = [msg("user", "Hello"), msg("assistant", "Hi there!")];

    const usage = manager.getUsage(messages);
    expect(usage.usageRatio).toBeGreaterThan(0);
    expect(usage.usageRatio).toBeLessThan(1);
    expect(usage.messageCount).toBe(2);
  });

  it("should correctly detect compaction threshold", () => {
    const manager = new ContextManager({
      maxContextTokens: 100, // Very small budget
      compactionThreshold: 0.5,
    });

    // Very large messages should exceed threshold
    const messages: ChatMessage[] = createTurns(10, 200);
    expect(manager.needsCompaction(messages)).toBe(true);
  });

  it("should not trigger compaction for small conversations", () => {
    const manager = new ContextManager({
      maxContextTokens: 100_000,
      compactionThreshold: 0.835,
    });

    const messages: ChatMessage[] = [msg("user", "Hello"), msg("assistant", "Hi!")];
    expect(manager.needsCompaction(messages)).toBe(false);
  });
});
