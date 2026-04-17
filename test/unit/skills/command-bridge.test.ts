import { describe, it, expect, beforeEach, vi } from "vitest";
import { createSkillCommands } from "../../../src/skills/command-bridge.js";
import { type SkillManager } from "../../../src/skills/manager.js";
import { type SkillDefinition, type SkillExecutionResult } from "../../../src/skills/types.js";
import { type CommandContext } from "../../../src/commands/registry.js";

/** Helper to create a minimal SkillDefinition */
function makeSkill(overrides: {
  readonly name: string;
  readonly description?: string;
  readonly userInvocable?: boolean;
  readonly argumentHint?: string;
  readonly context?: "inline" | "fork";
  readonly agent?: "explore" | "plan" | "general";
  readonly model?: string | null;
  readonly allowedTools?: readonly string[];
}): SkillDefinition {
  return {
    frontmatter: {
      name: overrides.name,
      description: overrides.description ?? `Description for ${overrides.name}`,
      userInvocable: overrides.userInvocable ?? true,
      disableModelInvocation: false,
      argumentHint: overrides.argumentHint,
      model: overrides.model ?? null,
      context: overrides.context ?? "inline",
      agent: overrides.agent,
      allowedTools: overrides.allowedTools as string[] | undefined,
      hooks: [],
    },
    body: `Body of ${overrides.name}`,
    sourcePath: `/fake/${overrides.name}.md`,
  };
}

/** Helper to create a mock CommandContext */
function makeCommandContext(overrides: Partial<CommandContext> = {}): CommandContext {
  return {
    workingDirectory: "/project",
    model: "gpt-4o",
    emit: vi.fn(),
    sessionId: "test-session",
    ...overrides,
  };
}

/** Helper to create a mock SkillManager */
function makeMockSkillManager(options: {
  readonly invocableSkills?: readonly SkillDefinition[];
  readonly executeResult?: SkillExecutionResult | null;
}): SkillManager {
  const { invocableSkills = [], executeResult = null } = options;

  return {
    getUserInvocable: vi.fn().mockReturnValue(invocableSkills),
    execute: vi.fn().mockResolvedValue(executeResult),
    getAll: vi.fn().mockReturnValue([]),
    get: vi.fn().mockReturnValue(undefined),
    has: vi.fn().mockReturnValue(false),
    getModelVisible: vi.fn().mockReturnValue([]),
    buildPromptSection: vi.fn().mockReturnValue(null),
    loadAll: vi.fn().mockResolvedValue(undefined),
  } as unknown as SkillManager;
}

describe("createSkillCommands", () => {
  let mockManager: SkillManager;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // -------------------------------------------------------------------------
  // Command creation
  // -------------------------------------------------------------------------

  it("should return empty array when no user-invocable skills exist", () => {
    mockManager = makeMockSkillManager({ invocableSkills: [] });
    const commands = createSkillCommands(mockManager);
    expect(commands).toEqual([]);
  });

  it("should create one command per user-invocable skill", () => {
    const skills = [
      makeSkill({ name: "commit", description: "Make a commit" }),
      makeSkill({ name: "review", description: "Review code" }),
    ];
    mockManager = makeMockSkillManager({ invocableSkills: skills });
    const commands = createSkillCommands(mockManager);
    expect(commands).toHaveLength(2);
  });

  it("should set correct name on generated command", () => {
    const skills = [makeSkill({ name: "deploy" })];
    mockManager = makeMockSkillManager({ invocableSkills: skills });
    const commands = createSkillCommands(mockManager);
    expect(commands[0].name).toBe("deploy");
  });

  it("should prefix description with [skill]", () => {
    const skills = [makeSkill({ name: "lint", description: "Run linter" })];
    mockManager = makeMockSkillManager({ invocableSkills: skills });
    const commands = createSkillCommands(mockManager);
    expect(commands[0].description).toBe("[skill] Run linter");
  });

  it("should set usage with argument hint when present", () => {
    const skills = [makeSkill({ name: "review", argumentHint: "<file>" })];
    mockManager = makeMockSkillManager({ invocableSkills: skills });
    const commands = createSkillCommands(mockManager);
    expect(commands[0].usage).toBe("/review <file>");
  });

  it("should set usage without argument hint when absent", () => {
    const skills = [makeSkill({ name: "status" })];
    mockManager = makeMockSkillManager({ invocableSkills: skills });
    const commands = createSkillCommands(mockManager);
    expect(commands[0].usage).toBe("/status");
  });

  it("should only include userInvocable skills (non-invocable are excluded)", () => {
    // getUserInvocable already filters — this verifies the contract
    const invocable = [makeSkill({ name: "public-cmd" })];
    mockManager = makeMockSkillManager({ invocableSkills: invocable });
    const commands = createSkillCommands(mockManager);
    expect(commands).toHaveLength(1);
    expect(commands[0].name).toBe("public-cmd");
  });

  // -------------------------------------------------------------------------
  // Execute — inline skill
  // -------------------------------------------------------------------------

  describe("execute — inline skill", () => {
    it("should return shouldInjectAsUserMessage=true for inline skills", async () => {
      const inlineResult: SkillExecutionResult = {
        prompt: "Please commit the changes",
        fork: false,
      };
      mockManager = makeMockSkillManager({
        invocableSkills: [makeSkill({ name: "commit" })],
        executeResult: inlineResult,
      });

      const commands = createSkillCommands(mockManager);
      const result = await commands[0].execute("fix auth", makeCommandContext());

      expect(result.success).toBe(true);
      expect(result.shouldInjectAsUserMessage).toBe(true);
      expect(result.output).toBe("Please commit the changes");
    });

    it("should include modelOverride when skill specifies model", async () => {
      const inlineResult: SkillExecutionResult = {
        prompt: "Analyze deeply",
        fork: false,
        model: "claude-opus-4-20250514",
      };
      mockManager = makeMockSkillManager({
        invocableSkills: [makeSkill({ name: "analyze" })],
        executeResult: inlineResult,
      });

      const commands = createSkillCommands(mockManager);
      const result = await commands[0].execute("", makeCommandContext());

      expect(result.modelOverride).toBe("claude-opus-4-20250514");
    });

    it("should NOT have modelOverride when skill does not specify model", async () => {
      const inlineResult: SkillExecutionResult = {
        prompt: "output",
        fork: false,
        // model is undefined
      };
      mockManager = makeMockSkillManager({
        invocableSkills: [makeSkill({ name: "simple" })],
        executeResult: inlineResult,
      });

      const commands = createSkillCommands(mockManager);
      const result = await commands[0].execute("", makeCommandContext());

      expect(result.modelOverride).toBeUndefined();
    });

    it("should pass args and context to skillManager.execute", async () => {
      const inlineResult: SkillExecutionResult = {
        prompt: "done",
        fork: false,
      };
      mockManager = makeMockSkillManager({
        invocableSkills: [makeSkill({ name: "test-cmd" })],
        executeResult: inlineResult,
      });

      const commands = createSkillCommands(mockManager);
      const ctx = makeCommandContext({
        sessionId: "my-session",
        workingDirectory: "/my/project",
      });

      await commands[0].execute("arg1 arg2", ctx);

      expect(mockManager.execute).toHaveBeenCalledWith("test-cmd", "arg1 arg2", {
        sessionId: "my-session",
        workingDirectory: "/my/project",
      });
    });
  });

  // -------------------------------------------------------------------------
  // Execute — fork skill
  // -------------------------------------------------------------------------

  describe("execute — fork skill", () => {
    it("should emit skill:fork event for fork skills", async () => {
      const forkResult: SkillExecutionResult = {
        prompt: "Explore the codebase",
        fork: true,
        agentType: "explore",
        allowedTools: ["file_read", "grep_search"],
      };
      mockManager = makeMockSkillManager({
        invocableSkills: [makeSkill({ name: "explore" })],
        executeResult: forkResult,
      });

      const commands = createSkillCommands(mockManager);
      const emitFn = vi.fn();
      const ctx = makeCommandContext({ emit: emitFn });

      const result = await commands[0].execute("src/", ctx);

      expect(result.success).toBe(true);
      expect(result.output).toContain("subagent");
      expect(emitFn).toHaveBeenCalledWith("skill:fork", {
        prompt: "Explore the codebase",
        model: undefined,
        agentType: "explore",
        allowedTools: ["file_read", "grep_search"],
      });
    });

    it("should NOT set shouldInjectAsUserMessage for fork skills", async () => {
      const forkResult: SkillExecutionResult = {
        prompt: "Fork prompt",
        fork: true,
        agentType: "general",
      };
      mockManager = makeMockSkillManager({
        invocableSkills: [makeSkill({ name: "fork-cmd" })],
        executeResult: forkResult,
      });

      const commands = createSkillCommands(mockManager);
      const result = await commands[0].execute("", makeCommandContext());

      expect(result.shouldInjectAsUserMessage).toBeUndefined();
    });

    it("should use 'general' as default agent type label when agentType is undefined", async () => {
      const forkResult: SkillExecutionResult = {
        prompt: "Do something in fork",
        fork: true,
      };
      mockManager = makeMockSkillManager({
        invocableSkills: [makeSkill({ name: "generic-fork" })],
        executeResult: forkResult,
      });

      const commands = createSkillCommands(mockManager);
      const result = await commands[0].execute("", makeCommandContext());

      expect(result.success).toBe(true);
      expect(result.output).toContain("general");
    });

    it("should include model in fork event data", async () => {
      const forkResult: SkillExecutionResult = {
        prompt: "Plan the feature",
        fork: true,
        model: "claude-opus-4-20250514",
        agentType: "plan",
      };
      mockManager = makeMockSkillManager({
        invocableSkills: [makeSkill({ name: "plan" })],
        executeResult: forkResult,
      });

      const commands = createSkillCommands(mockManager);
      const emitFn = vi.fn();
      const ctx = makeCommandContext({ emit: emitFn });

      await commands[0].execute("", ctx);

      expect(emitFn).toHaveBeenCalledWith("skill:fork", {
        prompt: "Plan the feature",
        model: "claude-opus-4-20250514",
        agentType: "plan",
        allowedTools: undefined,
      });
    });

    it("should emit skill:fork with allowedTools from result", async () => {
      const forkResult: SkillExecutionResult = {
        prompt: "Restricted fork",
        fork: true,
        agentType: "explore",
        allowedTools: ["bash", "file_read"],
      };
      mockManager = makeMockSkillManager({
        invocableSkills: [makeSkill({ name: "restricted-fork" })],
        executeResult: forkResult,
      });

      const commands = createSkillCommands(mockManager);
      const emitFn = vi.fn();
      await commands[0].execute("", makeCommandContext({ emit: emitFn }));

      const emittedData = emitFn.mock.calls[0][1] as Record<string, unknown>;
      expect(emittedData.allowedTools).toEqual(["bash", "file_read"]);
    });
  });

  // -------------------------------------------------------------------------
  // Execute — failure
  // -------------------------------------------------------------------------

  describe("execute — skill execution failure", () => {
    it("should return success=false when skill execution returns null", async () => {
      mockManager = makeMockSkillManager({
        invocableSkills: [makeSkill({ name: "broken" })],
        executeResult: null,
      });

      const commands = createSkillCommands(mockManager);
      const result = await commands[0].execute("", makeCommandContext());

      expect(result.success).toBe(false);
      expect(result.output).toContain("broken");
      expect(result.output).toContain("failed");
    });

    it("should NOT emit skill:fork event when execution fails", async () => {
      mockManager = makeMockSkillManager({
        invocableSkills: [makeSkill({ name: "fail-fork" })],
        executeResult: null,
      });

      const commands = createSkillCommands(mockManager);
      const emitFn = vi.fn();
      await commands[0].execute("", makeCommandContext({ emit: emitFn }));

      expect(emitFn).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // Regression: skill:fork wiring contract + modelOverride propagation
  // -------------------------------------------------------------------------

  describe("regression — skill:fork listener contract", () => {
    it("should emit exactly one skill:fork event payload matching the SkillExecutionResult", async () => {
      const forkResult: SkillExecutionResult = {
        prompt: "Plan a migration",
        fork: true,
        agentType: "plan",
        model: "claude-opus-4-20250514",
        allowedTools: ["file_read", "grep_search"],
      };
      mockManager = makeMockSkillManager({
        invocableSkills: [makeSkill({ name: "migrate" })],
        executeResult: forkResult,
      });

      const commands = createSkillCommands(mockManager);
      const emitFn = vi.fn();
      await commands[0].execute("", makeCommandContext({ emit: emitFn }));

      expect(emitFn).toHaveBeenCalledTimes(1);
      expect(emitFn).toHaveBeenCalledWith("skill:fork", {
        prompt: "Plan a migration",
        model: "claude-opus-4-20250514",
        agentType: "plan",
        allowedTools: ["file_read", "grep_search"],
      });
    });

    it("should forward the skill:fork payload shape required by useAgentLoop's spawnSubagent wiring", async () => {
      // This test pins the payload contract that useAgentLoop.ts depends on.
      // If this shape changes, the listener in useAgentLoop must be updated in lockstep.
      const forkResult: SkillExecutionResult = {
        prompt: "Explore src/",
        fork: true,
        agentType: "explore",
      };
      mockManager = makeMockSkillManager({
        invocableSkills: [makeSkill({ name: "explore-src" })],
        executeResult: forkResult,
      });

      const commands = createSkillCommands(mockManager);
      const emitFn = vi.fn();
      await commands[0].execute("src/", makeCommandContext({ emit: emitFn }));

      const [event, payload] = emitFn.mock.calls[0];
      expect(event).toBe("skill:fork");

      // Required keys for useAgentLoop listener: prompt (required), model, agentType, allowedTools
      const data = payload as {
        prompt: string;
        model: string | undefined;
        agentType: string | undefined;
        allowedTools: readonly string[] | undefined;
      };
      expect(typeof data.prompt).toBe("string");
      expect(data.prompt.length).toBeGreaterThan(0);
      expect(["explore", "plan", "general", undefined]).toContain(data.agentType);
    });
  });

  describe("regression — modelOverride propagation", () => {
    it("should return modelOverride on inline success so useAgentLoop can switch models before processMessage", async () => {
      const inlineResult: SkillExecutionResult = {
        prompt: "Use Claude Opus for this",
        fork: false,
        model: "claude-opus-4-20250514",
      };
      mockManager = makeMockSkillManager({
        invocableSkills: [makeSkill({ name: "deep-think" })],
        executeResult: inlineResult,
      });

      const commands = createSkillCommands(mockManager);
      const result = await commands[0].execute("", makeCommandContext());

      // Contract useAgentLoop relies on:
      expect(result.success).toBe(true);
      expect(result.shouldInjectAsUserMessage).toBe(true);
      expect(result.modelOverride).toBe("claude-opus-4-20250514");
      // Output must be the processed prompt so it can be injected as a user message
      expect(result.output).toBe("Use Claude Opus for this");
    });

    it("should NOT leak modelOverride on fork skills (fork uses its own spawn payload)", async () => {
      const forkResult: SkillExecutionResult = {
        prompt: "Forked work",
        fork: true,
        model: "claude-opus-4-20250514",
        agentType: "general",
      };
      mockManager = makeMockSkillManager({
        invocableSkills: [makeSkill({ name: "forked" })],
        executeResult: forkResult,
      });

      const commands = createSkillCommands(mockManager);
      const result = await commands[0].execute("", makeCommandContext({ emit: vi.fn() }));

      // Fork branch must not set modelOverride (model is carried in the event payload instead)
      expect(result.modelOverride).toBeUndefined();
      expect(result.shouldInjectAsUserMessage).toBeUndefined();
    });
  });

  // -------------------------------------------------------------------------
  // Multiple commands independence
  // -------------------------------------------------------------------------

  describe("multiple commands independence", () => {
    it("should generate independent commands that target their own skill name", async () => {
      const skills = [
        makeSkill({ name: "alpha", description: "Alpha skill" }),
        makeSkill({ name: "beta", description: "Beta skill" }),
      ];

      const alphaResult: SkillExecutionResult = { prompt: "alpha output", fork: false };
      const betaResult: SkillExecutionResult = { prompt: "beta output", fork: false };

      const executeFn = vi
        .fn()
        .mockResolvedValueOnce(alphaResult)
        .mockResolvedValueOnce(betaResult);

      mockManager = {
        getUserInvocable: vi.fn().mockReturnValue(skills),
        execute: executeFn,
      } as unknown as SkillManager;

      const commands = createSkillCommands(mockManager);
      const ctx = makeCommandContext();

      const resultA = await commands[0].execute("a-args", ctx);
      const resultB = await commands[1].execute("b-args", ctx);

      expect(executeFn).toHaveBeenNthCalledWith(1, "alpha", "a-args", expect.any(Object));
      expect(executeFn).toHaveBeenNthCalledWith(2, "beta", "b-args", expect.any(Object));
      expect(resultA.output).toBe("alpha output");
      expect(resultB.output).toBe("beta output");
    });
  });
});
