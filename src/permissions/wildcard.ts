import { isWindows } from "../utils/platform.js";

/**
 * Match a value against a wildcard pattern.
 *
 * Pattern rules:
 *   - `*`  matches any sequence of characters (non-greedy within path segments)
 *   - `**` matches any sequence including path separators
 *   - `?`  matches exactly one character
 *   - Literal characters match themselves
 *   - Case-insensitive on Windows, case-sensitive elsewhere
 *   - Patterns are anchored (must match the entire string)
 */
export function matchWildcard(value: string, pattern: string): boolean {
  const flags = isWindows() ? "i" : "";

  // Build regex from pattern:
  // 1. Escape regex special chars (except * and ?)
  // 2. Replace ** with a placeholder, then * with [^/\\]*, then restore ** as .*
  // 3. Replace ? with single-char matcher (not path sep)
  const escaped = pattern.replace(/[.+^${}()|[\]\\]/g, "\\$&");

  // Replace ** first (greedy path-crossing match)
  const withDoubleStar = escaped.replace(/\*\*/g, "\0DOUBLESTAR\0");

  // Replace remaining single * (non-path-crossing)
  const withSingleStar = withDoubleStar.replace(/\*/g, "[^/\\\\]*");

  // Restore ** as .* (matches everything including separators)
  const withBothStars = withSingleStar.replace(/\0DOUBLESTAR\0/g, ".*");

  // Replace ? with single non-separator char
  const final = withBothStars.replace(/\?/g, "[^/\\\\]");

  const regex = new RegExp(`^${final}$`, flags);
  return regex.test(value);
}

/**
 * Parse a rule string like "Bash(npm *)" into { tool, pattern }.
 *
 * Formats:
 *   - `"file_read"`       → { tool: "file_read", pattern: undefined }
 *   - `"Bash(npm *)"`     → { tool: "Bash", pattern: "npm *" }
 *   - `"Edit(/src/**)"`   → { tool: "Edit", pattern: "/src/**" }
 */
export function parseRuleString(rule: string): {
  readonly tool: string;
  readonly pattern: string | undefined;
} {
  const match = rule.match(/^([^(]+)\((.+)\)$/);
  if (match) {
    return Object.freeze({
      tool: match[1].trim(),
      pattern: match[2].trim(),
    });
  }
  return Object.freeze({
    tool: rule.trim(),
    pattern: undefined,
  });
}

/**
 * Format a tool name and optional pattern back to a rule string.
 *
 *   formatRuleString("Bash", "npm *")  → "Bash(npm *)"
 *   formatRuleString("file_read")      → "file_read"
 */
export function formatRuleString(tool: string, pattern?: string): string {
  if (pattern !== undefined && pattern !== "") {
    return `${tool}(${pattern})`;
  }
  return tool;
}

/**
 * Arg key mapping per tool.
 * Determines which argument field to compare against the pattern.
 */
const TOOL_ARG_KEYS: Readonly<Record<string, string>> = Object.freeze({
  Bash: "command",
  bash_exec: "command",
  Edit: "file_path",
  file_edit: "file_path",
  Write: "file_path",
  file_write: "file_path",
  Read: "file_path",
  file_read: "file_path",
  glob_search: "pattern",
  grep_search: "pattern",
});

/**
 * Match tool arguments against a wildcard pattern.
 *
 * Extracts the relevant arg value based on the tool name:
 *   - Bash / bash_exec  → `command`
 *   - Edit / file_edit  → `file_path`
 *   - Write / file_write → `file_path`
 *   - Read / file_read  → `file_path`
 *
 * Falls back to matching any string argument if the tool is not in the known map.
 */
export function matchToolArgs(
  tool: string,
  pattern: string,
  args?: Record<string, unknown>,
): boolean {
  if (!args) {
    return false;
  }

  const argKey = TOOL_ARG_KEYS[tool];

  if (argKey && argKey in args) {
    const value = args[argKey];
    if (typeof value === "string") {
      return matchWildcard(value, pattern);
    }
    return false;
  }

  // Fallback: try matching against any string argument value
  const stringValues = Object.values(args).filter((v): v is string => typeof v === "string");
  return stringValues.some((v) => matchWildcard(v, pattern));
}
