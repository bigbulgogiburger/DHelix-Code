import { describe, it, expect } from "vitest";
import { agentDefinitionSchema } from "../../../src/subagents/definition-types.js";

describe("agentDefinitionSchema", () => {
  describe("valid definitions", () => {
    it("should accept minimal valid definition (name + description)", () => {
      const result = agentDefinitionSchema.safeParse({
        name: "my-agent",
        description: "A test agent",
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.name).toBe("my-agent");
        expect(result.data.description).toBe("A test agent");
      }
    });

    it("should accept definition with all optional fields", () => {
      const result = agentDefinitionSchema.safeParse({
        name: "full-agent",
        description: "Agent with all fields",
        tools: ["file_read", "bash_exec"],
        disallowedTools: ["file_write"],
        model: "sonnet",
        permissionMode: "acceptEdits",
        maxTurns: 10,
        skills: ["review", "lint"],
        memory: "project",
        background: true,
        isolation: "worktree",
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.tools).toEqual(["file_read", "bash_exec"]);
        expect(result.data.disallowedTools).toEqual(["file_write"]);
        expect(result.data.model).toBe("sonnet");
        expect(result.data.permissionMode).toBe("acceptEdits");
        expect(result.data.maxTurns).toBe(10);
        expect(result.data.skills).toEqual(["review", "lint"]);
        expect(result.data.memory).toBe("project");
        expect(result.data.background).toBe(true);
        expect(result.data.isolation).toBe("worktree");
      }
    });

    it("should default optional fields to undefined", () => {
      const result = agentDefinitionSchema.safeParse({
        name: "simple",
        description: "Simple agent",
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.tools).toBeUndefined();
        expect(result.data.model).toBeUndefined();
        expect(result.data.maxTurns).toBeUndefined();
        expect(result.data.memory).toBeUndefined();
        expect(result.data.background).toBeUndefined();
        expect(result.data.isolation).toBeUndefined();
      }
    });
  });

  describe("name validation", () => {
    it("should accept lowercase kebab-case names", () => {
      expect(agentDefinitionSchema.safeParse({ name: "a", description: "d" }).success).toBe(true);
      expect(agentDefinitionSchema.safeParse({ name: "my-agent", description: "d" }).success).toBe(
        true,
      );
      expect(agentDefinitionSchema.safeParse({ name: "agent-v2", description: "d" }).success).toBe(
        true,
      );
      expect(
        agentDefinitionSchema.safeParse({ name: "code-reviewer", description: "d" }).success,
      ).toBe(true);
    });

    it("should accept names with numbers", () => {
      expect(agentDefinitionSchema.safeParse({ name: "agent1", description: "d" }).success).toBe(
        true,
      );
      expect(agentDefinitionSchema.safeParse({ name: "a123-test", description: "d" }).success).toBe(
        true,
      );
    });

    it("should reject names starting with a number", () => {
      const result = agentDefinitionSchema.safeParse({ name: "1agent", description: "d" });
      expect(result.success).toBe(false);
    });

    it("should reject names starting with a hyphen", () => {
      const result = agentDefinitionSchema.safeParse({ name: "-agent", description: "d" });
      expect(result.success).toBe(false);
    });

    it("should reject uppercase names", () => {
      const result = agentDefinitionSchema.safeParse({ name: "MyAgent", description: "d" });
      expect(result.success).toBe(false);
    });

    it("should reject names with spaces", () => {
      const result = agentDefinitionSchema.safeParse({ name: "my agent", description: "d" });
      expect(result.success).toBe(false);
    });

    it("should reject names with underscores", () => {
      const result = agentDefinitionSchema.safeParse({ name: "my_agent", description: "d" });
      expect(result.success).toBe(false);
    });

    it("should reject empty name", () => {
      const result = agentDefinitionSchema.safeParse({ name: "", description: "d" });
      expect(result.success).toBe(false);
    });
  });

  describe("description validation", () => {
    it("should reject empty description", () => {
      const result = agentDefinitionSchema.safeParse({ name: "agent", description: "" });
      expect(result.success).toBe(false);
    });

    it("should accept any non-empty description", () => {
      const result = agentDefinitionSchema.safeParse({ name: "agent", description: "x" });
      expect(result.success).toBe(true);
    });
  });

  describe("model enum validation", () => {
    it.each(["sonnet", "opus", "haiku", "inherit"])("should accept model '%s'", (model) => {
      const result = agentDefinitionSchema.safeParse({
        name: "agent",
        description: "d",
        model,
      });
      expect(result.success).toBe(true);
    });

    it("should reject invalid model values", () => {
      const result = agentDefinitionSchema.safeParse({
        name: "agent",
        description: "d",
        model: "gpt-4",
      });
      expect(result.success).toBe(false);
    });
  });

  describe("permissionMode enum validation", () => {
    it.each(["default", "acceptEdits", "dontAsk", "bypassPermissions", "plan"])(
      "should accept permissionMode '%s'",
      (mode) => {
        const result = agentDefinitionSchema.safeParse({
          name: "agent",
          description: "d",
          permissionMode: mode,
        });
        expect(result.success).toBe(true);
      },
    );

    it("should reject invalid permissionMode", () => {
      const result = agentDefinitionSchema.safeParse({
        name: "agent",
        description: "d",
        permissionMode: "yolo",
      });
      expect(result.success).toBe(false);
    });
  });

  describe("memory enum validation", () => {
    it.each(["user", "project", "local"])("should accept memory scope '%s'", (scope) => {
      const result = agentDefinitionSchema.safeParse({
        name: "agent",
        description: "d",
        memory: scope,
      });
      expect(result.success).toBe(true);
    });

    it("should reject invalid memory scope", () => {
      const result = agentDefinitionSchema.safeParse({
        name: "agent",
        description: "d",
        memory: "global",
      });
      expect(result.success).toBe(false);
    });
  });

  describe("maxTurns validation", () => {
    it("should accept positive integers", () => {
      const result = agentDefinitionSchema.safeParse({
        name: "agent",
        description: "d",
        maxTurns: 5,
      });
      expect(result.success).toBe(true);
    });

    it("should reject zero", () => {
      const result = agentDefinitionSchema.safeParse({
        name: "agent",
        description: "d",
        maxTurns: 0,
      });
      expect(result.success).toBe(false);
    });

    it("should reject negative numbers", () => {
      const result = agentDefinitionSchema.safeParse({
        name: "agent",
        description: "d",
        maxTurns: -1,
      });
      expect(result.success).toBe(false);
    });

    it("should reject non-integer numbers", () => {
      const result = agentDefinitionSchema.safeParse({
        name: "agent",
        description: "d",
        maxTurns: 1.5,
      });
      expect(result.success).toBe(false);
    });
  });

  describe("isolation validation", () => {
    it("should accept 'worktree'", () => {
      const result = agentDefinitionSchema.safeParse({
        name: "agent",
        description: "d",
        isolation: "worktree",
      });
      expect(result.success).toBe(true);
    });

    it("should reject invalid isolation values", () => {
      const result = agentDefinitionSchema.safeParse({
        name: "agent",
        description: "d",
        isolation: "docker",
      });
      expect(result.success).toBe(false);
    });
  });

  describe("missing required fields", () => {
    it("should reject when name is missing", () => {
      const result = agentDefinitionSchema.safeParse({ description: "d" });
      expect(result.success).toBe(false);
    });

    it("should reject when description is missing", () => {
      const result = agentDefinitionSchema.safeParse({ name: "agent" });
      expect(result.success).toBe(false);
    });

    it("should reject empty object", () => {
      const result = agentDefinitionSchema.safeParse({});
      expect(result.success).toBe(false);
    });
  });
});
