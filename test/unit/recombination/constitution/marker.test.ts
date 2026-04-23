/**
 * Unit tests for `src/recombination/constitution/marker.ts`.
 *
 * Covers:
 *   - Regex acceptance / rejection for BEGIN / END markers.
 *   - `marker-id` length cap and kebab form (both `a/b` and legacy `a` shapes).
 *   - `buildMarkerId` truncation behaviour.
 */

import { describe, expect, it } from "vitest";

import {
  MARKER_ID_MAX_LENGTH,
  buildMarkerId,
  isValidMarkerId,
  kebab,
  parseBeginLine,
  parseEndLine,
  renderBeginMarker,
  renderEndMarker,
} from "../../../../src/recombination/constitution/marker.js";

describe("marker — isValidMarkerId", () => {
  it("accepts kebab <plasmid-id>/<slug> form", () => {
    expect(isValidMarkerId("owasp-gate/security-posture")).toBe(true);
    expect(isValidMarkerId("team-4/i9-invariance")).toBe(true);
  });

  it("accepts legacy single-slug form", () => {
    expect(isValidMarkerId("core-principles")).toBe(true);
    expect(isValidMarkerId("foo")).toBe(true);
  });

  it("rejects uppercase, spaces, leading hyphen, trailing hyphen", () => {
    expect(isValidMarkerId("Foo")).toBe(false);
    expect(isValidMarkerId("foo bar")).toBe(false);
    expect(isValidMarkerId("-foo")).toBe(false);
    expect(isValidMarkerId("foo-")).toBe(false);
    expect(isValidMarkerId("foo/bar-")).toBe(false);
    expect(isValidMarkerId("")).toBe(false);
  });

  it("rejects marker-ids longer than the cap", () => {
    const tooLong = "a".repeat(MARKER_ID_MAX_LENGTH + 1);
    expect(isValidMarkerId(tooLong)).toBe(false);
  });

  it("rejects nested slashes", () => {
    expect(isValidMarkerId("a/b/c")).toBe(false);
  });
});

describe("marker — parseBeginLine / parseEndLine", () => {
  it("parses canonical BEGIN and END lines", () => {
    expect(parseBeginLine("<!-- BEGIN plasmid-derived: owasp-gate/posture -->")).toBe(
      "owasp-gate/posture",
    );
    expect(parseEndLine("<!-- END plasmid-derived: owasp-gate/posture -->")).toBe(
      "owasp-gate/posture",
    );
  });

  it("tolerates leading indent and trailing whitespace", () => {
    expect(parseBeginLine("   <!-- BEGIN plasmid-derived: foo -->   ")).toBe("foo");
  });

  it("returns null for non-marker lines", () => {
    expect(parseBeginLine("# Heading")).toBeNull();
    expect(parseBeginLine("<!-- just a comment -->")).toBeNull();
    expect(parseEndLine("some text")).toBeNull();
  });

  it("returns null for marker lines with invalid ids", () => {
    expect(parseBeginLine("<!-- BEGIN plasmid-derived: Bad_Id -->")).toBeNull();
  });

  it("does not confuse BEGIN and END", () => {
    expect(parseBeginLine("<!-- END plasmid-derived: foo -->")).toBeNull();
    expect(parseEndLine("<!-- BEGIN plasmid-derived: foo -->")).toBeNull();
  });
});

describe("marker — render helpers", () => {
  it("emits canonical strings", () => {
    expect(renderBeginMarker("a/b")).toBe("<!-- BEGIN plasmid-derived: a/b -->");
    expect(renderEndMarker("a/b")).toBe("<!-- END plasmid-derived: a/b -->");
  });

  it("round-trips through parse", () => {
    const id = "team-4/i9-check";
    expect(parseBeginLine(renderBeginMarker(id))).toBe(id);
    expect(parseEndLine(renderEndMarker(id))).toBe(id);
  });
});

describe("marker — kebab / buildMarkerId", () => {
  it("kebabs arbitrary text", () => {
    expect(kebab("Hello World!")).toBe("hello-world");
    expect(kebab("  Some_thing  ")).toBe("some-thing");
    expect(kebab("")).toBe("section");
  });

  it("builds plasmid/slug marker-ids", () => {
    expect(buildMarkerId("owasp-gate", "Security Posture")).toBe(
      "owasp-gate/security-posture",
    );
  });

  it("truncates slug to fit the 96-char cap", () => {
    const longTitle = "x".repeat(200);
    const id = buildMarkerId("owasp-gate", longTitle);
    expect(id.length).toBeLessThanOrEqual(MARKER_ID_MAX_LENGTH);
    expect(isValidMarkerId(id)).toBe(true);
    expect(id.startsWith("owasp-gate/")).toBe(true);
  });
});
