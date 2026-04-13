import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  OtlpExporter,
  type OtlpExporterConfig,
  type MetricPoint,
} from "../../../src/utils/otlp-exporter.js";

// Mock global fetch
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

function makeConfig(overrides?: Partial<OtlpExporterConfig>): OtlpExporterConfig {
  return {
    endpoint: "http://localhost:4318",
    serviceName: "dhelix-code",
    exportIntervalMs: 100,
    ...overrides,
  };
}

function makeMetricPoint(overrides?: Partial<MetricPoint>): MetricPoint {
  return {
    name: "llm.tokens.total",
    value: 1024,
    unit: "tokens",
    attributes: { model: "gpt-4o" },
    timestamp: 1712320800000,
    ...overrides,
  };
}

describe("OtlpExporter", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockResolvedValue({ ok: true, status: 200 });
  });

  describe("recordMetric()", () => {
    it("should add metric point to buffer", async () => {
      const exporter = new OtlpExporter(makeConfig());
      exporter.recordMetric(makeMetricPoint());

      // Flush and verify fetch was called with payload containing the metric
      await exporter.flush();
      expect(mockFetch).toHaveBeenCalledOnce();

      const body = JSON.parse(mockFetch.mock.calls[0][1].body as string);
      const metrics = body.resourceMetrics[0].scopeMetrics[0].metrics;
      expect(metrics[0].name).toBe("llm.tokens.total");
    });

    it("should buffer multiple metrics", async () => {
      const exporter = new OtlpExporter(makeConfig());
      exporter.recordMetric(makeMetricPoint({ name: "metric.a", value: 1 }));
      exporter.recordMetric(makeMetricPoint({ name: "metric.b", value: 2 }));

      await exporter.flush();

      const body = JSON.parse(mockFetch.mock.calls[0][1].body as string);
      const metrics = body.resourceMetrics[0].scopeMetrics[0].metrics;
      const names = metrics.map((m: { name: string }) => m.name);
      expect(names).toContain("metric.a");
      expect(names).toContain("metric.b");
    });

    it("should ignore recordMetric after dispose", async () => {
      const exporter = new OtlpExporter(makeConfig());
      exporter.dispose();
      exporter.recordMetric(makeMetricPoint());

      // Buffer was cleared by dispose, no metrics to flush
      mockFetch.mockClear();
      // The dispose itself may have triggered a flush; clear calls
      mockFetch.mockClear();
      await exporter.flush();
      expect(mockFetch).not.toHaveBeenCalled();
    });
  });

  describe("flush()", () => {
    it("should not call fetch when buffer is empty", async () => {
      const exporter = new OtlpExporter(makeConfig());
      await exporter.flush();
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("should POST to /v1/metrics endpoint", async () => {
      const exporter = new OtlpExporter(makeConfig());
      exporter.recordMetric(makeMetricPoint());
      await exporter.flush();

      expect(mockFetch).toHaveBeenCalledWith(
        "http://localhost:4318/v1/metrics",
        expect.objectContaining({ method: "POST" }),
      );
    });

    it("should include Content-Type: application/json header", async () => {
      const exporter = new OtlpExporter(makeConfig());
      exporter.recordMetric(makeMetricPoint());
      await exporter.flush();

      const headers = mockFetch.mock.calls[0][1].headers;
      expect(headers["Content-Type"]).toBe("application/json");
    });

    it("should include custom headers from config", async () => {
      const exporter = new OtlpExporter(
        makeConfig({ headers: { Authorization: "Bearer token123" } }),
      );
      exporter.recordMetric(makeMetricPoint());
      await exporter.flush();

      const headers = mockFetch.mock.calls[0][1].headers;
      expect(headers.Authorization).toBe("Bearer token123");
    });

    it("should clear buffer after flush", async () => {
      const exporter = new OtlpExporter(makeConfig());
      exporter.recordMetric(makeMetricPoint());
      await exporter.flush();

      mockFetch.mockClear();
      await exporter.flush();
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("should not throw when fetch fails", async () => {
      mockFetch.mockRejectedValue(new Error("Network error"));
      const exporter = new OtlpExporter(makeConfig());
      exporter.recordMetric(makeMetricPoint());
      await expect(exporter.flush()).resolves.toBeUndefined();
    });
  });

  describe("buildOtlpPayload()", () => {
    it("should set service.name resource attribute", () => {
      const exporter = new OtlpExporter(makeConfig({ serviceName: "my-service" }));
      const payload = exporter.buildOtlpPayload([makeMetricPoint()]) as {
        resourceMetrics: Array<{
          resource: { attributes: Array<{ key: string; value: { stringValue: string } }> };
          scopeMetrics: Array<{
            metrics: Array<{ name: string; unit: string; gauge: { dataPoints: unknown[] } }>;
          }>;
        }>;
      };

      const serviceAttr = payload.resourceMetrics[0].resource.attributes.find(
        (a) => a.key === "service.name",
      );
      expect(serviceAttr?.value.stringValue).toBe("my-service");
    });

    it("should convert metric point to gauge data point", () => {
      const exporter = new OtlpExporter(makeConfig());
      const point = makeMetricPoint({ value: 42, unit: "ms", timestamp: 1712320800000 });
      const payload = exporter.buildOtlpPayload([point]) as {
        resourceMetrics: Array<{
          scopeMetrics: Array<{
            metrics: Array<{
              name: string;
              unit: string;
              gauge: {
                dataPoints: Array<{ asDouble: number; timeUnixNano: string }>;
              };
            }>;
          }>;
        }>;
      };

      const metric = payload.resourceMetrics[0].scopeMetrics[0].metrics[0];
      expect(metric.name).toBe("llm.tokens.total");
      expect(metric.unit).toBe("ms");
      expect(metric.gauge.dataPoints[0].asDouble).toBe(42);
    });

    it("should convert timestamp to nanoseconds string", () => {
      const exporter = new OtlpExporter(makeConfig());
      const timestamp = 1712320800000; // ms
      const point = makeMetricPoint({ timestamp });
      const payload = exporter.buildOtlpPayload([point]) as {
        resourceMetrics: Array<{
          scopeMetrics: Array<{
            metrics: Array<{
              gauge: { dataPoints: Array<{ timeUnixNano: string }> };
            }>;
          }>;
        }>;
      };

      const dataPoint = payload.resourceMetrics[0].scopeMetrics[0].metrics[0].gauge.dataPoints[0];
      expect(dataPoint.timeUnixNano).toBe(String(timestamp * 1_000_000));
    });

    it("should group same-named metrics into one metric entry", () => {
      const exporter = new OtlpExporter(makeConfig());
      const points = [
        makeMetricPoint({ name: "cpu.usage", value: 0.5 }),
        makeMetricPoint({ name: "cpu.usage", value: 0.6 }),
      ];
      const payload = exporter.buildOtlpPayload(points) as {
        resourceMetrics: Array<{
          scopeMetrics: Array<{
            metrics: Array<{ name: string; gauge: { dataPoints: unknown[] } }>;
          }>;
        }>;
      };

      const metrics = payload.resourceMetrics[0].scopeMetrics[0].metrics;
      const cpuMetrics = metrics.filter((m) => m.name === "cpu.usage");
      expect(cpuMetrics).toHaveLength(1);
      expect(cpuMetrics[0].gauge.dataPoints).toHaveLength(2);
    });

    it("should include attributes as key-value pairs", () => {
      const exporter = new OtlpExporter(makeConfig());
      const point = makeMetricPoint({ attributes: { model: "gpt-4o", region: "us-east-1" } });
      const payload = exporter.buildOtlpPayload([point]) as {
        resourceMetrics: Array<{
          scopeMetrics: Array<{
            metrics: Array<{
              gauge: {
                dataPoints: Array<{
                  attributes: Array<{ key: string; value: { stringValue: string } }>;
                }>;
              };
            }>;
          }>;
        }>;
      };

      const attrs =
        payload.resourceMetrics[0].scopeMetrics[0].metrics[0].gauge.dataPoints[0].attributes;
      const modelAttr = attrs.find((a) => a.key === "model");
      expect(modelAttr?.value.stringValue).toBe("gpt-4o");
    });

    it("should return empty metrics array for empty points", () => {
      const exporter = new OtlpExporter(makeConfig());
      const payload = exporter.buildOtlpPayload([]) as {
        resourceMetrics: Array<{
          scopeMetrics: Array<{
            metrics: unknown[];
          }>;
        }>;
      };

      const metrics = payload.resourceMetrics[0].scopeMetrics[0].metrics;
      expect(metrics).toHaveLength(0);
    });
  });

  describe("start() and stop()", () => {
    it("should auto-flush at exportIntervalMs", async () => {
      vi.useFakeTimers();
      const exporter = new OtlpExporter(makeConfig({ exportIntervalMs: 1000 }));
      exporter.start();
      exporter.recordMetric(makeMetricPoint());

      await vi.advanceTimersByTimeAsync(1001);
      expect(mockFetch).toHaveBeenCalledOnce();

      exporter.stop();
      vi.useRealTimers();
    });

    it("should not flush again after stop()", async () => {
      vi.useFakeTimers();
      const exporter = new OtlpExporter(makeConfig({ exportIntervalMs: 1000 }));
      exporter.start();
      exporter.stop();
      exporter.recordMetric(makeMetricPoint());

      await vi.advanceTimersByTimeAsync(2000);
      expect(mockFetch).not.toHaveBeenCalled();

      vi.useRealTimers();
    });

    it("should not double-start timer", async () => {
      vi.useFakeTimers();
      const exporter = new OtlpExporter(makeConfig({ exportIntervalMs: 1000 }));
      exporter.start();
      exporter.start(); // Second call should be a no-op
      exporter.recordMetric(makeMetricPoint());

      await vi.advanceTimersByTimeAsync(1001);
      // Should only flush once, not twice
      expect(mockFetch).toHaveBeenCalledOnce();

      exporter.stop();
      vi.useRealTimers();
    });
  });

  describe("dispose()", () => {
    it("should stop the timer", async () => {
      vi.useFakeTimers();
      const exporter = new OtlpExporter(makeConfig({ exportIntervalMs: 1000 }));
      exporter.start();
      exporter.dispose();
      exporter.recordMetric(makeMetricPoint());

      await vi.advanceTimersByTimeAsync(2000);
      // flush from dispose may have been called, but no subsequent flushes
      const callCount = mockFetch.mock.calls.length;
      await vi.advanceTimersByTimeAsync(2000);
      expect(mockFetch.mock.calls.length).toBe(callCount);

      vi.useRealTimers();
    });
  });
});
