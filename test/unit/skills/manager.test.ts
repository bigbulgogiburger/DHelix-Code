import { describe, it, expect, beforeEach, vi } from "vitest";
import { join } from "node:path";
import { SkillManager } from "../../../src/skills/manager.js";
import { type SkillDefinition } from "../../../src/skills/types.js";

/**
 * Mock loadSkillsFromDirectory — returns skills based on directory path
 */
const mockLoadSkillsFromDirectory = vi.fn<(dir: string) => Promise<SkillDefinition[]>>();

vi.mock("../../../src/skills/loader.js", () => ({
  loadSkillsFromDirectory: (...args: unknown[]) => mockLoadSkillsFromDirectory(args[0] as string),
}));

/**
 * Mock executeSkill — returns a controllable result
 */
const mockExecuteSkill = vi.fn();

vi.mock("../../../src/skills/executor.js", () => ({
  executeSkill: (...args: unknown[]) => mockExecuteSkill(...args),
}));

/** Helper to create a minimal SkillDefinition */
function makeSkill(overrides: {
  readonly name: string;
  readonly description?: string;
  readonly userInvocable?: boolean;
  readonly disableModelInvocation?: boolean;
  readonly body?: string;
  readonly sourcePath?: string;
  readonly argumentHint?: string;
  readonly model?: string | null;
  readonly context?: "inline" | "fork";
  readonly agent?: "explore" | "plan" | "general";
  readonly allowedTools?: readonly string[];
}): SkillDefinition {
  return {
    frontmatter: {
      name: overrides.name,
      description: overrides.description ?? `Description for ${overrides.name}`,
      userInvocable: overrides.userInvocable ?? true,
      disableModelInvocation: overrides.disableModelInvocation ?? false,
      argumentHint: overrides.argumentHint,
      model: overrides.model ?? null,
      context: overrides.context ?? "inline",
      agent: overrides.agent,
      allowedTools: overrides.allowedTools as string[] | undefined,
      hooks: [],
    },
    body: overrides.body ?? `Body of ${overrides.name}`,
    sourcePath: overrides.sourcePath ?? `/fake/path/${overrides.name}.md`,
  };
}

describe("SkillManager", () => {
  let manager: SkillManager;

  beforeEach(() => {
    manager = new SkillManager();
    vi.clearAllMocks();
    mockLoadSkillsFromDirectory.mockResolvedValue([]);
  });

  describe("getAll", () => {
    it("should return empty array when no skills loaded", () => {
      expect(manager.getAll()).toEqual([]);
    });
  });

  describe("get", () => {
    it("should return undefined for unknown skill name", () => {
      expect(manager.get("nonexistent")).toBeUndefined();
    });
  });

  describe("has", () => {
    it("should return false when no skills loaded", () => {
      expect(manager.has("anything")).toBe(false);
    });
  });

  describe("loadAll", () => {
    it("should load skills from all 5 directories (bundled + 4 user/project)", async () => {
      mockLoadSkillsFromDirectory.mockResolvedValue([]);

      await manager.loadAll("/project");

      // 5 directories: bundledSkills, globalSkills, globalCommands, projectSkills, projectCommands
      expect(mockLoadSkillsFromDirectory).toHaveBeenCalledTimes(5);
    });

    it("should include project directory in project-level paths", async () => {
      const projectRoot = join("/my", "project");
      await manager.loadAll(projectRoot);

      const calls = mockLoadSkillsFromDirectory.mock.calls.map((c) => c[0]);
      // Project-level paths contain the working directory (platform-independent)
      const projectPaths = calls.filter((p) => p.includes("project"));
      expect(projectPaths.length).toBeGreaterThanOrEqual(2);
    });

    it("should make loaded skills accessible via get/getAll", async () => {
      const skillA = makeSkill({ name: "alpha" });
      const skillB = makeSkill({ name: "beta" });

      mockLoadSkillsFromDirectory.mockImplementation(async (dir: string) => {
        if (dir.includes("skills")) return [skillA];
        if (dir.includes("commands")) return [skillB];
        return [];
      });

      await manager.loadAll("/project");

      expect(manager.getAll().length).toBeGreaterThanOrEqual(2);
      expect(manager.get("alpha")).toBeDefined();
      expect(manager.get("beta")).toBeDefined();
      expect(manager.has("alpha")).toBe(true);
    });

    it("should override earlier skills with later ones (project overrides global)", async () => {
      const globalSkill = makeSkill({
        name: "deploy",
        description: "Global deploy",
      });
      const projectSkill = makeSkill({
        name: "deploy",
        description: "Project deploy",
      });

      // loadAll loads in order:
      //   bundledSkills, globalSkills, globalCommands, projectSkills, projectCommands
      // Call index 1 (0-indexed) = bundledSkills, 2 = globalSkills, 4 = projectSkills
      let callIndex = 0;
      mockLoadSkillsFromDirectory.mockImplementation(async () => {
        callIndex++;
        if (callIndex === 2) return [globalSkill]; // globalSkills
        if (callIndex === 4) return [projectSkill]; // projectSkills
        return [];
      });

      await manager.loadAll("/project");

      const result = manager.get("deploy");
      expect(result).toBeDefined();
      expect(result!.frontmatter.description).toBe("Project deploy");
    });

    it("should handle directories returning empty arrays", async () => {
      mockLoadSkillsFromDirectory.mockResolvedValue([]);

      await manager.loadAll("/project");

      expect(manager.getAll()).toEqual([]);
    });

    it("should include a bundled skills directory path containing '.claude/skills'", async () => {
      await manager.loadAll("/project");

      const calls = mockLoadSkillsFromDirectory.mock.calls.map((c) => c[0]);
      // Bundled directory lives at <repo|pkg>/.claude/skills (cross-platform separator agnostic)
      const bundledCall = calls.find((p) => /\.claude[\\/]skills/.test(p));
      expect(bundledCall).toBeDefined();
    });

    it("should query the bundled directory as the FIRST (lowest priority) call", async () => {
      await manager.loadAll("/project");

      const firstCall = mockLoadSkillsFromDirectory.mock.calls[0][0];
      // First call must be the bundled dir — earliest load = lowest priority
      expect(firstCall).toMatch(/\.claude[\\/]skills/);
    });

    it("should allow project skills to override bundled skills with the same name", async () => {
      const bundledSkill = makeSkill({
        name: "shared",
        description: "Bundled version",
      });
      const projectSkill = makeSkill({
        name: "shared",
        description: "Project version",
      });

      // Call order: 1=bundled, 2=globalSkills, 3=globalCommands, 4=projectSkills, 5=projectCommands
      let callIndex = 0;
      mockLoadSkillsFromDirectory.mockImplementation(async () => {
        callIndex++;
        if (callIndex === 1) return [bundledSkill];
        if (callIndex === 4) return [projectSkill];
        return [];
      });

      await manager.loadAll("/project");

      const result = manager.get("shared");
      expect(result).toBeDefined();
      expect(result!.frontmatter.description).toBe("Project version");
    });

    it("should still load other tiers when bundled directory is empty", async () => {
      const globalSkill = makeSkill({ name: "only-global" });

      let callIndex = 0;
      mockLoadSkillsFromDirectory.mockImplementation(async () => {
        callIndex++;
        // bundled returns empty, globalSkills (call 2) returns a skill
        if (callIndex === 2) return [globalSkill];
        return [];
      });

      await manager.loadAll("/project");

      expect(manager.has("only-global")).toBe(true);
    });
  });

  describe("getUserInvocable", () => {
    it("should return only skills with userInvocable: true", async () => {
      const invocable = makeSkill({ name: "public-cmd", userInvocable: true });
      const internal = makeSkill({ name: "internal-cmd", userInvocable: false });

      mockLoadSkillsFromDirectory.mockResolvedValueOnce([invocable, internal]);

      await manager.loadAll("/project");

      const result = manager.getUserInvocable();
      expect(result).toHaveLength(1);
      expect(result[0].frontmatter.name).toBe("public-cmd");
    });

    it("should return empty array when no skills are user-invocable", async () => {
      const internal = makeSkill({ name: "hidden", userInvocable: false });
      mockLoadSkillsFromDirectory.mockResolvedValueOnce([internal]);

      await manager.loadAll("/project");

      expect(manager.getUserInvocable()).toEqual([]);
    });
  });

  describe("getModelVisible", () => {
    it("should return skills where disableModelInvocation is false", async () => {
      const visible = makeSkill({
        name: "visible",
        disableModelInvocation: false,
      });
      const hidden = makeSkill({
        name: "hidden",
        disableModelInvocation: true,
      });

      mockLoadSkillsFromDirectory.mockResolvedValueOnce([visible, hidden]);

      await manager.loadAll("/project");

      const result = manager.getModelVisible();
      expect(result).toHaveLength(1);
      expect(result[0].frontmatter.name).toBe("visible");
    });

    it("should include skills with disableModelInvocation defaulting to false", async () => {
      const defaultVisible = makeSkill({ name: "default-vis" });
      mockLoadSkillsFromDirectory.mockResolvedValueOnce([defaultVisible]);

      await manager.loadAll("/project");

      expect(manager.getModelVisible()).toHaveLength(1);
    });
  });

  describe("buildPromptSection", () => {
    it("should return null when no skills are loaded", () => {
      expect(manager.buildPromptSection()).toBeNull();
    });

    it("should return null when all skills have disableModelInvocation", async () => {
      const hidden = makeSkill({
        name: "hidden",
        disableModelInvocation: true,
      });
      mockLoadSkillsFromDirectory.mockResolvedValueOnce([hidden]);

      await manager.loadAll("/project");

      expect(manager.buildPromptSection()).toBeNull();
    });

    it("should generate markdown prompt section for visible skills", async () => {
      const skill = makeSkill({
        name: "commit",
        description: "Create a commit",
        userInvocable: true,
      });
      mockLoadSkillsFromDirectory.mockResolvedValueOnce([skill]);

      await manager.loadAll("/project");

      const result = manager.buildPromptSection();
      expect(result).not.toBeNull();
      expect(result).toContain("# Available Skills");
      expect(result).toContain("/commit");
      expect(result).toContain("Create a commit");
    });

    it("should show (internal) prefix for non-user-invocable skills", async () => {
      const internal = makeSkill({
        name: "auto-fix",
        description: "Auto fix issues",
        userInvocable: false,
        disableModelInvocation: false,
      });
      mockLoadSkillsFromDirectory.mockResolvedValueOnce([internal]);

      await manager.loadAll("/project");

      const result = manager.buildPromptSection()!;
      expect(result).toContain("(internal) auto-fix");
      expect(result).not.toContain("/auto-fix");
    });

    it("should include argumentHint when present", async () => {
      const skill = makeSkill({
        name: "review",
        description: "Review code",
        argumentHint: "<file>",
      });
      mockLoadSkillsFromDirectory.mockResolvedValueOnce([skill]);

      await manager.loadAll("/project");

      const result = manager.buildPromptSection()!;
      expect(result).toContain("/review <file>");
    });

    it("should not include argumentHint when absent", async () => {
      const skill = makeSkill({
        name: "status",
        description: "Show status",
      });
      mockLoadSkillsFromDirectory.mockResolvedValueOnce([skill]);

      await manager.loadAll("/project");

      const result = manager.buildPromptSection()!;
      // Should have "/status:" pattern without extra space before colon
      expect(result).toContain("**/status**:");
    });

    it("should list multiple skills", async () => {
      const skills = [
        makeSkill({ name: "commit", description: "Commit changes" }),
        makeSkill({ name: "review", description: "Review code" }),
        makeSkill({ name: "deploy", description: "Deploy app" }),
      ];
      mockLoadSkillsFromDirectory.mockResolvedValueOnce(skills);

      await manager.loadAll("/project");

      const result = manager.buildPromptSection()!;
      expect(result).toContain("/commit");
      expect(result).toContain("/review");
      expect(result).toContain("/deploy");
    });
  });

  describe("execute", () => {
    it("should return null when skill does not exist", async () => {
      const result = await manager.execute("nonexistent", "", {
        workingDirectory: "/project",
      });
      expect(result).toBeNull();
    });

    it("should call executeSkill with correct skill and context", async () => {
      const skill = makeSkill({
        name: "test-skill",
        sourcePath: "/skills/dir/test-skill.md",
      });
      mockLoadSkillsFromDirectory.mockResolvedValueOnce([skill]);
      mockExecuteSkill.mockResolvedValue({
        prompt: "executed",
        fork: false,
      });

      await manager.loadAll("/project");
      await manager.execute("test-skill", "arg1 arg2", {
        sessionId: "sess-123",
        workingDirectory: "/project",
        projectDir: "/project",
      });

      expect(mockExecuteSkill).toHaveBeenCalledTimes(1);
      const [passedSkill, passedContext] = mockExecuteSkill.mock.calls[0];
      expect(passedSkill.frontmatter.name).toBe("test-skill");
      expect(passedContext.arguments).toBe("arg1 arg2");
      expect(passedContext.positionalArgs).toEqual(["arg1", "arg2"]);
      expect(passedContext.sessionId).toBe("sess-123");
      expect(passedContext.workingDirectory).toBe("/project");
    });

    it("should extract skillDir from sourcePath", async () => {
      const skill = makeSkill({
        name: "nested",
        sourcePath: "/home/user/.dhelix/skills/nested.md",
      });
      mockLoadSkillsFromDirectory.mockResolvedValueOnce([skill]);
      mockExecuteSkill.mockResolvedValue({ prompt: "ok", fork: false });

      await manager.loadAll("/project");
      await manager.execute("nested", "", {
        workingDirectory: "/project",
      });

      const passedContext = mockExecuteSkill.mock.calls[0][1];
      expect(passedContext.skillDir).toBe("/home/user/.dhelix/skills");
    });

    it("should handle empty args string", async () => {
      const skill = makeSkill({ name: "no-args" });
      mockLoadSkillsFromDirectory.mockResolvedValueOnce([skill]);
      mockExecuteSkill.mockResolvedValue({ prompt: "ok", fork: false });

      await manager.loadAll("/project");
      await manager.execute("no-args", "", {
        workingDirectory: "/project",
      });

      const passedContext = mockExecuteSkill.mock.calls[0][1];
      expect(passedContext.arguments).toBe("");
      expect(passedContext.positionalArgs).toEqual([]);
    });

    it("should handle whitespace-only args string", async () => {
      const skill = makeSkill({ name: "space-args" });
      mockLoadSkillsFromDirectory.mockResolvedValueOnce([skill]);
      mockExecuteSkill.mockResolvedValue({ prompt: "ok", fork: false });

      await manager.loadAll("/project");
      await manager.execute("space-args", "   ", {
        workingDirectory: "/project",
      });

      const passedContext = mockExecuteSkill.mock.calls[0][1];
      expect(passedContext.positionalArgs).toEqual([]);
    });

    it("should use workingDirectory as projectDir fallback", async () => {
      const skill = makeSkill({ name: "fallback" });
      mockLoadSkillsFromDirectory.mockResolvedValueOnce([skill]);
      mockExecuteSkill.mockResolvedValue({ prompt: "ok", fork: false });

      await manager.loadAll("/project");
      await manager.execute("fallback", "", {
        workingDirectory: "/my/working/dir",
        // projectDir not provided
      });

      const passedContext = mockExecuteSkill.mock.calls[0][1];
      expect(passedContext.projectDir).toBe("/my/working/dir");
    });

    it("should prefer explicit projectDir over workingDirectory", async () => {
      const skill = makeSkill({ name: "explicit" });
      mockLoadSkillsFromDirectory.mockResolvedValueOnce([skill]);
      mockExecuteSkill.mockResolvedValue({ prompt: "ok", fork: false });

      await manager.loadAll("/project");
      await manager.execute("explicit", "", {
        workingDirectory: "/cwd",
        projectDir: "/explicit/project",
      });

      const passedContext = mockExecuteSkill.mock.calls[0][1];
      expect(passedContext.projectDir).toBe("/explicit/project");
    });

    it("should return the result from executeSkill", async () => {
      const skill = makeSkill({ name: "returner" });
      mockLoadSkillsFromDirectory.mockResolvedValueOnce([skill]);
      const expectedResult = {
        prompt: "the result prompt",
        fork: false,
        model: "gpt-4o",
      };
      mockExecuteSkill.mockResolvedValue(expectedResult);

      await manager.loadAll("/project");
      const result = await manager.execute("returner", "test", {
        workingDirectory: "/project",
      });

      expect(result).toEqual(expectedResult);
    });

    it("should handle sourcePath without slash for skillDir", async () => {
      const skill = makeSkill({
        name: "no-slash",
        sourcePath: "file.md",
      });
      mockLoadSkillsFromDirectory.mockResolvedValueOnce([skill]);
      mockExecuteSkill.mockResolvedValue({ prompt: "ok", fork: false });

      await manager.loadAll("/project");
      await manager.execute("no-slash", "", {
        workingDirectory: "/project",
      });

      const passedContext = mockExecuteSkill.mock.calls[0][1];
      // dirname("file.md") returns "." on all platforms
      expect(passedContext.skillDir).toBe(".");
    });
  });
});
