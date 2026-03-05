import { z } from "zod";
import { glob } from "node:fs/promises";
import { stat } from "node:fs/promises";
import { type ToolDefinition, type ToolContext, type ToolResult } from "../types.js";
import { resolvePath, normalizePath } from "../../utils/path.js";
import { join } from "node:path";

const paramSchema = z.object({
  pattern: z.string().describe("Glob pattern to match files (e.g., '**/*.ts', 'src/**/*.tsx')"),
  path: z.string().optional().describe("Directory to search in (default: working directory)"),
});

type Params = z.infer<typeof paramSchema>;

async function execute(params: Params, context: ToolContext): Promise<ToolResult> {
  const searchDir = params.path
    ? resolvePath(context.workingDirectory, params.path)
    : context.workingDirectory;

  try {
    const matches: { path: string; mtime: number }[] = [];

    for await (const entry of glob(params.pattern, { cwd: searchDir })) {
      const fullPath = join(searchDir, entry);
      try {
        const stats = await stat(fullPath);
        if (stats.isFile()) {
          matches.push({ path: normalizePath(entry), mtime: stats.mtimeMs });
        }
      } catch {
        // Skip files we can't stat
      }
    }

    // Sort by modification time (most recent first)
    matches.sort((a, b) => b.mtime - a.mtime);

    if (matches.length === 0) {
      return { output: "No files found matching the pattern.", isError: false };
    }

    const output = matches.map((m) => m.path).join("\n");
    return {
      output,
      isError: false,
      metadata: { count: matches.length, pattern: params.pattern },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { output: `Glob search failed: ${message}`, isError: true };
  }
}

export const globSearchTool: ToolDefinition<Params> = {
  name: "glob_search",
  description:
    "Search for files matching a glob pattern. Returns matching file paths sorted by modification time (most recent first).",
  parameterSchema: paramSchema,
  permissionLevel: "safe",
  timeoutMs: 30_000,
  execute,
};
