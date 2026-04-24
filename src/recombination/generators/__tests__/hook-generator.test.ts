import * as path from "node:path";

import { describe, expect, it } from "vitest";

import { generateHookArtifacts } from "../hook-generator.js";
import { createTemplateResolver } from "../template-resolver.js";
import type {
  CompiledPlasmidIR,
  GeneratedArtifact,
  PlasmidIntentNode,
} from "../../types.js";

import { makeIR, makeIntent, makeMetadata, makeStrategies } from "./_fixtures.js";

const WORK_DIR = "/tmp/dhelix-hook-test";

function resolver(workDir: string = WORK_DIR) {
  return createTemplateResolver({ workingDirectory: workDir });
}

function baseIntent(
  paramOverrides: Record<string, unknown>,
  overrides: Partial<PlasmidIntentNode> = {},
): PlasmidIntentNode {
  return makeIntent("hook", {
    title: "Log pre tool use",
    params: paramOverrides,
    ...overrides,
  });
}

function irWithIntent(
  intent: PlasmidIntentNode,
  irOverrides: Partial<CompiledPlasmidIR> = {},
): CompiledPlasmidIR {
  return makeIR({ intents: [intent], ...irOverrides });
}

describe("hook-generator", () => {
  it("emits script + manifest for a valid PreToolUse intent", async () => {
    const intent = baseIntent({ event: "PreToolUse", matcher: "bash:*" });
    const ir = irWithIntent(intent);
    const artifacts = await generateHookArtifacts(ir, intent, {
      resolver: resolver(),
      strategies: makeStrategies(),
      workingDirectory: WORK_DIR,
    });

    expect(artifacts).toHaveLength(2);
    const [script, manifest] = artifacts as readonly [
      GeneratedArtifact,
      GeneratedArtifact,
    ];

    expect(script.kind).toBe("hook");
    expect(manifest.kind).toBe("hook");
    expect(script.targetPath).toBe(
      path.join(WORK_DIR, ".dhelix", "hooks", "PreToolUse", "log-pre-tool-use.sh"),
    );
    expect(manifest.targetPath).toBe(
      path.join(
        WORK_DIR,
        ".dhelix",
        "hooks",
        "PreToolUse",
        "log-pre-tool-use.manifest.json",
      ),
    );

    expect(script.contents.startsWith("#!/usr/bin/env bash\n")).toBe(true);
    expect(script.contents).toContain("set -euo pipefail");
    expect(script.contents).toContain("$TOOL_NAME");
    expect(script.contents).toContain("$FILE_PATH");
    expect(script.contents).toContain("$SESSION_ID");
    expect(script.contents).toContain("# Event: PreToolUse");
    expect(script.contents).toContain("owasp-gate");

    expect(script.contentHash).toMatch(/^[0-9a-f]{64}$/);
    expect(script.templateLayer).toBe("primitives");
    expect(script.templateId).toBe("primitives/hook.basic.hbs");
  });

  it("propagates matcher into the manifest when present", async () => {
    const intent = baseIntent({
      event: "PostToolUse",
      matcher: "edit:*.ts",
    });
    const ir = irWithIntent(intent);
    const [, manifest] = await generateHookArtifacts(ir, intent, {
      resolver: resolver(),
      strategies: makeStrategies(),
      workingDirectory: WORK_DIR,
    });

    const parsed = JSON.parse(manifest!.contents) as Record<string, unknown>;
    expect(parsed["event"]).toBe("PostToolUse");
    expect(parsed["matcher"]).toBe("edit:*.ts");
    expect(parsed["script"]).toBe("log-pre-tool-use.sh");
    expect(parsed["sourcePlasmid"]).toBe("owasp-gate");
    expect(parsed["sourceIntentId"]).toBe("hook-intent-1");
    expect(manifest!.templateId).toBe("primitives/hook.manifest.hbs");
  });

  it("sets matcher to null when absent or non-string", async () => {
    const intent = baseIntent({ event: "SessionStart", matcher: 42 });
    const ir = irWithIntent(intent);
    const [, manifest] = await generateHookArtifacts(ir, intent, {
      resolver: resolver(),
      strategies: makeStrategies(),
      workingDirectory: WORK_DIR,
    });
    const parsed = JSON.parse(manifest!.contents) as Record<string, unknown>;
    expect(parsed["matcher"]).toBeNull();
  });

  it("throws typed error when intent.params.event is missing", async () => {
    const intent = baseIntent({});
    const ir = irWithIntent(intent);
    await expect(
      generateHookArtifacts(ir, intent, {
        resolver: resolver(),
        strategies: makeStrategies(),
        workingDirectory: WORK_DIR,
      }),
    ).rejects.toThrow(
      /hook generator: invalid or missing intent\.params\.event/,
    );
  });

  it("throws typed error when intent.params.event is not a valid HookEvent", async () => {
    const intent = baseIntent({ event: "NotARealEvent" });
    const ir = irWithIntent(intent);
    await expect(
      generateHookArtifacts(ir, intent, {
        resolver: resolver(),
        strategies: makeStrategies(),
        workingDirectory: WORK_DIR,
      }),
    ).rejects.toThrow(/must be one of/);
  });

  it("throws when given a non-hook intent", async () => {
    const intent = makeIntent("rule", { params: { event: "PreToolUse" } });
    const ir = irWithIntent(intent);
    await expect(
      generateHookArtifacts(ir, intent, {
        resolver: resolver(),
        strategies: makeStrategies(),
        workingDirectory: WORK_DIR,
      }),
    ).rejects.toThrow(/expected intent.kind="hook"/);
  });

  it("caps trustLevel at plasmid tier ceiling for tactical tiers", async () => {
    const intent = baseIntent({ event: "PreToolUse" });
    const ir = irWithIntent(intent, {
      metadata: makeMetadata({ tier: "L1" }),
      tier: "L1",
    });
    const [script, manifest] = await generateHookArtifacts(ir, intent, {
      resolver: resolver(),
      strategies: makeStrategies(),
      workingDirectory: WORK_DIR,
    });
    // L1 ceiling = T0 — must not exceed it.
    expect(script!.trustLevel).toBe("T0");
    // Manifest artifact carries no trustLevel (metadata file, not executable).
    expect(manifest!.trustLevel).toBeUndefined();
  });

  it("caps trustLevel at T2 for foundational (L4) plasmids since hooks run bash", async () => {
    const intent = baseIntent({ event: "PreToolUse" });
    const ir = irWithIntent(intent, {
      metadata: makeMetadata({ tier: "L4" }),
      tier: "L4",
    });
    const [script] = await generateHookArtifacts(ir, intent, {
      resolver: resolver(),
      strategies: makeStrategies(),
      workingDirectory: WORK_DIR,
    });
    // L4 would allow T3, but hook-generator caps at T2.
    expect(script!.trustLevel).toBe("T2");
  });

  it("uses intent.params.body verbatim when supplied", async () => {
    const intent = baseIntent({
      event: "PreToolUse",
      body: 'echo "custom body from plasmid"',
    });
    const ir = irWithIntent(intent);
    const [script] = await generateHookArtifacts(ir, intent, {
      resolver: resolver(),
      strategies: makeStrategies(),
      workingDirectory: WORK_DIR,
    });
    expect(script!.contents).toContain('echo "custom body from plasmid"');
  });

  it("routes hook output under the Event subdirectory", async () => {
    const events = ["SessionStart", "Notification", "WorktreeCreate"] as const;
    for (const event of events) {
      const intent = baseIntent({ event });
      const ir = irWithIntent(intent);
      const [script, manifest] = await generateHookArtifacts(ir, intent, {
        resolver: resolver(),
        strategies: makeStrategies(),
        workingDirectory: WORK_DIR,
      });
      expect(script!.targetPath).toContain(
        `${path.sep}hooks${path.sep}${event}${path.sep}`,
      );
      expect(manifest!.targetPath).toContain(
        `${path.sep}hooks${path.sep}${event}${path.sep}`,
      );
    }
  });
});
