/**
 * 토큰 관리자 — API 토큰의 해석, 캐싱, 제공을 담당하는 모듈
 *
 * 이 클래스는 토큰 저장소(token-store.ts)의 상위 추상화 계층으로,
 * 토큰의 생명주기를 관리합니다:
 *
 * 1. 해석(Resolve): 환경 변수나 파일에서 토큰을 찾음
 * 2. 캐싱(Cache): 한 번 해석된 토큰을 메모리에 캐시하여 반복 I/O 방지
 * 3. 제공(Provide): 인증 헤더 형태로 HTTP 요청에 사용할 수 있게 변환
 *
 * 사용 패턴:
 * ```ts
 * const manager = new TokenManager();
 * const headers = await manager.getAuthHeaders();
 * // headers = { "Authorization": "Bearer sk-..." }
 * ```
 *
 * LLM 클라이언트가 API 호출을 할 때마다 이 관리자를 통해
 * 인증 헤더를 가져옵니다.
 */

import { type ResolvedToken, type TokenConfig } from "./types.js";
import { resolveToken, saveToken } from "./token-store.js";
import { AuthError } from "../utils/error.js";

/**
 * 토큰 관리자 클래스
 *
 * 싱글톤 패턴은 아니지만, 일반적으로 애플리케이션에서
 * 하나의 인스턴스만 생성하여 사용합니다.
 */
export class TokenManager {
  /**
   * 메모리에 캐시된 토큰
   *
   * undefined면 아직 토큰을 해석하지 않았거나 캐시가 초기화된 상태입니다.
   * 해석 결과가 undefined(토큰 없음)인 것과 캐시가 없는 것은 다릅니다.
   */
  private cachedToken: ResolvedToken | undefined;

  /**
   * 현재 API 토큰을 가져옵니다. 캐시가 있으면 캐시를 반환합니다.
   *
   * 처음 호출 시 환경 변수와 파일을 확인하여 토큰을 해석하고,
   * 이후 호출에서는 캐시된 토큰을 반환합니다.
   *
   * @returns 해석된 토큰, 토큰이 설정되지 않았으면 undefined
   */
  async getToken(): Promise<ResolvedToken | undefined> {
    // 캐시된 토큰이 있으면 바로 반환 (불필요한 파일 I/O 방지)
    if (this.cachedToken) {
      return this.cachedToken;
    }

    // 환경 변수 → 파일 순서로 토큰 해석
    this.cachedToken = await resolveToken();
    return this.cachedToken;
  }

  /**
   * API 토큰을 가져오되, 없으면 에러를 던집니다.
   *
   * 토큰이 반드시 필요한 상황(API 호출 직전)에서 사용합니다.
   * 토큰이 없으면 사용자에게 설정 방법을 안내하는 에러 메시지를 표시합니다.
   *
   * @returns 해석된 토큰 (반드시 존재)
   * @throws AuthError - 토큰이 설정되지 않은 경우
   */
  async requireToken(): Promise<ResolvedToken> {
    const token = await this.getToken();
    if (!token) {
      throw new AuthError("No API token configured. Set DBCODE_API_KEY or run 'dbcode auth'.");
    }
    return token;
  }

  /**
   * 새로운 토큰을 저장하고 캐시를 업데이트합니다.
   *
   * 토큰을 자격 증명 파일(~/.dbcode/credentials.json)에 저장한 후,
   * 메모리 캐시도 즉시 업데이트하여 다음 getToken() 호출에서
   * 새 토큰이 반환되도록 합니다.
   *
   * @param config - 저장할 토큰 설정
   */
  async setToken(config: TokenConfig): Promise<void> {
    // 파일에 저장
    await saveToken(config);
    // 캐시도 즉시 업데이트 (source: "file" — 파일에서 저장했으므로)
    this.cachedToken = { config, source: "file" };
  }

  /**
   * 캐시된 토큰을 초기화합니다.
   *
   * 다음 getToken() 호출 시 환경 변수와 파일에서 다시 해석합니다.
   * 환경 변수가 변경되었거나 파일이 업데이트된 후 호출하면 유용합니다.
   */
  clearCache(): void {
    this.cachedToken = undefined;
  }

  /**
   * 현재 토큰을 HTTP 인증 헤더 형태로 변환합니다.
   *
   * 인증 방법에 따라 다른 헤더를 생성합니다:
   * - bearer: { "Authorization": "Bearer sk-..." }
   * - api-key: { "X-API-Key": "sk-..." }
   * - custom-header: { "<커스텀 헤더명>": "sk-..." }
   *
   * 토큰이 없으면 빈 객체를 반환합니다 (인증 없는 요청).
   *
   * @returns HTTP 헤더 객체 (요청에 직접 추가 가능)
   */
  async getAuthHeaders(): Promise<Record<string, string>> {
    const token = await this.getToken();
    if (!token) {
      return {};
    }

    switch (token.config.method) {
      // Bearer 인증: HTTP 표준 인증 방식 (RFC 6750)
      // Authorization: Bearer <token>
      case "bearer":
        return { Authorization: `Bearer ${token.config.token}` };

      // API Key 인증: 별도 헤더로 API 키 전달
      // X-API-Key: <token>
      case "api-key":
        return { "X-API-Key": token.config.token };

      // 커스텀 헤더: 사용자 지정 헤더명 사용 (없으면 "Authorization" 폴백)
      case "custom-header":
        return { [token.config.headerName ?? "Authorization"]: token.config.token };
    }
  }
}
