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

vi.mock("../../../../../src/tools/pipeline.js", () => ({
  ToolPipeline: vi.fn().mockImplementation(() => ({
    execute: vi.fn().mockResolvedValue({ results: [] }),
  })),
}));
vi.mock("../../../../../src/guardrails/index.js", () => ({
  applyOutputGuardrails: vi.fn().mockReturnValue({ modified: null }),
}));
vi.mock("../../../../../src/core/tool-call-utils.js", () => ({
  groupToolCalls: vi.fn((calls) => [calls]),
  FILE_WRITE_TOOLS: new Set(["file_write", "file_edit", "apply_patch"]),
  extractFilePath: vi.fn().mockReturnValue("/test/file.ts"),
}));
vi.mock("../../../../../src/llm/model-capabilities.js", () => ({
  getModelCapabilities: vi.fn().mockReturnValue({ capabilityTier: "high" }),
}));
vi.mock("../../../../../src/utils/platform.js", () => ({
  getPlatform: vi.fn().mockReturnValue("linux"),
}));

import { ToolPipeline } from "../../../../../src/tools/pipeline.js";
import { applyOutputGuardrails } from "../../../../../src/guardrails/index.js";
import { groupToolCalls } from "../../../../../src/core/tool-call-utils.js";
import { createExecuteToolsStage } from "../../../../../src/core/runtime/stages/execute-tools.js";

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

describe("createExecuteToolsStage", () => {
  let stage: ReturnType<typeof createExecuteToolsStage>;

  beforeEach(() => {
    vi.clearAllMocks();
    stage = createExecuteToolsStage();
  });

  it("should have the correct stage name", () => {
    expect(stage.name).toBe("execute-tools");
  });

  it("should return early when no extracted calls", async () => {
    const ctx = createMockContext({ extractedCalls: [] });
    await stage.execute(ctx);

    expect(ctx.events.emit).not.toHaveBeenCalled();
    expect(ToolPipeline).not.toHaveBeenCalled();
  });

  it("should execute tool calls through pipeline", async () => {
    const mockExecute = vi.fn().mockResolvedValue({
      results: [{ id: "call-1", name: "glob_search", output: "found files", isError: false }],
    });
    vi.mocked(ToolPipeline).mockImplementation(
      () =>
        ({
          execute: mockExecute,
        }) as never,
    );

    const ctx = createMockContext({
      extractedCalls: [{ id: "call-1", name: "glob_search", arguments: { pattern: "*.ts" } }],
    });

    await stage.execute(ctx);

    expect(ToolPipeline).toHaveBeenCalledWith(ctx.config.toolRegistry);
    expect(mockExecute).toHaveBeenCalledTimes(1);
    expect(ctx.toolResults).toHaveLength(1);
    expect(ctx.toolResults[0]).toMatchObject({
      id: "call-1",
      name: "glob_search",
      output: "found files",
    });
  });

  it("should emit tools-executing and tools-done events", async () => {
    vi.mocked(ToolPipeline).mockImplementation(
      () =>
        ({
          execute: vi.fn().mockResolvedValue({ results: [] }),
        }) as never,
    );

    const ctx = createMockContext({
      extractedCalls: [
        { id: "call-1", name: "file_read", arguments: { path: "/test/a.ts" } },
        { id: "call-2", name: "glob_search", arguments: { pattern: "*.ts" } },
      ],
    });

    await stage.execute(ctx);

    expect(ctx.events.emit).toHaveBeenCalledWith("agent:tools-executing", {
      toolNames: ["file_read", "glob_search"],
      count: 2,
    });
    expect(ctx.events.emit).toHaveBeenCalledWith("agent:tools-done", {
      count: expect.any(Number),
      nextAction: "llm-call",
    });
  });

  it("should include preflight results in final results", async () => {
    const preflightResult = {
      id: "denied-1",
      name: "file_write",
      output: "Permission denied",
      isError: true,
    };

    vi.mocked(ToolPipeline).mockImplementation(
      () =>
        ({
          execute: vi.fn().mockResolvedValue({
            results: [{ id: "call-1", name: "file_read", output: "content", isError: false }],
          }),
        }) as never,
    );

    const ctx = createMockContext({
      extractedCalls: [{ id: "call-1", name: "file_read", arguments: { path: "/test/a.ts" } }],
      toolResults: [preflightResult],
    });

    await stage.execute(ctx);

    // Preflight results should be preserved alongside pipeline results
    expect(ctx.toolResults.length).toBeGreaterThanOrEqual(2);
    expect(ctx.toolResults[0]).toEqual(preflightResult);
  });

  it("should apply output guardrails to results", async () => {
    vi.mocked(applyOutputGuardrails).mockReturnValue({
      modified: "sanitized output",
    } as never);

    vi.mocked(ToolPipeline).mockImplementation(
      () =>
        ({
          execute: vi.fn().mockResolvedValue({
            results: [
              { id: "call-1", name: "bash", output: "raw output with secrets", isError: false },
            ],
          }),
        }) as never,
    );

    const ctx = createMockContext({
      extractedCalls: [{ id: "call-1", name: "bash", arguments: { command: "echo test" } }],
    });

    await stage.execute(ctx);

    expect(applyOutputGuardrails).toHaveBeenCalledWith("raw output with secrets");
    expect(ctx.toolResults.some((r) => r.output === "sanitized output")).toBe(true);
  });

  it("should create checkpoint before file-modifying tools", async () => {
    const mockCreateCheckpoint = vi.fn().mockResolvedValue({
      id: "cp-1",
      description: "Before file_write: file.ts",
      files: [{ path: "/test/file.ts" }],
    });

    vi.mocked(ToolPipeline).mockImplementation(
      () =>
        ({
          execute: vi.fn().mockResolvedValue({ results: [] }),
        }) as never,
    );

    const ctx = createMockContext({
      extractedCalls: [
        { id: "call-1", name: "file_write", arguments: { path: "/test/file.ts", content: "x" } },
      ],
    });
    (ctx.config as Record<string, unknown>).checkpointManager = {
      createCheckpoint: mockCreateCheckpoint,
    };

    await stage.execute(ctx);

    expect(mockCreateCheckpoint).toHaveBeenCalledTimes(1);
    expect(ctx.events.emit).toHaveBeenCalledWith(
      "checkpoint:created",
      expect.objectContaining({
        checkpointId: "cp-1",
      }),
    );
  });

  it("should not create checkpoint for non-file-modifying tools", async () => {
    const mockCreateCheckpoint = vi.fn();

    vi.mocked(ToolPipeline).mockImplementation(
      () =>
        ({
          execute: vi.fn().mockResolvedValue({ results: [] }),
        }) as never,
    );

    const ctx = createMockContext({
      extractedCalls: [{ id: "call-1", name: "file_read", arguments: { path: "/test/a.ts" } }],
    });
    (ctx.config as Record<string, unknown>).checkpointManager = {
      createCheckpoint: mockCreateCheckpoint,
    };

    await stage.execute(ctx);

    expect(mockCreateCheckpoint).not.toHaveBeenCalled();
  });

  it("should skip output guardrails when enableGuardrails is false", async () => {
    vi.mocked(ToolPipeline).mockImplementation(
      () =>
        ({
          execute: vi.fn().mockResolvedValue({
            results: [{ id: "call-1", name: "bash", output: "raw output", isError: false }],
          }),
        }) as never,
    );

    const ctx = createMockContext({
      extractedCalls: [{ id: "call-1", name: "bash", arguments: { command: "echo test" } }],
    });
    (ctx.config as Record<string, unknown>).enableGuardrails = false;

    await stage.execute(ctx);

    expect(applyOutputGuardrails).not.toHaveBeenCalled();
    expect(ctx.toolResults.some((r) => r.output === "raw output")).toBe(true);
  });
});
