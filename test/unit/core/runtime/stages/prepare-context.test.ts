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

vi.mock("../../../../../src/core/observation-masking.js", () => ({
  applyObservationMasking: vi.fn((messages: readonly ChatMessage[]) => [...messages]),
}));

vi.mock("../../../../../src/llm/dual-model-router.js", () => ({
  detectPhase: vi.fn().mockReturnValue("editor"),
}));

import { applyObservationMasking } from "../../../../../src/core/observation-masking.js";
import { detectPhase } from "../../../../../src/llm/dual-model-router.js";
import { createPrepareContextStage } from "../../../../../src/core/runtime/stages/prepare-context.js";

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

describe("createPrepareContextStage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should have name "prepare-context"', () => {
    const stage = createPrepareContextStage();
    expect(stage.name).toBe("prepare-context");
  });

  it("should apply observation masking and prepare context", async () => {
    const stage = createPrepareContextStage();
    const inputMessages: ChatMessage[] = [
      { role: "user", content: "hello" },
      { role: "assistant", content: "hi there" },
    ];
    const preparedMessages: ChatMessage[] = [{ role: "user", content: "hello (prepared)" }];

    const ctx = createMockContext({
      messages: inputMessages,
    });
    vi.mocked(ctx.contextManager.prepare).mockResolvedValue(preparedMessages);

    await stage.execute(ctx);

    expect(applyObservationMasking).toHaveBeenCalledWith(inputMessages, { keepRecentN: 5 });
    expect(ctx.contextManager.prepare).toHaveBeenCalled();
    expect(ctx.managedMessages).toEqual(preparedMessages);
  });

  it("should use dual-model router when available", async () => {
    const stage = createPrepareContextStage();
    const mockRouterClient = { chat: vi.fn() } as unknown as LLMProvider;
    const mockRouter = {
      setPhase: vi.fn(),
      getClientForPhase: vi.fn().mockReturnValue({
        client: mockRouterClient,
        model: "router-model",
      }),
    };

    const inputMessages: ChatMessage[] = [{ role: "user", content: "design a system" }];

    const ctx = createMockContext({
      messages: inputMessages,
      dualModelRouter: mockRouter as never,
    });

    vi.mocked(detectPhase).mockReturnValue("architect" as never);

    await stage.execute(ctx);

    expect(detectPhase).toHaveBeenCalledWith(inputMessages);
    expect(mockRouter.setPhase).toHaveBeenCalledWith("architect");
    expect(mockRouter.getClientForPhase).toHaveBeenCalledWith("architect");
    expect(ctx.activeClient).toBe(mockRouterClient);
    expect(ctx.activeModel).toBe("router-model");
  });

  it("should work without dual-model router", async () => {
    const stage = createPrepareContextStage();
    const ctx = createMockContext({
      messages: [{ role: "user", content: "hello" }],
    });

    await stage.execute(ctx);

    expect(detectPhase).not.toHaveBeenCalled();
    expect(ctx.activeClient).toBe(ctx.config.client);
    expect(ctx.activeModel).toBe(ctx.config.model);
    expect(ctx.contextManager.prepare).toHaveBeenCalled();
  });
});
