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

vi.mock("../../../../../src/llm/token-counter.js", () => ({
  countTokens: vi.fn().mockReturnValue(100),
}));
vi.mock("../../../../../src/core/tool-call-utils.js", () => ({
  extractFilePath: vi.fn().mockReturnValue("/test/file.ts"),
}));

import { countTokens } from "../../../../../src/llm/token-counter.js";
import { extractFilePath } from "../../../../../src/core/tool-call-utils.js";
import { createPersistResultsStage } from "../../../../../src/core/runtime/stages/persist-results.js";

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

describe("createPersistResultsStage", () => {
  let stage: ReturnType<typeof createPersistResultsStage>;

  beforeEach(() => {
    vi.clearAllMocks();
    stage = createPersistResultsStage();
  });

  it("should have the correct stage name", () => {
    expect(stage.name).toBe("persist-results");
  });

  it("should return early when no tool results", async () => {
    const ctx = createMockContext({ toolResults: [] });
    await stage.execute(ctx);

    expect(ctx.usageAggregator.recordToolCalls).not.toHaveBeenCalled();
    expect(ctx.strategy.formatToolResults).not.toHaveBeenCalled();
  });

  it("should record tool calls in usage aggregator", async () => {
    const ctx = createMockContext({
      extractedCalls: [
        { id: "call-1", name: "file_read", arguments: { path: "/a.ts" } },
        { id: "call-2", name: "glob_search", arguments: { pattern: "*.ts" } },
      ],
      toolResults: [
        { id: "call-1", name: "file_read", output: "content", isError: false },
        { id: "call-2", name: "glob_search", output: "files", isError: false },
      ],
    });

    await stage.execute(ctx);

    expect(ctx.usageAggregator.recordToolCalls).toHaveBeenCalledWith(2);
  });

  it("should track file accesses for file_read/file_edit/file_write", async () => {
    const ctx = createMockContext({
      extractedCalls: [
        { id: "call-1", name: "file_read", arguments: { path: "/test/a.ts" } },
        { id: "call-2", name: "file_edit", arguments: { path: "/test/b.ts" } },
        { id: "call-3", name: "file_write", arguments: { path: "/test/c.ts" } },
        { id: "call-4", name: "glob_search", arguments: { pattern: "*.ts" } },
      ],
      toolResults: [
        { id: "call-1", name: "file_read", output: "content", isError: false },
        { id: "call-2", name: "file_edit", output: "edited", isError: false },
        { id: "call-3", name: "file_write", output: "written", isError: false },
        { id: "call-4", name: "glob_search", output: "found", isError: false },
      ],
    });

    await stage.execute(ctx);

    // file_read, file_edit, file_write should trigger trackFileAccess (3 calls)
    // glob_search should not
    expect(ctx.contextManager.trackFileAccess).toHaveBeenCalledTimes(3);
    expect(ctx.contextManager.trackFileAccess).toHaveBeenCalledWith("/test/file.ts");
  });

  it("should truncate oversized results by char limit", async () => {
    const longOutput = "x".repeat(20000);

    const formatMock = vi.fn().mockReturnValue([{ role: "tool", content: "formatted" }]);

    const ctx = createMockContext({
      extractedCalls: [{ id: "call-1", name: "bash", arguments: { command: "cat big.txt" } }],
      toolResults: [{ id: "call-1", name: "bash", output: longOutput, isError: false }],
    });
    (ctx.strategy as Record<string, unknown>).formatToolResults = formatMock;

    await stage.execute(ctx);

    // formatToolResults should receive truncated results
    expect(formatMock).toHaveBeenCalledTimes(1);
    const passedResults = formatMock.mock.calls[0][0];
    // The output should be truncated to maxToolResultChars (12000) + truncation notice
    expect(passedResults[0].output.length).toBeLessThan(longOutput.length);
    expect(passedResults[0].output).toContain("truncated");
  });

  it("should format and append tool results to messages", async () => {
    const toolMessage: ChatMessage = { role: "tool" as const, content: "formatted result" };
    const formatMock = vi.fn().mockReturnValue([toolMessage]);

    const ctx = createMockContext({
      extractedCalls: [{ id: "call-1", name: "file_read", arguments: { path: "/a.ts" } }],
      toolResults: [{ id: "call-1", name: "file_read", output: "file content", isError: false }],
    });
    (ctx.strategy as Record<string, unknown>).formatToolResults = formatMock;

    await stage.execute(ctx);

    expect(formatMock).toHaveBeenCalledTimes(1);
    expect(ctx.messages).toContain(toolMessage);
  });

  it("should inject MCP failure recovery guidance", async () => {
    const formatMock = vi.fn().mockReturnValue([]);

    const ctx = createMockContext({
      extractedCalls: [{ id: "call-1", name: "mcp__server__tool", arguments: {} }],
      toolResults: [
        {
          id: "call-1",
          name: "mcp__server__tool",
          output: "Connection refused",
          isError: true,
        },
      ],
    });
    (ctx.strategy as Record<string, unknown>).formatToolResults = formatMock;

    await stage.execute(ctx);

    // Should inject a recovery guidance message
    const recoveryMsg = ctx.messages.find(
      (m) =>
        typeof m.content === "string" &&
        m.content.includes("[System]") &&
        m.content.includes("MCP tool(s) failed"),
    );
    expect(recoveryMsg).toBeDefined();
    expect(recoveryMsg!.role).toBe("user");
    expect(recoveryMsg!.content).toContain("mcp__server__tool");
    expect(recoveryMsg!.content).toContain("Acknowledge the failure");
  });

  it("should detect timeout and denial in MCP failures", async () => {
    const formatMock = vi.fn().mockReturnValue([]);

    const ctx = createMockContext({
      extractedCalls: [
        { id: "call-1", name: "mcp__a__tool1", arguments: {} },
        { id: "call-2", name: "mcp__b__tool2", arguments: {} },
      ],
      toolResults: [
        {
          id: "call-1",
          name: "mcp__a__tool1",
          output: "Request timed out",
          isError: true,
          metadata: { mcpErrorType: "timeout" },
        },
        {
          id: "call-2",
          name: "mcp__b__tool2",
          output: "Permission denied by user",
          isError: true,
        },
      ],
    });
    (ctx.strategy as Record<string, unknown>).formatToolResults = formatMock;

    await stage.execute(ctx);

    const recoveryMsg = ctx.messages.find(
      (m) => typeof m.content === "string" && m.content.includes("[System]"),
    );
    expect(recoveryMsg).toBeDefined();
    expect(recoveryMsg!.content).toContain("timed out");
    expect(recoveryMsg!.content).toContain("denied");
  });

  it("should not inject recovery guidance for non-MCP tool failures", async () => {
    const formatMock = vi.fn().mockReturnValue([]);

    const ctx = createMockContext({
      extractedCalls: [{ id: "call-1", name: "bash", arguments: { command: "false" } }],
      toolResults: [{ id: "call-1", name: "bash", output: "Command failed", isError: true }],
    });
    (ctx.strategy as Record<string, unknown>).formatToolResults = formatMock;

    await stage.execute(ctx);

    const recoveryMsg = ctx.messages.find(
      (m) => typeof m.content === "string" && m.content.includes("MCP tool(s) failed"),
    );
    expect(recoveryMsg).toBeUndefined();
  });
});
