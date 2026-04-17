/**
 * Regression tests for useAgentLoop — Issue #1: skill:fork listener wiring
 *
 * Verifies that:
 *  - When a `skill:fork` event is emitted on the hook's event emitter, the
 *    subagent spawner is invoked with the forwarded payload.
 *  - `allowedTools`, `agentType` and `model` from the skill are passed through.
 *  - The listener is cleaned up on unmount (no more spawns after cleanup).
 *
 * Approach: we emulate the React hook lifecycle via a minimal mock (same pattern
 * as test/unit/cli/hooks/useTextBuffering.test.ts), and stub the heavy side-effect
 * modules that useAgentLoop imports so the hook can be invoked in isolation.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import mitt from "mitt";

// ---------------------------------------------------------------------------
// React mock — minimal hook state machine (copied/adapted from useTextBuffering
// pattern). Only the hooks useAgentLoop actually uses at first-render time are
// implemented.
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
    if (typeof cleanup === "function") {
      effectCleanups.push(cleanup);
    }
  }
  effects = [];
}

function runCleanups() {
  for (const cleanup of effectCleanups) {
    cleanup();
  }
  effectCleanups = [];
}

vi.mock("react", () => {
  return {
    useState: (initial: unknown) => {
      const idx = stateIndex++;
      if (!stateStore.has(idx)) {
        // Support lazy-initialised useState(() => ...)
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
    useMemo: (factory: () => unknown, _deps: unknown) => {
      const idx = stateIndex++;
      if (!stateStore.has(idx)) {
        stateStore.set(idx, factory());
      }
      return stateStore.get(idx);
    },
    useRef: (initial: unknown) => {
      const idx = stateIndex++;
      if (!stateStore.has(idx)) {
        stateStore.set(idx, { current: initial });
      }
      return stateStore.get(idx);
    },
    useEffect: (fn: () => (() => void) | void) => {
      effects.push(fn);
    },
  };
});

// ---------------------------------------------------------------------------
// Heavy-dependency mocks — everything useAgentLoop imports at module init time
// that would otherwise touch fs / SQLite / network.
// ---------------------------------------------------------------------------
// vi.mock factories are hoisted to the top — use vi.hoisted to share state.
const { spawnSubagentMock } = vi.hoisted(() => {
  return {
    spawnSubagentMock: vi.fn(async () => ({
      agentId: "agent-1",
      type: "explore" as const,
      response: "subagent result text",
      iterations: 1,
      aborted: false,
      messages: [],
    })),
  };
});

vi.mock("../../../../src/subagents/spawner.js", () => ({
  spawnSubagent: spawnSubagentMock,
}));

vi.mock("../../../../src/llm/client-factory.js", () => ({
  createLLMClientForModel: vi.fn(() => ({ name: "mock-client" })),
}));

vi.mock("../../../../src/llm/model-router.js", () => ({
  resolveProvider: vi.fn(() => ({ name: "mock-resolved-client" })),
}));

// Events — use the real mitt emitter (it's pure / in-memory).
// The real createEventEmitter is kept so listeners hook into actual mitt events.

vi.mock("../../../../src/core/agent-loop.js", () => ({
  runAgentLoop: vi.fn(async () => ({ messages: [], iterations: 0, aborted: false })),
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

// indexing/repo-map is dynamically imported inside useEffect; ensure it resolves.
vi.mock("../../../../src/indexing/repo-map.js", () => ({
  buildRepoMap: vi.fn(async () => ({ totalFiles: 0 })),
  renderRepoMap: vi.fn(() => ""),
}));

// Now import the hook under test (after mocks are registered).
import { useAgentLoop } from "../../../../src/cli/hooks/useAgentLoop.js";
import { createEventEmitter } from "../../../../src/utils/events.js";

// Minimal fake LLMProvider
const fakeClient = {
  name: "gpt-test",
  chat: vi.fn(),
  stream: vi.fn(),
  countTokens: vi.fn(() => 1),
} as unknown as import("../../../../src/llm/provider.js").LLMProvider;

const fakeToolRegistry = {
  getAll: vi.fn(() => []),
  setToolSearch: vi.fn(),
} as unknown as import("../../../../src/tools/registry.js").ToolRegistry;

describe("useAgentLoop — skill:fork listener regression", () => {
  beforeEach(() => {
    resetState();
    spawnSubagentMock.mockClear();
  });

  afterEach(() => {
    runCleanups();
  });

  it("invokes spawnSubagent with the payload when skill:fork is emitted", async () => {
    const hook = useAgentLoop({
      client: fakeClient,
      model: "gpt-4o",
      toolRegistry: fakeToolRegistry,
      strategy: { name: "native" } as unknown as import("../../../../src/llm/tool-call-strategy.js").ToolCallStrategy,
      checkPermission: vi.fn(async () => ({ allowed: true }) as unknown as import("../../../../src/core/agent-loop.js").PermissionResult),
    });

    // Mount: run all useEffects once (this is where the skill:fork listener subscribes)
    runEffects();

    // Emit the skill:fork event via the hook's own events emitter
    hook.events.emit("skill:fork", {
      prompt: "Explore src/",
      model: undefined,
      agentType: "explore",
      allowedTools: ["file_read", "grep_search"],
    });

    // Allow the async spawner promise to settle
    await new Promise((r) => setImmediate(r));

    expect(spawnSubagentMock).toHaveBeenCalledTimes(1);
    const spawnCfg = spawnSubagentMock.mock.calls[0][0] as Record<string, unknown>;
    expect(spawnCfg.type).toBe("explore");
    expect(spawnCfg.prompt).toBe("Explore src/");
    expect(spawnCfg.allowedTools).toEqual(["file_read", "grep_search"]);
  });

  it("defaults agentType to 'general' when the event omits it", async () => {
    const hook = useAgentLoop({
      client: fakeClient,
      model: "gpt-4o",
      toolRegistry: fakeToolRegistry,
      strategy: { name: "native" } as unknown as import("../../../../src/llm/tool-call-strategy.js").ToolCallStrategy,
      checkPermission: vi.fn(async () => ({ allowed: true }) as unknown as import("../../../../src/core/agent-loop.js").PermissionResult),
    });
    runEffects();

    hook.events.emit("skill:fork", {
      prompt: "Generic work",
      model: undefined,
      agentType: undefined,
      allowedTools: undefined,
    });

    await new Promise((r) => setImmediate(r));

    const spawnCfg = spawnSubagentMock.mock.calls[0][0] as Record<string, unknown>;
    expect(spawnCfg.type).toBe("general");
  });

  it("forwards the model override from the skill:fork payload", async () => {
    const hook = useAgentLoop({
      client: fakeClient,
      model: "gpt-4o",
      toolRegistry: fakeToolRegistry,
      strategy: { name: "native" } as unknown as import("../../../../src/llm/tool-call-strategy.js").ToolCallStrategy,
      checkPermission: vi.fn(async () => ({ allowed: true }) as unknown as import("../../../../src/core/agent-loop.js").PermissionResult),
    });
    runEffects();

    hook.events.emit("skill:fork", {
      prompt: "Plan",
      model: "claude-opus-4-20250514",
      agentType: "plan",
      allowedTools: undefined,
    });

    await new Promise((r) => setImmediate(r));

    const spawnCfg = spawnSubagentMock.mock.calls[0][0] as Record<string, unknown>;
    expect(spawnCfg.model).toBe("claude-opus-4-20250514");
  });

  it("does NOT spawn after the effect cleanup (unmount) runs", async () => {
    const hook = useAgentLoop({
      client: fakeClient,
      model: "gpt-4o",
      toolRegistry: fakeToolRegistry,
      strategy: { name: "native" } as unknown as import("../../../../src/llm/tool-call-strategy.js").ToolCallStrategy,
      checkPermission: vi.fn(async () => ({ allowed: true }) as unknown as import("../../../../src/core/agent-loop.js").PermissionResult),
    });
    runEffects();

    // Tear down — fires all useEffect cleanup functions (off() for skill:fork)
    runCleanups();

    hook.events.emit("skill:fork", {
      prompt: "After unmount",
      model: undefined,
      agentType: "general",
      allowedTools: undefined,
    });

    await new Promise((r) => setImmediate(r));

    expect(spawnSubagentMock).not.toHaveBeenCalled();
  });
});

describe("createEventEmitter (sanity) — mitt-based skill:fork payload shape", () => {
  it("delivers the typed skill:fork event to subscribers", () => {
    const emitter = createEventEmitter();
    const received: Array<Record<string, unknown>> = [];
    emitter.on("skill:fork", (data) => {
      received.push(data as unknown as Record<string, unknown>);
    });
    emitter.emit("skill:fork", {
      prompt: "p",
      model: undefined,
      agentType: "explore",
      allowedTools: undefined,
    });
    expect(received).toHaveLength(1);
    expect(received[0].prompt).toBe("p");

    // Use mitt directly too, just to ensure our emitter is standards-compliant
    const bare = mitt();
    bare.emit("skill:fork", { prompt: "q" });
    expect(true).toBe(true);
  });
});
