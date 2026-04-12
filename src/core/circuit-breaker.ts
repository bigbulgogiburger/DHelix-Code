/**
 * 서킷 브레이커(Circuit Breaker) 모듈
 *
 * 에이전트 루프가 무한 반복에 빠지는 것을 방지하는 안전장치입니다.
 * 전기의 "차단기(circuit breaker)"에서 이름을 따온 패턴으로,
 * 과부하(무한 루프)가 감지되면 "회로를 차단"하여 루프를 중지시킵니다.
 *
 * 주니어 개발자를 위한 설명:
 * - 에이전트 루프는 LLM 호출 -> 도구 실행 -> 결과 전달을 반복합니다
 * - 간혹 LLM이 같은 실수를 반복하거나 진전 없이 돌 수 있습니다
 * - 이 모듈은 그런 상황을 감지하고 루프를 자동으로 멈춥니다
 * - "closed" = 정상 작동 중 (전기가 흐름), "open" = 차단됨 (전기가 끊김)
 */

/**
 * 에이전트 루프의 한 번의 반복(iteration) 결과
 * 서킷 브레이커가 진전 여부를 판단하는 데 사용합니다.
 *
 * @property filesModified - 이번 반복에서 수정된 파일 경로 목록
 * @property error - 발생한 에러 메시지 (없으면 undefined)
 * @property hasOutput - LLM이 텍스트 출력을 생성했는지 여부
 */
export interface IterationResult {
  readonly filesModified: ReadonlySet<string>;
  readonly error?: string;
  readonly hasOutput: boolean;
}

/**
 * 서킷 브레이커 상태
 * - "closed": 정상 — 루프 계속 실행 가능
 * - "open": 차단됨 — 루프 즉시 중지 필요
 */
export type CircuitState = "closed" | "open";

/**
 * 서킷 브레이커의 현재 상태 스냅샷
 *
 * @property state - 현재 회로 상태 ("closed" 또는 "open")
 * @property reason - 차단된 이유 (차단되지 않았으면 undefined)
 * @property iterationCount - 지금까지 실행된 반복 횟수
 * @property consecutiveNoChangeCount - 연속으로 변경이 없었던 횟수
 * @property consecutiveSameErrorCount - 연속으로 같은 에러가 발생한 횟수
 */
export interface CircuitBreakerStatus {
  readonly state: CircuitState;
  readonly reason?: string;
  readonly iterationCount: number;
  readonly consecutiveNoChangeCount: number;
  readonly consecutiveSameErrorCount: number;
}

// --- 차단 임계값(threshold) 상수들 ---

/** 연속으로 변경이 없는 반복이 이 횟수에 도달하면 차단합니다 */
const NO_CHANGE_THRESHOLD = 5;

/** 연속으로 같은 에러가 이 횟수에 도달하면 차단합니다 */
const SAME_ERROR_THRESHOLD = 5;

/** 기본 최대 반복 횟수 제한 (하드 리밋) */
const DEFAULT_MAX_ITERATIONS = 50;

/**
 * Ralph Loop 패턴 — 에이전트 루프의 무한 반복을 방지합니다.
 *
 * 다음 조건 중 하나가 충족되면 회로를 차단(open)합니다:
 * 1. 파일 변경이나 출력 없이 3회 연속 반복된 경우
 * 2. 동일한 에러가 5회 연속 발생한 경우
 * 3. 최대 반복 횟수(maxIterations) 초과
 *
 * 기본 상태는 "closed"(반복 허용)이며,
 * 문제가 감지되면 "open"(반복 차단)으로 전환됩니다.
 */
export class CircuitBreaker {
  private readonly maxIterations: number;
  private iterationCount = 0;
  private consecutiveNoChangeCount = 0;
  private consecutiveSameErrorCount = 0;
  private lastError: string | undefined = undefined;
  private currentState: CircuitState = "closed";
  private openReason: string | undefined = undefined;

  /**
   * @param maxIterations - 최대 허용 반복 횟수 (기본값: 50)
   */
  constructor(maxIterations?: number) {
    this.maxIterations = maxIterations ?? DEFAULT_MAX_ITERATIONS;
  }

  /**
   * 반복 결과를 기록하고 서킷 상태를 업데이트합니다.
   *
   * 매 반복이 끝날 때마다 호출해야 합니다.
   * 결과를 분석하여 "진전이 있는지" 판단하고,
   * 문제가 감지되면 회로를 차단합니다.
   *
   * @param result - 이번 반복의 실행 결과
   */
  recordIteration(result: IterationResult): void {
    // 이미 차단된 상태에서는 기록하지 않음
    if (this.currentState === "open") return;

    this.iterationCount++;

    // 파일 수정도 없고 출력도 없으면 "변화 없음" 카운터 증가
    if (result.filesModified.size === 0 && !result.hasOutput) {
      this.consecutiveNoChangeCount++;
    } else {
      // 진전이 있으면 카운터 초기화
      this.consecutiveNoChangeCount = 0;
    }

    // 같은 에러가 반복되는지 추적
    if (result.error) {
      if (result.error === this.lastError) {
        // 이전과 동일한 에러 -> 카운터 증가
        this.consecutiveSameErrorCount++;
      } else {
        // 다른 에러 -> 카운터 리셋 후 새 에러로 시작
        this.consecutiveSameErrorCount = 1;
        this.lastError = result.error;
      }
    } else {
      // 에러가 없으면 에러 카운터 초기화
      this.consecutiveSameErrorCount = 0;
      this.lastError = undefined;
    }

    // --- 차단 조건 검사 ---

    // 최대 반복 횟수 초과
    if (this.iterationCount >= this.maxIterations) {
      this.currentState = "open";
      this.openReason = `Exceeded maximum iteration limit (${this.maxIterations})`;
    }
    // 연속 무변화 임계값 도달
    else if (this.consecutiveNoChangeCount >= NO_CHANGE_THRESHOLD) {
      this.currentState = "open";
      this.openReason = `${NO_CHANGE_THRESHOLD} consecutive iterations with no file changes or output`;
    }
    // 동일 에러 반복 임계값 도달
    else if (this.consecutiveSameErrorCount >= SAME_ERROR_THRESHOLD) {
      this.currentState = "open";
      this.openReason = `${SAME_ERROR_THRESHOLD} consecutive iterations with the same error: "${this.lastError}"`;
    }
  }

  /**
   * 에이전트 루프가 계속 실행해도 되는지 확인합니다.
   *
   * @returns true면 계속 실행 가능 (closed), false면 즉시 중지 (open)
   */
  shouldContinue(): boolean {
    return this.currentState === "closed";
  }

  /**
   * 현재 서킷 브레이커의 상태 스냅샷을 반환합니다.
   * 디버깅이나 UI 표시에 유용합니다.
   *
   * @returns 현재 상태 정보 객체
   */
  getStatus(): CircuitBreakerStatus {
    return {
      state: this.currentState,
      reason: this.openReason,
      iterationCount: this.iterationCount,
      consecutiveNoChangeCount: this.consecutiveNoChangeCount,
      consecutiveSameErrorCount: this.consecutiveSameErrorCount,
    };
  }

  /**
   * Returns a user-friendly explanation of why the circuit breaker opened.
   * Provides actionable advice for the user to resolve the situation.
   */
  getUserFriendlyReason(): string {
    if (this.currentState !== "open") return "";

    if (this.iterationCount >= this.maxIterations) {
      return `Reached the maximum number of steps (${this.maxIterations}). The task may be too complex for a single run. Try breaking it into smaller parts or increasing the limit with --max-iterations.`;
    }

    if (this.consecutiveNoChangeCount >= NO_CHANGE_THRESHOLD) {
      return `No progress detected after ${NO_CHANGE_THRESHOLD} consecutive attempts. The agent may be stuck. Try rephrasing your request or providing more specific instructions.`;
    }

    if (this.consecutiveSameErrorCount >= SAME_ERROR_THRESHOLD) {
      return `The same error occurred ${SAME_ERROR_THRESHOLD} times in a row: "${this.lastError}". This suggests a persistent issue that retrying won't fix. Check the error details and try a different approach.`;
    }

    return this.openReason ?? "Unknown reason";
  }

  /**
   * 서킷 브레이커를 초기 상태로 리셋합니다.
   * 새 에이전트 루프를 시작하거나 수동 복구 후에 사용합니다.
   */
  reset(): void {
    this.iterationCount = 0;
    this.consecutiveNoChangeCount = 0;
    this.consecutiveSameErrorCount = 0;
    this.lastError = undefined;
    this.currentState = "closed";
    this.openReason = undefined;
  }
}
