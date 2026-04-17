/**
 * Regression tests for useAgentLoop — Issue #3: modelOverride handling
 *
 * When a skill command returns `shouldInjectAsUserMessage: true` with a
 * `modelOverride`, the hook must:
 *   1. Switch `activeModel` to the overridden model BEFORE calling processMessage.
 *   2. Update `clientRef.current` to a client resolved for the new model family
 *      (use `newProvider` when supplied, otherwise resolve from model name).
 *   3. NOT change the model when a regular command returns no `modelOverride`.
 *
 * Approach: same minimal React mock as useAgentLoop.skill-fork.test.ts.
 * handleSubmit("/skill") is driven through a mocked CommandRegistry that returns
 * a pre-baked CommandResult. processMessage is observed indirectly by mocking
 * runAgentLoop and asserting the model in use when it is called.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ---------------------------------------------------------------------------
// Minimal React mock
// ---------------------------------------------------------------------------
let stateStore: Map<number, unknown>;
let stateIndex: number;
let effectCleanups: Array<() => void>;
let effects: Array<() => (() => void) | void>;

function resetState() {
  stateStore = new Map();
  stateIndex = 0;
  effectCleanups = [];
  effects = [];
}
function runEffects() {
  for (const fn of effects) {
    const cleanup = fn();
    if (typeof cleanup === "function") effectCleanups.push(cleanup);
  }
  effects = [];
}
function runCleanups() {
  for (const cleanup of effectCleanups) cleanup();
  effectCleanups = [];
}

vi.mock("react", () => {
  return {
    useState: (initial: unknown) => {
      const idx = stateIndex++;
      if (!stateStore.has(idx)) {
        const seed = typeof initial === "function" ? (initial as () => unknown)() : initial;
        stateStore.set(idx, seed);
      }
      const setState = (val: unknown) => {
        const current = stateStore.get(idx);
        const next = typeof val === "function" ? (val as (prev: unknown) => unknown)(current) : val;
        stateStore.set(idx, next);
      };
      return [stateStore.get(idx), setState];
    },
    useCallback: (fn: unknown) => fn,
    useMemo: (factory: () => unknown) => {
      const idx = stateIndex++;
      if (!stateStore.has(idx)) stateStore.set(idx, factory());
      return stateStore.get(idx);
    },
    useRef: (initial: unknown) => {
      const idx = stateIndex++;
      if (!stateStore.has(idx)) stateStore.set(idx, { current: initial });
      return stateStore.get(idx);
    },
    useEffect: (fn: () => (() => void) | void) => {
      effects.push(fn);
    },
  };
});

// ---------------------------------------------------------------------------
// Hoisted mocks
// ---------------------------------------------------------------------------
const hoisted = vi.hoisted(() => {
  return {
    spawnSubagentMock: vi.fn(async () => ({
      agentId: "agent-1",
      type: "general" as const,
      response: "",
      iterations: 0,
      aborted: false,
      messages: [],
    })),
    runAgentLoopMock: vi.fn(async () => ({ messages: [], iterations: 0, aborted: false })),
    createLLMClientForModelMock: vi.fn(() => ({ name: "client-from-newProvider" })),
    resolveProviderMock: vi.fn(() => ({ name: "client-from-resolveProvider" })),
  };
});

vi.mock("../../../../src/subagents/spawner.js", () => ({
  spawnSubagent: hoisted.spawnSubagentMock,
}));

vi.mock("../../../../src/llm/client-factory.js", () => ({
  createLLMClientForModel: hoisted.createLLMClientForModelMock,
}));

vi.mock("../../../../src/llm/model-router.js", () => ({
  resolveProvider: hoisted.resolveProviderMock,
}));

vi.mock("../../../../src/core/agent-loop.js", () => ({
  runAgentLoop: hoisted.runAgentLoopMock,
}));

vi.mock("../../../../src/core/checkpoint-manager.js", () => ({
  CheckpointManager: class {
    constructor() {}
  },
}));

vi.mock("../../../../src/core/system-prompt-builder.js", () => ({
  buildSystemPrompt: vi.fn(() => "system prompt"),
}));

vi.mock("../../../../src/hooks/event-emitter-adapter.js", () => ({
  createHookAdapter: vi.fn(() => ({ attach: vi.fn(), detach: vi.fn() })),
}));

vi.mock("../../../../src/instructions/loader.js", () => ({
  loadInstructions: vi.fn(async () => ({ combined: undefined })),
}));

vi.mock("../../../../src/memory/manager.js", () => ({
  MemoryManager: class {
    async loadMemory() {
      return { content: undefined };
    }
  },
}));

vi.mock("../../../../src/telemetry/metrics.js", () => ({
  metrics: { increment: vi.fn() },
  COUNTERS: { tokensUsed: "tokensUsed", tokenCost: "tokenCost" },
}));

vi.mock("../../../../src/core/activity.js", () => ({
  ActivityCollector: class {
    addEntry() {}
    getCurrentTurn() {
      return null;
    }
    getCompletedTurns() {
      return [];
    }
    startTurn() {}
    completeTurn() {}
  },
}));

vi.mock("../../../../src/llm/model-capabilities.js", () => ({
  getModelCapabilities: vi.fn(() => ({
    capabilityTier: "standard",
    maxContextTokens: 128_000,
    maxOutputTokens: 4096,
    supportsThinking: false,
    pricing: { inputPerMillion: 1, outputPerMillion: 2 },
  })),
}));

vi.mock("../../../../src/llm/tool-call-strategy.js", () => ({
  selectStrategy: vi.fn(() => ({ name: "native" })),
}));

vi.mock("../../../../src/indexing/repo-map.js", () => ({
  buildRepoMap: vi.fn(async () => ({ totalFiles: 0 })),
  renderRepoMap: vi.fn(() => ""),
}));

vi.mock("../../../../src/commands/effort.js", () => ({
  getEffortLevel: vi.fn(() => "medium"),
  getEffortConfig: vi.fn(() => ({ maxTokens: 2048 })),
}));

// ---------------------------------------------------------------------------
// Imports AFTER mocks registered
// ---------------------------------------------------------------------------
import { useAgentLoop } from "../../../../src/cli/hooks/useAgentLoop.js";
import type { CommandRegistry, CommandResult } from "../../../../src/commands/registry.js";

const fakeClient = {
  name: "initial-gpt-client",
  chat: vi.fn(),
  stream: vi.fn(),
  countTokens: vi.fn(() => 1),
} as unknown as import("../../../../src/llm/provider.js").LLMProvider;

const fakeToolRegistry = {
  getAll: vi.fn(() => []),
  setToolSearch: vi.fn(),
} as unknown as import("../../../../src/tools/registry.js").ToolRegistry;

/**
 * Build a fake CommandRegistry whose `execute` returns the supplied CommandResult.
 */
function makeFakeCommandRegistry(result: CommandResult): CommandRegistry {
  return {
    isCommand: (input: string) => input.trim().startsWith("/"),
    execute: vi.fn(async () => result),
  } as unknown as CommandRegistry;
}

describe("useAgentLoop — modelOverride regression (Issue #3)", () => {
  beforeEach(() => {
    resetState();
    hoisted.runAgentLoopMock.mockClear();
    hoisted.createLLMClientForModelMock.mockClear();
    hoisted.resolveProviderMock.mockClear();
  });

  afterEach(() => {
    runCleanups();
  });

  it("applies modelOverride via resolveProvider when no newProvider is supplied, before processMessage runs", async () => {
    const commandRegistry = makeFakeCommandRegistry({
      output: "Expanded skill prompt",
      success: true,
      shouldInjectAsUserMessage: true,
      modelOverride: "claude-opus-4-20250514",
    });

    const hook = useAgentLoop({
      client: fakeClient,
      model: "gpt-4o",
      toolRegistry: fakeToolRegistry,
      strategy: { name: "native" } as unknown as import("../../../../src/llm/tool-call-strategy.js").ToolCallStrategy,
      commandRegistry,
      checkPermission: vi.fn(async () => ({ allowed: true }) as unknown as import("../../../../src/core/agent-loop.js").PermissionResult),
    });
    runEffects();

    // Invoke handleSubmit — this is synchronous up to `void processMessage(...)`
    await hook.handleSubmit("/deep-think explore repo");

    // Drain microtasks so processMessage begins
    await new Promise((r) => setImmediate(r));

    // Contract:
    //  - modelOverride was a Claude model → resolveProvider should be called
    //  - createLLMClientForModel should NOT be called (no newProvider supplied)
    expect(hoisted.resolveProviderMock).toHaveBeenCalledTimes(1);
    expect(hoisted.resolveProviderMock).toHaveBeenCalledWith("claude-opus-4-20250514");
    expect(hoisted.createLLMClientForModelMock).not.toHaveBeenCalled();

    // runAgentLoop must have been called (processMessage was invoked)
    expect(hoisted.runAgentLoopMock).toHaveBeenCalledTimes(1);

    // The model passed to runAgentLoop must be the OVERRIDDEN model — the whole
    // point of Issue #3. The injected message must be processed by the new model.
    const runArgs = hoisted.runAgentLoopMock.mock.calls[0][0] as Record<string, unknown>;
    expect(runArgs.model).toBe("claude-opus-4-20250514");
    // And the client should be the resolved-provider mock, not the original GPT client
    expect(runArgs.client).toEqual({ name: "client-from-resolveProvider" });
  });

  it("uses createLLMClientForModel when newProvider IS supplied (explicit config wins)", async () => {
    const commandRegistry = makeFakeCommandRegistry({
      output: "Expanded",
      success: true,
      shouldInjectAsUserMessage: true,
      modelOverride: "claude-opus-4-20250514",
      newProvider: {
        model: "claude-opus-4-20250514",
        baseURL: "https://api.anthropic.com",
        apiKey: "sk-test",
      },
    });

    const hook = useAgentLoop({
      client: fakeClient,
      model: "gpt-4o",
      toolRegistry: fakeToolRegistry,
      strategy: { name: "native" } as unknown as import("../../../../src/llm/tool-call-strategy.js").ToolCallStrategy,
      commandRegistry,
      checkPermission: vi.fn(async () => ({ allowed: true }) as unknown as import("../../../../src/core/agent-loop.js").PermissionResult),
    });
    runEffects();

    await hook.handleSubmit("/skill-with-provider");
    await new Promise((r) => setImmediate(r));

    expect(hoisted.createLLMClientForModelMock).toHaveBeenCalledTimes(1);
    expect(hoisted.resolveProviderMock).not.toHaveBeenCalled();

    const runArgs = hoisted.runAgentLoopMock.mock.calls[0][0] as Record<string, unknown>;
    expect(runArgs.model).toBe("claude-opus-4-20250514");
    expect(runArgs.client).toEqual({ name: "client-from-newProvider" });
  });

  it("does NOT switch models when modelOverride matches activeModel (no-op)", async () => {
    const commandRegistry = makeFakeCommandRegistry({
      output: "Expanded",
      success: true,
      shouldInjectAsUserMessage: true,
      modelOverride: "gpt-4o", // same as current
    });

    const hook = useAgentLoop({
      client: fakeClient,
      model: "gpt-4o",
      toolRegistry: fakeToolRegistry,
      strategy: { name: "native" } as unknown as import("../../../../src/llm/tool-call-strategy.js").ToolCallStrategy,
      commandRegistry,
      checkPermission: vi.fn(async () => ({ allowed: true }) as unknown as import("../../../../src/core/agent-loop.js").PermissionResult),
    });
    runEffects();

    await hook.handleSubmit("/same-model-skill");
    await new Promise((r) => setImmediate(r));

    // No client-swap path should fire when the override equals the current model
    expect(hoisted.createLLMClientForModelMock).not.toHaveBeenCalled();
    expect(hoisted.resolveProviderMock).not.toHaveBeenCalled();

    // The prompt must still go through processMessage
    expect(hoisted.runAgentLoopMock).toHaveBeenCalledTimes(1);
    const runArgs = hoisted.runAgentLoopMock.mock.calls[0][0] as Record<string, unknown>;
    expect(runArgs.model).toBe("gpt-4o");
  });

  it("leaves the model untouched for commands without modelOverride", async () => {
    const commandRegistry = makeFakeCommandRegistry({
      output: "status text",
      success: true,
      // No shouldInjectAsUserMessage, no modelOverride — this is a plain display command.
    });

    const hook = useAgentLoop({
      client: fakeClient,
      model: "gpt-4o",
      toolRegistry: fakeToolRegistry,
      strategy: { name: "native" } as unknown as import("../../../../src/llm/tool-call-strategy.js").ToolCallStrategy,
      commandRegistry,
      checkPermission: vi.fn(async () => ({ allowed: true }) as unknown as import("../../../../src/core/agent-loop.js").PermissionResult),
    });
    runEffects();

    await hook.handleSubmit("/status");
    await new Promise((r) => setImmediate(r));

    expect(hoisted.createLLMClientForModelMock).not.toHaveBeenCalled();
    expect(hoisted.resolveProviderMock).not.toHaveBeenCalled();
    // Plain command — processMessage must NOT run
    expect(hoisted.runAgentLoopMock).not.toHaveBeenCalled();
  });
});
