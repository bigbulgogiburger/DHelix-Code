import { describe, it, expect, beforeEach } from "vitest";
import { EventBuffer } from "../../../src/telemetry/events.js";

describe("EventBuffer", () => {
  let buffer: EventBuffer;

  beforeEach(() => {
    buffer = new EventBuffer(100);
  });

  it("should record events", () => {
    buffer.record({
      type: "tool_decision",
      timestamp: Date.now(),
      data: { tool: "file_read", decision: "allowed" },
    });
    expect(buffer.peek()).toHaveLength(1);
  });

  it("should flush events and clear buffer", () => {
    buffer.record({
      type: "tool_decision",
      timestamp: Date.now(),
      data: { tool: "file_read", decision: "allowed" },
    });
    buffer.record({
      type: "error",
      timestamp: Date.now(),
      data: { message: "test error" },
    });

    const flushed = buffer.flush();
    expect(flushed).toHaveLength(2);
    expect(buffer.peek()).toHaveLength(0);
  });

  it("should respect max buffer size", () => {
    const smallBuffer = new EventBuffer(3);
    for (let i = 0; i < 5; i++) {
      smallBuffer.record({
        type: "tool_decision",
        timestamp: Date.now(),
        data: { index: i },
      });
    }
    expect(smallBuffer.peek()).toHaveLength(3);
  });

  it("should preserve event order with FIFO eviction", () => {
    const smallBuffer = new EventBuffer(2);
    smallBuffer.record({ type: "error", timestamp: 1, data: { n: 1 } });
    smallBuffer.record({ type: "error", timestamp: 2, data: { n: 2 } });
    smallBuffer.record({ type: "error", timestamp: 3, data: { n: 3 } });

    const events = smallBuffer.peek();
    expect(events).toHaveLength(2);
    // Oldest event should be evicted
    expect(events[0].data).toEqual({ n: 2 });
    expect(events[1].data).toEqual({ n: 3 });
  });

  it("should return empty array on flush when empty", () => {
    expect(buffer.flush()).toHaveLength(0);
  });

  it("should handle peek without modifying state", () => {
    buffer.record({ type: "error", timestamp: Date.now(), data: {} });
    buffer.peek();
    buffer.peek();
    expect(buffer.flush()).toHaveLength(1);
  });
});
