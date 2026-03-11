import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  parseYamlFrontmatter,
  parseAgentFile,
  AgentDefinitionLoadError,
  loadAgentDefinitions,
} from "../../../src/subagents/definition-loader.js";

// Mock fs/promises for loadAgentDefinitions
vi.mock("node:fs/promises", () => ({
  readFile: vi.fn(),
  readdir: vi.fn(),
  stat: vi.fn(),
}));

// Mock node:os for consistent home dir
vi.mock("node:os", () => ({
  homedir: vi.fn().mockReturnValue("/home/testuser"),
}));

const { readFile, readdir, stat } = await import("node:fs/promises");

beforeEach(() => {
  vi.clearAllMocks();
});

// =============================================================================
// parseYamlFrontmatter
// =============================================================================

describe("parseYamlFrontmatter", () => {
  it("should parse valid frontmatter with body", () => {
    const content = `---
name: my-agent
description: A test agent
---
This is the system prompt body.`;

    const result = parseYamlFrontmatter(content);
    expect(result.frontmatter).toEqual({
      name: "my-agent",
      description: "A test agent",
    });
    expect(result.body).toBe("This is the system prompt body.");
  });

  it("should return empty frontmatter when no delimiter at start", () => {
    const content = "Just a regular markdown file.";
    const result = parseYamlFrontmatter(content);
    expect(result.frontmatter).toEqual({});
    expect(result.body).toBe("Just a regular markdown file.");
  });

  it("should return empty frontmatter when closing delimiter is missing", () => {
    const content = `---
name: broken
No closing delimiter here`;

    const result = parseYamlFrontmatter(content);
    expect(result.frontmatter).toEqual({});
    expect(result.body).toBe(content);
  });

  it("should parse inline arrays", () => {
    const content = `---
name: agent
description: d
tools: [file_read, bash_exec, grep_search]
---
Body`;

    const result = parseYamlFrontmatter(content);
    expect(result.frontmatter.tools).toEqual(["file_read", "bash_exec", "grep_search"]);
  });

  it("should parse quoted strings in arrays", () => {
    const content = `---
name: agent
description: d
tools: ["file_read", "bash_exec"]
---
Body`;

    const result = parseYamlFrontmatter(content);
    expect(result.frontmatter.tools).toEqual(["file_read", "bash_exec"]);
  });

  it("should parse single-quoted strings in arrays", () => {
    const content = `---
name: agent
description: d
skills: ['review', 'lint']
---
Body`;

    const result = parseYamlFrontmatter(content);
    expect(result.frontmatter.skills).toEqual(["review", "lint"]);
  });

  it("should parse boolean values", () => {
    const content = `---
name: agent
description: d
background: true
---
Body`;

    const result = parseYamlFrontmatter(content);
    expect(result.frontmatter.background).toBe(true);
  });

  it("should parse false boolean", () => {
    const content = `---
name: agent
description: d
background: false
---
Body`;

    const result = parseYamlFrontmatter(content);
    expect(result.frontmatter.background).toBe(false);
  });

  it("should parse numeric values", () => {
    const content = `---
name: agent
description: d
maxTurns: 25
---
Body`;

    const result = parseYamlFrontmatter(content);
    expect(result.frontmatter.maxTurns).toBe(25);
  });

  it("should convert kebab-case keys to camelCase", () => {
    const content = `---
name: agent
description: d
max-turns: 10
permission-mode: dontAsk
disallowed-tools: [file_write]
---
Body`;

    const result = parseYamlFrontmatter(content);
    expect(result.frontmatter.maxTurns).toBe(10);
    expect(result.frontmatter.permissionMode).toBe("dontAsk");
    expect(result.frontmatter.disallowedTools).toEqual(["file_write"]);
  });

  it("should handle empty body after frontmatter", () => {
    const content = `---
name: agent
description: d
---`;

    const result = parseYamlFrontmatter(content);
    expect(result.frontmatter.name).toBe("agent");
    expect(result.body).toBe("");
  });

  it("should skip comment lines in frontmatter", () => {
    const content = `---
# This is a comment
name: agent
description: d
---
Body`;

    const result = parseYamlFrontmatter(content);
    expect(result.frontmatter).toEqual({
      name: "agent",
      description: "d",
    });
  });

  it("should skip empty lines in frontmatter", () => {
    const content = `---
name: agent

description: d
---
Body`;

    const result = parseYamlFrontmatter(content);
    expect(result.frontmatter.name).toBe("agent");
    expect(result.frontmatter.description).toBe("d");
  });

  it("should handle null values", () => {
    const content = `---
name: agent
description: d
model: null
---
Body`;

    const result = parseYamlFrontmatter(content);
    expect(result.frontmatter.model).toBeNull();
  });

  it("should handle tilde as null", () => {
    const content = `---
name: agent
description: d
model: ~
---
Body`;

    const result = parseYamlFrontmatter(content);
    expect(result.frontmatter.model).toBeNull();
  });

  it("should handle empty inline arrays", () => {
    const content = `---
name: agent
description: d
tools: []
---
Body`;

    const result = parseYamlFrontmatter(content);
    expect(result.frontmatter.tools).toEqual([]);
  });

  it("should handle quoted string values", () => {
    const content = `---
name: "my-agent"
description: "A description with: colons"
---
Body`;

    const result = parseYamlFrontmatter(content);
    expect(result.frontmatter.name).toBe("my-agent");
    expect(result.frontmatter.description).toBe("A description with: colons");
  });

  it("should parse negative numbers", () => {
    const content = `---
name: agent
description: d
maxTurns: -5
---
Body`;

    const result = parseYamlFrontmatter(content);
    expect(result.frontmatter.maxTurns).toBe(-5);
  });

  it("should parse decimal numbers", () => {
    const content = `---
name: agent
description: d
maxTurns: 1.5
---
Body`;

    const result = parseYamlFrontmatter(content);
    expect(result.frontmatter.maxTurns).toBe(1.5);
  });

  it("should handle empty value as empty string", () => {
    const content = `---
name: agent
description:
---
Body`;

    const result = parseYamlFrontmatter(content);
    expect(result.frontmatter.description).toBe("");
  });
});

// =============================================================================
// parseAgentFile
// =============================================================================

describe("parseAgentFile", () => {
  it("should parse a valid agent file", () => {
    const content = `---
name: code-reviewer
description: Reviews code for issues
model: sonnet
---
You are a code reviewer. Analyze the code carefully.`;

    const result = parseAgentFile(content, "project", "/path/to/agent.md");
    expect(result.frontmatter.name).toBe("code-reviewer");
    expect(result.frontmatter.description).toBe("Reviews code for issues");
    expect(result.frontmatter.model).toBe("sonnet");
    expect(result.systemPrompt).toBe("You are a code reviewer. Analyze the code carefully.");
    expect(result.source).toBe("project");
    expect(result.filePath).toBe("/path/to/agent.md");
  });

  it("should throw AgentDefinitionLoadError when frontmatter is missing", () => {
    const content = "No frontmatter here, just text.";

    expect(() => parseAgentFile(content, "project")).toThrow(AgentDefinitionLoadError);
    expect(() => parseAgentFile(content, "project")).toThrow("missing frontmatter");
  });

  it("should throw AgentDefinitionLoadError for invalid frontmatter", () => {
    const content = `---
name: INVALID_UPPER
description: d
---
Body`;

    expect(() => parseAgentFile(content, "user")).toThrow(AgentDefinitionLoadError);
    expect(() => parseAgentFile(content, "user")).toThrow("Invalid agent frontmatter");
  });

  it("should throw AgentDefinitionLoadError when required fields are missing", () => {
    const content = `---
name: agent
---
Body`;

    expect(() => parseAgentFile(content, "project")).toThrow(AgentDefinitionLoadError);
  });

  it("should accept file without filePath (CLI-defined)", () => {
    const content = `---
name: cli-agent
description: CLI agent
---
Prompt`;

    const result = parseAgentFile(content, "cli");
    expect(result.source).toBe("cli");
    expect(result.filePath).toBeUndefined();
  });

  it("should parse agent file with all optional fields", () => {
    const content = `---
name: full-agent
description: Full agent
tools: [file_read, bash_exec]
disallowed-tools: [file_write]
model: opus
permission-mode: dontAsk
max-turns: 15
skills: [review]
memory: user
background: true
isolation: worktree
---
System prompt here.`;

    const result = parseAgentFile(content, "project", "/test/full-agent.md");
    expect(result.frontmatter.name).toBe("full-agent");
    expect(result.frontmatter.tools).toEqual(["file_read", "bash_exec"]);
    expect(result.frontmatter.disallowedTools).toEqual(["file_write"]);
    expect(result.frontmatter.model).toBe("opus");
    expect(result.frontmatter.permissionMode).toBe("dontAsk");
    expect(result.frontmatter.maxTurns).toBe(15);
    expect(result.frontmatter.skills).toEqual(["review"]);
    expect(result.frontmatter.memory).toBe("user");
    expect(result.frontmatter.background).toBe(true);
    expect(result.frontmatter.isolation).toBe("worktree");
  });
});

// =============================================================================
// AgentDefinitionLoadError
// =============================================================================

describe("AgentDefinitionLoadError", () => {
  it("should extend BaseError with correct code", () => {
    const error = new AgentDefinitionLoadError("test error", { path: "/test" });
    expect(error.message).toBe("test error");
    expect(error.code).toBe("AGENT_DEFINITION_LOAD_ERROR");
    expect(error.context).toEqual({ path: "/test" });
  });

  it("should work without context", () => {
    const error = new AgentDefinitionLoadError("bare error");
    expect(error.code).toBe("AGENT_DEFINITION_LOAD_ERROR");
    expect(error.context).toEqual({});
  });
});

// =============================================================================
// loadAgentDefinitions
// =============================================================================

describe("loadAgentDefinitions", () => {
  it("should load definitions from both user and project scopes", async () => {
    // User scope returns one agent
    vi.mocked(readdir).mockImplementation(async (dir: unknown) => {
      const dirStr = String(dir);
      if (dirStr.includes("testuser")) {
        return ["reviewer.md"] as unknown as ReturnType<typeof readdir>;
      }
      if (dirStr.includes("myproject")) {
        return ["planner.md"] as unknown as ReturnType<typeof readdir>;
      }
      return [] as unknown as ReturnType<typeof readdir>;
    });

    vi.mocked(stat).mockResolvedValue({ isFile: () => true } as ReturnType<
      typeof stat
    > extends Promise<infer T>
      ? T
      : never);

    vi.mocked(readFile).mockImplementation(async (path: unknown) => {
      const pathStr = String(path);
      if (pathStr.includes("reviewer")) {
        return `---
name: reviewer
description: Code reviewer
---
Review code.`;
      }
      if (pathStr.includes("planner")) {
        return `---
name: planner
description: Implementation planner
---
Plan implementation.`;
      }
      return "";
    });

    const result = await loadAgentDefinitions("/myproject");
    expect(result.size).toBe(2);
    expect(result.has("reviewer")).toBe(true);
    expect(result.has("planner")).toBe(true);
    expect(result.get("reviewer")!.source).toBe("user");
    expect(result.get("planner")!.source).toBe("project");
  });

  it("should give project scope priority over user scope (override by name)", async () => {
    vi.mocked(readdir).mockResolvedValue(["agent.md"] as unknown as ReturnType<typeof readdir>);
    vi.mocked(stat).mockResolvedValue({ isFile: () => true } as ReturnType<
      typeof stat
    > extends Promise<infer T>
      ? T
      : never);

    vi.mocked(readFile).mockImplementation(async (path: unknown) => {
      const pathStr = String(path);
      if (pathStr.includes("testuser")) {
        return `---
name: my-agent
description: User version
---
User prompt.`;
      }
      return `---
name: my-agent
description: Project version
---
Project prompt.`;
    });

    const result = await loadAgentDefinitions("/myproject");
    expect(result.size).toBe(1);
    const agent = result.get("my-agent")!;
    expect(agent.source).toBe("project");
    expect(agent.frontmatter.description).toBe("Project version");
    expect(agent.systemPrompt).toBe("Project prompt.");
  });

  it("should return empty map when directories do not exist", async () => {
    const enoentError = new Error("ENOENT") as NodeJS.ErrnoException;
    enoentError.code = "ENOENT";
    vi.mocked(readdir).mockRejectedValue(enoentError);

    const result = await loadAgentDefinitions("/nonexistent");
    expect(result.size).toBe(0);
  });

  it("should skip non-.md files", async () => {
    vi.mocked(readdir).mockResolvedValue([
      "agent.md",
      "readme.txt",
      "config.json",
    ] as unknown as ReturnType<typeof readdir>);
    vi.mocked(stat).mockResolvedValue({ isFile: () => true } as ReturnType<
      typeof stat
    > extends Promise<infer T>
      ? T
      : never);
    vi.mocked(readFile).mockResolvedValue(`---
name: agent
description: An agent
---
Prompt.`);

    const result = await loadAgentDefinitions("/project");
    // Only agent.md should be loaded (per project scope)
    expect(result.has("agent")).toBe(true);
  });

  it("should skip files that fail to parse (non-fatal)", async () => {
    vi.mocked(readdir).mockResolvedValue(["good.md", "bad.md"] as unknown as ReturnType<
      typeof readdir
    >);
    vi.mocked(stat).mockResolvedValue({ isFile: () => true } as ReturnType<
      typeof stat
    > extends Promise<infer T>
      ? T
      : never);
    vi.mocked(readFile).mockImplementation(async (path: unknown) => {
      const pathStr = String(path);
      if (pathStr.includes("bad")) {
        return "No frontmatter here";
      }
      return `---
name: good-agent
description: Good agent
---
Prompt.`;
    });

    const result = await loadAgentDefinitions("/project");
    // bad.md should be silently skipped
    expect(result.has("good-agent")).toBe(true);
  });

  it("should skip entries that are not files", async () => {
    vi.mocked(readdir).mockResolvedValue(["agent.md"] as unknown as ReturnType<typeof readdir>);
    vi.mocked(stat).mockResolvedValue({ isFile: () => false } as ReturnType<
      typeof stat
    > extends Promise<infer T>
      ? T
      : never);

    const result = await loadAgentDefinitions("/project");
    expect(result.size).toBe(0);
  });

  it("should handle generic readdir errors gracefully", async () => {
    vi.mocked(readdir).mockRejectedValue(new Error("Permission denied"));

    const result = await loadAgentDefinitions("/noaccess");
    expect(result.size).toBe(0);
  });
});
