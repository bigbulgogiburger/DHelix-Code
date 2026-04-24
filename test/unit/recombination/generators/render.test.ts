import { describe, expect, it } from "vitest";

import { DEFAULT_HELPERS } from "../../../../src/recombination/generators/helpers.js";
import {
  finaliseSlots,
  renderTemplate,
} from "../../../../src/recombination/generators/render.js";

describe("render engine", () => {
  it("substitutes variables and dotted paths", () => {
    const out = renderTemplate("hi {{name}} / {{nested.x}}", {
      name: "Ada",
      nested: { x: 42 },
    });
    expect(out.output).toBe("hi Ada / 42");
    expect(out.slots).toEqual([]);
  });

  it("iterates via {{#each}}", () => {
    const out = renderTemplate(
      "{{#each items}}- {{this}}\n{{/each}}",
      { items: ["a", "b", "c"] },
    );
    expect(out.output).toBe("- a\n- b\n- c\n");
  });

  it("supports {{#each}} index variables", () => {
    const out = renderTemplate(
      "{{#each items}}{{@index}}:{{this}}{{#if @last}}!{{/if}} {{/each}}",
      { items: ["x", "y"] },
    );
    expect(out.output).toBe("0:x 1:y! ");
  });

  it("supports {{#if}} / {{else}}", () => {
    const tmpl = "{{#if flag}}yes{{else}}no{{/if}}";
    expect(renderTemplate(tmpl, { flag: true }).output).toBe("yes");
    expect(renderTemplate(tmpl, { flag: false }).output).toBe("no");
    expect(renderTemplate(tmpl, { flag: [] }).output).toBe("no");
    expect(renderTemplate(tmpl, { flag: ["x"] }).output).toBe("yes");
  });

  it("invokes helpers with path and literal args", () => {
    const out = renderTemplate(`{{titleCase name}} | {{join items ", "}}`, {
      name: "enforce-owasp-gate",
      items: ["a", "b"],
    });
    expect(out.output).toBe("Enforce Owasp Gate | a, b");
  });

  it("strips {{!-- comments --}}", () => {
    const out = renderTemplate(
      "hello{{!-- this is a comment --}} world",
      {},
    );
    expect(out.output).toBe("hello world");
  });

  it("extracts slot markers but renders defaults inline", () => {
    const tmpl = [
      "# title",
      "{{!-- slot:summary --}}",
      "default summary for {{name}}",
      "{{!-- /slot --}}",
      "end",
    ].join("\n");
    const out = renderTemplate(tmpl, { name: "plasmid-x" });
    expect(out.slots).toHaveLength(1);
    expect(out.slots[0]?.name).toBe("summary");
    expect(out.slots[0]?.defaultContent).toContain("default summary for plasmid-x");
    // The rendered output contains the placeholder (not the raw default yet).
    expect(out.output).toContain(out.slots[0]!.placeholder);
  });

  it("finaliseSlots falls back to defaults when replacement missing", () => {
    const out = renderTemplate(
      "{{!-- slot:foo --}}DEFAULT{{!-- /slot --}}",
      {},
    );
    const finalised = finaliseSlots(out, {});
    expect(finalised).toContain("DEFAULT");
  });

  it("finaliseSlots applies replacements per slot name", () => {
    const tmpl = [
      "{{!-- slot:alpha --}}A-DEFAULT{{!-- /slot --}}",
      "{{!-- slot:beta --}}B-DEFAULT{{!-- /slot --}}",
    ].join("\n");
    const out = renderTemplate(tmpl, {});
    const finalised = finaliseSlots(out, { alpha: "AAA", beta: "BBB" });
    expect(finalised).toContain("AAA");
    expect(finalised).toContain("BBB");
    expect(finalised).not.toContain("A-DEFAULT");
    expect(finalised).not.toContain("B-DEFAULT");
  });

  it("throws on missing variable with template id in message", () => {
    expect(() =>
      renderTemplate("{{missing.thing}}", {}, { templateId: "primitives/rule.basic.hbs" }),
    ).toThrow(/primitives\/rule\.basic\.hbs/);
  });

  it("throws on unknown helper", () => {
    expect(() =>
      renderTemplate("{{noSuchHelper foo}}", { foo: "x" }, { helpers: DEFAULT_HELPERS }),
    ).toThrow(/unknown helper/);
  });

  it("throws on {{#each}} over a non-array value", () => {
    expect(() =>
      renderTemplate("{{#each items}}x{{/each}}", { items: 42 }),
    ).toThrow(/expected array/);
  });

  it("throws on stray closing tag", () => {
    expect(() => renderTemplate("{{/if}}", {})).toThrow(/stray closing/);
  });
});
