/**
 * 텔레메트리 메트릭 — 카운터(counter)와 히스토그램(histogram) 메트릭 정의 및 수집
 *
 * 세션 수, 토큰 사용량, 도구 실행 시간, 에이전트 반복 횟수 등의
 * 수치 데이터를 인메모리에서 수집합니다.
 * 수집된 메트릭은 OTLP 또는 Prometheus 형식으로 내보낼 수 있습니다.
 *
 * 메트릭 종류:
 * - 카운터(Counter): 누적 값 (예: 총 세션 수, 총 토큰 수)
 * - 히스토그램(Histogram): 분포 관찰 (예: 도구 실행 시간, LLM 지연 시간)
 *
 * @example
 * import { metrics, COUNTERS, HISTOGRAMS } from "./metrics.js";
 *
 * // 카운터 증가
 * metrics.increment(COUNTERS.tokensUsed, 150, { type: "input", model: "gpt-4o" });
 *
 * // 히스토그램 관찰
 * metrics.observe(HISTOGRAMS.toolDuration, 245, { tool: "file_read" });
 *
 * // 현재 값 조회
 * const totalTokens = metrics.getCounter(COUNTERS.tokensUsed, { type: "input", model: "gpt-4o" });
 */

/** 메트릭 레이블 셋 — 키-값 쌍으로 메트릭을 분류 (예: { model: "gpt-4o" }) */
export type MetricLabels = Readonly<Record<string, string>>;

/** 카운터 메트릭 정의 — 누적 값을 추적 (항상 증가) */
export interface CounterMetric {
  /** 메트릭 이름 (예: "dhelix.tokens.total") */
  readonly name: string;
  /** 메트릭 설명 */
  readonly description: string;
  /** 사용 가능한 레이블 키 목록 */
  readonly labels: readonly string[];
}

/** 히스토그램 메트릭 정의 — 값의 분포를 관찰 (예: 지연 시간 분포) */
export interface HistogramMetric {
  /** 메트릭 이름 */
  readonly name: string;
  /** 메트릭 설명 */
  readonly description: string;
  /** 사용 가능한 레이블 키 목록 */
  readonly labels: readonly string[];
  /** 히스토그램 버킷(bucket) 경계값 — 분포를 나누는 기준점 */
  readonly buckets?: readonly number[];
}

/**
 * 정의된 모든 카운터 메트릭.
 *
 * - sessionsTotal: 시작된 총 세션 수
 * - tokensUsed: 사용된 총 토큰 수 (type: input/output, model)
 * - tokenCost: 추정 비용 (USD, model)
 * - toolInvocations: 도구 호출 횟수 (tool, status)
 * - toolDecisions: 도구 결정 결과 (tool, decision)
 * - linesOfCode: 영향받은 코드 줄 수 (action: added/removed)
 * - errors: 카테고리별 에러 수
 */
export const COUNTERS = {
  sessionsTotal: {
    name: "dhelix.sessions.total",
    description: "Total number of sessions started",
    labels: [],
  },
  tokensUsed: {
    name: "dhelix.tokens.total",
    description: "Total tokens consumed",
    labels: ["type", "model"], // type: "input" | "output", model: 모델명
  },
  tokenCost: {
    name: "dhelix.cost.usd",
    description: "Estimated cost in USD",
    labels: ["model"],
  },
  toolInvocations: {
    name: "dhelix.tools.invocations",
    description: "Total tool invocations",
    labels: ["tool", "status"], // status: "success" | "error"
  },
  toolDecisions: {
    name: "dhelix.tools.decisions",
    description: "Tool decision outcomes (approved, denied, etc.)",
    labels: ["tool", "decision"],
  },
  linesOfCode: {
    name: "dhelix.code.lines",
    description: "Lines of code affected",
    labels: ["action"], // action: "added" | "removed"
  },
  errors: {
    name: "dhelix.errors.total",
    description: "Total errors by category",
    labels: ["category"], // category: "llm" | "tool" | "permission" 등
  },
} as const satisfies Record<string, CounterMetric>;

/**
 * 정의된 모든 히스토그램 메트릭.
 *
 * - sessionDuration: 세션 지속 시간 (초)
 * - toolDuration: 도구 실행 시간 (밀리초)
 * - agentIterations: 작업당 에이전트 반복 횟수
 * - llmLatency: LLM API 호출 지연 시간 (밀리초)
 *
 * buckets: 히스토그램 경계값 배열.
 * 예: [10, 50, 100, 500]이면 "10ms 이하", "10~50ms", "50~100ms", "100~500ms", "500ms 초과"로 분류
 */
export const HISTOGRAMS = {
  sessionDuration: {
    name: "dhelix.sessions.duration_seconds",
    description: "Session duration in seconds",
    labels: [],
    buckets: [10, 30, 60, 120, 300, 600, 1800, 3600],
  },
  toolDuration: {
    name: "dhelix.tools.duration_ms",
    description: "Tool execution duration in milliseconds",
    labels: ["tool"],
    buckets: [10, 50, 100, 500, 1000, 5000, 10000, 30000],
  },
  agentIterations: {
    name: "dhelix.agent.iterations_per_task",
    description: "Number of agent loop iterations per task",
    labels: [],
    buckets: [1, 2, 5, 10, 20, 50],
  },
  llmLatency: {
    name: "dhelix.llm.latency_ms",
    description: "LLM call latency in milliseconds",
    labels: ["model"],
    buckets: [100, 500, 1000, 2000, 5000, 10000, 30000],
  },
} as const satisfies Record<string, HistogramMetric>;

/** 메트릭 값 저장 구조 (내부 사용) */
interface MetricValue {
  value: number;
  labels: MetricLabels;
  timestamp: number;
}

/**
 * 인메모리 메트릭 수집기.
 *
 * 카운터 증가(increment)와 히스토그램 관찰(observe)을 지원합니다.
 * 수집된 데이터는 getCounterData()/getHistogramData()로 내보내기 위해 조회할 수 있습니다.
 *
 * 키 생성 규칙: "메트릭이름{label1=value1,label2=value2}" 형태로 고유 키를 생성하여
 * 동일 메트릭의 다른 레이블 조합을 구분합니다.
 *
 * @example
 * const collector = new MetricsCollector();
 * collector.increment(COUNTERS.tokensUsed, 150, { type: "input", model: "gpt-4o" });
 * collector.observe(HISTOGRAMS.toolDuration, 245, { tool: "file_read" });
 */
export class MetricsCollector {
  /** 카운터 값 저장소 (키 → 값 배열) */
  private readonly counters = new Map<string, MetricValue[]>();
  /** 히스토그램 관찰값 저장소 (키 → 값 배열) */
  private readonly histograms = new Map<string, MetricValue[]>();

  /**
   * 카운터 메트릭의 값을 증가시킵니다.
   * 이미 존재하는 카운터는 마지막 값에 누적되고, 없으면 새로 생성됩니다.
   *
   * @param metric - 카운터 메트릭 정의
   * @param value - 증가량 (기본값: 1)
   * @param labels - 메트릭 레이블 (기본값: 빈 객체)
   */
  increment(metric: CounterMetric, value = 1, labels: MetricLabels = {}): void {
    const key = this.makeKey(metric.name, labels);
    const existing = this.counters.get(key);
    if (existing && existing.length > 0) {
      // 마지막 값에 누적
      existing[existing.length - 1].value += value;
    } else {
      this.counters.set(key, [{ value, labels, timestamp: Date.now() }]);
    }
  }

  /**
   * 히스토그램 메트릭에 관찰값을 기록합니다.
   * 각 관찰값은 독립적으로 저장되어 분포 분석에 활용됩니다.
   *
   * @param metric - 히스토그램 메트릭 정의
   * @param value - 관찰값 (예: 실행 시간 밀리초)
   * @param labels - 메트릭 레이블 (기본값: 빈 객체)
   */
  observe(metric: HistogramMetric, value: number, labels: MetricLabels = {}): void {
    const key = this.makeKey(metric.name, labels);
    const existing = this.histograms.get(key) ?? [];
    existing.push({ value, labels, timestamp: Date.now() });
    this.histograms.set(key, existing);
  }

  /**
   * 특정 카운터의 현재 값을 조회합니다.
   *
   * @param metric - 카운터 메트릭 정의
   * @param labels - 메트릭 레이블 (기본값: 빈 객체)
   * @returns 현재 카운터 값 (없으면 0)
   */
  getCounter(metric: CounterMetric, labels: MetricLabels = {}): number {
    const key = this.makeKey(metric.name, labels);
    const values = this.counters.get(key);
    if (!values || values.length === 0) return 0;
    return values[values.length - 1].value;
  }

  /** 내보내기를 위해 모든 카운터 데이터를 읽기 전용으로 반환합니다 */
  getCounterData(): ReadonlyMap<string, readonly MetricValue[]> {
    return this.counters;
  }

  /** 내보내기를 위해 모든 히스토그램 데이터를 읽기 전용으로 반환합니다 */
  getHistogramData(): ReadonlyMap<string, readonly MetricValue[]> {
    return this.histograms;
  }

  /** 모든 메트릭 데이터를 초기화합니다 (테스트 등에서 사용) */
  reset(): void {
    this.counters.clear();
    this.histograms.clear();
  }

  /**
   * 메트릭 이름과 레이블로 고유 키를 생성합니다.
   * 키 형식: "이름{label1=value1,label2=value2}" (레이블 키 순으로 정렬)
   *
   * @param name - 메트릭 이름
   * @param labels - 메트릭 레이블
   * @returns 고유 키 문자열
   */
  private makeKey(name: string, labels: MetricLabels): string {
    const labelStr = Object.entries(labels)
      .sort(([a], [b]) => a.localeCompare(b)) // 키 이름으로 정렬하여 일관된 키 생성
      .map(([k, v]) => `${k}=${v}`)
      .join(",");
    return labelStr ? `${name}{${labelStr}}` : name;
  }
}

/** 싱글톤 메트릭 수집기 — 앱 전체에서 공유 */
export const metrics = new MetricsCollector();
