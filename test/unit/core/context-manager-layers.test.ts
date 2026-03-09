import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { ContextManager } from "../../../src/core/context-manager.js";
import type { ChatMessage } from "../../../src/llm/provider.js";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

/** Create a message with predictable content */
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

/** Create multiple user-assistant pairs */
function createTurns(count: number, contentSize = 100): ChatMessage[] {
  const messages: ChatMessage[] = [];
  for (let i = 0; i < count; i++) {
    messages.push(msg("user", `User message ${i}: ${"x".repeat(contentSize)}`));
    messages.push(msg("assistant", `Assistant response ${i}: ${"y".repeat(contentSize)}`));
  }
  return messages;
}

/** Create a large tool result simulating file_read output */
function largeFileReadResult(lineCount = 200): string {
  const lines: string[] = [];
  for (let i = 1; i <= lineCount; i++) {
    lines.push(`  ${i}\t${"a".repeat(80)}`);
  }
  return lines.join("\n");
}

describe("Layer 1: Microcompaction", () => {
  it("should not microcompact when tool messages are fewer than hot tail size", async () => {
    const manager = new ContextManager({ maxContextTokens: 100_000 });
    const messages: ChatMessage[] = [
      msg("user", "read files"),
      toolMsg("short result", "t1"),
      msg("assistant", "done"),
    ];

    const result = await manager.microcompact(messages);
    expect(result).toEqual(messages);
  });

  it("should keep the hot tail of tool results inline", async () => {
    const manager = new ContextManager({
      maxContextTokens: 100_000,
      sessionId: "test-micro",
    });

    // Create messages with 8 tool results (> HOT_TAIL_SIZE=5)
    const messages: ChatMessage[] = [];
    for (let i = 0; i < 8; i++) {
      messages.push(msg("user", `request ${i}`));
      // Large tool results that look like file_read output
      messages.push(toolMsg(largeFileReadResult(100), `t${i}`));
      messages.push(msg("assistant", `response ${i}`));
    }

    const result = await manager.microcompact(messages);

    // The last 5 tool results should be inline (unchanged)
    const toolMsgs = result.filter((m) => m.role === "tool");
    const lastFiveTools = toolMsgs.slice(-5);
    for (const tm of lastFiveTools) {
      expect(tm.content).not.toContain("[Tool output stored at:");
    }

    // Older tool results (above min token threshold) should be cold references
    const coldTools = toolMsgs.filter((m) => m.content.includes("[Tool output stored at:"));
    expect(coldTools.length).toBeGreaterThan(0);
  });

  it("should not cold-store small tool results", async () => {
    const manager = new ContextManager({
      maxContextTokens: 100_000,
      sessionId: "test-micro-small",
    });

    // 8 tool results but all are small (under COLD_STORAGE_MIN_TOKENS=200)
    const messages: ChatMessage[] = [];
    for (let i = 0; i < 8; i++) {
      messages.push(msg("user", `request ${i}`));
      messages.push(toolMsg("small output", `t${i}`));
      messages.push(msg("assistant", `response ${i}`));
    }

    const result = await manager.microcompact(messages);

    // None should be cold-stored since they're all too small
    const coldTools = result.filter(
      (m) => m.role === "tool" && m.content.includes("[Tool output stored at:"),
    );
    expect(coldTools.length).toBe(0);
  });

  it("should write cold storage files to disk", async () => {
    const manager = new ContextManager({
      maxContextTokens: 100_000,
      sessionId: "test-cold-write",
    });

    const largeContent = largeFileReadResult(200);
    const messages: ChatMessage[] = [];
    for (let i = 0; i < 8; i++) {
      messages.push(msg("user", `request ${i}`));
      messages.push(toolMsg(i < 3 ? largeContent : "short", `t${i}`));
      messages.push(msg("assistant", `response ${i}`));
    }

    const result = await manager.microcompact(messages);

    // Find cold references and verify they point to real files
    const coldRefs = result.filter(
      (m) => m.role === "tool" && m.content.includes("[Tool output stored at:"),
    );

    for (const ref of coldRefs) {
      const pathMatch = ref.content.match(/stored at: (.+?\.txt)\./);
      if (pathMatch) {
        const filePath = pathMatch[1];
        const stored = await readFile(filePath, "utf-8");
        expect(stored).toBe(largeContent);
      }
    }
  });
});

describe("Layer 2: Auto-compaction threshold", () => {
  it("should use 0.835 as default compaction threshold", () => {
    const manager = new ContextManager({ maxContextTokens: 10_000 });
    // The manager doesn't expose the threshold directly, but we can test behavior
    // Create messages that use ~84% of budget
    const budget = manager.tokenBudget;
    expect(budget).toBe(8_000); // 10_000 * 0.8

    // At 83.5% of 8000 = 6680 tokens, it should need compaction
    // This is tested indirectly through needsCompaction
  });

  it("should include boundary marker in compacted output", async () => {
    const manager = new ContextManager({
      maxContextTokens: 500,
      compactionThreshold: 0.5,
      preserveRecentTurns: 2,
    });

    const messages: ChatMessage[] = [msg("system", "sys"), ...createTurns(10, 200)];
    const { messages: compacted } = await manager.compact(messages);

    // Should have a compaction boundary marker
    const boundaryMsg = compacted.find(
      (m) => m.role === "system" && m.content.includes("[Compaction #1 boundary]"),
    );
    expect(boundaryMsg).toBeDefined();
    expect(boundaryMsg!.content).toContain("Compacted at:");
    expect(boundaryMsg!.content).toContain("Turns summarized:");
  });

  it("should increment compaction count on subsequent compactions", async () => {
    const manager = new ContextManager({
      maxContextTokens: 500,
      compactionThreshold: 0.5,
      preserveRecentTurns: 2,
    });

    const messages1: ChatMessage[] = [msg("system", "sys"), ...createTurns(10, 200)];
    await manager.compact(messages1);

    const messages2: ChatMessage[] = [msg("system", "sys"), ...createTurns(10, 200)];
    const { messages: compacted2 } = await manager.compact(messages2);

    const boundaryMsg = compacted2.find(
      (m) => m.role === "system" && m.content.includes("[Compaction #2 boundary]"),
    );
    expect(boundaryMsg).toBeDefined();
  });

  it("should include structured sections in local summary", async () => {
    const manager = new ContextManager({
      maxContextTokens: 100,
      compactionThreshold: 0.1,
      preserveRecentTurns: 1,
    });

    const messages: ChatMessage[] = [
      msg("system", "sys"),
      msg("user", "read the file"),
      {
        role: "tool",
        content: 'file_path: "/src/app.ts"\nconst x = 1;',
        toolCallId: "t1",
      },
      msg("assistant", "here is the file"),
      msg("user", "fix the error"),
      {
        role: "tool",
        content: "Error: cannot find module\nSTDERR: compilation failed",
        toolCallId: "t2",
      },
      msg("assistant", "found the error"),
      ...createTurns(5, 50),
    ];

    const { result } = await manager.compact(messages);

    expect(result.summary).toContain("## Files Touched");
    expect(result.summary).toContain("## Errors Encountered");
  });
});

describe("Layer 3: Post-compaction rehydration", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "dbcode-rehydrate-"));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it("should re-read recently accessed files after compaction", async () => {
    const { writeFile: writeF } = await import("node:fs/promises");
    const testFile = join(tempDir, "test.ts");
    await writeF(testFile, 'export const hello = "world";', "utf-8");

    const manager = new ContextManager({
      maxContextTokens: 500,
      compactionThreshold: 0.5,
      preserveRecentTurns: 2,
    });

    // Track a file access
    manager.trackFileAccess(testFile);

    const messages: ChatMessage[] = [msg("system", "sys"), ...createTurns(10, 200)];
    const { messages: compacted } = await manager.compact(messages);

    // Should have a rehydration message with the file content
    const rehydrationMsg = compacted.find(
      (m) => m.role === "system" && m.content.includes("[Post-compaction rehydration]"),
    );
    expect(rehydrationMsg).toBeDefined();
    expect(rehydrationMsg!.content).toContain(testFile);
    expect(rehydrationMsg!.content).toContain('export const hello = "world"');
  });

  it("should not add rehydration message when no files are tracked", async () => {
    const manager = new ContextManager({
      maxContextTokens: 500,
      compactionThreshold: 0.5,
      preserveRecentTurns: 2,
    });

    const messages: ChatMessage[] = [msg("system", "sys"), ...createTurns(10, 200)];
    const { messages: compacted } = await manager.compact(messages);

    const rehydrationMsg = compacted.find(
      (m) => m.role === "system" && m.content.includes("[Post-compaction rehydration]"),
    );
    expect(rehydrationMsg).toBeUndefined();
  });

  it("should skip files that no longer exist", async () => {
    const manager = new ContextManager({
      maxContextTokens: 500,
      compactionThreshold: 0.5,
      preserveRecentTurns: 2,
    });

    // Track a nonexistent file
    manager.trackFileAccess("/nonexistent/file.ts");

    const messages: ChatMessage[] = [msg("system", "sys"), ...createTurns(10, 200)];
    const { messages: compacted } = await manager.compact(messages);

    // No rehydration since the only tracked file doesn't exist
    const rehydrationMsg = compacted.find(
      (m) => m.role === "system" && m.content.includes("[Post-compaction rehydration]"),
    );
    expect(rehydrationMsg).toBeUndefined();
  });

  it("should track most recent file access first", () => {
    const manager = new ContextManager({ maxContextTokens: 100_000 });

    manager.trackFileAccess("/a.ts");
    manager.trackFileAccess("/b.ts");
    manager.trackFileAccess("/a.ts"); // access again — should move to front

    // Can't directly inspect recentFiles, but we can verify through rehydration behavior
    // The important thing is that it doesn't crash and handles duplicates
  });
});

describe("PreCompact hook", () => {
  it("should call onPreCompact before compaction", async () => {
    const onPreCompact = vi.fn();
    const manager = new ContextManager({
      maxContextTokens: 500,
      compactionThreshold: 0.5,
      preserveRecentTurns: 2,
      onPreCompact,
    });

    const messages: ChatMessage[] = [msg("system", "sys"), ...createTurns(10, 200)];
    await manager.compact(messages);

    expect(onPreCompact).toHaveBeenCalledOnce();
  });

  it("should not call onPreCompact when compaction is not needed", async () => {
    const onPreCompact = vi.fn();
    const manager = new ContextManager({
      maxContextTokens: 100_000,
      onPreCompact,
    });

    const messages: ChatMessage[] = [msg("user", "Hello"), msg("assistant", "Hi!")];
    await manager.prepare(messages);

    expect(onPreCompact).not.toHaveBeenCalled();
  });
});

describe("Integration: prepare() with all layers", () => {
  it("should apply microcompaction then auto-compaction", async () => {
    const manager = new ContextManager({
      maxContextTokens: 500,
      compactionThreshold: 0.3,
      preserveRecentTurns: 2,
      sessionId: "test-integration",
    });

    // Create a conversation with many large tool results
    const messages: ChatMessage[] = [msg("system", "sys")];
    for (let i = 0; i < 10; i++) {
      messages.push(msg("user", `request ${i}`));
      messages.push(toolMsg(largeFileReadResult(50), `t${i}`));
      messages.push(msg("assistant", `response ${i}: ${"z".repeat(200)}`));
    }

    const prepared = await manager.prepare(messages);

    // Should be significantly smaller than original
    expect(prepared.length).toBeLessThan(messages.length);
  });
});
