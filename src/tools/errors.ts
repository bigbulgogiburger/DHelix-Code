/**
 * 표준화된 도구 에러 타입 시스템 — 모든 도구 에러를 일관된 형태로 분류하고 처리하는 모듈
 *
 * 주요 기능:
 * 1. ToolErrorKind — 10가지 에러 카테고리로 분류하는 유니온 타입
 * 2. ToolExecutionError — 에러 종류, 재시도 가능 여부, 교정 가능 여부를 포함하는 표준 에러 클래스
 * 3. classifyError() — 원시 에러를 ToolExecutionError로 변환하는 분류 함수
 * 4. RETRY_STRATEGY_MATRIX — 각 에러 종류별 재시도/교정 전략을 정의하는 설정 매트릭스
 *
 * 기존 executor.ts의 regex 기반 에러 판별을 대체하여
 * 구조화된 에러 분류와 일관된 재시도 정책을 제공합니다.
 *
 * @module tools/errors
 */

/**
 * 도구 에러 종류 — 10가지 에러 카테고리
 *
 * 각 종류는 재시도/교정 전략이 다릅니다:
 * - validation: Zod 스키마 검증 실패 (교정 가능)
 * - permission_denied: EACCES, 권한 부족 (재시도/교정 불가)
 * - not_found: ENOENT, 파일/리소스 없음 (Levenshtein 교정 가능)
 * - timeout: AbortSignal 만료 (타임아웃 증가 후 재시도 가능)
 * - transient: 네트워크 일시 오류 (지수 백오프 재시도)
 * - tool_not_found: 레지스트리에 없는 도구 (재시도/교정 불가)
 * - aborted: 사용자 취소 (재시도/교정 불가)
 * - internal: 예상치 못한 에러 (재시도/교정 불가)
 * - rate_limited: API rate limit 초과 (Retry-After 대기 후 재시도)
 * - output_too_large: 결과 크기 초과 (truncation으로 교정)
 */
export type ToolErrorKind =
  | "validation"
  | "permission_denied"
  | "not_found"
  | "timeout"
  | "transient"
  | "tool_not_found"
  | "aborted"
  | "internal"
  | "rate_limited"
  | "output_too_large";

/**
 * 표준화된 도구 실행 에러 — 에러 종류, 도구 이름, 재시도/교정 가능 여부를 포함
 *
 * 기존에는 Error 객체의 message를 regex로 분석했지만,
 * 이 클래스는 구조화된 필드를 통해 에러를 체계적으로 처리합니다.
 *
 * @example
 * ```typescript
 * const error = new ToolExecutionError(
 *   'not_found', 'file_read', 'File not found: index.ts',
 *   originalError, true, true
 * );
 * if (error.retryable) { ... }
 * if (error.correctable) { ... }
 * ```
 */
export class ToolExecutionError extends Error {
  /** 에러 클래스 이름 식별자 */
  override readonly name = "ToolExecutionError";

  /**
   * @param kind - 에러 종류 (10가지 카테고리 중 하나)
   * @param toolName - 에러가 발생한 도구의 이름
   * @param message - 사람이 읽을 수 있는 에러 메시지
   * @param originalError - 원래 발생한 에러 객체 (디버깅용)
   * @param retryable - 동일한 인수로 재시도 가능 여부
   * @param correctable - 인수를 교정하여 재시도 가능 여부
   */
  constructor(
    readonly kind: ToolErrorKind,
    readonly toolName: string,
    message: string,
    readonly originalError?: unknown,
    readonly retryable: boolean = false,
    readonly correctable: boolean = false,
  ) {
    super(message);
  }
}

/**
 * 재시도 전략 설정 — 에러 종류별 재시도/교정 정책을 정의하는 인터페이스
 */
export interface RetryStrategy {
  /** 재시도 가능 여부 */
  readonly retryable: boolean;
  /** 인수 교정 가능 여부 */
  readonly correctable: boolean;
  /** 최대 재시도 횟수 */
  readonly maxAttempts: number;
  /** 백오프 전략: exponential(지수), immediate(즉시), retry-after(서버 지시), none(없음) */
  readonly backoff: "exponential" | "immediate" | "retry-after" | "none";
  /** 초기 백오프 대기 시간 (밀리초) */
  readonly baseDelayMs: number;
}

/**
 * 재시도 전략 매트릭스 — 각 ToolErrorKind별 재시도/교정 전략을 as const로 정의
 *
 * 이 매트릭스는 RetryEngine이 에러 종류에 따라 적절한 재시도 전략을 결정하는 데 사용됩니다.
 *
 * | Error Kind       | Retry? | Correction?  | Max Attempts | Backoff       |
 * |------------------|--------|--------------|:------------:|---------------|
 * | transient        | Yes    | No           | 3            | Exponential   |
 * | not_found        | Yes    | Levenshtein  | 1            | Immediate     |
 * | validation       | Yes    | JSON repair  | 1            | Immediate     |
 * | timeout          | Yes    | No           | 1            | Exponential   |
 * | rate_limited     | Yes    | No           | 3            | Retry-After   |
 * | permission_denied| No     | No           | 0            | None          |
 * | aborted          | No     | No           | 0            | None          |
 * | tool_not_found   | No     | No           | 0            | None          |
 * | internal         | No     | No           | 0            | None          |
 * | output_too_large | No     | Truncation   | 0            | None          |
 */
export const RETRY_STRATEGY_MATRIX: Readonly<Record<ToolErrorKind, RetryStrategy>> = {
  transient: {
    retryable: true,
    correctable: false,
    maxAttempts: 3,
    backoff: "exponential",
    baseDelayMs: 1000,
  },
  not_found: {
    retryable: true,
    correctable: true,
    maxAttempts: 1,
    backoff: "immediate",
    baseDelayMs: 0,
  },
  validation: {
    retryable: true,
    correctable: true,
    maxAttempts: 1,
    backoff: "immediate",
    baseDelayMs: 0,
  },
  timeout: {
    retryable: true,
    correctable: false,
    maxAttempts: 1,
    backoff: "exponential",
    baseDelayMs: 1000,
  },
  rate_limited: {
    retryable: true,
    correctable: false,
    maxAttempts: 3,
    backoff: "retry-after",
    baseDelayMs: 2000,
  },
  permission_denied: {
    retryable: false,
    correctable: false,
    maxAttempts: 0,
    backoff: "none",
    baseDelayMs: 0,
  },
  aborted: {
    retryable: false,
    correctable: false,
    maxAttempts: 0,
    backoff: "none",
    baseDelayMs: 0,
  },
  tool_not_found: {
    retryable: false,
    correctable: false,
    maxAttempts: 0,
    backoff: "none",
    baseDelayMs: 0,
  },
  internal: {
    retryable: false,
    correctable: false,
    maxAttempts: 0,
    backoff: "none",
    baseDelayMs: 0,
  },
  output_too_large: {
    retryable: false,
    correctable: true,
    maxAttempts: 0,
    backoff: "none",
    baseDelayMs: 0,
  },
} as const;

/**
 * 원시 에러를 ToolExecutionError로 분류하는 함수
 *
 * 에러 메시지와 에러 코드를 분석하여 적절한 ToolErrorKind를 결정합니다.
 * 분류 우선순위 (위에서부터 매칭):
 * 1. AbortError → aborted
 * 2. EACCES / permission denied → permission_denied
 * 3. ENOENT / not found → not_found
 * 4. ETIMEDOUT / ECONNRESET / EPIPE / EAI_AGAIN → transient
 * 5. rate limit / 429 패턴 → rate_limited
 * 6. Zod validation / parse error → validation
 * 7. timeout 관련 패턴 → timeout
 * 8. 그 외 → internal
 *
 * @param error - 분류할 원시 에러 객체 (Error, string, unknown 모두 허용)
 * @param toolName - 에러가 발생한 도구의 이름
 * @returns 분류된 ToolExecutionError 인스턴스
 */
export function classifyError(error: unknown, toolName: string): ToolExecutionError {
  // 이미 ToolExecutionError이면 그대로 반환
  if (error instanceof ToolExecutionError) {
    return error;
  }

  const msg = error instanceof Error ? error.message : String(error);
  const code = extractErrorCode(error);

  // AbortError — 사용자 취소 또는 AbortController.abort()
  if (isAbortError(error)) {
    const strategy = RETRY_STRATEGY_MATRIX.aborted;
    return new ToolExecutionError(
      "aborted",
      toolName,
      `Tool "${toolName}" was aborted`,
      error,
      strategy.retryable,
      strategy.correctable,
    );
  }

  // EACCES — 파일/디렉토리 권한 부족
  if (code === "EACCES" || /EACCES|permission denied/i.test(msg)) {
    const strategy = RETRY_STRATEGY_MATRIX.permission_denied;
    return new ToolExecutionError(
      "permission_denied",
      toolName,
      `Tool "${toolName}" permission denied: ${msg}`,
      error,
      strategy.retryable,
      strategy.correctable,
    );
  }

  // ENOENT — 파일 또는 리소스를 찾을 수 없음
  if (code === "ENOENT" || /ENOENT|no such file|not found/i.test(msg)) {
    const strategy = RETRY_STRATEGY_MATRIX.not_found;
    return new ToolExecutionError(
      "not_found",
      toolName,
      `Tool "${toolName}" resource not found: ${msg}`,
      error,
      strategy.retryable,
      strategy.correctable,
    );
  }

  // 일시적 네트워크 에러 — 재시도하면 해결될 가능성이 높음
  if (
    code === "ETIMEDOUT" ||
    code === "ECONNRESET" ||
    code === "EPIPE" ||
    code === "EAI_AGAIN" ||
    code === "ENOTFOUND" ||
    /ECONNRESET|ETIMEDOUT|ENOTFOUND|EPIPE|EAI_AGAIN/.test(msg)
  ) {
    const strategy = RETRY_STRATEGY_MATRIX.transient;
    return new ToolExecutionError(
      "transient",
      toolName,
      `Tool "${toolName}" transient error: ${msg}`,
      error,
      strategy.retryable,
      strategy.correctable,
    );
  }

  // Rate limit — API 호출 제한 초과
  if (/rate.?limit|429|too many requests/i.test(msg)) {
    const strategy = RETRY_STRATEGY_MATRIX.rate_limited;
    return new ToolExecutionError(
      "rate_limited",
      toolName,
      `Tool "${toolName}" rate limited: ${msg}`,
      error,
      strategy.retryable,
      strategy.correctable,
    );
  }

  // Validation — Zod 검증 실패 또는 JSON 파싱 에러
  if (/parse.*error|invalid.*json|unexpected token|invalid.*arg|validation|zod/i.test(msg)) {
    const strategy = RETRY_STRATEGY_MATRIX.validation;
    return new ToolExecutionError(
      "validation",
      toolName,
      `Tool "${toolName}" validation error: ${msg}`,
      error,
      strategy.retryable,
      strategy.correctable,
    );
  }

  // Timeout — 시간 초과 (AbortSignal timeout과는 별도)
  if (/timed?\s*out|timeout/i.test(msg)) {
    const strategy = RETRY_STRATEGY_MATRIX.timeout;
    return new ToolExecutionError(
      "timeout",
      toolName,
      `Tool "${toolName}" timed out: ${msg}`,
      error,
      strategy.retryable,
      strategy.correctable,
    );
  }

  // 그 외 — 예상치 못한 내부 에러
  const strategy = RETRY_STRATEGY_MATRIX.internal;
  return new ToolExecutionError(
    "internal",
    toolName,
    `Tool "${toolName}" internal error: ${msg}`,
    error,
    strategy.retryable,
    strategy.correctable,
  );
}

/**
 * 에러 객체에서 Node.js 에러 코드를 추출
 *
 * Node.js의 시스템 에러(SystemError)는 code 프로퍼티에 에러 코드를 포함합니다.
 * 예: ENOENT, EACCES, ETIMEDOUT
 *
 * @param error - 에러 코드를 추출할 객체
 * @returns 에러 코드 문자열 또는 undefined
 */
function extractErrorCode(error: unknown): string | undefined {
  if (
    error !== null &&
    error !== undefined &&
    typeof error === "object" &&
    "code" in error &&
    typeof (error as Record<string, unknown>).code === "string"
  ) {
    return (error as Record<string, unknown>).code as string;
  }
  return undefined;
}

/**
 * AbortError인지 판별 — AbortController.abort()로 발생한 에러인지 확인
 *
 * AbortError는 다양한 형태로 나타날 수 있습니다:
 * 1. error.name === 'AbortError' (표준 웹 API)
 * 2. error.code === 'ABORT_ERR' (Node.js)
 * 3. error.message에 'aborted' 포함
 *
 * @param error - 판별할 에러 객체
 * @returns AbortError이면 true
 */
function isAbortError(error: unknown): boolean {
  if (error instanceof Error) {
    if (error.name === "AbortError") return true;
    if ("code" in error && (error as Record<string, unknown>).code === "ABORT_ERR") return true;
  }
  if (
    error !== null &&
    error !== undefined &&
    typeof error === "object" &&
    "name" in error &&
    (error as Record<string, unknown>).name === "AbortError"
  ) {
    return true;
  }
  return false;
}
