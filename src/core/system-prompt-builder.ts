import { execSync } from "node:child_process";
import { existsSync } from "node:fs";
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
  const sections: PromptSection[] = [
    {
      id: "identity",
      content: buildIdentitySection(),
      priority: 100,
    },
    {
      id: "environment",
      content: buildEnvironmentSection(options?.workingDirectory),
      priority: 90,
    },
    {
      id: "conventions",
      content: buildConventionsSection(),
      priority: 80,
    },
  ];

  if (options?.toolRegistry && options.toolRegistry.size > 0) {
    sections.push({
      id: "tools",
      content: buildToolsSection(options.toolRegistry),
      priority: 85,
    });
  }

  if (options?.projectInstructions) {
    sections.push({
      id: "project",
      content: `# Project Instructions\n\n${options.projectInstructions}`,
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
  return `# System Identity

You are ${APP_NAME} v${VERSION}, an AI coding assistant running in the user's terminal.
You help with software engineering tasks: writing code, debugging, refactoring, explaining code, and more.
You have access to tools for reading/writing files, executing commands, and searching the codebase.

Be concise, accurate, and helpful. Prefer showing code over explaining in words.`;
}

function buildEnvironmentSection(workingDirectory?: string): string {
  const platform = getPlatform();
  const cwd = workingDirectory ?? process.cwd();

  const lines = [
    `# Environment`,
    ``,
    `- Platform: ${platform}`,
    `- Working directory: ${cwd}`,
    `- Shell: ${platform === "win32" ? "cmd.exe / PowerShell" : "bash"}`,
    `- Date: ${new Date().toISOString().split("T")[0]}`,
  ];

  const git = detectGitContext(cwd);
  if (git) {
    lines.push(`- Git branch: ${git.branch}`);
    if (git.dirty) {
      lines.push(`- Git status: uncommitted changes`);
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
): { readonly branch: string; readonly dirty: boolean } | null {
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

    return { branch, dirty: status.length > 0 };
  } catch {
    return null;
  }
}

/** Detect project type from files in cwd. */
function detectProjectType(cwd: string): string | null {
  if (existsSync(join(cwd, "package.json"))) return "Node.js";
  if (existsSync(join(cwd, "Cargo.toml"))) return "Rust";
  if (existsSync(join(cwd, "go.mod"))) return "Go";
  if (existsSync(join(cwd, "pyproject.toml")) || existsSync(join(cwd, "setup.py"))) return "Python";
  if (existsSync(join(cwd, "pom.xml")) || existsSync(join(cwd, "build.gradle"))) return "Java";
  if (existsSync(join(cwd, "Gemfile"))) return "Ruby";
  return null;
}

function buildToolsSection(registry: ToolRegistry): string {
  const defs = registry.getDefinitionsForLLM();
  const lines = defs.map((d) => `- **${d.function.name}**: ${d.function.description}`);

  return `# Available Tools

You have the following tools available. Use them to complete tasks:

${lines.join("\n")}`;
}

function buildConventionsSection(): string {
  return `# Conventions

- Read files before modifying them
- Make minimal, focused changes
- Prefer editing existing files over creating new ones
- Use the appropriate tool for each task
- Ask the user when requirements are unclear`;
}
