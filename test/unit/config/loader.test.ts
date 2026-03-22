import { describe, it, expect, afterEach } from "vitest";
import { loadConfig } from "../../../src/config/loader.js";
import { mkdir, writeFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

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
    delete process.env.LOCAL_MODEL;
    process.env.DBCODE_MODEL = "env-model";
    const resolved = await loadConfig();
    expect(resolved.config.llm.model).toBe("env-model");
    delete process.env.DBCODE_MODEL;
  });

  it("should apply DBCODE_BASE_URL from env", async () => {
    delete process.env.LOCAL_API_BASE_URL;
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

  it("should fallback to OPENAI_API_KEY when DBCODE_API_KEY not set", async () => {
    delete process.env.DBCODE_API_KEY;
    delete process.env.OPENAI_BASE_URL;
    delete process.env.DBCODE_BASE_URL;
    delete process.env.DBCODE_MODEL;
    delete process.env.OPENAI_MODEL;
    delete process.env.LOCAL_MODEL;
    delete process.env.LOCAL_API_BASE_URL;
    process.env.OPENAI_API_KEY = "sk-test-openai-key";
    const resolved = await loadConfig();
    expect(resolved.config.llm.apiKey).toBe("sk-test-openai-key");
    expect(resolved.config.llm.baseUrl).toBe("https://api.openai.com/v1");
    delete process.env.OPENAI_API_KEY;
  });

  it("should prefer DBCODE_API_KEY over OPENAI_API_KEY", async () => {
    process.env.DBCODE_API_KEY = "dbcode-key";
    process.env.OPENAI_API_KEY = "openai-key";
    const resolved = await loadConfig();
    expect(resolved.config.llm.apiKey).toBe("dbcode-key");
    delete process.env.DBCODE_API_KEY;
    delete process.env.OPENAI_API_KEY;
  });

  it("should load project config from .dbcode/config.json", async () => {
    // Clear env vars so they don't override project config
    const savedKey = process.env.OPENAI_API_KEY;
    const savedDbKey = process.env.DBCODE_API_KEY;
    const savedModel = process.env.DBCODE_MODEL;
    const savedBaseUrl = process.env.OPENAI_BASE_URL;
    const savedDbBaseUrl = process.env.DBCODE_BASE_URL;
    const savedOpenaiModel = process.env.OPENAI_MODEL;
    delete process.env.OPENAI_API_KEY;
    delete process.env.DBCODE_API_KEY;
    delete process.env.DBCODE_MODEL;
    delete process.env.OPENAI_BASE_URL;
    delete process.env.DBCODE_BASE_URL;
    delete process.env.OPENAI_MODEL;
    delete process.env.LOCAL_MODEL;
    delete process.env.LOCAL_API_BASE_URL;

    const tmpDir = join(tmpdir(), `dbcode-config-test-${Date.now()}`);
    const projectConfigDir = join(tmpDir, ".dbcode");
    await mkdir(projectConfigDir, { recursive: true });
    await writeFile(
      join(projectConfigDir, "config.json"),
      JSON.stringify({ llm: { model: "project-model" } }),
      "utf-8",
    );

    const resolved = await loadConfig({}, tmpDir);
    expect(resolved.config.llm.model).toBe("project-model");
    expect(resolved.sources.get("llm")).toBe("project");

    // Restore env
    if (savedKey) process.env.OPENAI_API_KEY = savedKey;
    if (savedDbKey) process.env.DBCODE_API_KEY = savedDbKey;
    if (savedModel) process.env.DBCODE_MODEL = savedModel;
    if (savedBaseUrl) process.env.OPENAI_BASE_URL = savedBaseUrl;
    if (savedDbBaseUrl) process.env.DBCODE_BASE_URL = savedDbBaseUrl;
    if (savedOpenaiModel) process.env.OPENAI_MODEL = savedOpenaiModel;
    await rm(tmpDir, { recursive: true, force: true });
  });

  it("should throw on invalid config schema", async () => {
    await expect(
      loadConfig({
        llm: {
          model: "",
          baseUrl: "",
          temperature: -999,
          maxTokens: -1,
          contextWindow: -1,
          timeout: -1,
        },
      }),
    ).rejects.toThrow("Invalid configuration");
  });
});
