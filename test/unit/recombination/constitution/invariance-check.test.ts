/**
 * Unit tests for `src/recombination/constitution/invariance-check.ts`.
 *
 * Covers:
 *   - `normalizeUserText` — idempotence, trailing-whitespace, CRLF normalisation.
 *   - `validateUpdateTargets` — rejects update/remove ops whose marker-id is absent.
 *   - `verifyUserAreaInvariance` — multiset-equality on hashed user sections.
 */

import { describe, expect, it } from "vitest";

import {
  ReorgInvalidUpdateTargetError,
  ReorgUserAreaViolationError,
} from "../../../../src/recombination/constitution/errors.js";
import {
  hashUserText,
  normalizeUserText,
  validateUpdateTargets,
  verifyUserAreaInvariance,
} from "../../../../src/recombination/constitution/invariance-check.js";
import { parse } from "../../../../src/recombination/constitution/section-tree.js";
import type { ReorgPlan } from "../../../../src/recombination/types.js";

function plan(ops: ReorgPlan["ops"]): ReorgPlan {
  return {
    ops,
    keptMarkerIds: [],
    preReorgContentHash: "h1",
    intentGraphHash: "h2",
    fallbackTier: "deterministic-only",
  };
}

describe("normalizeUserText", () => {
  it("is idempotent", () => {
    const s = "hello\nworld\n";
    expect(normalizeUserText(normalizeUserText(s))).toBe(normalizeUserText(s));
  });

  it("trims trailing whitespace per line", () => {
    expect(normalizeUserText("a  \nb\t\n")).toBe("a\nb");
  });

  it("collapses CRLF to LF", () => {
    expect(normalizeUserText("a\r\nb\r\n")).toBe("a\nb");
  });

  it("produces identical hashes for equivalent content", () => {
    expect(hashUserText("a  \nb\n")).toBe(hashUserText("a\nb"));
  });
});

describe("validateUpdateTargets", () => {
  const existingMarkers = new Set(["foo/one", "foo/two"]);

  it("accepts plans whose update/remove targets exist", () => {
    expect(() =>
      validateUpdateTargets(
        plan([
          { kind: "update", markerId: "foo/one", heading: "h", body: "b" },
          { kind: "remove", markerId: "foo/two", heading: "", body: "" },
          {
            kind: "insert",
            markerId: "foo/new",
            heading: "h",
            body: "b",
          },
        ]),
        existingMarkers,
      ),
    ).not.toThrow();
  });

  it("throws REORG_INVALID_UPDATE_TARGET when update targets a missing marker", () => {
    expect(() =>
      validateUpdateTargets(
        plan([
          { kind: "update", markerId: "nope/ghost", heading: "h", body: "b" },
        ]),
        existingMarkers,
      ),
    ).toThrow(ReorgInvalidUpdateTargetError);
  });

  it("reports all violations in `.context.violations`", () => {
    try {
      validateUpdateTargets(
        plan([
          { kind: "update", markerId: "a/ghost", heading: "", body: "" },
          { kind: "remove", markerId: "b/ghost", heading: "", body: "" },
        ]),
        existingMarkers,
      );
      throw new Error("should have thrown");
    } catch (err) {
      if (!(err instanceof ReorgInvalidUpdateTargetError)) throw err;
      expect(err.code).toBe("REORG_INVALID_UPDATE_TARGET");
      const ctx = err.context as { violations: ReadonlyArray<{ markerId: string }> };
      expect(ctx.violations.map((v) => v.markerId).sort()).toEqual([
        "a/ghost",
        "b/ghost",
      ]);
    }
  });
});

describe("verifyUserAreaInvariance", () => {
  const baseSrc = [
    "# Dhelix Code",
    "",
    "User preamble.",
    "<!-- BEGIN plasmid-derived: foo/one -->",
    "body1",
    "<!-- END plasmid-derived: foo/one -->",
    "Between markers.",
    "<!-- BEGIN plasmid-derived: foo/two -->",
    "body2",
    "<!-- END plasmid-derived: foo/two -->",
    "",
  ].join("\n");

  it("accepts when user regions are byte-identical", () => {
    const before = parse(baseSrc);
    const after = parse(baseSrc);
    expect(() => verifyUserAreaInvariance(before, after)).not.toThrow();
  });

  it("accepts when only marker bodies change", () => {
    const mutated = baseSrc.replace("body1", "rewritten-body1");
    expect(() =>
      verifyUserAreaInvariance(parse(baseSrc), parse(mutated)),
    ).not.toThrow();
  });

  it("accepts when a new marker is inserted adjacent to existing text", () => {
    const mutated = baseSrc.replace(
      "<!-- END plasmid-derived: foo/two -->",
      [
        "<!-- END plasmid-derived: foo/two -->",
        "<!-- BEGIN plasmid-derived: foo/three -->",
        "body3",
        "<!-- END plasmid-derived: foo/three -->",
      ].join("\n"),
    );
    expect(() =>
      verifyUserAreaInvariance(parse(baseSrc), parse(mutated)),
    ).not.toThrow();
  });

  it("rejects when a user section is modified", () => {
    const mutated = baseSrc.replace("User preamble.", "Evil rewrite.");
    expect(() =>
      verifyUserAreaInvariance(parse(baseSrc), parse(mutated)),
    ).toThrow(ReorgUserAreaViolationError);
  });

  it("rejects when a user section is removed", () => {
    const mutated = baseSrc.replace("User preamble.\n", "");
    expect(() =>
      verifyUserAreaInvariance(parse(baseSrc), parse(mutated)),
    ).toThrow(ReorgUserAreaViolationError);
  });

  it("rejects when a user section is added", () => {
    const mutated = baseSrc + "\nSneaky appended paragraph.\n";
    expect(() =>
      verifyUserAreaInvariance(parse(baseSrc), parse(mutated)),
    ).toThrow(ReorgUserAreaViolationError);
  });
});
