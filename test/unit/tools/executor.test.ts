import { describe, it, expect } from "vitest";
import { z } from "zod";
import { executeTool } from "../../../src/tools/executor.js";
import { type ToolDefinition } from "../../../src/tools/types.js";

function createTool(
  execute: (params: { input: string }) => Promise<{ output: string; isError: boolean }>,
): ToolDefinition<{ input: string }> {
  return {
    name: "test_tool",
    description: "test",
    parameterSchema: z.object({ input: z.string() }),
    permissionLevel: "safe",
    execute: async (params, _ctx) => execute(params),
  };
}

describe("executeTool", () => {
  it("should execute tool with valid args", async () => {
    const tool = createTool(async (params) => ({
      output: `Got: ${params.input}`,
      isError: false,
    }));

    const result = await executeTool(tool, { input: "hello" });
    expect(result.output).toBe("Got: hello");
    expect(result.isError).toBe(false);
  });

  it("should return error on invalid args", async () => {
    const tool = createTool(async () => ({ output: "ok", isError: false }));

    const result = await executeTool(tool, { wrong: "field" });
    expect(result.isError).toBe(true);
    expect(result.output).toContain("failed");
  });

  it("should handle tool execution errors", async () => {
    const tool = createTool(async () => {
      throw new Error("boom");
    });

    const result = await executeTool(tool, { input: "test" });
    expect(result.isError).toBe(true);
    expect(result.output).toContain("boom");
  });

  it("should respect abort signal", async () => {
    const controller = new AbortController();
    controller.abort();

    const tool = createTool(async () => ({ output: "ok", isError: false }));

    const result = await executeTool(tool, { input: "test" }, { signal: controller.signal });
    expect(result.isError).toBe(true);
    expect(result.output).toBe("Aborted");
  });
});
