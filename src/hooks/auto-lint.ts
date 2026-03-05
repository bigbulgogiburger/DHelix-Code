import { type HookRunner } from "./runner.js";
import { type ToolCallResult } from "../tools/types.js";
import { type AppEventEmitter } from "../utils/events.js";

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
