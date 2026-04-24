import { describe, expect, it } from "vitest";

import {
  DEFAULT_HELPERS,
  camelCase,
  ifIncludes,
  join,
  kebabCase,
  titleCase,
} from "../../../../src/recombination/generators/helpers.js";

describe("generator helpers", () => {
  describe("kebabCase", () => {
    it("converts spaces and symbols to hyphens", () => {
      expect(kebabCase("Enforce OWASP Gate")).toBe("enforce-owasp-gate");
    });
    it("handles camelCase input", () => {
      expect(kebabCase("enforceOwaspGate")).toBe("enforce-owasp-gate");
    });
    it("collapses consecutive separators", () => {
      expect(kebabCase("hello__world")).toBe("hello-world");
    });
    it("returns empty for empty-ish input", () => {
      expect(kebabCase("")).toBe("");
      expect(kebabCase("!!!")).toBe("");
    });
  });

  describe("camelCase", () => {
    it("camelises multi-word strings", () => {
      expect(camelCase("enforce owasp gate")).toBe("enforceOwaspGate");
      expect(camelCase("enforce-owasp-gate")).toBe("enforceOwaspGate");
    });
    it("returns empty for empty input", () => {
      expect(camelCase("")).toBe("");
    });
  });

  describe("titleCase", () => {
    it("capitalises each word", () => {
      expect(titleCase("enforce-owasp-gate")).toBe("Enforce Owasp Gate");
      expect(titleCase("hello world")).toBe("Hello World");
    });
  });

  describe("ifIncludes", () => {
    it("returns true when the value is present", () => {
      expect(ifIncludes([1, 2, 3], 2)).toBe(true);
    });
    it("returns false when missing", () => {
      expect(ifIncludes([1, 2, 3], 99)).toBe(false);
    });
    it("returns false for non-array inputs", () => {
      expect(ifIncludes(null, "x")).toBe(false);
      expect(ifIncludes("abc", "a")).toBe(false);
    });
  });

  describe("join", () => {
    it("joins with the provided separator", () => {
      expect(join(["a", "b", "c"], ", ")).toBe("a, b, c");
    });
    it("defaults to comma-space", () => {
      expect(join(["a", "b"])).toBe("a, b");
    });
    it("returns empty for non-arrays", () => {
      expect(join("nope")).toBe("");
    });
  });

  it("DEFAULT_HELPERS exposes the five documented helpers", () => {
    expect(Object.keys(DEFAULT_HELPERS).sort()).toEqual([
      "camelCase",
      "ifIncludes",
      "join",
      "kebabCase",
      "titleCase",
    ]);
  });
});
