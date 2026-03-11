import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { setupNotificationTriggers } from "../../../src/utils/notification-triggers.js";
import { createEventEmitter } from "../../../src/utils/events.js";

// Mock the sendNotification function
vi.mock("../../../src/utils/notifications.js", () => ({
  sendNotification: vi.fn().mockResolvedValue(true),
}));

import { sendNotification } from "../../../src/utils/notifications.js";

const mockSendNotification = vi.mocked(sendNotification);

describe("setupNotificationTriggers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("should not send notification for short tasks", () => {
    const events = createEventEmitter();
    const cleanup = setupNotificationTriggers(events, { minDurationMs: 30000 });

    // Start agent loop
    events.emit("agent:iteration", { iteration: 1 });

    // Advance time by only 5 seconds
    vi.advanceTimersByTime(5000);

    // Complete the agent loop
    events.emit("agent:assistant-message", {
      content: "Done",
      toolCalls: [],
      iteration: 2,
      isFinal: true,
    });

    expect(mockSendNotification).not.toHaveBeenCalled();

    cleanup();
  });

  it("should send notification for long tasks exceeding minimum duration", () => {
    const events = createEventEmitter();
    const cleanup = setupNotificationTriggers(events, { minDurationMs: 30000 });

    // Start agent loop
    events.emit("agent:iteration", { iteration: 1 });

    // Advance time past the threshold
    vi.advanceTimersByTime(45000);

    // Complete the agent loop
    events.emit("agent:assistant-message", {
      content: "Task completed",
      toolCalls: [],
      iteration: 10,
      isFinal: true,
    });

    expect(mockSendNotification).toHaveBeenCalledWith({
      title: "dbcode",
      message: "Task completed in 45s",
      sound: false,
    });

    cleanup();
  });

  it("should not send notification for non-final assistant messages", () => {
    const events = createEventEmitter();
    const cleanup = setupNotificationTriggers(events, { minDurationMs: 1000 });

    events.emit("agent:iteration", { iteration: 1 });
    vi.advanceTimersByTime(5000);

    // Intermediate message (not final)
    events.emit("agent:assistant-message", {
      content: "Still working...",
      toolCalls: [{ id: "tc1", name: "bash_exec" }],
      iteration: 2,
      isFinal: false,
    });

    expect(mockSendNotification).not.toHaveBeenCalled();

    cleanup();
  });

  it("should send notification on LLM errors", () => {
    const events = createEventEmitter();
    const cleanup = setupNotificationTriggers(events);

    events.emit("llm:error", { error: new Error("Rate limit exceeded") });

    expect(mockSendNotification).toHaveBeenCalledWith({
      title: "dbcode — Error",
      message: "Rate limit exceeded",
      sound: false,
    });

    cleanup();
  });

  it("should truncate long error messages to 200 characters", () => {
    const events = createEventEmitter();
    const cleanup = setupNotificationTriggers(events);

    const longMessage = "x".repeat(300);
    events.emit("llm:error", { error: new Error(longMessage) });

    expect(mockSendNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        message: "x".repeat(200),
      }),
    );

    cleanup();
  });

  it("should include sound when configured", () => {
    const events = createEventEmitter();
    const cleanup = setupNotificationTriggers(events, {
      minDurationMs: 1000,
      sound: true,
    });

    events.emit("agent:iteration", { iteration: 1 });
    vi.advanceTimersByTime(5000);

    events.emit("agent:assistant-message", {
      content: "Done",
      toolCalls: [],
      iteration: 2,
      isFinal: true,
    });

    expect(mockSendNotification).toHaveBeenCalledWith(expect.objectContaining({ sound: true }));

    cleanup();
  });

  it("should do nothing when disabled", () => {
    const events = createEventEmitter();
    const cleanup = setupNotificationTriggers(events, { enabled: false });

    events.emit("agent:iteration", { iteration: 1 });
    vi.advanceTimersByTime(60000);

    events.emit("agent:assistant-message", {
      content: "Done",
      toolCalls: [],
      iteration: 5,
      isFinal: true,
    });

    events.emit("llm:error", { error: new Error("test") });

    expect(mockSendNotification).not.toHaveBeenCalled();

    cleanup();
  });

  it("should use default minDuration of 30 seconds when not specified", () => {
    const events = createEventEmitter();
    const cleanup = setupNotificationTriggers(events);

    events.emit("agent:iteration", { iteration: 1 });

    // 29 seconds — should not trigger
    vi.advanceTimersByTime(29000);
    events.emit("agent:assistant-message", {
      content: "Done",
      toolCalls: [],
      iteration: 2,
      isFinal: true,
    });

    expect(mockSendNotification).not.toHaveBeenCalled();

    cleanup();
  });

  it("should send notification at exactly the minimum duration", () => {
    const events = createEventEmitter();
    const cleanup = setupNotificationTriggers(events, { minDurationMs: 30000 });

    events.emit("agent:iteration", { iteration: 1 });
    vi.advanceTimersByTime(30000);

    events.emit("agent:assistant-message", {
      content: "Done",
      toolCalls: [],
      iteration: 3,
      isFinal: true,
    });

    expect(mockSendNotification).toHaveBeenCalledTimes(1);

    cleanup();
  });

  it("should only track start time from the first iteration", () => {
    const events = createEventEmitter();
    const cleanup = setupNotificationTriggers(events, { minDurationMs: 10000 });

    // First iteration sets the start time
    events.emit("agent:iteration", { iteration: 1 });
    vi.advanceTimersByTime(15000);

    // Later iterations should not reset the timer
    events.emit("agent:iteration", { iteration: 5 });
    vi.advanceTimersByTime(1000);

    events.emit("agent:assistant-message", {
      content: "Done",
      toolCalls: [],
      iteration: 5,
      isFinal: true,
    });

    // Duration should be 16s (from first iteration), not 1s (from iteration 5)
    expect(mockSendNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        message: "Task completed in 16s",
      }),
    );

    cleanup();
  });

  it("should reset start time after completion for next run", () => {
    const events = createEventEmitter();
    const cleanup = setupNotificationTriggers(events, { minDurationMs: 5000 });

    // First run — long enough to trigger notification
    events.emit("agent:iteration", { iteration: 1 });
    vi.advanceTimersByTime(10000);
    events.emit("agent:assistant-message", {
      content: "Done",
      toolCalls: [],
      iteration: 3,
      isFinal: true,
    });

    expect(mockSendNotification).toHaveBeenCalledTimes(1);
    mockSendNotification.mockClear();

    // Second run — too short
    events.emit("agent:iteration", { iteration: 1 });
    vi.advanceTimersByTime(2000);
    events.emit("agent:assistant-message", {
      content: "Quick",
      toolCalls: [],
      iteration: 1,
      isFinal: true,
    });

    expect(mockSendNotification).not.toHaveBeenCalled();

    cleanup();
  });

  it("should remove all event listeners on cleanup", () => {
    const events = createEventEmitter();
    const cleanup = setupNotificationTriggers(events, { minDurationMs: 1000 });

    cleanup();

    // After cleanup, events should have no effect
    events.emit("agent:iteration", { iteration: 1 });
    vi.advanceTimersByTime(5000);
    events.emit("agent:assistant-message", {
      content: "Done",
      toolCalls: [],
      iteration: 2,
      isFinal: true,
    });
    events.emit("llm:error", { error: new Error("test") });

    expect(mockSendNotification).not.toHaveBeenCalled();
  });

  it("should reset start time after LLM error", () => {
    const events = createEventEmitter();
    const cleanup = setupNotificationTriggers(events, { minDurationMs: 5000 });

    events.emit("agent:iteration", { iteration: 1 });
    vi.advanceTimersByTime(10000);

    // Error resets the start time
    events.emit("llm:error", { error: new Error("fail") });

    // Final message should not trigger since start was reset
    events.emit("agent:assistant-message", {
      content: "Recovered",
      toolCalls: [],
      iteration: 2,
      isFinal: true,
    });

    // Only the error notification should have been sent
    expect(mockSendNotification).toHaveBeenCalledTimes(1);
    expect(mockSendNotification).toHaveBeenCalledWith(
      expect.objectContaining({ title: "dbcode — Error" }),
    );

    cleanup();
  });
});
