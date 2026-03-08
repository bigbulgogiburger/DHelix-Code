import { describe, it, expect } from "vitest";
import { DEFAULT_CONFIG } from "../../../src/config/defaults.js";

describe("DEFAULT_CONFIG", () => {
  it("should have LLM defaults", () => {
    expect(DEFAULT_CONFIG.llm.model).toBe("gpt-4.1-mini");
    expect(DEFAULT_CONFIG.llm.baseUrl).toBe("https://api.openai.com/v1");
    expect(DEFAULT_CONFIG.llm.temperature).toBe(0.0);
    expect(DEFAULT_CONFIG.llm.maxTokens).toBe(32768);
    expect(DEFAULT_CONFIG.llm.contextWindow).toBe(1_000_000);
    expect(DEFAULT_CONFIG.llm.timeout).toBe(60_000);
  });

  it("should have permission mode", () => {
    expect(DEFAULT_CONFIG.permissionMode).toBe("default");
  });

  it("should have security defaults", () => {
    expect(DEFAULT_CONFIG.security.mode).toBe("local");
    expect(DEFAULT_CONFIG.security.secretScanning).toBe(true);
    expect(DEFAULT_CONFIG.security.inputFiltering).toBe(true);
    expect(DEFAULT_CONFIG.security.outputFiltering).toBe(true);
    expect(DEFAULT_CONFIG.security.auditLogging).toBe(false);
  });

  it("should have rate limit defaults", () => {
    expect(DEFAULT_CONFIG.security.rateLimit.requestsPerMinute).toBe(60);
    expect(DEFAULT_CONFIG.security.rateLimit.tokensPerDay).toBe(1_000_000);
  });

  it("should have UI defaults", () => {
    expect(DEFAULT_CONFIG.ui.theme).toBe("auto");
    expect(DEFAULT_CONFIG.ui.markdown).toBe(true);
    expect(DEFAULT_CONFIG.ui.syntaxHighlighting).toBe(true);
    expect(DEFAULT_CONFIG.ui.spinner).toBe(true);
    expect(DEFAULT_CONFIG.ui.statusBar).toBe(true);
  });

  it("should have verbose default", () => {
    expect(DEFAULT_CONFIG.verbose).toBe(false);
  });
});
