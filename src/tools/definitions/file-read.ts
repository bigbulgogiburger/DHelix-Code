import { z } from "zod";
import { readFile } from "node:fs/promises";
import { type ToolDefinition, type ToolContext, type ToolResult } from "../types.js";
import { normalizePath, resolvePath } from "../../utils/path.js";

const paramSchema = z.object({
  path: z.string().describe("Absolute or relative file path to read"),
  offset: z
    .number()
    .int()
    .min(0)
    .optional()
    .describe("Line number to start reading from (0-based)"),
  limit: z.number().int().min(1).optional().describe("Maximum number of lines to read"),
});

type Params = z.infer<typeof paramSchema>;

async function execute(params: Params, context: ToolContext): Promise<ToolResult> {
  const filePath = resolvePath(context.workingDirectory, params.path);

  try {
    const content = await readFile(filePath, "utf-8");
    const lines = content.split("\n");
    const offset = params.offset ?? 0;
    const limit = params.limit ?? lines.length;
    const sliced = lines.slice(offset, offset + limit);

    const numbered = sliced
      .map((line, i) => `${String(offset + i + 1).padStart(6)} | ${line}`)
      .join("\n");

    return {
      output: numbered,
      isError: false,
      metadata: {
        path: normalizePath(filePath),
        totalLines: lines.length,
        readFrom: offset,
        readTo: Math.min(offset + limit, lines.length),
      },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { output: `Failed to read file: ${message}`, isError: true };
  }
}

export const fileReadTool: ToolDefinition<Params> = {
  name: "file_read",
  description:
    "Read a file's contents with line numbers. Supports offset and limit for partial reads. Use this before modifying files.",
  parameterSchema: paramSchema,
  permissionLevel: "safe",
  timeoutMs: 30_000,
  execute,
};
