import { type TelemetryConfig } from "./config.js";
import { type MetricsCollector } from "./metrics.js";
import { type EventBuffer } from "./events.js";
import { BaseError } from "../utils/error.js";

/** Telemetry export error */
export class TelemetryExportError extends BaseError {
  constructor(message: string, context: Record<string, unknown> = {}) {
    super(message, "TELEMETRY_EXPORT_ERROR", context);
  }
}

/** OTLP metric data point format */
interface OTLPDataPoint {
  readonly attributes: readonly { key: string; value: { stringValue: string } }[];
  readonly asInt?: number;
  readonly asDouble?: number;
  readonly timeUnixNano: string;
}

/** OTLP metric payload */
interface OTLPMetricPayload {
  readonly resourceMetrics: readonly {
    readonly resource: {
      readonly attributes: readonly { key: string; value: { stringValue: string } }[];
    };
    readonly scopeMetrics: readonly {
      readonly scope: { readonly name: string; readonly version: string };
      readonly metrics: readonly {
        readonly name: string;
        readonly description: string;
        readonly sum?: { readonly dataPoints: readonly OTLPDataPoint[] };
        readonly histogram?: { readonly dataPoints: readonly unknown[] };
      }[];
    }[];
  }[];
}

/**
 * OpenTelemetry exporter.
 * Exports collected metrics and events to OTLP endpoint via HTTP POST.
 * Designed to work without the full OTel SDK — uses plain HTTP/JSON.
 */
export class OTelExporter {
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(
    private readonly config: TelemetryConfig,
    private readonly metricsCollector: MetricsCollector,
    private readonly eventBuffer: EventBuffer,
  ) {}

  /** Start periodic export */
  start(): void {
    if (!this.config.enabled || !this.config.otlpEndpoint) return;

    this.timer = setInterval(() => {
      void this.export();
    }, this.config.exportIntervalMs);
  }

  /** Stop periodic export */
  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  /** Export metrics and events to OTLP endpoint */
  async export(): Promise<void> {
    if (!this.config.enabled || !this.config.otlpEndpoint) return;

    try {
      await Promise.all([this.exportMetrics(), this.exportEvents()]);
    } catch (error) {
      throw new TelemetryExportError("Failed to export telemetry", {
        endpoint: this.config.otlpEndpoint,
        cause: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /** Export counter and histogram metrics via OTLP HTTP */
  private async exportMetrics(): Promise<void> {
    const endpoint = `${this.config.otlpEndpoint}/v1/metrics`;
    const payload = this.buildMetricPayload();

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10_000);

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new TelemetryExportError(`OTLP endpoint returned ${response.status}`);
      }
    } finally {
      clearTimeout(timer);
    }
  }

  /** Export events as OTLP logs */
  private async exportEvents(): Promise<void> {
    const events = this.eventBuffer.flush();
    if (events.length === 0) return;

    const endpoint = `${this.config.otlpEndpoint}/v1/logs`;
    const payload = {
      resourceLogs: [
        {
          resource: {
            attributes: this.buildResourceAttributes(),
          },
          scopeLogs: [
            {
              scope: { name: this.config.serviceName, version: this.config.serviceVersion },
              logRecords: events.map((event) => ({
                timeUnixNano: String(new Date(event.timestamp).getTime() * 1_000_000),
                body: { stringValue: JSON.stringify(event) },
                attributes: [
                  {
                    key: "event.type",
                    value: { stringValue: event.type },
                  },
                ],
              })),
            },
          ],
        },
      ],
    };

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10_000);

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new TelemetryExportError(`OTLP logs endpoint returned ${response.status}`);
      }
    } finally {
      clearTimeout(timer);
    }
  }

  /** Build OTLP metric payload from in-memory metrics */
  private buildMetricPayload(): OTLPMetricPayload {
    const counterData = this.metricsCollector.getCounterData();
    const metrics: Array<{
      name: string;
      description: string;
      sum?: { dataPoints: OTLPDataPoint[] };
      histogram?: { dataPoints: unknown[] };
    }> = [];

    for (const [key, values] of counterData) {
      const name = key.split("{")[0];
      const dataPoints: OTLPDataPoint[] = values.map((v) => ({
        attributes: Object.entries(v.labels).map(([k, val]) => ({
          key: k,
          value: { stringValue: val },
        })),
        asInt: Math.round(v.value),
        timeUnixNano: String(v.timestamp * 1_000_000),
      }));

      metrics.push({
        name,
        description: "",
        sum: { dataPoints },
      });
    }

    return {
      resourceMetrics: [
        {
          resource: { attributes: this.buildResourceAttributes() },
          scopeMetrics: [
            {
              scope: { name: this.config.serviceName, version: this.config.serviceVersion },
              metrics,
            },
          ],
        },
      ],
    };
  }

  /** Build OTel resource attributes */
  private buildResourceAttributes(): { key: string; value: { stringValue: string } }[] {
    return [
      { key: "service.name", value: { stringValue: this.config.serviceName } },
      { key: "service.version", value: { stringValue: this.config.serviceVersion } },
      ...Object.entries(this.config.resourceAttributes).map(([k, v]) => ({
        key: k,
        value: { stringValue: v },
      })),
    ];
  }
}
