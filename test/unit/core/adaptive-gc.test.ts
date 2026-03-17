import { describe, it, expect, vi } from "vitest";
import { ContextManager } from "../../../src/core/context-manager.js";
import type { ChatMessage } from "../../../src/llm/provider.js";

// Mock token counter for deterministic tests
vi.mock("../../../src/llm/token-counter.js", () => ({
  countTokens: vi.fn((text: string) => Math.ceil(text.length / 4)),
  estimateTokens: vi.fn((text: string) => Math.ceil(text.length / 4)),
  countMessageTokens: vi.fn((messages: ChatMessage[]) => {
    let total = 0;
    for (const m of messages) {
      total += Math.ceil(m.content.length / 4);
    }
    return total;
  }),
}));

function msg(role: ChatMessage["role"], content: string): ChatMessage {
  return { role, content };
}

describe("Adaptive GC interval", () => {
  it("should use short GC interval (1) when context usage > 80%", async () => {
    // maxContextTokens = 100, responseReserve = 0.2 → budget = 80 tokens
    // 80 tokens * 4 chars/token = 320 chars → fill to >80% means >256 chars
    const manager = new ContextManager({
      maxContextTokens: 100,
      compactionThreshold: 0.99, // high threshold so auto-compaction doesn't interfere
      sessionId: "adaptive-gc-high",
    });

    // Access private method via type assertion for testing
    const getAdaptiveGcInterval = (
      manager as unknown as {
        getAdaptiveGcInterval(messages: readonly ChatMessage[]): number;
      }
    ).getAdaptiveGcInterval.bind(manager);

    // Messages totaling >80% of budget (~80 tokens budget, need >64 tokens → >256 chars)
    const messages = [msg("user", "x".repeat(300))];
    const interval = getAdaptiveGcInterval(messages);

    expect(interval).toBe(1);
  });

  it("should use medium GC interval (5) when context usage is 50-80%", async () => {
    const manager = new ContextManager({
      maxContextTokens: 100,
      compactionThreshold: 0.99,
      sessionId: "adaptive-gc-medium",
    });

    const getAdaptiveGcInterval = (
      manager as unknown as {
        getAdaptiveGcInterval(messages: readonly ChatMessage[]): number;
      }
    ).getAdaptiveGcInterval.bind(manager);

    // Need 50-80% of 80 tokens → 40-64 tokens → 160-256 chars
    const messages = [msg("user", "x".repeat(200))];
    const interval = getAdaptiveGcInterval(messages);

    expect(interval).toBe(5);
  });

  it("should use long GC interval (15) when context usage < 50%", async () => {
    const manager = new ContextManager({
      maxContextTokens: 100_000,
      compactionThreshold: 0.99,
      sessionId: "adaptive-gc-low",
    });

    const getAdaptiveGcInterval = (
      manager as unknown as {
        getAdaptiveGcInterval(messages: readonly ChatMessage[]): number;
      }
    ).getAdaptiveGcInterval.bind(manager);

    // Very small messages relative to large budget
    const messages = [msg("user", "Hello")];
    const interval = getAdaptiveGcInterval(messages);

    expect(interval).toBe(15);
  });

  it("should return 5 at exactly 50% usage boundary", async () => {
    // budget = 80 tokens, 50% = 40 tokens = 160 chars
    const manager = new ContextManager({
      maxContextTokens: 100,
      compactionThreshold: 0.99,
      sessionId: "adaptive-gc-boundary-50",
    });

    const getAdaptiveGcInterval = (
      manager as unknown as {
        getAdaptiveGcInterval(messages: readonly ChatMessage[]): number;
      }
    ).getAdaptiveGcInterval.bind(manager);

    // Exactly 50%: 40 tokens = 160 chars
    const messages = [msg("user", "x".repeat(160))];
    const interval = getAdaptiveGcInterval(messages);

    expect(interval).toBe(5);
  });

  it("should return 1 when usage is at 81%", async () => {
    // budget = 80 tokens, 81% ≈ 64.8 tokens ≈ 260 chars
    const manager = new ContextManager({
      maxContextTokens: 100,
      compactionThreshold: 0.99,
      sessionId: "adaptive-gc-boundary-80",
    });

    const getAdaptiveGcInterval = (
      manager as unknown as {
        getAdaptiveGcInterval(messages: readonly ChatMessage[]): number;
      }
    ).getAdaptiveGcInterval.bind(manager);

    const messages = [msg("user", "x".repeat(260))];
    const interval = getAdaptiveGcInterval(messages);

    expect(interval).toBe(1);
  });
});
