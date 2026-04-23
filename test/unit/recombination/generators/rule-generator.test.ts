import * as path from "node:path";

import { describe, expect, it } from "vitest";

import { generateRuleArtifact } from "../../../../src/recombination/generators/rule-generator.js";
import { createTemplateResolver } from "../../../../src/recombination/generators/template-resolver.js";
import type { LLMCompletionFn } from "../../../../src/recombination/types.js";

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

describe("rule-generator", () => {
  const workDir = "/tmp/rg-work";

  it("emits a rule artifact under .dhelix/rules with kebab-case name", async () => {
    const ir = makeIR({ intents: [makeIntent("rule")] });
    const intent = ir.intents[0]!;
    const artifact = await generateRuleArtifact(ir, intent, {
      resolver: resolverFor(workDir),
      strategies: makeStrategies({ artifactGeneration: "template-only" }),
      workingDirectory: workDir,
    });
    expect(artifact.kind).toBe("rule");
    expect(artifact.targetPath).toBe(
      path.join(workDir, ".dhelix", "rules", "enforce-owasp-gate.md"),
    );
    expect(artifact.templateLayer).toBe("primitives");
    expect(artifact.templateId).toBe("primitives/rule.basic.hbs");
    expect(artifact.contents).toContain("# Enforce Owasp Gate");
    expect(artifact.contents).toContain("checks must run offline");
    expect(artifact.contentHash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("throws when given a non-rule intent", async () => {
    const ir = makeIR({ intents: [makeIntent("skill")] });
    const intent = ir.intents[0]!;
    await expect(
      generateRuleArtifact(ir, intent, {
        resolver: resolverFor(workDir),
        strategies: makeStrategies(),
        workingDirectory: workDir,
      }),
    ).rejects.toThrow(/expected intent.kind="rule"/);
  });

  it("invokes slot-fill when strategy is template-and-llm", async () => {
    const calls: string[] = [];
    const llm: LLMCompletionFn = async (req) => {
      calls.push(req.user);
      return "REFINED BODY";
    };
    const ir = makeIR({ intents: [makeIntent("rule")] });
    const intent = ir.intents[0]!;
    const artifact = await generateRuleArtifact(ir, intent, {
      resolver: resolverFor(workDir),
      strategies: makeStrategies({ artifactGeneration: "template-and-llm" }),
      workingDirectory: workDir,
      llm,
    });
    expect(calls.length).toBeGreaterThan(0);
    expect(artifact.contents).toContain("REFINED BODY");
  });

  it("keeps defaults when slot-fill LLM throws", async () => {
    const llm: LLMCompletionFn = async () => {
      throw new Error("simulated LLM failure");
    };
    const ir = makeIR({ intents: [makeIntent("rule")] });
    const intent = ir.intents[0]!;
    const artifact = await generateRuleArtifact(ir, intent, {
      resolver: resolverFor(workDir),
      strategies: makeStrategies({ artifactGeneration: "template-and-llm" }),
      workingDirectory: workDir,
      llm,
    });
    // Default slot content still present.
    expect(artifact.contents).toContain("Block commits that contain OWASP");
  });
});
