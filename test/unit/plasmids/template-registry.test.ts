/**
 * template-registry — unit tests (Team 5, P-1.4 §5).
 *
 * Exercises:
 *   - static TEMPLATE_MANIFEST invariants (count, layers, ids)
 *   - list() / get() / forTier()
 *   - loadBody() against the repo's `src/plasmids/templates/` tree
 *   - validateTemplateId() happy + every failure branch
 *   - frontmatter structural validity of every shipped .md file
 */

import { readFile } from "node:fs/promises";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import {
  TEMPLATE_MANIFEST,
  createTemplateRegistry,
  validateTemplateId,
  type TemplateManifestEntry,
} from "../../../src/plasmids/template-registry.js";

// Resolve the templates root relative to this test file so the suite works
// regardless of the shell cwd (vitest typically runs from repo root, but CI
// shards may not). `__dirname` is not available in ESM; derive it.
const here = path.dirname(fileURLToPath(import.meta.url));
const TEMPLATES_ROOT = path.resolve(
  here,
  "../../../src/plasmids/templates",
);

// Required frontmatter placeholders each template must expose for interpolation
// by the Team-4 generator.
const REQUIRED_FRONTMATTER_KEYS = [
  "id",
  "name",
  "description",
  "version",
  "scope",
  "privacy",
  "locale",
  "created",
  "updated",
] as const;

function findEntry(id: string): TemplateManifestEntry {
  const entry = TEMPLATE_MANIFEST.find((e) => e.id === id);
  if (!entry) throw new Error(`manifest missing id: ${id}`);
  return entry;
}

describe("TEMPLATE_MANIFEST", () => {
  it("ships exactly 10 templates", () => {
    expect(TEMPLATE_MANIFEST).toHaveLength(10);
  });

  it("has unique ids", () => {
    const ids = new Set<string>();
    for (const e of TEMPLATE_MANIFEST) {
      expect(ids.has(e.id), `duplicate id: ${e.id}`).toBe(false);
      ids.add(e.id);
    }
  });

  it("groups entries by the expected layer distribution", () => {
    const countBy = (layer: string): number =>
      TEMPLATE_MANIFEST.filter((e) => e.layer === layer).length;
    expect(countBy("primitives")).toBe(4);
    expect(countBy("patterns")).toBe(3);
    expect(countBy("industry")).toBe(3);
  });

  it("flags only L4 industry entries as foundational", () => {
    for (const e of TEMPLATE_MANIFEST) {
      if (e.tier === "L4") {
        expect(e.foundational, `${e.id} L4 must be foundational`).toBe(true);
      } else {
        expect(e.foundational, `${e.id} non-L4 must not be foundational`).toBe(
          false,
        );
      }
    }
  });

  it("declares the two expected L4 foundational industry templates", () => {
    const foundational = TEMPLATE_MANIFEST.filter((e) => e.foundational);
    const ids = foundational.map((e) => e.id).sort();
    expect(ids).toEqual(["foundational-legal", "foundational-security"]);
    for (const e of foundational) {
      expect(e.layer).toBe("industry");
      expect(e.tier).toBe("L4");
    }
  });

  it("uses POSIX separators in relativePath", () => {
    for (const e of TEMPLATE_MANIFEST) {
      expect(e.relativePath.includes("\\")).toBe(false);
      expect(e.relativePath.startsWith(`${e.layer}/`)).toBe(true);
    }
  });
});

describe("createTemplateRegistry", () => {
  it("rejects a non-absolute root path", () => {
    expect(() =>
      createTemplateRegistry({ templatesRoot: "relative/path" }),
    ).toThrow(/absolute path/i);
  });

  const registry = createTemplateRegistry({ templatesRoot: TEMPLATES_ROOT });

  it("list() returns the static manifest", () => {
    expect(registry.list()).toBe(TEMPLATE_MANIFEST);
  });

  it("get(id) resolves known templates and returns null for unknown", () => {
    expect(registry.get("empty")).toEqual(findEntry("empty"));
    expect(registry.get("does-not-exist")).toBeNull();
  });

  it("forTier() filters deterministically", () => {
    const l1 = registry.forTier("L1");
    expect(l1).toHaveLength(4);
    expect(l1.every((e) => e.tier === "L1")).toBe(true);

    const l4 = registry.forTier("L4");
    expect(l4).toHaveLength(2);
    expect(l4.every((e) => e.tier === "L4" && e.foundational)).toBe(true);

    expect(registry.forTier("L2")).toHaveLength(3);
    expect(registry.forTier("L3")).toHaveLength(1);
  });

  it("loadBody() reads the markdown body for a known template", async () => {
    const body = await registry.loadBody("empty");
    expect(body).not.toBeNull();
    expect(body!.startsWith("---\n")).toBe(true);
    // placeholder substitution targets survived to disk
    expect(body!).toContain("${id}");
    expect(body!).toContain("${name}");
  });

  it("loadBody() returns null for unknown ids", async () => {
    const body = await registry.loadBody("no-such-template");
    expect(body).toBeNull();
  });

  it("loadBody() honours AbortSignal", async () => {
    const ac = new AbortController();
    ac.abort();
    await expect(registry.loadBody("empty", ac.signal)).rejects.toMatchObject({
      name: expect.stringMatching(/AbortError/i),
    });
  });
});

describe("validateTemplateId", () => {
  it("accepts kebab-case ids within length bounds", () => {
    expect(validateTemplateId("empty")).toEqual({ valid: true });
    expect(validateTemplateId("korean-code-review")).toEqual({ valid: true });
    expect(validateTemplateId("abc")).toEqual({ valid: true });
  });

  it("rejects non-strings / empty / too-short / too-long", () => {
    expect(validateTemplateId("").valid).toBe(false);
    expect(validateTemplateId("ab").valid).toBe(false);
    expect(validateTemplateId("a".repeat(65)).valid).toBe(false);
  });

  it("rejects consecutive hyphens", () => {
    const r = validateTemplateId("foo--bar");
    expect(r.valid).toBe(false);
    expect(r.reason).toMatch(/consecutive/);
  });

  it("rejects non-kebab-case formats", () => {
    expect(validateTemplateId("Empty").valid).toBe(false);
    expect(validateTemplateId("1abc").valid).toBe(false);
    expect(validateTemplateId("abc_def").valid).toBe(false);
    expect(validateTemplateId("-abc").valid).toBe(false);
    expect(validateTemplateId("abc-").valid).toBe(false);
  });

  it("rejects reserved prefixes", () => {
    for (const prefix of ["dhelix-", "plasmid-", "system-", "internal-"]) {
      const r = validateTemplateId(`${prefix}foo`);
      expect(r.valid).toBe(false);
      expect(r.reason).toMatch(/reserved/);
    }
  });
});

describe("shipped template files — structural frontmatter check", () => {
  for (const entry of TEMPLATE_MANIFEST) {
    it(`${entry.id} has a valid frontmatter block`, async () => {
      const abs = path.join(TEMPLATES_ROOT, ...entry.relativePath.split("/"));
      const raw = await readFile(abs, "utf-8");

      // Begin and end fence
      expect(raw.startsWith("---\n")).toBe(true);
      const closingIdx = raw.indexOf("\n---", 4);
      expect(closingIdx).toBeGreaterThan(0);

      const front = raw.slice(4, closingIdx);
      for (const key of REQUIRED_FRONTMATTER_KEYS) {
        expect(front.includes(`${key}:`), `missing key "${key}" in ${entry.id}`)
          .toBe(true);
      }

      // Body exists beyond the second fence
      const body = raw.slice(closingIdx + 4).trim();
      expect(body.length).toBeGreaterThan(0);

      // Each template ships at least one eval case section per §5.
      expect(body.toLowerCase()).toContain("## eval cases");
    });
  }
});
