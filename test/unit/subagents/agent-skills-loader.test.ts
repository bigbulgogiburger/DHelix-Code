import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  loadSkillsForAgent,
  buildSkillPromptSection,
  type LoadedSkill,
} from "../../../src/subagents/agent-skills-loader.js";

// Mock the skill loader
vi.mock("../../../src/skills/loader.js", () => ({
  loadSkill: vi.fn(),
}));

// Mock node:os for consistent paths
vi.mock("node:os", () => ({
  homedir: vi.fn().mockReturnValue("/home/testuser"),
}));

const { loadSkill } = await import("../../../src/skills/loader.js");

beforeEach(() => {
  vi.clearAllMocks();
});

// =============================================================================
// loadSkillsForAgent
// =============================================================================

describe("loadSkillsForAgent", () => {
  it("should return empty array for empty skill names", async () => {
    const result = await loadSkillsForAgent([], "/project");
    expect(result).toEqual([]);
    expect(loadSkill).not.toHaveBeenCalled();
  });

  it("should load a skill found in the first directory", async () => {
    vi.mocked(loadSkill).mockImplementation(async (path: string) => {
      if (path.includes("commands") && path.includes("review")) {
        return {
          frontmatter: { name: "review", description: "Review code" },
          body: "You are a code reviewer.",
          sourcePath: path,
        };
      }
      throw new Error("Not found");
    });

    const result = await loadSkillsForAgent(["review"], "/project");
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("review");
    expect(result[0].content).toBe("You are a code reviewer.");
  });

  it("should search project directories before user directories", async () => {
    const callOrder: string[] = [];
    vi.mocked(loadSkill).mockImplementation(async (path: string) => {
      callOrder.push(path);
      if (path.includes("project") && !path.includes("testuser")) {
        return {
          frontmatter: { name: "review", description: "Project review" },
          body: "Project-level reviewer.",
          sourcePath: path,
        };
      }
      throw new Error("Not found");
    });

    const result = await loadSkillsForAgent(["review"], "/project");
    expect(result).toHaveLength(1);
    expect(result[0].content).toBe("Project-level reviewer.");

    // Verify project directories were checked first
    const firstCallPath = callOrder[0];
    expect(firstCallPath).toContain("project");
  });

  it("should silently skip skills not found in any directory", async () => {
    vi.mocked(loadSkill).mockRejectedValue(new Error("Not found"));

    const result = await loadSkillsForAgent(["nonexistent-skill"], "/project");
    expect(result).toEqual([]);
  });

  it("should load multiple skills", async () => {
    vi.mocked(loadSkill).mockImplementation(async (path: string) => {
      if (path.includes("review")) {
        return {
          frontmatter: { name: "review", description: "Review" },
          body: "Review content",
          sourcePath: path,
        };
      }
      if (path.includes("lint")) {
        return {
          frontmatter: { name: "lint", description: "Lint" },
          body: "Lint content",
          sourcePath: path,
        };
      }
      throw new Error("Not found");
    });

    const result = await loadSkillsForAgent(["review", "lint"], "/project");
    expect(result).toHaveLength(2);
    expect(result[0].name).toBe("review");
    expect(result[1].name).toBe("lint");
  });

  it("should skip missing skills and return found ones", async () => {
    vi.mocked(loadSkill).mockImplementation(async (path: string) => {
      if (path.includes("review")) {
        return {
          frontmatter: { name: "review", description: "Review" },
          body: "Review content",
          sourcePath: path,
        };
      }
      throw new Error("Not found");
    });

    const result = await loadSkillsForAgent(["review", "missing-skill"], "/project");
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("review");
  });

  it("should check all 4 skill directories", async () => {
    const checkedPaths: string[] = [];
    vi.mocked(loadSkill).mockImplementation(async (path: string) => {
      checkedPaths.push(path);
      throw new Error("Not found");
    });

    await loadSkillsForAgent(["test-skill"], "/project");

    // Should check: project/commands, project/skills, user/commands, user/skills
    expect(checkedPaths.length).toBe(4);
    // Use platform-agnostic checks (Windows uses backslashes)
    const hasProjectCommands = checkedPaths.some(
      (p) => p.includes("project") && p.includes("commands") && !p.includes("testuser"),
    );
    const hasProjectSkills = checkedPaths.some(
      (p) => p.includes("project") && p.includes("skills") && !p.includes("testuser"),
    );
    const hasUserCommands = checkedPaths.some(
      (p) => p.includes("testuser") && p.includes("commands"),
    );
    const hasUserSkills = checkedPaths.some((p) => p.includes("testuser") && p.includes("skills"));
    expect(hasProjectCommands).toBe(true);
    expect(hasProjectSkills).toBe(true);
    expect(hasUserCommands).toBe(true);
    expect(hasUserSkills).toBe(true);
  });
});

// =============================================================================
// buildSkillPromptSection
// =============================================================================

describe("buildSkillPromptSection", () => {
  it("should return empty string for empty skills array", () => {
    const result = buildSkillPromptSection([]);
    expect(result).toBe("");
  });

  it("should build prompt section with single skill", () => {
    const skills: LoadedSkill[] = [{ name: "review", content: "Review the code carefully." }];

    const result = buildSkillPromptSection(skills);
    expect(result).toContain("# Preloaded Skills");
    expect(result).toContain("## review");
    expect(result).toContain("Review the code carefully.");
  });

  it("should build prompt section with multiple skills", () => {
    const skills: LoadedSkill[] = [
      { name: "review", content: "Review content." },
      { name: "lint", content: "Lint content." },
    ];

    const result = buildSkillPromptSection(skills);
    expect(result).toContain("## review");
    expect(result).toContain("Review content.");
    expect(result).toContain("## lint");
    expect(result).toContain("Lint content.");
  });

  it("should format with proper markdown headers", () => {
    const skills: LoadedSkill[] = [{ name: "test", content: "Test body." }];

    const result = buildSkillPromptSection(skills);
    const lines = result.split("\n");
    expect(lines[0]).toBe("# Preloaded Skills");
    expect(lines[1]).toBe("");
    expect(lines[2]).toBe("## test");
    expect(lines[3]).toBe("");
    expect(lines[4]).toBe("Test body.");
  });
});
