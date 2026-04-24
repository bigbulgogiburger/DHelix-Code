import * as path from "node:path";

import { describe, expect, it } from "vitest";

import { generateCommandArtifact } from "../../../../src/recombination/generators/command-generator.js";
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

describe("command-generator", () => {
  const workDir = "/tmp/cg-work";

  it("emits a command artifact under .dhelix/commands", async () => {
    const ir = makeIR({ intents: [makeIntent("command")] });
    const intent = ir.intents[0]!;
    const artifact = await generateCommandArtifact(ir, intent, {
      resolver: resolverFor(workDir),
      strategies: makeStrategies({ artifactGeneration: "template-only" }),
      workingDirectory: workDir,
    });
    expect(artifact.kind).toBe("command");
    expect(artifact.targetPath).toBe(
      path.join(workDir, ".dhelix", "commands", "enforce-owasp-gate.md"),
    );
    expect(artifact.contents).toContain("# /enforce-owasp-gate");
    expect(artifact.templateId).toBe("primitives/command.basic.hbs");
  });

  it("produces deterministic content hashes for identical input", async () => {
    const ir = makeIR({ intents: [makeIntent("command")] });
    const intent = ir.intents[0]!;
    const a = await generateCommandArtifact(ir, intent, {
      resolver: resolverFor(workDir),
      strategies: makeStrategies({ artifactGeneration: "template-only" }),
      workingDirectory: workDir,
    });
    const b = await generateCommandArtifact(ir, intent, {
      resolver: resolverFor(workDir),
      strategies: makeStrategies({ artifactGeneration: "template-only" }),
      workingDirectory: workDir,
    });
    expect(a.contentHash).toBe(b.contentHash);
    expect(a.contents).toBe(b.contents);
  });
});
