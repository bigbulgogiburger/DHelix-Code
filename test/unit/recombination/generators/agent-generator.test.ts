import * as path from "node:path";

import { describe, expect, it } from "vitest";

import { generateAgentArtifact } from "../../../../src/recombination/generators/agent-generator.js";
import { createTemplateResolver } from "../../../../src/recombination/generators/template-resolver.js";
import type { LLMCompletionFn } from "../../../../src/recombination/types.js";
import type {
  PlasmidId,
  PlasmidTier,
} from "../../../../src/plasmids/types.js";

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

describe("agent-generator", () => {
  const workDir = "/tmp/ag-work";

  it("emits a kebab-case agent file under .dhelix/agents/", async () => {
    const ir = makeIR({ intents: [makeIntent("agent")] });
    const intent = ir.intents[0]!;
    const artifact = await generateAgentArtifact(ir, intent, {
      resolver: resolverFor(workDir),
      strategies: makeStrategies({ artifactGeneration: "template-only" }),
      workingDirectory: workDir,
    });
    expect(artifact.kind).toBe("agent");
    expect(artifact.targetPath).toBe(
      path.join(workDir, ".dhelix", "agents", "enforce-owasp-gate.md"),
    );
    expect(artifact.templateLayer).toBe("primitives");
    expect(artifact.templateId).toBe("primitives/agent.basic.hbs");
    expect(artifact.contents.startsWith("---\n")).toBe(true);
    expect(artifact.contents).toContain("name: enforce-owasp-gate");
    expect(artifact.contents).toContain(
      'description: "Block commits that contain OWASP Top 10 violations."',
    );
    expect(artifact.contentHash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("propagates intent params into frontmatter when supplied", async () => {
    const ir = makeIR({
      intents: [
        makeIntent("agent", {
          params: {
            tools: ["read", "grep"],
            model: "sonnet",
            maxTurns: 12,
            permissionMode: "acceptEdits",
            skills: ["review-pr"],
            memory: "project",
          },
        }),
      ],
    });
    const intent = ir.intents[0]!;
    const artifact = await generateAgentArtifact(ir, intent, {
      resolver: resolverFor(workDir),
      strategies: makeStrategies({ artifactGeneration: "template-only" }),
      workingDirectory: workDir,
    });
    expect(artifact.contents).toContain("tools: [read, grep]");
    expect(artifact.contents).toContain("model: sonnet");
    expect(artifact.contents).toContain("maxTurns: 12");
    expect(artifact.contents).toContain("permissionMode: acceptEdits");
    expect(artifact.contents).toContain("skills: [review-pr]");
    expect(artifact.contents).toContain("memory: project");
    expect(artifact.requiredTools).toEqual(["read", "grep"]);
  });

  it("omits optional frontmatter keys when intent params are missing", async () => {
    const ir = makeIR({ intents: [makeIntent("agent") ] });
    const intent = ir.intents[0]!;
    const artifact = await generateAgentArtifact(ir, intent, {
      resolver: resolverFor(workDir),
      strategies: makeStrategies({ artifactGeneration: "template-only" }),
      workingDirectory: workDir,
    });
    expect(artifact.contents).not.toContain("tools:");
    expect(artifact.contents).not.toContain("model:");
    expect(artifact.contents).not.toContain("maxTurns:");
    expect(artifact.contents).not.toContain("permissionMode:");
    expect(artifact.contents).not.toContain("skills:");
    expect(artifact.contents).not.toContain("memory:");
    expect(artifact.requiredTools).toBeUndefined();
  });

  it("maps plasmid tier L4 → T3 and L1 → T0 for trustLevel", async () => {
    const l4Ir = makeIR({
      metadata: { ...makeIR().metadata, tier: "L4" as PlasmidTier },
      intents: [makeIntent("agent")],
    });
    const l4 = await generateAgentArtifact(l4Ir, l4Ir.intents[0]!, {
      resolver: resolverFor(workDir),
      strategies: makeStrategies({ artifactGeneration: "template-only" }),
      workingDirectory: workDir,
    });
    expect(l4.trustLevel).toBe("T3");

    const l1Ir = makeIR({
      metadata: { ...makeIR().metadata, tier: "L1" as PlasmidTier },
      intents: [makeIntent("agent")],
    });
    const l1 = await generateAgentArtifact(l1Ir, l1Ir.intents[0]!, {
      resolver: resolverFor(workDir),
      strategies: makeStrategies({ artifactGeneration: "template-only" }),
      workingDirectory: workDir,
    });
    expect(l1.trustLevel).toBe("T0");
  });

  it("honors intent.params.trustLevel override within the tier ceiling", async () => {
    // L3 ceiling = T2. Override to T1 (within ceiling) should be honored.
    const ir = makeIR({
      metadata: { ...makeIR().metadata, tier: "L3" as PlasmidTier },
      intents: [
        makeIntent("agent", { params: { trustLevel: "T1" } }),
      ],
    });
    const within = await generateAgentArtifact(ir, ir.intents[0]!, {
      resolver: resolverFor(workDir),
      strategies: makeStrategies({ artifactGeneration: "template-only" }),
      workingDirectory: workDir,
    });
    expect(within.trustLevel).toBe("T1");

    // Override above ceiling (T3 > T2) must fall back to the ceiling.
    const overrideTooHigh = makeIR({
      metadata: { ...makeIR().metadata, tier: "L3" as PlasmidTier },
      intents: [
        makeIntent("agent", { params: { trustLevel: "T3" } }),
      ],
    });
    const capped = await generateAgentArtifact(
      overrideTooHigh,
      overrideTooHigh.intents[0]!,
      {
        resolver: resolverFor(workDir),
        strategies: makeStrategies({ artifactGeneration: "template-only" }),
        workingDirectory: workDir,
      },
    );
    expect(capped.trustLevel).toBe("T2");
  });

  it("throws a typed error when the frontmatter violates the agent schema", async () => {
    // `tools` entries must be strings per agentDefinitionSchema.
    const ir = makeIR({
      intents: [
        makeIntent("agent", {
          params: { tools: ["read", 42] as unknown as string[] },
        }),
      ],
    });
    await expect(
      generateAgentArtifact(ir, ir.intents[0]!, {
        resolver: resolverFor(workDir),
        strategies: makeStrategies({ artifactGeneration: "template-only" }),
        workingDirectory: workDir,
      }),
    ).rejects.toThrow(/Invalid agent frontmatter/);
  });

  it("rejects a non-agent intent with a typed guard error", async () => {
    const ir = makeIR({ intents: [makeIntent("skill")] });
    await expect(
      generateAgentArtifact(ir, ir.intents[0]!, {
        resolver: resolverFor(workDir),
        strategies: makeStrategies({ artifactGeneration: "template-only" }),
        workingDirectory: workDir,
      }),
    ).rejects.toThrow(/expected intent\.kind="agent"/);
  });

  it("does not crash on an unmapped plasmid tier (defensive fallback)", async () => {
    // Cast-through an unknown tier to exercise the `?? "T0"` fallback.
    const ir = makeIR({
      metadata: { ...makeIR().metadata, tier: "LX" as unknown as PlasmidTier },
      intents: [makeIntent("agent")],
    });
    const artifact = await generateAgentArtifact(ir, ir.intents[0]!, {
      resolver: resolverFor(workDir),
      strategies: makeStrategies({ artifactGeneration: "template-only" }),
      workingDirectory: workDir,
    });
    expect(artifact.trustLevel).toBe("T0");
  });

  it("preserves slot defaults when slot-fill LLM throws", async () => {
    const llm: LLMCompletionFn = async () => {
      throw new Error("simulated LLM failure");
    };
    const ir = makeIR({ intents: [makeIntent("agent")] });
    const artifact = await generateAgentArtifact(ir, ir.intents[0]!, {
      resolver: resolverFor(workDir),
      strategies: makeStrategies({ artifactGeneration: "template-and-llm" }),
      workingDirectory: workDir,
      llm,
    });
    expect(artifact.contents).toContain(
      "Block commits that contain OWASP Top 10 violations.",
    );
    expect(artifact.contents).toContain("checks must run offline");
  });

  it("produces stable paths for repeat invocations with the same intent", async () => {
    const ir = makeIR({ intents: [makeIntent("agent")] });
    const intent = ir.intents[0]!;
    const a = await generateAgentArtifact(ir, intent, {
      resolver: resolverFor(workDir),
      strategies: makeStrategies({ artifactGeneration: "template-only" }),
      workingDirectory: workDir,
    });
    const b = await generateAgentArtifact(ir, intent, {
      resolver: resolverFor(workDir),
      strategies: makeStrategies({ artifactGeneration: "template-only" }),
      workingDirectory: workDir,
    });
    expect(a.targetPath).toBe(b.targetPath);
    expect(a.contentHash).toBe(b.contentHash);
    // PlasmidId is a branded string — test reads via string coercion.
    expect(String(a.sourcePlasmid) as string).toBe(
      String(ir.plasmidId as PlasmidId) as string,
    );
  });
});
