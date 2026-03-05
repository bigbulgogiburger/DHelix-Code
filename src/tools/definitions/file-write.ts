import { z } from "zod";
import { writeFile, mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import { type ToolDefinition, type ToolContext, type ToolResult } from "../types.js";
import { resolvePath, normalizePath } from "../../utils/path.js";

const paramSchema = z.object({
  path: z.string().describe("File path to write to"),
  content: z.string().describe("Content to write to the file"),
});

type Params = z.infer<typeof paramSchema>;

async function execute(params: Params, context: ToolContext): Promise<ToolResult> {
  const filePath = resolvePath(context.workingDirectory, params.path);

  try {
    await mkdir(dirname(filePath), { recursive: true });
    await writeFile(filePath, params.content, "utf-8");

    const lineCount = params.content.split("\n").length;
    return {
      output: `Successfully wrote ${lineCount} lines to ${normalizePath(params.path)}`,
      isError: false,
      metadata: { path: normalizePath(filePath), lineCount },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { output: `Failed to write file: ${message}`, isError: true };
  }
}

export const fileWriteTool: ToolDefinition<Params> = {
  name: "file_write",
  description:
    "Create or overwrite a file with the given content. Creates parent directories if needed. You should read the file first if it already exists.",
  parameterSchema: paramSchema,
  permissionLevel: "confirm",
  timeoutMs: 30_000,
  execute,
};
