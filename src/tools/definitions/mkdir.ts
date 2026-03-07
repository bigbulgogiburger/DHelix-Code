import { z } from "zod";
import { mkdir } from "node:fs/promises";
import { type ToolDefinition, type ToolContext, type ToolResult } from "../types.js";
import { resolvePath, normalizePath } from "../../utils/path.js";

const paramSchema = z.object({
  path: z.string().describe("Absolute path of the directory to create"),
});

type Params = z.infer<typeof paramSchema>;

async function execute(params: Params, context: ToolContext): Promise<ToolResult> {
  const dirPath = resolvePath(context.workingDirectory, params.path);

  try {
    await mkdir(dirPath, { recursive: true });

    return {
      output: `Successfully created directory ${normalizePath(params.path)}`,
      isError: false,
      metadata: { path: normalizePath(dirPath) },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { output: `Failed to create directory: ${message}`, isError: true };
  }
}

export const mkdirTool: ToolDefinition<Params> = {
  name: "mkdir",
  description: "Create a directory and all necessary parent directories",
  parameterSchema: paramSchema,
  permissionLevel: "confirm",
  timeoutMs: 30_000,
  execute,
};
