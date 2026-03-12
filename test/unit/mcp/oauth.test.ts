import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  MCPOAuthManager,
  MCPOAuthError,
  type MCPOAuthConfig,
  type OAuthToken,
} from "../../../src/mcp/oauth.js";

// Mock fs/promises
vi.mock("node:fs/promises", () => ({
  readFile: vi.fn(),
  writeFile: vi.fn(),
  mkdir: vi.fn(),
  unlink: vi.fn(),
}));

import { readFile, writeFile, mkdir, unlink } from "node:fs/promises";

const mockReadFile = vi.mocked(readFile);
const mockWriteFile = vi.mocked(writeFile);
const mockMkdir = vi.mocked(mkdir);
const mockUnlink = vi.mocked(unlink);

const TEST_CONFIG: MCPOAuthConfig = {
  clientId: "test-client-id",
  clientSecret: "test-client-secret",
  authorizationUrl: "https://auth.example.com/authorize",
  tokenUrl: "https://auth.example.com/token",
  scopes: ["read", "write"],
  redirectPort: 9999,
};

const TEST_TOKEN: OAuthToken = {
  accessToken: "test-access-token",
  refreshToken: "test-refresh-token",
  expiresAt: Date.now() + 3600_000,
  tokenType: "Bearer",
  scope: "read write",
};

describe("MCPOAuthManager", () => {
  let manager: MCPOAuthManager;

  beforeEach(() => {
    manager = new MCPOAuthManager();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("buildAuthorizationUrl", () => {
    it("should build a correct authorization URL with all parameters", () => {
      const url = manager.buildAuthorizationUrl(
        TEST_CONFIG,
        "test-state",
        "http://localhost:9999/callback",
      );
      const parsed = new URL(url);

      expect(parsed.origin).toBe("https://auth.example.com");
      expect(parsed.pathname).toBe("/authorize");
      expect(parsed.searchParams.get("response_type")).toBe("code");
      expect(parsed.searchParams.get("client_id")).toBe("test-client-id");
      expect(parsed.searchParams.get("redirect_uri")).toBe("http://localhost:9999/callback");
      expect(parsed.searchParams.get("state")).toBe("test-state");
      expect(parsed.searchParams.get("scope")).toBe("read write");
    });

    it("should omit scope when scopes array is empty", () => {
      const config: MCPOAuthConfig = {
        ...TEST_CONFIG,
        scopes: [],
      };
      const url = manager.buildAuthorizationUrl(config, "s", "http://localhost:9999/callback");
      const parsed = new URL(url);

      expect(parsed.searchParams.has("scope")).toBe(false);
    });

    it("should omit scope when scopes is undefined", () => {
      const config: MCPOAuthConfig = {
        clientId: "cid",
        authorizationUrl: "https://auth.example.com/authorize",
        tokenUrl: "https://auth.example.com/token",
      };
      const url = manager.buildAuthorizationUrl(config, "s", "http://localhost:8912/callback");
      const parsed = new URL(url);

      expect(parsed.searchParams.has("scope")).toBe(false);
    });
  });

  describe("isTokenExpired", () => {
    it("should return false for a token with no expiresAt", () => {
      const token: OAuthToken = {
        accessToken: "abc",
        tokenType: "Bearer",
      };
      expect(manager.isTokenExpired(token)).toBe(false);
    });

    it("should return false for a token that is still valid", () => {
      const token: OAuthToken = {
        accessToken: "abc",
        tokenType: "Bearer",
        expiresAt: Date.now() + 300_000, // 5 minutes from now
      };
      expect(manager.isTokenExpired(token)).toBe(false);
    });

    it("should return true for a token that is expired", () => {
      const token: OAuthToken = {
        accessToken: "abc",
        tokenType: "Bearer",
        expiresAt: Date.now() - 10_000, // 10 seconds ago
      };
      expect(manager.isTokenExpired(token)).toBe(true);
    });

    it("should return true for a token within the 60-second expiry buffer", () => {
      const token: OAuthToken = {
        accessToken: "abc",
        tokenType: "Bearer",
        expiresAt: Date.now() + 30_000, // 30 seconds from now (within 60s buffer)
      };
      expect(manager.isTokenExpired(token)).toBe(true);
    });
  });

  describe("exchangeCode", () => {
    it("should exchange an authorization code for tokens", async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          access_token: "new-access-token",
          refresh_token: "new-refresh-token",
          expires_in: 3600,
          token_type: "Bearer",
          scope: "read write",
        }),
      });
      vi.stubGlobal("fetch", mockFetch);

      const token = await manager.exchangeCode(
        "auth-code-123",
        TEST_CONFIG,
        "http://localhost:9999/callback",
      );

      expect(token.accessToken).toBe("new-access-token");
      expect(token.refreshToken).toBe("new-refresh-token");
      expect(token.tokenType).toBe("Bearer");
      expect(token.scope).toBe("read write");
      expect(token.expiresAt).toBeGreaterThan(Date.now());

      expect(mockFetch).toHaveBeenCalledWith(
        TEST_CONFIG.tokenUrl,
        expect.objectContaining({
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
        }),
      );

      // Verify the body includes the right parameters
      const callBody = mockFetch.mock.calls[0][1].body as string;
      expect(callBody).toContain("grant_type=authorization_code");
      expect(callBody).toContain("code=auth-code-123");
      expect(callBody).toContain("client_id=test-client-id");
      expect(callBody).toContain("client_secret=test-client-secret");

      vi.unstubAllGlobals();
    });

    it("should throw on non-ok response", async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        text: async () => "invalid_grant",
      });
      vi.stubGlobal("fetch", mockFetch);

      await expect(
        manager.exchangeCode("bad-code", TEST_CONFIG, "http://localhost:9999/callback"),
      ).rejects.toThrow(MCPOAuthError);

      vi.unstubAllGlobals();
    });

    it("should throw when response is missing access_token", async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ token_type: "Bearer" }),
      });
      vi.stubGlobal("fetch", mockFetch);

      await expect(
        manager.exchangeCode("code", TEST_CONFIG, "http://localhost:9999/callback"),
      ).rejects.toThrow("Token response missing access_token");

      vi.unstubAllGlobals();
    });

    it("should not include client_secret if not provided", async () => {
      const config: MCPOAuthConfig = {
        clientId: "pub-client",
        authorizationUrl: "https://auth.example.com/authorize",
        tokenUrl: "https://auth.example.com/token",
      };
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          access_token: "tok",
          token_type: "Bearer",
        }),
      });
      vi.stubGlobal("fetch", mockFetch);

      await manager.exchangeCode("code", config, "http://localhost:8912/callback");

      const callBody = mockFetch.mock.calls[0][1].body as string;
      expect(callBody).not.toContain("client_secret");

      vi.unstubAllGlobals();
    });
  });

  describe("refreshToken", () => {
    it("should refresh an expired token", async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          access_token: "refreshed-access-token",
          expires_in: 7200,
          token_type: "Bearer",
        }),
      });
      vi.stubGlobal("fetch", mockFetch);
      mockMkdir.mockResolvedValue(undefined);
      mockWriteFile.mockResolvedValue(undefined);

      const token = await manager.refreshToken("test-server", TEST_CONFIG, "old-refresh-token");

      expect(token.accessToken).toBe("refreshed-access-token");
      // Should preserve existing refresh token if response doesn't include a new one
      expect(token.refreshToken).toBe("old-refresh-token");
      expect(token.tokenType).toBe("Bearer");

      const callBody = mockFetch.mock.calls[0][1].body as string;
      expect(callBody).toContain("grant_type=refresh_token");
      expect(callBody).toContain("refresh_token=old-refresh-token");

      vi.unstubAllGlobals();
    });

    it("should throw on refresh failure", async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        text: async () => "invalid_refresh_token",
      });
      vi.stubGlobal("fetch", mockFetch);

      await expect(
        manager.refreshToken("test-server", TEST_CONFIG, "bad-refresh-token"),
      ).rejects.toThrow(MCPOAuthError);

      vi.unstubAllGlobals();
    });
  });

  describe("saveToken / loadToken", () => {
    it("should save a token to disk", async () => {
      mockMkdir.mockResolvedValue(undefined);
      mockWriteFile.mockResolvedValue(undefined);

      await manager.saveToken("my-server", TEST_TOKEN);

      expect(mockMkdir).toHaveBeenCalledWith(expect.stringContaining("oauth-tokens"), {
        recursive: true,
      });
      expect(mockWriteFile).toHaveBeenCalledWith(
        expect.stringContaining("my-server.json"),
        expect.any(String),
        "utf-8",
      );

      // Verify the saved JSON contains correct data
      const savedData = JSON.parse(mockWriteFile.mock.calls[0][1] as string);
      expect(savedData.accessToken).toBe("test-access-token");
      expect(savedData.refreshToken).toBe("test-refresh-token");
    });

    it("should load a token from disk", async () => {
      mockReadFile.mockResolvedValue(JSON.stringify(TEST_TOKEN));

      const token = await manager.loadToken("my-server");

      expect(token).not.toBeNull();
      expect(token!.accessToken).toBe("test-access-token");
      expect(token!.refreshToken).toBe("test-refresh-token");
      expect(token!.tokenType).toBe("Bearer");
    });

    it("should return null if file does not exist", async () => {
      mockReadFile.mockRejectedValue(new Error("ENOENT"));

      const token = await manager.loadToken("nonexistent");
      expect(token).toBeNull();
    });

    it("should return null for invalid JSON", async () => {
      mockReadFile.mockResolvedValue("not valid json{{{");

      const token = await manager.loadToken("bad-data");
      expect(token).toBeNull();
    });

    it("should return null when required fields are missing", async () => {
      mockReadFile.mockResolvedValue(JSON.stringify({ someField: "value" }));

      const token = await manager.loadToken("incomplete");
      expect(token).toBeNull();
    });
  });

  describe("getAccessToken", () => {
    it("should return cached token if valid", async () => {
      // Manually save a token in memory by first loading from disk
      mockReadFile.mockResolvedValue(JSON.stringify(TEST_TOKEN));

      const accessToken = await manager.getAccessToken("server-a", TEST_CONFIG);
      expect(accessToken).toBe("test-access-token");
    });

    it("should return null when no token exists", async () => {
      mockReadFile.mockRejectedValue(new Error("ENOENT"));

      const accessToken = await manager.getAccessToken("unknown-server", TEST_CONFIG);
      expect(accessToken).toBeNull();
    });

    it("should return null when token is expired and has no refresh token", async () => {
      const expiredToken: OAuthToken = {
        accessToken: "expired-token",
        tokenType: "Bearer",
        expiresAt: Date.now() - 120_000, // 2 minutes ago
      };
      mockReadFile.mockResolvedValue(JSON.stringify(expiredToken));

      const accessToken = await manager.getAccessToken("expired-server", TEST_CONFIG);
      expect(accessToken).toBeNull();
    });

    it("should refresh and return new token when expired with refresh token", async () => {
      const expiredToken: OAuthToken = {
        accessToken: "expired-token",
        refreshToken: "valid-refresh",
        tokenType: "Bearer",
        expiresAt: Date.now() - 120_000,
      };
      mockReadFile.mockResolvedValue(JSON.stringify(expiredToken));

      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          access_token: "fresh-access-token",
          expires_in: 3600,
          token_type: "Bearer",
        }),
      });
      vi.stubGlobal("fetch", mockFetch);
      mockMkdir.mockResolvedValue(undefined);
      mockWriteFile.mockResolvedValue(undefined);

      const accessToken = await manager.getAccessToken("refresh-server", TEST_CONFIG);
      expect(accessToken).toBe("fresh-access-token");

      vi.unstubAllGlobals();
    });

    it("should return null when refresh fails", async () => {
      const expiredToken: OAuthToken = {
        accessToken: "expired-token",
        refreshToken: "bad-refresh",
        tokenType: "Bearer",
        expiresAt: Date.now() - 120_000,
      };
      mockReadFile.mockResolvedValue(JSON.stringify(expiredToken));

      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        text: async () => "refresh_failed",
      });
      vi.stubGlobal("fetch", mockFetch);

      const accessToken = await manager.getAccessToken("fail-refresh-server", TEST_CONFIG);
      expect(accessToken).toBeNull();

      vi.unstubAllGlobals();
    });
  });

  describe("revokeToken", () => {
    it("should remove token from memory and disk", async () => {
      mockUnlink.mockResolvedValue(undefined);

      await manager.revokeToken("revoke-server");

      expect(mockUnlink).toHaveBeenCalledWith(expect.stringContaining("revoke-server.json"));
    });

    it("should not throw when token file does not exist", async () => {
      mockUnlink.mockRejectedValue(new Error("ENOENT"));

      await expect(manager.revokeToken("no-file-server")).resolves.toBeUndefined();
    });
  });
});

describe("MCPOAuthError", () => {
  it("should have the correct error code and context", () => {
    const error = new MCPOAuthError("test error", { server: "s1" });
    expect(error).toBeInstanceOf(Error);
    expect(error.code).toBe("MCP_OAUTH_ERROR");
    expect(error.message).toBe("test error");
    expect(error.context).toEqual({ server: "s1" });
  });
});
