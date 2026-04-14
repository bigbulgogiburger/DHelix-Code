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

vi.mock("../../../../../src/core/tool-call-utils.js", () => ({
  filterValidToolCalls: vi.fn((calls) => calls),
}));

import { filterValidToolCalls } from "../../../../../src/core/tool-call-utils.js";
import { createExtractCallsStage } from "../../../../../src/core/runtime/stages/extract-calls.js";

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
    enableGuardrails: true,
    workingDirectory: "/test",
    checkPermission: undefined as unknown,
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

describe("createExtractCallsStage", () => {
  let stage: ReturnType<typeof createExtractCallsStage>;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(filterValidToolCalls).mockImplementation((calls) => calls);
    stage = createExtractCallsStage();
  });

  it("should have name 'extract-calls'", () => {
    expect(stage.name).toBe("extract-calls");
  });

  it("should return early when no response", async () => {
    const ctx = createMockContext({ response: undefined });

    await stage.execute(ctx);

    expect(ctx.extractedCalls).toEqual([]);
    expect(ctx.events.emit).not.toHaveBeenCalled();
  });

  it("should extract and set tool calls", async () => {
    const mockCalls = [{ id: "call-1", name: "file_read", arguments: { path: "/test.ts" } }];
    const mockStrategy = {
      name: "native" as const,
      prepareRequest: vi.fn(),
      extractToolCalls: vi.fn().mockReturnValue(mockCalls),
      formatToolResults: vi.fn(),
    } as unknown as ToolCallStrategy;

    const ctx = createMockContext({
      response: {
        content: "Let me read that file.",
        toolCalls: [],
        usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
        finishReason: "stop",
      },
      strategy: mockStrategy,
    });

    await stage.execute(ctx);

    expect(mockStrategy.extractToolCalls).toHaveBeenCalledWith("Let me read that file.", []);
    expect(ctx.extractedCalls).toEqual(mockCalls);
  });

  it("should use fallback when strategy returns empty but native toolCalls exist", async () => {
    const nativeToolCalls = [{ id: "tc-1", name: "bash", arguments: '{"command":"ls"}' }];
    const mockStrategy = {
      name: "native" as const,
      prepareRequest: vi.fn(),
      extractToolCalls: vi.fn().mockReturnValue([]),
      formatToolResults: vi.fn(),
    } as unknown as ToolCallStrategy;

    const ctx = createMockContext({
      response: {
        content: "",
        toolCalls: nativeToolCalls,
        usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
        finishReason: "tool_calls",
      },
      strategy: mockStrategy,
    });

    await stage.execute(ctx);

    // filterValidToolCalls is called twice: once for raw, once for fallback
    expect(filterValidToolCalls).toHaveBeenCalledTimes(2);
    expect(ctx.extractedCalls).toEqual([
      { id: "tc-1", name: "bash", arguments: { command: "ls" } },
    ]);
  });

  it("should inject error feedback when all raw calls have invalid JSON", async () => {
    const rawCalls = [{ id: "call-1", name: "file_write", arguments: {} }];
    const mockStrategy = {
      name: "native" as const,
      prepareRequest: vi.fn(),
      extractToolCalls: vi.fn().mockReturnValue(rawCalls),
      formatToolResults: vi.fn(),
    } as unknown as ToolCallStrategy;

    // filterValidToolCalls returns all calls on first invocation (raw),
    // but returns empty on the actual filter step
    const filterMock = vi.mocked(filterValidToolCalls);
    filterMock.mockReturnValueOnce(rawCalls); // raw extraction
    filterMock.mockReturnValueOnce([]); // override: simulate second pass

    // We need raw > 0 and extracted = 0 to trigger feedback.
    // Re-mock: extractToolCalls returns rawCalls, filterValidToolCalls returns empty
    filterMock.mockReset();
    filterMock.mockReturnValue([]);

    const ctx = createMockContext({
      response: {
        content: "I will write the file.",
        toolCalls: [],
        usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
        finishReason: "tool_calls",
      },
      strategy: mockStrategy,
    });

    await stage.execute(ctx);

    expect(ctx.shouldContinueLoop).toBe(true);
    expect(ctx.extractedCalls).toEqual([]);
    expect(ctx.messages).toHaveLength(1);
    expect(ctx.messages[0].content).toContain("invalid or incomplete JSON");
  });

  it("should handle empty response with retry (consecutiveEmptyResponses)", async () => {
    const mockStrategy = {
      name: "native" as const,
      prepareRequest: vi.fn(),
      extractToolCalls: vi.fn().mockReturnValue([]),
      formatToolResults: vi.fn(),
    } as unknown as ToolCallStrategy;

    const ctx = createMockContext({
      response: {
        content: "",
        toolCalls: [],
        usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
        finishReason: "stop",
      },
      strategy: mockStrategy,
      consecutiveEmptyResponses: 0,
    });

    await stage.execute(ctx);

    expect(ctx.consecutiveEmptyResponses).toBe(1);
    expect(ctx.shouldContinueLoop).toBe(true);
    expect(ctx.messages).toHaveLength(1);
    expect(ctx.messages[0].content).toContain("previous response was empty");
    expect(ctx.events.emit).toHaveBeenCalledWith(
      "llm:error",
      expect.objectContaining({
        error: expect.any(Error),
      }),
    );
  });

  it("should emit agent:assistant-message event", async () => {
    const mockCalls = [{ id: "call-1", name: "grep_search", arguments: { pattern: "foo" } }];
    const mockStrategy = {
      name: "native" as const,
      prepareRequest: vi.fn(),
      extractToolCalls: vi.fn().mockReturnValue(mockCalls),
      formatToolResults: vi.fn(),
    } as unknown as ToolCallStrategy;

    const ctx = createMockContext({
      response: {
        content: "Searching for pattern...",
        toolCalls: [],
        usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
        finishReason: "stop",
      },
      strategy: mockStrategy,
      iteration: 3,
    });

    await stage.execute(ctx);

    expect(ctx.events.emit).toHaveBeenCalledWith("agent:assistant-message", {
      content: "Searching for pattern...",
      toolCalls: [{ id: "call-1", name: "grep_search" }],
      iteration: 3,
      isFinal: false,
    });
  });

  it("should reset consecutiveEmptyResponses on non-empty response", async () => {
    const mockStrategy = {
      name: "native" as const,
      prepareRequest: vi.fn(),
      extractToolCalls: vi.fn().mockReturnValue([]),
      formatToolResults: vi.fn(),
    } as unknown as ToolCallStrategy;

    const ctx = createMockContext({
      response: {
        content: "Here is my answer.",
        toolCalls: [],
        usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
        finishReason: "stop",
      },
      strategy: mockStrategy,
      consecutiveEmptyResponses: 2,
    });

    await stage.execute(ctx);

    expect(ctx.consecutiveEmptyResponses).toBe(0);
  });

  it("should mark isFinal=true when no tool calls extracted", async () => {
    const mockStrategy = {
      name: "native" as const,
      prepareRequest: vi.fn(),
      extractToolCalls: vi.fn().mockReturnValue([]),
      formatToolResults: vi.fn(),
    } as unknown as ToolCallStrategy;

    const ctx = createMockContext({
      response: {
        content: "Done with the task.",
        toolCalls: [],
        usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
        finishReason: "stop",
      },
      strategy: mockStrategy,
    });

    await stage.execute(ctx);

    expect(ctx.events.emit).toHaveBeenCalledWith(
      "agent:assistant-message",
      expect.objectContaining({
        isFinal: true,
      }),
    );
  });
});
