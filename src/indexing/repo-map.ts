import { readFile, readdir, stat } from "node:fs/promises";
import { join, extname, relative } from "node:path";
import { BaseError } from "../utils/error.js";

/** Repo map error */
export class RepoMapError extends BaseError {
  constructor(message: string, context: Record<string, unknown> = {}) {
    super(message, "REPO_MAP_ERROR", context);
  }
}

/** A symbol extracted from a source file */
export interface RepoSymbol {
  readonly name: string;
  readonly kind: "class" | "function" | "interface" | "type" | "const" | "enum";
  readonly file: string;
  readonly line: number;
  readonly exported: boolean;
}

/** A file entry in the repo map */
export interface RepoFileEntry {
  readonly path: string;
  readonly symbols: readonly RepoSymbol[];
  readonly imports: readonly string[];
  readonly size: number;
}

/** The complete repository map */
export interface RepoMap {
  readonly root: string;
  readonly files: readonly RepoFileEntry[];
  readonly totalSymbols: number;
  readonly totalFiles: number;
}

/** Supported file extensions for symbol extraction */
const SUPPORTED_EXTENSIONS = new Set([".ts", ".tsx", ".js", ".jsx"]);

/** Directories to skip */
const SKIP_DIRS = new Set(["node_modules", ".git", "dist", "build", ".next", "coverage"]);

/** Regex patterns for TypeScript/JavaScript symbol extraction */
const PATTERNS = {
  classDecl: /^(?:export\s+)?(?:abstract\s+)?class\s+(\w+)/,
  functionDecl: /^(?:export\s+)?(?:async\s+)?function\s+(\w+)/,
  interfaceDecl: /^(?:export\s+)?interface\s+(\w+)/,
  typeDecl: /^(?:export\s+)?type\s+(\w+)\s*=/,
  constDecl: /^(?:export\s+)?const\s+(\w+)\s*[=:]/,
  enumDecl: /^(?:export\s+)?enum\s+(\w+)/,
  importDecl: /^import\s+.*from\s+['"]([^'"]+)['"]/,
} as const;

/**
 * Extract symbols from a TypeScript/JavaScript source file.
 * Uses regex-based parsing (lightweight alternative to tree-sitter).
 */
function extractSymbols(
  content: string,
  filePath: string,
): {
  symbols: RepoSymbol[];
  imports: string[];
} {
  const symbols: RepoSymbol[] = [];
  const imports: string[] = [];
  const lines = content.split("\n");

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    const lineNum = i + 1;

    // Import extraction
    const importMatch = line.match(PATTERNS.importDecl);
    if (importMatch) {
      imports.push(importMatch[1]);
      continue;
    }

    // Symbol extraction
    const isExported = line.startsWith("export");

    for (const [patternName, pattern] of Object.entries(PATTERNS)) {
      if (patternName === "importDecl") continue;
      const match = line.match(pattern);
      if (match) {
        const kind = patternName.replace("Decl", "") as RepoSymbol["kind"];
        symbols.push({
          name: match[1],
          kind,
          file: filePath,
          line: lineNum,
          exported: isExported,
        });
        break;
      }
    }
  }

  return { symbols, imports };
}

/**
 * Recursively collect all source files in a directory.
 */
async function collectFiles(dir: string, root: string): Promise<string[]> {
  const files: string[] = [];

  try {
    const entries = await readdir(dir);

    for (const entry of entries) {
      if (SKIP_DIRS.has(entry)) continue;

      const fullPath = join(dir, entry);
      const stats = await stat(fullPath);

      if (stats.isDirectory()) {
        const subFiles = await collectFiles(fullPath, root);
        files.push(...subFiles);
      } else if (SUPPORTED_EXTENSIONS.has(extname(entry))) {
        files.push(fullPath);
      }
    }
  } catch (error) {
    if (
      !(
        error instanceof Error &&
        "code" in error &&
        (error as NodeJS.ErrnoException).code === "ENOENT"
      )
    ) {
      throw error;
    }
  }

  return files;
}

/**
 * Build a repository map from the given root directory.
 * Extracts symbols and imports from all supported source files.
 */
export async function buildRepoMap(rootDir: string): Promise<RepoMap> {
  const filePaths = await collectFiles(rootDir, rootDir);
  const files: RepoFileEntry[] = [];
  let totalSymbols = 0;

  for (const filePath of filePaths) {
    try {
      const content = await readFile(filePath, "utf-8");
      const relPath = relative(rootDir, filePath).replace(/\\/g, "/");
      const { symbols, imports } = extractSymbols(content, relPath);

      files.push({
        path: relPath,
        symbols,
        imports,
        size: content.length,
      });

      totalSymbols += symbols.length;
    } catch {
      // Skip files that can't be read
    }
  }

  return {
    root: rootDir,
    files,
    totalSymbols,
    totalFiles: files.length,
  };
}

/**
 * Render the repo map as a compact string for context injection.
 * Stays within the given token budget (estimated 4 chars per token).
 */
export function renderRepoMap(map: RepoMap, maxTokens = 4000): string {
  const maxChars = maxTokens * 4;
  const lines: string[] = [
    `Repository Map (${map.totalFiles} files, ${map.totalSymbols} symbols)`,
    "",
  ];

  let charCount = lines.join("\n").length;

  for (const file of map.files) {
    const exportedSymbols = file.symbols.filter((s) => s.exported);
    if (exportedSymbols.length === 0) continue;

    const fileLine = `${file.path}:`;
    const symbolLines = exportedSymbols.map((s) => `  ${s.kind} ${s.name} (L${s.line})`);
    const block = [fileLine, ...symbolLines].join("\n");

    if (charCount + block.length + 1 > maxChars) break;

    lines.push(block);
    charCount += block.length + 1;
  }

  return lines.join("\n");
}
