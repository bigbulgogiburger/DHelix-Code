import { describe, it, expect, beforeEach } from "vitest";
import { runtimeMetrics } from "../../../src/utils/metrics.js";

describe("RuntimeMetrics", () => {
  beforeEach(() => {
    runtimeMetrics.reset();
  });

  it("should start with zero counters", () => {
    const snap = runtimeMetrics.snapshot();
    expect(snap.totalIterations).toBe(0);
    expect(snap.totalToolCalls).toBe(0);
    expect(snap.totalTokens).toBe(0);
    expect(snap.totalErrors).toBe(0);
  });

  it("should track iterations", () => {
    runtimeMetrics.recordIteration();
    runtimeMetrics.recordIteration();
    expect(runtimeMetrics.snapshot().totalIterations).toBe(2);
  });

  it("should track tool calls", () => {
    runtimeMetrics.recordToolCalls(5);
    runtimeMetrics.recordToolCalls(3);
    expect(runtimeMetrics.snapshot().totalToolCalls).toBe(8);
  });

  it("should track tokens", () => {
    runtimeMetrics.recordTokens(1000);
    runtimeMetrics.recordTokens(500);
    expect(runtimeMetrics.snapshot().totalTokens).toBe(1500);
  });

  it("should track errors", () => {
    runtimeMetrics.recordError();
    expect(runtimeMetrics.snapshot().totalErrors).toBe(1);
  });

  it("should track active session", () => {
    runtimeMetrics.setActiveSession("session-123");
    expect(runtimeMetrics.snapshot().activeSessionId).toBe("session-123");
  });

  it("should report memory usage", () => {
    const snap = runtimeMetrics.snapshot();
    expect(snap.memoryUsageMB).toBeGreaterThan(0);
  });

  it("should report uptime", () => {
    const snap = runtimeMetrics.snapshot();
    expect(snap.uptimeMs).toBeGreaterThanOrEqual(0);
  });

  it("should reset all counters", () => {
    runtimeMetrics.recordIteration();
    runtimeMetrics.recordToolCalls(10);
    runtimeMetrics.recordTokens(5000);
    runtimeMetrics.recordError();
    runtimeMetrics.setActiveSession("s1");
    runtimeMetrics.reset();

    const snap = runtimeMetrics.snapshot();
    expect(snap.totalIterations).toBe(0);
    expect(snap.totalToolCalls).toBe(0);
    expect(snap.totalTokens).toBe(0);
    expect(snap.totalErrors).toBe(0);
    expect(snap.activeSessionId).toBeUndefined();
  });
});
