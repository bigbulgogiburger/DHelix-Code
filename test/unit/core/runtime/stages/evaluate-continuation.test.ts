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
  extractFilePath: vi.fn().mockReturnValue("/test/file.ts"),
  FILE_WRITE_TOOLS: new Set(["file_write", "file_edit", "apply_patch"]),
}));

import { createEvaluateContinuationStage } from "../../../../../src/core/runtime/stages/evaluate-continuation.js";

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
      getAll: vi.fn().mockReturnValue([{ name: "tool1" }, { name: "tool2" }]),
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
    isSubagent: false,
    checkPermission: undefined as unknown,
    checkpointManager: undefined as unknown,
    sessionId: "test-session",
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

describe("createEvaluateContinuationStage", () => {
  let stage: ReturnType<typeof createEvaluateContinuationStage>;

  beforeEach(() => {
    vi.clearAllMocks();
    stage = createEvaluateContinuationStage();
  });

  it("should have the correct stage name", () => {
    expect(stage.name).toBe("evaluate-continuation");
  });

  it("should return early when no response", async () => {
    const ctx = createMockContext({ response: undefined });
    await stage.execute(ctx);

    expect(ctx.shouldContinueLoop).toBe(false);
    expect(ctx.circuitBreaker.recordIteration).not.toHaveBeenCalled();
  });

  it("should complete normally when no tool calls and no results", async () => {
    const ctx = createMockContext({
      response: { content: "Here is the answer.", finishReason: "stop" } as never,
      extractedCalls: [],
      toolResults: [],
    });

    await stage.execute(ctx);

    expect(ctx.shouldContinueLoop).toBe(false);
  });

  it("should retry for subagent on iteration 1", async () => {
    const ctx = createMockContext({
      response: { content: "I will help you.", finishReason: "stop" } as never,
      extractedCalls: [],
      toolResults: [],
      iteration: 1,
    });
    (ctx.config as Record<string, unknown>).isSubagent = true;

    await stage.execute(ctx);

    expect(ctx.shouldContinueLoop).toBe(true);
    expect(
      ctx.messages.some(
        (m) => typeof m.content === "string" && m.content.includes("MUST use your available tools"),
      ),
    ).toBe(true);
  });

  it("should retry for subagent on iteration 2 with stronger nudge", async () => {
    const ctx = createMockContext({
      response: { content: "Let me think.", finishReason: "stop" } as never,
      extractedCalls: [],
      toolResults: [],
      iteration: 2,
    });
    (ctx.config as Record<string, unknown>).isSubagent = true;

    await stage.execute(ctx);

    expect(ctx.shouldContinueLoop).toBe(true);
    expect(
      ctx.messages.some((m) => typeof m.content === "string" && m.content.includes("CRITICAL")),
    ).toBe(true);
  });

  it("should not retry for subagent after iteration 2", async () => {
    const ctx = createMockContext({
      response: { content: "Done.", finishReason: "stop" } as never,
      extractedCalls: [],
      toolResults: [],
      iteration: 3,
    });
    (ctx.config as Record<string, unknown>).isSubagent = true;

    await stage.execute(ctx);

    // Normal completion — no subagent retry past iteration 2
    expect(ctx.shouldContinueLoop).toBe(false);
  });

  it("should retry on truncated response (finishReason=length)", async () => {
    const ctx = createMockContext({
      response: { content: "Partial response...", finishReason: "length" } as never,
      extractedCalls: [],
      toolResults: [],
    });

    await stage.execute(ctx);

    expect(ctx.shouldContinueLoop).toBe(true);
    expect(ctx.events.emit).toHaveBeenCalledWith(
      "llm:error",
      expect.objectContaining({
        error: expect.objectContaining({
          message: expect.stringContaining("truncated"),
        }),
      }),
    );
    expect(
      ctx.messages.some(
        (m) => typeof m.content === "string" && m.content.includes("cut off due to token limit"),
      ),
    ).toBe(true);
  });

  it("should retry on incomplete response up to 2 times", async () => {
    const ctx = createMockContext({
      response: { content: "Working on it...", finishReason: "incomplete" } as never,
      extractedCalls: [],
      toolResults: [],
      consecutiveIncompleteResponses: 0,
    });

    // First incomplete
    await stage.execute(ctx);
    expect(ctx.shouldContinueLoop).toBe(true);
    expect(ctx.consecutiveIncompleteResponses).toBe(1);

    // Reset for second call
    ctx.shouldContinueLoop = false;
    await stage.execute(ctx);
    expect(ctx.shouldContinueLoop).toBe(true);
    expect(ctx.consecutiveIncompleteResponses).toBe(2);

    // Third attempt — should NOT retry (exceeds MAX_INCOMPLETE_RETRIES=2)
    ctx.shouldContinueLoop = false;
    await stage.execute(ctx);
    expect(ctx.shouldContinueLoop).toBe(false);
  });

  it("should detect duplicate tool call loops (>=3 identical)", async () => {
    const extractedCalls = [{ id: "call-1", name: "file_read", arguments: { path: "/test/a.ts" } }];
    const signature = 'file_read:{"path":"/test/a.ts"}';

    const ctx = createMockContext({
      response: { content: "", finishReason: "stop" } as never,
      extractedCalls,
      toolResults: [{ id: "call-1", name: "file_read", output: "content", isError: false }],
      lastToolCallSignature: signature,
      duplicateToolCallCount: 2, // Already seen twice, this is the 3rd
    });

    await stage.execute(ctx);

    expect(ctx.duplicateToolCallCount).toBe(3);
    expect(ctx.events.emit).toHaveBeenCalledWith(
      "llm:error",
      expect.objectContaining({
        error: expect.objectContaining({
          message: expect.stringContaining("Duplicate tool call loop"),
        }),
      }),
    );
    expect(
      ctx.messages.some(
        (m) =>
          typeof m.content === "string" && m.content.includes("identical parameters repeatedly"),
      ),
    ).toBe(true);
  });

  it("should record circuit breaker iteration", async () => {
    const ctx = createMockContext({
      response: { content: "Working...", finishReason: "stop" } as never,
      extractedCalls: [{ id: "call-1", name: "file_read", arguments: { path: "/a.ts" } }],
      toolResults: [{ id: "call-1", name: "file_read", output: "content", isError: false }],
    });

    await stage.execute(ctx);

    expect(ctx.circuitBreaker.recordIteration).toHaveBeenCalledWith(
      expect.objectContaining({
        hasOutput: true,
      }),
    );
  });

  it("should set shouldContinueLoop=true when tool calls exist", async () => {
    const ctx = createMockContext({
      response: { content: "", finishReason: "stop" } as never,
      extractedCalls: [{ id: "call-1", name: "glob_search", arguments: { pattern: "*.ts" } }],
      toolResults: [{ id: "call-1", name: "glob_search", output: "files", isError: false }],
    });

    await stage.execute(ctx);

    expect(ctx.shouldContinueLoop).toBe(true);
  });

  it("should continue when all calls were denied (toolResults > 0 but extractedCalls = 0)", async () => {
    const ctx = createMockContext({
      response: { content: "", finishReason: "stop" } as never,
      extractedCalls: [],
      toolResults: [
        { id: "denied-1", name: "file_write", output: "Permission denied", isError: true },
      ],
    });

    await stage.execute(ctx);

    expect(ctx.shouldContinueLoop).toBe(true);
  });

  it("should reset duplicate count when signature changes", async () => {
    const ctx = createMockContext({
      response: { content: "", finishReason: "stop" } as never,
      extractedCalls: [{ id: "call-1", name: "file_read", arguments: { path: "/new-file.ts" } }],
      toolResults: [{ id: "call-1", name: "file_read", output: "content", isError: false }],
      lastToolCallSignature: 'file_read:{"path":"/old-file.ts"}',
      duplicateToolCallCount: 2,
    });

    await stage.execute(ctx);

    expect(ctx.duplicateToolCallCount).toBe(1);
    expect(ctx.shouldContinueLoop).toBe(true);
  });

  it("should reset consecutiveIncompleteResponses on non-incomplete finish", async () => {
    const ctx = createMockContext({
      response: { content: "Done.", finishReason: "stop" } as never,
      extractedCalls: [],
      toolResults: [],
      consecutiveIncompleteResponses: 2,
    });

    await stage.execute(ctx);

    expect(ctx.consecutiveIncompleteResponses).toBe(0);
  });

  it("should track file modifications in circuit breaker", async () => {
    const ctx = createMockContext({
      response: { content: "", finishReason: "stop" } as never,
      extractedCalls: [
        { id: "call-1", name: "file_write", arguments: { path: "/test/file.ts", content: "x" } },
      ],
      toolResults: [{ id: "call-1", name: "file_write", output: "written", isError: false }],
    });

    await stage.execute(ctx);

    expect(ctx.circuitBreaker.recordIteration).toHaveBeenCalledWith(
      expect.objectContaining({
        filesModified: expect.any(Set),
      }),
    );
    const callArgs = vi.mocked(ctx.circuitBreaker.recordIteration).mock.calls[0][0];
    expect((callArgs as Record<string, unknown>).filesModified).toBeInstanceOf(Set);
  });
});
