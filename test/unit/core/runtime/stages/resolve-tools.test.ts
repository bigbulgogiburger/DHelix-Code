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

import { createResolveToolsStage } from "../../../../../src/core/runtime/stages/resolve-tools.js";

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

describe("createResolveToolsStage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should have name "resolve-tools"', () => {
    const stage = createResolveToolsStage();
    expect(stage.name).toBe("resolve-tools");
  });

  it("should use all definitions in normal mode", async () => {
    const stage = createResolveToolsStage();
    const allDefs = [
      { name: "read_file", description: "Read a file", parameters: {} },
      { name: "write_file", description: "Write a file", parameters: {} },
    ];
    const preparedResult = {
      messages: [{ role: "user", content: "hello" }],
      tools: [{ type: "function", function: { name: "read_file" } }],
    };

    const ctx = createMockContext({
      managedMessages: [{ role: "user", content: "hello" }],
    });

    vi.mocked(ctx.toolRegistry.getDefinitionsForLLM).mockReturnValue(allDefs as never);
    vi.mocked(ctx.strategy.prepareRequest).mockReturnValue(preparedResult as never);

    await stage.execute(ctx);

    expect(ctx.toolRegistry.getDefinitionsForLLM).toHaveBeenCalled();
    expect(ctx.toolRegistry.getHotDefinitionsForLLM).not.toHaveBeenCalled();
    expect(ctx.toolDefs).toEqual(allDefs);
    expect(ctx.strategy.prepareRequest).toHaveBeenCalledWith(ctx.managedMessages, allDefs);
    expect(ctx.preparedMessages).toEqual(preparedResult.messages);
    expect(ctx.preparedTools).toEqual(preparedResult.tools);
  });

  it("should use hot + deferred definitions in deferred mode", async () => {
    const stage = createResolveToolsStage();
    const hotDefs = [{ name: "read_file", description: "Read a file", parameters: {} }];

    const ctx = createMockContext({
      managedMessages: [{ role: "user", content: "hello" }],
    });

    // Enable deferred mode
    (ctx.toolRegistry as { isDeferredMode: boolean }).isDeferredMode = true;
    vi.mocked(ctx.toolRegistry.getHotDefinitionsForLLM).mockReturnValue(hotDefs as never);

    await stage.execute(ctx);

    expect(ctx.toolRegistry.getHotDefinitionsForLLM).toHaveBeenCalled();
    expect(ctx.toolRegistry.getDefinitionsForLLM).not.toHaveBeenCalled();
    expect(ctx.toolDefs).toEqual(hotDefs);
  });

  it("should resolve MCP tools from message history in deferred mode", async () => {
    const stage = createResolveToolsStage();
    const hotDefs = [{ name: "read_file", description: "Read a file", parameters: {} }];
    const resolvedMcpDef = {
      name: "mcp__server__tool",
      description: "An MCP tool",
      parameters: {},
    };

    const messagesWithMcpTools: ChatMessage[] = [
      { role: "user", content: "use the mcp tool" },
      {
        role: "assistant",
        content: "Using MCP tool",
        toolCalls: [{ id: "tc1", name: "mcp__server__tool", arguments: "{}" }],
      },
      { role: "user", content: "thanks" },
    ];

    const ctx = createMockContext({
      managedMessages: messagesWithMcpTools,
    });

    (ctx.toolRegistry as { isDeferredMode: boolean }).isDeferredMode = true;
    vi.mocked(ctx.toolRegistry.getHotDefinitionsForLLM).mockReturnValue(hotDefs as never);
    vi.mocked(ctx.toolRegistry.resolveDeferredTool).mockReturnValue(resolvedMcpDef as never);

    await stage.execute(ctx);

    expect(ctx.toolRegistry.resolveDeferredTool).toHaveBeenCalledWith("mcp__server__tool");
    expect(ctx.toolDefs).toEqual([...hotDefs, resolvedMcpDef]);
  });

  it("should call strategy.prepareRequest and set ctx fields", async () => {
    const stage = createResolveToolsStage();
    const managedMessages: ChatMessage[] = [{ role: "user", content: "hello" }];
    const preparedMessages = [
      { role: "system", content: "system prompt" },
      { role: "user", content: "hello" },
    ];
    const preparedTools = [{ type: "function", function: { name: "read_file" } }];

    const ctx = createMockContext({ managedMessages });

    vi.mocked(ctx.toolRegistry.getDefinitionsForLLM).mockReturnValue([] as never);
    vi.mocked(ctx.strategy.prepareRequest).mockReturnValue({
      messages: preparedMessages,
      tools: preparedTools,
    } as never);

    await stage.execute(ctx);

    expect(ctx.strategy.prepareRequest).toHaveBeenCalledWith(managedMessages, []);
    expect(ctx.preparedMessages).toEqual(preparedMessages);
    expect(ctx.preparedTools).toEqual(preparedTools);
  });
});
