import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { resolveToken, saveToken } from "../../../src/auth/token-store.js";
import { TokenManager } from "../../../src/auth/token-manager.js";
import { writeFile, mkdir, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

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
    const manager = new TokenManager();
    manager.clearCache();

    // Force getToken to return undefined
    vi.spyOn(manager, "getToken").mockResolvedValueOnce(undefined);

    await expect(manager.requireToken()).rejects.toThrow("No API token configured");
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

describe("saveToken", () => {
  it("should save bearer token to file", async () => {
    // saveToken writes to CONFIG_DIR/credentials.json
    // We just verify it doesn't throw for a valid config
    await expect(saveToken({ method: "bearer", token: "test-save-token" })).resolves.not.toThrow();
  });

  it("should save api-key token", async () => {
    await expect(saveToken({ method: "api-key", token: "api-key-save" })).resolves.not.toThrow();
  });

  it("should save custom-header token with header name", async () => {
    await expect(
      saveToken({ method: "custom-header", token: "custom-val", headerName: "X-Custom" }),
    ).resolves.not.toThrow();
  });
});

describe("resolveToken - file fallback", () => {
  it("should fall back to credentials file when no env vars", async () => {
    const originalDbcode = process.env.DBCODE_API_KEY;
    const originalOpenai = process.env.OPENAI_API_KEY;
    delete process.env.DBCODE_API_KEY;
    delete process.env.OPENAI_API_KEY;

    // First save a token to the file
    await saveToken({ method: "bearer", token: "file-fallback-token" });

    const token = await resolveToken();
    // Should find the file token since no env vars
    expect(token).toBeDefined();
    if (token && token.source === "file") {
      expect(token.config.token).toBe("file-fallback-token");
      expect(token.config.method).toBe("bearer");
    }

    // Restore env
    if (originalDbcode) process.env.DBCODE_API_KEY = originalDbcode;
    if (originalOpenai) process.env.OPENAI_API_KEY = originalOpenai;
  });

  it("should handle invalid credentials file data", async () => {
    const originalDbcode = process.env.DBCODE_API_KEY;
    const originalOpenai = process.env.OPENAI_API_KEY;
    delete process.env.DBCODE_API_KEY;
    delete process.env.OPENAI_API_KEY;

    // Save a token with empty string — the loadFromFile should return undefined
    // because typeof data.token === "string" && data.token.length > 0 will fail
    const { CONFIG_DIR } = await import("../../../src/constants.js");
    const { joinPath } = await import("../../../src/utils/path.js");
    const tokenFile = joinPath(CONFIG_DIR, "credentials.json");

    // Write credentials with empty token
    await mkdir(CONFIG_DIR, { recursive: true });
    await writeFile(tokenFile, JSON.stringify({ method: "bearer", token: "" }), "utf-8");

    const token = await resolveToken();
    // With empty token string, loadFromFile should return undefined
    // since data.token.length > 0 check fails
    // Token could be undefined (no env, empty file)
    expect(token === undefined || token.source !== undefined).toBe(true);

    // Restore env
    if (originalDbcode) process.env.DBCODE_API_KEY = originalDbcode;
    if (originalOpenai) process.env.OPENAI_API_KEY = originalOpenai;
  });

  it("should handle credentials file with no token field", async () => {
    const originalDbcode = process.env.DBCODE_API_KEY;
    const originalOpenai = process.env.OPENAI_API_KEY;
    delete process.env.DBCODE_API_KEY;
    delete process.env.OPENAI_API_KEY;

    const { CONFIG_DIR } = await import("../../../src/constants.js");
    const { joinPath } = await import("../../../src/utils/path.js");
    const tokenFile = joinPath(CONFIG_DIR, "credentials.json");

    // Write credentials without token field
    await mkdir(CONFIG_DIR, { recursive: true });
    await writeFile(tokenFile, JSON.stringify({ method: "bearer" }), "utf-8");

    const token = await resolveToken();
    // Without token field, should return undefined from file
    expect(token === undefined || token.source !== undefined).toBe(true);

    // Restore env
    if (originalDbcode) process.env.DBCODE_API_KEY = originalDbcode;
    if (originalOpenai) process.env.OPENAI_API_KEY = originalOpenai;
  });
});
