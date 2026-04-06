import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  RuntimePipeline,
  createPipeline,
  type PipelineOptions,
} from "../../../../src/core/runtime/pipeline.js";
import {
  type RuntimeContext,
  type StageName,
  type PipelineHooks,
  type UsageAggregatorInterface,
} from "../../../../src/core/runtime/types.js";
import { type ChatMessage, type LLMProvider } from "../../../../src/llm/provider.js";
import { type ToolCallStrategy } from "../../../../src/llm/tool-call-strategy.js";
import { type ToolRegistry } from "../../../../src/tools/registry.js";
import { type AppEventEmitter } from "../../../../src/utils/events.js";
import { type AgentLoopConfig } from "../../../../src/core/agent-loop.js";
import { type ContextManager } from "../../../../src/core/context-manager.js";
import { type CircuitBreaker } from "../../../../src/core/circuit-breaker.js";

// Mock all stage modules
vi.mock("../../../../src/core/runtime/stages/prepare-context.js", () => ({
  createPrepareContextStage: () => ({
    name: "prepare-context",
    execute: vi.fn().mockResolvedValue(undefined),
  }),
}));
vi.mock("../../../../src/core/runtime/stages/compact-context.js", () => ({
  createCompactContextStage: () => ({
    name: "compact-context",
    execute: vi.fn().mockResolvedValue(undefined),
  }),
}));
vi.mock("../../../../src/core/runtime/stages/resolve-tools.js", () => ({
  createResolveToolsStage: () => ({
    name: "resolve-tools",
    execute: vi.fn().mockResolvedValue(undefined),
  }),
}));
vi.mock("../../../../src/core/runtime/stages/sample-llm.js", () => ({
  createSampleLLMStage: () => ({
    name: "sample-llm",
    execute: vi.fn().mockResolvedValue(undefined),
  }),
}));
vi.mock("../../../../src/core/runtime/stages/extract-calls.js", () => ({
  createExtractCallsStage: () => ({
    name: "extract-calls",
    execute: vi.fn().mockResolvedValue(undefined),
  }),
}));
vi.mock("../../../../src/core/runtime/stages/preflight-policy.js", () => ({
  createPreflightPolicyStage: () => ({
    name: "preflight-policy",
    execute: vi.fn().mockResolvedValue(undefined),
  }),
}));
vi.mock("../../../../src/core/runtime/stages/execute-tools.js", () => ({
  createExecuteToolsStage: () => ({
    name: "execute-tools",
    execute: vi.fn().mockResolvedValue(undefined),
  }),
}));
vi.mock("../../../../src/core/runtime/stages/persist-results.js", () => ({
  createPersistResultsStage: () => ({
    name: "persist-results",
    execute: vi.fn().mockResolvedValue(undefined),
  }),
}));
vi.mock("../../../../src/core/runtime/stages/evaluate-continuation.js", () => ({
  createEvaluateContinuationStage: () => ({
    name: "evaluate-continuation",
    execute: vi.fn().mockResolvedValue(undefined),
  }),
}));

/**
 * Create a minimal mock RuntimeContext for testing.
 */
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
    trackFileAccess: vi.fn(),
  } as unknown as ContextManager;

  const mockConfig = {
    client: {} as LLMProvider,
    model: "test-model",
    toolRegistry: {
      isDeferredMode: false,
      getAll: vi.fn().mockReturnValue([]),
      getDefinitionsForLLM: vi.fn().mockReturnValue([]),
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

describe("RuntimePipeline", () => {
  let pipeline: RuntimePipeline;

  beforeEach(() => {
    pipeline = createPipeline({});
  });

  it("should create pipeline with all 9 stages", () => {
    const stageNames = pipeline.getStageNames();
    expect(stageNames).toEqual([
      "prepare-context",
      "compact-context",
      "resolve-tools",
      "sample-llm",
      "extract-calls",
      "preflight-policy",
      "execute-tools",
      "persist-results",
      "evaluate-continuation",
    ]);
  });

  it("should return all 9 stages via getStage", () => {
    const expectedStages: StageName[] = [
      "prepare-context",
      "compact-context",
      "resolve-tools",
      "sample-llm",
      "extract-calls",
      "preflight-policy",
      "execute-tools",
      "persist-results",
      "evaluate-continuation",
    ];
    for (const name of expectedStages) {
      expect(pipeline.getStage(name)).toBeDefined();
      expect(pipeline.getStage(name)?.name).toBe(name);
    }
  });

  it("should return 'complete' when no tool calls and shouldContinueLoop is false", async () => {
    const ctx = createMockContext();
    const outcome = await pipeline.executeIteration(ctx);
    expect(outcome.action).toBe("complete");
  });

  it("should return 'abort' when signal is aborted", async () => {
    const abortController = new AbortController();
    abortController.abort();
    const ctx = createMockContext({ signal: abortController.signal });
    const outcome = await pipeline.executeIteration(ctx);
    expect(outcome.action).toBe("abort");
  });

  it("should return 'continue' when shouldContinueLoop is set by a stage", async () => {
    // Override extract-calls to set shouldContinueLoop
    const extractStage = pipeline.getStage("extract-calls");
    if (extractStage) {
      (extractStage as { execute: ReturnType<typeof vi.fn> }).execute = vi
        .fn()
        .mockImplementation(async (ctx: RuntimeContext) => {
          ctx.shouldContinueLoop = true;
          ctx.transitionReason = "tool-results";
        });
    }

    const ctx = createMockContext();
    const outcome = await pipeline.executeIteration(ctx);
    expect(outcome.action).toBe("continue");
  });

  it("should return 'error' when a stage throws", async () => {
    const testError = new Error("Test stage error");
    const prepareStage = pipeline.getStage("prepare-context");
    if (prepareStage) {
      (prepareStage as { execute: ReturnType<typeof vi.fn> }).execute = vi
        .fn()
        .mockRejectedValue(testError);
    }

    const ctx = createMockContext();
    const outcome = await pipeline.executeIteration(ctx);
    expect(outcome.action).toBe("error");
    if (outcome.action === "error") {
      expect(outcome.error).toBe(testError);
    }
  });

  it("should measure timing for each executed stage", async () => {
    const ctx = createMockContext();
    await pipeline.executeIteration(ctx);

    // All 9 stages should have timings recorded
    expect(ctx.timings.size).toBe(9);
    for (const [, elapsed] of ctx.timings) {
      expect(elapsed).toBeGreaterThanOrEqual(0);
    }
  });

  it("should reset per-iteration state at the start of each iteration", async () => {
    const ctx = createMockContext({
      response: { content: "old", toolCalls: [], usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 }, finishReason: "stop" },
      extractedCalls: [{ id: "old", name: "old_tool", arguments: {} }],
      toolResults: [{ id: "old", name: "old_tool", output: "old", isError: false }],
      shouldContinueLoop: true,
    });

    await pipeline.executeIteration(ctx);

    // These should be reset at start of iteration
    expect(ctx.shouldContinueLoop).toBe(false);
  });

  describe("hooks", () => {
    it("should call onIterationStart hook", async () => {
      const onIterationStart = vi.fn().mockResolvedValue(undefined);
      const hookedPipeline = createPipeline({
        hooks: { onIterationStart },
      });

      const ctx = createMockContext();
      await hookedPipeline.executeIteration(ctx);

      expect(onIterationStart).toHaveBeenCalledOnce();
      expect(onIterationStart).toHaveBeenCalledWith(ctx);
    });

    it("should call onIterationEnd hook with outcome", async () => {
      const onIterationEnd = vi.fn().mockResolvedValue(undefined);
      const hookedPipeline = createPipeline({
        hooks: { onIterationEnd },
      });

      const ctx = createMockContext();
      await hookedPipeline.executeIteration(ctx);

      expect(onIterationEnd).toHaveBeenCalledOnce();
      expect(onIterationEnd).toHaveBeenCalledWith(
        expect.objectContaining({ action: "complete" }),
        ctx,
      );
    });

    it("should call onBeforeStage and onAfterStage for each stage", async () => {
      const onBeforeStage = vi.fn().mockResolvedValue(undefined);
      const onAfterStage = vi.fn().mockResolvedValue(undefined);
      const hookedPipeline = createPipeline({
        hooks: { onBeforeStage, onAfterStage },
      });

      const ctx = createMockContext();
      await hookedPipeline.executeIteration(ctx);

      // 9 stages = 9 before + 9 after calls
      expect(onBeforeStage).toHaveBeenCalledTimes(9);
      expect(onAfterStage).toHaveBeenCalledTimes(9);

      // First call should be prepare-context
      expect(onBeforeStage.mock.calls[0][0]).toBe("prepare-context");
      // Last call should be evaluate-continuation
      expect(onAfterStage.mock.calls[8][0]).toBe("evaluate-continuation");
    });

    it("should call onIterationEnd with error outcome when stage throws", async () => {
      const onIterationEnd = vi.fn().mockResolvedValue(undefined);
      const hookedPipeline = createPipeline({
        hooks: { onIterationEnd },
      });

      const stage = hookedPipeline.getStage("sample-llm");
      if (stage) {
        (stage as { execute: ReturnType<typeof vi.fn> }).execute = vi
          .fn()
          .mockRejectedValue(new Error("LLM failed"));
      }

      const ctx = createMockContext();
      await hookedPipeline.executeIteration(ctx);

      expect(onIterationEnd).toHaveBeenCalledWith(
        expect.objectContaining({ action: "error" }),
        ctx,
      );
    });
  });

  describe("stage execution order", () => {
    it("should execute stages in the correct order", async () => {
      const executionOrder: StageName[] = [];
      const pipelineWithTracking = createPipeline({});

      // Override each stage's execute to record order
      const stageNames: StageName[] = [
        "prepare-context",
        "compact-context",
        "resolve-tools",
        "sample-llm",
        "extract-calls",
        "preflight-policy",
        "execute-tools",
        "persist-results",
        "evaluate-continuation",
      ];

      for (const name of stageNames) {
        const stage = pipelineWithTracking.getStage(name);
        if (stage) {
          (stage as { execute: ReturnType<typeof vi.fn> }).execute = vi
            .fn()
            .mockImplementation(async () => {
              executionOrder.push(name);
            });
        }
      }

      const ctx = createMockContext();
      await pipelineWithTracking.executeIteration(ctx);

      expect(executionOrder).toEqual(stageNames);
    });

    it("should stop executing stages after shouldContinueLoop is set", async () => {
      const executionOrder: StageName[] = [];
      const pipelineWithTracking = createPipeline({});

      const stageNames: StageName[] = [
        "prepare-context",
        "compact-context",
        "resolve-tools",
        "sample-llm",
        "extract-calls",
        "preflight-policy",
        "execute-tools",
        "persist-results",
        "evaluate-continuation",
      ];

      for (const name of stageNames) {
        const stage = pipelineWithTracking.getStage(name);
        if (stage) {
          (stage as { execute: ReturnType<typeof vi.fn> }).execute = vi
            .fn()
            .mockImplementation(async (ctx: RuntimeContext) => {
              executionOrder.push(name);
              if (name === "extract-calls") {
                ctx.shouldContinueLoop = true;
              }
            });
        }
      }

      const ctx = createMockContext();
      await pipelineWithTracking.executeIteration(ctx);

      // Should execute up to and including extract-calls, then stop
      expect(executionOrder).toEqual([
        "prepare-context",
        "compact-context",
        "resolve-tools",
        "sample-llm",
        "extract-calls",
      ]);
    });

    it("should stop executing stages after abort signal", async () => {
      const executionOrder: StageName[] = [];
      const abortController = new AbortController();
      const pipelineWithTracking = createPipeline({});

      const stageNames: StageName[] = [
        "prepare-context",
        "compact-context",
        "resolve-tools",
        "sample-llm",
        "extract-calls",
        "preflight-policy",
        "execute-tools",
        "persist-results",
        "evaluate-continuation",
      ];

      for (const name of stageNames) {
        const stage = pipelineWithTracking.getStage(name);
        if (stage) {
          (stage as { execute: ReturnType<typeof vi.fn> }).execute = vi
            .fn()
            .mockImplementation(async () => {
              executionOrder.push(name);
              if (name === "resolve-tools") {
                abortController.abort();
              }
            });
        }
      }

      const ctx = createMockContext({ signal: abortController.signal });
      const outcome = await pipelineWithTracking.executeIteration(ctx);

      expect(outcome.action).toBe("abort");
      // Should execute up to resolve-tools, then abort before sample-llm
      expect(executionOrder).toEqual([
        "prepare-context",
        "compact-context",
        "resolve-tools",
      ]);
    });
  });
});

describe("createPipeline", () => {
  it("should return a RuntimePipeline instance", () => {
    const pipeline = createPipeline({});
    expect(pipeline).toBeInstanceOf(RuntimePipeline);
  });

  it("should accept hooks option", () => {
    const hooks: PipelineHooks = {
      onBeforeStage: vi.fn(),
      onAfterStage: vi.fn(),
    };
    const pipeline = createPipeline({ hooks });
    expect(pipeline).toBeInstanceOf(RuntimePipeline);
  });
});
