import { describe, expect, it } from "vitest";

import {
  FALLBACK_TEMPLATE,
  renderTemplate,
  TIER_DEFAULTS,
  type TemplateContext,
} from "../../../src/plasmids/generators.js";
import type { PlasmidId } from "../../../src/plasmids/types.js";

const ctx = (overrides: Partial<TemplateContext> = {}): TemplateContext => ({
  id: "sample" as PlasmidId,
  name: "sample",
  description: "demo",
  tier: "L1",
  scope: "local",
  privacy: "cloud-ok",
  created: "2026-04-23T00:00:00.000Z",
  updated: "2026-04-23T00:00:00.000Z",
  version: "0.1.0",
  locale: "ko",
  ...overrides,
});

describe("renderTemplate", () => {
  it("interpolates known variables", () => {
    const out = renderTemplate("id=${id}, name=${name}, tier=${tier}", ctx());
    expect(out).toBe("id=sample, name=sample, tier=L1");
  });

  it("throws on unknown variable", () => {
    expect(() => renderTemplate("hello ${nope}", ctx())).toThrow(/unknown variable 'nope'/);
  });

  it("supports escape sequence for literal placeholders", () => {
    const out = renderTemplate("literal \\${id} vs ${id}", ctx());
    expect(out).toBe("literal ${id} vs sample");
  });

  it("leaves non-placeholder text intact", () => {
    const body = "# ${name}\n\n$not a placeholder\n{id} plain braces";
    const out = renderTemplate(body, ctx({ name: "owasp-gate" }));
    expect(out).toBe("# owasp-gate\n\n$not a placeholder\n{id} plain braces");
  });

  it("handles all documented variables", () => {
    const template =
      "${id}|${name}|${description}|${tier}|${scope}|${privacy}|${created}|${updated}|${version}|${locale}";
    const out = renderTemplate(template, ctx());
    expect(out).toBe(
      "sample|sample|demo|L1|local|cloud-ok|2026-04-23T00:00:00.000Z|2026-04-23T00:00:00.000Z|0.1.0|ko",
    );
  });

  it("renders FALLBACK_TEMPLATE without throwing (all vars known)", () => {
    const out = renderTemplate(FALLBACK_TEMPLATE, ctx({ name: "demo", description: "hi" }));
    expect(out).toContain("id: sample");
    expect(out).toContain('description: "hi"');
    expect(out).toContain("tier: L1");
    expect(out).toContain("scope: local");
    expect(out).toContain("privacy: cloud-ok");
    expect(out).toContain("## Intent");
    expect(out).toContain("## Behavior");
    expect(out).toContain("## Constraints");
  });
});

describe("TIER_DEFAULTS", () => {
  it("covers every PlasmidTier", () => {
    for (const tier of ["L1", "L2", "L3", "L4"] as const) {
      expect(typeof TIER_DEFAULTS[tier]).toBe("string");
      expect(TIER_DEFAULTS[tier].length).toBeGreaterThan(0);
    }
  });
});
