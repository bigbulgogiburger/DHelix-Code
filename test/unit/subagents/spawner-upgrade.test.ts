import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  type SubagentConfig,
  type SubagentResult,
  SubagentError,
  spawnSubagent,
} from "../../../src/subagents/spawner.js";
import type { AgentDefinition } from "../../../src/subagents/definition-types.js";

// Mock the agent-loop module
vi.mock("../../../src/core/agent-loop.js", () => ({
  runAgentLoop: vi.fn().mockResolvedValue({
    messages: [
      { role: "system", content: "system prompt" },
      { role: "user", content: "test prompt" },
      { role: "assistant", content: "test response" },
    ],
    iterations: 2,
    aborted: false,
  }),
}));

// Mock the system-prompt-builder
vi.mock("../../../src/core/system-prompt-builder.js", () => ({
  buildSystemPrompt: vi.fn().mockReturnValue("base system prompt"),
}));

// Mock child_process for worktree tests
vi.mock("node:child_process", () => ({
  execFile: vi.fn((_cmd: string, _args: string[], _opts: unknown, cb: Function) => {
    cb(null, { stdout: "", stderr: "" });
  }),
}));

// Mock node:fs/promises for disk persistence (no-op in tests)
vi.mock("node:fs/promises", () => ({
  mkdir: vi.fn().mockResolvedValue(undefined),
  writeFile: vi.fn().mockResolvedValue(undefined),
  readFile: vi.fn().mockRejectedValue(new Error("not found")),
  readdir: vi.fn().mockResolvedValue([]),
  stat: vi.fn().mockResolvedValue({ mtimeMs: 0 }),
  unlink: vi.fn().mockResolvedValue(undefined),
}));

// Mock createEventEmitter
vi.mock("../../../src/utils/events.js", () => ({
  createEventEmitter: vi.fn().mockReturnValue({
    emit: vi.fn(),
    on: vi.fn(),
    off: vi.fn(),
  }),
}));

// Mock model-router
vi.mock("../../../src/llm/model-router.js", () => ({
  resolveProvider: vi.fn().mockResolvedValue({
    name: "mock-provider",
    chat: vi.fn(),
    stream: vi.fn(),
    countTokens: vi.fn(),
  }),
}));

const mockToolRegistry = {
  getAll: vi.fn().mockReturnValue([
    { name: "file_read", permissionLevel: "safe" },
    { name: "file_write", permissionLevel: "confirm" },
    { name: "bash_exec", permissionLevel: "confirm" },
    { name: "grep_search", permissionLevel: "safe" },
  ]),
  register: vi.fn(),
} as unknown as import("../../../src/tools/registry.js").ToolRegistry;

beforeEach(() => {
  vi.clearAllMocks();
});

// =============================================================================
// SubagentConfig types
// =============================================================================

describe("SubagentConfig with upgrade fields", () => {
  it("should accept sharedState field", () => {
    const config: SubagentConfig = {
      type: "explore",
      prompt: "test",
      client: {} as SubagentConfig["client"],
      model: "test-model",
      strategy: {} as SubagentConfig["strategy"],
      toolRegistry: mockToolRegistry,
      sharedState: {
        set: vi.fn(),
        get: vi.fn(),
        getAll: vi.fn(),
        send: vi.fn(),
        getMessages: vi.fn(),
        getBroadcasts: vi.fn(),
        reportProgress: vi.fn(),
        getProgress: vi.fn(),
        cleanup: vi.fn(),
      },
    };

    expect(config.sharedState).toBeDefined();
  });

  it("should accept all original fields", () => {
    const config: SubagentConfig = {
      type: "plan",
      prompt: "Plan the implementation",
      client: {} as SubagentConfig["client"],
      model: "gpt-4",
      strategy: {} as SubagentConfig["strategy"],
      toolRegistry: mockToolRegistry,
      workingDirectory: "/project",
      maxIterations: 30,
      signal: new AbortController().signal,
      allowedTools: ["file_read", "grep_search"],
      run_in_background: false,
      isolation: "worktree",
      resume: "prev-id",
    };

    expect(config.type).toBe("plan");
    expect(config.maxIterations).toBe(30);
    expect(config.allowedTools).toEqual(["file_read", "grep_search"]);
  });
});

// =============================================================================
// Spawner with filtered tools (disallowedTools effect)
// =============================================================================

describe("spawnSubagent with allowedTools filtering", () => {
  it("should spawn with filtered registry when allowedTools is set", async () => {
    const { runAgentLoop } = await import("../../../src/core/agent-loop.js");

    const result = await spawnSubagent({
      type: "explore",
      prompt: "Explore safely",
      client: {} as SubagentConfig["client"],
      model: "test-model",
      strategy: {} as SubagentConfig["strategy"],
      toolRegistry: mockToolRegistry,
      allowedTools: ["file_read", "grep_search"],
    });

    expect(result.response).toBe("test response");
    // Verify runAgentLoop was called
    expect(runAgentLoop).toHaveBeenCalled();
  });

  it("should use full registry when allowedTools is not set", async () => {
    const { runAgentLoop } = await import("../../../src/core/agent-loop.js");

    await spawnSubagent({
      type: "general",
      prompt: "Do work",
      client: {} as SubagentConfig["client"],
      model: "test-model",
      strategy: {} as SubagentConfig["strategy"],
      toolRegistry: mockToolRegistry,
    });

    // runAgentLoop should receive the original toolRegistry
    const callArgs = vi.mocked(runAgentLoop).mock.calls[0][0];
    expect(callArgs.toolRegistry).toBe(mockToolRegistry);
  });
});

// =============================================================================
// Spawner with shared state
// =============================================================================

describe("spawnSubagent with sharedState", () => {
  it("should report progress via sharedState", async () => {
    const sharedState = {
      set: vi.fn(),
      get: vi.fn(),
      getAll: vi.fn(),
      send: vi.fn(),
      getMessages: vi.fn(),
      getBroadcasts: vi.fn(),
      reportProgress: vi.fn(),
      getProgress: vi.fn(),
      cleanup: vi.fn(),
    };

    const result = await spawnSubagent({
      type: "explore",
      prompt: "Explore",
      client: {} as SubagentConfig["client"],
      model: "test-model",
      strategy: {} as SubagentConfig["strategy"],
      toolRegistry: mockToolRegistry,
      sharedState,
    });

    // Should report starting and completed progress
    expect(sharedState.reportProgress).toHaveBeenCalledWith(result.agentId, 0, "starting");
    expect(sharedState.reportProgress).toHaveBeenCalledWith(result.agentId, 1, "completed");
  });

  it("should send result message via sharedState on completion", async () => {
    const sharedState = {
      set: vi.fn(),
      get: vi.fn(),
      getAll: vi.fn(),
      send: vi.fn(),
      getMessages: vi.fn(),
      getBroadcasts: vi.fn(),
      reportProgress: vi.fn(),
      getProgress: vi.fn(),
      cleanup: vi.fn(),
    };

    const result = await spawnSubagent({
      type: "explore",
      prompt: "Explore",
      client: {} as SubagentConfig["client"],
      model: "test-model",
      strategy: {} as SubagentConfig["strategy"],
      toolRegistry: mockToolRegistry,
      sharedState,
    });

    expect(sharedState.send).toHaveBeenCalledWith(
      expect.objectContaining({
        fromAgentId: result.agentId,
        type: "result",
        content: "test response",
      }),
    );
    expect(result.sharedState).toBe(sharedState);
  });

  it("should report failure via sharedState on error", async () => {
    const { runAgentLoop } = await import("../../../src/core/agent-loop.js");
    vi.mocked(runAgentLoop).mockRejectedValueOnce(new Error("LLM API failed"));

    const sharedState = {
      set: vi.fn(),
      get: vi.fn(),
      getAll: vi.fn(),
      send: vi.fn(),
      getMessages: vi.fn(),
      getBroadcasts: vi.fn(),
      reportProgress: vi.fn(),
      getProgress: vi.fn(),
      cleanup: vi.fn(),
    };

    await expect(
      spawnSubagent({
        type: "explore",
        prompt: "Explore",
        client: {} as SubagentConfig["client"],
        model: "test-model",
        strategy: {} as SubagentConfig["strategy"],
        toolRegistry: mockToolRegistry,
        sharedState,
      }),
    ).rejects.toThrow(SubagentError);

    expect(sharedState.reportProgress).toHaveBeenCalledWith(expect.any(String), 0, "failed");
    expect(sharedState.send).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "error",
        content: "LLM API failed",
      }),
    );
  });
});

// =============================================================================
// SubagentResult fields
// =============================================================================

describe("SubagentResult structure", () => {
  it("should include sharedState in result when provided", async () => {
    const sharedState = {
      set: vi.fn(),
      get: vi.fn(),
      getAll: vi.fn(),
      send: vi.fn(),
      getMessages: vi.fn(),
      getBroadcasts: vi.fn(),
      reportProgress: vi.fn(),
      getProgress: vi.fn(),
      cleanup: vi.fn(),
    };

    const result = await spawnSubagent({
      type: "general",
      prompt: "work",
      client: {} as SubagentConfig["client"],
      model: "test-model",
      strategy: {} as SubagentConfig["strategy"],
      toolRegistry: mockToolRegistry,
      sharedState,
    });

    expect(result.sharedState).toBe(sharedState);
  });

  it("should include all expected fields in result", async () => {
    const result = await spawnSubagent({
      type: "plan",
      prompt: "Plan something",
      client: {} as SubagentConfig["client"],
      model: "test-model",
      strategy: {} as SubagentConfig["strategy"],
      toolRegistry: mockToolRegistry,
    });

    expect(result).toHaveProperty("agentId");
    expect(result).toHaveProperty("type", "plan");
    expect(result).toHaveProperty("response");
    expect(result).toHaveProperty("iterations");
    expect(result).toHaveProperty("aborted");
    expect(result).toHaveProperty("messages");
  });
});

// =============================================================================
// Background mode with sharedState
// =============================================================================

describe("spawnSubagent background mode with sharedState", () => {
  it("should return placeholder result with sharedState for background mode", async () => {
    const sharedState = {
      set: vi.fn(),
      get: vi.fn(),
      getAll: vi.fn(),
      send: vi.fn(),
      getMessages: vi.fn(),
      getBroadcasts: vi.fn(),
      reportProgress: vi.fn(),
      getProgress: vi.fn(),
      cleanup: vi.fn(),
    };

    const parentEvents = {
      emit: vi.fn(),
      on: vi.fn(),
      off: vi.fn(),
    } as unknown as import("../../../src/utils/events.js").AppEventEmitter;

    const result = await spawnSubagent({
      type: "general",
      prompt: "background work",
      client: {} as SubagentConfig["client"],
      model: "test-model",
      strategy: {} as SubagentConfig["strategy"],
      toolRegistry: mockToolRegistry,
      run_in_background: true,
      parentEvents,
      sharedState,
    });

    expect(result.iterations).toBe(0);
    expect(result.response).toContain("running in background");
    expect(result.sharedState).toBe(sharedState);
  });
});

// =============================================================================
// spawnParallelSubagents shared state injection
// =============================================================================

describe("spawnParallelSubagents sharedState", () => {
  it("should auto-create and inject sharedState for parallel group", async () => {
    const { spawnParallelSubagents } = await import("../../../src/subagents/spawner.js");

    const configs: SubagentConfig[] = [
      {
        type: "explore",
        prompt: "Explore A",
        client: {} as SubagentConfig["client"],
        model: "test-model",
        strategy: {} as SubagentConfig["strategy"],
        toolRegistry: mockToolRegistry,
      },
      {
        type: "plan",
        prompt: "Plan B",
        client: {} as SubagentConfig["client"],
        model: "test-model",
        strategy: {} as SubagentConfig["strategy"],
        toolRegistry: mockToolRegistry,
      },
    ];

    const results = await spawnParallelSubagents(configs);
    expect(results).toHaveLength(2);

    // Both should have sharedState
    expect(results[0].sharedState).toBeDefined();
    expect(results[1].sharedState).toBeDefined();

    // Should share the same state instance
    expect(results[0].sharedState).toBe(results[1].sharedState);
  });
});
