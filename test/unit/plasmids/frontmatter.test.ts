/**
 * Unit tests for `src/plasmids/frontmatter.ts`.
 *
 * Covers:
 *  - Happy path: LF / CRLF / BOM / extra trailing newlines.
 *  - Missing open / close delimiters.
 *  - YAML parse failures.
 *  - Non-mapping / empty YAML roots.
 */

import { describe, expect, it } from "vitest";

import {
  parseYamlMetadata,
  splitFrontmatter,
} from "../../../src/plasmids/frontmatter.js";
import {
  PlasmidFrontmatterMissingError,
  PlasmidSchemaError,
} from "../../../src/plasmids/errors.js";

describe("splitFrontmatter", () => {
  it("splits a standard LF document", () => {
    const source = "---\nid: foo\nname: Foo\n---\n# body\n";
    const { rawMetadata, body } = splitFrontmatter(source);
    expect(rawMetadata).toBe("id: foo\nname: Foo\n");
    expect(body).toBe("# body\n");
  });

  it("handles CRLF line endings", () => {
    const source = "---\r\nid: foo\r\n---\r\n# body\r\n";
    const { rawMetadata, body } = splitFrontmatter(source);
    expect(rawMetadata).toBe("id: foo\r\n");
    expect(body).toBe("# body\r\n");
  });

  it("tolerates a UTF-8 BOM", () => {
    const source = `﻿---\nid: foo\n---\nhello`;
    const { rawMetadata, body } = splitFrontmatter(source);
    expect(rawMetadata).toBe("id: foo\n");
    expect(body).toBe("hello");
  });

  it("throws when opening delimiter is missing", () => {
    expect(() => splitFrontmatter("no delimiter here")).toThrow(
      PlasmidFrontmatterMissingError,
    );
  });

  it("throws when closing delimiter is missing", () => {
    expect(() => splitFrontmatter("---\nid: foo\nno close")).toThrow(
      PlasmidFrontmatterMissingError,
    );
  });

  it("allows flush EOF close delimiter", () => {
    const source = "---\nid: foo\n---";
    const { rawMetadata, body } = splitFrontmatter(source);
    expect(rawMetadata).toBe("id: foo\n");
    expect(body).toBe("");
  });
});

describe("parseYamlMetadata", () => {
  it("parses a simple mapping", () => {
    const parsed = parseYamlMetadata("id: foo\nname: Foo");
    expect(parsed).toEqual({ id: "foo", name: "Foo" });
  });

  it("rejects a YAML list at the root", () => {
    expect(() => parseYamlMetadata("- one\n- two")).toThrow(PlasmidSchemaError);
  });

  it("rejects a bare scalar", () => {
    expect(() => parseYamlMetadata("just-a-string")).toThrow(PlasmidSchemaError);
  });

  it("rejects empty input", () => {
    expect(() => parseYamlMetadata("")).toThrow(PlasmidSchemaError);
  });

  it("rejects malformed YAML", () => {
    expect(() => parseYamlMetadata("id: [unbalanced")).toThrow(
      PlasmidSchemaError,
    );
  });

  it("preserves nested types", () => {
    const parsed = parseYamlMetadata("tags:\n  - a\n  - b\ncount: 3");
    expect(parsed).toEqual({ tags: ["a", "b"], count: 3 });
  });
});
