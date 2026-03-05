import { describe, it, expect } from "vitest";
import { executeSkill } from "../../../src/skills/executor.js";
import { type SkillDefinition, type SkillContext } from "../../../src/skills/types.js";

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
    workingDirectory: process.cwd(),
    ...overrides,
  };
}

describe("executeSkill", () => {
  it("should interpolate $ARGUMENTS", async () => {
    const skill = makeSkill({ body: "Process: $ARGUMENTS" });
    const result = await executeSkill(skill, makeContext());
    expect(result.prompt).toBe("Process: arg1 arg2");
  });

  it("should interpolate positional args $0, $1", async () => {
    const skill = makeSkill({ body: "First: $0, Second: $1" });
    const result = await executeSkill(skill, makeContext());
    expect(result.prompt).toBe("First: arg1, Second: arg2");
  });

  it("should interpolate $ARGUMENTS[N]", async () => {
    const skill = makeSkill({ body: "Arg0: $ARGUMENTS[0], Arg1: $ARGUMENTS[1]" });
    const result = await executeSkill(skill, makeContext());
    expect(result.prompt).toBe("Arg0: arg1, Arg1: arg2");
  });

  it("should interpolate DBCODE env variables", async () => {
    const skill = makeSkill({
      body: "Session: ${DBCODE_SESSION_ID}, Dir: ${DBCODE_PROJECT_DIR}",
    });
    const result = await executeSkill(
      skill,
      makeContext({ sessionId: "sess-123", projectDir: "/project" }),
    );
    expect(result.prompt).toBe("Session: sess-123, Dir: /project");
  });

  it("should resolve dynamic context with backtick commands", async () => {
    const skill = makeSkill({ body: "Output: `!echo dynamic-value`" });
    const result = await executeSkill(skill, makeContext());
    expect(result.prompt).toBe("Output: dynamic-value");
  });

  it("should return fork=true for fork context", async () => {
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

  it("should return model override from frontmatter", async () => {
    const skill = makeSkill({
      body: "body",
      frontmatter: {
        name: "model-override",
        description: "d",
        userInvocable: true,
        disableModelInvocation: false,
        model: "gpt-4o",
        context: "inline",
        hooks: [],
      },
    });
    const result = await executeSkill(skill, makeContext());
    expect(result.model).toBe("gpt-4o");
  });

  it("should throw for empty body", async () => {
    const skill = makeSkill({ body: "" });
    await expect(executeSkill(skill, makeContext())).rejects.toThrow("no body content");
  });
});
