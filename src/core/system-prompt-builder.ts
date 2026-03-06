import { execSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { getPlatform } from "../utils/platform.js";
import { APP_NAME, VERSION } from "../constants.js";
import { type ToolRegistry } from "../tools/registry.js";

/** System prompt section */
interface PromptSection {
  readonly id: string;
  readonly content: string;
  readonly priority: number;
}

/**
 * Build the system prompt from modular sections.
 * Higher priority sections appear first.
 */
export function buildSystemPrompt(options?: {
  projectInstructions?: string;
  workingDirectory?: string;
  toolRegistry?: ToolRegistry;
  customSections?: readonly PromptSection[];
}): string {
  const cwd = options?.workingDirectory ?? process.cwd();

  const sections: PromptSection[] = [
    {
      id: "identity",
      content: buildIdentitySection(),
      priority: 100,
    },
    {
      id: "doing-tasks",
      content: buildDoingTasksSection(),
      priority: 95,
    },
    {
      id: "environment",
      content: buildEnvironmentSection(cwd),
      priority: 90,
    },
  ];

  if (options?.toolRegistry && options.toolRegistry.size > 0) {
    sections.push({
      id: "tools",
      content: buildToolsSection(options.toolRegistry),
      priority: 85,
    });
  }

  sections.push({
    id: "conventions",
    content: buildConventionsSection(),
    priority: 80,
  });

  // Load project-level instructions from .dbcode/DBCODE.md
  const projectInstructions = options?.projectInstructions ?? loadProjectInstructions(cwd);
  if (projectInstructions) {
    sections.push({
      id: "project",
      content: `# Project Instructions\n\n${projectInstructions}`,
      priority: 70,
    });
  }

  if (options?.customSections) {
    sections.push(...options.customSections);
  }

  const sorted = [...sections].sort((a, b) => b.priority - a.priority);
  return sorted.map((s) => s.content).join("\n\n---\n\n");
}

function buildIdentitySection(): string {
  return `# System

You are ${APP_NAME} v${VERSION}, an interactive AI coding assistant running in the user's terminal.
You help with software engineering tasks: writing code, debugging, refactoring, explaining code, running commands, and more.
You have direct access to the user's filesystem and can execute shell commands.

## Key behaviors
- Be concise and direct. Lead with the answer, not the reasoning.
- Prefer showing code over explaining in words.
- When you can act, act. Don't ask permission for safe, reversible operations.
- When unsure about requirements, ask the user rather than guessing.
- Never fabricate file contents, terminal output, or information you don't have.`;
}

function buildDoingTasksSection(): string {
  return `# Doing tasks

- Read files before modifying them. Understand existing code before suggesting changes.
- Make minimal, focused changes. Don't refactor surrounding code unless asked.
- Prefer editing existing files over creating new ones to prevent file bloat.
- Don't add comments, docstrings, or type annotations to code you didn't change.
- Don't add error handling or validation for scenarios that can't happen.
- Don't create abstractions for one-time operations. Three similar lines is better than a premature abstraction.
- Write complete implementations, not stubs or TODOs.
- If a task is blocked, try alternative approaches before asking the user.
- For ambiguous instructions, consider them in the context of software engineering and the current working directory.`;
}

function buildEnvironmentSection(cwd: string): string {
  const platform = getPlatform();

  const lines = [
    `# Environment`,
    ``,
    `- Platform: ${platform}`,
    `- Working directory: ${cwd}`,
    `- Shell: ${platform === "win32" ? "PowerShell" : "/bin/bash"}`,
    `- Date: ${new Date().toISOString().split("T")[0]}`,
  ];

  const git = detectGitContext(cwd);
  if (git) {
    lines.push(`- Git branch: ${git.branch}`);
    if (git.dirty) {
      lines.push(`- Git status: uncommitted changes`);
    }
    if (git.recentCommits.length > 0) {
      lines.push(`- Recent commits:`);
      for (const commit of git.recentCommits) {
        lines.push(`  - ${commit}`);
      }
    }
  }

  const projectType = detectProjectType(cwd);
  if (projectType) {
    lines.push(`- Project type: ${projectType}`);
  }

  return lines.join("\n");
}

/** Safely detect git context — returns null if not a git repo. */
function detectGitContext(
  cwd: string,
): {
  readonly branch: string;
  readonly dirty: boolean;
  readonly recentCommits: readonly string[];
} | null {
  try {
    const branch = execSync("git rev-parse --abbrev-ref HEAD", {
      cwd,
      encoding: "utf-8",
      timeout: 3000,
      stdio: ["pipe", "pipe", "pipe"],
    }).trim();

    if (!branch) return null;

    const status = execSync("git status --porcelain", {
      cwd,
      encoding: "utf-8",
      timeout: 3000,
      stdio: ["pipe", "pipe", "pipe"],
    }).trim();

    let recentCommits: string[] = [];
    try {
      const log = execSync("git log --oneline -3", {
        cwd,
        encoding: "utf-8",
        timeout: 3000,
        stdio: ["pipe", "pipe", "pipe"],
      }).trim();
      if (log) {
        recentCommits = log.split("\n");
      }
    } catch {
      // ignore
    }

    return { branch, dirty: status.length > 0, recentCommits };
  } catch {
    return null;
  }
}

/** Detect project type from files in cwd. */
function detectProjectType(cwd: string): string | null {
  if (existsSync(join(cwd, "package.json"))) return "Node.js";
  if (existsSync(join(cwd, "Cargo.toml"))) return "Rust";
  if (existsSync(join(cwd, "go.mod"))) return "Go";
  if (existsSync(join(cwd, "pyproject.toml")) || existsSync(join(cwd, "setup.py")))
    return "Python";
  if (existsSync(join(cwd, "pom.xml")) || existsSync(join(cwd, "build.gradle"))) return "Java";
  if (existsSync(join(cwd, "Gemfile"))) return "Ruby";
  return null;
}

/** Load project instructions from .dbcode/DBCODE.md */
function loadProjectInstructions(cwd: string): string | null {
  const paths = [
    join(cwd, `.${APP_NAME}`, `${APP_NAME.toUpperCase()}.md`),
    join(cwd, `${APP_NAME.toUpperCase()}.md`),
  ];

  for (const p of paths) {
    try {
      if (existsSync(p)) {
        return readFileSync(p, "utf-8").trim();
      }
    } catch {
      // ignore
    }
  }
  return null;
}

function buildToolsSection(registry: ToolRegistry): string {
  const defs = registry.getDefinitionsForLLM();
  const lines = defs.map((d) => `- **${d.function.name}**: ${d.function.description}`);

  return `# Using your tools

You have tools for interacting with the codebase. Use the right tool for each task:

${lines.join("\n")}

## Tool usage guidelines

- Use **file_read** to read files before modifying them. Always read first.
- Use **file_edit** for targeted changes to existing files (search/replace).
- Use **file_write** only for creating new files or complete rewrites.
- Use **glob_search** to find files by name pattern (e.g., \`**/*.ts\`).
- Use **grep_search** to find content inside files by regex pattern.
- Use **bash_exec** for running commands (build, test, git, etc.).
- Use **ask_user** when you need clarification from the user.
- You can call multiple tools in parallel when they are independent.`;
}

function buildConventionsSection(): string {
  return `# Code quality

- Write clean, production-grade code. No stubs, no placeholders.
- Handle errors explicitly — no silent catches.
- Follow the project's existing code style and conventions.
- When fixing bugs, understand the root cause before applying a fix.
- When adding features, integrate naturally with existing architecture.
- Test your changes when a test framework is available.`;
}
