import { z } from "zod";
import { readFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import fg from "fast-glob";
import { join } from "node:path";
import { type ToolDefinition, type ToolContext, type ToolResult } from "../types.js";
import { resolvePath, normalizePath } from "../../utils/path.js";

const execFileAsync = promisify(execFile);

const paramSchema = z.object({
  pattern: z.string().describe("Regular expression pattern to search for"),
  path: z
    .string()
    .optional()
    .describe("File or directory to search in (default: working directory)"),
  include: z.string().optional().describe("Glob pattern to filter files (e.g., '*.ts')"),
  contextLines: z
    .number()
    .int()
    .min(0)
    .optional()
    .describe("Number of context lines to show before and after each match (maps to rg -C)"),
  caseSensitive: z
    .boolean()
    .optional()
    .describe("Whether the search is case-sensitive (default: true). Set to false for case-insensitive search."),
  fileType: z
    .string()
    .optional()
    .describe("Language file type filter (e.g., 'ts', 'py', 'js'). Uses ripgrep's built-in type definitions."),
  multiline: z
    .boolean()
    .optional()
    .describe("Enable multiline matching where patterns can span multiple lines (maps to rg -U)"),
});

type Params = z.infer<typeof paramSchema>;

/** Cache ripgrep availability to avoid repeated lookups */
let _ripgrepAvailable: boolean | undefined;

/** Check if ripgrep (rg) is available on the system */
export async function isRipgrepAvailable(): Promise<boolean> {
  if (_ripgrepAvailable !== undefined) return _ripgrepAvailable;
  try {
    await execFileAsync("rg", ["--version"]);
    _ripgrepAvailable = true;
  } catch {
    _ripgrepAvailable = false;
  }
  return _ripgrepAvailable;
}

/** Reset cached ripgrep availability. Useful for testing. */
export function _resetRipgrepCache(): void {
  _ripgrepAvailable = undefined;
}

interface RipgrepResult {
  readonly output: string;
  readonly matchCount: number;
}

/** Search using ripgrep subprocess */
async function searchWithRipgrep(
  params: Params,
  searchPath: string,
  workingDirectory: string,
): Promise<RipgrepResult> {
  const args: string[] = [
    "--line-number",
    "--no-heading",
    "--color",
    "never",
    "--max-count",
    "200",
  ];

  // Case sensitivity (default: case-sensitive)
  if (params.caseSensitive === false) {
    args.push("--ignore-case");
  }

  // Context lines
  if (params.contextLines !== undefined && params.contextLines > 0) {
    args.push("-C", String(params.contextLines));
  }

  // Glob filter
  if (params.include) {
    args.push("--glob", params.include);
  }

  // File type filter
  if (params.fileType) {
    args.push("--type", params.fileType);
  }

  // Multiline matching
  if (params.multiline) {
    args.push("--multiline");
  }

  // Pattern and search path
  args.push(params.pattern, searchPath);

  const { stdout } = await execFileAsync("rg", args, {
    maxBuffer: 10 * 1024 * 1024, // 10MB buffer
    timeout: 25_000,
  });

  if (!stdout.trim()) {
    return { output: "No matches found.", matchCount: 0 };
  }

  // Normalize file paths in output to be relative to workingDirectory
  const lines = stdout.trimEnd().split("\n");
  const normalizedLines: string[] = [];

  for (const line of lines) {
    // rg output format: /absolute/path/file.ts:linenum:content
    // or context separator: --
    if (line === "--") {
      normalizedLines.push(line);
      continue;
    }

    // Match file:line:content or file-line-content (context lines use -)
    const match = line.match(/^(.+?):(\d+)([:-])(.*)$/);
    if (match) {
      const filePath = match[1];
      const lineNum = match[2];
      const separator = match[3];
      const content = match[4];
      const relativePath = normalizePath(
        filePath.replace(workingDirectory, "").replace(/^[/\\]/, ""),
      );
      normalizedLines.push(`${relativePath}:${lineNum}${separator}${content}`);
    } else {
      normalizedLines.push(line);
    }
  }

  // Count actual matches (lines with : separator, not context lines with -)
  const matchCount = normalizedLines.filter(
    (l) => l !== "--" && /^.+?:\d+:/.test(l),
  ).length;

  const output = normalizedLines.join("\n");

  return { output, matchCount };
}

/** Fallback: pure JavaScript grep implementation */
async function searchWithJavaScript(
  params: Params,
  searchPath: string,
  workingDirectory: string,
): Promise<ToolResult> {
  const regex = new RegExp(params.pattern, params.caseSensitive === false ? "gim" : "gm");
  const results: string[] = [];
  const includePattern = params.include ?? "**/*";

  const entries = await fg(includePattern, { cwd: searchPath, dot: false, onlyFiles: true });
  const files: string[] = entries.map((entry) => join(searchPath, entry));

  for (const filePath of files) {
    try {
      const content = await readFile(filePath, "utf-8");
      const lines = content.split("\n");

      for (let i = 0; i < lines.length; i++) {
        if (regex.test(lines[i])) {
          const relativePath = normalizePath(
            filePath.replace(workingDirectory, "").replace(/^[/\\]/, ""),
          );
          results.push(`${relativePath}:${i + 1}: ${lines[i].trim()}`);
        }
        regex.lastIndex = 0;
      }
    } catch {
      // Skip files we can't read (binary, permission issues)
    }
  }

  if (results.length === 0) {
    return { output: "No matches found.", isError: false };
  }

  const output = results.slice(0, 200).join("\n");
  const truncated = results.length > 200 ? `\n... (${results.length - 200} more matches)` : "";

  return {
    output: output + truncated,
    isError: false,
    metadata: { matchCount: results.length, pattern: params.pattern, backend: "javascript" },
  };
}

async function execute(params: Params, context: ToolContext): Promise<ToolResult> {
  const searchPath = params.path
    ? resolvePath(context.workingDirectory, params.path)
    : context.workingDirectory;

  try {
    // Try ripgrep first
    if (await isRipgrepAvailable()) {
      try {
        const result = await searchWithRipgrep(params, searchPath, context.workingDirectory);

        if (result.matchCount === 0) {
          return { output: "No matches found.", isError: false };
        }

        return {
          output: result.output,
          isError: false,
          metadata: { matchCount: result.matchCount, pattern: params.pattern, backend: "ripgrep" },
        };
      } catch (rgError) {
        // rg exit code 1 = no matches, exit code 2 = error
        const err = rgError as { code?: number; stdout?: string; stderr?: string };
        if (err.code === 1) {
          return { output: "No matches found.", isError: false };
        }
        // Fall through to JavaScript fallback on other errors
      }
    }

    // Fallback to JavaScript implementation
    return await searchWithJavaScript(params, searchPath, context.workingDirectory);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { output: `Grep search failed: ${message}`, isError: true };
  }
}

export const grepSearchTool: ToolDefinition<Params> = {
  name: "grep_search",
  description:
    "Search file contents using a regular expression pattern. Returns matching lines with file paths and line numbers. " +
    "Supports case-insensitive search, context lines, file type filtering, and multiline matching. " +
    "Uses ripgrep (rg) for fast searching when available, with automatic fallback to built-in search.",
  parameterSchema: paramSchema,
  permissionLevel: "safe",
  timeoutMs: 30_000,
  execute,
};
