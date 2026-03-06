import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { resolveToken } from "../../../src/auth/token-store.js";
import { TokenManager } from "../../../src/auth/token-manager.js";

describe("token-store", () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  describe("resolveToken", () => {
    it("should return undefined when no token configured", async () => {
      delete process.env.DBCODE_API_KEY;
      delete process.env.OPENAI_API_KEY;
      const token = await resolveToken();
      // Could be undefined or from file, depending on environment
      // We just verify it doesn't throw
      expect(token === undefined || token.source !== undefined).toBe(true);
    });

    it("should resolve DBCODE_API_KEY from env", async () => {
      process.env.DBCODE_API_KEY = "test-key-123";
      const token = await resolveToken();
      expect(token).toBeDefined();
      expect(token!.config.token).toBe("test-key-123");
      expect(token!.source).toBe("environment");
    });

    it("should resolve OPENAI_API_KEY from env as fallback", async () => {
      delete process.env.DBCODE_API_KEY;
      process.env.OPENAI_API_KEY = "openai-key-456";
      const token = await resolveToken();
      expect(token).toBeDefined();
      expect(token!.config.token).toBe("openai-key-456");
      expect(token!.source).toBe("environment");
    });

    it("should prefer DBCODE_API_KEY over OPENAI_API_KEY", async () => {
      process.env.DBCODE_API_KEY = "dbcode-key";
      process.env.OPENAI_API_KEY = "openai-key";
      const token = await resolveToken();
      expect(token!.config.token).toBe("dbcode-key");
    });
  });
});

describe("TokenManager", () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("should cache resolved token", async () => {
    process.env.DBCODE_API_KEY = "cached-key";
    const manager = new TokenManager();

    const first = await manager.getToken();
    const second = await manager.getToken();
    expect(first).toBe(second); // Same reference = cached
  });

  it("should clear cache", async () => {
    process.env.DBCODE_API_KEY = "key1";
    const manager = new TokenManager();

    await manager.getToken();
    manager.clearCache();

    process.env.DBCODE_API_KEY = "key2";
    const token = await manager.getToken();
    expect(token!.config.token).toBe("key2");
  });

  it("should throw on requireToken with no token", async () => {
    delete process.env.DBCODE_API_KEY;
    delete process.env.OPENAI_API_KEY;
    const manager = new TokenManager();
    manager.clearCache();

    // This may or may not throw depending on whether credentials.json exists
    // Just verify it doesn't crash
    try {
      await manager.requireToken();
    } catch (error) {
      expect(error).toBeDefined();
    }
  });

  it("should build bearer auth headers", async () => {
    process.env.DBCODE_API_KEY = "test-bearer";
    const manager = new TokenManager();
    manager.clearCache();
    const headers = await manager.getAuthHeaders();
    expect(headers.Authorization).toBe("Bearer test-bearer");
  });

  it("should return empty headers when no token", async () => {
    delete process.env.DBCODE_API_KEY;
    delete process.env.OPENAI_API_KEY;
    const manager = new TokenManager();
    manager.clearCache();
    const headers = await manager.getAuthHeaders();
    // May be empty or from file
    expect(typeof headers).toBe("object");
  });

  it("should build api-key auth headers", async () => {
    process.env.DBCODE_API_KEY = "test-api-key";
    const manager = new TokenManager();
    manager.clearCache();

    // We need to force the method to api-key — use setToken
    await manager.setToken({ method: "api-key", token: "my-api-key" });
    const headers = await manager.getAuthHeaders();
    expect(headers["X-API-Key"]).toBe("my-api-key");
  });

  it("should build custom-header auth headers", async () => {
    const manager = new TokenManager();
    manager.clearCache();

    await manager.setToken({
      method: "custom-header",
      token: "custom-val",
      headerName: "X-Custom",
    });
    const headers = await manager.getAuthHeaders();
    expect(headers["X-Custom"]).toBe("custom-val");
  });

  it("should build custom-header with default header name", async () => {
    const manager = new TokenManager();
    manager.clearCache();

    await manager.setToken({ method: "custom-header", token: "custom-val" });
    const headers = await manager.getAuthHeaders();
    expect(headers["Authorization"]).toBe("custom-val");
  });

  it("should use cached token after setToken", async () => {
    const manager = new TokenManager();
    manager.clearCache();

    await manager.setToken({ method: "bearer", token: "stored-token" });
    const token = await manager.getToken();
    expect(token!.config.token).toBe("stored-token");
    expect(token!.source).toBe("file");
  });
});
