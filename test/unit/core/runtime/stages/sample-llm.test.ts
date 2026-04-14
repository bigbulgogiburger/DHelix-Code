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
import { LLMError } from "../../../../../src/utils/error.js";

vi.mock("../../../../../src/llm/streaming.js", () => ({
  consumeStream: vi.fn(),
}));

vi.mock("../../../../../src/core/recovery-strategy.js", () => ({
  findRecoveryStrategy: vi.fn().mockReturnValue(null),
  getRecoveryExplanation: vi.fn().mockReturnValue(""),
}));

vi.mock("../../../../../src/core/recovery-executor.js", () => ({
  executeRecovery: vi.fn(),
}));

vi.mock("../../../../../src/core/error-classification.js", () => ({
  classifyLLMError: vi.fn().mockReturnValue("transient"),
  waitWithAbort: vi.fn().mockResolvedValue(undefined),
}));

import { consumeStream } from "../../../../../src/llm/streaming.js";
import { classifyLLMError } from "../../../../../src/core/error-classification.js";
import { createSampleLLMStage } from "../../../../../src/core/runtime/stages/sample-llm.js";

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

const MOCK_RESPONSE = {
  content: "Here is my response.",
  toolCalls: [],
  usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
  finishReason: "stop" as const,
};

describe("createSampleLLMStage", () => {
  let stage: ReturnType<typeof createSampleLLMStage>;

  beforeEach(() => {
    vi.clearAllMocks();
    stage = createSampleLLMStage();
  });

  it("should have name 'sample-llm'", () => {
    expect(stage.name).toBe("sample-llm");
  });

  it("should call chat in non-streaming mode and set response", async () => {
    const mockChat = vi.fn().mockResolvedValue(MOCK_RESPONSE);
    const mockClient = {
      chat: mockChat,
      stream: vi.fn(),
      countTokens: vi.fn(),
    } as unknown as LLMProvider;

    const ctx = createMockContext({
      activeClient: mockClient,
      config: {
        client: mockClient,
        model: "test-model",
        useStreaming: false,
        temperature: 0,
        maxTokens: 4096,
        events: { emit: vi.fn(), on: vi.fn(), off: vi.fn() } as unknown as AppEventEmitter,
        enableGuardrails: true,
        workingDirectory: "/test",
        toolRegistry: { getAll: vi.fn().mockReturnValue([]) } as unknown as ToolRegistry,
        strategy: {
          name: "native",
          prepareRequest: vi.fn(),
          extractToolCalls: vi.fn(),
          formatToolResults: vi.fn(),
        } as unknown as ToolCallStrategy,
      } as unknown as AgentLoopConfig,
    });

    await stage.execute(ctx);

    expect(mockChat).toHaveBeenCalledTimes(1);
    expect(ctx.response).toEqual(MOCK_RESPONSE);
  });

  it("should call stream in streaming mode", async () => {
    const mockStream = vi.fn().mockReturnValue({});
    const mockClient = {
      chat: vi.fn(),
      stream: mockStream,
      countTokens: vi.fn(),
    } as unknown as LLMProvider;

    const consumeStreamMock = vi.mocked(consumeStream);
    consumeStreamMock.mockResolvedValue({
      text: "Streamed response.",
      toolCalls: [],
      usage: { promptTokens: 50, completionTokens: 25, totalTokens: 75 },
      finishReason: "stop",
      partial: false,
    });

    const ctx = createMockContext({
      activeClient: mockClient,
      config: {
        client: mockClient,
        model: "test-model",
        useStreaming: true,
        temperature: 0,
        maxTokens: 4096,
        events: { emit: vi.fn(), on: vi.fn(), off: vi.fn() } as unknown as AppEventEmitter,
        enableGuardrails: true,
        workingDirectory: "/test",
        toolRegistry: { getAll: vi.fn().mockReturnValue([]) } as unknown as ToolRegistry,
        strategy: {
          name: "native",
          prepareRequest: vi.fn(),
          extractToolCalls: vi.fn(),
          formatToolResults: vi.fn(),
        } as unknown as ToolCallStrategy,
      } as unknown as AgentLoopConfig,
    });

    await stage.execute(ctx);

    expect(mockStream).toHaveBeenCalledTimes(1);
    expect(consumeStreamMock).toHaveBeenCalledTimes(1);
    expect(ctx.response).toBeDefined();
    expect(ctx.response?.content).toBe("Streamed response.");
  });

  it("should throw on overload errors", async () => {
    const overloadError = new Error("429 Too Many Requests");
    const mockClient = {
      chat: vi.fn().mockRejectedValue(overloadError),
      stream: vi.fn(),
      countTokens: vi.fn(),
    } as unknown as LLMProvider;

    vi.mocked(classifyLLMError).mockReturnValue("overload");

    const ctx = createMockContext({
      activeClient: mockClient,
      config: {
        client: mockClient,
        model: "test-model",
        useStreaming: false,
        events: { emit: vi.fn(), on: vi.fn(), off: vi.fn() } as unknown as AppEventEmitter,
        enableGuardrails: true,
        workingDirectory: "/test",
        toolRegistry: { getAll: vi.fn().mockReturnValue([]) } as unknown as ToolRegistry,
        strategy: {
          name: "native",
          prepareRequest: vi.fn(),
          extractToolCalls: vi.fn(),
          formatToolResults: vi.fn(),
        } as unknown as ToolCallStrategy,
      } as unknown as AgentLoopConfig,
    });

    await expect(stage.execute(ctx)).rejects.toThrow("429 Too Many Requests");
  });

  it("should throw on permanent errors", async () => {
    const permanentError = new Error("Invalid model");
    const mockClient = {
      chat: vi.fn().mockRejectedValue(permanentError),
      stream: vi.fn(),
      countTokens: vi.fn(),
    } as unknown as LLMProvider;

    vi.mocked(classifyLLMError).mockReturnValue("permanent");

    const ctx = createMockContext({
      activeClient: mockClient,
      config: {
        client: mockClient,
        model: "test-model",
        useStreaming: false,
        events: { emit: vi.fn(), on: vi.fn(), off: vi.fn() } as unknown as AppEventEmitter,
        enableGuardrails: true,
        workingDirectory: "/test",
        toolRegistry: { getAll: vi.fn().mockReturnValue([]) } as unknown as ToolRegistry,
        strategy: {
          name: "native",
          prepareRequest: vi.fn(),
          extractToolCalls: vi.fn(),
          formatToolResults: vi.fn(),
        } as unknown as ToolCallStrategy,
      } as unknown as AgentLoopConfig,
    });

    await expect(stage.execute(ctx)).rejects.toThrow("Invalid model");
  });

  it("should throw on auth errors", async () => {
    const authError = new Error("401 Unauthorized");
    const mockClient = {
      chat: vi.fn().mockRejectedValue(authError),
      stream: vi.fn(),
      countTokens: vi.fn(),
    } as unknown as LLMProvider;

    vi.mocked(classifyLLMError).mockReturnValue("auth");

    const ctx = createMockContext({
      activeClient: mockClient,
      config: {
        client: mockClient,
        model: "test-model",
        useStreaming: false,
        events: { emit: vi.fn(), on: vi.fn(), off: vi.fn() } as unknown as AppEventEmitter,
        enableGuardrails: true,
        workingDirectory: "/test",
        toolRegistry: { getAll: vi.fn().mockReturnValue([]) } as unknown as ToolRegistry,
        strategy: {
          name: "native",
          prepareRequest: vi.fn(),
          extractToolCalls: vi.fn(),
          formatToolResults: vi.fn(),
        } as unknown as ToolCallStrategy,
      } as unknown as AgentLoopConfig,
    });

    await expect(stage.execute(ctx)).rejects.toThrow("401 Unauthorized");
  });

  it("should retry on transient errors with backoff", async () => {
    const transientError = new Error("Connection timeout");
    const mockClient = {
      chat: vi.fn().mockRejectedValueOnce(transientError).mockResolvedValueOnce(MOCK_RESPONSE),
      stream: vi.fn(),
      countTokens: vi.fn(),
    } as unknown as LLMProvider;

    vi.mocked(classifyLLMError).mockReturnValue("transient");

    const ctx = createMockContext({
      activeClient: mockClient,
      maxRetries: 2,
      config: {
        client: mockClient,
        model: "test-model",
        useStreaming: false,
        temperature: 0,
        maxTokens: 4096,
        events: { emit: vi.fn(), on: vi.fn(), off: vi.fn() } as unknown as AppEventEmitter,
        enableGuardrails: true,
        workingDirectory: "/test",
        toolRegistry: { getAll: vi.fn().mockReturnValue([]) } as unknown as ToolRegistry,
        strategy: {
          name: "native",
          prepareRequest: vi.fn(),
          extractToolCalls: vi.fn(),
          formatToolResults: vi.fn(),
        } as unknown as ToolCallStrategy,
      } as unknown as AgentLoopConfig,
    });

    await stage.execute(ctx);

    expect(mockClient.chat).toHaveBeenCalledTimes(2);
    expect(ctx.usageAggregator.recordRetry).toHaveBeenCalledTimes(1);
    expect(ctx.response).toEqual(MOCK_RESPONSE);
  });

  it("should throw LLMError after all retries exhausted", async () => {
    const transientError = new Error("Connection timeout");
    const mockClient = {
      chat: vi.fn().mockRejectedValue(transientError),
      stream: vi.fn(),
      countTokens: vi.fn(),
    } as unknown as LLMProvider;

    vi.mocked(classifyLLMError).mockReturnValue("transient");

    const ctx = createMockContext({
      activeClient: mockClient,
      maxRetries: 1,
      config: {
        client: mockClient,
        model: "test-model",
        useStreaming: false,
        temperature: 0,
        maxTokens: 4096,
        events: { emit: vi.fn(), on: vi.fn(), off: vi.fn() } as unknown as AppEventEmitter,
        enableGuardrails: true,
        workingDirectory: "/test",
        toolRegistry: { getAll: vi.fn().mockReturnValue([]) } as unknown as ToolRegistry,
        strategy: {
          name: "native",
          prepareRequest: vi.fn(),
          extractToolCalls: vi.fn(),
          formatToolResults: vi.fn(),
        } as unknown as ToolCallStrategy,
      } as unknown as AgentLoopConfig,
    });

    await expect(stage.execute(ctx)).rejects.toThrow("LLM call failed after retries");
  });

  it("should record usage and emit events", async () => {
    const mockChat = vi.fn().mockResolvedValue(MOCK_RESPONSE);
    const mockClient = {
      chat: mockChat,
      stream: vi.fn(),
      countTokens: vi.fn(),
    } as unknown as LLMProvider;

    const ctx = createMockContext({
      activeClient: mockClient,
      config: {
        client: mockClient,
        model: "test-model",
        useStreaming: false,
        temperature: 0,
        maxTokens: 4096,
        events: { emit: vi.fn(), on: vi.fn(), off: vi.fn() } as unknown as AppEventEmitter,
        enableGuardrails: true,
        workingDirectory: "/test",
        toolRegistry: { getAll: vi.fn().mockReturnValue([]) } as unknown as ToolRegistry,
        strategy: {
          name: "native",
          prepareRequest: vi.fn(),
          extractToolCalls: vi.fn(),
          formatToolResults: vi.fn(),
        } as unknown as ToolCallStrategy,
      } as unknown as AgentLoopConfig,
    });

    await stage.execute(ctx);

    expect(ctx.usageAggregator.recordLLMUsage).toHaveBeenCalledWith(MOCK_RESPONSE.usage);
    expect(ctx.events.emit).toHaveBeenCalledWith("llm:start", { iteration: 1 });
    expect(ctx.events.emit).toHaveBeenCalledWith("llm:complete", { tokenCount: 150 });
    expect(ctx.events.emit).toHaveBeenCalledWith(
      "agent:usage-update",
      expect.objectContaining({ iteration: 1 }),
    );
  });

  it("should append assistant message to ctx.messages", async () => {
    const mockChat = vi.fn().mockResolvedValue(MOCK_RESPONSE);
    const mockClient = {
      chat: mockChat,
      stream: vi.fn(),
      countTokens: vi.fn(),
    } as unknown as LLMProvider;

    const ctx = createMockContext({
      activeClient: mockClient,
      config: {
        client: mockClient,
        model: "test-model",
        useStreaming: false,
        temperature: 0,
        maxTokens: 4096,
        events: { emit: vi.fn(), on: vi.fn(), off: vi.fn() } as unknown as AppEventEmitter,
        enableGuardrails: true,
        workingDirectory: "/test",
        toolRegistry: { getAll: vi.fn().mockReturnValue([]) } as unknown as ToolRegistry,
        strategy: {
          name: "native",
          prepareRequest: vi.fn(),
          extractToolCalls: vi.fn(),
          formatToolResults: vi.fn(),
        } as unknown as ToolCallStrategy,
      } as unknown as AgentLoopConfig,
    });

    await stage.execute(ctx);

    expect(ctx.messages).toHaveLength(1);
    expect(ctx.messages[0]).toEqual({
      role: "assistant",
      content: "Here is my response.",
      toolCalls: undefined,
    });
  });
});
