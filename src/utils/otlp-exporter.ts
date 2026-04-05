/**
 * OTLP (OpenTelemetry Protocol) Metrics Exporter
 *
 * OpenTelemetry HTTP 프로토콜을 사용하여 런타임 메트릭을 외부 수집 시스템으로 내보냅니다.
 * 메트릭은 인메모리 버퍼에 누적되고, 설정된 간격마다 OTLP 엔드포인트로 전송됩니다.
 *
 * 지원 형식:
 * - OTLP/HTTP JSON (https://opentelemetry.io/docs/specs/otlp/)
 *
 * 사용 예시:
 * ```typescript
 * const exporter = new OtlpExporter({
 *   endpoint: "http://localhost:4318",
 *   serviceName: "dhelix-code",
 *   exportIntervalMs: 60_000,
 * });
 * exporter.start();
 * exporter.recordMetric({ name: "llm.tokens", value: 1024, unit: "tokens", timestamp: Date.now() });
 * await exporter.flush();
 * exporter.stop();
 * exporter.dispose();
 * ```
 */

/**
 * OTLP Exporter 설정
 *
 * @property endpoint - OTLP HTTP 엔드포인트 (예: "http://localhost:4318")
 * @property serviceName - 서비스 이름 (기본값: "dhelix-code")
 * @property exportIntervalMs - 자동 플러시 간격 (ms, 기본값: 60_000)
 * @property headers - OTLP 요청에 추가할 커스텀 HTTP 헤더
 */
export interface OtlpExporterConfig {
  readonly endpoint: string;
  readonly serviceName?: string;
  readonly exportIntervalMs?: number;
  readonly headers?: Record<string, string>;
}

/**
 * 단일 메트릭 데이터 포인트
 *
 * @property name - 메트릭 이름 (예: "llm.tokens.total")
 * @property value - 메트릭 값
 * @property unit - 측정 단위 (예: "tokens", "ms", "bytes")
 * @property attributes - 메트릭 레이블/태그
 * @property timestamp - Unix 타임스탬프 (밀리초)
 */
export interface MetricPoint {
  readonly name: string;
  readonly value: number;
  readonly unit?: string;
  readonly attributes?: Record<string, string>;
  readonly timestamp: number;
}

/** 기본 서비스 이름 */
const DEFAULT_SERVICE_NAME = "dhelix-code";

/** 기본 내보내기 간격 (ms) */
const DEFAULT_EXPORT_INTERVAL_MS = 60_000;

/** OTLP HTTP 메트릭 경로 */
const OTLP_METRICS_PATH = "/v1/metrics";

/**
 * OTLP 속성 키-값 쌍 (내부 타입)
 */
interface OtlpKeyValue {
  readonly key: string;
  readonly value: { readonly stringValue: string };
}

/**
 * OTLP 데이터 포인트 (내부 타입)
 */
interface OtlpNumberDataPoint {
  readonly attributes: readonly OtlpKeyValue[];
  readonly startTimeUnixNano: string;
  readonly timeUnixNano: string;
  readonly asDouble: number;
}

/**
 * OTLP Gauge 메트릭 (내부 타입)
 */
interface OtlpMetric {
  readonly name: string;
  readonly unit: string;
  readonly gauge: {
    readonly dataPoints: readonly OtlpNumberDataPoint[];
  };
}

/**
 * OTLP HTTP 요청 페이로드 (내부 타입)
 */
interface OtlpPayload {
  readonly resourceMetrics: readonly {
    readonly resource: {
      readonly attributes: readonly OtlpKeyValue[];
    };
    readonly scopeMetrics: readonly {
      readonly scope: {
        readonly name: string;
        readonly version: string;
      };
      readonly metrics: readonly OtlpMetric[];
    }[];
  }[];
}

/**
 * MetricPoint 배열을 OTLP JSON 페이로드로 변환합니다.
 *
 * @param points - 메트릭 데이터 포인트 배열
 * @param serviceName - 서비스 이름
 * @returns OTLP JSON 형식 페이로드
 */
function buildOtlpPayloadFromPoints(
  points: readonly MetricPoint[],
  serviceName: string,
): OtlpPayload {
  // 메트릭 이름별로 데이터 포인트를 그룹화
  const metricGroups = new Map<string, MetricPoint[]>();
  for (const point of points) {
    const group = metricGroups.get(point.name) ?? [];
    group.push(point);
    metricGroups.set(point.name, group);
  }

  const metrics: OtlpMetric[] = [];
  for (const [name, groupPoints] of metricGroups) {
    const unit = groupPoints[0]?.unit ?? "";
    const dataPoints: OtlpNumberDataPoint[] = groupPoints.map((p) => {
      const attributes: OtlpKeyValue[] = Object.entries(p.attributes ?? {}).map(([k, v]) => ({
        key: k,
        value: { stringValue: v },
      }));

      // OTLP는 나노초 단위 타임스탬프를 문자열로 요구
      const timeUnixNano = String(p.timestamp * 1_000_000);

      return {
        attributes,
        startTimeUnixNano: timeUnixNano,
        timeUnixNano,
        asDouble: p.value,
      };
    });

    metrics.push({
      name,
      unit,
      gauge: { dataPoints },
    });
  }

  return {
    resourceMetrics: [
      {
        resource: {
          attributes: [
            {
              key: "service.name",
              value: { stringValue: serviceName },
            },
          ],
        },
        scopeMetrics: [
          {
            scope: {
              name: "dhelix-code",
              version: "0.2.0",
            },
            metrics,
          },
        ],
      },
    ],
  };
}

/**
 * OpenTelemetry Protocol (OTLP) HTTP 메트릭 내보내기 클래스.
 *
 * 메트릭을 인메모리 버퍼에 누적하고 주기적으로 OTLP 엔드포인트로 전송합니다.
 *
 * 생명주기:
 * 1. `start()` — 자동 플러시 타이머 시작
 * 2. `recordMetric()` — 메트릭 버퍼에 추가
 * 3. `flush()` — 버퍼 내용을 OTLP 엔드포인트로 전송
 * 4. `stop()` — 자동 플러시 타이머 중단
 * 5. `dispose()` — 버퍼 정리 및 마지막 플러시
 */
export class OtlpExporter {
  private readonly config: OtlpExporterConfig;
  private readonly serviceName: string;
  private readonly exportIntervalMs: number;
  private buffer: MetricPoint[] = [];
  private timer: ReturnType<typeof setInterval> | null = null;
  private disposed: boolean = false;

  /**
   * @param config - OTLP 내보내기 설정
   */
  constructor(config: OtlpExporterConfig) {
    this.config = config;
    this.serviceName = config.serviceName ?? DEFAULT_SERVICE_NAME;
    this.exportIntervalMs = config.exportIntervalMs ?? DEFAULT_EXPORT_INTERVAL_MS;
  }

  /**
   * 메트릭 데이터 포인트를 인메모리 버퍼에 추가합니다.
   *
   * @param point - 기록할 메트릭 데이터 포인트
   */
  recordMetric(point: MetricPoint): void {
    if (this.disposed) return;
    this.buffer.push(point);
  }

  /**
   * 버퍼에 쌓인 메트릭을 OTLP HTTP 엔드포인트로 전송합니다.
   * 전송 후 버퍼를 비웁니다. 전송 실패 시 에러를 무시하고 계속 진행합니다.
   *
   * @returns 전송 완료를 나타내는 Promise
   */
  async flush(): Promise<void> {
    if (this.buffer.length === 0) return;

    // 현재 버퍼 스냅샷을 가져오고 즉시 비움 (다음 recordMetric이 새 버퍼에 쓰도록)
    const points = [...this.buffer];
    this.buffer = [];

    const payload = this.buildOtlpPayload(points);
    const url = `${this.config.endpoint}${OTLP_METRICS_PATH}`;

    try {
      await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...this.config.headers,
        },
        body: JSON.stringify(payload),
      });
    } catch {
      // 네트워크 오류나 엔드포인트 없음 — 메트릭 손실을 감수하고 계속 진행
      // (메트릭 전송 실패가 앱 실행에 영향을 주어서는 안 됨)
    }
  }

  /**
   * MetricPoint 배열에서 OTLP JSON 형식 페이로드를 생성합니다.
   *
   * 이 메서드는 순수 함수로 테스트에서 직접 호출하여 페이로드 구조를 검증할 수 있습니다.
   *
   * @param points - 내보낼 메트릭 데이터 포인트 배열
   * @returns OTLP JSON 형식 페이로드 (unknown 타입으로 반환, 외부 사양에 의존)
   */
  buildOtlpPayload(points: readonly MetricPoint[]): unknown {
    return buildOtlpPayloadFromPoints(points, this.serviceName);
  }

  /**
   * 자동 플러시 타이머를 시작합니다.
   * exportIntervalMs 간격으로 flush()를 호출합니다.
   * 이미 시작된 경우 무시합니다.
   */
  start(): void {
    if (this.timer !== null || this.disposed) return;
    this.timer = setInterval(() => {
      void this.flush();
    }, this.exportIntervalMs);

    // Node.js가 타이머 때문에 종료를 막지 않도록 unref 설정
    if (typeof this.timer === "object" && this.timer !== null && "unref" in this.timer) {
      (this.timer as { unref(): void }).unref();
    }
  }

  /**
   * 자동 플러시 타이머를 중단합니다.
   * 버퍼는 유지됩니다 (dispose()를 호출하면 최종 플러시 후 정리됨).
   */
  stop(): void {
    if (this.timer !== null) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  /**
   * 타이머를 중단하고 남은 버퍼를 전송한 뒤 리소스를 정리합니다.
   * 이 메서드 호출 이후에는 recordMetric이 무시됩니다.
   */
  dispose(): void {
    this.stop();
    this.disposed = true;
    void this.flush();
    this.buffer = [];
  }
}
