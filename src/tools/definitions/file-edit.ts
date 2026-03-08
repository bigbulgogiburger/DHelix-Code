import { z } from "zod";
import { readFile, writeFile } from "node:fs/promises";
import { type ToolDefinition, type ToolContext, type ToolResult } from "../types.js";
import { resolvePath, normalizePath } from "../../utils/path.js";

const paramSchema = z.object({
  path: z.string().describe("File path to edit"),
  old_string: z.string().describe("Exact string to find and replace (must be unique in the file)"),
  new_string: z.string().describe("Replacement string"),
  replace_all: z.boolean().default(false).describe("Replace all occurrences"),
});

type Params = z.infer<typeof paramSchema>;

async function execute(params: Params, context: ToolContext): Promise<ToolResult> {
  const filePath = resolvePath(context.workingDirectory, params.path);

  try {
    const content = await readFile(filePath, "utf-8");

    const firstIdx = content.indexOf(params.old_string);
    if (firstIdx === -1) {
      return {
        output: `String not found in ${normalizePath(params.path)}. Make sure the old_string matches exactly (including whitespace and indentation).`,
        isError: true,
      };
    }

    if (!params.replace_all) {
      const secondIdx = content.indexOf(params.old_string, firstIdx + 1);
      if (secondIdx !== -1) {
        // Count total occurrences for the error message
        let occurrences = 2;
        let searchFrom = secondIdx + 1;
        while ((searchFrom = content.indexOf(params.old_string, searchFrom)) !== -1) {
          occurrences++;
          searchFrom++;
        }
        return {
          output: `Found ${occurrences} occurrences of old_string in ${normalizePath(params.path)}. Provide more context to make it unique, or set replace_all to true.`,
          isError: true,
        };
      }
    }

    // Calculate line number and change statistics
    const lineNumber = content.slice(0, firstIdx).split("\n").length;
    const oldLines = params.old_string.split("\n").length;
    const newLines = params.new_string.split("\n").length;
    const linesRemoved = oldLines;
    const linesAdded = newLines;

    const updated = params.replace_all
      ? content.split(params.old_string).join(params.new_string)
      : content.replace(params.old_string, params.new_string);

    await writeFile(filePath, updated, "utf-8");

    // Extract ±3 context lines from the updated file around the change
    const updatedLines = updated.split("\n");
    const contextBefore = 3;
    const contextAfter = 3;
    const startLine = Math.max(0, lineNumber - 1 - contextBefore); // 0-based index
    const endLine = Math.min(updatedLines.length, lineNumber - 1 + linesAdded + contextAfter);
    const contextLines = updatedLines.slice(startLine, endLine);

    return {
      output: `Successfully edited ${normalizePath(params.path)}`,
      isError: false,
      metadata: {
        path: normalizePath(filePath),
        lineNumber,
        linesAdded,
        linesRemoved,
        contextLines,
        contextStartLine: startLine + 1, // 1-based
      },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { output: `Failed to edit file: ${message}`, isError: true };
  }
}

export const fileEditTool: ToolDefinition<Params> = {
  name: "file_edit",
  description:
    "Edit a file by replacing an exact string match. The old_string must be unique in the file unless replace_all is set. Always read the file first to get the exact content.",
  parameterSchema: paramSchema,
  permissionLevel: "confirm",
  timeoutMs: 30_000,
  execute,
};
