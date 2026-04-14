/**
 * 복구 전략(Recovery Strategy) 정의 모듈
 *
 * LLM 호출이나 도구 실행 중 에러가 발생했을 때,
 * 어떤 방식으로 복구할지 결정하는 전략 패턴을 정의합니다.
 *
 * 주니어 개발자를 위한 설명:
 * - 에러가 발생하면 무조건 실패하지 않고, 에러 종류에 따라 다른 복구 방법을 시도합니다
 * - 예를 들어 타임아웃은 "재시도", 컨텍스트 초과는 "압축", 파싱 에러는 "대체 전략"을 사용합니다
 * - 각 전략은 정규표현식(RegExp)으로 에러 메시지를 매칭합니다
 */

/**
 * 복구 전략 인터페이스
 *
 * @property errorPattern - 이 전략이 적용될 에러 메시지의 패턴 (정규표현식)
 * @property action - 복구 행동 유형:
 *   - "retry": 같은 요청을 재시도
 *   - "compact": 메시지를 압축(요약)한 뒤 재시도
 *   - "fallback-strategy": 대체 전략(텍스트 파싱 등)으로 전환
 * @property maxRetries - 이 전략으로 최대 몇 번까지 재시도할지
 * @property backoffMs - 재시도 전 기본 대기 시간 (밀리초, 지수적으로 증가함)
 * @property description - 사람이 읽을 수 있는 전략 설명
 */
export interface RecoveryStrategy {
  readonly errorPattern: RegExp;
  readonly action: "retry" | "compact" | "fallback-strategy";
  readonly maxRetries: number;
  readonly backoffMs?: number;
  readonly description: string;
}

/**
 * 미리 정의된 복구 전략 목록
 *
 * 에러 메시지 패턴에 따라 적절한 복구 행동을 매핑합니다.
 * 배열 순서대로 매칭을 시도하며, 첫 번째 매칭된 전략이 사용됩니다.
 */
export const RECOVERY_STRATEGIES: readonly RecoveryStrategy[] = [
  {
    // Rate limit (429) — the LLM client may have already retried with Retry-After,
    // but if it surfaces to the agent loop, we should wait longer
    errorPattern: /429|rate.?limit|too many requests/i,
    action: "retry",
    maxRetries: 2,
    backoffMs: 5000,
    description: "Rate limited — waiting before retry",
  },
  {
    // Server overload (503) — brief wait before retry
    errorPattern: /503|service unavailable|overloaded/i,
    action: "retry",
    maxRetries: 1,
    backoffMs: 3000,
    description: "Server temporarily overloaded — retrying shortly",
  },
  {
    // 컨텍스트 윈도우(대화 길이) 초과 에러
    // -> 오래된 메시지를 요약·압축하여 토큰 수를 줄인 뒤 재시도
    errorPattern: /request too large|context.*exceed|token.*limit/i,
    action: "compact",
    maxRetries: 1,
    description: "Context overflow — auto-compact and retry",
  },
  {
    // MCP 도구 타임아웃 에러 (MCP JSON-RPC 고유 패턴)
    // -> MCP 서버 응답이 늦을 때 1회만 재시도 (무한 재시도 방지)
    // Claude Code에서도 MCP 타임아웃은 알려진 문제 (issue #16837, #18684)
    errorPattern: /MCP tool error.*timed out|Request timed out.*tools\/call/i,
    action: "retry",
    maxRetries: 1,
    backoffMs: 3000,
    description: "MCP tool timeout — single retry with backoff",
  },
  {
    // MCP 서버 연결 에러
    // -> MCP 서버가 죽었거나 연결 불가 시 재시도하지 않고 즉시 실패
    // 재시도해도 소용없으므로 compact(메시지 정리) 후 LLM이 대안을 찾도록 유도
    errorPattern: /MCP.*ECONNREFUSED|MCP.*disconnected|MCP.*ECONNRESET/i,
    action: "compact",
    maxRetries: 1,
    description: "MCP connection lost — compact and continue without MCP",
  },
  {
    // 네트워크 타임아웃 에러 (LLM 호출)
    // -> 2초 간격으로 지수 백오프(exponential backoff) 재시도
    // 지수 백오프란? 재시도할 때마다 대기 시간을 2배로 늘리는 방식입니다 (2초 -> 4초 -> 8초)
    errorPattern: /ETIMEDOUT|timeout|timed out/i,
    action: "retry",
    maxRetries: 2,
    backoffMs: 2000,
    description: "Timeout — retry with backoff",
  },
  {
    // JSON 파싱 에러 (LLM 응답이 올바른 JSON이 아닐 때)
    // -> 도구 호출 전략을 텍스트 파싱 방식으로 전환
    errorPattern: /parse.*error|invalid.*json|unexpected token/i,
    action: "fallback-strategy",
    maxRetries: 1,
    description: "Parse error — fallback to text parsing",
  },
  {
    // 파일 잠금(lock) 에러
    // -> 다른 프로세스가 파일을 사용 중이므로 잠시 기다린 뒤 재시도
    errorPattern: /ELOCK|lock.*exist|locked/i,
    action: "retry",
    maxRetries: 3,
    backoffMs: 1000,
    description: "File lock — wait and retry",
  },
];

/**
 * 주어진 에러에 대한 복구 전략을 찾습니다.
 *
 * 에러 메시지를 RECOVERY_STRATEGIES의 각 패턴과 비교하여
 * 첫 번째로 매칭되는 전략을 반환합니다.
 *
 * @param error - 발생한 에러 객체
 * @returns 매칭된 복구 전략, 없으면 undefined
 */
export function findRecoveryStrategy(error: Error): RecoveryStrategy | undefined {
  return RECOVERY_STRATEGIES.find((s) => s.errorPattern.test(error.message));
}

/**
 * Returns a user-facing explanation of the recovery action being taken.
 * Used by the UI to show clear, non-technical messages during error recovery.
 */
export function getRecoveryExplanation(strategy: RecoveryStrategy, attempt: number): string {
  const { action, description, maxRetries } = strategy;

  switch (action) {
    case "compact":
      return `Context too large — compressing conversation history to continue (${description})`;
    case "retry":
      return `${description} (attempt ${attempt}/${maxRetries})`;
    case "fallback-strategy":
      return `Switching to alternative approach — ${description}`;
    default:
      return description;
  }
}

/**
 * Maximum backoff cap in milliseconds (30 seconds).
 * Prevents exponential backoff from growing unbounded.
 */
const MAX_BACKOFF_MS = 30_000;

/**
 * Action escalation order: retry → compact → fallback-strategy.
 * When a previous action fails, ChainedRecoveryStrategy advances to the next level.
 */
const ACTION_PRIORITY: readonly RecoveryStrategy["action"][] = [
  "retry",
  "compact",
  "fallback-strategy",
];

/**
 * Chained recovery strategy that escalates through action types.
 *
 * Given a chain of RecoveryStrategy entries, it picks the first matching
 * strategy for an error. If a previous action already failed, it escalates
 * to the next action type in priority order (retry → compact → fallback-strategy).
 *
 * Backoff values are capped at MAX_BACKOFF_MS (30 seconds).
 */
export class ChainedRecoveryStrategy {
  private readonly chain: readonly RecoveryStrategy[];

  constructor(chain: readonly RecoveryStrategy[]) {
    this.chain = chain;
  }

  /**
   * Find the next recovery strategy for the given error.
   *
   * @param error - The error to match against
   * @param previousAction - The action that was already tried and failed (if any)
   * @returns A matching strategy with capped backoff, or undefined if none match
   */
  findNext(
    error: Error,
    previousAction?: RecoveryStrategy["action"],
  ): RecoveryStrategy | undefined {
    const matching = this.chain.filter((s) => s.errorPattern.test(error.message));

    if (matching.length === 0) {
      return undefined;
    }

    // Determine the minimum action priority to use
    const minPriorityIndex = previousAction ? ACTION_PRIORITY.indexOf(previousAction) + 1 : 0;

    if (minPriorityIndex >= ACTION_PRIORITY.length) {
      return undefined;
    }

    const allowedActions = ACTION_PRIORITY.slice(minPriorityIndex);

    // Find the first matching strategy whose action is in the allowed set
    const candidate = matching.find((s) => allowedActions.includes(s.action));

    if (!candidate) {
      return undefined;
    }

    // Cap the backoff at MAX_BACKOFF_MS
    const cappedBackoff =
      candidate.backoffMs !== undefined ? Math.min(candidate.backoffMs, MAX_BACKOFF_MS) : undefined;

    return {
      ...candidate,
      backoffMs: cappedBackoff,
    };
  }
}

/**
 * Creates a ChainedRecoveryStrategy with the default RECOVERY_STRATEGIES.
 */
export function createDefaultRecoveryChain(): ChainedRecoveryStrategy {
  return new ChainedRecoveryStrategy(RECOVERY_STRATEGIES);
}
