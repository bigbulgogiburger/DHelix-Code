/**
 * RuntimeMetricsCollector — Per-stage 실행 메트릭 수집기
 *
 * 각 stage의 실행 시간, 호출 횟수, 에러율, 전환 이유를 수집하고
 * 스냅샷으로 조회할 수 있습니다. p95 계산, iteration 집계도 지원합니다.
 *
 * @module core/runtime/metrics
 */

import { type StageName, type TransitionReason } from "./types.js";

/**
 * 단일 stage에 대한 누적 실행 메트릭.
 */
export interface StageMetrics {
  /** Stage 고유 이름 */
  readonly stageName: StageName;
  /** 총 실행 횟수 */
  readonly totalExecutions: number;
  /** 총 실행 시간 (ms) */
  readonly totalDurationMs: number;
  /** 평균 실행 시간 (ms). 실행 횟수가 0이면 0 */
  readonly averageDurationMs: number;
  /** 95번째 백분위 실행 시간 (ms). 실행 횟수가 0이면 0 */
  readonly p95DurationMs: number;
  /** 에러 발생 횟수 */
  readonly errorCount: number;
  /** 마지막 실행 시각 (ISO 8601). 한 번도 실행되지 않았으면 null */
  readonly lastExecutedAt: string | null;
}

/**
 * RuntimeMetricsCollector의 전체 스냅샷.
 */
export interface RuntimeMetricsSnapshot {
  /** 각 stage별 메트릭 배열 */
  readonly stages: readonly StageMetrics[];
  /** 총 iteration 실행 횟수 */
  readonly totalIterations: number;
  /** 총 iteration 실행 시간 합계 (ms) */
  readonly totalDurationMs: number;
  /** context compaction 발생 횟수 */
  readonly compactionCount: number;
  /** transition reason별 발생 횟수 */
  readonly transitionReasons: Record<string, number>;
}

/**
 * 내부 stage 누적 상태.
 */
interface StageAccumulator {
  readonly durations: readonly number[];
  readonly errorCount: number;
  readonly lastExecutedAt: string | null;
}

/**
 * p95(95번째 백분위수)를 계산합니다.
 *
 * 샘플이 없으면 0을 반환합니다.
 * 정렬된 배열을 기준으로 nearest-rank 방식을 사용합니다.
 *
 * @param durations - 실행 시간 배열 (순서 무관)
 * @returns p95 값 (ms)
 */
function calculateP95(durations: readonly number[]): number {
  if (durations.length === 0) return 0;
  const sorted = [...durations].sort((a, b) => a - b);
  const index = Math.ceil(sorted.length * 0.95) - 1;
  return sorted[Math.max(0, index)];
}

/**
 * RuntimeMetricsCollector — stage별 실행 메트릭을 수집합니다.
 *
 * @example
 * ```typescript
 * const collector = new RuntimeMetricsCollector();
 * collector.recordStage("sample-llm", 320);
 * collector.recordStage("sample-llm", 280, true); // error
 * collector.recordTransition("tool-results");
 * collector.recordIteration(1200);
 * const snap = collector.snapshot();
 * console.log(snap.stages[0].p95DurationMs);
 * ```
 */
export class RuntimeMetricsCollector {
  /** stage 이름 → 누적 상태 */
  private stageAccumulators: Map<StageName, StageAccumulator> = new Map();

  /** transition reason → 발생 횟수 */
  private transitionCounts: Map<string, number> = new Map();

  /** iteration별 실행 시간 배열 */
  private iterationDurations: number[] = [];

  /** context compaction 발생 횟수 */
  private compactionCount: number = 0;

  /**
   * 단일 stage 실행 결과를 기록합니다.
   *
   * @param name - Stage 이름
   * @param durationMs - 실행 시간 (ms)
   * @param error - 에러 발생 여부 (기본값 false)
   */
  recordStage(name: StageName, durationMs: number, error = false): void {
    const prev = this.stageAccumulators.get(name);
    const prevDurations = prev?.durations ?? [];
    const prevErrors = prev?.errorCount ?? 0;

    this.stageAccumulators.set(name, {
      durations: [...prevDurations, durationMs],
      errorCount: prevErrors + (error ? 1 : 0),
      lastExecutedAt: new Date().toISOString(),
    });
  }

  /**
   * iteration 전환 이유를 기록합니다.
   *
   * @param reason - 전환 이유
   */
  recordTransition(reason: TransitionReason): void {
    const prev = this.transitionCounts.get(reason) ?? 0;
    this.transitionCounts.set(reason, prev + 1);
  }

  /**
   * 단일 iteration 실행 시간을 기록합니다.
   *
   * @param durationMs - iteration 전체 실행 시간 (ms)
   */
  recordIteration(durationMs: number): void {
    this.iterationDurations.push(durationMs);
  }

  /**
   * context compaction 발생을 기록합니다.
   */
  recordCompaction(): void {
    this.compactionCount += 1;
  }

  /**
   * 현재까지 수집된 메트릭의 불변 스냅샷을 반환합니다.
   *
   * @returns RuntimeMetricsSnapshot
   */
  snapshot(): RuntimeMetricsSnapshot {
    const stages: StageMetrics[] = [];

    for (const [stageName, acc] of this.stageAccumulators) {
      const total = acc.durations.length;
      const totalDuration = acc.durations.reduce((sum, d) => sum + d, 0);
      stages.push({
        stageName,
        totalExecutions: total,
        totalDurationMs: totalDuration,
        averageDurationMs: total > 0 ? totalDuration / total : 0,
        p95DurationMs: calculateP95(acc.durations),
        errorCount: acc.errorCount,
        lastExecutedAt: acc.lastExecutedAt,
      });
    }

    const totalIterationDuration = this.iterationDurations.reduce((sum, d) => sum + d, 0);

    const transitionReasons: Record<string, number> = {};
    for (const [reason, count] of this.transitionCounts) {
      transitionReasons[reason] = count;
    }

    return {
      stages,
      totalIterations: this.iterationDurations.length,
      totalDurationMs: totalIterationDuration,
      compactionCount: this.compactionCount,
      transitionReasons,
    };
  }

  /**
   * 수집된 모든 메트릭을 초기화합니다.
   * 새로운 세션이나 테스트 격리에 사용합니다.
   */
  reset(): void {
    this.stageAccumulators = new Map();
    this.transitionCounts = new Map();
    this.iterationDurations = [];
    this.compactionCount = 0;
  }
}
