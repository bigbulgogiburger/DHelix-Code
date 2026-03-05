/**
 * Telemetry metric definitions.
 * Provides counter and histogram tracking for sessions, tokens, tools, and agent activity.
 * Metrics are collected in-memory and can be exported via OTLP or Prometheus.
 */

/** Metric label set */
export type MetricLabels = Readonly<Record<string, string>>;

/** A single counter metric */
export interface CounterMetric {
  readonly name: string;
  readonly description: string;
  readonly labels: readonly string[];
}

/** A single histogram metric */
export interface HistogramMetric {
  readonly name: string;
  readonly description: string;
  readonly labels: readonly string[];
  readonly buckets?: readonly number[];
}

/** All defined counter metrics */
export const COUNTERS = {
  sessionsTotal: {
    name: "dbcode.sessions.total",
    description: "Total number of sessions started",
    labels: [],
  },
  tokensUsed: {
    name: "dbcode.tokens.total",
    description: "Total tokens consumed",
    labels: ["type", "model"],
  },
  tokenCost: {
    name: "dbcode.cost.usd",
    description: "Estimated cost in USD",
    labels: ["model"],
  },
  toolInvocations: {
    name: "dbcode.tools.invocations",
    description: "Total tool invocations",
    labels: ["tool", "status"],
  },
  toolDecisions: {
    name: "dbcode.tools.decisions",
    description: "Tool decision outcomes (approved, denied, etc.)",
    labels: ["tool", "decision"],
  },
  linesOfCode: {
    name: "dbcode.code.lines",
    description: "Lines of code affected",
    labels: ["action"],
  },
  errors: {
    name: "dbcode.errors.total",
    description: "Total errors by category",
    labels: ["category"],
  },
} as const satisfies Record<string, CounterMetric>;

/** All defined histogram metrics */
export const HISTOGRAMS = {
  sessionDuration: {
    name: "dbcode.sessions.duration_seconds",
    description: "Session duration in seconds",
    labels: [],
    buckets: [10, 30, 60, 120, 300, 600, 1800, 3600],
  },
  toolDuration: {
    name: "dbcode.tools.duration_ms",
    description: "Tool execution duration in milliseconds",
    labels: ["tool"],
    buckets: [10, 50, 100, 500, 1000, 5000, 10000, 30000],
  },
  agentIterations: {
    name: "dbcode.agent.iterations_per_task",
    description: "Number of agent loop iterations per task",
    labels: [],
    buckets: [1, 2, 5, 10, 20, 50],
  },
  llmLatency: {
    name: "dbcode.llm.latency_ms",
    description: "LLM call latency in milliseconds",
    labels: ["model"],
    buckets: [100, 500, 1000, 2000, 5000, 10000, 30000],
  },
} as const satisfies Record<string, HistogramMetric>;

/** In-memory metric value store */
interface MetricValue {
  value: number;
  labels: MetricLabels;
  timestamp: number;
}

/**
 * In-memory metrics collector.
 * Collects counter increments and histogram observations.
 * Data can be exported to OTLP or Prometheus format.
 */
export class MetricsCollector {
  private readonly counters = new Map<string, MetricValue[]>();
  private readonly histograms = new Map<string, MetricValue[]>();

  /** Increment a counter metric */
  increment(metric: CounterMetric, value = 1, labels: MetricLabels = {}): void {
    const key = this.makeKey(metric.name, labels);
    const existing = this.counters.get(key);
    if (existing && existing.length > 0) {
      existing[existing.length - 1].value += value;
    } else {
      this.counters.set(key, [{ value, labels, timestamp: Date.now() }]);
    }
  }

  /** Record a histogram observation */
  observe(metric: HistogramMetric, value: number, labels: MetricLabels = {}): void {
    const key = this.makeKey(metric.name, labels);
    const existing = this.histograms.get(key) ?? [];
    existing.push({ value, labels, timestamp: Date.now() });
    this.histograms.set(key, existing);
  }

  /** Get current counter value */
  getCounter(metric: CounterMetric, labels: MetricLabels = {}): number {
    const key = this.makeKey(metric.name, labels);
    const values = this.counters.get(key);
    if (!values || values.length === 0) return 0;
    return values[values.length - 1].value;
  }

  /** Get all counter data for export */
  getCounterData(): ReadonlyMap<string, readonly MetricValue[]> {
    return this.counters;
  }

  /** Get all histogram data for export */
  getHistogramData(): ReadonlyMap<string, readonly MetricValue[]> {
    return this.histograms;
  }

  /** Reset all metrics */
  reset(): void {
    this.counters.clear();
    this.histograms.clear();
  }

  /** Create a unique key from metric name + labels */
  private makeKey(name: string, labels: MetricLabels): string {
    const labelStr = Object.entries(labels)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}=${v}`)
      .join(",");
    return labelStr ? `${name}{${labelStr}}` : name;
  }
}

/** Singleton metrics collector instance */
export const metrics = new MetricsCollector();
