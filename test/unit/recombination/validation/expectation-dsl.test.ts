/**
 * Unit tests for `src/recombination/validation/expectation-dsl.ts`.
 *
 * Covers all 7 prefix shapes, the free-text fallback, and strict-vs-non-strict
 * handling of malformed prefixed DSL.
 */
import { describe, expect, it } from "vitest";

import {
  parseExpectation,
  parseExpectations,
} from "../../../../src/recombination/validation/expectation-dsl.js";

describe("parseExpectation", () => {
  it("parses `output contains \"<str>\"`", () => {
    const r = parseExpectation('output contains "hello world"');
    expect(r).toEqual({
      kind: "output-contains",
      text: "hello world",
      original: 'output contains "hello world"',
    });
  });

  it("parses `output does NOT contain \"<str>\"`", () => {
    const r = parseExpectation('output does NOT contain "skipped"');
    expect(r.kind).toBe("output-excludes");
    if (r.kind === "output-excludes") {
      expect(r.text).toBe("skipped");
    }
  });

  it('accepts "doesn\'t" and "do not" variants for NOT', () => {
    expect(parseExpectation(`output doesn't contain "x"`).kind).toBe(
      "output-excludes",
    );
    expect(parseExpectation('output do not contain "x"').kind).toBe(
      "output-excludes",
    );
  });

  it("parses `file:<path> exists`", () => {
    const r = parseExpectation("file:src/foo.ts exists");
    expect(r).toMatchObject({
      kind: "file-exists",
      path: "src/foo.ts",
    });
  });

  it("parses `file:<path> modified`", () => {
    const r = parseExpectation("file:/abs/path.md modified");
    expect(r).toMatchObject({
      kind: "file-modified",
      path: "/abs/path.md",
    });
  });

  it("parses `exit code <n>`", () => {
    expect(parseExpectation("exit code 0")).toMatchObject({
      kind: "exit-code",
      code: 0,
    });
    expect(parseExpectation("exit code -1")).toMatchObject({
      kind: "exit-code",
      code: -1,
    });
  });

  it("parses `tool:<name>`", () => {
    expect(parseExpectation("tool:/security-scan is called")).toMatchObject({
      kind: "tool-called",
      tool: "/security-scan",
    });
    expect(parseExpectation("tool:grep")).toMatchObject({
      kind: "tool-called",
      tool: "grep",
    });
  });

  it("parses `hook:<event>`", () => {
    expect(parseExpectation("hook:PreToolUse fires")).toMatchObject({
      kind: "hook-fired",
      event: "PreToolUse",
    });
  });

  it("falls back to free-text for natural language", () => {
    const r = parseExpectation("the assistant should be polite");
    expect(r.kind).toBe("free-text");
    expect(r.original).toBe("the assistant should be polite");
  });

  it("preserves the original raw string on every shape", () => {
    const raw = 'output contains "x"';
    expect(parseExpectation(raw).original).toBe(raw);
  });

  it("downgrades malformed prefixed DSL to free-text by default", () => {
    const r = parseExpectation("output contains nothingquoted");
    expect(r.kind).toBe("free-text");
  });

  it("throws on malformed prefixed DSL in strict mode", () => {
    expect(() =>
      parseExpectation("output contains nothingquoted", { strict: true }),
    ).toThrow(/malformed/);
    expect(() => parseExpectation("exit code nope", { strict: true })).toThrow(
      /malformed/,
    );
    expect(() => parseExpectation("file: exists", { strict: true })).toThrow(
      /malformed/,
    );
    expect(() => parseExpectation("tool:", { strict: true })).toThrow(
      /malformed/,
    );
    expect(() => parseExpectation("hook:", { strict: true })).toThrow(
      /malformed/,
    );
  });

  it("returns free-text for empty input in non-strict mode", () => {
    expect(parseExpectation("   ").kind).toBe("free-text");
  });
});

describe("parseExpectations", () => {
  it("preserves input order", () => {
    const raws = [
      'output contains "a"',
      "exit code 0",
      "free form here",
    ];
    const out = parseExpectations(raws);
    expect(out.map((x) => x.kind)).toEqual([
      "output-contains",
      "exit-code",
      "free-text",
    ]);
  });
});
