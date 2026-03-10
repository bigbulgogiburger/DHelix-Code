import { mkdir, writeFile, readFile, access } from "node:fs/promises";
import { join } from "node:path";
import { APP_NAME, PROJECT_CONFIG_FILE, PROJECT_CONFIG_DIR } from "../constants.js";
import { type SlashCommand } from "./registry.js";

/** Project initialization directory name */
const PROJECT_DIR = PROJECT_CONFIG_DIR;

/** Local instructions filename (should be gitignored) */
const LOCAL_INSTRUCTIONS_FILE = `${APP_NAME.toUpperCase()}.local.md`;

/** Default settings */
const DEFAULT_SETTINGS = {
  model: "gpt-5-mini",
  allowedTools: ["file_read", "file_write", "file_edit", "bash_exec", "glob_search", "grep_search"],
};

/**
 * Check if a file exists at the given path.
 */
async function fileExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Append DBCODE.local.md to .gitignore if .gitignore exists and the entry is not already present.
 */
async function ensureGitignoreEntry(cwd: string): Promise<void> {
  const gitignorePath = join(cwd, ".gitignore");
  try {
    const content = await readFile(gitignorePath, "utf-8");
    const lines = content.split("\n");
    if (lines.some((line) => line.trim() === LOCAL_INSTRUCTIONS_FILE)) {
      return;
    }
    const newline = content.endsWith("\n") ? "" : "\n";
    await writeFile(gitignorePath, content + newline + LOCAL_INSTRUCTIONS_FILE + "\n", "utf-8");
  } catch {
    // No .gitignore — skip
  }
}

/**
 * Create .dbcode/ directory structure if it doesn't exist.
 * Returns true if the directory was newly created.
 */
async function ensureConfigDir(cwd: string): Promise<boolean> {
  const projectPath = join(cwd, PROJECT_DIR);
  if (await fileExists(projectPath)) {
    return false;
  }
  await mkdir(join(projectPath, "rules"), { recursive: true });
  await writeFile(join(projectPath, "rules", ".gitkeep"), "", "utf-8");
  await writeFile(
    join(projectPath, "settings.json"),
    JSON.stringify(DEFAULT_SETTINGS, null, 2) + "\n",
    "utf-8",
  );
  return true;
}

/**
 * Detect project info from common config files and generate a static DBCODE.md template.
 * Used as fallback for CLI `dbcode init` (outside agent loop, no LLM available).
 */
async function generateTemplate(cwd: string): Promise<string> {
  const lines: string[] = [`# ${APP_NAME.toUpperCase()}.md — Project Instructions`, ""];

  // Detect package.json
  try {
    const pkgRaw = await readFile(join(cwd, "package.json"), "utf-8");
    const pkg = JSON.parse(pkgRaw) as Record<string, unknown>;
    const projectName = typeof pkg.name === "string" ? pkg.name : "";

    lines.push("## Project Overview");
    lines.push("");
    if (projectName) lines.push(`- **Name**: ${projectName}`);

    const scripts = pkg.scripts as Record<string, string> | undefined;
    if (scripts) {
      if (scripts.build) lines.push(`- **Build**: \`npm run build\` → \`${scripts.build}\``);
      if (scripts.test) lines.push(`- **Test**: \`npm test\` → \`${scripts.test}\``);
      if (scripts.lint) lines.push(`- **Lint**: \`npm run lint\` → \`${scripts.lint}\``);
    }
    lines.push("");
  } catch {
    // No package.json
  }

  // Detect tsconfig.json
  try {
    await access(join(cwd, "tsconfig.json"));
    lines.push("- **Language**: TypeScript");
    lines.push("");
  } catch {
    // Not a TS project
  }

  // Detect Cargo.toml
  try {
    await access(join(cwd, "Cargo.toml"));
    lines.push("- **Language**: Rust");
    lines.push("");
  } catch {
    // Not a Rust project
  }

  // Detect go.mod
  try {
    await access(join(cwd, "go.mod"));
    lines.push("- **Language**: Go");
    lines.push("");
  } catch {
    // Not a Go project
  }

  // Detect pyproject.toml
  try {
    await access(join(cwd, "pyproject.toml"));
    lines.push("- **Language**: Python");
    lines.push("");
  } catch {
    // Not a Python project
  }

  // If nothing was detected, add a placeholder
  if (lines.length <= 2) {
    lines.push("Add project-specific instructions here.");
    lines.push(`${APP_NAME} reads this file at the start of every session.`);
    lines.push("");
    lines.push("## Example");
    lines.push("");
    lines.push("```");
    lines.push("- Runtime: Node.js 20+");
    lines.push("- Test: vitest");
    lines.push("- Lint: eslint + prettier");
    lines.push("```");
    lines.push("");
  }

  return lines.join("\n");
}

/**
 * Build the LLM analysis prompt for comprehensive DBCODE.md generation.
 * This prompt is injected as a user message so the LLM uses its tools
 * to analyze the codebase and create a rich DBCODE.md — similar to
 * how Claude Code's /init works.
 */
function buildAnalysisPrompt(isUpdate: boolean, configDirCreated: boolean): string {
  const contextLines: string[] = [];

  if (configDirCreated) {
    contextLines.push(
      `[/init] Created project structure:`,
      `  - ${PROJECT_DIR}/settings.json (model and tool configuration)`,
      `  - ${PROJECT_DIR}/rules/ (custom rules directory)`,
      ``,
    );
  }

  if (isUpdate) {
    contextLines.push(
      `A ${PROJECT_CONFIG_FILE} already exists. Review it and improve it based on the current codebase state.`,
      `Read the existing ${PROJECT_CONFIG_FILE} first, then analyze the codebase for anything missing or outdated.`,
      ``,
    );
  } else {
    contextLines.push(
      `Analyze this codebase and create a ${PROJECT_CONFIG_FILE} file at the project root.`,
      `This file will be read by the AI coding assistant at the start of every session.`,
      ``,
    );
  }

  const instructions = `## What to include

1. **Build/Test/Lint commands** — commonly used commands, including how to run a single test. Include package manager commands and relevant scripts.
2. **High-level architecture** — the "big picture" code structure that requires reading multiple files to understand. Focus on dependency direction, layer separation, and key abstractions.
3. **Code style conventions** — import patterns, naming conventions, error handling patterns, and project-specific rules that differ from language defaults.
4. **Key technical decisions** — framework choices, important patterns used, and constraints.

## Analysis steps

1. Read project config files (package.json, tsconfig.json, Cargo.toml, go.mod, pyproject.toml, pom.xml, build.gradle, Makefile, Gemfile, etc.)
2. Explore the top-level directory structure to understand the architecture
3. Check for README.md and incorporate important, non-obvious parts
4. Read a few key source files to understand patterns and conventions
5. Check git history for commit conventions if available

## Guidelines

- Do NOT repeat yourself or include obvious/generic instructions (e.g., "write clean code", "handle errors properly")
- Do NOT list every file or component — only document what requires reading multiple files to understand
- Do NOT make up information that isn't backed by actual project files
- Do NOT include generic development practices that any experienced developer would know
- Keep it concise — aim for under 400 lines. Prefer brevity over verbosity
- Use the project's actual directory structure, not hypothetical ones

## Required format

Start the file with:

\`\`\`
# ${APP_NAME.toUpperCase()}.md

This file provides guidance to ${APP_NAME} (AI coding assistant) when working with code in this repository.
\`\`\`

Write the result to \`${PROJECT_CONFIG_FILE}\` at the project root using file_write tool.`;

  return contextLines.join("\n") + instructions;
}

/** Result of project initialization */
export interface InitResult {
  readonly created: boolean;
  readonly path: string;
  readonly detail?: {
    readonly dbcodeMdCreated: boolean;
    readonly configDirCreated: boolean;
  };
}

/**
 * Initialize a dbcode project in the given directory.
 * Creates DBCODE.md at project root (convention) and .dbcode/ for settings and rules.
 *
 * This is the CLI fallback (used by `dbcode init` outside the agent loop).
 * For LLM-driven init, use the /init slash command inside a dbcode session.
 *
 * The two artifacts are independent:
 * - .dbcode/ directory may already exist (e.g., from git clone) while DBCODE.md is missing
 * - DBCODE.md at root may exist without .dbcode/ directory
 * Both are created if missing; existing ones are left untouched.
 */
export async function initProject(cwd: string): Promise<InitResult> {
  const projectPath = join(cwd, PROJECT_DIR);
  const rootDbcodeMd = join(cwd, PROJECT_CONFIG_FILE);

  const configDirExists = await fileExists(projectPath);
  const dbcodeMdExists = await fileExists(rootDbcodeMd);

  // If both already exist, nothing to do
  if (configDirExists && dbcodeMdExists) {
    return { created: false, path: projectPath };
  }

  const detail = {
    dbcodeMdCreated: !dbcodeMdExists,
    configDirCreated: !configDirExists,
  };

  // Create .dbcode/ and .dbcode/rules/ if missing
  if (!configDirExists) {
    await ensureConfigDir(cwd);
  }

  // Create DBCODE.md at project root if missing (static template fallback)
  if (!dbcodeMdExists) {
    const template = await generateTemplate(cwd);
    await writeFile(rootDbcodeMd, template, "utf-8");
  }

  // Ensure DBCODE.local.md is in .gitignore
  await ensureGitignoreEntry(cwd);

  return { created: true, path: projectPath, detail };
}

/** Slash command wrapper for /init — LLM-driven DBCODE.md generation */
export const initCommand: SlashCommand = {
  name: "init",
  description: "Initialize project with AI-analyzed DBCODE.md (LLM-driven)",
  usage: "/init",
  execute: async (_args, context) => {
    const cwd = context.workingDirectory;

    // Phase 1: Create .dbcode/ directory structure (if missing)
    const configDirCreated = await ensureConfigDir(cwd);
    await ensureGitignoreEntry(cwd);

    // Phase 2: Check if DBCODE.md exists (determines create vs update mode)
    const dbcodeMdExists = await fileExists(join(cwd, PROJECT_CONFIG_FILE));

    // Phase 3: Build LLM analysis prompt and inject as user message
    const prompt = buildAnalysisPrompt(dbcodeMdExists, configDirCreated);

    return {
      output: prompt,
      success: true,
      shouldInjectAsUserMessage: true,
      refreshInstructions: true,
    };
  },
};
