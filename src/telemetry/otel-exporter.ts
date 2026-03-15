/**
 * OpenTelemetry 내보내기(Exporter) — OTLP HTTP를 통한 메트릭/이벤트 전송
 *
 * OTel SDK 전체를 사용하지 않고, 순수 HTTP/JSON으로 OTLP 엔드포인트에
 * 메트릭과 이벤트를 전송하는 경량 구현입니다.
 *
 * 전송 대상:
 * - /v1/metrics: 카운터 및 히스토그램 메트릭 (OTLP Metrics)
 * - /v1/logs: 텔레메트리 이벤트를 로그 형태로 전송 (OTLP Logs)
 *
 * 주기적 내보내기:
 * start()로 시작하면 설정된 간격(exportIntervalMs)마다 자동 내보내기를 실행합니다.
 * stop()으로 주기적 내보내기를 중지합니다.
 *
 * @example
 * const exporter = new OTelExporter(config, metricsCollector, eventBuffer);
 * exporter.start(); // 주기적 내보내기 시작
 * // ... 앱 실행 ...
 * exporter.stop(); // 내보내기 중지
 * await exporter.export(); // 수동으로 한 번 내보내기
 */

import { type TelemetryConfig } from "./config.js";
import { type MetricsCollector } from "./metrics.js";
import { type EventBuffer } from "./events.js";
import { BaseError } from "../utils/error.js";

/** 텔레메트리 내보내기 에러 */
export class TelemetryExportError extends BaseError {
  constructor(message: string, context: Record<string, unknown> = {}) {
    super(message, "TELEMETRY_EXPORT_ERROR", context);
  }
}

/** OTLP 메트릭 데이터 포인트 형식 */
interface OTLPDataPoint {
  /** 메트릭 속성(attributes) — 레이블에 해당 */
  readonly attributes: readonly { key: string; value: { stringValue: string } }[];
  /** 정수 값 (카운터용) */
  readonly asInt?: number;
  /** 실수 값 (히스토그램용) */
  readonly asDouble?: number;
  /** 나노초 단위의 Unix 타임스탬프 */
  readonly timeUnixNano: string;
}

/** OTLP 메트릭 페이로드 구조 */
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
 * OpenTelemetry 내보내기 클래스.
 *
 * 수집된 메트릭과 이벤트를 OTLP 엔드포인트로 HTTP POST합니다.
 * OTel SDK 전체를 의존하지 않고, 직접 JSON 페이로드를 구성합니다.
 */
export class OTelExporter {
  /** 주기적 내보내기를 위한 타이머 핸들 */
  private timer: ReturnType<typeof setInterval> | null = null;

  /**
   * @param config - 텔레메트리 설정 (엔드포인트, 서비스명 등)
   * @param metricsCollector - 메트릭 수집기 인스턴스
   * @param eventBuffer - 이벤트 버퍼 인스턴스
   */
  constructor(
    private readonly config: TelemetryConfig,
    private readonly metricsCollector: MetricsCollector,
    private readonly eventBuffer: EventBuffer,
  ) {}

  /**
   * 주기적 내보내기를 시작합니다.
   * config.exportIntervalMs 간격으로 export()를 자동 호출합니다.
   * 텔레메트리가 비활성이거나 엔드포인트가 설정되지 않으면 아무 동작도 하지 않습니다.
   */
  start(): void {
    if (!this.config.enabled || !this.config.otlpEndpoint) return;

    this.timer = setInterval(() => {
      // void: 내보내기 Promise를 의도적으로 무시 (fire-and-forget)
      void this.export();
    }, this.config.exportIntervalMs);
  }

  /**
   * 주기적 내보내기를 중지합니다.
   */
  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  /**
   * 메트릭과 이벤트를 OTLP 엔드포인트에 한 번 내보냅니다.
   * 메트릭과 이벤트 내보내기를 병렬(Promise.all)로 실행합니다.
   *
   * @throws TelemetryExportError - 내보내기 실패 시
   */
  async export(): Promise<void> {
    if (!this.config.enabled || !this.config.otlpEndpoint) return;

    try {
      // 메트릭과 이벤트를 병렬로 내보내기
      await Promise.all([this.exportMetrics(), this.exportEvents()]);
    } catch (error) {
      throw new TelemetryExportError("Failed to export telemetry", {
        endpoint: this.config.otlpEndpoint,
        cause: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * 카운터/히스토그램 메트릭을 OTLP /v1/metrics 엔드포인트로 전송합니다.
   * 10초 타임아웃이 설정되어 있습니다.
   */
  private async exportMetrics(): Promise<void> {
    const endpoint = `${this.config.otlpEndpoint}/v1/metrics`;
    const payload = this.buildMetricPayload();

    // AbortController로 10초 타임아웃 관리
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

  /**
   * 이벤트를 OTLP /v1/logs 엔드포인트로 로그 형태로 전송합니다.
   * flush()를 호출하여 버퍼의 이벤트를 가져오고 비웁니다.
   * 이벤트가 없으면 전송하지 않습니다.
   */
  private async exportEvents(): Promise<void> {
    // 버퍼에서 이벤트를 가져오고 비움
    const events = this.eventBuffer.flush();
    if (events.length === 0) return;

    const endpoint = `${this.config.otlpEndpoint}/v1/logs`;
    // OTLP Logs 페이로드 구성
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
                // 타임스탬프를 나노초 단위로 변환 (OTLP 규격)
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

  /**
   * 인메모리 메트릭에서 OTLP 메트릭 페이로드를 구성합니다.
   * 카운터 데이터를 OTLP Sum 형태로 변환합니다.
   *
   * @returns OTLP 메트릭 페이로드
   */
  private buildMetricPayload(): OTLPMetricPayload {
    const counterData = this.metricsCollector.getCounterData();
    const metrics: Array<{
      name: string;
      description: string;
      sum?: { dataPoints: OTLPDataPoint[] };
      histogram?: { dataPoints: unknown[] };
    }> = [];

    for (const [key, values] of counterData) {
      // 키에서 메트릭 이름 추출 (예: "dbcode.tokens.total{type=input}" → "dbcode.tokens.total")
      const name = key.split("{")[0];
      const dataPoints: OTLPDataPoint[] = values.map((v) => ({
        attributes: Object.entries(v.labels).map(([k, val]) => ({
          key: k,
          value: { stringValue: val },
        })),
        asInt: Math.round(v.value),
        // 밀리초 → 나노초 변환 (OTLP 규격)
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

  /**
   * OTel 리소스 속성(attributes)을 구성합니다.
   * service.name, service.version, 그리고 사용자 정의 속성을 포함합니다.
   *
   * @returns OTel 리소스 속성 배열
   */
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
