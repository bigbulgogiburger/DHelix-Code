import * as path from "node:path";

import { describe, expect, it } from "vitest";

import { generateHarnessArtifact } from "../harness-generator.js";
import { createTemplateResolver } from "../template-resolver.js";
import type { PlasmidIntentNode } from "../../types.js";

import { makeIR, makeIntent, makeMetadata, makeStrategies } from "./_fixtures.js";

const WORK_DIR = "/tmp/dhelix-harness-test";

function resolver(workDir: string = WORK_DIR) {
  return createTemplateResolver({ workingDirectory: workDir });
}

function intentWith(
  paramOverrides: Record<string, unknown> = {},
  overrides: Partial<PlasmidIntentNode> = {},
): PlasmidIntentNode {
  return makeIntent("harness", {
    title: "Install OWASP hooks",
    description: "Ship a settings snippet that wires OWASP checks into hooks.",
    params: paramOverrides,
    ...overrides,
  });
}

describe("harness-generator", () => {
  it("renders a harness artifact with kebab-case name under .dhelix/harness", async () => {
    const intent = intentWith({
      settings: { hooks: { PreToolUse: [{ script: "audit.sh" }] } },
    });
    const ir = makeIR({ intents: [intent] });
    const artifact = await generateHarnessArtifact(ir, intent, {
      resolver: resolver(),
      strategies: makeStrategies(),
      workingDirectory: WORK_DIR,
    });

    expect(artifact.kind).toBe("harness");
    expect(artifact.targetPath).toBe(
      path.join(WORK_DIR, ".dhelix", "harness", "install-owasp-hooks.md"),
    );
    expect(artifact.templateLayer).toBe("primitives");
    expect(artifact.templateId).toBe("primitives/harness.basic.hbs");
    expect(artifact.contents).toContain("# Install Owasp Hooks");
    expect(artifact.contents).toContain("## Suggested settings.json fragment");
    expect(artifact.contents).toContain("## How to apply");
    expect(artifact.contentHash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("embeds a valid JSON fragment when settings are provided", async () => {
    const settings = {
      hooks: {
        PreToolUse: [{ matcher: "bash:*", script: "audit.sh" }],
      },
    };
    const intent = intentWith({ settings });
    const ir = makeIR({ intents: [intent] });
    const artifact = await generateHarnessArtifact(ir, intent, {
      resolver: resolver(),
      strategies: makeStrategies(),
      workingDirectory: WORK_DIR,
    });

    const match = /```json\n([\s\S]*?)\n```/.exec(artifact.contents);
    expect(match).not.toBeNull();
    const parsed = JSON.parse(match![1]!) as Record<string, unknown>;
    expect(parsed).toEqual(settings);
  });

  it("falls back to a placeholder fragment when no settings are provided", async () => {
    const intent = intentWith({});
    const ir = makeIR({ intents: [intent] });
    const artifact = await generateHarnessArtifact(ir, intent, {
      resolver: resolver(),
      strategies: makeStrategies(),
      workingDirectory: WORK_DIR,
    });

    expect(artifact.contents).toContain("```json");
    expect(artifact.contents).toContain('"hooks": {}');
    expect(artifact.contents).toContain("No `settings` provided");
  });

  it("propagates the anchor event into the output when supplied", async () => {
    const intent = intentWith({
      event: "PostToolUse",
      settings: { hooks: {} },
    });
    const ir = makeIR({ intents: [intent] });
    const artifact = await generateHarnessArtifact(ir, intent, {
      resolver: resolver(),
      strategies: makeStrategies(),
      workingDirectory: WORK_DIR,
    });
    expect(artifact.contents).toContain("Suggested anchor event: `PostToolUse`");
  });

  it("ignores invalid event strings in the anchor callout", async () => {
    const intent = intentWith({
      event: "NotARealEvent",
      settings: { hooks: {} },
    });
    const ir = makeIR({ intents: [intent] });
    const artifact = await generateHarnessArtifact(ir, intent, {
      resolver: resolver(),
      strategies: makeStrategies(),
      workingDirectory: WORK_DIR,
    });
    expect(artifact.contents).not.toContain("Suggested anchor event");
  });

  it("emits trustLevel matching the plasmid tier ceiling", async () => {
    const intent = intentWith({ settings: { hooks: {} } });
    const irL4 = makeIR({
      metadata: makeMetadata({ tier: "L4" }),
      tier: "L4",
      intents: [intent],
    });
    const l4 = await generateHarnessArtifact(irL4, intent, {
      resolver: resolver(),
      strategies: makeStrategies(),
      workingDirectory: WORK_DIR,
    });
    expect(l4.trustLevel).toBe("T3");

    const irL2 = makeIR({
      metadata: makeMetadata({ tier: "L2" }),
      tier: "L2",
      intents: [intent],
    });
    const l2 = await generateHarnessArtifact(irL2, intent, {
      resolver: resolver(),
      strategies: makeStrategies(),
      workingDirectory: WORK_DIR,
    });
    expect(l2.trustLevel).toBe("T1");
  });

  it("throws when given a non-harness intent", async () => {
    const intent = makeIntent("rule", {
      title: "not a harness",
      params: { settings: {} },
    });
    const ir = makeIR({ intents: [intent] });
    await expect(
      generateHarnessArtifact(ir, intent, {
        resolver: resolver(),
        strategies: makeStrategies(),
        workingDirectory: WORK_DIR,
      }),
    ).rejects.toThrow(/expected intent.kind="harness"/);
  });

  it("handles non-object settings payloads by emitting a valid fenced block", async () => {
    const intent = intentWith({ settings: ["one", "two"] });
    const ir = makeIR({ intents: [intent] });
    const artifact = await generateHarnessArtifact(ir, intent, {
      resolver: resolver(),
      strategies: makeStrategies(),
      workingDirectory: WORK_DIR,
    });
    const match = /```json\n([\s\S]*?)\n```/.exec(artifact.contents);
    expect(match).not.toBeNull();
    const parsed = JSON.parse(match![1]!);
    expect(parsed).toEqual(["one", "two"]);
  });
});
