import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  generatePKCEChallenge,
  buildAuthorizationUrl,
  exchangeCodeForToken,
  refreshToken,
  TokenStore,
  OAuthPKCEError,
  PKCE_MIN_LENGTH,
  PKCE_MAX_LENGTH,
  type OAuthPKCEConfig,
  type OAuthToken,
} from "../../../src/mcp/oauth-pkce.js";

// ──────────────────────────────────────────────────────────────────────────────
// Mock: node:fs/promises
// ──────────────────────────────────────────────────────────────────────────────

vi.mock("node:fs/promises", () => ({
  readFile: vi.fn(),
  writeFile: vi.fn(),
  mkdir: vi.fn(),
}));

import { readFile, writeFile, mkdir } from "node:fs/promises";

const mockReadFile = vi.mocked(readFile);
const mockWriteFile = vi.mocked(writeFile);
const mockMkdir = vi.mocked(mkdir);

// ──────────────────────────────────────────────────────────────────────────────
// Test fixtures
// ──────────────────────────────────────────────────────────────────────────────

const TEST_CONFIG: OAuthPKCEConfig = {
  clientId: "test-client-id",
  authorizationEndpoint: "https://auth.example.com/authorize",
  tokenEndpoint: "https://auth.example.com/token",
  redirectUri: "http://localhost:9000/callback",
  scopes: ["openid", "profile", "email"],
};

const MOCK_TOKEN_RESPONSE = {
  access_token: "test-access-token",
  refresh_token: "test-refresh-token",
  expires_in: 3600,
  token_type: "Bearer",
  scope: "openid profile email",
};

const TEST_TOKEN: OAuthToken = {
  accessToken: "test-access-token",
  refreshToken: "test-refresh-token",
  expiresAt: Date.now() + 3_600_000,
  tokenType: "Bearer",
  scope: "openid profile email",
};

// ──────────────────────────────────────────────────────────────────────────────
// generatePKCEChallenge
// ──────────────────────────────────────────────────────────────────────────────

describe("generatePKCEChallenge", () => {
  it("should return codeVerifier within RFC 7636 length range", () => {
    const challenge = generatePKCEChallenge();
    expect(challenge.codeVerifier.length).toBeGreaterThanOrEqual(PKCE_MIN_LENGTH);
    expect(challenge.codeVerifier.length).toBeLessThanOrEqual(PKCE_MAX_LENGTH);
  });

  it("should return method S256", () => {
    const challenge = generatePKCEChallenge();
    expect(challenge.method).toBe("S256");
  });

  it("should return codeChallenge as base64url string (no +, /, =)", () => {
    const challenge = generatePKCEChallenge();
    expect(challenge.codeChallenge).not.toMatch(/[+/=]/);
  });

  it("should return codeVerifier as base64url string (no +, /, =)", () => {
    const challenge = generatePKCEChallenge();
    expect(challenge.codeVerifier).not.toMatch(/[+/=]/);
  });

  it("should generate unique challenges on each call", () => {
    const c1 = generatePKCEChallenge();
    const c2 = generatePKCEChallenge();
    expect(c1.codeVerifier).not.toBe(c2.codeVerifier);
    expect(c1.codeChallenge).not.toBe(c2.codeChallenge);
  });

  it("codeChallenge should be different from codeVerifier", () => {
    const challenge = generatePKCEChallenge();
    expect(challenge.codeChallenge).not.toBe(challenge.codeVerifier);
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// buildAuthorizationUrl
// ──────────────────────────────────────────────────────────────────────────────

describe("buildAuthorizationUrl", () => {
  const challenge = {
    codeVerifier: "test-verifier-string-that-is-long-enough-to-pass",
    codeChallenge: "test-challenge-hash",
    method: "S256" as const,
  };
  const state = "random-state-string";

  it("should include required OAuth parameters", () => {
    const url = buildAuthorizationUrl(TEST_CONFIG, challenge, state);
    const parsed = new URL(url);

    expect(parsed.searchParams.get("response_type")).toBe("code");
    expect(parsed.searchParams.get("client_id")).toBe(TEST_CONFIG.clientId);
    expect(parsed.searchParams.get("redirect_uri")).toBe(TEST_CONFIG.redirectUri);
    expect(parsed.searchParams.get("state")).toBe(state);
  });

  it("should include PKCE parameters", () => {
    const url = buildAuthorizationUrl(TEST_CONFIG, challenge, state);
    const parsed = new URL(url);

    expect(parsed.searchParams.get("code_challenge")).toBe(challenge.codeChallenge);
    expect(parsed.searchParams.get("code_challenge_method")).toBe("S256");
  });

  it("should include scopes joined with space", () => {
    const url = buildAuthorizationUrl(TEST_CONFIG, challenge, state);
    const parsed = new URL(url);

    expect(parsed.searchParams.get("scope")).toBe("openid profile email");
  });

  it("should use the authorization endpoint as base URL", () => {
    const url = buildAuthorizationUrl(TEST_CONFIG, challenge, state);
    expect(url.startsWith(TEST_CONFIG.authorizationEndpoint)).toBe(true);
  });

  it("should omit scope when scopes array is empty", () => {
    const configNoScope: OAuthPKCEConfig = { ...TEST_CONFIG, scopes: [] };
    const url = buildAuthorizationUrl(configNoScope, challenge, state);
    const parsed = new URL(url);

    expect(parsed.searchParams.has("scope")).toBe(false);
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// exchangeCodeForToken
// ──────────────────────────────────────────────────────────────────────────────

describe("exchangeCodeForToken", () => {
  const challenge = {
    codeVerifier: "test-verifier-string-that-is-long-enough-to-pass",
    codeChallenge: "test-challenge-hash",
    method: "S256" as const,
  };

  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("should return OAuthToken on successful exchange", async () => {
    const mockFetch = vi.mocked(fetch);
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => MOCK_TOKEN_RESPONSE,
    } as Response);

    const token = await exchangeCodeForToken(TEST_CONFIG, "auth-code", challenge);

    expect(token.accessToken).toBe(MOCK_TOKEN_RESPONSE.access_token);
    expect(token.refreshToken).toBe(MOCK_TOKEN_RESPONSE.refresh_token);
    expect(token.tokenType).toBe("Bearer");
    expect(token.scope).toBe(MOCK_TOKEN_RESPONSE.scope);
    expect(token.expiresAt).toBeGreaterThan(Date.now());
  });

  it("should include code_verifier in request body", async () => {
    const mockFetch = vi.mocked(fetch);
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => MOCK_TOKEN_RESPONSE,
    } as Response);

    await exchangeCodeForToken(TEST_CONFIG, "auth-code", challenge);

    const callArgs = mockFetch.mock.calls[0];
    expect(callArgs[0]).toBe(TEST_CONFIG.tokenEndpoint);

    const body = (callArgs[1] as RequestInit).body as string;
    const params = new URLSearchParams(body);
    expect(params.get("code_verifier")).toBe(challenge.codeVerifier);
    expect(params.get("grant_type")).toBe("authorization_code");
    expect(params.get("code")).toBe("auth-code");
    expect(params.get("client_id")).toBe(TEST_CONFIG.clientId);
  });

  it("should throw OAuthPKCEError on HTTP error", async () => {
    const mockFetch = vi.mocked(fetch);
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 400,
      text: async () => "Bad Request",
    } as Response);

    await expect(exchangeCodeForToken(TEST_CONFIG, "bad-code", challenge)).rejects.toThrow(
      OAuthPKCEError,
    );
  });

  it("should throw OAuthPKCEError when response missing access_token", async () => {
    const mockFetch = vi.mocked(fetch);
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ token_type: "Bearer" }),
    } as Response);

    await expect(exchangeCodeForToken(TEST_CONFIG, "auth-code", challenge)).rejects.toThrow(
      OAuthPKCEError,
    );
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// refreshToken
// ──────────────────────────────────────────────────────────────────────────────

describe("refreshToken", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("should return new OAuthToken on success", async () => {
    const mockFetch = vi.mocked(fetch);
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        access_token: "new-access-token",
        expires_in: 3600,
        token_type: "Bearer",
      }),
    } as Response);

    const token = await refreshToken(TEST_CONFIG, "old-refresh-token");

    expect(token.accessToken).toBe("new-access-token");
    // 새 refresh_token이 없으면 기존 값 유지
    expect(token.refreshToken).toBe("old-refresh-token");
  });

  it("should use new refresh_token from response when provided", async () => {
    const mockFetch = vi.mocked(fetch);
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        access_token: "new-access-token",
        refresh_token: "new-refresh-token",
        expires_in: 3600,
        token_type: "Bearer",
      }),
    } as Response);

    const token = await refreshToken(TEST_CONFIG, "old-refresh-token");
    expect(token.refreshToken).toBe("new-refresh-token");
  });

  it("should send correct grant_type in request body", async () => {
    const mockFetch = vi.mocked(fetch);
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => MOCK_TOKEN_RESPONSE,
    } as Response);

    await refreshToken(TEST_CONFIG, "my-refresh-token");

    const body = (mockFetch.mock.calls[0][1] as RequestInit).body as string;
    const params = new URLSearchParams(body);
    expect(params.get("grant_type")).toBe("refresh_token");
    expect(params.get("refresh_token")).toBe("my-refresh-token");
    expect(params.get("client_id")).toBe(TEST_CONFIG.clientId);
  });

  it("should throw OAuthPKCEError on HTTP error", async () => {
    const mockFetch = vi.mocked(fetch);
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
      text: async () => "Unauthorized",
    } as Response);

    await expect(refreshToken(TEST_CONFIG, "bad-refresh")).rejects.toThrow(OAuthPKCEError);
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// TokenStore
// ──────────────────────────────────────────────────────────────────────────────

describe("TokenStore", () => {
  let store: TokenStore;

  beforeEach(() => {
    store = new TokenStore();
    vi.clearAllMocks();
    mockMkdir.mockResolvedValue(undefined as never);
    mockWriteFile.mockResolvedValue(undefined as never);
    mockReadFile.mockRejectedValue(new Error("ENOENT"));
  });

  describe("save", () => {
    it("should save token and write to disk", async () => {
      await store.save("client-1", TEST_TOKEN);

      expect(mockMkdir).toHaveBeenCalled();
      expect(mockWriteFile).toHaveBeenCalled();

      const writeCall = mockWriteFile.mock.calls[0];
      const written = JSON.parse(writeCall[1] as string) as Record<string, OAuthToken>;
      expect(written["client-1"].accessToken).toBe(TEST_TOKEN.accessToken);
    });
  });

  describe("load", () => {
    it("should return token from memory cache after save", async () => {
      await store.save("client-1", TEST_TOKEN);
      const loaded = await store.load("client-1");

      expect(loaded).not.toBeNull();
      expect(loaded!.accessToken).toBe(TEST_TOKEN.accessToken);
    });

    it("should load token from disk when not in memory", async () => {
      const diskData = { "client-1": TEST_TOKEN };
      mockReadFile.mockResolvedValueOnce(JSON.stringify(diskData) as never);

      const loaded = await store.load("client-1");

      expect(loaded).not.toBeNull();
      expect(loaded!.accessToken).toBe(TEST_TOKEN.accessToken);
    });

    it("should return null when token not found on disk", async () => {
      mockReadFile.mockRejectedValue(new Error("ENOENT"));

      const loaded = await store.load("nonexistent");
      expect(loaded).toBeNull();
    });

    it("should return null when disk file has invalid JSON", async () => {
      mockReadFile.mockResolvedValueOnce("not-valid-json" as never);

      const loaded = await store.load("client-1");
      expect(loaded).toBeNull();
    });
  });

  describe("clear", () => {
    it("should remove token from memory and persist updated disk state", async () => {
      await store.save("client-1", TEST_TOKEN);
      await store.clear("client-1");

      const loaded = await store.load("client-1");
      expect(loaded).toBeNull();

      // writeFile が2回呼ばれること(save + clear)
      expect(mockWriteFile).toHaveBeenCalledTimes(2);
    });
  });

  describe("isExpired", () => {
    it("should return false for token expiring in the future", () => {
      const token: OAuthToken = { ...TEST_TOKEN, expiresAt: Date.now() + 3_600_000 };
      expect(store.isExpired(token)).toBe(false);
    });

    it("should return true for already expired token", () => {
      const token: OAuthToken = { ...TEST_TOKEN, expiresAt: Date.now() - 1000 };
      expect(store.isExpired(token)).toBe(true);
    });

    it("should return true for token expiring within 60s buffer", () => {
      const token: OAuthToken = { ...TEST_TOKEN, expiresAt: Date.now() + 30_000 };
      expect(store.isExpired(token)).toBe(true);
    });
  });
});
