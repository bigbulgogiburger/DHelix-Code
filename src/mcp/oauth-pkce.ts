/**
 * MCP OAuth 2.1 + PKCE (Proof Key for Code Exchange) 강화 모듈
 *
 * PKCE(피키)는 OAuth 2.1에서 공개 클라이언트(브라우저 앱, 네이티브 앱)의
 * 인증 코드 가로채기 공격을 방지하기 위한 보안 확장입니다.
 *
 * PKCE 동작 원리:
 * 1. 클라이언트가 랜덤 문자열(code_verifier)을 생성
 * 2. SHA-256 해시 후 base64url 인코딩하여 code_challenge 생성
 * 3. 인증 요청 시 code_challenge를 포함
 * 4. 토큰 교환 시 code_verifier를 함께 전송 → 서버가 검증
 *
 * 공격자가 인증 코드를 가로채도 code_verifier 없이는 토큰을 얻을 수 없습니다.
 *
 * 토큰 저장 위치: ~/.dhelix/oauth-tokens.json (단일 파일로 통합 관리)
 */
import { createHash, randomBytes } from "node:crypto";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { BaseError } from "../utils/error.js";

// ──────────────────────────────────────────────────────────────────────────────
// 에러 클래스
// ──────────────────────────────────────────────────────────────────────────────

/**
 * OAuth PKCE 관련 에러 클래스
 */
export class OAuthPKCEError extends BaseError {
  constructor(message: string, context: Record<string, unknown> = {}) {
    super(message, "OAUTH_PKCE_ERROR", context);
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// 인터페이스 & 타입
// ──────────────────────────────────────────────────────────────────────────────

/**
 * PKCE 코드 챌린지 — 인증 요청과 토큰 교환을 연결하는 보안 쌍
 *
 * RFC 7636 표준을 따릅니다.
 */
export interface PKCEChallenge {
  /** 43-128자의 랜덤 문자열 — 토큰 교환 시 서버에 전송하여 검증 */
  readonly codeVerifier: string;
  /** codeVerifier의 SHA-256 해시를 base64url 인코딩한 값 — 인증 요청 시 전송 */
  readonly codeChallenge: string;
  /** 챌린지 방식 — 항상 'S256' (SHA-256) */
  readonly method: "S256";
}

/**
 * OAuth 2.1 + PKCE 흐름에 필요한 설정
 */
export interface OAuthPKCEConfig {
  /** 인증 서버에 등록된 클라이언트 식별자 */
  readonly clientId: string;
  /** 인증 URL — 사용자를 인증 페이지로 보낼 때 사용 */
  readonly authorizationEndpoint: string;
  /** 토큰 URL — 인증 코드를 토큰으로 교환할 때 사용 */
  readonly tokenEndpoint: string;
  /** 인증 후 리다이렉트될 콜백 URL */
  readonly redirectUri: string;
  /** 요청할 권한 범위 (예: ["openid", "profile"]) */
  readonly scopes: readonly string[];
}

/**
 * OAuth 2.1 액세스 토큰
 */
export interface OAuthToken {
  /** API 요청 시 Authorization 헤더에 포함하는 액세스 토큰 */
  readonly accessToken: string;
  /** 액세스 토큰 만료 시 갱신에 사용하는 리프레시 토큰 (선택) */
  readonly refreshToken?: string;
  /** 토큰 만료 시각 (Unix 타임스탬프, ms) */
  readonly expiresAt: number;
  /** 토큰 타입 — 보통 "Bearer" */
  readonly tokenType: string;
  /** 허용된 권한 범위 */
  readonly scope?: string;
}

// ──────────────────────────────────────────────────────────────────────────────
// 상수
// ──────────────────────────────────────────────────────────────────────────────

/** PKCE code_verifier 최소 길이 (RFC 7636) */
const PKCE_MIN_LENGTH = 43;
/** PKCE code_verifier 최대 길이 (RFC 7636) */
const PKCE_MAX_LENGTH = 128;
/** 토큰 만료 버퍼 — 실제 만료 60초 전에 갱신 시도 */
const EXPIRY_BUFFER_MS = 60_000;
/** 토큰 저장 파일 경로 */
const TOKEN_FILE_PATH = join(homedir(), ".dhelix", "oauth-tokens.json");

// ──────────────────────────────────────────────────────────────────────────────
// PKCE 유틸리티 함수
// ──────────────────────────────────────────────────────────────────────────────

/**
 * RFC 7636 규격의 PKCE 챌린지 쌍을 생성합니다.
 *
 * 생성 과정:
 * 1. 랜덤 바이트 생성 → base64url 인코딩 → code_verifier (96 chars)
 * 2. code_verifier의 SHA-256 해시 → base64url 인코딩 → code_challenge
 *
 * base64url은 base64에서 '+' → '-', '/' → '_', '=' 패딩 제거한 URL-safe 형식입니다.
 *
 * @returns PKCE 챌린지 쌍 (codeVerifier, codeChallenge, method)
 */
export function generatePKCEChallenge(): PKCEChallenge {
  // 72바이트 → base64url → 96자 (43~128 범위 충족)
  const rawVerifier = randomBytes(72);
  const codeVerifier = toBase64Url(rawVerifier);

  // codeVerifier를 SHA-256 해시 후 base64url 인코딩
  const hash = createHash("sha256").update(codeVerifier).digest();
  const codeChallenge = toBase64Url(hash);

  return {
    codeVerifier,
    codeChallenge,
    method: "S256",
  };
}

/**
 * Buffer를 base64url 문자열로 변환합니다.
 *
 * base64url은 RFC 4648 §5 표준으로,
 * '+' → '-', '/' → '_', 패딩('=') 제거합니다.
 *
 * @param buffer - 변환할 바이너리 데이터
 * @returns base64url 인코딩된 문자열
 */
function toBase64Url(buffer: Buffer): string {
  return buffer.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

// ──────────────────────────────────────────────────────────────────────────────
// 인증 URL 빌더
// ──────────────────────────────────────────────────────────────────────────────

/**
 * PKCE 파라미터가 포함된 OAuth 2.1 인증 URL을 빌드합니다.
 *
 * 생성되는 URL의 주요 파라미터:
 * - response_type=code: 인증 코드 방식
 * - code_challenge: PKCE 챌린지 값
 * - code_challenge_method=S256: SHA-256 방식
 * - state: CSRF 방지용 랜덤 값
 *
 * @param config - OAuth PKCE 설정
 * @param challenge - 사전에 생성된 PKCE 챌린지
 * @param state - CSRF 방지용 랜덤 상태 문자열
 * @returns 완성된 인증 URL (사용자가 브라우저에서 열어야 함)
 */
export function buildAuthorizationUrl(
  config: OAuthPKCEConfig,
  challenge: PKCEChallenge,
  state: string,
): string {
  const params = new URLSearchParams({
    response_type: "code",
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    code_challenge: challenge.codeChallenge,
    code_challenge_method: challenge.method,
    state,
  });

  if (config.scopes.length > 0) {
    params.set("scope", config.scopes.join(" "));
  }

  return `${config.authorizationEndpoint}?${params.toString()}`;
}

// ──────────────────────────────────────────────────────────────────────────────
// 토큰 교환 함수
// ──────────────────────────────────────────────────────────────────────────────

/**
 * 인증 코드를 액세스 토큰으로 교환합니다 (PKCE 포함).
 *
 * OAuth 2.1 "authorization_code" 그랜트 타입을 사용하며,
 * PKCE 검증을 위해 code_verifier를 함께 전송합니다.
 *
 * @param config - OAuth PKCE 설정
 * @param code - 인증 서버에서 받은 인증 코드
 * @param challenge - 인증 요청 시 사용한 PKCE 챌린지 (verifier 포함)
 * @returns 발급된 OAuthToken
 * @throws OAuthPKCEError 토큰 교환 실패 시
 */
export async function exchangeCodeForToken(
  config: OAuthPKCEConfig,
  code: string,
  challenge: PKCEChallenge,
): Promise<OAuthToken> {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: config.redirectUri,
    client_id: config.clientId,
    code_verifier: challenge.codeVerifier,
  });

  const response = await fetch(config.tokenEndpoint, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new OAuthPKCEError("Token exchange failed", {
      status: response.status,
      body: text,
    });
  }

  const data = (await response.json()) as Record<string, unknown>;
  return parseTokenResponse(data);
}

/**
 * 리프레시 토큰으로 새 액세스 토큰을 발급받습니다.
 *
 * OAuth 2.1 "refresh_token" 그랜트 타입을 사용합니다.
 * PKCE는 토큰 갱신 시 불필요하여 포함하지 않습니다.
 *
 * @param config - OAuth PKCE 설정
 * @param refreshTokenValue - 기존 리프레시 토큰 문자열
 * @returns 갱신된 OAuthToken
 * @throws OAuthPKCEError 갱신 실패 시
 */
export async function refreshToken(
  config: OAuthPKCEConfig,
  refreshTokenValue: string,
): Promise<OAuthToken> {
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refreshTokenValue,
    client_id: config.clientId,
  });

  const response = await fetch(config.tokenEndpoint, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new OAuthPKCEError("Token refresh failed", {
      status: response.status,
      body: text,
    });
  }

  const data = (await response.json()) as Record<string, unknown>;
  // 서버가 새 리프레시 토큰을 발급하지 않으면 기존 토큰 유지
  return parseTokenResponse(data, refreshTokenValue);
}

// ──────────────────────────────────────────────────────────────────────────────
// 토큰 파싱 유틸리티
// ──────────────────────────────────────────────────────────────────────────────

/**
 * 토큰 엔드포인트 응답을 OAuthToken 객체로 파싱합니다.
 *
 * @param data - 토큰 엔드포인트의 JSON 응답
 * @param existingRefreshToken - 갱신 시 유지할 기존 리프레시 토큰
 * @returns 파싱된 OAuthToken
 * @throws OAuthPKCEError access_token 필드가 없을 때
 */
function parseTokenResponse(
  data: Record<string, unknown>,
  existingRefreshToken?: string,
): OAuthToken {
  const accessToken = data.access_token as string | undefined;
  if (!accessToken) {
    throw new OAuthPKCEError("Token response missing access_token", { data });
  }

  const expiresIn = data.expires_in as number | undefined;

  return {
    accessToken,
    refreshToken: (data.refresh_token as string | undefined) ?? existingRefreshToken,
    expiresAt: expiresIn ? Date.now() + expiresIn * 1000 : Date.now() + 3600_000,
    tokenType: (data.token_type as string | undefined) ?? "Bearer",
    scope: data.scope as string | undefined,
  };
}

// ──────────────────────────────────────────────────────────────────────────────
// TokenStore 클래스
// ──────────────────────────────────────────────────────────────────────────────

/**
 * 디스크 기반 OAuth 토큰 저장소
 *
 * 모든 클라이언트 ID에 대한 토큰을 단일 JSON 파일에 저장합니다.
 * 저장 경로: ~/.dhelix/oauth-tokens.json
 *
 * 메모리 캐시를 통해 반복적인 파일 I/O를 최소화합니다.
 *
 * @example
 * const store = new TokenStore();
 * await store.save("my-client", token);
 * const token = await store.load("my-client");
 * await store.clear("my-client");
 */
export class TokenStore {
  /** 메모리 캐시 (clientId → OAuthToken) */
  private readonly cache = new Map<string, OAuthToken>();

  /**
   * 토큰을 메모리 캐시와 디스크에 저장합니다.
   *
   * @param clientId - 클라이언트 식별자 (저장 키)
   * @param token - 저장할 OAuthToken
   */
  async save(clientId: string, token: OAuthToken): Promise<void> {
    this.cache.set(clientId, token);
    await this.persistToDisk();
  }

  /**
   * 저장된 토큰을 로드합니다.
   *
   * 메모리 캐시 → 디스크 파일 순으로 조회합니다.
   * 파일이 없거나 유효하지 않으면 null을 반환합니다.
   *
   * @param clientId - 클라이언트 식별자
   * @returns 저장된 OAuthToken 또는 null
   */
  async load(clientId: string): Promise<OAuthToken | null> {
    // 1. 메모리 캐시 확인
    const cached = this.cache.get(clientId);
    if (cached) {
      return cached;
    }

    // 2. 디스크에서 로드
    await this.loadFromDisk();
    return this.cache.get(clientId) ?? null;
  }

  /**
   * 특정 클라이언트의 토큰을 메모리와 디스크에서 제거합니다.
   *
   * @param clientId - 제거할 클라이언트 식별자
   */
  async clear(clientId: string): Promise<void> {
    this.cache.delete(clientId);
    await this.persistToDisk();
  }

  /**
   * 토큰이 만료되었는지 확인합니다.
   *
   * 실제 만료 60초 전에 만료로 간주하여 선제적 갱신을 유도합니다.
   *
   * @param token - 확인할 토큰
   * @returns true면 만료됨 (또는 곧 만료됨)
   */
  isExpired(token: OAuthToken): boolean {
    return Date.now() >= token.expiresAt - EXPIRY_BUFFER_MS;
  }

  /**
   * 현재 캐시의 모든 토큰을 디스크에 저장합니다.
   */
  private async persistToDisk(): Promise<void> {
    const dir = join(homedir(), ".dhelix");
    await mkdir(dir, { recursive: true });

    const allTokens: Record<string, OAuthToken> = {};
    for (const [id, token] of this.cache) {
      allTokens[id] = token;
    }

    await writeFile(TOKEN_FILE_PATH, JSON.stringify(allTokens, null, 2), "utf-8");
  }

  /**
   * 디스크에서 모든 토큰을 메모리 캐시로 로드합니다.
   *
   * 파일이 없거나 유효하지 않은 JSON이면 조용히 무시합니다.
   */
  private async loadFromDisk(): Promise<void> {
    try {
      const raw = await readFile(TOKEN_FILE_PATH, "utf-8");
      const parsed = JSON.parse(raw) as Record<string, unknown>;

      for (const [id, rawToken] of Object.entries(parsed)) {
        if (!rawToken || typeof rawToken !== "object") continue;
        const t = rawToken as Record<string, unknown>;
        if (typeof t.accessToken !== "string" || typeof t.tokenType !== "string") continue;
        if (typeof t.expiresAt !== "number") continue;

        this.cache.set(id, {
          accessToken: t.accessToken,
          refreshToken: typeof t.refreshToken === "string" ? t.refreshToken : undefined,
          expiresAt: t.expiresAt,
          tokenType: t.tokenType,
          scope: typeof t.scope === "string" ? t.scope : undefined,
        });
      }
    } catch {
      // 파일 없음 또는 파싱 에러 — 캐시 빈 상태 유지
    }
  }
}

// Re-export constants for test accessibility
export { PKCE_MIN_LENGTH, PKCE_MAX_LENGTH };
