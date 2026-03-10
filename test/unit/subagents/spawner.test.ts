import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  type SubagentConfig,
  type SubagentResult,
  SubagentError,
  getAgentHistory,
} from "../../../src/subagents/spawner.js";

// Mock the agent-loop module
vi.mock("../../../src/core/agent-loop.js", () => ({
  runAgentLoop: vi.fn().mockResolvedValue({
    messages: [
      { role: "system", content: "system prompt" },
      { role: "user", content: "test prompt" },
      { role: "assistant", content: "test response" },
    ],
    iterations: 3,
    aborted: false,
  }),
}));

// Mock the system-prompt-builder
vi.mock("../../../src/core/system-prompt-builder.js", () => ({
  buildSystemPrompt: vi.fn().mockReturnValue("base system prompt"),
}));

// Mock child_process for worktree tests
vi.mock("node:child_process", () => ({
  execFile: vi.fn((cmd: string, args: string[], _opts: unknown, cb: Function) => {
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

// Mock the ToolRegistry
const mockToolRegistry = {
  getAll: vi.fn().mockReturnValue([]),
  register: vi.fn(),
} as unknown as import("../../../src/tools/registry.js").ToolRegistry;

// Mock createEventEmitter
vi.mock("../../../src/utils/events.js", () => ({
  createEventEmitter: vi.fn().mockReturnValue({
    emit: vi.fn(),
    on: vi.fn(),
    off: vi.fn(),
  }),
}));

describe("SubagentConfig interface", () => {
  it("should accept new fields: run_in_background, isolation, resume", () => {
    const config: SubagentConfig = {
      type: "explore",
      prompt: "test",
      client: {} as SubagentConfig["client"],
      model: "test-model",
      strategy: {} as SubagentConfig["strategy"],
      toolRegistry: mockToolRegistry,
      run_in_background: true,
      isolation: "worktree",
      resume: "prev-agent-id",
    };

    expect(config.run_in_background).toBe(true);
    expect(config.isolation).toBe("worktree");
    expect(config.resume).toBe("prev-agent-id");
  });
});

describe("SubagentResult interface", () => {
  it("should include agentId and workingDirectory", () => {
    const result: SubagentResult = {
      agentId: "test-uuid",
      type: "explore",
      response: "done",
      iterations: 1,
      aborted: false,
      messages: [],
      workingDirectory: "/tmp/test",
    };

    expect(result.agentId).toBe("test-uuid");
    expect(result.workingDirectory).toBe("/tmp/test");
  });
});

describe("SubagentError", () => {
  it("should extend BaseError with SUBAGENT_ERROR code", () => {
    const error = new SubagentError("test error", { type: "explore" });
    expect(error.message).toBe("test error");
    expect(error.code).toBe("SUBAGENT_ERROR");
    expect(error.context).toEqual({ type: "explore" });
  });
});

describe("getAgentHistory", () => {
  it("should return undefined for unknown agent ID", async () => {
    const history = await getAgentHistory("nonexistent-id");
    expect(history).toBeUndefined();
  });
});

describe("spawnSubagent", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should be importable and callable", async () => {
    const { spawnSubagent } = await import("../../../src/subagents/spawner.js");
    expect(typeof spawnSubagent).toBe("function");
  });

  it("should spawn a subagent and return result with agentId", async () => {
    const { spawnSubagent } = await import("../../../src/subagents/spawner.js");

    const result = await spawnSubagent({
      type: "explore",
      prompt: "Explore the codebase",
      client: {} as SubagentConfig["client"],
      model: "test-model",
      strategy: {} as SubagentConfig["strategy"],
      toolRegistry: mockToolRegistry,
    });

    expect(result.agentId).toBeDefined();
    expect(result.type).toBe("explore");
    expect(result.response).toBe("test response");
    expect(result.iterations).toBe(3);
    expect(result.aborted).toBe(false);
  });

  it("should return immediately for background mode", async () => {
    const { spawnSubagent } = await import("../../../src/subagents/spawner.js");

    const parentEvents = {
      emit: vi.fn(),
      on: vi.fn(),
      off: vi.fn(),
    } as unknown as import("../../../src/utils/events.js").AppEventEmitter;

    const result = await spawnSubagent({
      type: "general",
      prompt: "Do something in background",
      client: {} as SubagentConfig["client"],
      model: "test-model",
      strategy: {} as SubagentConfig["strategy"],
      toolRegistry: mockToolRegistry,
      run_in_background: true,
      parentEvents,
    });

    // Background mode returns immediately with placeholder
    expect(result.iterations).toBe(0);
    expect(result.response).toContain("running in background");
    expect(result.agentId).toBeDefined();
  });

  it("should store message history for resume", async () => {
    const { spawnSubagent, getAgentHistory } = await import("../../../src/subagents/spawner.js");

    const result = await spawnSubagent({
      type: "explore",
      prompt: "Initial exploration",
      client: {} as SubagentConfig["client"],
      model: "test-model",
      strategy: {} as SubagentConfig["strategy"],
      toolRegistry: mockToolRegistry,
    });

    const history = await getAgentHistory(result.agentId);
    expect(history).toBeDefined();
    expect(history!.length).toBeGreaterThan(0);
  });
});

describe("spawnParallelSubagents", () => {
  it("should spawn multiple subagents in parallel", async () => {
    const { spawnParallelSubagents } = await import("../../../src/subagents/spawner.js");

    const configs: SubagentConfig[] = [
      {
        type: "explore",
        prompt: "Explore part A",
        client: {} as SubagentConfig["client"],
        model: "test-model",
        strategy: {} as SubagentConfig["strategy"],
        toolRegistry: mockToolRegistry,
      },
      {
        type: "plan",
        prompt: "Plan part B",
        client: {} as SubagentConfig["client"],
        model: "test-model",
        strategy: {} as SubagentConfig["strategy"],
        toolRegistry: mockToolRegistry,
      },
    ];

    const results = await spawnParallelSubagents(configs);
    expect(results).toHaveLength(2);
    expect(results[0].type).toBe("explore");
    expect(results[1].type).toBe("plan");
  });
});
