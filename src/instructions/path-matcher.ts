/**
 * Path-based conditional rule matching.
 * Determines which instruction rules to load based on the current working directory
 * or file paths being operated on.
 */

/** A path-based rule condition */
export interface PathRule {
  /** Glob pattern to match against paths */
  readonly pattern: string;
  /** Content to include when pattern matches */
  readonly content: string;
  /** Optional description for the rule */
  readonly description?: string;
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
 * Filter path rules that match the given path.
 */
export function filterMatchingRules(
  rules: readonly PathRule[],
  currentPath: string,
): readonly PathRule[] {
  return rules.filter((rule) => matchPath(currentPath, rule.pattern));
}

/**
 * Collect content from all matching path rules.
 */
export function collectMatchingContent(rules: readonly PathRule[], currentPath: string): string {
  const matching = filterMatchingRules(rules, currentPath);
  if (matching.length === 0) return "";
  return matching.map((r) => r.content).join("\n\n");
}
