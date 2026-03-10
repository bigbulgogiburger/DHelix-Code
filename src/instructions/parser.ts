import { readFile, realpath } from "node:fs/promises";
import { dirname, resolve, extname } from "node:path";
import { BaseError } from "../utils/error.js";

/** Instruction parsing error */
export class InstructionParseError extends BaseError {
  constructor(message: string, context: Record<string, unknown> = {}) {
    super(message, "INSTRUCTION_PARSE_ERROR", context);
  }
}

/**
 * Regex to match @import directives in instruction files.
 *
 * Supported formats:
 * - `@import "./relative/path.md"`
 * - `@import "./relative/path.md"  # optional comment`
 */
const IMPORT_PATTERN = /^@import\s+"([^"]+)"\s*(?:#.*)?$/gm;

/**
 * Regex to match @path shorthand import syntax in instruction files.
 *
 * Supported formats:
 * - `@./relative/path.md`
 * - `@../parent/path.md`
 * - `@/absolute/path.md`
 *
 * The path must start with `.`, `..`, or `/` to distinguish from @mentions.
 * Only lines where `@` is immediately followed by a path character are matched.
 */
const SHORTHAND_IMPORT_PATTERN = /^@(\.{1,2}\/[^\s]+|\/[^\s]+)$/gm;

/** Maximum import depth to prevent infinite recursion */
const MAX_IMPORT_DEPTH = 5;

/**
 * Parse @import directives from instruction file content.
 * Returns the list of import paths found (both @import "path" and @path formats).
 */
export function extractImports(content: string): readonly string[] {
  const imports: string[] = [];

  // Match @import "path" syntax
  const importRegex = new RegExp(IMPORT_PATTERN.source, "gm");
  let match: RegExpExecArray | null;
  while ((match = importRegex.exec(content)) !== null) {
    imports.push(match[1]);
  }

  // Match @path shorthand syntax
  const shorthandRegex = new RegExp(SHORTHAND_IMPORT_PATTERN.source, "gm");
  while ((match = shorthandRegex.exec(content)) !== null) {
    imports.push(match[1]);
  }

  return imports;
}

/**
 * Check if a file path has a .md extension.
 */
function isMdFile(filePath: string): boolean {
  return extname(filePath).toLowerCase() === ".md";
}

/**
 * Resolve @import directives in content, replacing them with the imported file contents.
 * Supports both `@import "path"` and `@path` shorthand syntax.
 * Supports nested imports up to MAX_IMPORT_DEPTH levels deep.
 *
 * @param content - The content containing @import directives
 * @param baseDir - The directory to resolve relative import paths against
 * @param depth - Current recursion depth (internal)
 * @param visited - Set of already-visited files to prevent circular imports (internal)
 */
export async function resolveImports(
  content: string,
  baseDir: string,
  depth: number = 0,
  visited: Set<string> = new Set(),
): Promise<string> {
  if (depth >= MAX_IMPORT_DEPTH) {
    // Stop resolving — return content as-is with unresolved import lines
    return content;
  }

  // Collect all matches from both patterns
  const matches: { fullMatch: string; importPath: string }[] = [];

  const importRegex = new RegExp(IMPORT_PATTERN.source, "gm");
  let match: RegExpExecArray | null;
  while ((match = importRegex.exec(content)) !== null) {
    matches.push({ fullMatch: match[0], importPath: match[1] });
  }

  const shorthandRegex = new RegExp(SHORTHAND_IMPORT_PATTERN.source, "gm");
  while ((match = shorthandRegex.exec(content)) !== null) {
    matches.push({ fullMatch: match[0], importPath: match[1] });
  }

  let result = content;

  for (const { fullMatch, importPath } of matches) {
    // Only .md files can be imported
    if (!isMdFile(importPath)) {
      result = result.replace(fullMatch, `<!-- import skipped (not .md): ${importPath} -->`);
      continue;
    }

    const resolvedPath = resolve(baseDir, importPath);

    // Resolve symlinks to get the real path for cycle detection
    let normalizedPath: string;
    try {
      const realPath = await realpath(resolvedPath);
      normalizedPath = realPath.replace(/\\/g, "/");
    } catch {
      // File doesn't exist — normalise the resolved path for the error message
      normalizedPath = resolvedPath.replace(/\\/g, "/");
    }

    if (visited.has(normalizedPath)) {
      // Circular import detected — skip silently
      result = result.replace(fullMatch, `<!-- circular import skipped: ${importPath} -->`);
      continue;
    }

    try {
      visited.add(normalizedPath);
      const importedContent = await readFile(resolvedPath, "utf-8");

      // Recursively resolve imports in the imported file
      const resolvedContent = await resolveImports(
        importedContent,
        dirname(resolvedPath),
        depth + 1,
        visited,
      );

      result = result.replace(fullMatch, resolvedContent);
    } catch (error) {
      if (error instanceof InstructionParseError) throw error;
      // If file not found, replace with a warning comment
      result = result.replace(fullMatch, `<!-- import not found: ${importPath} -->`);
    }
  }

  return result;
}

/**
 * Parse instruction content: resolve imports and return final text.
 */
export async function parseInstructions(content: string, baseDir: string): Promise<string> {
  return resolveImports(content, baseDir);
}
