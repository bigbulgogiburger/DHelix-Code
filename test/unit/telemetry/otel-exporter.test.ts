import { describe, it, expect, vi, beforeEach } from "vitest";
import { OTelExporter } from "../../../src/telemetry/otel-exporter.js";
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

  it("should not start when disabled", () => {
    const config: TelemetryConfig = {
      enabled: false,
      exportIntervalMs: 1000,
      serviceName: "test",
      serviceVersion: "1.0",
      resourceAttributes: {},
    };
    const exporter = new OTelExporter(config, collector, buffer);
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
    const config: TelemetryConfig = {
      enabled: false,
      exportIntervalMs: 1000,
      serviceName: "test",
      serviceVersion: "1.0",
      resourceAttributes: {},
    };
    const exporter = new OTelExporter(config, collector, buffer);
    await exporter.export(); // Should return early without error
  });

  it("should stop timer on stop()", () => {
    const config: TelemetryConfig = {
      enabled: true,
      otlpEndpoint: "http://localhost:4318",
      exportIntervalMs: 60000,
      serviceName: "test",
      serviceVersion: "1.0",
      resourceAttributes: {},
    };
    const exporter = new OTelExporter(config, collector, buffer);
    exporter.start();
    exporter.stop();
    // Calling stop again should be safe
    exporter.stop();
  });
});
