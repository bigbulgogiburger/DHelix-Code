import * as path from "node:path";

import { describe, expect, it } from "vitest";

import { generateSkillArtifact } from "../../../../src/recombination/generators/skill-generator.js";
import { createTemplateResolver } from "../../../../src/recombination/generators/template-resolver.js";

import { makeIntent, makeIR, makeStrategies } from "./_fixtures.js";

const PRIMITIVES_ROOT = path.resolve(
  path.dirname(new URL(import.meta.url).pathname),
  "../../../../src/recombination/generators/templates/primitives",
);

function resolverFor(workDir: string) {
  return createTemplateResolver({
    workingDirectory: workDir,
    primitivesRoot: PRIMITIVES_ROOT,
  });
}

describe("skill-generator", () => {
  const workDir = "/tmp/sg-work";

  it("emits a SKILL.md under .dhelix/skills/<kebab-name>/", async () => {
    const ir = makeIR({ intents: [makeIntent("skill")] });
    const intent = ir.intents[0]!;
    const artifact = await generateSkillArtifact(ir, intent, {
      resolver: resolverFor(workDir),
      strategies: makeStrategies({ artifactGeneration: "template-only" }),
      workingDirectory: workDir,
    });
    expect(artifact.kind).toBe("skill");
    expect(artifact.targetPath).toBe(
      path.join(
        workDir,
        ".dhelix",
        "skills",
        "enforce-owasp-gate",
        "SKILL.md",
      ),
    );
    // SKILL.md frontmatter must be first.
    expect(artifact.contents.startsWith("---\n")).toBe(true);
    expect(artifact.contents).toContain("name: enforce-owasp-gate");
    expect(artifact.contents).toContain("## When to use");
  });

  it("truncates overly long titles and appends a stable hash suffix", async () => {
    const long = "Enforce OWASP gate with many extra words to overflow the limit lots more";
    const ir = makeIR({
      intents: [
        makeIntent("skill", { id: "long-1", title: long }),
      ],
    });
    const intent = ir.intents[0]!;
    const artifact = await generateSkillArtifact(ir, intent, {
      resolver: resolverFor(workDir),
      strategies: makeStrategies({ artifactGeneration: "template-only" }),
      workingDirectory: workDir,
    });
    const dir = path.basename(path.dirname(artifact.targetPath));
    // 48-char cap enforced
    expect(dir.length).toBeLessThanOrEqual(48);
    // Stable: same title → same dir
    const again = await generateSkillArtifact(ir, intent, {
      resolver: resolverFor(workDir),
      strategies: makeStrategies({ artifactGeneration: "template-only" }),
      workingDirectory: workDir,
    });
    expect(again.targetPath).toBe(artifact.targetPath);
  });
});
