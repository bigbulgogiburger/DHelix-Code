import { describe, it, expect } from "vitest";
import { ContextManager, getContextConfig } from "../../../src/core/context-manager.js";
import { type ChatMessage } from "../../../src/llm/provider.js";

/** Create a message with predictable content */
function msg(role: ChatMessage["role"], content: string): ChatMessage {
  return { role, content };
}

/** Create multiple user-assistant pairs */
function createTurns(count: number, contentSize = 100): ChatMessage[] {
  const messages: ChatMessage[] = [];
  for (let i = 0; i < count; i++) {
    const userContent = `User message ${i}: ${"x".repeat(contentSize)}`;
    const assistantContent = `Assistant response ${i}: ${"y".repeat(contentSize)}`;
    messages.push(msg("user", userContent));
    messages.push(msg("assistant", assistantContent));
  }
  return messages;
}

describe("ContextManager", () => {
  it("should calculate context usage", () => {
    const manager = new ContextManager({ maxContextTokens: 1000 });
    const messages: ChatMessage[] = [
      msg("system", "You are a helpful assistant."),
      msg("user", "Hello"),
      msg("assistant", "Hi there!"),
    ];

    const usage = manager.getUsage(messages);

    expect(usage.totalTokens).toBeGreaterThan(0);
    expect(usage.messageCount).toBe(3);
    expect(usage.usageRatio).toBeGreaterThan(0);
    expect(usage.usageRatio).toBeLessThan(1);
  });

  it("should not need compaction when under threshold", () => {
    const manager = new ContextManager({
      maxContextTokens: 100_000,
      compactionThreshold: 0.95,
    });
    const messages: ChatMessage[] = [msg("user", "Hello"), msg("assistant", "Hi!")];

    expect(manager.needsCompaction(messages)).toBe(false);
  });

  it("should return messages unchanged when compaction is not needed", async () => {
    const manager = new ContextManager({ maxContextTokens: 100_000 });
    const messages: ChatMessage[] = [
      msg("system", "System prompt"),
      msg("user", "Hello"),
      msg("assistant", "Hi!"),
    ];

    const prepared = await manager.prepare(messages);
    expect(prepared).toEqual(messages);
  });

  it("should compact when over threshold", async () => {
    // Use larger content so summary is smaller than original
    const manager = new ContextManager({
      maxContextTokens: 500,
      compactionThreshold: 0.5,
      preserveRecentTurns: 2,
    });

    const messages: ChatMessage[] = [msg("system", "System prompt"), ...createTurns(10, 200)];

    const { messages: compacted, result } = await manager.compact(messages);

    // Should have fewer messages than original
    expect(compacted.length).toBeLessThan(messages.length);
    expect(result.removedMessages).toBeGreaterThan(0);
    expect(result.summary).toBeDefined();
    expect(result.summary.length).toBeGreaterThan(0);
  });

  it("should preserve system messages during compaction", async () => {
    const manager = new ContextManager({
      maxContextTokens: 100,
      compactionThreshold: 0.5,
      preserveRecentTurns: 2,
    });

    const systemMsg = msg("system", "Important system prompt");
    const messages: ChatMessage[] = [systemMsg, ...createTurns(10, 50)];

    const { messages: compacted } = await manager.compact(messages);

    // System message should be first (reloaded from disk during compaction)
    expect(compacted[0].role).toBe("system");
    expect(compacted[0].content.length).toBeGreaterThan(0);
  });

  it("should preserve recent turns during compaction", async () => {
    const manager = new ContextManager({
      maxContextTokens: 100,
      compactionThreshold: 0.5,
      preserveRecentTurns: 2,
    });

    const turns = createTurns(10, 50);
    const lastUserMsg = turns[turns.length - 2]; // Second to last (user)
    const lastAssistantMsg = turns[turns.length - 1]; // Last (assistant)
    const messages: ChatMessage[] = [msg("system", "sys"), ...turns];

    const { messages: compacted } = await manager.compact(messages);

    // Recent messages should be preserved
    const compactedContents = compacted.map((m) => m.content);
    expect(compactedContents).toContain(lastUserMsg.content);
    expect(compactedContents).toContain(lastAssistantMsg.content);
  });

  it("should add conversation summary as system message", async () => {
    const manager = new ContextManager({
      maxContextTokens: 100,
      compactionThreshold: 0.5,
      preserveRecentTurns: 2,
    });

    const messages: ChatMessage[] = [msg("system", "sys"), ...createTurns(10, 50)];

    const { messages: compacted } = await manager.compact(messages);

    // Should have a summary message
    const summaryMsg = compacted.find(
      (m) => m.role === "system" && m.content.includes("[Conversation summary]"),
    );
    expect(summaryMsg).toBeDefined();
  });

  it("should support focused compaction", async () => {
    const manager = new ContextManager({
      maxContextTokens: 100,
      compactionThreshold: 0.5,
      preserveRecentTurns: 2,
    });

    const messages: ChatMessage[] = [msg("system", "sys"), ...createTurns(10, 50)];

    const { result } = await manager.manualCompact(messages, "authentication");

    expect(result.summary).toContain("Focus: authentication");
  });

  it("should truncate large tool results", async () => {
    const manager = new ContextManager({
      maxContextTokens: 100,
      compactionThreshold: 0.1,
      preserveRecentTurns: 1,
    });

    // Use a moderately large tool result (3000 chars ~ 750 tokens, above 500 token threshold)
    const largeToolResult = "test output line\n".repeat(200);
    const messages: ChatMessage[] = [
      msg("user", "run test"),
      { role: "tool", content: largeToolResult, toolCallId: "t1" },
      msg("assistant", "done"),
    ];

    const { messages: compacted } = await manager.compact(messages);

    const toolMsg = compacted.find((m) => m.role === "tool");
    if (toolMsg) {
      expect(toolMsg.content.length).toBeLessThan(largeToolResult.length);
      expect(toolMsg.content).toContain("omitted");
    }
  });

  it("should compact when prepare detects need", async () => {
    const manager = new ContextManager({
      maxContextTokens: 500,
      compactionThreshold: 0.5,
      preserveRecentTurns: 2,
    });

    const messages: ChatMessage[] = [msg("system", "sys"), ...createTurns(10, 200)];
    const prepared = await manager.prepare(messages);

    // Should be compacted (fewer messages)
    expect(prepared.length).toBeLessThan(messages.length);
  });

  it("should expose correct token budget", () => {
    const manager = new ContextManager({
      maxContextTokens: 10_000,
      responseReserveRatio: 0.2,
    });

    expect(manager.tokenBudget).toBe(8_000);
  });
});

describe("getContextConfig", () => {
  it("should return high-tier config", () => {
    const config = getContextConfig("high");
    expect(config.compactionThreshold).toBe(0.835);
    expect(config.preserveRecentTurns).toBe(5);
  });

  it("should return medium-tier config", () => {
    const config = getContextConfig("medium");
    expect(config.compactionThreshold).toBe(0.75);
    expect(config.preserveRecentTurns).toBe(4);
  });

  it("should return low-tier config", () => {
    const config = getContextConfig("low");
    expect(config.compactionThreshold).toBe(0.65);
    expect(config.preserveRecentTurns).toBe(3);
  });

  it("should return lower threshold for lower tiers", () => {
    const high = getContextConfig("high");
    const medium = getContextConfig("medium");
    const low = getContextConfig("low");

    expect(high.compactionThreshold).toBeGreaterThan(medium.compactionThreshold);
    expect(medium.compactionThreshold).toBeGreaterThan(low.compactionThreshold);
  });

  it("should return fewer preserved turns for lower tiers", () => {
    const high = getContextConfig("high");
    const medium = getContextConfig("medium");
    const low = getContextConfig("low");

    expect(high.preserveRecentTurns).toBeGreaterThan(medium.preserveRecentTurns);
    expect(medium.preserveRecentTurns).toBeGreaterThan(low.preserveRecentTurns);
  });
});
