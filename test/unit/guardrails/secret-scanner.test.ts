import { describe, it, expect } from "vitest";
import { scanForSecrets } from "../../../src/guardrails/secret-scanner.js";

describe("scanForSecrets", () => {
  it("should detect AWS access keys", () => {
    const result = scanForSecrets("key=AKIAIOSFODNN7EXAMPLE");
    expect(result.found).toBe(true);
    expect(result.redacted).toBe("key=[REDACTED]");
    expect(result.patterns).toContain("AWS Access Key");
  });

  it("should detect ASIA-prefixed AWS keys", () => {
    const result = scanForSecrets("ASIAXXXXXXXXXYYYYZZZZ");
    expect(result.found).toBe(true);
    expect(result.patterns).toContain("AWS Access Key");
  });

  it("should detect GitHub personal access tokens", () => {
    const token = "ghp_" + "a".repeat(36);
    const result = scanForSecrets(`token: ${token}`);
    expect(result.found).toBe(true);
    expect(result.redacted).toBe("token: [REDACTED]");
    expect(result.patterns).toContain("GitHub Token");
  });

  it("should detect OpenAI API keys", () => {
    const result = scanForSecrets("OPENAI_KEY=sk-abcdefghijklmnopqrstuvwx");
    expect(result.found).toBe(true);
    expect(result.redacted).toBe("OPENAI_KEY=[REDACTED]");
    expect(result.patterns).toContain("OpenAI API Key");
  });

  it("should detect password assignments", () => {
    const result = scanForSecrets("password = myS3cret123");
    expect(result.found).toBe(true);
    expect(result.redacted).toBe("[REDACTED]");
    expect(result.patterns).toContain("Password");
  });

  it("should detect password with colon separator", () => {
    const result = scanForSecrets("PASSWORD: hunter2");
    expect(result.found).toBe(true);
    expect(result.patterns).toContain("Password");
  });

  it("should detect Bearer tokens", () => {
    const result = scanForSecrets("Authorization: Bearer eyJhbGciOi.token.here");
    expect(result.found).toBe(true);
    expect(result.redacted).toBe("Authorization: [REDACTED]");
    expect(result.patterns).toContain("Bearer Token");
  });

  it("should detect API key assignments", () => {
    const result = scanForSecrets("API_KEY=abc123def456");
    expect(result.found).toBe(true);
    expect(result.redacted).toBe("[REDACTED]");
    expect(result.patterns).toContain("API Key");
  });

  it("should detect API-KEY with hyphen", () => {
    const result = scanForSecrets("API-KEY = somevalue");
    expect(result.found).toBe(true);
    expect(result.patterns).toContain("API Key");
  });

  it("should detect APIKEY without separator", () => {
    const result = scanForSecrets("APIKEY=somevalue");
    expect(result.found).toBe(true);
    expect(result.patterns).toContain("API Key");
  });

  it("should return no findings for clean text", () => {
    const result = scanForSecrets("Hello, this is a normal log message.");
    expect(result.found).toBe(false);
    expect(result.redacted).toBe("Hello, this is a normal log message.");
    expect(result.patterns).toHaveLength(0);
  });

  it("should detect multiple secret types in one text", () => {
    const text = "aws=AKIAIOSFODNN7EXAMPLE password=secret123";
    const result = scanForSecrets(text);
    expect(result.found).toBe(true);
    expect(result.patterns).toContain("AWS Access Key");
    expect(result.patterns).toContain("Password");
    expect(result.redacted).not.toContain("AKIAIOSFODNN7EXAMPLE");
    expect(result.redacted).not.toContain("password=secret123");
  });

  it("should replace all occurrences of a pattern", () => {
    const text = "key1=AKIAIOSFODNN7EXAMPLE key2=AKIAIOSFODNN7ANOTHERONE";
    const result = scanForSecrets(text);
    expect(result.found).toBe(true);
    expect(result.redacted).not.toContain("AKIA");
  });
});
