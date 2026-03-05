import { z } from "zod";
import { readFile } from "node:fs/promises";
import { glob } from "node:fs/promises";
import { join } from "node:path";
import { type ToolDefinition, type ToolContext, type ToolResult } from "../types.js";
import { resolvePath, normalizePath } from "../../utils/path.js";

const paramSchema = z.object({
  pattern: z.string().describe("Regular expression pattern to search for"),
  path: z
    .string()
    .optional()
    .describe("File or directory to search in (default: working directory)"),
  include: z.string().optional().describe("Glob pattern to filter files (e.g., '*.ts')"),
});

type Params = z.infer<typeof paramSchema>;

async function execute(params: Params, context: ToolContext): Promise<ToolResult> {
  const searchPath = params.path
    ? resolvePath(context.workingDirectory, params.path)
    : context.workingDirectory;

  try {
    const regex = new RegExp(params.pattern, "gm");
    const results: string[] = [];
    const includePattern = params.include ?? "**/*";

    const files: string[] = [];
    for await (const entry of glob(includePattern, { cwd: searchPath })) {
      files.push(join(searchPath, entry));
    }

    for (const filePath of files) {
      try {
        const content = await readFile(filePath, "utf-8");
        const lines = content.split("\n");

        for (let i = 0; i < lines.length; i++) {
          if (regex.test(lines[i])) {
            const relativePath = normalizePath(
              filePath.replace(context.workingDirectory, "").replace(/^[/\\]/, ""),
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
      metadata: { matchCount: results.length, pattern: params.pattern },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { output: `Grep search failed: ${message}`, isError: true };
  }
}

export const grepSearchTool: ToolDefinition<Params> = {
  name: "grep_search",
  description:
    "Search file contents using a regular expression pattern. Returns matching lines with file paths and line numbers.",
  parameterSchema: paramSchema,
  permissionLevel: "safe",
  timeoutMs: 30_000,
  execute,
};
