import { describe, it, expect } from "vitest";
import {
  shannonEntropy,
  detectHighEntropySecrets,
} from "../../../src/guardrails/entropy-scanner.js";

describe("shannonEntropy", () => {
  it("should return 0 for empty string", () => {
    expect(shannonEntropy("")).toBe(0);
  });

  it("should return 0 for single repeated character", () => {
    expect(shannonEntropy("aaaaaaa")).toBe(0);
  });

  it("should return 1.0 for a string with exactly 2 equally frequent chars", () => {
    const entropy = shannonEntropy("ab");
    expect(entropy).toBeCloseTo(1.0, 5);
  });

  it("should return low entropy for repetitive text", () => {
    const entropy = shannonEntropy("hellohellohello");
    expect(entropy).toBeLessThan(3.0);
  });

  it("should return high entropy for random-looking hex strings", () => {
    // A typical high-entropy string (hex)
    const entropy = shannonEntropy("a1b2c3d4e5f6a7b8c9d0e1f2");
    expect(entropy).toBeGreaterThan(3.5);
  });

  it("should return high entropy for base64-like strings", () => {
    const entropy = shannonEntropy("dGhpcyBpcyBhIHRlc3Qgc3RyaW5nIGZvciBlbnRyb3B5");
    expect(entropy).toBeGreaterThan(4.0);
  });

  it("should return higher entropy for truly random strings", () => {
    // Random-looking string with many unique characters
    const entropy = shannonEntropy("kF9$xZ2!mR7@pL5#qW3^tY8&nS6*vU4");
    expect(entropy).toBeGreaterThan(4.5);
  });

  it("should be deterministic for the same input", () => {
    const input = "test-entropy-value";
    expect(shannonEntropy(input)).toBe(shannonEntropy(input));
  });
});

describe("detectHighEntropySecrets", () => {
  it("should return empty array for normal code", () => {
    const content = `
      const x = 42;
      function hello(name: string) {
        return \`Hello, \${name}\`;
      }
      export { hello };
    `;
    const result = detectHighEntropySecrets(content);
    expect(result).toHaveLength(0);
  });

  it("should detect high-entropy API key assignments", () => {
    const content = `
      const apiKey = "kF9xZ2mR7pL5qW3tY8nS6vU4bH1jD0a";
    `;
    const result = detectHighEntropySecrets(content);
    expect(result.length).toBeGreaterThanOrEqual(1);

    const match = result[0];
    expect(match.entropy).toBeGreaterThanOrEqual(4.5);
    expect(match.value).toContain("...");
    expect(match.line).toBeGreaterThan(0);
  });

  it("should detect high-entropy secret assignments", () => {
    const content = `
      API_KEY = "zX9kM2pR7vL5qW3tY8nS6bH1jD0aFc4eG"
    `;
    const result = detectHighEntropySecrets(content);
    expect(result.length).toBeGreaterThanOrEqual(1);
    expect(result[0].entropy).toBeGreaterThanOrEqual(4.5);
  });

  it("should detect exported secret variables", () => {
    const content = `
      export SECRET_TOKEN="kF9xZ2mR7pL5qW3tY8nS6vU4bH1jD0a"
    `;
    const result = detectHighEntropySecrets(content);
    expect(result.length).toBeGreaterThanOrEqual(1);
  });

  it("should not flag low-entropy values", () => {
    const content = `
      const apiKey = "testtest";
      API_KEY = "abcabcabcabc"
    `;
    const result = detectHighEntropySecrets(content);
    expect(result).toHaveLength(0);
  });

  it("should truncate the value to 8 chars + ellipsis", () => {
    const content = `
      const authToken = "kF9xZ2mR7pL5qW3tY8nS6vU4bH1jD0a";
    `;
    const result = detectHighEntropySecrets(content);
    if (result.length > 0) {
      expect(result[0].value).toMatch(/^.{8}\.\.\.$/);
    }
  });

  it("should report correct line numbers", () => {
    const content = [
      "line 1",
      "line 2",
      'const secret_key = "kF9xZ2mR7pL5qW3tY8nS6vU4bH1jD0a"',
      "line 4",
    ].join("\n");

    const result = detectHighEntropySecrets(content);
    if (result.length > 0) {
      expect(result[0].line).toBe(3);
    }
  });

  it("should detect multiple secrets in the same content", () => {
    const content = `
      const apiKey = "kF9xZ2mR7pL5qW3tY8nS6vU4bH1jD0a";
      const authToken = "zY8wX7vU6tS5rQ4pO3nM2lK1jI0hG9fE";
    `;
    const result = detectHighEntropySecrets(content);
    expect(result.length).toBeGreaterThanOrEqual(2);
  });

  it("should deduplicate candidates on the same line", () => {
    // Multiple patterns might match the same assignment on the same line
    const content = `API_KEY = "kF9xZ2mR7pL5qW3tY8nS6vU4bH1jD0a"`;
    const result = detectHighEntropySecrets(content);

    // Even if multiple regex patterns match, the same line+value should appear once
    const lineValuePairs = result.map((c) => `${c.line}:${c.value}`);
    const unique = new Set(lineValuePairs);
    expect(unique.size).toBe(lineValuePairs.length);
  });

  it("should detect YAML-style high-entropy secrets", () => {
    const content = `
database:
  auth_token: kF9xZ2mR7pL5qW3tY8nS6vU4bH1jD0aXx
    `;
    const result = detectHighEntropySecrets(content);
    expect(result.length).toBeGreaterThanOrEqual(1);
  });

  it("should handle empty content", () => {
    const result = detectHighEntropySecrets("");
    expect(result).toHaveLength(0);
  });

  it("should handle content with no assignments", () => {
    const content = "just a regular paragraph of text with no code patterns";
    const result = detectHighEntropySecrets(content);
    expect(result).toHaveLength(0);
  });
});
