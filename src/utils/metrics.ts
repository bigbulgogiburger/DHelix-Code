/**
 * 런타임 메트릭 수집기 — 앱 전체에서 누적되는 관찰 가능 메트릭
 *
 * 대시보드, /stats 명령어, 텔레메트리에서 참조됩니다.
 *
 * @module utils/metrics
 */

/** 메트릭 스냅샷 — 특정 시점의 런타임 상태 */
export interface MetricsSnapshot {
  readonly uptimeMs: number;
  readonly totalIterations: number;
  readonly totalToolCalls: number;
  readonly totalTokens: number;
  readonly totalErrors: number;
  readonly memoryUsageMB: number;
  readonly activeSessionId?: string;
}

/**
 * 앱 런타임 메트릭 수집기 (싱글턴 패턴)
 *
 * 에이전트 루프, 도구 실행, 에러 핸들러 등에서 increment를 호출하면
 * 여기서 누적 관리합니다. snapshot()으로 현재 상태를 읽습니다.
 */
class RuntimeMetrics {
  private readonly startTime = Date.now();
  private _totalIterations = 0;
  private _totalToolCalls = 0;
  private _totalTokens = 0;
  private _totalErrors = 0;
  private _activeSessionId?: string;

  /** 에이전트 루프 반복 횟수 증가 */
  recordIteration(): void {
    this._totalIterations++;
  }

  /** 도구 호출 횟수 증가 */
  recordToolCalls(count: number): void {
    this._totalToolCalls += count;
  }

  /** 토큰 사용량 추가 */
  recordTokens(count: number): void {
    this._totalTokens += count;
  }

  /** 에러 발생 기록 */
  recordError(): void {
    this._totalErrors++;
  }

  /** 현재 활성 세션 ID 설정 */
  setActiveSession(sessionId: string): void {
    this._activeSessionId = sessionId;
  }

  /** 현재 메트릭 스냅샷 반환 */
  snapshot(): MetricsSnapshot {
    return {
      uptimeMs: Date.now() - this.startTime,
      totalIterations: this._totalIterations,
      totalToolCalls: this._totalToolCalls,
      totalTokens: this._totalTokens,
      totalErrors: this._totalErrors,
      memoryUsageMB: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
      activeSessionId: this._activeSessionId,
    };
  }

  /** 카운터 리셋 (테스트용) */
  reset(): void {
    this._totalIterations = 0;
    this._totalToolCalls = 0;
    this._totalTokens = 0;
    this._totalErrors = 0;
    this._activeSessionId = undefined;
  }
}

/** 글로벌 메트릭 인스턴스 */
export const runtimeMetrics = new RuntimeMetrics();
