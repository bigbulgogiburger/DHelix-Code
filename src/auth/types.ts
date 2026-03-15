/**
 * 인증(Authentication) 타입 정의 — API 토큰 관리에 사용되는 공통 인터페이스
 *
 * 이 파일은 LLM API 호출에 필요한 인증 토큰의 형식, 출처,
 * 설정을 정의합니다. dbcode는 다양한 LLM 제공자(OpenAI, Anthropic 등)를
 * 지원하므로 여러 인증 방식을 추상화합니다.
 *
 * 인증 흐름:
 * 1. 토큰 설정(TokenConfig) — 인증 방법과 토큰 값을 정의
 * 2. 토큰 해석(ResolvedToken) — 환경변수나 파일에서 토큰을 로드
 * 3. HTTP 헤더 생성 — Bearer, API-Key, 또는 커스텀 헤더로 변환
 */

/**
 * 인증 방법 타입 — API 인증에 사용되는 HTTP 헤더 방식
 *
 * - "bearer": Authorization: Bearer <token> 헤더 (가장 일반적, OAuth2 표준)
 *   예) OpenAI, Anthropic 등 대부분의 API가 이 방식을 사용
 *
 * - "api-key": X-API-Key: <token> 헤더 (API 키 전용 헤더)
 *   예) 일부 서비스에서 API 키를 별도 헤더로 전달
 *
 * - "custom-header": 사용자 지정 헤더명으로 토큰 전달
 *   예) 내부 서비스나 프록시에서 비표준 헤더를 요구하는 경우
 */
export type AuthMethod = "bearer" | "api-key" | "custom-header";

/**
 * 토큰 설정 — 인증 방법과 토큰 값을 포함하는 설정 객체
 *
 * @property method - 인증 방법 (bearer, api-key, custom-header)
 * @property token - 실제 토큰 문자열 (API 키 값)
 * @property headerName - custom-header 방식일 때 사용할 헤더 이름
 *   bearer → "Authorization", api-key → "X-API-Key"는 자동 설정
 *   custom-header일 때만 이 값이 사용됨
 */
export interface TokenConfig {
  readonly method: AuthMethod;
  readonly token: string;
  readonly headerName?: string;
}

/**
 * 토큰 출처 — 토큰이 어디에서 로드되었는지를 나타내는 타입
 *
 * 디버깅과 보안 감사를 위해 토큰의 출처를 추적합니다.
 *
 * - "environment": 환경 변수에서 로드됨 (DBCODE_API_KEY, OPENAI_API_KEY)
 *   가장 높은 우선순위. CI/CD 환경에서 주로 사용
 *
 * - "file": 자격 증명 파일에서 로드됨 (~/.dbcode/credentials.json)
 *   로컬 개발 환경에서 주로 사용
 *
 * - "keychain": 운영체제 키체인에서 로드됨 (macOS Keychain, Windows Credential Manager)
 *   가장 안전한 방식 (현재 미구현)
 *
 * - "config": 설정 파일에서 로드됨
 *   기타 설정 소스에서 로드된 경우
 */
export type TokenSource = "environment" | "file" | "keychain" | "config";

/**
 * 해석된 토큰 — 설정과 메타데이터를 포함한 완전한 토큰 정보
 *
 * resolveToken() 함수가 여러 소스에서 토큰을 찾아 반환하는 결과입니다.
 *
 * @property config - 토큰 설정 (인증 방법, 토큰 값)
 * @property source - 토큰이 로드된 출처
 * @property expiresAt - 토큰 만료 시각 (선택적, 만료 관리가 필요한 토큰용)
 */
export interface ResolvedToken {
  readonly config: TokenConfig;
  readonly source: TokenSource;
  readonly expiresAt?: Date;
}
