/**
 * MCP OAuth 2.0 관리자 — 외부 MCP 서버 인증을 위한 OAuth 2.0 모듈
 *
 * OAuth 2.0은 사용자가 비밀번호를 직접 제공하지 않고도
 * 제3자 애플리케이션에 제한된 접근 권한을 부여할 수 있는 인증 프로토콜입니다.
 *
 * 이 모듈은 "Authorization Code Flow"를 구현합니다:
 *
 * 1. 클라이언트가 인증 URL을 생성하여 사용자에게 제공
 * 2. 사용자가 브라우저에서 해당 URL을 열고 인증/승인
 * 3. 인증 서버가 로컬 콜백 서버(localhost)로 인증 코드(code)를 전달
 * 4. 클라이언트가 인증 코드를 액세스 토큰으로 교환
 * 5. 토큰을 디스크에 저장하여 다음 실행 시 재사용
 *
 * 토큰 갱신(Refresh):
 * - 액세스 토큰이 만료되면 리프레시 토큰으로 자동 갱신
 * - 리프레시 토큰이 없으면 재인증 필요
 *
 * 토큰 저장 위치: ~/.dhelix/oauth-tokens/{서버이름}.json
 */
import { createServer, type Server } from "node:http";
import { readFile, writeFile, mkdir, unlink } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { BaseError } from "../utils/error.js";

/**
 * OAuth 관련 에러 클래스
 */
export class MCPOAuthError extends BaseError {
  constructor(message: string, context: Record<string, unknown> = {}) {
    super(message, "MCP_OAUTH_ERROR", context);
  }
}

/**
 * MCP 서버에 대한 OAuth 2.0 설정
 *
 * 인증 서버의 엔드포인트와 클라이언트 자격증명을 포함합니다.
 */
export interface MCPOAuthConfig {
  /** 클라이언트 ID — 인증 서버에 등록된 애플리케이션 식별자 */
  readonly clientId: string;
  /** 클라이언트 시크릿 — 서버 측에서만 사용 (공개 클라이언트는 생략 가능) */
  readonly clientSecret?: string;
  /** 인증 URL — 사용자를 인증 페이지로 보낼 때 사용 */
  readonly authorizationUrl: string;
  /** 토큰 URL — 인증 코드를 토큰으로 교환할 때 사용 */
  readonly tokenUrl: string;
  /** 요청할 권한 범위 (예: ["read", "write"]) */
  readonly scopes?: readonly string[];
  /** 로컬 콜백 서버 포트 (기본: 8912) */
  readonly redirectPort?: number;
}

/**
 * 저장된 OAuth 토큰
 *
 * 인증 서버로부터 발급받은 토큰 정보를 담습니다.
 */
export interface OAuthToken {
  /** 액세스 토큰 — API 요청 시 Authorization 헤더에 포함 */
  readonly accessToken: string;
  /** 리프레시 토큰 — 액세스 토큰 만료 시 갱신에 사용 (선택) */
  readonly refreshToken?: string;
  /** 토큰 만료 시각 (Unix 타임스탬프, ms) — undefined면 만료되지 않는 토큰 */
  readonly expiresAt?: number;
  /** 토큰 타입 — 보통 "Bearer" */
  readonly tokenType: string;
  /** 허용된 권한 범위 */
  readonly scope?: string;
}

/** 로컬 OAuth 콜백 서버 기본 포트 */
const DEFAULT_REDIRECT_PORT = 8912;

/** 토큰 만료 판정 버퍼 (60초) — 실제 만료 60초 전에 만료로 간주 */
const EXPIRY_BUFFER_MS = 60_000;

/** OAuth 콜백 대기 타임아웃 (5분) — 사용자가 브라우저에서 인증할 시간 */
const CALLBACK_TIMEOUT_MS = 300_000;

/** 토큰 저장 디렉토리 경로 */
const TOKEN_STORAGE_DIR = join(homedir(), ".dhelix", "oauth-tokens");

/**
 * MCP 서버에 대한 OAuth 2.0 인증 흐름을 관리합니다.
 *
 * 토큰은 메모리에 캐시하고 디스크에 영속 저장합니다.
 * 프로그램 재시작 시 디스크에서 토큰을 로드하여 재인증을 방지합니다.
 */
export class MCPOAuthManager {
  /** 서버별 토큰 캐시 (메모리) */
  private readonly tokens = new Map<string, OAuthToken>();

  /**
   * OAuth 2.0 Authorization Code Flow를 시작합니다.
   *
   * 전체 흐름:
   * 1. 인증 URL 생성 (state 파라미터로 CSRF 방지)
   * 2. 로컬 HTTP 서버 시작 (콜백 수신용)
   * 3. 사용자가 브라우저에서 인증 후 콜백 수신
   * 4. 인증 코드를 토큰으로 교환
   * 5. 토큰을 메모리와 디스크에 저장
   *
   * @param serverName - MCP 서버 이름 (토큰 저장 키)
   * @param config - OAuth 설정 (클라이언트 ID, 인증 URL 등)
   * @returns 발급된 OAuth 토큰
   * @throws MCPOAuthError 인증 실패 시
   */
  async authorize(serverName: string, config: MCPOAuthConfig): Promise<OAuthToken> {
    // state 파라미터: CSRF(교차 사이트 요청 위조) 공격 방지를 위한 랜덤 값
    const state = randomUUID();
    const port = config.redirectPort ?? DEFAULT_REDIRECT_PORT;
    const redirectUri = `http://localhost:${port}/callback`;

    // 인증 URL 생성 (사용자가 이 URL을 브라우저에서 열어야 함)
    const authUrl = this.buildAuthorizationUrl(config, state, redirectUri);

    // 사용자에게 인증 URL 안내
    // eslint-disable-next-line no-console
    console.log(`\nOpen this URL to authorize MCP server "${serverName}":\n${authUrl}\n`);

    let callbackServer: Server | undefined;
    try {
      // 로컬 콜백 서버를 시작하고 인증 코드 수신 대기
      const { code, server } = await this.startCallbackServer(port, state);
      callbackServer = server;

      // 인증 코드를 액세스 토큰으로 교환
      const token = await this.exchangeCode(code, config, redirectUri);
      // 메모리와 디스크에 저장
      this.tokens.set(serverName, token);
      await this.saveToken(serverName, token);
      return token;
    } finally {
      // 콜백 서버 정리
      if (callbackServer) {
        callbackServer.close();
      }
    }
  }

  /**
   * 서버에 대한 유효한 액세스 토큰을 반환합니다.
   *
   * 토큰 조회 순서:
   * 1. 메모리 캐시 확인
   * 2. 디스크에서 로드
   * 3. 만료 여부 확인 → 만료되면 리프레시 토큰으로 갱신
   * 4. 리프레시 토큰도 없으면 null 반환 (재인증 필요)
   *
   * @param serverName - MCP 서버 이름
   * @param config - OAuth 설정
   * @returns 유효한 액세스 토큰 문자열 또는 null
   */
  async getAccessToken(serverName: string, config: MCPOAuthConfig): Promise<string | null> {
    // 1. 메모리 캐시에서 확인
    let token = this.tokens.get(serverName) ?? null;

    // 2. 메모리에 없으면 디스크에서 로드
    if (!token) {
      token = await this.loadToken(serverName);
      if (token) {
        this.tokens.set(serverName, token);
      }
    }

    if (!token) {
      return null;
    }

    // 3. 만료 여부 확인
    if (this.isTokenExpired(token)) {
      // 리프레시 토큰이 없으면 재인증 필요
      if (!token.refreshToken) {
        this.tokens.delete(serverName);
        return null;
      }

      // 리프레시 토큰으로 갱신 시도
      try {
        const refreshed = await this.refreshToken(serverName, config, token.refreshToken);
        return refreshed.accessToken;
      } catch {
        this.tokens.delete(serverName);
        return null;
      }
    }

    return token.accessToken;
  }

  /**
   * 토큰이 만료되었는지 확인합니다.
   *
   * 만료 판정에 60초 버퍼를 적용하여,
   * 실제 만료 직전에 갱신할 수 있도록 합니다.
   * expiresAt이 없는 토큰은 만료되지 않는 것으로 간주합니다.
   *
   * @param token - 확인할 토큰
   * @returns true면 만료됨 (또는 곧 만료됨)
   */
  isTokenExpired(token: OAuthToken): boolean {
    if (token.expiresAt === undefined) {
      return false;
    }
    return Date.now() >= token.expiresAt - EXPIRY_BUFFER_MS;
  }

  /**
   * 리프레시 토큰을 사용하여 만료된 액세스 토큰을 갱신합니다.
   *
   * OAuth 2.0 "refresh_token" 그랜트 타입을 사용합니다.
   * 갱신된 토큰은 메모리와 디스크에 자동 저장됩니다.
   *
   * @param serverName - MCP 서버 이름
   * @param config - OAuth 설정
   * @param refreshTokenValue - 리프레시 토큰 문자열
   * @returns 갱신된 토큰
   * @throws MCPOAuthError 갱신 실패 시
   */
  async refreshToken(
    serverName: string,
    config: MCPOAuthConfig,
    refreshTokenValue: string,
  ): Promise<OAuthToken> {
    // URL-encoded 폼 데이터 형식으로 요청 본문 구성
    const body = new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshTokenValue,
      client_id: config.clientId,
    });

    if (config.clientSecret) {
      body.set("client_secret", config.clientSecret);
    }

    const response = await fetch(config.tokenUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new MCPOAuthError("Token refresh failed", {
        serverName,
        status: response.status,
        body: text,
      });
    }

    const data = (await response.json()) as Record<string, unknown>;
    // 기존 리프레시 토큰을 유지 (서버가 새 리프레시 토큰을 발급하지 않을 수 있음)
    const token = this.parseTokenResponse(data, refreshTokenValue);
    this.tokens.set(serverName, token);
    await this.saveToken(serverName, token);
    return token;
  }

  /**
   * 인증 코드를 액세스 토큰으로 교환합니다.
   *
   * OAuth 2.0 "authorization_code" 그랜트 타입을 사용합니다.
   *
   * @param code - 인증 서버에서 받은 인증 코드
   * @param config - OAuth 설정
   * @param redirectUri - 콜백 URI (인증 코드 요청 시 사용한 것과 동일해야 함)
   * @returns 발급된 토큰
   * @throws MCPOAuthError 토큰 교환 실패 시
   */
  async exchangeCode(
    code: string,
    config: MCPOAuthConfig,
    redirectUri: string,
  ): Promise<OAuthToken> {
    const body = new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
      client_id: config.clientId,
    });

    if (config.clientSecret) {
      body.set("client_secret", config.clientSecret);
    }

    const response = await fetch(config.tokenUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new MCPOAuthError("Token exchange failed", {
        status: response.status,
        body: text,
      });
    }

    const data = (await response.json()) as Record<string, unknown>;
    return this.parseTokenResponse(data);
  }

  /**
   * 토큰을 디스크에 JSON 파일로 저장합니다.
   *
   * 저장 경로: ~/.dhelix/oauth-tokens/{서버이름}.json
   * 디렉토리가 없으면 자동 생성합니다.
   *
   * @param serverName - MCP 서버 이름 (파일명으로 사용)
   * @param token - 저장할 토큰
   */
  async saveToken(serverName: string, token: OAuthToken): Promise<void> {
    await mkdir(TOKEN_STORAGE_DIR, { recursive: true });
    const filePath = join(TOKEN_STORAGE_DIR, `${serverName}.json`);
    await writeFile(filePath, JSON.stringify(token, null, 2), "utf-8");
  }

  /**
   * 디스크에서 토큰을 로드합니다.
   *
   * 파일이 없거나 유효하지 않은 형식이면 null을 반환합니다.
   *
   * @param serverName - MCP 서버 이름
   * @returns 로드된 토큰 또는 null
   */
  async loadToken(serverName: string): Promise<OAuthToken | null> {
    const filePath = join(TOKEN_STORAGE_DIR, `${serverName}.json`);
    try {
      const raw = await readFile(filePath, "utf-8");
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      // 최소 필수 필드 검증
      if (typeof parsed.accessToken !== "string" || typeof parsed.tokenType !== "string") {
        return null;
      }
      return {
        accessToken: parsed.accessToken as string,
        refreshToken: parsed.refreshToken as string | undefined,
        expiresAt: parsed.expiresAt as number | undefined,
        tokenType: parsed.tokenType as string,
        scope: parsed.scope as string | undefined,
      };
    } catch {
      return null;
    }
  }

  /**
   * 저장된 토큰을 메모리와 디스크에서 제거합니다.
   *
   * 토큰 철회(revoke) 시 호출됩니다.
   *
   * @param serverName - MCP 서버 이름
   */
  async revokeToken(serverName: string): Promise<void> {
    this.tokens.delete(serverName);
    const filePath = join(TOKEN_STORAGE_DIR, `${serverName}.json`);
    try {
      await unlink(filePath);
    } catch {
      // 파일이 없을 수 있음 — 에러가 아님
    }
  }

  /**
   * 전체 인증 URL을 쿼리 파라미터와 함께 생성합니다.
   *
   * 생성되는 URL 예시:
   * https://auth.example.com/authorize?response_type=code&client_id=xxx&redirect_uri=...&state=...&scope=read+write
   *
   * @param config - OAuth 설정
   * @param state - CSRF 방지용 랜덤 문자열
   * @param redirectUri - 인증 후 리다이렉트될 콜백 URL
   * @returns 완성된 인증 URL
   */
  buildAuthorizationUrl(config: MCPOAuthConfig, state: string, redirectUri: string): string {
    const params = new URLSearchParams({
      response_type: "code",
      client_id: config.clientId,
      redirect_uri: redirectUri,
      state,
    });

    if (config.scopes && config.scopes.length > 0) {
      params.set("scope", config.scopes.join(" "));
    }

    return `${config.authorizationUrl}?${params.toString()}`;
  }

  /**
   * OAuth 콜백을 수신하기 위한 로컬 HTTP 서버를 시작합니다.
   *
   * 사용자가 브라우저에서 인증을 완료하면,
   * 인증 서버가 이 로컬 서버의 /callback 경로로 인증 코드를 전달합니다.
   *
   * 보안 검증:
   * - state 파라미터가 예상값과 일치하는지 확인 (CSRF 방지)
   * - error 파라미터가 있으면 인증 거부 처리
   *
   * @param port - 리스닝할 포트 번호
   * @param expectedState - 인증 요청 시 생성한 state 값 (검증용)
   * @returns 인증 코드와 서버 인스턴스
   * @throws MCPOAuthError 인증 실패, state 불일치, 타임아웃 시
   */
  private startCallbackServer(
    port: number,
    expectedState: string,
  ): Promise<{ code: string; server: Server }> {
    return new Promise<{ code: string; server: Server }>((resolve, reject) => {
      const server = createServer((req, res) => {
        // 요청 URL 파싱
        const url = new URL(req.url ?? "/", `http://localhost:${port}`);

        // /callback 외의 경로는 404 반환
        if (url.pathname !== "/callback") {
          res.writeHead(404, { "Content-Type": "text/plain" });
          res.end("Not Found");
          return;
        }

        // 쿼리 파라미터에서 code, state, error 추출
        const code = url.searchParams.get("code");
        const state = url.searchParams.get("state");
        const error = url.searchParams.get("error");

        // 에러 파라미터가 있으면 인증 거부
        if (error) {
          const errorDesc = url.searchParams.get("error_description") ?? error;
          res.writeHead(400, { "Content-Type": "text/html" });
          res.end(`<html><body><h1>Authorization Failed</h1><p>${errorDesc}</p></body></html>`);
          server.close();
          reject(
            new MCPOAuthError("Authorization denied by user", {
              error,
              errorDescription: errorDesc,
            }),
          );
          return;
        }

        // 인증 코드가 없거나 state가 일치하지 않으면 에러
        if (!code || state !== expectedState) {
          res.writeHead(400, { "Content-Type": "text/html" });
          res.end(
            "<html><body><h1>Invalid Callback</h1><p>Missing code or state mismatch.</p></body></html>",
          );
          server.close();
          reject(
            new MCPOAuthError("Invalid OAuth callback: missing code or state mismatch", {
              hasCode: !!code,
              stateMatch: state === expectedState,
            }),
          );
          return;
        }

        // 인증 성공 — 사용자에게 성공 페이지 표시
        res.writeHead(200, { "Content-Type": "text/html" });
        res.end(
          "<html><body><h1>Authorization Successful</h1><p>You can close this window.</p></body></html>",
        );
        resolve({ code, server });
      });

      // 5분 타임아웃 — 사용자가 시간 내에 인증하지 않으면 취소
      const timeout = setTimeout(() => {
        server.close();
        reject(new MCPOAuthError("OAuth callback timed out", { timeoutMs: CALLBACK_TIMEOUT_MS }));
      }, CALLBACK_TIMEOUT_MS);

      // 서버 시작 에러 처리
      server.on("error", (err) => {
        clearTimeout(timeout);
        reject(
          new MCPOAuthError("Failed to start OAuth callback server", {
            port,
            cause: err.message,
          }),
        );
      });

      // 서버 리스닝 시작
      server.listen(port, () => {
        // 서버가 리스닝 중 — 타임아웃은 위에서 관리
      });

      // 서버 종료 시 타임아웃 정리
      server.on("close", () => {
        clearTimeout(timeout);
      });
    });
  }

  /**
   * 토큰 엔드포인트 응답을 OAuthToken 객체로 파싱합니다.
   *
   * OAuth 토큰 응답 필드 매핑:
   * - access_token → accessToken
   * - refresh_token → refreshToken (없으면 기존 리프레시 토큰 유지)
   * - expires_in → expiresAt (초 단위를 ms 타임스탬프로 변환)
   * - token_type → tokenType (기본: "Bearer")
   * - scope → scope
   *
   * @param data - 토큰 엔드포인트 JSON 응답
   * @param existingRefreshToken - 기존 리프레시 토큰 (갱신 시 유지용)
   * @returns 파싱된 OAuthToken 객체
   * @throws MCPOAuthError access_token이 없을 때
   */
  private parseTokenResponse(
    data: Record<string, unknown>,
    existingRefreshToken?: string,
  ): OAuthToken {
    const accessToken = data.access_token as string | undefined;
    if (!accessToken) {
      throw new MCPOAuthError("Token response missing access_token", { data });
    }

    const expiresIn = data.expires_in as number | undefined;

    return {
      accessToken,
      // 새 리프레시 토큰이 없으면 기존 토큰 유지
      refreshToken: (data.refresh_token as string | undefined) ?? existingRefreshToken,
      // expires_in(초)을 현재 시각 기준 만료 타임스탬프(ms)로 변환
      expiresAt: expiresIn ? Date.now() + expiresIn * 1000 : undefined,
      tokenType: (data.token_type as string) ?? "Bearer",
      scope: data.scope as string | undefined,
    };
  }
}
