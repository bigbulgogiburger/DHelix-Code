/**
 * Unit tests for `src/plasmids/schema.ts`.
 *
 * Covers:
 *  - `plasmidIdSchema` accept/reject matrix (length, charset, hyphen rules).
 *  - `expectationSchema` DSL (every prefix, `not:` toggle, `not-contains` sugar).
 *  - `plasmidMetadataSchema` happy-path + every cross-field refinement.
 *  - `evalCaseSchema` + `evalCasesSchema` duplicate detection.
 *  - `hasLegacyUntieredCases` helper.
 */

import { describe, expect, it } from "vitest";

import {
  evalCaseSchema,
  evalCasesSchema,
  expectationSchema,
  hasLegacyUntieredCases,
  plasmidIdSchema,
  plasmidMetadataSchema,
} from "../../../src/plasmids/schema.js";
import type { PlasmidEvalCase } from "../../../src/plasmids/types.js";

const VALID_METADATA = {
  id: "alpha-helix",
  name: "Alpha Helix",
  description: "primary helix plasmid",
  version: "1.2.3",
  tier: "L2",
  created: "2026-01-01T00:00:00Z",
  updated: "2026-01-02T00:00:00Z",
};

describe("plasmidIdSchema", () => {
  it.each(["abc", "dna-one", "a1b2", "alpha-helix-42"])(
    "accepts %s",
    (id) => {
      expect(() => plasmidIdSchema.parse(id)).not.toThrow();
    },
  );

  it.each([
    ["Abc", "uppercase"],
    ["1abc", "leading digit"],
    ["ab", "too short"],
    ["a".repeat(65), "too long"],
    ["has--dash", "consecutive hyphens"],
    ["end-", "trailing hyphen"],
    ["has_underscore", "underscore"],
    ["has space", "space"],
  ])("rejects %s (%s)", (id) => {
    expect(() => plasmidIdSchema.parse(id)).toThrow();
  });
});

describe("expectationSchema", () => {
  it("parses each prefix", () => {
    for (const prefix of [
      "pattern",
      "semver",
      "ast-match",
      "contains",
      "equals",
      "gte",
      "lte",
    ]) {
      const parsed = expectationSchema.parse(`${prefix}:value`);
      expect(parsed.prefix).toBe(prefix);
      expect(parsed.value).toBe("value");
      expect(parsed.negated).toBe(false);
    }
  });

  it("`not:` prefix toggles negated", () => {
    const parsed = expectationSchema.parse("not:contains:foo");
    expect(parsed.prefix).toBe("contains");
    expect(parsed.value).toBe("foo");
    expect(parsed.negated).toBe(true);
  });

  it("`not-contains` sugar sets negated=true without `not:`", () => {
    const parsed = expectationSchema.parse("not-contains:bar");
    expect(parsed.prefix).toBe("not-contains");
    expect(parsed.negated).toBe(true);
  });

  it("rejects unknown prefix", () => {
    expect(() => expectationSchema.parse("unknown:value")).toThrow();
  });

  it("rejects missing value", () => {
    expect(() => expectationSchema.parse("contains:")).toThrow();
  });

  it("preserves colons inside the value", () => {
    const parsed = expectationSchema.parse("equals:a:b:c");
    expect(parsed.value).toBe("a:b:c");
  });
});

describe("plasmidMetadataSchema", () => {
  it("accepts the minimal valid metadata", () => {
    const parsed = plasmidMetadataSchema.parse(VALID_METADATA);
    expect(parsed.id).toBe("alpha-helix");
    expect(parsed.scope).toBe("local"); // default
    expect(parsed.privacy).toBe("cloud-ok"); // default
  });

  it("rejects unknown top-level keys (strict)", () => {
    expect(() =>
      plasmidMetadataSchema.parse({ ...VALID_METADATA, unexpected: true }),
    ).toThrow();
  });

  it("rejects updated < created", () => {
    expect(() =>
      plasmidMetadataSchema.parse({
        ...VALID_METADATA,
        created: "2026-06-01T00:00:00Z",
        updated: "2026-01-01T00:00:00Z",
      }),
    ).toThrow(/updated must be >= created/);
  });

  it("foundational=true requires tier=L4", () => {
    expect(() =>
      plasmidMetadataSchema.parse({
        ...VALID_METADATA,
        foundational: true,
        tier: "L2",
      }),
    ).toThrow(/foundational: true requires tier: L4/);
    expect(() =>
      plasmidMetadataSchema.parse({
        ...VALID_METADATA,
        foundational: true,
        tier: "L4",
      }),
    ).not.toThrow();
  });

  it("extends must not equal own id", () => {
    expect(() =>
      plasmidMetadataSchema.parse({
        ...VALID_METADATA,
        extends: "alpha-helix",
      }),
    ).toThrow(/must not reference the plasmid's own id/);
  });

  it("name too long → reject", () => {
    expect(() =>
      plasmidMetadataSchema.parse({ ...VALID_METADATA, name: "x".repeat(121) }),
    ).toThrow();
  });

  it("too many tags → reject", () => {
    expect(() =>
      plasmidMetadataSchema.parse({
        ...VALID_METADATA,
        tags: Array.from({ length: 13 }, (_, i) => `tag-${i}`),
      }),
    ).toThrow();
  });

  it("non-kebab tag → reject", () => {
    expect(() =>
      plasmidMetadataSchema.parse({ ...VALID_METADATA, tags: ["UpperCase"] }),
    ).toThrow();
  });

  it("invalid semver → reject", () => {
    expect(() =>
      plasmidMetadataSchema.parse({ ...VALID_METADATA, version: "1.2" }),
    ).toThrow();
  });

  it("accepts requires/conflicts arrays", () => {
    const parsed = plasmidMetadataSchema.parse({
      ...VALID_METADATA,
      requires: ["a-one", "b-two"],
      conflicts: ["c-three"],
    });
    expect(parsed.requires).toEqual(["a-one", "b-two"]);
    expect(parsed.conflicts).toEqual(["c-three"]);
  });
});

describe("evalCaseSchema / evalCasesSchema", () => {
  const VALID_CASE = {
    id: "case-1",
    description: "basic case",
    input: "hello",
    expectations: ["contains:hello"],
  };

  it("accepts a minimal case", () => {
    const parsed = evalCaseSchema.parse(VALID_CASE);
    expect(parsed.id).toBe("case-1");
    expect(parsed.expectations).toHaveLength(1);
  });

  it("rejects empty expectations array", () => {
    expect(() =>
      evalCaseSchema.parse({ ...VALID_CASE, expectations: [] }),
    ).toThrow(/at least one expectation/);
  });

  it("rejects duplicate ids across cases", () => {
    expect(() =>
      evalCasesSchema.parse([VALID_CASE, { ...VALID_CASE, description: "dup" }]),
    ).toThrow(/duplicate eval case id/);
  });

  it("hasLegacyUntieredCases() detects missing tier", () => {
    const noTier: PlasmidEvalCase = {
      id: "a",
      description: "x",
      input: "i",
      expectations: [{ prefix: "contains", value: "x", negated: false }],
    };
    const withTier: PlasmidEvalCase = { ...noTier, id: "b", tier: "L2" };
    expect(hasLegacyUntieredCases([noTier, withTier])).toBe(true);
    expect(hasLegacyUntieredCases([withTier])).toBe(false);
  });
});
