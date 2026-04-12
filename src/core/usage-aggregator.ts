/**
 * UsageAggregator — 에이전트 루프 반복 간 누적 토큰 사용량과 실행 메트릭 추적
 *
 * 내부 상태는 성능을 위해 가변(mutable)이지만,
 * 외부에는 snapshot()을 통해 불변 스냅샷만 제공합니다.
 *
 * RuntimeContext의 UsageAggregatorInterface를 구현합니다.
 *
 * @module core/usage-aggregator
 */

/**
 * 에이전트 루프 전체 실행에 걸쳐 누적된 토큰 사용량 통계
 *
 * @property totalPromptTokens - 전체 입력(프롬프트) 토큰 수
 * @property totalCompletionTokens - 전체 출력(응답) 토큰 수
 * @property totalTokens - 전체 토큰 수 (입력 + 출력)
 * @property iterationCount - 루프 반복 횟수
 * @property toolCallCount - 실행된 도구 호출 총 수
 * @property retriedCount - 재시도 횟수
 */
export interface AggregatedUsage {
  readonly totalPromptTokens: number;
  readonly totalCompletionTokens: number;
  readonly totalTokens: number;
  readonly iterationCount: number;
  readonly toolCallCount: number;
  readonly retriedCount: number;
}

/**
 * 에이전트 루프 반복 간 누적 토큰 사용량과 실행 메트릭을 추적합니다.
 */
export class UsageAggregator {
  private _totalPromptTokens = 0;
  private _totalCompletionTokens = 0;
  private _totalTokens = 0;
  private _iterationCount = 0;
  private _toolCallCount = 0;
  private _retriedCount = 0;

  /** 단일 LLM 호출의 토큰 사용량을 기록합니다 */
  recordLLMUsage(usage: {
    readonly promptTokens: number;
    readonly completionTokens: number;
    readonly totalTokens: number;
  }): void {
    this._totalPromptTokens += usage.promptTokens;
    this._totalCompletionTokens += usage.completionTokens;
    this._totalTokens += usage.totalTokens;
    this._iterationCount++;
  }

  /** 이번 반복에서 실행된 도구 호출 수를 기록합니다 */
  recordToolCalls(count: number): void {
    this._toolCallCount += count;
  }

  /** 재시도 시도를 기록합니다 */
  recordRetry(): void {
    this._retriedCount++;
  }

  /** 현재 누적 사용량의 불변 스냅샷을 반환합니다 */
  snapshot(): AggregatedUsage {
    return {
      totalPromptTokens: this._totalPromptTokens,
      totalCompletionTokens: this._totalCompletionTokens,
      totalTokens: this._totalTokens,
      iterationCount: this._iterationCount,
      toolCallCount: this._toolCallCount,
      retriedCount: this._retriedCount,
    };
  }
}
