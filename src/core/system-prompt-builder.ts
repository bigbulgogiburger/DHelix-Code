import { execSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { getPlatform } from "../utils/platform.js";
import { APP_NAME, VERSION, getProjectConfigPaths } from "../constants.js";
import { type ToolRegistry } from "../tools/registry.js";
import { estimateTokens } from "../llm/token-counter.js";
import { type CapabilityTier } from "../llm/model-capabilities.js";
import { getToneProfile } from "./tone-profiles.js";

/** System prompt section with optional condition and token budget */
export interface PromptSection {
  readonly id: string;
  readonly content: string;
  readonly priority: number;
  /** Only include this section if condition returns true. Undefined = always include. */
  readonly condition?: () => boolean;
  /** Maximum token budget for this section. If content exceeds, it will be truncated. */
  readonly tokenBudget?: number;
}

/** Session state for conditional prompt assembly */
export interface SessionState {
  readonly mode: "normal" | "plan";
  readonly isSubagent: boolean;
  readonly subagentType?: "explore" | "plan" | "general";
  readonly availableTools: readonly string[];
  readonly extendedThinkingEnabled: boolean;
  readonly features: Readonly<Record<string, boolean>>;
}

/** Options for building the system prompt */
export interface BuildSystemPromptOptions {
  readonly projectInstructions?: string;
  readonly workingDirectory?: string;
  readonly toolRegistry?: ToolRegistry;
  readonly mcpServers?: readonly { name: string; tools: readonly string[] }[];
  readonly customSections?: readonly PromptSection[];
  readonly skillsPromptSection?: string;
  /** Auto-memory content loaded from MEMORY.md (if any) */
  readonly autoMemoryContent?: string;
  /** Session state for conditional section inclusion */
  readonly sessionState?: SessionState;
  /** Total token budget for the system prompt. Lowest-priority sections trimmed if exceeded. */
  readonly totalTokenBudget?: number;
  /** Capability tier of the active model — controls prompt complexity */
  readonly capabilityTier?: CapabilityTier;
  /** Response language locale (e.g., "ko", "en", "ja"). Defaults to "en". */
  readonly locale?: string;
  /** Response tone/style (e.g., "normal", "cute", "senior"). Defaults to "normal". */
  readonly tone?: string;
}

/** Default token budget for system prompts (32k tokens) */
const DEFAULT_TOTAL_TOKEN_BUDGET = 32_000;

/**
 * Build the system prompt from modular sections.
 * Higher priority sections appear first.
 * Sections with conditions are only included when their condition returns true.
 * If total token budget is exceeded, lowest-priority sections are trimmed.
 */
export function buildSystemPrompt(options?: BuildSystemPromptOptions): string {
  const cwd = options?.workingDirectory ?? process.cwd();
  const state = options?.sessionState;
  const locale = options?.locale ?? "en";
  const tone = options?.tone ?? "normal";

  const sections: PromptSection[] = [
    {
      id: "identity",
      content: buildIdentitySection(),
      priority: 100,
    },
    {
      id: "locale",
      content: buildLocaleSection(locale),
      priority: 94,
      condition: () => locale !== "en",
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

  if (options?.mcpServers && options.mcpServers.length > 0) {
    sections.push({
      id: "mcp",
      content: buildMCPSection(options.mcpServers),
      priority: 82,
    });
  }

  sections.push({
    id: "conventions",
    content: buildConventionsSection(),
    priority: 80,
  });

  if (options?.skillsPromptSection) {
    sections.push({
      id: "skills",
      content: options.skillsPromptSection,
      priority: 78,
    });
  }

  // Tone section (priority 76, after skills)
  sections.push({
    id: "tone",
    content: getToneProfile(tone).systemPromptSection,
    priority: 76,
    condition: () => tone !== "normal",
  });

  // CoT scaffolding for low-tier models
  const tier = options?.capabilityTier;
  sections.push({
    id: "cot-scaffolding",
    content: buildCotScaffoldingSection(),
    priority: 79,
    condition: () => tier === "low",
  });

  // Conditional sections based on session state
  if (state) {
    sections.push({
      id: "plan-mode",
      content: buildPlanModeSection(),
      priority: 92,
      condition: () => state.mode === "plan",
    });

    sections.push({
      id: "subagent",
      content: buildSubagentSection(state.subagentType),
      priority: 88,
      condition: () => state.isSubagent,
    });

    sections.push({
      id: "extended-thinking",
      content: buildExtendedThinkingSection(),
      priority: 75,
      condition: () => state.extendedThinkingEnabled,
    });

    // Add feature-flag-gated sections
    for (const [feature, content] of Object.entries(FEATURE_SECTIONS)) {
      if (feature in state.features) {
        sections.push({
          id: `feature-${feature}`,
          content,
          priority: 60,
          condition: () => state.features[feature] === true,
        });
      }
    }
  }

  // Load project-level instructions from .dbcode/DBCODE.md
  const projectInstructions = options?.projectInstructions ?? loadProjectInstructions(cwd);
  if (projectInstructions) {
    sections.push({
      id: "project",
      content: `# Project Instructions\n\n${projectInstructions}`,
      priority: 70,
    });
  }

  // Auto-memory section: inject project memory between project instructions and extended thinking
  if (options?.autoMemoryContent) {
    sections.push({
      id: "auto-memory",
      content: `# Auto Memory\n\n${options.autoMemoryContent}`,
      priority: 72,
    });
  }

  if (options?.customSections) {
    sections.push(...options.customSections);
  }

  return assembleSections(sections, options?.totalTokenBudget);
}

/**
 * Build a mid-conversation system reminder for contextual guidance.
 * Use these to inject reminders between messages when patterns are detected.
 */
export function buildSystemReminder(
  type: "tool-usage" | "code-quality" | "git-safety" | "context-limit",
  context?: Readonly<Record<string, unknown>>,
): string {
  switch (type) {
    case "tool-usage":
      return [
        "<system-reminder>",
        "Remember: Use file_read before modifying files. Use file_edit for targeted changes.",
        "Call multiple independent tools in parallel for efficiency.",
        "Prefer grep_search and glob_search over reading entire directories.",
        "</system-reminder>",
      ].join("\n");

    case "code-quality":
      return [
        "<system-reminder>",
        "Code quality check: Ensure your changes are minimal and focused.",
        "Don't refactor surrounding code unless asked. Don't add unnecessary error handling.",
        "Follow the project's existing code style and conventions.",
        "</system-reminder>",
      ].join("\n");

    case "git-safety":
      return [
        "<system-reminder>",
        "Git safety: Never force push, reset --hard, or use destructive git operations without user confirmation.",
        "Review changes with git diff before committing. Use conventional commit format.",
        "</system-reminder>",
      ].join("\n");

    case "context-limit": {
      const usage = typeof context?.["usagePercent"] === "number" ? context["usagePercent"] : 0;
      return [
        "<system-reminder>",
        `Context window is ${Math.round(usage)}% full.`,
        "Be more concise. Avoid reading large files unnecessarily.",
        "Consider summarizing findings rather than quoting full content.",
        "</system-reminder>",
      ].join("\n");
    }
  }
}

/**
 * Assemble sections: filter by condition, sort by priority, enforce token budget.
 */
function assembleSections(sections: readonly PromptSection[], totalTokenBudget?: number): string {
  // Filter sections by condition
  const active = sections.filter((s) => !s.condition || s.condition());

  // Sort by priority (highest first)
  const sorted = [...active].sort((a, b) => b.priority - a.priority);

  // Apply per-section token budgets
  const budgeted = sorted.map((s) => {
    if (s.tokenBudget) {
      const tokens = estimateTokens(s.content);
      if (tokens > s.tokenBudget) {
        return { ...s, content: truncateToTokenBudget(s.content, s.tokenBudget) };
      }
    }
    return s;
  });

  // Enforce total token budget by trimming lowest-priority sections
  const budget = totalTokenBudget ?? DEFAULT_TOTAL_TOKEN_BUDGET;
  const included: PromptSection[] = [];
  let totalTokens = 0;

  for (const section of budgeted) {
    const sectionTokens = estimateTokens(section.content);
    if (totalTokens + sectionTokens <= budget) {
      included.push(section);
      totalTokens += sectionTokens;
    }
    // Skip sections that would exceed the budget (they're already sorted by priority,
    // so we try to fit as many high-priority sections as possible)
  }

  return included.map((s) => s.content).join("\n\n---\n\n");
}

/**
 * Truncate content to approximately fit within a token budget.
 * Cuts at line boundaries to preserve readability.
 */
function truncateToTokenBudget(content: string, budget: number): string {
  const lines = content.split("\n");
  const result: string[] = [];
  let tokens = 0;

  for (const line of lines) {
    const lineTokens = estimateTokens(line);
    if (tokens + lineTokens > budget) {
      result.push("...(truncated)");
      break;
    }
    result.push(line);
    tokens += lineTokens;
  }

  return result.join("\n");
}

/** Feature flag -> prompt section content mapping */
const FEATURE_SECTIONS: Readonly<Record<string, string>> = {
  "parallel-tools": [
    "# Parallel Tool Execution",
    "",
    "You can execute multiple tools in parallel when they are independent.",
    "Read-only tools (file_read, glob_search, grep_search, list_dir) are always safe to parallelize.",
    "File write operations on different paths can also run in parallel.",
    "Avoid parallel writes to the same file.",
  ].join("\n"),
  "auto-compact": [
    "# Auto-Compaction",
    "",
    "When the context window approaches capacity, the system will automatically compact",
    "older conversation turns into summaries. Focus on the most recent context.",
    "If you notice missing context from earlier in the conversation, ask the user.",
  ].join("\n"),
};

function buildPlanModeSection(): string {
  return `# Plan Mode

You are in PLAN mode. In this mode:
- Analyze the task thoroughly before proposing any changes.
- Present a structured implementation plan with clear steps.
- Identify risks, dependencies, and edge cases.
- Estimate complexity for each step (low/medium/high).
- Do NOT make any file modifications — only plan and discuss.
- Wait for user approval before switching to implementation.`;
}

function buildSubagentSection(subagentType?: "explore" | "plan" | "general"): string {
  const baseInstructions = [
    "# Subagent Context",
    "",
    "You are running as a subagent spawned by a parent agent.",
    "Your scope is limited to the specific task assigned to you.",
    "Report findings concisely — the parent agent will synthesize results.",
    "Do not ask the user questions directly; return your results to the parent.",
  ];

  switch (subagentType) {
    case "explore":
      baseInstructions.push(
        "",
        "## Exploration Focus",
        "Your role is to investigate the codebase and gather information.",
        "Use file reading, searching, and grep tools extensively.",
        "Provide a comprehensive summary of your findings.",
        "Focus on: file structure, key interfaces, dependencies, and patterns.",
      );
      break;
    case "plan":
      baseInstructions.push(
        "",
        "## Planning Focus",
        "Your role is to analyze requirements and create an implementation plan.",
        "Break down the task into clear, ordered steps.",
        "Identify dependencies between steps and estimate complexity.",
        "Consider edge cases and potential risks.",
      );
      break;
    case "general":
      baseInstructions.push(
        "",
        "## General Task",
        "Complete the assigned task using the available tools.",
        "Be thorough and report your results clearly.",
      );
      break;
  }

  return baseInstructions.join("\n");
}

function buildExtendedThinkingSection(): string {
  return `# Extended Thinking

Extended thinking is enabled. Use your internal reasoning to:
- Break down complex problems step by step.
- Consider multiple approaches before choosing one.
- Validate your reasoning against the code you've read.
- Think through edge cases and potential issues.
Do not narrate your thinking process — just produce better results.`;
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
function detectGitContext(cwd: string): {
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
  if (existsSync(join(cwd, "pyproject.toml")) || existsSync(join(cwd, "setup.py"))) return "Python";
  if (existsSync(join(cwd, "pom.xml")) || existsSync(join(cwd, "build.gradle"))) return "Java";
  if (existsSync(join(cwd, "Gemfile"))) return "Ruby";
  return null;
}

/** Load project instructions from DBCODE.md (root first, .dbcode/ fallback) */
function loadProjectInstructions(cwd: string): string | null {
  const paths = getProjectConfigPaths(cwd);

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

function buildMCPSection(servers: readonly { name: string; tools: readonly string[] }[]): string {
  const serverLines = servers.map((server) => {
    const toolList = server.tools.map((t) => `  - \`mcp__${server.name}__${t}\``).join("\n");
    return `### ${server.name}\n${toolList}`;
  });

  return `# MCP Servers

The following MCP servers are available. MCP tools are called using the \`mcp__{server}__{tool}\` format.

${serverLines.join("\n\n")}`;
}

function buildToolsSection(registry: ToolRegistry): string {
  const defs = registry.getDefinitionsForLLM();
  const lines = defs.map((d) => `- **${d.function.name}**: ${d.function.description}`);

  return `# Using your tools

You have tools for interacting with the codebase. Use the right tool for each task:

${lines.join("\n")}

## Tool usage guidelines

- Use **file_read** before modifying any file. Always read first.
- Use **file_edit** for targeted changes (search/replace). old_string must be unique.
- Use **file_write** only for new files or complete rewrites.
- Use **glob_search** to find files by pattern (e.g., \`**/*.ts\`).
- Use **grep_search** to find content by regex pattern.
- Use **bash_exec** for commands (build, test, git). Avoid destructive commands.
- Use **list_dir** to see directory structure before searching.
- You can call multiple independent tools in parallel for efficiency.
- For large outputs, prefer targeted searches over reading entire files.`;
}

function buildCotScaffoldingSection(): string {
  return `## Step-by-Step Approach
For each task, follow these steps:
1. THINK: What do I need to do?
2. LOOK: What files or information do I need?
3. PLAN: What tools should I use and in what order?
4. ACT: Execute one tool at a time
5. CHECK: Did the tool succeed? What's next?

Always explain your reasoning before using a tool.`;
}

function buildConventionsSection(): string {
  return `# Code quality

- Write clean, production-grade code. No stubs, no placeholders.
- Handle errors explicitly — no silent catches.
- Follow the project's existing code style and conventions.
- When fixing bugs, understand the root cause before applying a fix.
- When adding features, integrate naturally with existing architecture.
- Test your changes when a test framework is available.

## Git conventions

- Before committing, review changes with git diff.
- Never force push, reset --hard, or use destructive git operations without user confirmation.
- Use conventional commit format: feat(scope): description.`;
}

/** Map locale code to human-readable language name */
function localeToLanguageName(locale: string): string {
  const map: Record<string, string> = {
    ko: "Korean (한국어)",
    en: "English",
    ja: "Japanese (日本語)",
    zh: "Chinese (中文)",
    es: "Spanish (Español)",
    fr: "French (Français)",
    de: "German (Deutsch)",
  };
  return map[locale] ?? locale;
}

function buildLocaleSection(locale: string): string {
  const langName = localeToLanguageName(locale);
  return `# Response Language
Respond in ${langName}.
All explanations, comments, and documentation should be in ${langName}.
Code identifiers (variable names, function names) remain in English.`;
}
