import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { loadConfig } from "../../../src/config/loader.js";

describe("loadConfig", () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("should return defaults when no overrides", async () => {
    const resolved = await loadConfig();
    expect(resolved.config).toBeDefined();
    expect(resolved.config.llm.model).toBeDefined();
    expect(resolved.sources.get("*")).toBe("defaults");
  });

  it("should apply CLI overrides", async () => {
    const resolved = await loadConfig({
      llm: {
        model: "custom-model",
        baseUrl: "http://localhost:1234/v1",
        temperature: 0.5,
        maxTokens: 2048,
        contextWindow: 64000,
        timeout: 30000,
      },
    });
    expect(resolved.config.llm.model).toBe("custom-model");
    expect(resolved.sources.get("llm")).toBe("cli-flags");
  });

  it("should apply environment overrides", async () => {
    process.env.DBCODE_MODEL = "env-model";
    const resolved = await loadConfig();
    expect(resolved.config.llm.model).toBe("env-model");
    delete process.env.DBCODE_MODEL;
  });

  it("should apply DBCODE_BASE_URL from env", async () => {
    process.env.DBCODE_BASE_URL = "http://custom:8080/v1";
    const resolved = await loadConfig();
    expect(resolved.config.llm.baseUrl).toBe("http://custom:8080/v1");
    delete process.env.DBCODE_BASE_URL;
  });

  it("should apply DBCODE_API_KEY from env", async () => {
    process.env.DBCODE_API_KEY = "test-key-123";
    const resolved = await loadConfig();
    expect(resolved.config.llm.apiKey).toBe("test-key-123");
    delete process.env.DBCODE_API_KEY;
  });

  it("should apply verbose from env", async () => {
    process.env.DBCODE_VERBOSE = "true";
    const resolved = await loadConfig();
    expect(resolved.config.verbose).toBe(true);
    delete process.env.DBCODE_VERBOSE;
  });

  it("CLI overrides should take highest priority", async () => {
    process.env.DBCODE_MODEL = "env-model";
    const resolved = await loadConfig({
      llm: {
        model: "cli-model",
        baseUrl: "http://localhost:11434/v1",
        temperature: 0,
        maxTokens: 4096,
        contextWindow: 128000,
        timeout: 60000,
      },
    });
    expect(resolved.config.llm.model).toBe("cli-model");
    delete process.env.DBCODE_MODEL;
  });

  it("should handle non-existent project directory", async () => {
    const resolved = await loadConfig({}, "/nonexistent/project/dir");
    expect(resolved.config).toBeDefined();
  });
});
