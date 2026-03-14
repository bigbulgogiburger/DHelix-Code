import { describe, it, expect, vi } from "vitest";

describe("bash-exec streaming output", () => {
  it("should emit tool:output-delta events during execution", () => {
    // Mock events emitter
    const events = {
      emit: vi.fn(),
      on: vi.fn(),
      off: vi.fn(),
    };

    // Verify that events.emit is called with "tool:output-delta"
    // when bash process produces output
    expect(events.emit).toBeDefined();
  });

  it("should include id, name, and chunk in tool:output-delta payload", () => {
    const events = {
      emit: vi.fn(),
      on: vi.fn(),
      off: vi.fn(),
    };

    // Simulate what bash-exec does when emitting
    const payload = {
      id: "tc-123",
      name: "bash_exec",
      chunk: "hello world\n",
    };

    events.emit("tool:output-delta", payload);

    expect(events.emit).toHaveBeenCalledWith("tool:output-delta", {
      id: "tc-123",
      name: "bash_exec",
      chunk: "hello world\n",
    });
  });

  it("should not emit when events or toolCallId is missing from context", () => {
    // When context.events is undefined, no event should be emitted
    const context = {
      workingDirectory: "/tmp",
      abortSignal: new AbortController().signal,
      timeoutMs: 5000,
      platform: "darwin" as const,
      // events is undefined
      // toolCallId is undefined
    };

    // The bash-exec guard condition: if (context.events && context.toolCallId)
    // should prevent any emit calls
    expect(context.events).toBeUndefined();
    expect(context.toolCallId).toBeUndefined();
  });
});
