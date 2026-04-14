import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  createTelemetryBridge,
  type TelemetryBridgeConfig,
} from "../../../src/telemetry/agent-telemetry-bridge.js";
import { MetricsCollector, COUNTERS, HISTOGRAMS } from "../../../src/telemetry/metrics.js";
import { type AppEventEmitter } from "../../../src/utils/events.js";

function createMockEvents(): AppEventEmitter {
  const listeners = new Map<string, Set<(...args: unknown[]) => void>>();
  return {
    on: vi.fn((event: string, handler: (...args: unknown[]) => void) => {
      if (!listeners.has(event)) listeners.set(event, new Set());
      listeners.get(event)!.add(handler);
    }),
    off: vi.fn((event: string, handler: (...args: unknown[]) => void) => {
      listeners.get(event)?.delete(handler);
    }),
    emit: vi.fn((event: string, data?: unknown) => {
      listeners.get(event)?.forEach((handler) => handler(data));
    }),
  } as unknown as AppEventEmitter;
}

describe("createTelemetryBridge", () => {
  let events: AppEventEmitter;
  let collector: MetricsCollector;
  let config: TelemetryBridgeConfig;

  beforeEach(() => {
    events = createMockEvents();
    collector = new MetricsCollector();
    config = { metricsCollector: collector, enabled: true };
  });

  it("should not register listeners when disabled", () => {
    const bridge = createTelemetryBridge(events, { ...config, enabled: false });
    expect(events.on).not.toHaveBeenCalled();
    bridge.dispose(); // no-op
  });

  it("should register event listeners when enabled", () => {
    createTelemetryBridge(events, config);
    expect(events.on).toHaveBeenCalledWith("llm:start", expect.any(Function));
    expect(events.on).toHaveBeenCalledWith("llm:usage", expect.any(Function));
    expect(events.on).toHaveBeenCalledWith("llm:complete", expect.any(Function));
    expect(events.on).toHaveBeenCalledWith("tool:start", expect.any(Function));
    expect(events.on).toHaveBeenCalledWith("tool:complete", expect.any(Function));
  });

  it("should record token usage on llm:usage event", () => {
    createTelemetryBridge(events, config);

    (events.emit as ReturnType<typeof vi.fn>)("llm:usage", {
      usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
      model: "gpt-4o",
    });

    expect(collector.getCounter(COUNTERS.tokensUsed, { type: "input", model: "gpt-4o" })).toBe(100);
    expect(collector.getCounter(COUNTERS.tokensUsed, { type: "output", model: "gpt-4o" })).toBe(50);
  });

  it("should record LLM latency on llm:start → llm:complete", () => {
    createTelemetryBridge(events, config);

    (events.emit as ReturnType<typeof vi.fn>)("llm:start", { iteration: 1 });
    (events.emit as ReturnType<typeof vi.fn>)("llm:complete", { tokenCount: 150 });

    const histogramData = collector.getHistogramData();
    const latencyKey = HISTOGRAMS.llmLatency.name;
    const entries = [...histogramData.entries()].filter(([k]) => k.startsWith(latencyKey));
    expect(entries.length).toBeGreaterThan(0);
  });

  it("should record LLM error count", () => {
    createTelemetryBridge(events, config);

    (events.emit as ReturnType<typeof vi.fn>)("llm:error", { error: new Error("test") });

    expect(collector.getCounter(COUNTERS.errors, { category: "llm" })).toBe(1);
  });

  it("should record tool invocation metrics", () => {
    createTelemetryBridge(events, config);

    (events.emit as ReturnType<typeof vi.fn>)("tool:start", { name: "file_read", id: "t1" });
    (events.emit as ReturnType<typeof vi.fn>)("tool:complete", {
      name: "file_read",
      id: "t1",
      isError: false,
    });

    expect(
      collector.getCounter(COUNTERS.toolInvocations, { tool: "file_read", status: "success" }),
    ).toBe(1);
  });

  it("should record tool error invocations", () => {
    createTelemetryBridge(events, config);

    (events.emit as ReturnType<typeof vi.fn>)("tool:start", { name: "bash_exec", id: "t2" });
    (events.emit as ReturnType<typeof vi.fn>)("tool:complete", {
      name: "bash_exec",
      id: "t2",
      isError: true,
    });

    expect(
      collector.getCounter(COUNTERS.toolInvocations, { tool: "bash_exec", status: "error" }),
    ).toBe(1);
  });

  it("should record tool duration histogram", () => {
    createTelemetryBridge(events, config);

    (events.emit as ReturnType<typeof vi.fn>)("tool:start", { name: "file_read", id: "t3" });
    (events.emit as ReturnType<typeof vi.fn>)("tool:complete", {
      name: "file_read",
      id: "t3",
      isError: false,
    });

    const histogramData = collector.getHistogramData();
    const durationKey = `${HISTOGRAMS.toolDuration.name}{tool=file_read}`;
    expect(histogramData.has(durationKey)).toBe(true);
  });

  it("should clean up listeners on dispose", () => {
    const bridge = createTelemetryBridge(events, config);
    bridge.dispose();

    expect(events.off).toHaveBeenCalledWith("llm:start", expect.any(Function));
    expect(events.off).toHaveBeenCalledWith("llm:usage", expect.any(Function));
    expect(events.off).toHaveBeenCalledWith("tool:start", expect.any(Function));
    expect(events.off).toHaveBeenCalledWith("tool:complete", expect.any(Function));
  });
});
