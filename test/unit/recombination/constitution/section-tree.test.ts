/**
 * Unit tests for `src/recombination/constitution/section-tree.ts`.
 *
 * Covers:
 *   - Empty, user-only, marker-only, and mixed documents.
 *   - Back-to-back marker blocks.
 *   - Malformed markers (orphan, nested, mismatched, duplicate).
 *   - `render()` round-trip stability.
 */

import { describe, expect, it } from "vitest";

import { ConstitutionParseError } from "../../../../src/recombination/constitution/errors.js";
import {
  findMarker,
  listMarkerIds,
  listMarkerSections,
  listUserSections,
  parse,
  render,
} from "../../../../src/recombination/constitution/section-tree.js";

describe("section-tree — parse", () => {
  it("returns an empty tree for an empty string", () => {
    const tree = parse("");
    expect(tree.sections).toEqual([]);
    expect(tree.trailingNewline).toBe(false);
  });

  it("treats a document with no markers as a single user section", () => {
    const src = "# Title\n\nSome content.\n";
    const tree = parse(src);
    expect(tree.sections).toHaveLength(1);
    expect(tree.sections[0].kind).toBe("user");
    if (tree.sections[0].kind === "user") {
      expect(tree.sections[0].heading).toBe("Title");
    }
  });

  it("parses a document with a single marker between user text", () => {
    const src = [
      "# Title",
      "",
      "Preamble.",
      "<!-- BEGIN plasmid-derived: foo/bar -->",
      "## Foo Bar",
      "",
      "body",
      "<!-- END plasmid-derived: foo/bar -->",
      "Trailer.",
      "",
    ].join("\n");
    const tree = parse(src);
    expect(tree.sections.map((s) => s.kind)).toEqual(["user", "marker", "user"]);
    const marker = tree.sections[1];
    if (marker.kind !== "marker") throw new Error("expected marker");
    expect(marker.markerId).toBe("foo/bar");
    expect(marker.heading).toBe("Foo Bar");
    expect(marker.body).toBe("## Foo Bar\n\nbody");
    expect(marker.sourcePlasmidIdHint).toBe("foo");
  });

  it("handles back-to-back markers with no user content between", () => {
    const src = [
      "<!-- BEGIN plasmid-derived: a/one -->",
      "alpha",
      "<!-- END plasmid-derived: a/one -->",
      "<!-- BEGIN plasmid-derived: b/two -->",
      "beta",
      "<!-- END plasmid-derived: b/two -->",
    ].join("\n");
    const tree = parse(src);
    expect(tree.sections.map((s) => s.kind)).toEqual(["marker", "marker"]);
    expect(listMarkerIds(tree)).toEqual(new Set(["a/one", "b/two"]));
  });

  it("throws on an unterminated BEGIN marker", () => {
    const src = "<!-- BEGIN plasmid-derived: foo -->\nbody\n";
    expect(() => parse(src)).toThrow(ConstitutionParseError);
  });

  it("throws on an orphan END marker", () => {
    const src = "# Top\n<!-- END plasmid-derived: foo -->\n";
    expect(() => parse(src)).toThrow(ConstitutionParseError);
  });

  it("throws on nested BEGIN markers", () => {
    const src = [
      "<!-- BEGIN plasmid-derived: outer -->",
      "<!-- BEGIN plasmid-derived: inner -->",
      "body",
      "<!-- END plasmid-derived: inner -->",
      "<!-- END plasmid-derived: outer -->",
    ].join("\n");
    expect(() => parse(src)).toThrow(ConstitutionParseError);
  });

  it("throws on a mismatched END id", () => {
    const src = [
      "<!-- BEGIN plasmid-derived: foo -->",
      "body",
      "<!-- END plasmid-derived: bar -->",
    ].join("\n");
    expect(() => parse(src)).toThrow(/Mismatched END marker/);
  });

  it("throws on duplicate marker-ids", () => {
    const src = [
      "<!-- BEGIN plasmid-derived: foo -->",
      "a",
      "<!-- END plasmid-derived: foo -->",
      "<!-- BEGIN plasmid-derived: foo -->",
      "b",
      "<!-- END plasmid-derived: foo -->",
    ].join("\n");
    expect(() => parse(src)).toThrow(/Duplicate marker-id/);
  });
});

describe("section-tree — render round-trip", () => {
  it("round-trips an unchanged document byte-for-byte", () => {
    const src = [
      "# Dhelix",
      "",
      "User preamble.",
      "<!-- BEGIN plasmid-derived: foo/bar -->",
      "## Inside",
      "",
      "body",
      "<!-- END plasmid-derived: foo/bar -->",
      "After.",
      "",
    ].join("\n");
    const tree = parse(src);
    expect(render(tree)).toBe(src);
  });

  it("round-trips an empty document", () => {
    expect(render(parse(""))).toBe("");
  });

  it("preserves CRLF line endings", () => {
    const src = "# Hi\r\n\r\nContent.\r\n";
    const tree = parse(src);
    expect(tree.lineEnding).toBe("\r\n");
    expect(render(tree)).toBe(src);
  });
});

describe("section-tree — lookups", () => {
  const tree = parse(
    [
      "# Top",
      "<!-- BEGIN plasmid-derived: alpha/one -->",
      "a",
      "<!-- END plasmid-derived: alpha/one -->",
      "mid",
      "<!-- BEGIN plasmid-derived: beta/two -->",
      "b",
      "<!-- END plasmid-derived: beta/two -->",
      "end",
    ].join("\n"),
  );

  it("findMarker returns the marker by id", () => {
    expect(findMarker(tree, "alpha/one")?.body).toBe("a");
    expect(findMarker(tree, "nope")).toBeNull();
  });

  it("listMarkerSections lists markers in document order", () => {
    const markers = listMarkerSections(tree);
    expect(markers.map((m) => m.markerId)).toEqual(["alpha/one", "beta/two"]);
  });

  it("listUserSections lists all user blocks", () => {
    expect(listUserSections(tree).length).toBeGreaterThan(0);
  });
});
