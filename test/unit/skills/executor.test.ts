import { describe, it, expect, vi, beforeEach } from "vitest";
import { executeSkill, SkillExecutionError } from "../../../src/skills/executor.js";
import { type SkillDefinition, type SkillContext } from "../../../src/skills/types.js";

/**
 * Mock child_process.execFile to control shell command behavior in tests.
 * The executor uses execFile("/bin/sh", ["-c", command], ...) for defense-in-depth.
 * This prevents real shell commands from executing and allows us to
 * verify exactly which command strings are passed to execFile.
 */
const mockExecFile = vi.fn();
vi.mock("node:child_process", () => ({
  execFile: (...args: unknown[]) => mockExecFile(...args),
}));

function makeSkill(overrides: Partial<SkillDefinition> = {}): SkillDefinition {
  return {
    frontmatter: {
      name: "test",
      description: "test skill",
      userInvocable: true,
      disableModelInvocation: false,
      model: null,
      context: "inline",
      hooks: [],
    },
    body: overrides.body ?? "Default body",
    sourcePath: "/test/skill.md",
    ...overrides,
  };
}

function makeContext(overrides: Partial<SkillContext> = {}): SkillContext {
  return {
    arguments: "arg1 arg2",
    positionalArgs: ["arg1", "arg2"],
    workingDirectory: "/project",
    ...overrides,
  };
}

/**
 * Helper: configure mockExecFile to resolve with given stdout.
 * exec callback signature: (error, stdout, stderr)
 */
function mockExecFileSuccess(stdout: string): void {
  mockExecFile.mockImplementation(
    (
      _bin: string,
      _args: string[],
      _opts: unknown,
      cb: (err: null, stdout: string, stderr: string) => void,
    ) => {
      cb(null, stdout, "");
    },
  );
}

/**
 * Helper: configure mockExecFile to resolve with an error.
 */
function mockExecFileFailure(message: string): void {
  mockExecFile.mockImplementation(
    (
      _bin: string,
      _args: string[],
      _opts: unknown,
      cb: (err: Error, stdout: string, stderr: string) => void,
    ) => {
      cb(new Error(message), "", message);
    },
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  // Default: exec succeeds with empty output (no dynamic context needed for most tests)
  mockExecFileSuccess("");
});

// ---------------------------------------------------------------------------
// interpolateVariables (tested indirectly through executeSkill)
// ---------------------------------------------------------------------------

describe("interpolateVariables", () => {
  it("should replace $ARGUMENTS with the full arguments string", async () => {
    const skill = makeSkill({ body: "Process: $ARGUMENTS" });
    const result = await executeSkill(skill, makeContext());
    expect(result.prompt).toBe("Process: arg1 arg2");
  });

  it("should replace multiple $ARGUMENTS occurrences", async () => {
    const skill = makeSkill({ body: "First: $ARGUMENTS, Second: $ARGUMENTS" });
    const result = await executeSkill(skill, makeContext({ arguments: "hello" }));
    expect(result.prompt).toBe("First: hello, Second: hello");
  });

  it("should replace $ARGUMENTS[0] and $ARGUMENTS[1] with indexed positional args", async () => {
    const skill = makeSkill({ body: "Arg0: $ARGUMENTS[0], Arg1: $ARGUMENTS[1]" });
    const result = await executeSkill(skill, makeContext());
    expect(result.prompt).toBe("Arg0: arg1, Arg1: arg2");
  });

  it("should replace $0 and $1 positional args", async () => {
    const skill = makeSkill({ body: "First: $0, Second: $1" });
    const result = await executeSkill(skill, makeContext());
    expect(result.prompt).toBe("First: arg1, Second: arg2");
  });

  it("should replace ${DHELIX_SESSION_ID}", async () => {
    const skill = makeSkill({ body: "Session: ${DHELIX_SESSION_ID}" });
    const result = await executeSkill(skill, makeContext({ sessionId: "sess-abc" }));
    expect(result.prompt).toBe("Session: sess-abc");
  });

  it("should replace ${DHELIX_SKILL_DIR}", async () => {
    const skill = makeSkill({ body: "Dir: ${DHELIX_SKILL_DIR}" });
    const result = await executeSkill(skill, makeContext({ skillDir: "/skills/dir" }));
    expect(result.prompt).toBe("Dir: /skills/dir");
  });

  it("should replace ${DHELIX_PROJECT_DIR}", async () => {
    const skill = makeSkill({ body: "Project: ${DHELIX_PROJECT_DIR}" });
    const result = await executeSkill(skill, makeContext({ projectDir: "/my/project" }));
    expect(result.prompt).toBe("Project: /my/project");
  });

  it("should replace missing optional variables with empty string", async () => {
    const skill = makeSkill({
      body: "S:${DHELIX_SESSION_ID} D:${DHELIX_SKILL_DIR} P:${DHELIX_PROJECT_DIR}",
    });
    // No sessionId, skillDir, or projectDir provided
    const result = await executeSkill(skill, makeContext());
    expect(result.prompt).toBe("S: D: P:");
  });

  it("should return empty string for out-of-range $N positional args", async () => {
    const skill = makeSkill({ body: "Third: $2, Tenth: $9" });
    const result = await executeSkill(skill, makeContext());
    expect(result.prompt).toBe("Third: , Tenth: ");
  });

  it("should return empty string for out-of-range $ARGUMENTS[N]", async () => {
    const skill = makeSkill({ body: "A5: $ARGUMENTS[5]" });
    const result = await executeSkill(skill, makeContext());
    expect(result.prompt).toBe("A5: ");
  });

  it("should handle empty arguments and positional args", async () => {
    const skill = makeSkill({ body: "Args: $ARGUMENTS, First: $0" });
    const result = await executeSkill(skill, makeContext({ arguments: "", positionalArgs: [] }));
    expect(result.prompt).toBe("Args: , First: ");
  });

  it("should not confuse $ARGUMENTS with $ARGUMENTS[N]", async () => {
    // $ARGUMENTS should NOT match $ARGUMENTS[0] — the regex uses negative lookahead for [
    const skill = makeSkill({ body: "$ARGUMENTS and $ARGUMENTS[0]" });
    const result = await executeSkill(
      skill,
      makeContext({ arguments: "full string", positionalArgs: ["first"] }),
    );
    expect(result.prompt).toBe("full string and first");
  });
});

// ---------------------------------------------------------------------------
// resolveDynamicContext (tested indirectly through executeSkill)
// ---------------------------------------------------------------------------

describe("resolveDynamicContext", () => {
  it("should resolve `!command` backtick syntax to command output", async () => {
    mockExecFileSuccess("dynamic-value");
    const skill = makeSkill({ body: "Output: `!echo hello`" });
    const result = await executeSkill(skill, makeContext());
    expect(result.prompt).toBe("Output: dynamic-value");
  });

  it("should leave body unchanged when no dynamic context is present", async () => {
    const skill = makeSkill({ body: "No commands here" });
    const result = await executeSkill(skill, makeContext({ arguments: "", positionalArgs: [] }));
    expect(result.prompt).toBe("No commands here");
    // exec should NOT have been called
    expect(mockExecFile).not.toHaveBeenCalled();
  });

  it("should replace failed commands with [Command failed: ...] message", async () => {
    mockExecFileFailure("command not found");
    const skill = makeSkill({ body: "Result: `!nonexistent_cmd`" });
    const result = await executeSkill(skill, makeContext());
    expect(result.prompt).toContain("[Command failed:");
    expect(result.prompt).toContain("command not found");
  });

  it("should resolve multiple dynamic context commands in one body", async () => {
    let callCount = 0;
    mockExecFile.mockImplementation(
      (
        _bin: string,
        args: string[],
        _opts: unknown,
        cb: (err: null, stdout: string, stderr: string) => void,
      ) => {
        callCount++;
        const cmd = args[1];
        if (cmd.includes("date")) {
          cb(null, "2026-03-29", "");
        } else if (cmd.includes("whoami")) {
          cb(null, "testuser", "");
        } else {
          cb(null, "unknown", "");
        }
      },
    );

    const skill = makeSkill({ body: "Date: `!date`, User: `!whoami`" });
    const result = await executeSkill(skill, makeContext({ arguments: "", positionalArgs: [] }));
    expect(result.prompt).toBe("Date: 2026-03-29, User: testuser");
    expect(callCount).toBe(2);
  });

  it("should pass workingDirectory as cwd to execFile", async () => {
    mockExecFileSuccess("ok");
    const skill = makeSkill({ body: "`!pwd`" });
    await executeSkill(skill, makeContext({ workingDirectory: "/custom/dir" }));
    // execFile("/bin/sh", ["-c", "pwd"], { cwd, timeout }, cb)
    expect(mockExecFile).toHaveBeenCalledWith(
      "/bin/sh",
      ["-c", "pwd"],
      expect.objectContaining({ cwd: "/custom/dir" }),
      expect.any(Function),
    );
  });
});

// ---------------------------------------------------------------------------
// Shell injection prevention (CRITICAL)
// ---------------------------------------------------------------------------

describe("shell injection prevention", () => {
  it("should NOT allow $ARGUMENTS to be interpolated inside `!command` — dynamic context resolves first", async () => {
    /**
     * SECURITY: If a skill body contains `!cat $ARGUMENTS`, the dynamic context
     * should resolve BEFORE variables are interpolated. This means exec receives
     * the literal string "cat $ARGUMENTS" (not the user's input).
     *
     * If the order were reversed (interpolate first), a malicious argument like
     * "; rm -rf /" would be injected into the shell command.
     */
    mockExecFileSuccess("file-contents");

    const skill = makeSkill({ body: "`!cat $ARGUMENTS`" });
    const ctx = makeContext({ arguments: "; rm -rf /", positionalArgs: [";", "rm", "-rf", "/"] });

    await executeSkill(skill, ctx);

    // The command passed to exec should contain the LITERAL "$ARGUMENTS",
    // NOT the interpolated user input
    const execCommand = (mockExecFile.mock.calls[0][1] as string[])[1];
    expect(execCommand).toBe("cat $ARGUMENTS");
    expect(execCommand).not.toContain("rm -rf");
  });

  it("should NOT interpolate $0 inside `!command` — prevents positional arg injection", async () => {
    mockExecFileSuccess("output");

    const skill = makeSkill({ body: "`!echo $0`" });
    const ctx = makeContext({ arguments: "$(whoami)", positionalArgs: ["$(whoami)"] });

    await executeSkill(skill, ctx);

    const execCommand = (mockExecFile.mock.calls[0][1] as string[])[1];
    expect(execCommand).toBe("echo $0");
    expect(execCommand).not.toContain("whoami");
  });

  it("should interpolate variables in non-command parts after dynamic context resolves", async () => {
    /**
     * Body has BOTH a dynamic context command AND $ARGUMENTS in separate parts.
     * Dynamic context resolves first (getting the command output), then
     * variable interpolation replaces $ARGUMENTS in the non-command text.
     */
    mockExecFileSuccess("main");

    const skill = makeSkill({ body: "Branch: `!git branch --show-current`, File: $ARGUMENTS" });
    const ctx = makeContext({ arguments: "src/index.ts", positionalArgs: ["src/index.ts"] });

    const result = await executeSkill(skill, ctx);

    // The dynamic command should have been resolved
    expect(result.prompt).toBe("Branch: main, File: src/index.ts");

    // The command should NOT contain $ARGUMENTS
    const execCommand = (mockExecFile.mock.calls[0][1] as string[])[1];
    expect(execCommand).toBe("git branch --show-current");
  });

  it("should ensure execution order: dynamic context FIRST, then variable interpolation", async () => {
    /**
     * This test verifies the correct execution order by checking that
     * the command string passed to exec does not contain any interpolated values.
     */
    const executionLog: string[] = [];

    mockExecFile.mockImplementation(
      (
        _bin: string,
        args: string[],
        _opts: unknown,
        cb: (err: null, stdout: string, stderr: string) => void,
      ) => {
        executionLog.push(`exec:${args[1]}`);
        cb(null, "resolved", "");
      },
    );

    const skill = makeSkill({
      body: "`!echo test` and $ARGUMENTS with ${DHELIX_SESSION_ID}",
    });
    const ctx = makeContext({
      arguments: "my-args",
      positionalArgs: ["my-args"],
      sessionId: "sess-001",
    });

    const result = await executeSkill(skill, ctx);

    // exec should have received the literal command without any interpolated vars
    expect(executionLog).toEqual(["exec:echo test"]);

    // Final result should have BOTH command output AND interpolated vars
    expect(result.prompt).toBe("resolved and my-args with sess-001");
  });
});

// ---------------------------------------------------------------------------
// executeSkill — main function behavior
// ---------------------------------------------------------------------------

describe("executeSkill", () => {
  it("should return prompt with body and arguments interpolated", async () => {
    const skill = makeSkill({ body: "Analyze $ARGUMENTS please" });
    const result = await executeSkill(skill, makeContext({ arguments: "src/foo.ts" }));
    expect(result.prompt).toBe("Analyze src/foo.ts please");
  });

  it("should throw SkillExecutionError for empty body", async () => {
    const skill = makeSkill({ body: "" });
    await expect(executeSkill(skill, makeContext())).rejects.toThrow("no body content");
    await expect(executeSkill(skill, makeContext())).rejects.toBeInstanceOf(SkillExecutionError);
  });

  it("should return fork=true when frontmatter context is 'fork'", async () => {
    const skill = makeSkill({
      body: "body",
      frontmatter: {
        name: "forked",
        description: "d",
        userInvocable: true,
        disableModelInvocation: false,
        model: null,
        context: "fork",
        agent: "explore",
        hooks: [],
      },
    });
    const result = await executeSkill(skill, makeContext());
    expect(result.fork).toBe(true);
    expect(result.agentType).toBe("explore");
  });

  it("should return fork=false when frontmatter context is 'inline'", async () => {
    const skill = makeSkill({ body: "body" });
    const result = await executeSkill(skill, makeContext());
    expect(result.fork).toBe(false);
  });

  it("should return model override from frontmatter", async () => {
    const skill = makeSkill({
      body: "body",
      frontmatter: {
        name: "model-override",
        description: "d",
        userInvocable: true,
        disableModelInvocation: false,
        model: "claude-opus-4-20250514",
        context: "inline",
        hooks: [],
      },
    });
    const result = await executeSkill(skill, makeContext());
    expect(result.model).toBe("claude-opus-4-20250514");
  });

  it("should return undefined model when frontmatter model is null", async () => {
    const skill = makeSkill({ body: "body" });
    const result = await executeSkill(skill, makeContext());
    expect(result.model).toBeUndefined();
  });

  it("should pass through allowedTools from frontmatter", async () => {
    const skill = makeSkill({
      body: "body",
      frontmatter: {
        name: "restricted",
        description: "d",
        userInvocable: true,
        disableModelInvocation: false,
        model: null,
        context: "inline",
        hooks: [],
        allowedTools: ["file_read", "grep_search"],
      },
    });
    const result = await executeSkill(skill, makeContext());
    expect(result.allowedTools).toEqual(["file_read", "grep_search"]);
  });

  it("should pass through agentType from frontmatter", async () => {
    const skill = makeSkill({
      body: "body",
      frontmatter: {
        name: "planner",
        description: "d",
        userInvocable: true,
        disableModelInvocation: false,
        model: null,
        context: "fork",
        agent: "plan",
        hooks: [],
      },
    });
    const result = await executeSkill(skill, makeContext());
    expect(result.agentType).toBe("plan");
  });

  it("should return undefined agentType when agent is not specified", async () => {
    const skill = makeSkill({ body: "body" });
    const result = await executeSkill(skill, makeContext());
    expect(result.agentType).toBeUndefined();
  });
});
