import { describe, it, expect } from "vitest";
import { z } from "zod";
import { executeTool, executeToolCall } from "../../../src/tools/executor.js";
import { ToolRegistry } from "../../../src/tools/registry.js";
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

  it("should handle timeout", async () => {
    const tool: ToolDefinition<{ input: string }> = {
      name: "slow_tool",
      description: "slow",
      parameterSchema: z.object({ input: z.string() }),
      permissionLevel: "safe",
      timeoutMs: 50,
      execute: async (_params, ctx) => {
        // Wait longer than the timeout
        await new Promise((resolve) => {
          const timer = setTimeout(resolve, 5000);
          ctx.abortSignal.addEventListener("abort", () => {
            clearTimeout(timer);
            resolve(undefined);
          });
        });
        throw new Error("should have been aborted");
      },
    };

    const result = await executeTool(tool, { input: "test" });
    expect(result.isError).toBe(true);
    expect(result.output).toContain("timed out");
  });

  it("should forward parent abort signal", async () => {
    const parentController = new AbortController();
    const tool: ToolDefinition<{ input: string }> = {
      name: "abort_test",
      description: "test",
      parameterSchema: z.object({ input: z.string() }),
      permissionLevel: "safe",
      execute: async (_params, ctx) => {
        await new Promise((resolve) => {
          const timer = setTimeout(resolve, 5000);
          ctx.abortSignal.addEventListener("abort", () => {
            clearTimeout(timer);
            resolve(undefined);
          });
        });
        if (ctx.abortSignal.aborted) {
          throw new Error("aborted");
        }
        return { output: "ok", isError: false };
      },
    };

    // Abort after a short delay
    setTimeout(() => parentController.abort(), 10);

    const result = await executeTool(tool, { input: "test" }, { signal: parentController.signal });
    expect(result.isError).toBe(true);
  });
});

describe("executeToolCall", () => {
  it("should execute a registered tool", async () => {
    const registry = new ToolRegistry();
    registry.register({
      name: "test_registered",
      description: "test",
      parameterSchema: z.object({ msg: z.string() }),
      permissionLevel: "safe",
      execute: async (params) => ({ output: `Hello ${params.msg}`, isError: false }),
    });

    const result = await executeToolCall(registry, {
      id: "call-1",
      name: "test_registered",
      arguments: { msg: "world" },
    });

    expect(result.id).toBe("call-1");
    expect(result.name).toBe("test_registered");
    expect(result.output).toBe("Hello world");
    expect(result.isError).toBe(false);
  });

  it("should return error for unknown tool", async () => {
    const registry = new ToolRegistry();

    const result = await executeToolCall(registry, {
      id: "call-2",
      name: "unknown_tool",
      arguments: {},
    });

    expect(result.id).toBe("call-2");
    expect(result.name).toBe("unknown_tool");
    expect(result.output).toContain("Unknown tool");
    expect(result.isError).toBe(true);
  });
});
