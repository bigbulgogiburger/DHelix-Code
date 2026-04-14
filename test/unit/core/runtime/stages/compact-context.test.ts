import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  type RuntimeContext,
  type UsageAggregatorInterface,
} from "../../../../../src/core/runtime/types.js";
import { type ChatMessage, type LLMProvider } from "../../../../../src/llm/provider.js";
import { type ToolCallStrategy } from "../../../../../src/llm/tool-call-strategy.js";
import { type ToolRegistry } from "../../../../../src/tools/registry.js";
import { type AppEventEmitter } from "../../../../../src/utils/events.js";
import { type AgentLoopConfig } from "../../../../../src/core/agent-loop.js";
import { type ContextManager } from "../../../../../src/core/context-manager.js";
import { type CircuitBreaker } from "../../../../../src/core/circuit-breaker.js";

vi.mock("../../../../../src/constants.js", () => ({
  AGENT_LOOP: {
    preemptiveCompactionThreshold: 0.8,
  },
}));

import { createCompactContextStage } from "../../../../../src/core/runtime/stages/compact-context.js";

function createMockContext(overrides: Partial<RuntimeContext> = {}): RuntimeContext {
  const mockEvents = {
    emit: vi.fn(),
    on: vi.fn(),
    off: vi.fn(),
  } as unknown as AppEventEmitter;

  const mockUsageAggregator: UsageAggregatorInterface = {
    recordLLMUsage: vi.fn(),
    recordToolCalls: vi.fn(),
    recordRetry: vi.fn(),
    snapshot: vi.fn().mockReturnValue({
      totalPromptTokens: 0,
      totalCompletionTokens: 0,
      totalTokens: 0,
      iterationCount: 0,
      toolCallCount: 0,
      retriedCount: 0,
    }),
  };

  const mockCircuitBreaker = {
    shouldContinue: vi.fn().mockReturnValue(true),
    recordIteration: vi.fn(),
    getStatus: vi.fn().mockReturnValue({ isOpen: false }),
  } as unknown as CircuitBreaker;

  const mockContextManager = {
    prepare: vi.fn().mockResolvedValue([]),
    compact: vi.fn().mockResolvedValue({ messages: [], result: {} }),
    getUsage: vi.fn().mockReturnValue({ usageRatio: 0.5 }),
    getAsyncCompactionResult: vi.fn().mockReturnValue(null),
    getAsyncCompactionEngine: vi.fn().mockReturnValue({
      getProactiveThreshold: vi.fn().mockReturnValue(0.7),
    }),
    requestAsyncCompaction: vi.fn().mockResolvedValue(undefined),
    trackFileAccess: vi.fn(),
  } as unknown as ContextManager;

  const mockConfig = {
    client: { chat: vi.fn(), stream: vi.fn(), countTokens: vi.fn() } as unknown as LLMProvider,
    model: "test-model",
    toolRegistry: {
      isDeferredMode: false,
      getAll: vi.fn().mockReturnValue([]),
      getDefinitionsForLLM: vi.fn().mockReturnValue([]),
      getHotDefinitionsForLLM: vi.fn().mockReturnValue([]),
      resolveDeferredTool: vi.fn().mockReturnValue(null),
    } as unknown as ToolRegistry,
    strategy: {
      name: "native" as const,
      prepareRequest: vi.fn().mockReturnValue({ messages: [], tools: [] }),
      extractToolCalls: vi.fn().mockReturnValue([]),
      formatToolResults: vi.fn().mockReturnValue([]),
    } as unknown as ToolCallStrategy,
    events: mockEvents,
  } as unknown as AgentLoopConfig;

  return {
    iteration: 1,
    messages: [] as ChatMessage[],
    managedMessages: [] as ChatMessage[],
    response: undefined,
    extractedCalls: [],
    toolResults: [],
    startedAt: Date.now(),
    timings: new Map(),
    circuitBreaker: mockCircuitBreaker,
    usageAggregator: mockUsageAggregator,
    signal: undefined,
    transitionReason: "initial",
    config: mockConfig,
    contextManager: mockContextManager,
    maxIterations: 50,
    maxRetries: 2,
    maxToolResultChars: 12000,
    events: mockEvents,
    strategy: mockConfig.strategy,
    toolRegistry: mockConfig.toolRegistry,
    activeClient: mockConfig.client,
    activeModel: mockConfig.model,
    toolDefs: [],
    permissionDenialCounts: new Map(),
    consecutiveEmptyResponses: 0,
    consecutiveIncompleteResponses: 0,
    lastToolCallSignature: "",
    duplicateToolCallCount: 0,
    lastCompactionIteration: -Infinity,
    shouldContinueLoop: false,
    preparedMessages: [],
    preparedTools: [],
    ...overrides,
  };
}

describe("createCompactContextStage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should have name "compact-context"', () => {
    const stage = createCompactContextStage();
    expect(stage.name).toBe("compact-context");
  });

  it("should apply async compaction result when available", async () => {
    const stage = createCompactContextStage();
    const asyncMessages: ChatMessage[] = [{ role: "user", content: "compacted message" }];

    const ctx = createMockContext({ iteration: 10 });
    vi.mocked(ctx.contextManager.getAsyncCompactionResult).mockReturnValue(asyncMessages);
    vi.mocked(ctx.contextManager.getUsage).mockReturnValue({ usageRatio: 0.4 } as never);

    await stage.execute(ctx);

    expect(ctx.managedMessages).toEqual(asyncMessages);
    expect(ctx.lastCompactionIteration).toBe(10);
    // Should return early without checking thresholds
    expect(ctx.contextManager.compact).not.toHaveBeenCalled();
    expect(ctx.contextManager.requestAsyncCompaction).not.toHaveBeenCalled();
  });

  it("should trigger synchronous compaction at 80% usage", async () => {
    const stage = createCompactContextStage();
    const compactedMessages: ChatMessage[] = [{ role: "user", content: "compacted" }];

    const originalMessages: ChatMessage[] = [
      { role: "user", content: "original" },
      { role: "assistant", content: "response" },
    ];

    const ctx = createMockContext({
      iteration: 10,
      lastCompactionIteration: 1,
      managedMessages: [...originalMessages],
    });

    vi.mocked(ctx.contextManager.getAsyncCompactionResult).mockReturnValue(null);
    vi.mocked(ctx.contextManager.getUsage).mockReturnValue({ usageRatio: 0.85 } as never);
    vi.mocked(ctx.contextManager.compact).mockResolvedValue({
      messages: compactedMessages,
      result: {},
    } as never);

    await stage.execute(ctx);

    expect(ctx.events.emit).toHaveBeenCalledWith("context:pre-compact", { compactionNumber: 0 });
    expect(ctx.contextManager.compact).toHaveBeenCalledWith(originalMessages);
    expect(ctx.managedMessages).toEqual(compactedMessages);
    expect(ctx.lastCompactionIteration).toBe(10);
  });

  it("should trigger async compaction at 70% usage", async () => {
    const stage = createCompactContextStage();

    const ctx = createMockContext({
      iteration: 10,
      lastCompactionIteration: 1,
      managedMessages: [{ role: "user", content: "hello" }],
    });

    vi.mocked(ctx.contextManager.getAsyncCompactionResult).mockReturnValue(null);
    vi.mocked(ctx.contextManager.getUsage).mockReturnValue({ usageRatio: 0.72 } as never);

    await stage.execute(ctx);

    // Should not trigger sync compaction (below 80%)
    expect(ctx.contextManager.compact).not.toHaveBeenCalled();
    // Should trigger async compaction (above 70%)
    expect(ctx.contextManager.requestAsyncCompaction).toHaveBeenCalledWith(ctx.managedMessages);
  });

  it("should skip compaction when recently compacted (within 2 iterations)", async () => {
    const stage = createCompactContextStage();

    const ctx = createMockContext({
      iteration: 5,
      lastCompactionIteration: 4, // Only 1 iteration ago
    });

    vi.mocked(ctx.contextManager.getAsyncCompactionResult).mockReturnValue(null);
    vi.mocked(ctx.contextManager.getUsage).mockReturnValue({ usageRatio: 0.9 } as never);

    await stage.execute(ctx);

    // Should skip both sync and async compaction
    expect(ctx.contextManager.compact).not.toHaveBeenCalled();
    expect(ctx.contextManager.requestAsyncCompaction).not.toHaveBeenCalled();
  });

  it("should do nothing when usage is below thresholds", async () => {
    const stage = createCompactContextStage();

    const ctx = createMockContext({
      iteration: 10,
      lastCompactionIteration: 1,
    });

    vi.mocked(ctx.contextManager.getAsyncCompactionResult).mockReturnValue(null);
    vi.mocked(ctx.contextManager.getUsage).mockReturnValue({ usageRatio: 0.3 } as never);

    await stage.execute(ctx);

    expect(ctx.contextManager.compact).not.toHaveBeenCalled();
    expect(ctx.contextManager.requestAsyncCompaction).not.toHaveBeenCalled();
    expect(ctx.events.emit).not.toHaveBeenCalled();
  });
});
