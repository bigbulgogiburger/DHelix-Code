import { describe, it, expect, vi } from "vitest";
import { z } from "zod";
import { executeTool } from "../../../src/tools/executor.js";
import { type ToolDefinition } from "../../../src/tools/types.js";

function createRetryTool(
  executeFn: (params: { input: string }) => Promise<{ output: string; isError: boolean }>,
): ToolDefinition<{ input: string }> {
  return {
    name: "retry_test_tool",
    description: "test tool for retry",
    parameterSchema: z.object({ input: z.string() }),
    permissionLevel: "safe",
    execute: async (params, _ctx) => executeFn(params),
  };
}

describe("tool execution retry", () => {
  it("should retry on ECONNRESET", async () => {
    let callCount = 0;
    const tool = createRetryTool(async () => {
      callCount++;
      if (callCount === 1) {
        throw new Error("read ECONNRESET");
      }
      return { output: "success after retry", isError: false };
    });

    const result = await executeTool(tool, { input: "test" });
    expect(result.output).toBe("success after retry");
    expect(result.isError).toBe(false);
    expect(callCount).toBe(2);
  });

  it("should retry on ETIMEDOUT", async () => {
    let callCount = 0;
    const tool = createRetryTool(async () => {
      callCount++;
      if (callCount === 1) {
        throw new Error("connect ETIMEDOUT 1.2.3.4:443");
      }
      return { output: "recovered", isError: false };
    });

    const result = await executeTool(tool, { input: "test" });
    expect(result.output).toBe("recovered");
    expect(callCount).toBe(2);
  });

  it("should retry on ENOTFOUND", async () => {
    let callCount = 0;
    const tool = createRetryTool(async () => {
      callCount++;
      if (callCount === 1) {
        throw new Error("getaddrinfo ENOTFOUND api.example.com");
      }
      return { output: "dns recovered", isError: false };
    });

    const result = await executeTool(tool, { input: "test" });
    expect(result.output).toBe("dns recovered");
    expect(callCount).toBe(2);
  });

  it("should not retry on non-transient errors", async () => {
    let callCount = 0;
    const tool = createRetryTool(async () => {
      callCount++;
      throw new TypeError("Cannot read properties of undefined");
    });

    const result = await executeTool(tool, { input: "test" });
    expect(result.isError).toBe(true);
    expect(result.output).toContain("Cannot read properties of undefined");
    expect(callCount).toBe(1);
  });

  it("should not retry on generic Error", async () => {
    let callCount = 0;
    const tool = createRetryTool(async () => {
      callCount++;
      throw new Error("Something went wrong");
    });

    const result = await executeTool(tool, { input: "test" });
    expect(result.isError).toBe(true);
    expect(callCount).toBe(1);
  });

  it("should fail after max retries on persistent transient error", async () => {
    let callCount = 0;
    const tool = createRetryTool(async () => {
      callCount++;
      throw new Error("connect ECONNRESET");
    });

    const result = await executeTool(tool, { input: "test" });
    expect(result.isError).toBe(true);
    expect(result.output).toContain("ECONNRESET");
    // 1 initial attempt + 1 retry = 2 total calls
    expect(callCount).toBe(2);
  });

  it("should retry on EPIPE", async () => {
    let callCount = 0;
    const tool = createRetryTool(async () => {
      callCount++;
      if (callCount === 1) {
        throw new Error("write EPIPE");
      }
      return { output: "pipe recovered", isError: false };
    });

    const result = await executeTool(tool, { input: "test" });
    expect(result.output).toBe("pipe recovered");
    expect(callCount).toBe(2);
  });

  it("should retry on EAI_AGAIN", async () => {
    let callCount = 0;
    const tool = createRetryTool(async () => {
      callCount++;
      if (callCount === 1) {
        throw new Error("getaddrinfo EAI_AGAIN api.example.com");
      }
      return { output: "dns retry recovered", isError: false };
    });

    const result = await executeTool(tool, { input: "test" });
    expect(result.output).toBe("dns retry recovered");
    expect(callCount).toBe(2);
  });
});
