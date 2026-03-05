import { z } from "zod";

/**
 * Telemetry configuration schema.
 * Controlled via environment variables for easy deployment configuration.
 */
export const telemetryConfigSchema = z.object({
  /** Whether telemetry is enabled (default: false for privacy) */
  enabled: z.boolean().default(false),
  /** OTLP endpoint for metrics export */
  otlpEndpoint: z.string().url().optional(),
  /** Prometheus metrics port (if serving metrics) */
  prometheusPort: z.number().int().positive().optional(),
  /** Export interval in milliseconds */
  exportIntervalMs: z.number().int().positive().default(60_000),
  /** Service name for telemetry identification */
  serviceName: z.string().default("dbcode"),
  /** Service version */
  serviceVersion: z.string().default("0.1.0"),
  /** Additional resource attributes */
  resourceAttributes: z.record(z.string()).default({}),
});

/** Parsed telemetry configuration type */
export type TelemetryConfig = z.infer<typeof telemetryConfigSchema>;

/** Environment variable prefix for telemetry config */
const ENV_PREFIX = "DBCODE_TELEMETRY_";

/**
 * Load telemetry configuration from environment variables.
 *
 * Supported variables:
 * - DBCODE_TELEMETRY_ENABLED=true|false
 * - DBCODE_TELEMETRY_OTLP_ENDPOINT=http://localhost:4318
 * - DBCODE_TELEMETRY_PROMETHEUS_PORT=9464
 * - DBCODE_TELEMETRY_EXPORT_INTERVAL_MS=60000
 * - DBCODE_TELEMETRY_SERVICE_NAME=dbcode
 * - OTEL_EXPORTER_OTLP_ENDPOINT (standard OTel env var, fallback)
 */
export function loadTelemetryConfig(): TelemetryConfig {
  const env = process.env;

  const raw = {
    enabled: env[`${ENV_PREFIX}ENABLED`] === "true",
    otlpEndpoint: env[`${ENV_PREFIX}OTLP_ENDPOINT`] ?? env.OTEL_EXPORTER_OTLP_ENDPOINT ?? undefined,
    prometheusPort: env[`${ENV_PREFIX}PROMETHEUS_PORT`]
      ? Number(env[`${ENV_PREFIX}PROMETHEUS_PORT`])
      : undefined,
    exportIntervalMs: env[`${ENV_PREFIX}EXPORT_INTERVAL_MS`]
      ? Number(env[`${ENV_PREFIX}EXPORT_INTERVAL_MS`])
      : undefined,
    serviceName: env[`${ENV_PREFIX}SERVICE_NAME`] ?? env.OTEL_SERVICE_NAME ?? undefined,
    serviceVersion: env[`${ENV_PREFIX}SERVICE_VERSION`] ?? undefined,
  };

  // Remove undefined values so defaults apply
  const cleaned = Object.fromEntries(Object.entries(raw).filter(([, v]) => v !== undefined));

  return telemetryConfigSchema.parse(cleaned);
}
