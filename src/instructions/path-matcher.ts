/**
 * Path-based conditional rule matching.
 * Determines which instruction rules to load based on the current working directory
 * or file paths being operated on.
 */

/** A path-based rule condition (multi-glob) */
export interface PathRule {
  /** Glob patterns to match against paths (matches if ANY pattern matches) */
  readonly patterns: readonly string[];
  /** Content to include when pattern matches */
  readonly content: string;
  /** Optional description for the rule */
  readonly description?: string;
}

/**
 * @deprecated Use PathRule with `patterns` array instead.
 * Kept for backward compatibility with code that constructs rules with a single pattern.
 */
export interface LegacyPathRule {
  /** Single glob pattern to match against paths */
  readonly pattern: string;
  /** Content to include when pattern matches */
  readonly content: string;
  /** Optional description for the rule */
  readonly description?: string;
}

/** Convert a legacy single-pattern rule to the multi-pattern format */
export function normalizeLegacyRule(rule: LegacyPathRule): PathRule {
  return {
    patterns: [rule.pattern],
    content: rule.content,
    description: rule.description,
  };
}

/**
 * Simple glob-to-regex converter for path matching.
 * Supports `*` (any chars except `/`) and `**` (any chars including `/`).
 */
function globToRegex(pattern: string): RegExp {
  const normalized = pattern.replace(/\\/g, "/");
  let regex = "";
  let i = 0;

  while (i < normalized.length) {
    const char = normalized[i];

    if (char === "*") {
      if (normalized[i + 1] === "*") {
        // ** matches everything including /
        regex += ".*";
        i += 2;
        // Skip trailing /
        if (normalized[i] === "/") i++;
        continue;
      }
      // * matches everything except /
      regex += "[^/]*";
      i++;
      continue;
    }

    if (char === "?") {
      regex += "[^/]";
      i++;
      continue;
    }

    if (char === ".") {
      regex += "\\.";
      i++;
      continue;
    }

    regex += char;
    i++;
  }

  return new RegExp(`^${regex}$`, "i");
}

/**
 * Check if a path matches a glob pattern.
 */
export function matchPath(path: string, pattern: string): boolean {
  const normalized = path.replace(/\\/g, "/");
  const regex = globToRegex(pattern);
  return regex.test(normalized);
}

/**
 * Check if a path matches ANY of the given glob patterns.
 */
export function matchAnyPattern(path: string, patterns: readonly string[]): boolean {
  return patterns.some((pattern) => matchPath(path, pattern));
}

/**
 * Filter path rules that match the given path.
 * A rule matches if ANY of its patterns match.
 */
export function filterMatchingRules(
  rules: readonly PathRule[],
  currentPath: string,
): readonly PathRule[] {
  return rules.filter((rule) => matchAnyPattern(currentPath, rule.patterns));
}

/**
 * Collect content from all matching path rules.
 */
export function collectMatchingContent(rules: readonly PathRule[], currentPath: string): string {
  const matching = filterMatchingRules(rules, currentPath);
  if (matching.length === 0) return "";
  return matching.map((r) => r.content).join("\n\n");
}
