/**
 * ToolPipeline 통합 테스트 — 4-stage 파이프라인 전체 흐름
 */
import { describe, it, expect, vi } from "vitest";
import { ToolPipeline } from "../../../src/tools/pipeline.js";
import { ToolRegistry } from "../../../src/tools/registry.js";
import { type ToolContext, type ExtractedToolCall } from "../../../src/tools/types.js";
import { z } from "zod";

function makeRegistry(): ToolRegistry {
  const registry = new ToolRegistry();

  registry.register({
    name: "file_read",
    description: "Read a file",
    parameterSchema: z.object({ path: z.string() }),
    permissionLevel: "safe",
    execute: async (params: { path: string }) => ({
      output: `Content of ${params.path}`,
      isError: false,
    }),
  });

  registry.register({
    name: "file_write",
    description: "Write a file",
    parameterSchema: z.object({ file_path: z.string(), content: z.string() }),
    permissionLevel: "confirm",
    execute: async (params: { file_path: string; content: string }) => ({
      output: `Written to ${params.file_path}`,
      isError: false,
    }),
  });

  registry.register({
    name: "failing_tool",
    description: "Always fails",
    parameterSchema: z.object({}),
    permissionLevel: "safe",
    execute: async () => {
      throw new Error("Tool exploded");
    },
  });

  return registry;
}

function makeContext(overrides: Partial<ToolContext> = {}): ToolContext {
  return {
    workingDirectory: "/tmp",
    abortSignal: new AbortController().signal,
    timeoutMs: 30000,
    platform: "darwin",
    ...overrides,
  };
}

function makeCall(
  name: string,
  id?: string,
  args: Record<string, unknown> = {},
): ExtractedToolCall {
  return { id: id ?? `call-${name}`, name, arguments: args };
}

describe("ToolPipeline", () => {
  it("should execute a single tool call through all stages", async () => {
    const registry = makeRegistry();
    const pipeline = new ToolPipeline(registry);
    const context = makeContext();

    const result = await pipeline.execute(
      [makeCall("file_read", "c1", { path: "/tmp/test.ts" })],
      context,
    );

    expect(result.executedCount).toBe(1);
    expect(result.rejectedCount).toBe(0);
    expect(result.results).toHaveLength(1);
    expect(result.results[0].output).toContain("Content of /tmp/test.ts");
    expect(result.results[0].isError).toBe(false);
    expect(result.totalTimeMs).toBeGreaterThanOrEqual(0);
  });

  it("should reject unknown tools in preflight", async () => {
    const registry = makeRegistry();
    const pipeline = new ToolPipeline(registry);
    const context = makeContext();

    const result = await pipeline.execute([makeCall("nonexistent_tool", "c1")], context);

    expect(result.executedCount).toBe(0);
    expect(result.rejectedCount).toBe(1);
    expect(result.results).toHaveLength(1);
    expect(result.results[0].isError).toBe(true);
    expect(result.results[0].output).toContain("Unknown tool");
  });

  it("should handle mixed valid and invalid calls", async () => {
    const registry = makeRegistry();
    const pipeline = new ToolPipeline(registry);
    const context = makeContext();

    const result = await pipeline.execute(
      [makeCall("file_read", "c1", { path: "/tmp/test.ts" }), makeCall("unknown_tool", "c2")],
      context,
    );

    expect(result.executedCount).toBe(1);
    expect(result.rejectedCount).toBe(1);
    expect(result.results).toHaveLength(2);
  });

  it("should handle tool execution failure gracefully", async () => {
    const registry = makeRegistry();
    const pipeline = new ToolPipeline(registry);
    const context = makeContext();

    const result = await pipeline.execute([makeCall("failing_tool", "c1")], context);

    expect(result.executedCount).toBe(1);
    expect(result.results).toHaveLength(1);
    expect(result.results[0].isError).toBe(true);
    expect(result.results[0].output).toContain("failed");
  });

  it("should execute multiple parallel calls", async () => {
    const registry = makeRegistry();
    const pipeline = new ToolPipeline(registry);
    const context = makeContext();

    const result = await pipeline.execute(
      [
        makeCall("file_read", "c1", { path: "/tmp/a.ts" }),
        makeCall("file_read", "c2", { path: "/tmp/b.ts" }),
        makeCall("file_read", "c3", { path: "/tmp/c.ts" }),
      ],
      context,
    );

    expect(result.executedCount).toBe(3);
    expect(result.rejectedCount).toBe(0);
    expect(result.results).toHaveLength(3);
  });

  it("should handle empty call list", async () => {
    const registry = makeRegistry();
    const pipeline = new ToolPipeline(registry);
    const context = makeContext();

    const result = await pipeline.execute([], context);

    expect(result.executedCount).toBe(0);
    expect(result.rejectedCount).toBe(0);
    expect(result.results).toHaveLength(0);
  });

  it("should attach postprocess metadata", async () => {
    const registry = makeRegistry();
    const pipeline = new ToolPipeline(registry);
    const context = makeContext();

    const result = await pipeline.execute(
      [makeCall("file_read", "c1", { path: "/tmp/test.ts" })],
      context,
      { postprocess: { metadataAttach: true } },
    );

    expect(result.results[0].metadata).toBeDefined();
    expect(result.results[0].metadata?.["executionTimeMs"]).toBeGreaterThanOrEqual(0);
    expect(result.results[0].metadata?.["truncated"]).toBe(false);
  });

  it("should respect permission check in context", async () => {
    const registry = makeRegistry();
    const pipeline = new ToolPipeline(registry);
    const context = makeContext({
      checkPermission: async () => ({
        allowed: false,
        reason: "Blocked by policy",
      }),
    });

    const result = await pipeline.execute(
      [makeCall("file_read", "c1", { path: "/tmp/test.ts" })],
      context,
    );

    expect(result.rejectedCount).toBe(1);
    expect(result.executedCount).toBe(0);
    expect(result.results[0].output).toContain("Blocked by policy");
  });

  it("should apply postprocess truncation for large outputs", async () => {
    const registry = new ToolRegistry();
    registry.register({
      name: "large_output_tool",
      description: "Returns large output",
      parameterSchema: z.object({}),
      permissionLevel: "safe",
      execute: async () => ({
        output: "x".repeat(10000),
        isError: false,
      }),
    });

    const pipeline = new ToolPipeline(registry);
    const context = makeContext();

    const result = await pipeline.execute([makeCall("large_output_tool", "c1")], context, {
      postprocess: {
        maxOutputLength: 500,
        spilloverEnabled: false,
      },
    });

    expect(result.results[0].output.length).toBeLessThan(10000);
    expect(result.results[0].metadata?.["truncated"]).toBe(true);
  });
});
