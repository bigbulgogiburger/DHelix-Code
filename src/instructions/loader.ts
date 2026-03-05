import { readFile, readdir, stat } from "node:fs/promises";
import { join, dirname } from "node:path";
import { PROJECT_CONFIG_FILE, APP_NAME } from "../constants.js";
import { parseInstructions } from "./parser.js";
import { type PathRule, collectMatchingContent } from "./path-matcher.js";
import { BaseError } from "../utils/error.js";

/** Instruction loading error */
export class InstructionLoadError extends BaseError {
  constructor(message: string, context: Record<string, unknown> = {}) {
    super(message, "INSTRUCTION_LOAD_ERROR", context);
  }
}

/** Loaded instruction result */
export interface LoadedInstructions {
  /** The project-level instruction content (from DBCODE.md) */
  readonly projectInstructions: string;
  /** Path-conditional rules content */
  readonly pathRules: string;
  /** The combined instruction text for the system prompt */
  readonly combined: string;
}

/**
 * Read a file safely, returning empty string if not found.
 */
async function safeReadFile(filePath: string): Promise<string> {
  try {
    return await readFile(filePath, "utf-8");
  } catch {
    return "";
  }
}

/**
 * Find the project root by searching upward for DBCODE.md.
 * Returns the directory containing DBCODE.md, or null if not found.
 */
async function findProjectRoot(startDir: string): Promise<string | null> {
  let current = startDir;
  const root = dirname(current) === current ? current : undefined;

  while (true) {
    const configPath = join(current, PROJECT_CONFIG_FILE);
    try {
      await stat(configPath);
      return current;
    } catch {
      const parent = dirname(current);
      if (parent === current || parent === root) {
        return null;
      }
      current = parent;
    }
  }
}

/**
 * Load path-based rules from the .dbcode/rules/ directory.
 */
async function loadPathRules(rulesDir: string): Promise<readonly PathRule[]> {
  try {
    const entries = await readdir(rulesDir);
    const rules: PathRule[] = [];

    for (const entry of entries) {
      if (!entry.endsWith(".md")) continue;
      const filePath = join(rulesDir, entry);
      const fileStat = await stat(filePath);
      if (!fileStat.isFile()) continue;

      const content = await readFile(filePath, "utf-8");

      // Extract optional frontmatter pattern
      const patternMatch = content.match(/^---\s*\npattern:\s*"?([^"\n]+)"?\s*\n---/);
      const pattern = patternMatch ? patternMatch[1] : "**";
      const ruleContent = patternMatch ? content.slice(patternMatch[0].length).trim() : content;

      rules.push({
        pattern,
        content: ruleContent,
        description: entry.replace(/\.md$/, ""),
      });
    }

    return rules;
  } catch {
    return [];
  }
}

/**
 * Instruction loader — loads project instructions from DBCODE.md and .dbcode/rules/.
 *
 * Loading order:
 * 1. Find project root (search upward for DBCODE.md)
 * 2. Load DBCODE.md content (resolve @import directives)
 * 3. Load .dbcode/rules/*.md path-conditional rules
 * 4. Filter rules by current working directory
 * 5. Combine into final instruction text
 */
export async function loadInstructions(workingDirectory: string): Promise<LoadedInstructions> {
  // Find project root
  const projectRoot = await findProjectRoot(workingDirectory);

  // Load project-level instructions (DBCODE.md)
  let projectInstructions = "";
  if (projectRoot) {
    const configPath = join(projectRoot, PROJECT_CONFIG_FILE);
    const rawContent = await safeReadFile(configPath);
    if (rawContent) {
      projectInstructions = await parseInstructions(rawContent, projectRoot);
    }
  }

  // Load path-conditional rules
  const configDir = join(workingDirectory, `.${APP_NAME}`);
  const rulesDir = join(configDir, "rules");
  const pathRules = await loadPathRules(rulesDir);
  const pathRulesContent = collectMatchingContent(pathRules, workingDirectory);

  // Also check project-level rules
  let projectPathRulesContent = "";
  if (projectRoot) {
    const projectRulesDir = join(projectRoot, `.${APP_NAME}`, "rules");
    const projectRules = await loadPathRules(projectRulesDir);
    projectPathRulesContent = collectMatchingContent(projectRules, workingDirectory);
  }

  // Combine all rules content
  const allPathRules = [pathRulesContent, projectPathRulesContent].filter(Boolean).join("\n\n");

  // Build combined instructions
  const parts: string[] = [];
  if (projectInstructions) {
    parts.push(projectInstructions);
  }
  if (allPathRules) {
    parts.push(allPathRules);
  }

  return {
    projectInstructions,
    pathRules: allPathRules,
    combined: parts.join("\n\n---\n\n"),
  };
}
