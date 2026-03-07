import { z } from "zod";
import { readdir } from "node:fs/promises";
import { type ToolDefinition, type ToolContext, type ToolResult } from "../types.js";
import { resolvePath, joinPath } from "../../utils/path.js";

const IGNORED_DIRS = new Set([
  ".git",
  "node_modules",
  ".next",
  ".nuxt",
  "__pycache__",
  ".pytest_cache",
  ".venv",
  "venv",
  ".tox",
  "dist",
  "build",
  ".gradle",
  ".idea",
  ".vscode",
  ".DS_Store",
]);

const paramSchema = z.object({
  path: z.string().describe("Directory path to list"),
  recursive: z
    .boolean()
    .optional()
    .default(false)
    .describe("Whether to list recursively (default: false)"),
  maxDepth: z
    .number()
    .int()
    .min(1)
    .max(10)
    .optional()
    .default(3)
    .describe("Maximum depth for recursive listing (default: 3)"),
});

type Params = z.infer<typeof paramSchema>;

interface TreeEntry {
  readonly name: string;
  readonly isDirectory: boolean;
  readonly children?: readonly TreeEntry[];
}

async function buildTree(
  dirPath: string,
  recursive: boolean,
  maxDepth: number,
  currentDepth: number,
): Promise<readonly TreeEntry[]> {
  const entries = await readdir(dirPath, { withFileTypes: true });

  const sorted = entries
    .filter((e) => !IGNORED_DIRS.has(e.name))
    .sort((a, b) => {
      // Directories first, then alphabetical
      if (a.isDirectory() !== b.isDirectory()) {
        return a.isDirectory() ? -1 : 1;
      }
      return a.name.localeCompare(b.name);
    });

  const result: TreeEntry[] = [];

  for (const entry of sorted) {
    const isDir = entry.isDirectory();
    let children: readonly TreeEntry[] | undefined;

    if (isDir && recursive && currentDepth < maxDepth) {
      try {
        children = await buildTree(
          joinPath(dirPath, entry.name),
          recursive,
          maxDepth,
          currentDepth + 1,
        );
      } catch {
        // Permission denied or other error — skip children
        children = undefined;
      }
    }

    result.push({
      name: entry.name,
      isDirectory: isDir,
      children,
    });
  }

  return result;
}

function formatTree(entries: readonly TreeEntry[], prefix: string = ""): string {
  const lines: string[] = [];

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    const isLast = i === entries.length - 1;
    const connector = isLast ? "└── " : "├── ";
    const displayName = entry.isDirectory ? `${entry.name}/` : entry.name;

    lines.push(`${prefix}${connector}${displayName}`);

    if (entry.children && entry.children.length > 0) {
      const childPrefix = prefix + (isLast ? "    " : "│   ");
      lines.push(formatTree(entry.children, childPrefix));
    }
  }

  return lines.join("\n");
}

async function execute(params: Params, context: ToolContext): Promise<ToolResult> {
  const dirPath = resolvePath(context.workingDirectory, params.path);

  try {
    const tree = await buildTree(dirPath, params.recursive, params.maxDepth, 0);
    const output = formatTree(tree);

    return {
      output: output || "(empty directory)",
      isError: false,
      metadata: {
        path: dirPath,
        recursive: params.recursive,
        maxDepth: params.maxDepth,
      },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      output: `Failed to list directory: ${message}`,
      isError: true,
    };
  }
}

export const listDirTool: ToolDefinition<Params> = {
  name: "list_dir",
  description:
    "List directory contents in a tree format. Directories are sorted first, then files alphabetically. Common directories like .git and node_modules are excluded by default.",
  parameterSchema: paramSchema,
  permissionLevel: "safe",
  timeoutMs: 30_000,
  execute,
};
