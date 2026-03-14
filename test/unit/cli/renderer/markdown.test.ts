import { describe, it, expect } from "vitest";
import { renderMarkdown, hasMarkdown } from "../../../../src/cli/renderer/markdown.js";

describe("markdown rendering", () => {
  it("should detect markdown in text", () => {
    expect(hasMarkdown("# Hello")).toBe(true);
    expect(hasMarkdown("**bold**")).toBe(true);
    expect(hasMarkdown("plain text")).toBe(false);
  });

  it("should render basic markdown", () => {
    const result = renderMarkdown("**bold** text");
    expect(result).toBeTruthy();
    expect(result.length).toBeGreaterThan(0);
  });

  it("should render code blocks", () => {
    const md = "```typescript\nconst x = 1;\n```";
    const result = renderMarkdown(md);
    expect(result).toContain("const x = 1");
  });

  it("should render OSC 8 links", () => {
    const md = "[click here](https://example.com)";
    const result = renderMarkdown(md);
    // Should contain OSC 8 escape sequence
    expect(result).toContain("\x1b]8;;");
    expect(result).toContain("example.com");
  });
});
