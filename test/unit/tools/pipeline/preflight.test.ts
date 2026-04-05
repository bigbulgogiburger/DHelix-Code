/**
 * Preflight stage 단위 테스트
 */
import { describe, it, expect, vi } from "vitest";
import {
  runPreflight,
  type PreflightContext,
  type PreflightCheck,
} from "../../../../src/tools/pipeline/preflight.js";
import { type ExtractedToolCall } from "../../../../src/tools/types.js";
import { ToolRegistry } from "../../../../src/tools/registry.js";

function makeCall(name: string, id = "call-1", args: Record<string, unknown> = {}): ExtractedToolCall {
  return { id, name, arguments: args };
}

function makeContext(overrides: Partial<PreflightContext> = {}): PreflightContext {
  const registry = new ToolRegistry();
  // Register a dummy tool for capability check
  registry.register({
    name: "file_read",
    description: "Read a file",
    parameterSchema: { parse: (v: unknown) => v } as never,
    permissionLevel: "safe",
    execute: async () => ({ output: "ok", isError: false }),
  });
  registry.register({
    name: "bash_exec",
    description: "Execute bash",
    parameterSchema: { parse: (v: unknown) => v } as never,
    permissionLevel: "confirm",
    execute: async () => ({ output: "ok", isError: false }),
  });

  return {
    registry,
    toolContext: {
      workingDirectory: "/tmp",
      abortSignal: new AbortController().signal,
      timeoutMs: 30000,
      platform: "darwin",
    },
    enableGuardrails: false,
    ...overrides,
  };
}

describe("runPreflight", () => {
  it("should pass all calls when all checks succeed", async () => {
    const calls = [makeCall("file_read"), makeCall("bash_exec", "call-2")];
    const context = makeContext();

    const result = await runPreflight(calls, context);

    expect(result.passed).toHaveLength(2);
    expect(result.rejected).toHaveLength(0);
  });

  it("should reject unknown tools", async () => {
    const calls = [makeCall("unknown_tool")];
    const context = makeContext();

    const result = await runPreflight(calls, context);

    expect(result.passed).toHaveLength(0);
    expect(result.rejected).toHaveLength(1);
    expect(result.rejected[0].output).toContain("Unknown tool");
  });

  it("should reject calls when permission check fails", async () => {
    const calls = [makeCall("file_read")];
    const context = makeContext({
      toolContext: {
        workingDirectory: "/tmp",
        abortSignal: new AbortController().signal,
        timeoutMs: 30000,
        platform: "darwin",
        checkPermission: async () => ({
          allowed: false,
          reason: "User denied",
        }),
      },
    });

    const result = await runPreflight(calls, context);

    expect(result.passed).toHaveLength(0);
    expect(result.rejected).toHaveLength(1);
    expect(result.rejected[0].output).toContain("User denied");
  });

  it("should support custom preflight checks", async () => {
    const customCheck: PreflightCheck = {
      name: "custom-block",
      check: async () => ({
        allowed: false,
        reason: "Custom rejection",
      }),
    };

    const calls = [makeCall("file_read")];
    const context = makeContext();

    const result = await runPreflight(calls, context, [customCheck]);

    expect(result.passed).toHaveLength(0);
    expect(result.rejected).toHaveLength(1);
    expect(result.rejected[0].output).toBe("Custom rejection");
  });

  it("should stop at first failing check", async () => {
    const checkA: PreflightCheck = {
      name: "check-a",
      check: vi.fn().mockResolvedValue({ allowed: false, reason: "A failed" }),
    };
    const checkB: PreflightCheck = {
      name: "check-b",
      check: vi.fn().mockResolvedValue({ allowed: true }),
    };

    const calls = [makeCall("file_read")];
    const context = makeContext();

    await runPreflight(calls, context, [checkA, checkB]);

    expect(checkA.check).toHaveBeenCalledTimes(1);
    expect(checkB.check).not.toHaveBeenCalled();
  });

  it("should handle empty call list", async () => {
    const context = makeContext();
    const result = await runPreflight([], context);

    expect(result.passed).toHaveLength(0);
    expect(result.rejected).toHaveLength(0);
  });

  it("should pass calls when permission callback allows", async () => {
    const calls = [makeCall("file_read")];
    const context = makeContext({
      toolContext: {
        workingDirectory: "/tmp",
        abortSignal: new AbortController().signal,
        timeoutMs: 30000,
        platform: "darwin",
        checkPermission: async () => ({ allowed: true }),
      },
    });

    const result = await runPreflight(calls, context);
    expect(result.passed).toHaveLength(1);
    expect(result.rejected).toHaveLength(0);
  });
});
