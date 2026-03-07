import { z } from "zod";
import { readFile, writeFile } from "node:fs/promises";
import { type ToolDefinition, type ToolContext, type ToolResult } from "../types.js";
import { resolvePath } from "../../utils/path.js";

const paramSchema = z.object({
  path: z.string().describe("Path to the .ipynb notebook file"),
  action: z.enum(["add", "replace", "delete"]).describe("Action to perform on the notebook cell"),
  cellIndex: z
    .number()
    .int()
    .min(0)
    .optional()
    .describe("Cell index (0-based). For 'add': insertion position (default: end). For 'replace'/'delete': required."),
  cellType: z
    .enum(["code", "markdown"])
    .optional()
    .default("code")
    .describe("Type of cell (default: 'code')"),
  source: z
    .string()
    .optional()
    .describe("Cell source content. Required for 'add' and 'replace' actions."),
});

type Params = z.infer<typeof paramSchema>;

interface NotebookCell {
  cell_type: string;
  source: string[];
  metadata: Record<string, unknown>;
  outputs?: unknown[];
  execution_count?: number | null;
}

interface Notebook {
  cells: NotebookCell[];
  metadata: Record<string, unknown>;
  nbformat: number;
  nbformat_minor: number;
}

function createCell(cellType: string, source: string): NotebookCell {
  const sourceLines = source.split("\n").map((line, i, arr) =>
    i < arr.length - 1 ? `${line}\n` : line,
  );

  const cell: NotebookCell = {
    cell_type: cellType,
    source: sourceLines,
    metadata: {},
  };

  if (cellType === "code") {
    cell.outputs = [];
    cell.execution_count = null;
  }

  return cell;
}

async function execute(params: Params, context: ToolContext): Promise<ToolResult> {
  const filePath = resolvePath(context.workingDirectory, params.path);

  try {
    const raw = await readFile(filePath, "utf-8");
    const notebook: Notebook = JSON.parse(raw);

    if (!Array.isArray(notebook.cells)) {
      return {
        output: "Invalid notebook format: missing 'cells' array",
        isError: true,
      };
    }

    const totalCells = notebook.cells.length;

    switch (params.action) {
      case "add": {
        if (params.source === undefined) {
          return { output: "'source' is required for 'add' action", isError: true };
        }
        const cell = createCell(params.cellType, params.source);
        const insertAt = params.cellIndex ?? totalCells;

        if (insertAt < 0 || insertAt > totalCells) {
          return {
            output: `cellIndex ${insertAt} out of range [0, ${totalCells}]`,
            isError: true,
          };
        }

        notebook.cells.splice(insertAt, 0, cell);
        break;
      }

      case "replace": {
        if (params.cellIndex === undefined) {
          return { output: "'cellIndex' is required for 'replace' action", isError: true };
        }
        if (params.source === undefined) {
          return { output: "'source' is required for 'replace' action", isError: true };
        }
        if (params.cellIndex < 0 || params.cellIndex >= totalCells) {
          return {
            output: `cellIndex ${params.cellIndex} out of range [0, ${totalCells - 1}]`,
            isError: true,
          };
        }

        const cell = createCell(params.cellType, params.source);
        notebook.cells[params.cellIndex] = cell;
        break;
      }

      case "delete": {
        if (params.cellIndex === undefined) {
          return { output: "'cellIndex' is required for 'delete' action", isError: true };
        }
        if (params.cellIndex < 0 || params.cellIndex >= totalCells) {
          return {
            output: `cellIndex ${params.cellIndex} out of range [0, ${totalCells - 1}]`,
            isError: true,
          };
        }

        notebook.cells.splice(params.cellIndex, 1);
        break;
      }
    }

    await writeFile(filePath, JSON.stringify(notebook, null, 1) + "\n", "utf-8");

    const actionDescriptions: Record<string, string> = {
      add: `Added ${params.cellType} cell at index ${params.cellIndex ?? totalCells}`,
      replace: `Replaced cell at index ${params.cellIndex} with ${params.cellType} cell`,
      delete: `Deleted cell at index ${params.cellIndex}`,
    };

    return {
      output: `${actionDescriptions[params.action]}. Notebook now has ${notebook.cells.length} cells.`,
      isError: false,
      metadata: {
        path: filePath,
        action: params.action,
        cellIndex: params.cellIndex,
        totalCells: notebook.cells.length,
      },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes("JSON")) {
      return { output: `Failed to parse notebook: ${message}`, isError: true };
    }
    return { output: `Notebook edit failed: ${message}`, isError: true };
  }
}

export const notebookEditTool: ToolDefinition<Params> = {
  name: "notebook_edit",
  description:
    "Edit Jupyter notebook (.ipynb) cells. Supports adding, replacing, and deleting cells. The notebook must already exist.",
  parameterSchema: paramSchema,
  permissionLevel: "confirm",
  timeoutMs: 30_000,
  execute,
};
