/**
 * Scheduler stage 단위 테스트
 */
import { describe, it, expect } from "vitest";
import { scheduleCalls } from "../../../../src/tools/pipeline/scheduler.js";
import { type ExtractedToolCall } from "../../../../src/tools/types.js";

function makeCall(
  name: string,
  id?: string,
  args: Record<string, unknown> = {},
): ExtractedToolCall {
  return { id: id ?? `call-${name}`, name, arguments: args };
}

describe("scheduleCalls", () => {
  it("should return empty groups for empty calls", () => {
    const result = scheduleCalls([]);
    expect(result.groups).toHaveLength(0);
    expect(result.order).toBe("parallel");
  });

  it("should return single group for single call", () => {
    const calls = [makeCall("file_read")];
    const result = scheduleCalls(calls);

    expect(result.groups).toHaveLength(1);
    expect(result.groups[0].calls).toHaveLength(1);
    expect(result.order).toBe("parallel");
  });

  it("should group read-only tools together", () => {
    const calls = [
      makeCall("file_read", "c1"),
      makeCall("grep_search", "c2"),
      makeCall("glob_search", "c3"),
    ];
    const result = scheduleCalls(calls);

    expect(result.groups).toHaveLength(1);
    expect(result.groups[0].calls).toHaveLength(3);
    expect(result.groups[0].mode).toBe("parallel");
  });

  it("should separate writes to same file into different groups", () => {
    const calls = [
      makeCall("file_write", "c1", { file_path: "/tmp/a.ts" }),
      makeCall("file_write", "c2", { file_path: "/tmp/a.ts" }),
    ];
    const result = scheduleCalls(calls);

    expect(result.groups).toHaveLength(2);
    expect(result.groups[0].calls).toHaveLength(1);
    expect(result.groups[1].calls).toHaveLength(1);
  });

  it("should allow parallel writes to different files", () => {
    const calls = [
      makeCall("file_write", "c1", { file_path: "/tmp/a.ts" }),
      makeCall("file_write", "c2", { file_path: "/tmp/b.ts" }),
    ];
    const result = scheduleCalls(calls);

    expect(result.groups).toHaveLength(1);
    expect(result.groups[0].calls).toHaveLength(2);
  });

  it("should isolate LSP tools into sequential groups", () => {
    const calls = [
      makeCall("file_read", "c1"),
      makeCall("goto_definition", "c2"),
      makeCall("file_read", "c3"),
    ];
    const result = scheduleCalls(calls);

    // file_read -> group 1 (parallel), goto_definition -> group 2 (sequential), file_read -> group 3 (parallel)
    expect(result.groups.length).toBeGreaterThanOrEqual(2);
    const lspGroup = result.groups.find((g) =>
      g.calls.some((c) => c.name === "goto_definition"),
    );
    expect(lspGroup?.mode).toBe("sequential");
  });

  it("should keep bash_exec in parallel group", () => {
    const calls = [
      makeCall("file_read", "c1"),
      makeCall("bash_exec", "c2"),
    ];
    const result = scheduleCalls(calls);

    expect(result.groups).toHaveLength(1);
    expect(result.groups[0].calls).toHaveLength(2);
  });

  it("should handle mixed read/write/LSP calls", () => {
    const calls = [
      makeCall("file_read", "c1"),
      makeCall("file_write", "c2", { file_path: "/tmp/a.ts" }),
      makeCall("goto_definition", "c3"),
      makeCall("file_read", "c4"),
    ];
    const result = scheduleCalls(calls);

    // At least 2 groups due to LSP isolation
    expect(result.groups.length).toBeGreaterThanOrEqual(2);
    expect(result.order).toBe("mixed");
  });

  it("should extract file_path from different argument names", () => {
    const calls = [
      makeCall("file_edit", "c1", { path: "/tmp/a.ts" }),
      makeCall("file_edit", "c2", { path: "/tmp/a.ts" }),
    ];
    const result = scheduleCalls(calls);

    expect(result.groups).toHaveLength(2);
  });
});
