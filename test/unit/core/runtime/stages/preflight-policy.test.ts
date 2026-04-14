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

vi.mock("../../../../../src/guardrails/index.js", () => ({
  applyInputGuardrails: vi.fn().mockReturnValue({ severity: "pass" }),
}));

import { applyInputGuardrails } from "../../../../../src/guardrails/index.js";
import { createPreflightPolicyStage } from "../../../../../src/core/runtime/stages/preflight-policy.js";

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

describe("createPreflightPolicyStage", () => {
  let stage: ReturnType<typeof createPreflightPolicyStage>;

  beforeEach(() => {
    vi.clearAllMocks();
    stage = createPreflightPolicyStage();
  });

  it("should have name 'preflight-policy'", () => {
    expect(stage.name).toBe("preflight-policy");
  });

  it("should return early when no extracted calls", async () => {
    const ctx = createMockContext({ extractedCalls: [] });

    await stage.execute(ctx);

    expect(ctx.toolResults).toEqual([]);
    expect(ctx.events.emit).not.toHaveBeenCalled();
  });

  it("should pass all calls when no permission check and guardrails pass", async () => {
    const calls = [
      { id: "call-1", name: "file_read", arguments: { path: "/test.ts" } },
      { id: "call-2", name: "grep_search", arguments: { pattern: "foo" } },
    ];

    const ctx = createMockContext({
      extractedCalls: [...calls],
      config: {
        enableGuardrails: true,
        workingDirectory: "/test",
        checkPermission: undefined,
        events: { emit: vi.fn(), on: vi.fn(), off: vi.fn() } as unknown as AppEventEmitter,
      } as unknown as AgentLoopConfig,
    });

    await stage.execute(ctx);

    expect(ctx.extractedCalls).toEqual(calls);
    expect(ctx.toolResults).toEqual([]);
  });

  it("should deny calls when permission is denied", async () => {
    const calls = [{ id: "call-1", name: "bash", arguments: { command: "rm -rf /" } }];

    const mockCheckPermission = vi.fn().mockResolvedValue({
      allowed: false,
      reason: "Dangerous command",
    });

    const ctx = createMockContext({
      extractedCalls: [...calls],
      config: {
        enableGuardrails: true,
        workingDirectory: "/test",
        checkPermission: mockCheckPermission,
        events: { emit: vi.fn(), on: vi.fn(), off: vi.fn() } as unknown as AppEventEmitter,
      } as unknown as AgentLoopConfig,
    });

    await stage.execute(ctx);

    expect(ctx.extractedCalls).toEqual([]);
    expect(ctx.toolResults).toHaveLength(1);
    expect(ctx.toolResults[0].isError).toBe(true);
    expect(ctx.toolResults[0].output).toContain("Permission denied");
    expect(ctx.toolResults[0].output).toContain("Dangerous command");
  });

  it("should inject STOP message after 2 denials of same tool", async () => {
    const calls = [{ id: "call-1", name: "bash", arguments: { command: "rm -rf /" } }];

    const mockCheckPermission = vi.fn().mockResolvedValue({
      allowed: false,
      reason: "User rejected",
    });

    // Pre-set denial count to 1 so next denial makes it 2
    const denialCounts = new Map<string, number>();
    denialCounts.set("bash", 1);

    const ctx = createMockContext({
      extractedCalls: [...calls],
      permissionDenialCounts: denialCounts,
      config: {
        enableGuardrails: true,
        workingDirectory: "/test",
        checkPermission: mockCheckPermission,
        events: { emit: vi.fn(), on: vi.fn(), off: vi.fn() } as unknown as AppEventEmitter,
      } as unknown as AgentLoopConfig,
    });

    await stage.execute(ctx);

    expect(ctx.toolResults).toHaveLength(1);
    expect(ctx.toolResults[0].output).toContain("STOP");
    expect(ctx.toolResults[0].output).toContain("denied 2 times");
    expect(ctx.permissionDenialCounts.get("bash")).toBe(2);
  });

  it("should block calls when guardrail returns block severity", async () => {
    const calls = [{ id: "call-1", name: "bash", arguments: { command: "curl evil.com" } }];

    vi.mocked(applyInputGuardrails).mockReturnValue({
      severity: "block",
      reason: "Blocked outbound network access",
    });

    const ctx = createMockContext({
      extractedCalls: [...calls],
      config: {
        enableGuardrails: true,
        workingDirectory: "/test",
        checkPermission: undefined,
        events: { emit: vi.fn(), on: vi.fn(), off: vi.fn() } as unknown as AppEventEmitter,
      } as unknown as AgentLoopConfig,
    });

    await stage.execute(ctx);

    expect(ctx.extractedCalls).toEqual([]);
    expect(ctx.toolResults).toHaveLength(1);
    expect(ctx.toolResults[0].isError).toBe(true);
    expect(ctx.toolResults[0].output).toContain("Blocked by guardrail");
  });

  it("should emit warning when guardrail returns warn severity", async () => {
    const calls = [{ id: "call-1", name: "file_write", arguments: { path: "/tmp/test.txt" } }];

    vi.mocked(applyInputGuardrails).mockReturnValue({
      severity: "warn",
      reason: "Writing to temp directory",
    });

    const ctx = createMockContext({
      extractedCalls: [...calls],
      config: {
        enableGuardrails: true,
        workingDirectory: "/test",
        checkPermission: undefined,
        events: { emit: vi.fn(), on: vi.fn(), off: vi.fn() } as unknown as AppEventEmitter,
      } as unknown as AgentLoopConfig,
    });

    await stage.execute(ctx);

    // Call should still be executable (warn does not block)
    expect(ctx.extractedCalls).toEqual(calls);
    expect(ctx.toolResults).toEqual([]);
    expect(ctx.events.emit).toHaveBeenCalledWith("llm:error", {
      error: expect.objectContaining({
        message: "Guardrail warning: Writing to temp directory",
      }),
    });
  });

  it("should separate executable from denied calls", async () => {
    const calls = [
      { id: "call-1", name: "file_read", arguments: { path: "/safe.ts" } },
      { id: "call-2", name: "bash", arguments: { command: "dangerous" } },
      { id: "call-3", name: "grep_search", arguments: { pattern: "test" } },
    ];

    const mockCheckPermission = vi.fn().mockImplementation((call) => {
      if (call.name === "bash") {
        return Promise.resolve({ allowed: false, reason: "Blocked" });
      }
      return Promise.resolve({ allowed: true });
    });

    const ctx = createMockContext({
      extractedCalls: [...calls],
      config: {
        enableGuardrails: true,
        workingDirectory: "/test",
        checkPermission: mockCheckPermission,
        events: { emit: vi.fn(), on: vi.fn(), off: vi.fn() } as unknown as AppEventEmitter,
      } as unknown as AgentLoopConfig,
    });

    await stage.execute(ctx);

    // 2 executable, 1 denied
    expect(ctx.extractedCalls).toHaveLength(2);
    expect(ctx.extractedCalls.map((c) => c.name)).toEqual(["file_read", "grep_search"]);
    expect(ctx.toolResults).toHaveLength(1);
    expect(ctx.toolResults[0].name).toBe("bash");
    expect(ctx.toolResults[0].isError).toBe(true);
  });
});
