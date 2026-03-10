import { type HookRunner } from "./runner.js";
import { type ToolCallResult } from "../tools/types.js";
import { type AppEventEmitter } from "../utils/events.js";
import { type HookRule, type CommandHookHandler } from "./types.js";

/**
 * Tools that modify files and should trigger auto-lint.
 */
const FILE_MUTATING_TOOLS = new Set(["file_write", "file_edit"]);

/**
 * Linter configuration for auto-lint feedback loop.
 */
export interface AutoLintConfig {
  /** Enable auto-lint on file mutations (default: true) */
  readonly enabled: boolean;
  /** Lint command to run (default: "npx eslint --no-warn-ignored") */
  readonly lintCommand: string;
  /** Test command to run (default: none) */
  readonly testCommand?: string;
  /** Max auto-fix iterations to prevent infinite loops (default: 3) */
  readonly maxIterations: number;
}

/** Default auto-lint configuration */
export const DEFAULT_AUTO_LINT_CONFIG: AutoLintConfig = {
  enabled: true,
  lintCommand: "npx eslint --no-warn-ignored",
  maxIterations: 3,
};

/**
 * Result of an auto-lint check.
 */
export interface AutoLintResult {
  readonly filePath: string;
  readonly lintOutput: string;
  readonly hasErrors: boolean;
  readonly testOutput?: string;
  readonly testFailed?: boolean;
}

/**
 * Build a lint feedback message to inject into conversation.
 * Returns null if no errors detected.
 */
export function buildLintFeedback(results: readonly AutoLintResult[]): string | null {
  const errors = results.filter((r) => r.hasErrors || r.testFailed);
  if (errors.length === 0) return null;

  const lines: string[] = ["Auto-lint detected issues in files you just modified:", ""];

  for (const result of errors) {
    if (result.hasErrors) {
      lines.push(`## Lint errors in ${result.filePath}:`);
      lines.push("```");
      lines.push(result.lintOutput);
      lines.push("```");
      lines.push("");
    }
    if (result.testFailed && result.testOutput) {
      lines.push(`## Test failures after editing ${result.filePath}:`);
      lines.push("```");
      lines.push(result.testOutput);
      lines.push("```");
      lines.push("");
    }
  }

  lines.push("Please fix these issues before continuing.");

  return lines.join("\n");
}

/**
 * Extract file paths from tool results for file-mutating operations.
 */
export function extractMutatedFiles(toolName: string, toolResult: ToolCallResult): string | null {
  if (!FILE_MUTATING_TOOLS.has(toolName)) return null;
  if (toolResult.isError) return null;

  // Extract path from output (tools typically output the path they wrote to)
  const output = toolResult.output;
  const pathMatch = output.match(/(?:wrote|created|edited|modified)\s+(.+?)(?:\s|$)/i);
  if (pathMatch) return pathMatch[1];

  // Fallback: try to find a file path pattern in output
  const fileMatch = output.match(/([^\s]+\.[a-zA-Z]{1,10})/);
  return fileMatch ? fileMatch[1] : null;
}

/**
 * Register auto-lint as a PostToolUse handler on the event bus.
 * This hooks into tool:complete events and triggers lint checks.
 */
export function registerAutoLint(
  events: AppEventEmitter,
  _hookRunner: HookRunner,
  config: AutoLintConfig = DEFAULT_AUTO_LINT_CONFIG,
): void {
  if (!config.enabled) return;

  events.on("tool:complete", (payload) => {
    // Only trigger for file-mutating tools that succeeded
    if (!FILE_MUTATING_TOOLS.has(payload.name)) return;
    if (payload.isError) return;

    // Emit event for the CLI layer to pick up and run the lint command
    events.emit("lint:request", {
      toolName: payload.name,
      toolId: payload.id,
      lintCommand: config.lintCommand,
      testCommand: config.testCommand,
    });
  });
}

/**
 * Configuration for auto-lint hook rule creation.
 */
export interface AutoLintHookRuleConfig {
  /** Whether the linter hook is enabled (default: true) */
  readonly enabled: boolean;
  /** Override the default linter command for a given extension */
  readonly linterOverride?: string;
}

/** Default linter commands mapped by file extension */
const DEFAULT_LINTERS: Readonly<Record<string, string>> = {
  ".ts": "npx eslint --fix $FILE_PATH",
  ".tsx": "npx eslint --fix $FILE_PATH",
  ".js": "npx eslint --fix $FILE_PATH",
  ".jsx": "npx eslint --fix $FILE_PATH",
  ".py": "ruff check --fix $FILE_PATH || black $FILE_PATH",
  ".go": "gofmt -w $FILE_PATH",
  ".rs": "rustfmt $FILE_PATH",
};

/** Prettier as a fallback formatter for JS/TS family */
const PRETTIER_EXTENSIONS = new Set([".ts", ".tsx", ".js", ".jsx"]);

/**
 * Resolve the linter command for a given file extension.
 * Uses the override if provided, otherwise falls back to the default linter.
 * Returns null for unsupported extensions.
 */
function resolveLinterCommand(
  fileExtension: string,
  config?: AutoLintHookRuleConfig,
): string | null {
  if (config?.linterOverride) {
    return config.linterOverride;
  }

  const defaultCommand = DEFAULT_LINTERS[fileExtension];
  if (defaultCommand) return defaultCommand;

  // Fallback to prettier for JS/TS family extensions
  if (PRETTIER_EXTENSIONS.has(fileExtension)) {
    return `npx prettier --write $FILE_PATH`;
  }

  return null;
}

/**
 * Create a PostToolUse hook rule that runs the appropriate linter based on file extension.
 *
 * Supported extensions and default linters:
 *   .ts/.tsx/.js/.jsx → eslint --fix (or prettier as fallback)
 *   .py → ruff check --fix || black
 *   .go → gofmt -w
 *   .rs → rustfmt
 *
 * The returned HookRule matches file_edit and file_write tools and uses
 * the command handler mechanism to run the linter.
 *
 * @param fileExtension - The file extension to lint (e.g., ".ts", ".py")
 * @param config - Optional configuration to enable/disable or override linter
 * @returns A HookRule configured for the given extension, or null if the extension is unsupported or disabled
 */
export function createAutoLintHookRule(
  fileExtension: string,
  config: AutoLintHookRuleConfig = { enabled: true },
): HookRule | null {
  if (!config.enabled) return null;

  const normalizedExt = fileExtension.startsWith(".") ? fileExtension : `.${fileExtension}`;
  const linterCommand = resolveLinterCommand(normalizedExt, config);

  if (!linterCommand) return null;

  const handler: CommandHookHandler = {
    type: "command",
    command: linterCommand,
    timeoutMs: 30_000,
    blocking: false,
  };

  return {
    matcher: "file_edit|file_write",
    hooks: [handler],
  };
}
