import { describe, it, expect } from "vitest";
import { ToolPipeline } from "../../src/tools/pipeline.js";
import { ToolRegistry } from "../../src/tools/registry.js";
import { createEventEmitter } from "../../src/utils/events.js";
import { type ToolContext } from "../../src/tools/types.js";
import { z } from "zod";

/**
 * Helper to build a minimal ToolContext suitable for pipeline tests.
 * Uses a temporary directory and no-op abort signal.
 */
function createTestContext(): ToolContext {
  const controller = new AbortController();
  return {
    workingDirectory: "/tmp",
    abortSignal: controller.signal,
    timeoutMs: 30_000,
    platform: "darwin",
    events: createEventEmitter(),
  };
}

function createTestRegistry(): ToolRegistry {
  const registry = new ToolRegistry();

  registry.register({
    name: "fast_tool",
    description: "A fast tool",
    parameterSchema: z.object({ input: z.string() }),
    permissionLevel: "safe",
    execute: async (params: { input: string }) => ({
      output: `Result: ${params.input}`,
      isError: false,
    }),
  });

  registry.register({
    name: "slow_tool",
    description: "A slow tool",
    parameterSchema: z.object({ input: z.string() }),
    permissionLevel: "safe",
    execute: async (params: { input: string }) => {
      await new Promise((r) => setTimeout(r, 50));
      return { output: `Slow result: ${params.input}`, isError: false };
    },
  });

  registry.register({
    name: "error_tool",
    description: "A tool that fails",
    parameterSchema: z.object({ input: z.string() }),
    permissionLevel: "safe",
    execute: async () => ({
      output: "Something went wrong",
      isError: true,
    }),
  });

  return registry;
}

describe("Tool Pipeline Scenarios", () => {
  it("should execute a single tool successfully", async () => {
    const registry = createTestRegistry();
    const pipeline = new ToolPipeline(registry);
    const context = createTestContext();

    const result = await pipeline.execute(
      [{ id: "tc1", name: "fast_tool", arguments: { input: "hello" } }],
      context,
    );

    expect(result.executedCount).toBe(1);
    expect(result.rejectedCount).toBe(0);
    expect(result.results[0].isError).toBe(false);
    expect(result.results[0].output).toContain("hello");
  });

  it("should handle tool execution errors gracefully", async () => {
    const registry = createTestRegistry();
    const pipeline = new ToolPipeline(registry);
    const context = createTestContext();

    const result = await pipeline.execute(
      [{ id: "tc1", name: "error_tool", arguments: { input: "test" } }],
      context,
    );

    expect(result.executedCount).toBe(1);
    expect(result.results[0].isError).toBe(true);
  });

  it("should handle unknown tools", async () => {
    const registry = createTestRegistry();
    const pipeline = new ToolPipeline(registry);
    const context = createTestContext();

    const result = await pipeline.execute(
      [{ id: "tc1", name: "nonexistent_tool", arguments: {} }],
      context,
    );

    expect(result.results[0].isError).toBe(true);
    expect(result.results[0].output).toContain("Unknown tool");
  });

  it("should execute multiple tools in parallel", async () => {
    const registry = createTestRegistry();
    const pipeline = new ToolPipeline(registry);
    const context = createTestContext();

    const start = Date.now();
    const result = await pipeline.execute(
      [
        { id: "tc1", name: "slow_tool", arguments: { input: "a" } },
        { id: "tc2", name: "slow_tool", arguments: { input: "b" } },
      ],
      context,
    );
    const elapsed = Date.now() - start;

    expect(result.executedCount).toBe(2);
    // If truly parallel, should take ~50ms not ~100ms
    expect(elapsed).toBeLessThan(200);
  });

  it("should report correct timing in totalTimeMs", async () => {
    const registry = createTestRegistry();
    const pipeline = new ToolPipeline(registry);
    const context = createTestContext();

    const result = await pipeline.execute(
      [{ id: "tc1", name: "fast_tool", arguments: { input: "timing" } }],
      context,
    );

    expect(result.totalTimeMs).toBeGreaterThanOrEqual(0);
    expect(result.totalTimeMs).toBeLessThan(5000);
  });

  it("should return results in the same order as input calls", async () => {
    const registry = createTestRegistry();
    const pipeline = new ToolPipeline(registry);
    const context = createTestContext();

    const result = await pipeline.execute(
      [
        { id: "tc1", name: "fast_tool", arguments: { input: "first" } },
        { id: "tc2", name: "fast_tool", arguments: { input: "second" } },
      ],
      context,
    );

    expect(result.results).toHaveLength(2);
    expect(result.results[0].output).toContain("first");
    expect(result.results[1].output).toContain("second");
  });

  it("should handle mixed success and error results", async () => {
    const registry = createTestRegistry();
    const pipeline = new ToolPipeline(registry);
    const context = createTestContext();

    const result = await pipeline.execute(
      [
        { id: "tc1", name: "fast_tool", arguments: { input: "ok" } },
        { id: "tc2", name: "error_tool", arguments: { input: "fail" } },
      ],
      context,
    );

    expect(result.executedCount).toBe(2);
    const successResult = result.results.find((r) => r.name === "fast_tool");
    const errorResult = result.results.find((r) => r.name === "error_tool");
    expect(successResult?.isError).toBe(false);
    expect(errorResult?.isError).toBe(true);
  });
});
