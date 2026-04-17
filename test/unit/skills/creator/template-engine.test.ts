import { describe, expect, it } from "vitest";
import {
  composePushyDescription,
  renderSkillScaffold,
  renderTemplate,
} from "../../../../src/skills/creator/template-engine.js";
import type { TemplateInput } from "../../../../src/skills/creator/types.js";
import { ScaffoldError } from "../../../../src/skills/creator/types.js";

const baseInput: TemplateInput = {
  name: "demo-skill",
  description:
    "Generate a demo artifact for testing. Use when the user says things like: 'create demo', 'demo please', 'test skill'.",
  triggers: ["create demo", "demo please", "test skill"],
  antiTriggers: ["run production", "delete everything"],
  fork: false,
  requiredTools: ["Write", "Read"],
  minModelTier: "medium",
  workflowSteps: [
    "Parse the user's arguments",
    "Generate the artifact",
    "Write the result and report back",
  ],
};

describe("renderTemplate", () => {
  it("substitutes top-level variables", () => {
    const out = renderTemplate("Hello {{name}}!", { name: "world" });
    expect(out).toBe("Hello world!");
  });

  it("iterates over arrays with {{#each}}", () => {
    const out = renderTemplate("{{#each items}}- {{this}}\n{{/each}}", {
      items: ["a", "b", "c"],
    });
    expect(out).toBe("- a\n- b\n- c\n");
  });

  it("returns empty string when missing variable", () => {
    const out = renderTemplate("x={{missing}}y", {});
    expect(out).toBe("x=y");
  });

  it("provides @index inside each", () => {
    const out = renderTemplate("{{#each items}}{{@index}}:{{this}} {{/each}}", {
      items: ["a", "b"],
    });
    expect(out).toBe("0:a 1:b ");
  });

  it("ignores non-array for each", () => {
    const out = renderTemplate("{{#each notArr}}x{{/each}}", { notArr: "string" });
    expect(out).toBe("");
  });
});

describe("composePushyDescription", () => {
  it("appends Use-when clause with quoted triggers", () => {
    const d = composePushyDescription("Refactor a service", ["do it", "make it"]);
    expect(d).toContain("Refactor a service.");
    expect(d).toContain("Use when");
    expect(d).toContain(`"do it"`);
    expect(d).toContain(`"make it"`);
  });

  it("limits to first 3 triggers", () => {
    const d = composePushyDescription("x", ["a", "b", "c", "d", "e"]);
    expect(d).toContain(`"a"`);
    expect(d).toContain(`"c"`);
    expect(d).not.toContain(`"d"`);
  });

  it("strips trailing punctuation from intent", () => {
    const d = composePushyDescription("Do the thing.", ["t"]);
    expect(d.startsWith("Do the thing.")).toBe(true);
    // 중복 마침표가 없는지 확인 (원래 값에 . 이 있으면 유지, 없으면 추가)
    expect(d).not.toContain("..");
  });

  it("handles empty triggers list without crashing", () => {
    const d = composePushyDescription("solo intent", []);
    expect(d).toBe("solo intent.");
  });
});

describe("renderSkillScaffold — happy path", () => {
  it("produces SKILL.md and valid evals.json", () => {
    const out = renderSkillScaffold(baseInput);
    expect(out.skillMd).toContain("name: demo-skill");
    expect(out.skillMd).toContain("## Mission");
    expect(out.skillMd).toContain("## Workflow");
    expect(out.skillMd).toContain("## When This Triggers");
    expect(out.lineCount).toBeGreaterThan(10);
    expect(out.lineCount).toBeLessThanOrEqual(500);

    // evals.json is parseable
    const parsed = JSON.parse(out.evalsJson) as { skill_name: string; cases: unknown[] };
    expect(parsed.skill_name).toBe("demo-skill");
    expect(parsed.cases.length).toBeGreaterThanOrEqual(2);
  });

  it("includes required tools when provided", () => {
    const out = renderSkillScaffold(baseInput);
    expect(out.skillMd).toContain("- `Write`");
    expect(out.skillMd).toContain("- `Read`");
  });

  it("renders fork context when fork=true", () => {
    const forkInput: TemplateInput = { ...baseInput, fork: true };
    const out = renderSkillScaffold(forkInput);
    expect(out.skillMd).toContain("context: fork");
  });

  it("renders inline context when fork=false", () => {
    const out = renderSkillScaffold(baseInput);
    expect(out.skillMd).toContain("context: inline");
  });

  it("renders all workflow steps with numbers", () => {
    const out = renderSkillScaffold(baseInput);
    // workflowSteps 가 3개이므로 번호 0, 1, 2 가 들어감
    expect(out.skillMd).toMatch(/0\. Parse the user's arguments/);
    expect(out.skillMd).toMatch(/1\. Generate the artifact/);
    expect(out.skillMd).toMatch(/2\. Write the result/);
  });

  it("renders anti-triggers section when provided", () => {
    const out = renderSkillScaffold(baseInput);
    expect(out.skillMd).toContain("run production");
    expect(out.skillMd).toContain("delete everything");
  });
});

describe("renderSkillScaffold — validation guards", () => {
  it("throws VALIDATION_FAILED when SKILL.md exceeds 500 lines", () => {
    const manyLines = Array.from({ length: 800 }, (_, i) => `Step line ${String(i)}`);
    expect(() =>
      renderSkillScaffold({ ...baseInput, workflowSteps: manyLines }),
    ).toThrowError(ScaffoldError);
  });

  it("emits minModelTier into the rendered SKILL.md frontmatter", () => {
    const out = renderSkillScaffold({ ...baseInput, minModelTier: "high" });
    expect(out.skillMd).toContain("minModelTier: high");
  });

  it("produces no required tools section when list is empty", () => {
    const out = renderSkillScaffold({ ...baseInput, requiredTools: [] });
    expect(out.skillMd).toContain("_(none explicitly required");
  });
});
