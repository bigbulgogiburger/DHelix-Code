/**
 * RetryEngine 테스트
 *
 * RetryEngine의 retry/correction 흐름, 에러 분류 기반 재시도,
 * pre-correction과 post-correction 통합을 검증합니다.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { z } from "zod";
import { RetryEngine, calculateBackoff } from "../../../src/tools/retry-engine.js";
import { ToolExecutionError } from "../../../src/tools/errors.js";
import {
  type ToolDefinition,
  type ToolContext,
  type ToolResult,
} from "../../../src/tools/types.js";

/** 테스트용 도구 컨텍스트 생성 */
function createTestContext(overrides: Partial<ToolContext> = {}): ToolContext {
  return {
    workingDirectory: "/test",
    abortSignal: new AbortController().signal,
    timeoutMs: 30000,
    platform: "darwin",
    ...overrides,
  };
}

/** 테스트용 도구 정의 생성 */
function createTestTool(
  executeFn: (params: Record<string, unknown>, ctx: ToolContext) => Promise<ToolResult>,
  name = "test_tool",
): ToolDefinition<Record<string, unknown>> {
  return {
    name,
    description: "Test tool",
    parameterSchema: z.object({
      input: z.string().optional(),
    }),
    permissionLevel: "safe",
    execute: executeFn,
  };
}

describe("RetryEngine", () => {
  let engine: RetryEngine;

  beforeEach(() => {
    engine = new RetryEngine();
  });

  describe("successful execution", () => {
    it("should execute tool successfully on first attempt", async () => {
      const tool = createTestTool(async () => ({ output: "success", isError: false }));
      const context = createTestContext();

      const result = await engine.executeWithRetry(tool, { input: "hello" }, context);
      expect(result.output).toBe("success");
      expect(result.isError).toBe(false);
    });

    it("should pass validated args to tool execute", async () => {
      const executeFn = vi.fn(async () => ({ output: "ok", isError: false }));
      const tool = createTestTool(executeFn);
      const context = createTestContext();

      await engine.executeWithRetry(tool, { input: "test" }, context);
      expect(executeFn).toHaveBeenCalledOnce();
      expect(executeFn.mock.calls[0][0]).toEqual({ input: "test" });
    });
  });

  describe("retry on transient errors", () => {
    it("should retry on transient errors", async () => {
      let attempts = 0;
      const tool = createTestTool(async () => {
        attempts++;
        if (attempts === 1) {
          throw new Error("ECONNRESET: connection reset");
        }
        return { output: "recovered", isError: false };
      });
      const context = createTestContext();

      const result = await engine.executeWithRetry(tool, { input: "test" }, context, {
        maxRetries: 2,
        baseDelayMs: 1, // fast for tests
      });

      expect(result.output).toBe("recovered");
      expect(attempts).toBe(2);
    });

    it("should throw after max retries exhausted for transient errors", async () => {
      const tool = createTestTool(async () => {
        throw new Error("ECONNRESET: connection reset");
      });
      const context = createTestContext();

      await expect(
        engine.executeWithRetry(tool, { input: "test" }, context, {
          maxRetries: 1,
          baseDelayMs: 1,
        }),
      ).rejects.toThrow(ToolExecutionError);
    });
  });

  describe("non-retryable errors", () => {
    it("should not retry permission denied errors", async () => {
      let attempts = 0;
      const tool = createTestTool(async () => {
        attempts++;
        throw new Error("EACCES: permission denied");
      });
      const context = createTestContext();

      await expect(
        engine.executeWithRetry(tool, { input: "test" }, context, { maxRetries: 3 }),
      ).rejects.toThrow(ToolExecutionError);

      expect(attempts).toBe(1);
    });

    it("should not retry aborted errors", async () => {
      let attempts = 0;
      const tool = createTestTool(async () => {
        attempts++;
        const err = new Error("The operation was aborted");
        err.name = "AbortError";
        throw err;
      });
      const context = createTestContext();

      await expect(
        engine.executeWithRetry(tool, { input: "test" }, context, { maxRetries: 3 }),
      ).rejects.toThrow(ToolExecutionError);

      expect(attempts).toBe(1);
    });
  });

  describe("error classification in retry", () => {
    it("should classify thrown ToolExecutionError correctly", async () => {
      const tool = createTestTool(async () => {
        throw new Error("EACCES: permission denied");
      });
      const context = createTestContext();

      try {
        await engine.executeWithRetry(tool, { input: "test" }, context);
        expect.fail("Should have thrown");
      } catch (err) {
        expect(err).toBeInstanceOf(ToolExecutionError);
        expect((err as ToolExecutionError).kind).toBe("permission_denied");
        expect((err as ToolExecutionError).retryable).toBe(false);
      }
    });

    it("should classify internal errors for unknown exceptions", async () => {
      const tool = createTestTool(async () => {
        throw new Error("Something completely unexpected");
      });
      const context = createTestContext();

      try {
        await engine.executeWithRetry(tool, { input: "test" }, context);
        expect.fail("Should have thrown");
      } catch (err) {
        expect(err).toBeInstanceOf(ToolExecutionError);
        expect((err as ToolExecutionError).kind).toBe("internal");
      }
    });
  });

  describe("validation error handling", () => {
    it("should throw classified validation error for invalid args", async () => {
      const tool: ToolDefinition<{ required_field: string }> = {
        name: "strict_tool",
        description: "Requires a field",
        parameterSchema: z.object({
          required_field: z.string(),
        }),
        permissionLevel: "safe",
        execute: async () => ({ output: "ok", isError: false }),
      };
      const context = createTestContext();

      // Pass empty args which should fail Zod validation
      await expect(engine.executeWithRetry(tool, {}, context)).rejects.toThrow();
    });
  });
});

describe("calculateBackoff", () => {
  it("should return exponential delay", () => {
    // With random jitter, we check the minimum expected value
    const delay0 = calculateBackoff(0, 1000);
    expect(delay0).toBeGreaterThanOrEqual(1000);
    expect(delay0).toBeLessThan(1500);

    const delay1 = calculateBackoff(1, 1000);
    expect(delay1).toBeGreaterThanOrEqual(2000);
    expect(delay1).toBeLessThan(2500);

    const delay2 = calculateBackoff(2, 1000);
    expect(delay2).toBeGreaterThanOrEqual(4000);
    expect(delay2).toBeLessThan(4500);
  });

  it("should handle zero base delay", () => {
    const delay = calculateBackoff(0, 0);
    expect(delay).toBeGreaterThanOrEqual(0);
    expect(delay).toBeLessThan(500);
  });
});
