import { describe, it, expect, beforeAll } from "vitest";
import {
  isLanguageSupported,
  highlightCodeSync,
  initHighlighter,
} from "../../../../src/cli/renderer/syntax.js";

describe("syntax highlighting", () => {
  it("should recognize supported languages", () => {
    expect(isLanguageSupported("typescript")).toBe(true);
    expect(isLanguageSupported("ts")).toBe(true);
    expect(isLanguageSupported("python")).toBe(true);
    expect(isLanguageSupported("py")).toBe(true);
    expect(isLanguageSupported("bash")).toBe(true);
    expect(isLanguageSupported("sh")).toBe(true);
  });

  it("should reject unsupported languages", () => {
    expect(isLanguageSupported("brainfuck")).toBe(false);
    expect(isLanguageSupported("")).toBe(false);
  });

  it("highlightCodeSync should return plain text when not initialized", () => {
    const code = "const x = 1;";
    const result = highlightCodeSync(code, "typescript");
    expect(result).toBe(code); // No highlighter loaded yet
  });

  describe("after initialization", () => {
    beforeAll(async () => {
      await initHighlighter();
    }, 10000);

    it("highlightCodeSync should return ANSI-colored output", () => {
      const code = "const x = 1;";
      const result = highlightCodeSync(code, "typescript");
      // Should contain ANSI escape codes
      expect(result).toContain("\x1b[");
    });

    it("highlightCodeSync should fallback for unsupported languages", () => {
      const code = "hello world";
      const result = highlightCodeSync(code, "brainfuck");
      expect(result).toBe(code);
    });
  });
});
