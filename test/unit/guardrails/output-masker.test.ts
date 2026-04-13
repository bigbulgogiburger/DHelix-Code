import { describe, it, expect } from "vitest";
import { maskSecrets, type OutputMaskingConfig } from "../../../src/guardrails/output-masker.js";

// ---------------------------------------------------------------------------
// 테스트
// ---------------------------------------------------------------------------

describe("maskSecrets", () => {
  // ---------------------------------------------------------------------------
  // 기본 동작
  // ---------------------------------------------------------------------------

  describe("default behavior (enabled=true)", () => {
    it("should return original string when no secrets are present", () => {
      const input = "Hello, this is a safe output with no secrets.";
      const result = maskSecrets(input);
      expect(result.masked).toBe(input);
      expect(result.maskCount).toBe(0);
      expect(result.patternsMatched).toHaveLength(0);
    });

    it("should return original when input is empty string", () => {
      const result = maskSecrets("");
      expect(result.masked).toBe("");
      expect(result.maskCount).toBe(0);
    });
  });

  // ---------------------------------------------------------------------------
  // enabled: false
  // ---------------------------------------------------------------------------

  describe("enabled: false", () => {
    it("should return original output without masking", () => {
      const input = "OPENAI_KEY=sk-abcdefghij1234567890ABCD";
      const result = maskSecrets(input, { enabled: false });
      expect(result.masked).toBe(input);
      expect(result.maskCount).toBe(0);
      expect(result.patternsMatched).toHaveLength(0);
    });
  });

  // ---------------------------------------------------------------------------
  // OpenAI API Key 마스킹
  // ---------------------------------------------------------------------------

  describe("OpenAI API Key masking", () => {
    it("should mask OpenAI API key with default maskChar *", () => {
      const input = "export OPENAI_KEY=sk-abcdefghijklmnopqrstu";
      const result = maskSecrets(input);
      expect(result.masked).not.toContain("sk-abcdefghijklmnopqrstu");
      expect(result.maskCount).toBeGreaterThan(0);
      expect(result.patternsMatched).toContain("OpenAI API Key");
    });

    it("should use custom maskChar when specified", () => {
      const input = "sk-abcdefghijklmnopqrstu";
      const result = maskSecrets(input, { enabled: true, maskChar: "#" });
      expect(result.masked).toMatch(/^#{2,}$/);
    });

    it("should preserve prefix when preservePrefix is set", () => {
      const input = "sk-abcdefghijklmnopqrstu";
      // sk- = 3 chars prefix
      const result = maskSecrets(input, { enabled: true, preservePrefix: 3 });
      expect(result.masked.startsWith("sk-")).toBe(true);
      expect(result.masked.length).toBe(input.length);
    });

    it("should preserve full match when preservePrefix equals match length", () => {
      // When preservePrefix >= match length, the entire match is treated as prefix → no masking of suffix
      const input = "sk-abcdefghijklmnopqrstu";
      const result = maskSecrets(input, { enabled: true, preservePrefix: input.length });
      // The entire token becomes the "preserved prefix" — nothing to mask after it
      expect(result.masked).toBe(input);
    });
  });

  // ---------------------------------------------------------------------------
  // Anthropic API Key 마스킹
  // ---------------------------------------------------------------------------

  describe("Anthropic API Key masking", () => {
    it("should mask Anthropic API key", () => {
      const input = "ANTHROPIC_API_KEY=sk-ant-api01-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx";
      const result = maskSecrets(input);
      expect(result.patternsMatched).toContain("Anthropic API Key");
      expect(result.masked).not.toContain("sk-ant-api01");
    });
  });

  // ---------------------------------------------------------------------------
  // GitHub Token 마스킹
  // ---------------------------------------------------------------------------

  describe("GitHub Token masking", () => {
    it("should mask GitHub personal access token", () => {
      // ghp_ + exactly 36 alphanumeric chars = 40 chars total
      const input = "GH_TOKEN=ghp_abcdefghijklmnopqrstuvwxyz0123456789ab";
      const result = maskSecrets(input);
      expect(result.patternsMatched).toContain("GitHub Token");
      expect(result.masked).not.toContain("ghp_abcdefghijklmnopqrstuvwxyz0123456789ab");
    });
  });

  // ---------------------------------------------------------------------------
  // AWS Access Key 마스킹
  // ---------------------------------------------------------------------------

  describe("AWS Access Key masking", () => {
    it("should mask AWS AKIA access key", () => {
      const input = "AWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE";
      const result = maskSecrets(input);
      expect(result.patternsMatched).toContain("AWS Access Key");
      expect(result.masked).not.toContain("AKIAIOSFODNN7EXAMPLE");
    });
  });

  // ---------------------------------------------------------------------------
  // 데이터베이스 연결 문자열 마스킹
  // ---------------------------------------------------------------------------

  describe("Database connection string masking", () => {
    it("should mask PostgreSQL connection string", () => {
      const input = "DATABASE_URL=postgresql://user:password@localhost:5432/mydb";
      const result = maskSecrets(input);
      expect(result.patternsMatched).toContain("PostgreSQL Connection");
      expect(result.masked).not.toContain("postgresql://user:password@localhost:5432/mydb");
    });

    it("should mask MongoDB connection string", () => {
      const input = "MONGO_URL=mongodb://admin:secret@cluster.mongodb.net/db";
      const result = maskSecrets(input);
      expect(result.patternsMatched).toContain("MongoDB Connection");
    });
  });

  // ---------------------------------------------------------------------------
  // 여러 시크릿이 있는 경우
  // ---------------------------------------------------------------------------

  describe("multiple secrets in one output", () => {
    it("should mask all secrets and report correct count", () => {
      const input = [
        "OPENAI_API_KEY=sk-abcdefghijklmnopqrstu",
        "AWS_KEY=AKIAIOSFODNN7EXAMPLE",
      ].join("\n");

      const result = maskSecrets(input);
      expect(result.patternsMatched.length).toBeGreaterThanOrEqual(2);
      expect(result.maskCount).toBeGreaterThanOrEqual(2);
    });
  });

  // ---------------------------------------------------------------------------
  // maskChar 옵션
  // ---------------------------------------------------------------------------

  describe("maskChar option", () => {
    it("should use * by default", () => {
      const input = "sk-abcdefghijklmnopqrstu";
      const result = maskSecrets(input, { enabled: true });
      expect(result.masked).toMatch(/\*/);
    });

    it("should use custom maskChar X", () => {
      const input = "sk-abcdefghijklmnopqrstu";
      const result = maskSecrets(input, { enabled: true, maskChar: "X" });
      expect(result.masked).toMatch(/X/);
      expect(result.masked).not.toMatch(/\*/);
    });
  });

  // ---------------------------------------------------------------------------
  // preservePrefix 옵션
  // ---------------------------------------------------------------------------

  describe("preservePrefix option", () => {
    it("should preserve exactly N chars at the start of the match", () => {
      // ghp_ (4) + exactly 36 alphanumeric chars = 40 chars total — valid GitHub token pattern
      const token = "ghp_abcdefghijklmnopqrstuvwxyz012345678901";
      // Only first 40 chars match: ghp_ + 36 chars = "ghp_abcdefghijklmnopqrstuvwxyz012345678"
      // Use OpenAI key pattern instead (cleaner for prefix test)
      const openaiKey = "sk-abcdefghijklmnopqrstu"; // 23 chars, matches /sk-[a-zA-Z0-9]{20,}/
      const result = maskSecrets(openaiKey, { enabled: true, preservePrefix: 3 });
      // "sk-" should be preserved
      expect(result.masked.startsWith("sk-")).toBe(true);
      // rest should be masked
      const rest = result.masked.slice(3);
      expect(rest).toMatch(/^\*+$/);
    });

    it("should mask entire match when preservePrefix is 0", () => {
      const openaiKey = "sk-abcdefghijklmnopqrstu"; // valid OpenAI key pattern
      const result = maskSecrets(openaiKey, { enabled: true, preservePrefix: 0 });
      expect(result.masked).toMatch(/^\*+$/);
    });
  });

  // ---------------------------------------------------------------------------
  // MaskingResult 구조 검증
  // ---------------------------------------------------------------------------

  describe("MaskingResult structure", () => {
    it("should always return masked, maskCount, patternsMatched", () => {
      const result = maskSecrets("safe text", { enabled: true });
      expect(result).toHaveProperty("masked");
      expect(result).toHaveProperty("maskCount");
      expect(result).toHaveProperty("patternsMatched");
      expect(typeof result.maskCount).toBe("number");
      expect(Array.isArray(result.patternsMatched)).toBe(true);
    });

    it("maskCount should equal total number of masked occurrences", () => {
      // Two separate OpenAI keys in the same output
      const key1 = "sk-aaaaaaaaaaaaaaaaaaaa";
      const key2 = "sk-bbbbbbbbbbbbbbbbbbbb";
      const input = `KEY1=${key1} KEY2=${key2}`;
      const result = maskSecrets(input, { enabled: true });
      expect(result.maskCount).toBeGreaterThanOrEqual(2);
    });
  });

  // ---------------------------------------------------------------------------
  // JWT 마스킹
  // ---------------------------------------------------------------------------

  describe("JWT masking", () => {
    it("should mask a JWT token", () => {
      const jwt =
        "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIn0.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c";
      const input = `Authorization: Bearer ${jwt}`;
      const result = maskSecrets(input);
      // JWT or Bearer Token pattern should match
      const hasJwtOrBearer =
        result.patternsMatched.includes("JWT Token") ||
        result.patternsMatched.includes("Bearer Token");
      expect(hasJwtOrBearer).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  // logMaskedCount 옵션 (side-effect: logger 호출 검증은 생략, 로직만 확인)
  // ---------------------------------------------------------------------------

  describe("logMaskedCount option", () => {
    it("should not throw when logMaskedCount is true and secrets are found", () => {
      const input = "sk-abcdefghijklmnopqrstu";
      expect(() => maskSecrets(input, { enabled: true, logMaskedCount: true })).not.toThrow();
    });

    it("should not throw when logMaskedCount is true and no secrets found", () => {
      expect(() => maskSecrets("safe text", { enabled: true, logMaskedCount: true })).not.toThrow();
    });
  });
});
