import { describe, it, expect, vi, beforeEach } from "vitest";
import { filterValidToolCalls } from "../../../src/core/agent-loop.js";
import { type ExtractedToolCall } from "../../../src/tools/types.js";
import { type AppEventEmitter } from "../../../src/utils/events.js";

// Mock dependencies that agent-loop.ts imports
vi.mock("../../../src/tools/executor.js", () => ({
  executeToolCall: vi.fn(),
}));

vi.mock("../../../src/llm/streaming.js", () => ({
  consumeStream: vi.fn(),
}));

vi.mock("../../../src/llm/token-counter.js", () => ({
  countTokens: vi.fn(() => 10),
  estimateTokens: vi.fn(() => 10),
  countMessageTokens: vi.fn(() => 50),
}));

/** Create a mock event emitter */
function createMockEmitter(): AppEventEmitter {
  return {
    emit: vi.fn(),
    on: vi.fn(),
    off: vi.fn(),
    all: new Map(),
  } as unknown as AppEventEmitter;
}

describe("filterValidToolCalls", () => {
  let events: AppEventEmitter;

  beforeEach(() => {
    vi.clearAllMocks();
    events = createMockEmitter();
  });

  it("should pass through tool calls with valid arguments", () => {
    const calls: readonly ExtractedToolCall[] = [
      { id: "tc-1", name: "file_read", arguments: { file_path: "/tmp/test.ts" } },
      { id: "tc-2", name: "bash_exec", arguments: { command: "ls" } },
    ];

    const result = filterValidToolCalls(calls, events);

    expect(result).toHaveLength(2);
    expect(result[0].id).toBe("tc-1");
    expect(result[1].id).toBe("tc-2");
  });

  it("should pass through tool calls with empty arguments (no-param tools)", () => {
    const calls: readonly ExtractedToolCall[] = [
      { id: "tc-1", name: "some_tool", arguments: {} },
    ];

    const result = filterValidToolCalls(calls, events);

    expect(result).toHaveLength(1);
  });

  it("should filter out tool calls with null arguments", () => {
    const calls: readonly ExtractedToolCall[] = [
      { id: "tc-1", name: "broken_tool", arguments: null as unknown as Record<string, unknown> },
    ];

    const result = filterValidToolCalls(calls, events);

    expect(result).toHaveLength(0);
    expect(events.emit).toHaveBeenCalledWith("llm:error", {
      error: expect.objectContaining({
        message: expect.stringContaining("Dropped incomplete tool call"),
      }),
    });
  });

  it("should filter out tool calls with undefined arguments", () => {
    const calls: readonly ExtractedToolCall[] = [
      { id: "tc-1", name: "broken_tool", arguments: undefined as unknown as Record<string, unknown> },
    ];

    const result = filterValidToolCalls(calls, events);

    expect(result).toHaveLength(0);
  });

  it("should filter out tool calls with non-object arguments", () => {
    const calls: readonly ExtractedToolCall[] = [
      { id: "tc-1", name: "broken_tool", arguments: "not an object" as unknown as Record<string, unknown> },
    ];

    const result = filterValidToolCalls(calls, events);

    expect(result).toHaveLength(0);
  });

  it("should emit llm:error for each filtered tool call", () => {
    const calls: readonly ExtractedToolCall[] = [
      { id: "tc-1", name: "valid_tool", arguments: { x: 1 } },
      { id: "tc-2", name: "bad_tool", arguments: null as unknown as Record<string, unknown> },
      { id: "tc-3", name: "good_tool", arguments: { y: 2 } },
    ];

    const result = filterValidToolCalls(calls, events);

    expect(result).toHaveLength(2);
    expect(result[0].id).toBe("tc-1");
    expect(result[1].id).toBe("tc-3");

    // Only one error event for the filtered call
    const errorCalls = (events.emit as ReturnType<typeof vi.fn>).mock.calls.filter(
      (c: unknown[]) => c[0] === "llm:error",
    );
    expect(errorCalls).toHaveLength(1);
    expect(errorCalls[0][1].error.message).toContain("bad_tool");
  });

  it("should return empty array when all calls are invalid", () => {
    const calls: readonly ExtractedToolCall[] = [
      { id: "tc-1", name: "a", arguments: null as unknown as Record<string, unknown> },
      { id: "tc-2", name: "b", arguments: undefined as unknown as Record<string, unknown> },
    ];

    const result = filterValidToolCalls(calls, events);

    expect(result).toHaveLength(0);
  });

  it("should handle empty input", () => {
    const result = filterValidToolCalls([], events);

    expect(result).toHaveLength(0);
    expect(events.emit).not.toHaveBeenCalled();
  });

  it("should pass through tool calls with nested object arguments", () => {
    const calls: readonly ExtractedToolCall[] = [
      {
        id: "tc-1",
        name: "complex_tool",
        arguments: {
          nested: { deep: { value: 42 } },
          array: [1, 2, 3],
        },
      },
    ];

    const result = filterValidToolCalls(calls, events);

    expect(result).toHaveLength(1);
    expect(result[0].arguments).toEqual({
      nested: { deep: { value: 42 } },
      array: [1, 2, 3],
    });
  });
});
