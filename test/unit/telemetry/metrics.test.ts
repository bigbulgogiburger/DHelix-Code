import { describe, it, expect, beforeEach } from "vitest";
import { MetricsCollector, COUNTERS, HISTOGRAMS } from "../../../src/telemetry/metrics.js";

describe("MetricsCollector", () => {
  let collector: MetricsCollector;

  beforeEach(() => {
    collector = new MetricsCollector();
  });

  describe("counters", () => {
    it("should increment counter", () => {
      collector.increment(COUNTERS.tokensUsed, 1, { type: "input", model: "gpt-4" });
      const value = collector.getCounter(COUNTERS.tokensUsed, { type: "input", model: "gpt-4" });
      expect(value).toBe(1);
    });

    it("should increment by specified amount", () => {
      collector.increment(COUNTERS.tokensUsed, 100, { type: "input", model: "gpt-4" });
      const value = collector.getCounter(COUNTERS.tokensUsed, { type: "input", model: "gpt-4" });
      expect(value).toBe(100);
    });

    it("should accumulate increments", () => {
      collector.increment(COUNTERS.tokensUsed, 50, { type: "input", model: "gpt-4" });
      collector.increment(COUNTERS.tokensUsed, 30, { type: "input", model: "gpt-4" });
      const value = collector.getCounter(COUNTERS.tokensUsed, { type: "input", model: "gpt-4" });
      expect(value).toBe(80);
    });

    it("should return 0 for unset counter", () => {
      const value = collector.getCounter(COUNTERS.errors, { category: "tool" });
      expect(value).toBe(0);
    });

    it("should track different label sets independently", () => {
      collector.increment(COUNTERS.tokensUsed, 100, { type: "input", model: "gpt-4" });
      collector.increment(COUNTERS.tokensUsed, 200, { type: "output", model: "gpt-4" });
      expect(collector.getCounter(COUNTERS.tokensUsed, { type: "input", model: "gpt-4" })).toBe(
        100,
      );
      expect(collector.getCounter(COUNTERS.tokensUsed, { type: "output", model: "gpt-4" })).toBe(
        200,
      );
    });

    it("should default increment to 1", () => {
      collector.increment(COUNTERS.sessionsTotal);
      collector.increment(COUNTERS.sessionsTotal);
      expect(collector.getCounter(COUNTERS.sessionsTotal)).toBe(2);
    });
  });

  describe("histograms", () => {
    it("should record histogram observations", () => {
      collector.observe(HISTOGRAMS.llmLatency, 150, { model: "gpt-4" });
      collector.observe(HISTOGRAMS.llmLatency, 200, { model: "gpt-4" });
      const data = collector.getHistogramData();
      expect(data.size).toBeGreaterThan(0);
    });

    it("should record with default labels", () => {
      collector.observe(HISTOGRAMS.sessionDuration, 60);
      const data = collector.getHistogramData();
      expect(data.size).toBe(1);
    });
  });

  describe("getCounterData", () => {
    it("should return all counter data", () => {
      collector.increment(COUNTERS.sessionsTotal, 1);
      const data = collector.getCounterData();
      expect(data.size).toBeGreaterThan(0);
    });

    it("should return empty map initially", () => {
      const data = collector.getCounterData();
      expect(data.size).toBe(0);
    });
  });

  describe("reset", () => {
    it("should reset all metrics", () => {
      collector.increment(COUNTERS.tokensUsed, 100, { type: "input", model: "gpt-4" });
      collector.observe(HISTOGRAMS.llmLatency, 150, { model: "gpt-4" });
      collector.reset();
      expect(collector.getCounter(COUNTERS.tokensUsed, { type: "input", model: "gpt-4" })).toBe(0);
      expect(collector.getCounterData().size).toBe(0);
      expect(collector.getHistogramData().size).toBe(0);
    });
  });
});
