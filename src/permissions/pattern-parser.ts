import { BaseError } from "../utils/error.js";

/**
 * Error thrown when a permission pattern string is malformed.
 */
export class PatternParseError extends BaseError {
  constructor(message: string, context: Record<string, unknown> = {}) {
    super(message, "PATTERN_PARSE_ERROR", context);
  }
}

/**
 * Parsed permission pattern.
 *
 * Formats:
 *   - `ToolName`          — matches any call to the tool
 *   - `ToolName(argGlob)` — matches calls whose string arguments match the glob
 */
export interface ParsedPermissionPattern {
  readonly toolName: string;
  readonly argPattern: string | undefined;
}

/**
 * Parse a permission pattern string into its structured form.
 *
 * Examples:
 *   "Bash"             → { toolName: "Bash", argPattern: undefined }
 *   "Bash(npm *)"      → { toolName: "Bash", argPattern: "npm *" }
 *   "Edit(/src/**)"    → { toolName: "Edit", argPattern: "/src/**" }
 *   "file_read"        → { toolName: "file_read", argPattern: undefined }
 */
export function parsePermissionPattern(raw: string): ParsedPermissionPattern {
  const trimmed = raw.trim();
  if (trimmed.length === 0) {
    throw new PatternParseError("Empty permission pattern", { raw });
  }

  const parenOpen = trimmed.indexOf("(");

  // No parentheses — tool name only
  if (parenOpen === -1) {
    if (trimmed.includes(")")) {
      throw new PatternParseError("Unmatched closing parenthesis in pattern", { raw });
    }
    return { toolName: trimmed, argPattern: undefined };
  }

  // Must end with closing paren
  if (!trimmed.endsWith(")")) {
    throw new PatternParseError("Pattern has opening parenthesis but no closing parenthesis", {
      raw,
    });
  }

  const toolName = trimmed.slice(0, parenOpen).trim();
  if (toolName.length === 0) {
    throw new PatternParseError("Empty tool name in pattern", { raw });
  }

  const argPattern = trimmed.slice(parenOpen + 1, -1).trim();
  if (argPattern.length === 0) {
    throw new PatternParseError("Empty argument pattern in parentheses", { raw });
  }

  return { toolName, argPattern };
}

/**
 * Convert a glob pattern to a RegExp.
 * Consistent with rules.ts matchPattern behavior:
 *   - `*`  — matches any characters (including `/`)
 *   - `?`  — matches a single character
 */
function globToRegex(pattern: string): RegExp {
  const escaped = pattern
    .replace(/[.+^${}()|[\]\\]/g, "\\$&")
    .replace(/\*/g, ".*")
    .replace(/\?/g, ".");
  return new RegExp(`^${escaped}$`);
}

/**
 * Check whether a tool call matches a parsed permission pattern.
 *
 * @param pattern  — parsed permission pattern
 * @param toolName — name of the tool being invoked
 * @param args     — optional tool arguments (string values are checked against argPattern)
 * @returns true if the pattern matches the tool call
 */
export function matchesPermissionPattern(
  pattern: ParsedPermissionPattern,
  toolName: string,
  args?: Readonly<Record<string, unknown>>,
): boolean {
  // 1. Tool name must match (glob)
  if (!globToRegex(pattern.toolName).test(toolName)) {
    return false;
  }

  // 2. If no argPattern, any invocation of the tool matches
  if (pattern.argPattern === undefined) {
    return true;
  }

  // 3. argPattern present — at least one string argument must match
  if (!args) {
    return false;
  }

  const argRegex = globToRegex(pattern.argPattern);
  const stringValues = Object.values(args).filter((v): v is string => typeof v === "string");

  return stringValues.some((v) => argRegex.test(v));
}
