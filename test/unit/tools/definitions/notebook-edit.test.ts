import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { writeFile, readFile, rm, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { notebookEditTool } from "../../../../src/tools/definitions/notebook-edit.js";

const TEST_DIR = join(process.cwd(), "test/tmp/notebook-test");
const TEST_NOTEBOOK = join(TEST_DIR, "test.ipynb");

const context = {
  workingDirectory: TEST_DIR,
  abortSignal: new AbortController().signal,
  timeoutMs: 30_000,
  platform: "darwin" as const,
};

function makeNotebook(cells: Array<{ cell_type: string; source: string[] }>) {
  return {
    cells: cells.map((c) => ({
      cell_type: c.cell_type,
      source: c.source,
      metadata: {},
      ...(c.cell_type === "code" ? { outputs: [], execution_count: null } : {}),
    })),
    metadata: { kernelspec: {} },
    nbformat: 4,
    nbformat_minor: 5,
  };
}

describe("notebook_edit tool", () => {
  beforeEach(async () => {
    await mkdir(TEST_DIR, { recursive: true });
    const notebook = makeNotebook([
      { cell_type: "code", source: ["print('hello')\n"] },
      { cell_type: "markdown", source: ["# Title\n"] },
      { cell_type: "code", source: ["x = 1\n"] },
    ]);
    await writeFile(TEST_NOTEBOOK, JSON.stringify(notebook, null, 1), "utf-8");
  });

  afterEach(async () => {
    await rm(TEST_DIR, { recursive: true, force: true });
  });

  it("should have correct metadata", () => {
    expect(notebookEditTool.name).toBe("notebook_edit");
    expect(notebookEditTool.permissionLevel).toBe("confirm");
  });

  it("should add a cell at the end by default", async () => {
    const result = await notebookEditTool.execute(
      { path: "test.ipynb", action: "add", cellType: "code", source: "y = 2" },
      context,
    );

    expect(result.isError).toBe(false);
    expect(result.output).toContain("Added code cell at index 3");
    expect(result.metadata?.totalCells).toBe(4);

    const nb = JSON.parse(await readFile(TEST_NOTEBOOK, "utf-8"));
    expect(nb.cells[3].source).toEqual(["y = 2"]);
    expect(nb.cells[3].cell_type).toBe("code");
  });

  it("should add a cell at a specific index", async () => {
    const result = await notebookEditTool.execute(
      {
        path: "test.ipynb",
        action: "add",
        cellIndex: 1,
        cellType: "markdown",
        source: "## Subtitle",
      },
      context,
    );

    expect(result.isError).toBe(false);
    expect(result.output).toContain("Added markdown cell at index 1");

    const nb = JSON.parse(await readFile(TEST_NOTEBOOK, "utf-8"));
    expect(nb.cells.length).toBe(4);
    expect(nb.cells[1].cell_type).toBe("markdown");
  });

  it("should replace a cell", async () => {
    const result = await notebookEditTool.execute(
      {
        path: "test.ipynb",
        action: "replace",
        cellIndex: 0,
        cellType: "code",
        source: "print('replaced')",
      },
      context,
    );

    expect(result.isError).toBe(false);
    expect(result.output).toContain("Replaced cell at index 0");

    const nb = JSON.parse(await readFile(TEST_NOTEBOOK, "utf-8"));
    expect(nb.cells.length).toBe(3);
    expect(nb.cells[0].source).toEqual(["print('replaced')"]);
  });

  it("should delete a cell", async () => {
    const result = await notebookEditTool.execute(
      { path: "test.ipynb", action: "delete", cellIndex: 1, cellType: "code" },
      context,
    );

    expect(result.isError).toBe(false);
    expect(result.output).toContain("Deleted cell at index 1");
    expect(result.metadata?.totalCells).toBe(2);

    const nb = JSON.parse(await readFile(TEST_NOTEBOOK, "utf-8"));
    expect(nb.cells.length).toBe(2);
  });

  it("should error when cellIndex is out of range for replace", async () => {
    const result = await notebookEditTool.execute(
      { path: "test.ipynb", action: "replace", cellIndex: 10, cellType: "code", source: "x" },
      context,
    );

    expect(result.isError).toBe(true);
    expect(result.output).toContain("out of range");
  });

  it("should error when cellIndex is out of range for delete", async () => {
    const result = await notebookEditTool.execute(
      { path: "test.ipynb", action: "delete", cellIndex: 5, cellType: "code" },
      context,
    );

    expect(result.isError).toBe(true);
    expect(result.output).toContain("out of range");
  });

  it("should error when source is missing for add", async () => {
    const result = await notebookEditTool.execute(
      { path: "test.ipynb", action: "add", cellType: "code" },
      context,
    );

    expect(result.isError).toBe(true);
    expect(result.output).toContain("'source' is required");
  });

  it("should error when cellIndex is missing for replace", async () => {
    const result = await notebookEditTool.execute(
      { path: "test.ipynb", action: "replace", cellType: "code", source: "x" },
      context,
    );

    expect(result.isError).toBe(true);
    expect(result.output).toContain("'cellIndex' is required");
  });

  it("should handle non-existent notebook", async () => {
    const result = await notebookEditTool.execute(
      { path: "nonexistent.ipynb", action: "add", cellType: "code", source: "x" },
      context,
    );

    expect(result.isError).toBe(true);
    expect(result.output).toContain("Notebook edit failed");
  });

  it("should handle invalid JSON in notebook", async () => {
    await writeFile(TEST_NOTEBOOK, "not valid json", "utf-8");

    const result = await notebookEditTool.execute(
      { path: "test.ipynb", action: "add", cellType: "code", source: "x" },
      context,
    );

    expect(result.isError).toBe(true);
    expect(result.output).toContain("Failed to parse notebook");
  });

  it("should create code cells with outputs and execution_count", async () => {
    await notebookEditTool.execute(
      { path: "test.ipynb", action: "add", cellType: "code", source: "z = 3" },
      context,
    );

    const nb = JSON.parse(await readFile(TEST_NOTEBOOK, "utf-8"));
    const lastCell = nb.cells[nb.cells.length - 1];
    expect(lastCell.outputs).toEqual([]);
    expect(lastCell.execution_count).toBeNull();
  });

  it("should create markdown cells without outputs", async () => {
    await notebookEditTool.execute(
      { path: "test.ipynb", action: "add", cellType: "markdown", source: "## Note" },
      context,
    );

    const nb = JSON.parse(await readFile(TEST_NOTEBOOK, "utf-8"));
    const lastCell = nb.cells[nb.cells.length - 1];
    expect(lastCell.outputs).toBeUndefined();
    expect(lastCell.execution_count).toBeUndefined();
  });
});
