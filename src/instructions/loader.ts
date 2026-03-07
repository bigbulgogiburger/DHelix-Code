import { readFile, readdir, stat } from "node:fs/promises";
import { join, dirname } from "node:path";
import { homedir } from "node:os";
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
  /** Global user instructions (from ~/.dbcode/DBCODE.md) */
  readonly globalInstructions: string;
  /** Global user rules (from ~/.dbcode/rules/*.md) */
  readonly globalRules: string;
  /** The project-level instruction content (from DBCODE.md) */
  readonly projectInstructions: string;
  /** Path-conditional rules content */
  readonly pathRules: string;
  /** Local override instructions (from DBCODE.local.md, gitignored) */
  readonly localInstructions: string;
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
 * Instruction loader — loads instructions from multiple layers.
 *
 * Merge order (lowest → highest priority):
 * 1. Global user instructions (~/.dbcode/DBCODE.md)
 * 2. Global user rules (~/.dbcode/rules/*.md)
 * 3. Project instructions (DBCODE.md found by searching upward)
 * 4. Project path-conditional rules (.dbcode/rules/*.md)
 * 5. Local override instructions (DBCODE.local.md in project root)
 *
 * Layers are joined with '\n\n---\n\n'.
 */
export async function loadInstructions(workingDirectory: string): Promise<LoadedInstructions> {
  const globalDir = join(homedir(), `.${APP_NAME}`);

  // 1. Global user instructions (~/.dbcode/DBCODE.md)
  const globalConfigPath = join(globalDir, PROJECT_CONFIG_FILE);
  const globalRaw = await safeReadFile(globalConfigPath);
  const globalInstructions = globalRaw ? await parseInstructions(globalRaw, globalDir) : "";

  // 2. Global user rules (~/.dbcode/rules/*.md)
  const globalRulesDir = join(globalDir, "rules");
  const globalPathRules = await loadPathRules(globalRulesDir);
  const globalRules = collectMatchingContent(globalPathRules, workingDirectory);

  // 3. Project-level instructions (DBCODE.md)
  const projectRoot = await findProjectRoot(workingDirectory);
  let projectInstructions = "";
  if (projectRoot) {
    const configPath = join(projectRoot, PROJECT_CONFIG_FILE);
    const rawContent = await safeReadFile(configPath);
    if (rawContent) {
      projectInstructions = await parseInstructions(rawContent, projectRoot);
    }
  }

  // 4. Project path-conditional rules
  const configDir = join(workingDirectory, `.${APP_NAME}`);
  const rulesDir = join(configDir, "rules");
  const pathRules = await loadPathRules(rulesDir);
  let pathRulesContent = collectMatchingContent(pathRules, workingDirectory);

  if (projectRoot) {
    const projectRulesDir = join(projectRoot, `.${APP_NAME}`, "rules");
    const projectRules = await loadPathRules(projectRulesDir);
    const projectPathRulesContent = collectMatchingContent(projectRules, workingDirectory);
    pathRulesContent = [pathRulesContent, projectPathRulesContent].filter(Boolean).join("\n\n");
  }

  // 5. Local override instructions (DBCODE.local.md)
  let localInstructions = "";
  if (projectRoot) {
    const localPath = join(projectRoot, `${APP_NAME.toUpperCase()}.local.md`);
    const localRaw = await safeReadFile(localPath);
    if (localRaw) {
      localInstructions = await parseInstructions(localRaw, projectRoot);
    }
  }

  // Build combined instructions in merge order
  const parts = [
    globalInstructions,
    globalRules,
    projectInstructions,
    pathRulesContent,
    localInstructions,
  ].filter(Boolean);

  return {
    globalInstructions,
    globalRules,
    projectInstructions,
    pathRules: pathRulesContent,
    localInstructions,
    combined: parts.join("\n\n---\n\n"),
  };
}
