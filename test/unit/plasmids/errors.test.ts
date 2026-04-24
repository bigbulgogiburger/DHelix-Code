/**
 * Unit tests for `src/plasmids/errors.ts`.
 *
 * Focus:
 *  - Each concrete error constructs with the correct `code` + context.
 *  - `isPlasmidError` narrows correctly for subclasses and non-plasmid errors.
 *  - `PlasmidOrphanError` distinguishes metadata vs body orphans by `kind`.
 */

import { describe, expect, it } from "vitest";

import {
  PlasmidBodyUnreadableError,
  PlasmidDuplicateIdError,
  PlasmidError,
  PlasmidFrontmatterMissingError,
  PlasmidOrphanError,
  PlasmidSchemaError,
  isPlasmidError,
} from "../../../src/plasmids/errors.js";
import { BaseError } from "../../../src/utils/error.js";

describe("PlasmidError hierarchy", () => {
  it("PlasmidSchemaError carries PLASMID_SCHEMA_INVALID code", () => {
    const err = new PlasmidSchemaError("bad", { issue: "x" });
    expect(err).toBeInstanceOf(PlasmidError);
    expect(err).toBeInstanceOf(BaseError);
    expect(err.code).toBe("PLASMID_SCHEMA_INVALID");
    expect(err.context.issue).toBe("x");
    expect(err.name).toBe("PlasmidSchemaError");
  });

  it("PlasmidFrontmatterMissingError carries PLASMID_FRONTMATTER_MISSING code", () => {
    const err = new PlasmidFrontmatterMissingError("no frontmatter");
    expect(err.code).toBe("PLASMID_FRONTMATTER_MISSING");
  });

  it("PlasmidBodyUnreadableError carries PLASMID_BODY_UNREADABLE code", () => {
    const err = new PlasmidBodyUnreadableError("EACCES");
    expect(err.code).toBe("PLASMID_BODY_UNREADABLE");
  });

  it("PlasmidDuplicateIdError carries PLASMID_DUPLICATE_ID code", () => {
    const err = new PlasmidDuplicateIdError("dup");
    expect(err.code).toBe("PLASMID_DUPLICATE_ID");
  });

  it("PlasmidOrphanError metadata kind → PLASMID_ORPHAN_METADATA", () => {
    const err = new PlasmidOrphanError("missing body", "metadata", { path: "/x" });
    expect(err.kind).toBe("metadata");
    expect(err.code).toBe("PLASMID_ORPHAN_METADATA");
    expect(err.context.kind).toBe("metadata");
    expect(err.context.path).toBe("/x");
  });

  it("PlasmidOrphanError body kind → PLASMID_ORPHAN_BODY", () => {
    const err = new PlasmidOrphanError("missing metadata", "body");
    expect(err.kind).toBe("body");
    expect(err.code).toBe("PLASMID_ORPHAN_BODY");
  });

  it("context is frozen (immutable)", () => {
    const err = new PlasmidSchemaError("x", { a: 1 });
    expect(Object.isFrozen(err.context)).toBe(true);
  });

  it("isPlasmidError narrows correctly", () => {
    expect(isPlasmidError(new PlasmidSchemaError("x"))).toBe(true);
    expect(isPlasmidError(new PlasmidOrphanError("x", "body"))).toBe(true);
    expect(isPlasmidError(new Error("generic"))).toBe(false);
    expect(isPlasmidError(null)).toBe(false);
    expect(isPlasmidError(undefined)).toBe(false);
    expect(isPlasmidError({ code: "PLASMID_SCHEMA_INVALID" })).toBe(false);
  });
});
