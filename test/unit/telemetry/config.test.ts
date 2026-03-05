import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { loadTelemetryConfig } from "../../../src/telemetry/config.js";

describe("TelemetryConfig", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    // Clean telemetry env vars
    for (const key of Object.keys(process.env)) {
      if (key.startsWith("DBCODE_TELEMETRY_") || key.startsWith("OTEL_")) {
        delete process.env[key];
      }
    }
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("should return defaults when no env vars set", () => {
    const config = loadTelemetryConfig();
    expect(config.enabled).toBe(false);
    expect(config.serviceName).toBe("dbcode");
    expect(config.exportIntervalMs).toBe(60_000);
  });

  it("should enable telemetry via env var", () => {
    process.env.DBCODE_TELEMETRY_ENABLED = "true";
    const config = loadTelemetryConfig();
    expect(config.enabled).toBe(true);
  });

  it("should read OTLP endpoint from OTEL env var", () => {
    process.env.OTEL_EXPORTER_OTLP_ENDPOINT = "http://localhost:4318";
    const config = loadTelemetryConfig();
    expect(config.otlpEndpoint).toBe("http://localhost:4318");
  });

  it("should prefer DBCODE prefix over OTEL prefix", () => {
    process.env.DBCODE_TELEMETRY_OTLP_ENDPOINT = "http://custom:4318";
    process.env.OTEL_EXPORTER_OTLP_ENDPOINT = "http://otel:4318";
    const config = loadTelemetryConfig();
    expect(config.otlpEndpoint).toBe("http://custom:4318");
  });

  it("should read service name from OTEL env var", () => {
    process.env.OTEL_SERVICE_NAME = "custom-service";
    const config = loadTelemetryConfig();
    expect(config.serviceName).toBe("custom-service");
  });

  it("should read export interval from env", () => {
    process.env.DBCODE_TELEMETRY_EXPORT_INTERVAL_MS = "5000";
    const config = loadTelemetryConfig();
    expect(config.exportIntervalMs).toBe(5000);
  });

  it("should have default resource attributes as empty object", () => {
    const config = loadTelemetryConfig();
    expect(config.resourceAttributes).toEqual({});
  });

  it("should set service version from env", () => {
    process.env.DBCODE_TELEMETRY_SERVICE_VERSION = "2.0.0";
    const config = loadTelemetryConfig();
    expect(config.serviceVersion).toBe("2.0.0");
  });
});
