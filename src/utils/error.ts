/**
 * 에러 유틸리티 — dhelix 전체에서 사용하는 구조화된 에러 클래스 모음
 *
 * 모든 에러는 BaseError를 상속하며, 에러 코드(code)와 추가 컨텍스트(context)를
 * 함께 전달해 디버깅을 돕습니다.
 *
 * @example
 * throw new ConfigError("API key가 설정되지 않았습니다", { envVar: "OPENAI_API_KEY" });
 * // → ConfigError { code: "CONFIG_ERROR", context: { envVar: "OPENAI_API_KEY" } }
 *
 * @example
 * // 타입 가드(type guard)를 사용하여 BaseError 여부를 확인할 수 있습니다
 * if (isBaseError(error)) {
 *   console.log(error.code, error.context);
 * }
 */

/**
 * 모든 dhelix 에러의 기본(base) 클래스.
 * 에러 코드와 불변(immutable) 컨텍스트 객체를 함께 담습니다.
 *
 * - code: 에러 종류를 식별하는 문자열 (예: "CONFIG_ERROR", "LLM_ERROR")
 * - context: 에러 발생 상황을 설명하는 추가 정보 (Object.freeze로 불변 처리)
 */
export class BaseError extends Error {
  /** 에러 종류를 식별하는 코드 (예: "CONFIG_ERROR", "LLM_ERROR") */
  readonly code: string;
  /** 에러 발생 맥락을 담는 불변 객체 — 디버깅에 활용 */
  readonly context: Readonly<Record<string, unknown>>;

  /**
   * @param message - 에러 메시지 (사람이 읽을 수 있는 설명)
   * @param code - 에러 코드 문자열 (프로그래밍 방식으로 에러 종류를 구분할 때 사용)
   * @param context - 에러 발생 맥락 정보 (선택적)
   */
  constructor(message: string, code: string, context: Record<string, unknown> = {}) {
    super(message);
    // this.name을 클래스 이름으로 설정하여 스택 트레이스(stack trace)에서 구분 가능하게 함
    this.name = this.constructor.name;
    this.code = code;
    // Object.freeze: context 객체를 불변으로 만들어 실수로 수정하는 것을 방지
    this.context = Object.freeze({ ...context });
  }

  /**
   * 기존 에러에 추가 컨텍스트를 덧붙인 새로운 에러를 생성합니다.
   * 원본 에러는 변경하지 않고 새 인스턴스를 반환합니다(불변 패턴).
   *
   * @param extra - 기존 context에 합칠 추가 정보
   * @returns 추가 컨텍스트가 포함된 새로운 BaseError 인스턴스
   *
   * @example
   * const err = new BaseError("실패", "SOME_ERROR", { step: 1 });
   * const enriched = err.withContext({ userId: "abc" });
   * // enriched.context → { step: 1, userId: "abc" }
   */
  withContext(extra: Record<string, unknown>): BaseError {
    return new BaseError(this.message, this.code, { ...this.context, ...extra });
  }
}

/**
 * 설정(Configuration) 로딩 또는 유효성 검사(validation) 실패 시 발생하는 에러.
 * 예: 설정 파일 파싱 실패, 필수 환경 변수 누락 등
 */
export class ConfigError extends BaseError {
  constructor(message: string, context: Record<string, unknown> = {}) {
    super(message, "CONFIG_ERROR", context);
  }
}

/**
 * LLM(대규모 언어 모델) 클라이언트 통신 에러.
 * 예: API 호출 실패, 네트워크 타임아웃, 응답 파싱 에러 등
 */
export class LLMError extends BaseError {
  constructor(message: string, context: Record<string, unknown> = {}) {
    super(message, "LLM_ERROR", context);
  }
}

/**
 * 도구(Tool) 실행 에러.
 * 예: file_read 도구가 존재하지 않는 파일을 읽으려 할 때,
 *     bash 명령이 비정상 종료될 때 등
 */
export class ToolError extends BaseError {
  constructor(message: string, context: Record<string, unknown> = {}) {
    super(message, "TOOL_ERROR", context);
  }
}

/**
 * 권한 거부(Permission denied) 에러.
 * 예: 사용자가 허가하지 않은 도구 실행 시도,
 *     파일 시스템 접근 권한 부족 등
 */
export class PermissionError extends BaseError {
  constructor(message: string, context: Record<string, unknown> = {}) {
    super(message, "PERMISSION_ERROR", context);
  }
}

/**
 * 인증(Authentication) 에러.
 * 예: API 키 만료, 잘못된 토큰, OAuth 인증 실패 등
 */
export class AuthError extends BaseError {
  constructor(message: string, context: Record<string, unknown> = {}) {
    super(message, "AUTH_ERROR", context);
  }
}

/**
 * 대화(Conversation) 상태 에러.
 * 예: 존재하지 않는 대화 ID 참조, 대화 상태 불일치 등
 */
export class ConversationError extends BaseError {
  constructor(message: string, context: Record<string, unknown> = {}) {
    super(message, "CONVERSATION_ERROR", context);
  }
}

/**
 * BaseError 타입 가드(type guard) — unknown 타입의 에러가 BaseError인지 확인합니다.
 *
 * TypeScript의 타입 가드 함수로, 조건문 안에서 사용하면
 * 자동으로 타입이 좁혀져(narrowing) BaseError의 속성에 접근할 수 있습니다.
 *
 * @param error - 확인할 에러 객체
 * @returns error가 BaseError의 인스턴스이면 true
 *
 * @example
 * try { ... } catch (error) {
 *   if (isBaseError(error)) {
 *     // 여기서 error는 BaseError로 타입이 좁혀짐
 *     console.log(error.code, error.context);
 *   }
 * }
 */
export function isBaseError(error: unknown): error is BaseError {
  return error instanceof BaseError;
}
