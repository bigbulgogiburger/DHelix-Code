import { describe, it, expect, vi, beforeEach } from "vitest";
import { join } from "node:path";
import { type CommandContext } from "../../../src/commands/registry.js";

// Mock fs/promises before importing the module under test
vi.mock("node:fs/promises", () => ({
  readdir: vi.fn(),
  readFile: vi.fn(),
  stat: vi.fn(),
}));

vi.mock("node:os", () => ({
  homedir: vi.fn(() => "/home/testuser"),
}));

import { readdir, readFile, stat } from "node:fs/promises";
import { homedir } from "node:os";
import { agentsCommand } from "../../../src/commands/agents.js";

const mockReaddir = vi.mocked(readdir);
const mockReadFile = vi.mocked(readFile);
const mockStat = vi.mocked(stat);

const WORK_DIR = "/project";

/** Computed expected paths (platform-agnostic via join) */
const PROJECT_AGENTS_DIR = join(WORK_DIR, ".dbcode", "agents");
const USER_AGENTS_DIR = join(homedir(), ".dbcode", "agents");

const baseContext: CommandContext = {
  workingDirectory: WORK_DIR,
  model: "test-model",
  sessionId: "test-session",
  emit: () => {},
};

/** Helper to create an ENOENT error */
function enoentError(): NodeJS.ErrnoException {
  const err = new Error("ENOENT: no such file or directory") as NodeJS.ErrnoException;
  err.code = "ENOENT";
  return err;
}

/** Route readdir calls based on computed paths */
function routeReaddir(mapping: Record<string, readonly string[]>) {
  mockReaddir.mockImplementation((dirPath) => {
    const dir = String(dirPath);
    const entries = mapping[dir];
    if (entries) {
      return Promise.resolve(entries as unknown as ReturnType<typeof readdir>);
    }
    return Promise.reject(enoentError());
  });
}

/** Route readFile calls: if predicate matches path, use specific content; otherwise use fallback */
function routeReadFile(
  fallbackContent: string,
  overrides?: ReadonlyArray<{ readonly match: string; readonly content: string }>,
) {
  if (!overrides || overrides.length === 0) {
    mockReadFile.mockResolvedValue(fallbackContent as unknown as ReturnType<typeof readFile>);
    return;
  }
  mockReadFile.mockImplementation((filePath) => {
    const path = String(filePath);
    for (const override of overrides) {
      if (path.includes(override.match)) {
        return Promise.resolve(override.content as unknown as ReturnType<typeof readFile>);
      }
    }
    return Promise.resolve(fallbackContent as unknown as ReturnType<typeof readFile>);
  });
}

/** Sample agent markdown with frontmatter */
const sampleAgentContent = [
  "---",
  "name: my-agent",
  "description: A test agent for unit testing",
  "model: sonnet",
  "max-turns: 10",
  "permission-mode: acceptEdits",
  "---",
  "",
  "You are a helpful test agent.",
  "Follow instructions carefully.",
].join("\n");

const minimalAgentContent = [
  "---",
  "name: minimal-agent",
  "description: Minimal agent",
  "---",
  "",
  "Do things.",
].join("\n");

/** File stat that indicates a regular file */
const fileStatResult = {
  isFile: () => true,
  isDirectory: () => false,
} as unknown as Awaited<ReturnType<typeof stat>>;

describe("/agents command", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe("command metadata", () => {
    it("should have correct name and description", () => {
      expect(agentsCommand.name).toBe("agents");
      expect(agentsCommand.description).toContain("agent");
      expect(agentsCommand.usage).toContain("/agents");
    });
  });

  describe("default (no args) shows list", () => {
    it("should default to list when no args given", async () => {
      mockReaddir.mockRejectedValue(enoentError());

      const result = await agentsCommand.execute("", baseContext);
      expect(result.success).toBe(true);
      expect(result.output).toContain("Agent Definitions");
    });
  });

  describe("list subcommand", () => {
    it("should show empty state when no directories exist", async () => {
      mockReaddir.mockRejectedValue(enoentError());

      const result = await agentsCommand.execute("list", baseContext);
      expect(result.success).toBe(true);
      expect(result.output).toContain("No agent definitions found");
      expect(result.output).toContain(".dbcode/agents/");
    });

    it("should list agents from project directory", async () => {
      routeReaddir({ [PROJECT_AGENTS_DIR]: ["my-agent.md"] });
      mockStat.mockResolvedValue(fileStatResult);
      routeReadFile(sampleAgentContent);

      const result = await agentsCommand.execute("list", baseContext);
      expect(result.success).toBe(true);
      expect(result.output).toContain("my-agent");
      expect(result.output).toContain("project");
      expect(result.output).toContain("sonnet");
      expect(result.output).toContain("A test agent");
      expect(result.output).toContain("1 agent(s) found");
    });

    it("should list agents from user directory", async () => {
      routeReaddir({ [USER_AGENTS_DIR]: ["my-agent.md"] });
      mockStat.mockResolvedValue(fileStatResult);
      routeReadFile(sampleAgentContent);

      const result = await agentsCommand.execute("list", baseContext);
      expect(result.success).toBe(true);
      expect(result.output).toContain("my-agent");
      expect(result.output).toContain("user");
    });

    it("should list agents from both project and user directories", async () => {
      routeReaddir({
        [PROJECT_AGENTS_DIR]: ["my-agent.md"],
        [USER_AGENTS_DIR]: ["global-agent.md"],
      });
      mockStat.mockResolvedValue(fileStatResult);
      routeReadFile(sampleAgentContent, [{ match: "global-agent", content: minimalAgentContent }]);

      const result = await agentsCommand.execute("list", baseContext);
      expect(result.success).toBe(true);
      expect(result.output).toContain("my-agent");
      expect(result.output).toContain("minimal-agent");
      expect(result.output).toContain("2 agent(s) found");
    });

    it("should skip non-.md files", async () => {
      routeReaddir({
        [PROJECT_AGENTS_DIR]: ["my-agent.md", "readme.txt", "notes.json"],
      });
      mockStat.mockResolvedValue(fileStatResult);
      routeReadFile(sampleAgentContent);

      const result = await agentsCommand.execute("list", baseContext);
      expect(result.success).toBe(true);
      expect(result.output).toContain("my-agent");
      expect(result.output).toContain("1 agent(s) found");
    });

    it("should handle agent files with malformed frontmatter gracefully", async () => {
      const malformedContent = "This file has no frontmatter at all.";

      routeReaddir({
        [PROJECT_AGENTS_DIR]: ["good-agent.md", "bad-agent.md"],
      });
      mockStat.mockResolvedValue(fileStatResult);
      routeReadFile(sampleAgentContent, [{ match: "bad-agent", content: malformedContent }]);

      const result = await agentsCommand.execute("list", baseContext);
      expect(result.success).toBe(true);
      // The malformed file uses the filename as the name
      expect(result.output).toContain("my-agent");
      expect(result.output).toContain("bad-agent");
    });
  });

  describe("show subcommand", () => {
    it("should require a name argument", async () => {
      const result = await agentsCommand.execute("show", baseContext);
      expect(result.success).toBe(false);
      expect(result.output).toContain("Usage");
    });

    it("should show details for an existing agent", async () => {
      routeReaddir({ [PROJECT_AGENTS_DIR]: ["my-agent.md"] });
      mockStat.mockResolvedValue(fileStatResult);
      routeReadFile(sampleAgentContent);

      const result = await agentsCommand.execute("show my-agent", baseContext);
      expect(result.success).toBe(true);
      expect(result.output).toContain("Agent: my-agent");
      expect(result.output).toContain("A test agent for unit testing");
      expect(result.output).toContain("sonnet");
      expect(result.output).toContain("10");
      expect(result.output).toContain("acceptEdits");
      expect(result.output).toContain("System Prompt:");
      expect(result.output).toContain("You are a helpful test agent");
    });

    it("should show not found for non-existent agent", async () => {
      mockReaddir.mockRejectedValue(enoentError());

      const result = await agentsCommand.execute("show nonexistent", baseContext);
      expect(result.success).toBe(false);
      expect(result.output).toContain('Agent "nonexistent" not found');
    });

    it("should suggest similar names when agent not found", async () => {
      routeReaddir({ [PROJECT_AGENTS_DIR]: ["my-agent.md"] });
      mockStat.mockResolvedValue(fileStatResult);
      routeReadFile(sampleAgentContent);

      const result = await agentsCommand.execute("show agent", baseContext);
      expect(result.success).toBe(false);
      expect(result.output).toContain("Did you mean");
      expect(result.output).toContain("my-agent");
    });
  });

  describe("types subcommand", () => {
    it("should list built-in agent types", async () => {
      const result = await agentsCommand.execute("types", baseContext);
      expect(result.success).toBe(true);
      expect(result.output).toContain("Built-in Agent Types");
      expect(result.output).toContain("explore");
      expect(result.output).toContain("plan");
      expect(result.output).toContain("general");
      expect(result.output).toContain("code-reviewer");
      expect(result.output).toContain("test-runner");
      expect(result.output).toContain("security-auditor");
      expect(result.output).toContain("refactorer");
    });

    it("should show iteration counts and tool counts", async () => {
      const result = await agentsCommand.execute("types", baseContext);
      expect(result.success).toBe(true);
      expect(result.output).toContain("Max Iters");
      expect(result.output).toContain("Tools");
      // explore has 15 max iterations
      expect(result.output).toContain("15");
      // general has 25 max iterations
      expect(result.output).toContain("25");
    });

    it("should show type count", async () => {
      const result = await agentsCommand.execute("types", baseContext);
      expect(result.success).toBe(true);
      expect(result.output).toContain("7 built-in type(s) available");
    });
  });

  describe("status subcommand", () => {
    it("should show agent status info", async () => {
      const result = await agentsCommand.execute("status", baseContext);
      expect(result.success).toBe(true);
      expect(result.output).toContain("Agent Status");
      expect(result.output).toContain("No active agent sessions");
    });
  });

  describe("unknown subcommand shows help", () => {
    it("should show help for unknown subcommand", async () => {
      const result = await agentsCommand.execute("foobar", baseContext);
      expect(result.success).toBe(true);
      expect(result.output).toContain("Agent Management");
      expect(result.output).toContain("/agents list");
      expect(result.output).toContain("/agents show");
      expect(result.output).toContain("/agents types");
      expect(result.output).toContain("/agents status");
    });
  });

  describe("edge cases", () => {
    it("should handle readdir returning non-ENOENT errors gracefully", async () => {
      mockReaddir.mockRejectedValue(new Error("Permission denied"));

      const result = await agentsCommand.execute("list", baseContext);
      expect(result.success).toBe(true);
      expect(result.output).toContain("No agent definitions found");
    });

    it("should handle stat failure for individual files gracefully", async () => {
      routeReaddir({
        [PROJECT_AGENTS_DIR]: ["good.md", "broken.md"],
      });
      mockStat.mockImplementation((filePath) => {
        const path = String(filePath);
        if (path.includes("broken")) {
          return Promise.reject(new Error("I/O error"));
        }
        return Promise.resolve(fileStatResult);
      });
      routeReadFile(sampleAgentContent);

      const result = await agentsCommand.execute("list", baseContext);
      expect(result.success).toBe(true);
      expect(result.output).toContain("my-agent");
      expect(result.output).toContain("1 agent(s) found");
    });

    it("should use filename as name when frontmatter has no name field", async () => {
      const noNameContent = [
        "---",
        "description: Agent without name field",
        "---",
        "",
        "Prompt body.",
      ].join("\n");

      routeReaddir({ [PROJECT_AGENTS_DIR]: ["unnamed-agent.md"] });
      mockStat.mockResolvedValue(fileStatResult);
      routeReadFile(noNameContent);

      const result = await agentsCommand.execute("list", baseContext);
      expect(result.success).toBe(true);
      expect(result.output).toContain("unnamed-agent");
    });

    it("should show default model as inherit when not specified", async () => {
      routeReaddir({ [PROJECT_AGENTS_DIR]: ["minimal.md"] });
      mockStat.mockResolvedValue(fileStatResult);
      routeReadFile(minimalAgentContent);

      const result = await agentsCommand.execute("list", baseContext);
      expect(result.success).toBe(true);
      expect(result.output).toContain("inherit");
    });

    it("should handle frontmatter with missing closing delimiter", async () => {
      const brokenFrontmatter = ["---", "name: broken", "description: No closing delimiter"].join(
        "\n",
      );

      routeReaddir({ [PROJECT_AGENTS_DIR]: ["broken.md"] });
      mockStat.mockResolvedValue(fileStatResult);
      routeReadFile(brokenFrontmatter);

      const result = await agentsCommand.execute("list", baseContext);
      expect(result.success).toBe(true);
      // Falls back to filename since frontmatter parsing fails
      expect(result.output).toContain("broken");
    });
  });
});
