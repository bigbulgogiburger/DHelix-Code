import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
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

/** Maximum import depth to prevent infinite recursion */
const MAX_IMPORT_DEPTH = 10;

/**
 * Parse @import directives from instruction file content.
 * Returns the list of import paths found.
 */
export function extractImports(content: string): readonly string[] {
  const imports: string[] = [];
  const regex = new RegExp(IMPORT_PATTERN.source, "gm");
  let match: RegExpExecArray | null;

  while ((match = regex.exec(content)) !== null) {
    imports.push(match[1]);
  }

  return imports;
}

/**
 * Resolve @import directives in content, replacing them with the imported file contents.
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
    throw new InstructionParseError(
      `Maximum import depth (${MAX_IMPORT_DEPTH}) exceeded — possible circular import`,
      { baseDir, depth },
    );
  }

  const regex = new RegExp(IMPORT_PATTERN.source, "gm");
  let result = content;
  let match: RegExpExecArray | null;

  // Collect all matches first (to avoid issues with modifying string while iterating)
  const matches: { fullMatch: string; importPath: string }[] = [];
  while ((match = regex.exec(content)) !== null) {
    matches.push({ fullMatch: match[0], importPath: match[1] });
  }

  for (const { fullMatch, importPath } of matches) {
    const resolvedPath = resolve(baseDir, importPath);
    const normalizedPath = resolvedPath.replace(/\\/g, "/");

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
