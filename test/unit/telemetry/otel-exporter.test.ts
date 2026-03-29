import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { OTelExporter, TelemetryExportError } from "../../../src/telemetry/otel-exporter.js";
import { MetricsCollector, COUNTERS } from "../../../src/telemetry/metrics.js";
import { EventBuffer } from "../../../src/telemetry/events.js";
import { type TelemetryConfig } from "../../../src/telemetry/config.js";

describe("OTelExporter", () => {
  let collector: MetricsCollector;
  let buffer: EventBuffer;

  beforeEach(() => {
    collector = new MetricsCollector();
    buffer = new EventBuffer(100);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const enabledConfig: TelemetryConfig = {
    enabled: true,
    otlpEndpoint: "http://localhost:4318",
    exportIntervalMs: 60000,
    serviceName: "dhelix-test",
    serviceVersion: "1.0.0",
    resourceAttributes: { "host.name": "test-host" },
  };

  const disabledConfig: TelemetryConfig = {
    enabled: false,
    exportIntervalMs: 1000,
    serviceName: "test",
    serviceVersion: "1.0",
    resourceAttributes: {},
  };

  it("should not start when disabled", () => {
    const exporter = new OTelExporter(disabledConfig, collector, buffer);
    exporter.start();
    exporter.stop(); // Should not throw
  });

  it("should not start without endpoint", () => {
    const config: TelemetryConfig = {
      enabled: true,
      exportIntervalMs: 1000,
      serviceName: "test",
      serviceVersion: "1.0",
      resourceAttributes: {},
    };
    const exporter = new OTelExporter(config, collector, buffer);
    exporter.start();
    exporter.stop();
  });

  it("should not export when disabled", async () => {
    const exporter = new OTelExporter(disabledConfig, collector, buffer);
    await exporter.export(); // Should return early without error
  });

  it("should stop timer on stop()", () => {
    const exporter = new OTelExporter(enabledConfig, collector, buffer);
    exporter.start();
    exporter.stop();
    // Calling stop again should be safe
    exporter.stop();
  });

  it("should export metrics via fetch", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      text: () => Promise.resolve(""),
    });
    vi.stubGlobal("fetch", fetchMock);

    collector.increment(COUNTERS.tokensUsed, 100);

    const exporter = new OTelExporter(enabledConfig, collector, buffer);
    await exporter.export();

    // Should have called fetch for metrics and logs
    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:4318/v1/metrics",
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/json" },
      }),
    );
  });

  it("should export events as logs via fetch", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      text: () => Promise.resolve(""),
    });
    vi.stubGlobal("fetch", fetchMock);

    buffer.record({
      type: "tool_decision",
      timestamp: new Date().toISOString(),
      data: { tool: "file_read", reason: "test" },
    });

    const exporter = new OTelExporter(enabledConfig, collector, buffer);
    await exporter.export();

    // Should have called fetch for logs endpoint
    const logsCalls = fetchMock.mock.calls.filter(
      (call: unknown[]) => typeof call[0] === "string" && (call[0] as string).includes("/v1/logs"),
    );
    expect(logsCalls.length).toBe(1);

    // Verify payload structure
    const body = JSON.parse(logsCalls[0][1].body as string);
    expect(body.resourceLogs).toBeDefined();
    expect(body.resourceLogs[0].scopeLogs[0].logRecords).toHaveLength(1);
  });

  it("should not call logs endpoint when no events buffered", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      text: () => Promise.resolve(""),
    });
    vi.stubGlobal("fetch", fetchMock);

    const exporter = new OTelExporter(enabledConfig, collector, buffer);
    await exporter.export();

    // Should only call metrics endpoint, not logs
    const logsCalls = fetchMock.mock.calls.filter(
      (call: unknown[]) => typeof call[0] === "string" && (call[0] as string).includes("/v1/logs"),
    );
    expect(logsCalls.length).toBe(0);
  });

  it("should throw TelemetryExportError on fetch failure", async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error("network error"));
    vi.stubGlobal("fetch", fetchMock);

    const exporter = new OTelExporter(enabledConfig, collector, buffer);
    await expect(exporter.export()).rejects.toThrow(TelemetryExportError);
  });

  it("should throw on non-ok response", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      text: () => Promise.resolve("Internal Server Error"),
    });
    vi.stubGlobal("fetch", fetchMock);

    const exporter = new OTelExporter(enabledConfig, collector, buffer);
    await expect(exporter.export()).rejects.toThrow();
  });

  it("should include resource attributes in payload", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      text: () => Promise.resolve(""),
    });
    vi.stubGlobal("fetch", fetchMock);

    const exporter = new OTelExporter(enabledConfig, collector, buffer);
    await exporter.export();

    const metricsCall = fetchMock.mock.calls.find(
      (call: unknown[]) =>
        typeof call[0] === "string" && (call[0] as string).includes("/v1/metrics"),
    );
    const body = JSON.parse(metricsCall[1].body as string);
    const attrs = body.resourceMetrics[0].resource.attributes;
    expect(attrs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ key: "service.name" }),
        expect.objectContaining({ key: "host.name" }),
      ]),
    );
  });

  it("should build counter data points with labels", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      text: () => Promise.resolve(""),
    });
    vi.stubGlobal("fetch", fetchMock);

    collector.increment(COUNTERS.tokensUsed, 50, { model: "gpt-4" });
    collector.increment(COUNTERS.toolInvocations, 1, { tool: "file_read" });

    const exporter = new OTelExporter(enabledConfig, collector, buffer);
    await exporter.export();

    const metricsCall = fetchMock.mock.calls.find(
      (call: unknown[]) =>
        typeof call[0] === "string" && (call[0] as string).includes("/v1/metrics"),
    );
    const body = JSON.parse(metricsCall[1].body as string);
    const metrics = body.resourceMetrics[0].scopeMetrics[0].metrics;
    expect(metrics.length).toBeGreaterThan(0);
  });
});
