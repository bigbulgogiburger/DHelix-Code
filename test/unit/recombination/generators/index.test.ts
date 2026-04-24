import * as path from "node:path";

import { describe, expect, it } from "vitest";

import {
  createGenerator,
  generate,
} from "../../../../src/recombination/generators/index.js";
import { createTemplateResolver } from "../../../../src/recombination/generators/template-resolver.js";
import type {
  GenerateRequest,
  LLMCompletionFn,
} from "../../../../src/recombination/types.js";

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

describe("generate (Stage 2b entry)", () => {
  const workDir = "/tmp/gen-entry-work";
  const stubLlm: LLMCompletionFn = async () => "REFINED";

  it("dispatches rule/skill/command and emits 3 artifacts", async () => {
    const ir = makeIR({
      intents: [
        makeIntent("rule", { id: "r-1" }),
        makeIntent("skill", { id: "s-1" }),
        makeIntent("command", { id: "c-1" }),
      ],
    });
    const bound = createGenerator({ resolver: resolverFor(workDir) });
    const req: GenerateRequest = {
      irs: [ir],
      strategies: makeStrategies({ artifactGeneration: "template-only" }),
      workingDirectory: workDir,
      llm: stubLlm,
    };
    const result = await bound(req);
    expect(result.artifacts).toHaveLength(3);
    expect(result.warnings).toEqual([]);
    const kinds = result.artifacts.map((a) => a.kind).sort();
    expect(kinds).toEqual(["command", "rule", "skill"]);
  });

  it("dispatches agent + hook + harness intents (all Phase-4 generators landed)", async () => {
    const ir = makeIR({
      intents: [
        makeIntent("agent", { id: "a-1" }),
        makeIntent("hook", {
          id: "h-1",
          params: { event: "PreToolUse" },
        }),
        makeIntent("harness", {
          id: "x-1",
          params: { settings: { hooks: {} } },
        }),
      ],
    });
    const bound = createGenerator({ resolver: resolverFor(workDir) });
    const result = await bound({
      irs: [ir],
      strategies: makeStrategies({ artifactGeneration: "template-only" }),
      workingDirectory: workDir,
      llm: stubLlm,
    });
    // agent → 1 artifact; hook → 2 artifacts (script + manifest); harness → 1 artifact.
    expect(result.warnings).toEqual([]);
    expect(result.artifacts).toHaveLength(4);
    const kinds = result.artifacts.map((a) => a.kind).sort();
    expect(kinds).toEqual(["agent", "harness", "hook", "hook"]);
  });

  it("dispatches agent intents through the Phase 4 agent generator", async () => {
    const ir = makeIR({
      intents: [makeIntent("agent", { id: "a-1" })],
    });
    const bound = createGenerator({ resolver: resolverFor(workDir) });
    const result = await bound({
      irs: [ir],
      strategies: makeStrategies({ artifactGeneration: "template-only" }),
      workingDirectory: workDir,
      llm: stubLlm,
    });
    expect(result.warnings).toEqual([]);
    expect(result.artifacts).toHaveLength(1);
    const artifact = result.artifacts[0]!;
    expect(artifact.kind).toBe("agent");
    expect(artifact.targetPath).toContain(
      path.join(".dhelix", "agents", "enforce-owasp-gate.md"),
    );
  });

  it("aborts early when the signal is already cancelled", async () => {
    const ac = new AbortController();
    ac.abort();
    const ir = makeIR({
      intents: [makeIntent("rule"), makeIntent("skill")],
    });
    const bound = createGenerator({ resolver: resolverFor(workDir) });
    const result = await bound({
      irs: [ir],
      strategies: makeStrategies(),
      workingDirectory: workDir,
      llm: stubLlm,
      signal: ac.signal,
    });
    expect(result.artifacts).toEqual([]);
    expect(result.warnings[0]).toMatch(/aborted before processing/);
  });

  it("captures generator errors as warnings and keeps going", async () => {
    // An intent with empty title + no content will still produce output
    // because of the fallback stem; force a failure by asking for a kind
    // whose handler is missing from the switch would require type extension.
    // Instead, feed an unknown kind via cast — guarded exhaustiveness arm.
    const ir = makeIR({
      intents: [
        makeIntent("rule"),
        {
          ...makeIntent("rule"),
          id: "bad",
          kind: "mystery" as unknown as "rule",
        },
      ],
    });
    const bound = createGenerator({ resolver: resolverFor(workDir) });
    const result = await bound({
      irs: [ir],
      strategies: makeStrategies({ artifactGeneration: "template-only" }),
      workingDirectory: workDir,
      llm: stubLlm,
    });
    expect(result.artifacts).toHaveLength(1);
    expect(result.warnings.some((w) => w.includes("unhandled intent kind"))).toBe(
      true,
    );
  });

  it("default bound generate (no resolver override) works against primitives", async () => {
    // With no `createGenerator` override we expect the default resolver to
    // locate primitives via `import.meta.url`.
    const ir = makeIR({ intents: [makeIntent("rule")] });
    const result = await generate({
      irs: [ir],
      strategies: makeStrategies({ artifactGeneration: "template-only" }),
      workingDirectory: workDir,
      llm: stubLlm,
    });
    expect(result.artifacts).toHaveLength(1);
    expect(result.artifacts[0]?.templateLayer).toBe("primitives");
  });
});
