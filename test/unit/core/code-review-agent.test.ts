import { describe, it, expect } from "vitest";
import { buildReviewPrompt, parseReviewResult } from "../../../src/core/code-review-agent.js";

// =============================================================================
// buildReviewPrompt
// =============================================================================

describe("buildReviewPrompt", () => {
  it("should include the diff in the prompt", () => {
    const diff = "--- a/file.ts\n+++ b/file.ts\n@@ -1 +1 @@\n-const x = 1;\n+const x = 2;";
    const prompt = buildReviewPrompt(diff);

    expect(prompt).toContain("--- BEGIN DIFF ---");
    expect(prompt).toContain("--- END DIFF ---");
    expect(prompt).toContain(diff);
  });

  it("should include Generator-Critic pattern instructions", () => {
    const prompt = buildReviewPrompt("diff content");

    expect(prompt).toContain("Generator");
    expect(prompt).toContain("Critic");
    expect(prompt).toContain("false positive");
  });

  it("should include severity guide", () => {
    const prompt = buildReviewPrompt("diff content");

    expect(prompt).toContain("critical");
    expect(prompt).toContain("high");
    expect(prompt).toContain("medium");
    expect(prompt).toContain("low");
  });

  it("should include category guide", () => {
    const prompt = buildReviewPrompt("diff content");

    expect(prompt).toContain("security");
    expect(prompt).toContain("correctness");
    expect(prompt).toContain("style");
    expect(prompt).toContain("performance");
  });

  it("should include focus areas when provided", () => {
    const prompt = buildReviewPrompt("diff", ["security", "performance"]);

    expect(prompt).toContain("Focus especially on these areas: security, performance");
  });

  it("should not include focus section when no focus areas", () => {
    const prompt = buildReviewPrompt("diff");

    expect(prompt).not.toContain("Focus especially on");
  });

  it("should not include focus section for empty focus areas", () => {
    const prompt = buildReviewPrompt("diff", []);

    expect(prompt).not.toContain("Focus especially on");
  });

  it("should include expected JSON output format", () => {
    const prompt = buildReviewPrompt("diff");

    expect(prompt).toContain('"severity"');
    expect(prompt).toContain('"category"');
    expect(prompt).toContain('"message"');
    expect(prompt).toContain("SUMMARY:");
    expect(prompt).toContain("SCORE:");
  });
});

// =============================================================================
// parseReviewResult
// =============================================================================

describe("parseReviewResult", () => {
  it("should parse well-formed LLM output with issues, summary, and score", () => {
    const llmOutput = [
      '{"severity": "high", "category": "correctness", "message": "Missing null check on user input", "line": 42, "file": "src/handler.ts"}',
      '{"severity": "medium", "category": "style", "message": "Variable name too short", "line": 10, "file": "src/utils.ts"}',
      "SUMMARY: Code has a correctness issue and a style concern.",
      "SCORE: 65",
    ].join("\n");

    const result = parseReviewResult(llmOutput);

    expect(result.issues).toHaveLength(2);
    expect(result.issues[0]).toEqual({
      severity: "high",
      category: "correctness",
      message: "Missing null check on user input",
      line: 42,
      file: "src/handler.ts",
    });
    expect(result.issues[1]).toEqual({
      severity: "medium",
      category: "style",
      message: "Variable name too short",
      line: 10,
      file: "src/utils.ts",
    });
    expect(result.summary).toBe("Code has a correctness issue and a style concern.");
    expect(result.score).toBe(65);
  });

  it("should handle output with no issues", () => {
    const llmOutput = ["SUMMARY: Code looks clean, no issues found.", "SCORE: 95"].join("\n");

    const result = parseReviewResult(llmOutput);

    expect(result.issues).toHaveLength(0);
    expect(result.summary).toBe("Code looks clean, no issues found.");
    expect(result.score).toBe(95);
  });

  it("should generate fallback summary when none provided", () => {
    const llmOutput =
      '{"severity": "critical", "category": "security", "message": "SQL injection vulnerability"}';

    const result = parseReviewResult(llmOutput);

    expect(result.summary).toContain("1 issue");
    expect(result.summary).toContain("1 critical");
  });

  it("should use default score of 50 when not provided", () => {
    const llmOutput =
      '{"severity": "low", "category": "style", "message": "Missing trailing comma"}';

    const result = parseReviewResult(llmOutput);

    expect(result.score).toBe(50);
  });

  it("should skip malformed JSON lines", () => {
    const llmOutput = [
      '{"severity": "high", "category": "correctness", "message": "Valid issue"}',
      "This is not JSON",
      "{invalid json}",
      '{"severity": "low", "category": "style", "message": "Another valid issue"}',
      "SUMMARY: Two issues found.",
      "SCORE: 70",
    ].join("\n");

    const result = parseReviewResult(llmOutput);

    expect(result.issues).toHaveLength(2);
    expect(result.issues[0].message).toBe("Valid issue");
    expect(result.issues[1].message).toBe("Another valid issue");
  });

  it("should skip issues with invalid severity", () => {
    const llmOutput = '{"severity": "extreme", "category": "security", "message": "Bad severity"}';

    const result = parseReviewResult(llmOutput);

    expect(result.issues).toHaveLength(0);
  });

  it("should skip issues with invalid category", () => {
    const llmOutput = '{"severity": "high", "category": "readability", "message": "Bad category"}';

    const result = parseReviewResult(llmOutput);

    expect(result.issues).toHaveLength(0);
  });

  it("should skip issues with empty message", () => {
    const llmOutput = '{"severity": "high", "category": "correctness", "message": ""}';

    const result = parseReviewResult(llmOutput);

    expect(result.issues).toHaveLength(0);
  });

  it("should handle issues without line and file fields", () => {
    const llmOutput =
      '{"severity": "medium", "category": "performance", "message": "Consider caching"}';

    const result = parseReviewResult(llmOutput);

    expect(result.issues).toHaveLength(1);
    expect(result.issues[0].line).toBeUndefined();
    expect(result.issues[0].file).toBeUndefined();
  });

  it("should handle issues with null line and file", () => {
    const llmOutput =
      '{"severity": "medium", "category": "performance", "message": "General perf concern", "line": null, "file": null}';

    const result = parseReviewResult(llmOutput);

    expect(result.issues).toHaveLength(1);
    expect(result.issues[0].line).toBeUndefined();
    expect(result.issues[0].file).toBeUndefined();
  });

  it("should clamp score to valid range (0-100)", () => {
    const llmOutput = "SCORE: 150";

    const result = parseReviewResult(llmOutput);

    // Invalid score (>100) should keep default of 50
    expect(result.score).toBe(50);
  });

  it("should handle empty input", () => {
    const result = parseReviewResult("");

    expect(result.issues).toHaveLength(0);
    expect(result.summary).toBe("No issues found in the reviewed code.");
    expect(result.score).toBe(50);
  });

  it("should generate correct fallback summary with mixed severities", () => {
    const llmOutput = [
      '{"severity": "critical", "category": "security", "message": "XSS vulnerability"}',
      '{"severity": "high", "category": "correctness", "message": "Off-by-one error"}',
      '{"severity": "medium", "category": "style", "message": "Inconsistent naming"}',
      '{"severity": "low", "category": "performance", "message": "Unnecessary copy"}',
    ].join("\n");

    const result = parseReviewResult(llmOutput);

    expect(result.summary).toContain("4 issue(s)");
    expect(result.summary).toContain("1 critical");
    expect(result.summary).toContain("1 high");
    expect(result.summary).toContain("1 medium");
    expect(result.summary).toContain("1 low");
  });

  it("should handle SCORE: 0 correctly", () => {
    const llmOutput = ["SUMMARY: Terrible code.", "SCORE: 0"].join("\n");

    const result = parseReviewResult(llmOutput);

    expect(result.score).toBe(0);
  });

  it("should handle SCORE: 100 correctly", () => {
    const llmOutput = ["SUMMARY: Perfect code.", "SCORE: 100"].join("\n");

    const result = parseReviewResult(llmOutput);

    expect(result.score).toBe(100);
  });
});
