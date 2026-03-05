import { type PermissionRule } from "./types.js";

/**
 * Match a value against a glob-like pattern.
 * Supports * (any chars) and ? (single char).
 */
function matchPattern(value: string, pattern: string): boolean {
  const regex = pattern
    .replace(/[.+^${}()|[\]\\]/g, "\\$&")
    .replace(/\*/g, ".*")
    .replace(/\?/g, ".");
  return new RegExp(`^${regex}$`).test(value);
}

/**
 * Check if a tool call matches any permission rule.
 * Returns the first matching rule, or undefined if no match.
 */
export function findMatchingRule(
  rules: readonly PermissionRule[],
  toolName: string,
  args?: Readonly<Record<string, unknown>>,
): PermissionRule | undefined {
  for (const rule of rules) {
    if (matchPattern(toolName, rule.toolName)) {
      if (rule.pattern && args) {
        // Check if any string argument matches the pattern
        const argValues = Object.values(args).filter((v): v is string => typeof v === "string");
        if (argValues.some((v) => matchPattern(v, rule.pattern!))) {
          return rule;
        }
      } else {
        return rule;
      }
    }
  }
  return undefined;
}
