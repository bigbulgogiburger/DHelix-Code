/**
 * Unit tests for `src/plasmids/parser.ts`.
 *
 * Covers:
 *  - Single-file parse with and without eval section.
 *  - `## Eval cases` case-insensitive matching at level 2 only.
 *  - YAML list form and `cases:` mapping form for evals.
 *  - Fenced ```yaml block stripping.
 *  - `parsePlasmidBody` helper for the two-file path.
 */

import { describe, expect, it } from "vitest";

import {
  parsePlasmidBody,
  parsePlasmidSource,
} from "../../../src/plasmids/parser.js";
import { PlasmidSchemaError } from "../../../src/plasmids/errors.js";

const BASE_META = [
  "---",
  "id: demo-one",
  "name: Demo",
  "description: d",
  "version: 1.0.0",
  "tier: L2",
  "created: 2026-01-01T00:00:00Z",
  "updated: 2026-01-01T00:00:00Z",
  "---",
].join("\n");

describe("parsePlasmidSource", () => {
  it("returns raw metadata + body when there is no eval section", () => {
    const source = `${BASE_META}\n# Body\ntext\n`;
    const parsed = parsePlasmidSource(source);
    expect(parsed.metadata.id).toBe("demo-one");
    expect(parsed.bodyWithoutEvals).toBe("# Body\ntext\n");
    expect(parsed.evalCases).toEqual([]);
  });

  it("extracts eval cases from `## Eval cases` list form", () => {
    const evals = [
      "## Eval cases",
      "- id: c-1",
      "  description: first",
      "  input: hello",
      "  expectations:",
      "    - contains:hello",
    ].join("\n");
    const source = `${BASE_META}\n# Prose\n${evals}\n`;
    const parsed = parsePlasmidSource(source);
    expect(parsed.evalCases).toHaveLength(1);
    expect(parsed.bodyWithoutEvals).toContain("# Prose");
    expect(parsed.bodyWithoutEvals).not.toContain("Eval cases");
  });

  it("extracts eval cases from `cases:` mapping form", () => {
    const evals = [
      "## Eval cases",
      "cases:",
      "  - id: c-1",
      "    description: m",
      "    input: i",
      "    expectations:",
      "      - contains:i",
    ].join("\n");
    const source = `${BASE_META}\n${evals}\n`;
    const parsed = parsePlasmidSource(source);
    expect(parsed.evalCases).toHaveLength(1);
  });

  it("is case-insensitive for the heading", () => {
    const evals = [
      "## EVAL CASES",
      "- id: c-1",
      "  description: m",
      "  input: i",
      "  expectations:",
      "    - contains:i",
    ].join("\n");
    const source = `${BASE_META}\n${evals}\n`;
    const parsed = parsePlasmidSource(source);
    expect(parsed.evalCases).toHaveLength(1);
  });

  it("strips ```yaml fenced blocks", () => {
    const evals = [
      "## Eval cases",
      "```yaml",
      "- id: c-1",
      "  description: m",
      "  input: i",
      "  expectations:",
      "    - contains:i",
      "```",
    ].join("\n");
    const source = `${BASE_META}\n${evals}\n`;
    const parsed = parsePlasmidSource(source);
    expect(parsed.evalCases).toHaveLength(1);
  });

  it("stops the eval section at the next level-1/2 heading", () => {
    const src = [
      BASE_META,
      "# Prose",
      "## Eval cases",
      "- id: c-1",
      "  description: m",
      "  input: i",
      "  expectations:",
      "    - contains:i",
      "## After",
      "tail",
    ].join("\n");
    const parsed = parsePlasmidSource(src);
    expect(parsed.evalCases).toHaveLength(1);
    expect(parsed.bodyWithoutEvals).toContain("## After");
    expect(parsed.bodyWithoutEvals).toContain("tail");
  });

  it("does NOT match level-3+ headings as the eval section", () => {
    const src = [
      BASE_META,
      "# Prose",
      "### Eval cases", // too deep
      "inline text",
    ].join("\n");
    const parsed = parsePlasmidSource(src);
    expect(parsed.evalCases).toEqual([]);
  });

  it("rejects an eval section that is not a list or `cases:` mapping", () => {
    const src = [BASE_META, "## Eval cases", "foo: bar"].join("\n");
    expect(() => parsePlasmidSource(src)).toThrow(PlasmidSchemaError);
  });

  it("rejects malformed eval YAML", () => {
    const src = [BASE_META, "## Eval cases", "- id: [unbalanced"].join("\n");
    expect(() => parsePlasmidSource(src)).toThrow(PlasmidSchemaError);
  });

  it("handles an empty eval section as no cases", () => {
    const src = [BASE_META, "## Eval cases", "", "## Done"].join("\n");
    const parsed = parsePlasmidSource(src);
    expect(parsed.evalCases).toEqual([]);
  });
});

describe("parsePlasmidBody", () => {
  it("parses just the body portion (no frontmatter)", () => {
    const body = [
      "# Body",
      "## Eval cases",
      "- id: x",
      "  description: y",
      "  input: z",
      "  expectations:",
      "    - contains:z",
    ].join("\n");
    const parsed = parsePlasmidBody(body);
    expect(parsed.evalCases).toHaveLength(1);
    expect(parsed.bodyWithoutEvals).toContain("# Body");
  });
});
