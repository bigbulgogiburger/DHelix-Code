import { readFile, readdir, stat } from "node:fs/promises";
import { join, dirname } from "node:path";
import { homedir } from "node:os";
import { PROJECT_CONFIG_FILE, APP_NAME } from "../constants.js";
import { parseInstructions } from "./parser.js";
import { type PathRule, collectMatchingContent } from "./path-matcher.js";
import { BaseError } from "../utils/error.js";
import { matchPath } from "./path-matcher.js";

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
  /** Parent directory DBCODE.md files (walking up from cwd) */
  readonly parentInstructions: string;
  /** The project-level instruction content (from DBCODE.md) */
  readonly projectInstructions: string;
  /** Path-conditional rules content (.dbcode/rules/*.md) */
  readonly pathRules: string;
  /** Local override instructions (from DBCODE.local.md, gitignored) */
  readonly localInstructions: string;
  /** The combined instruction text for the system prompt */
  readonly combined: string;
}

/** Options for loading instructions */
export interface LoadInstructionsOptions {
  /** Glob patterns to exclude specific rule files */
  readonly excludePatterns?: readonly string[];
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
 * Check if a filename matches any of the exclude patterns.
 */
function isExcluded(fileName: string, excludePatterns: readonly string[]): boolean {
  if (excludePatterns.length === 0) return false;
  return excludePatterns.some((pattern) => matchPath(fileName, pattern));
}

/**
 * Find the project root by searching upward for DBCODE.md or .dbcode/ directory.
 *
 * Detection order per directory (first match wins):
 * 1. DBCODE.md at directory root (primary convention)
 * 2. .dbcode/DBCODE.md (backward compatible fallback)
 * 3. .dbcode/ directory exists (project indicator even without DBCODE.md)
 *
 * Returns the directory that qualifies as the project root, or null if not found.
 */
async function findProjectRoot(startDir: string): Promise<string | null> {
  let current = startDir;
  const root = dirname(current) === current ? current : undefined;

  while (true) {
    // 1. Check for DBCODE.md at root (primary)
    const rootConfigPath = join(current, PROJECT_CONFIG_FILE);
    try {
      await stat(rootConfigPath);
      return current;
    } catch {
      // Not found at root, try fallback
    }

    // 2. Check for .dbcode/DBCODE.md (backward compatible)
    const fallbackConfigPath = join(current, `.${APP_NAME}`, PROJECT_CONFIG_FILE);
    try {
      await stat(fallbackConfigPath);
      return current;
    } catch {
      // Not found in .dbcode/ either
    }

    // 3. Check for .dbcode/ directory (project indicator)
    const configDir = join(current, `.${APP_NAME}`);
    try {
      const dirStat = await stat(configDir);
      if (dirStat.isDirectory()) {
        return current;
      }
    } catch {
      // No .dbcode/ directory
    }

    const parent = dirname(current);
    if (parent === current || parent === root) {
      return null;
    }
    current = parent;
  }
}

/**
 * Walk up from startDir to filesystem root, collecting DBCODE.md files
 * from parent directories (excluding the project root itself, which is
 * loaded separately as projectInstructions).
 *
 * Returns contents ordered from farthest ancestor to closest parent
 * (lowest to highest priority).
 */
async function loadParentInstructions(
  startDir: string,
  projectRoot: string | null,
  excludePatterns: readonly string[],
): Promise<string> {
  if (isExcluded(PROJECT_CONFIG_FILE, excludePatterns)) return "";

  const parentContents: string[] = [];
  let current = dirname(startDir);

  while (true) {
    // Stop if we've reached the project root (it's loaded separately)
    if (projectRoot && current === projectRoot) break;

    const parent = dirname(current);
    if (parent === current) break; // filesystem root

    const configPath = join(current, PROJECT_CONFIG_FILE);
    const content = await safeReadFile(configPath);
    if (content) {
      const parsed = await parseInstructions(content, current);
      if (parsed) {
        parentContents.unshift(parsed); // prepend so ancestors come first
      }
    }

    current = parent;
  }

  return parentContents.filter(Boolean).join("\n\n");
}

/**
 * Load path-based rules from a rules directory (*.md files).
 */
async function loadPathRules(
  rulesDir: string,
  excludePatterns: readonly string[] = [],
): Promise<readonly PathRule[]> {
  try {
    const entries = await readdir(rulesDir);
    const rules: PathRule[] = [];

    for (const entry of entries) {
      if (!entry.endsWith(".md")) continue;
      if (isExcluded(entry, excludePatterns)) continue;

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
 * Instruction loader — loads instructions from multiple layers with proper hierarchy.
 *
 * Merge order (lowest → highest priority):
 * 1. Global user instructions (~/.dbcode/DBCODE.md)
 * 2. Global user rules (~/.dbcode/rules/*.md)
 * 3. Parent directory DBCODE.md files (walking up from cwd, farthest first)
 * 4. Project instructions (DBCODE.md or .dbcode/DBCODE.md found by searching upward)
 * 5. Project path-conditional rules (.dbcode/rules/*.md)
 * 6. Local override instructions (DBCODE.local.md in project root)
 *
 * Layers are joined with '\n\n---\n\n'.
 */
export async function loadInstructions(
  workingDirectory: string,
  options?: LoadInstructionsOptions,
): Promise<LoadedInstructions> {
  const excludePatterns = options?.excludePatterns ?? [];
  const globalDir = join(homedir(), `.${APP_NAME}`);

  // 1. Global user instructions (~/.dbcode/DBCODE.md)
  let globalInstructions = "";
  if (!isExcluded(PROJECT_CONFIG_FILE, excludePatterns)) {
    const globalConfigPath = join(globalDir, PROJECT_CONFIG_FILE);
    const globalRaw = await safeReadFile(globalConfigPath);
    globalInstructions = globalRaw ? await parseInstructions(globalRaw, globalDir) : "";
  }

  // 2. Global user rules (~/.dbcode/rules/*.md)
  const globalRulesDir = join(globalDir, "rules");
  const globalPathRules = await loadPathRules(globalRulesDir, excludePatterns);
  const globalRules = collectMatchingContent(globalPathRules, workingDirectory);

  // 3. Project-level instructions (DBCODE.md found by searching upward)
  const projectRoot = await findProjectRoot(workingDirectory);

  // 3a. Parent directory DBCODE.md files (between cwd and project root)
  const parentInstructions = await loadParentInstructions(
    workingDirectory,
    projectRoot,
    excludePatterns,
  );

  // 3b. Project root DBCODE.md (with .dbcode/DBCODE.md fallback)
  let projectInstructions = "";
  if (projectRoot && !isExcluded(PROJECT_CONFIG_FILE, excludePatterns)) {
    // Primary: DBCODE.md at project root
    const rootConfigPath = join(projectRoot, PROJECT_CONFIG_FILE);
    let rawContent = await safeReadFile(rootConfigPath);

    // Fallback: .dbcode/DBCODE.md (backward compatible)
    if (!rawContent) {
      const fallbackPath = join(projectRoot, `.${APP_NAME}`, PROJECT_CONFIG_FILE);
      rawContent = await safeReadFile(fallbackPath);
    }

    if (rawContent) {
      projectInstructions = await parseInstructions(rawContent, projectRoot);
    }
  }

  // 4. Project path-conditional rules (.dbcode/rules/*.md)
  const configDir = join(workingDirectory, `.${APP_NAME}`);
  const rulesDir = join(configDir, "rules");
  const pathRules = await loadPathRules(rulesDir, excludePatterns);
  let pathRulesContent = collectMatchingContent(pathRules, workingDirectory);

  if (projectRoot) {
    const projectRulesDir = join(projectRoot, `.${APP_NAME}`, "rules");
    const projectRules = await loadPathRules(projectRulesDir, excludePatterns);
    const projectPathRulesContent = collectMatchingContent(projectRules, workingDirectory);
    pathRulesContent = [pathRulesContent, projectPathRulesContent].filter(Boolean).join("\n\n");
  }

  // 5. Local override instructions (DBCODE.local.md)
  let localInstructions = "";
  if (projectRoot) {
    const localFileName = `${APP_NAME.toUpperCase()}.local.md`;
    if (!isExcluded(localFileName, excludePatterns)) {
      const localPath = join(projectRoot, localFileName);
      const localRaw = await safeReadFile(localPath);
      if (localRaw) {
        localInstructions = await parseInstructions(localRaw, projectRoot);
      }
    }
  }

  // Build combined instructions in merge order
  const parts = [
    globalInstructions,
    globalRules,
    parentInstructions,
    projectInstructions,
    pathRulesContent,
    localInstructions,
  ].filter(Boolean);

  return {
    globalInstructions,
    globalRules,
    parentInstructions,
    projectInstructions,
    pathRules: pathRulesContent,
    localInstructions,
    combined: parts.join("\n\n---\n\n"),
  };
}
