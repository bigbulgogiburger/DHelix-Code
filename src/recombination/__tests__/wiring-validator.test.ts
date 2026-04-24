/**
 * Unit tests for `wiring-validator.ts` — Phase 4 (Team 3) coverage.
 *
 * Focus: Permission Alignment + Cyclical Dependency passes. A handful of
 * Phase-2 regression cases are kept here too so this suite can serve as
 * a standalone gate when the module is touched.
 */
import { describe, expect, it } from "vitest";

import type { PlasmidId, PlasmidTier } from "../../plasmids/types.js";
import type {
  ArtifactTrustLevel,
  GeneratedArtifact,
  ReorgPlan,
} from "../types.js";
import { validateWiring } from "../wiring-validator.js";

type ArtifactOverrides = Partial<GeneratedArtifact> & {
  readonly requiredTools?: readonly string[];
  readonly trustLevel?: ArtifactTrustLevel;
};

function art(overrides: ArtifactOverrides = {}): GeneratedArtifact {
  const base: GeneratedArtifact = {
    kind: overrides.kind ?? "rule",
    sourcePlasmid: (overrides.sourcePlasmid ?? "p1") as PlasmidId,
    sourceIntentId: overrides.sourceIntentId ?? "p1-intent-1",
    targetPath:
      overrides.targetPath ?? "/tmp/project/.dhelix/rules/rule.md",
    contents:
      overrides.contents ??
      "---\nname: rule\ndescription: stub\n---\n\n# Rule\n",
    contentHash: overrides.contentHash ?? "hash",
    templateLayer: overrides.templateLayer ?? "primitives",
    templateId: overrides.templateId ?? "primitives/rule.basic",
  };
  return {
    ...base,
    ...(overrides.requiredTools !== undefined
      ? { requiredTools: overrides.requiredTools }
      : {}),
    ...(overrides.trustLevel !== undefined
      ? { trustLevel: overrides.trustLevel }
      : {}),
  };
}

function emptyReorg(): ReorgPlan {
  return {
    ops: [],
    keptMarkerIds: [],
    preReorgContentHash: "abc",
    intentGraphHash: "def",
    fallbackTier: "llm-only",
  };
}

function tierMap(
  entries: readonly (readonly [string, PlasmidTier])[],
): ReadonlyMap<PlasmidId, PlasmidTier> {
  const m = new Map<PlasmidId, PlasmidTier>();
  for (const [id, tier] of entries) m.set(id as PlasmidId, tier);
  return m;
}

describe("validateWiring — Permission Alignment", () => {
  it("emits WIRING_PERMISSION_MISMATCH when T0 artifact requires bash", async () => {
    const report = await validateWiring(
      [
        art({
          kind: "agent",
          targetPath: "/tmp/project/.dhelix/agents/low-trust.md",
          trustLevel: "T0",
          requiredTools: ["bash"],
          contents:
            "---\nname: low-trust\ndescription: needs bash\n---\n\nbody\n",
        }),
      ],
      emptyReorg(),
      "/tmp/project",
    );
    expect(
      report.findings.some((f) => f.checkId === "WIRING_PERMISSION_MISMATCH"),
    ).toBe(true);
    expect(report.passed).toBe(false);
  });

  it("passes when T2 artifact requires bash (min trust for bash is T2)", async () => {
    const report = await validateWiring(
      [
        art({
          kind: "agent",
          targetPath: "/tmp/project/.dhelix/agents/ok.md",
          trustLevel: "T2",
          requiredTools: ["bash"],
          contents: "---\nname: ok\ndescription: ok\n---\n\nbody\n",
        }),
      ],
      emptyReorg(),
      "/tmp/project",
    );
    expect(
      report.findings.some((f) => f.checkId === "WIRING_PERMISSION_MISMATCH"),
    ).toBe(false);
  });

  it("assumes T0 when trustLevel is missing and flags bash requirement", async () => {
    const report = await validateWiring(
      [
        art({
          kind: "agent",
          targetPath: "/tmp/project/.dhelix/agents/default-trust.md",
          requiredTools: ["bash"],
          contents:
            "---\nname: default-trust\ndescription: no trust\n---\n\nbody\n",
        }),
      ],
      emptyReorg(),
      "/tmp/project",
    );
    expect(
      report.findings.some((f) => f.checkId === "WIRING_PERMISSION_MISMATCH"),
    ).toBe(true);
  });

  it("does not emit permission finding for unknown tools (reference-check owns those)", async () => {
    const report = await validateWiring(
      [
        art({
          kind: "agent",
          trustLevel: "T0",
          targetPath: "/tmp/project/.dhelix/agents/weird.md",
          requiredTools: ["totally-unknown-tool"],
          contents: "---\nname: weird\ndescription: x\n---\n\nbody\n",
        }),
      ],
      emptyReorg(),
      "/tmp/project",
    );
    expect(
      report.findings.some((f) => f.checkId === "WIRING_PERMISSION_MISMATCH"),
    ).toBe(false);
    // The reference-check should still surface the unknown tool.
    expect(
      report.findings.some((f) => f.checkId === "WIRING_REFERENCE_MISSING_TOOL"),
    ).toBe(true);
  });
});

describe("validateWiring — Trust Downgrade (tier ceiling)", () => {
  it("emits WIRING_TRUST_DOWNGRADE_REQUIRED when L1 plasmid has T3 agent", async () => {
    const report = await validateWiring(
      [
        art({
          kind: "agent",
          sourcePlasmid: "tactical" as PlasmidId,
          trustLevel: "T3",
          targetPath: "/tmp/project/.dhelix/agents/escalated.md",
          contents:
            "---\nname: escalated\ndescription: x\n---\n\nbody\n",
        }),
      ],
      emptyReorg(),
      "/tmp/project",
      undefined,
      { plasmidTiers: tierMap([["tactical", "L1"]]) },
    );
    expect(
      report.findings.some(
        (f) => f.checkId === "WIRING_TRUST_DOWNGRADE_REQUIRED",
      ),
    ).toBe(true);
  });

  it("passes when L4 plasmid declares T3 agent (foundational ceiling)", async () => {
    const report = await validateWiring(
      [
        art({
          kind: "agent",
          sourcePlasmid: "foundational" as PlasmidId,
          trustLevel: "T3",
          targetPath: "/tmp/project/.dhelix/agents/deep.md",
          contents: "---\nname: deep\ndescription: x\n---\n\nbody\n",
        }),
      ],
      emptyReorg(),
      "/tmp/project",
      undefined,
      { plasmidTiers: tierMap([["foundational", "L4"]]) },
    );
    expect(
      report.findings.some(
        (f) => f.checkId === "WIRING_TRUST_DOWNGRADE_REQUIRED",
      ),
    ).toBe(false);
  });

  it("tier check is a no-op when context.plasmidTiers is omitted", async () => {
    const report = await validateWiring(
      [
        art({
          kind: "agent",
          sourcePlasmid: "tactical" as PlasmidId,
          trustLevel: "T3",
          targetPath: "/tmp/project/.dhelix/agents/escalated.md",
          contents:
            "---\nname: escalated\ndescription: x\n---\n\nbody\n",
        }),
      ],
      emptyReorg(),
      "/tmp/project",
    );
    expect(
      report.findings.some(
        (f) => f.checkId === "WIRING_TRUST_DOWNGRADE_REQUIRED",
      ),
    ).toBe(false);
  });
});

describe("validateWiring — Cyclical Dependency (Tarjan SCC)", () => {
  it("detects a 2-node cycle: agent A → skill X, skill X → @agent-a", async () => {
    const agentA = art({
      kind: "agent",
      sourcePlasmid: "p1" as PlasmidId,
      targetPath: "/tmp/project/.dhelix/agents/a.md",
      contents:
        "---\nname: a\ndescription: alpha\nskills: [x]\n---\n\nbody\n",
    });
    const skillX = art({
      kind: "skill",
      sourcePlasmid: "p1" as PlasmidId,
      targetPath: "/tmp/project/.dhelix/skills/x/SKILL.md",
      contents:
        "---\nname: x\ndescription: skill x\n---\n\nUse @agent-a for help.\n",
    });
    const report = await validateWiring(
      [agentA, skillX],
      emptyReorg(),
      "/tmp/project",
    );
    const cycles = report.findings.filter(
      (f) => f.checkId === "WIRING_CYCLIC_DEPENDENCY",
    );
    expect(cycles.length).toBeGreaterThanOrEqual(1);
    const msg = cycles[0]?.message ?? "";
    expect(msg).toContain("agent:a");
    expect(msg).toContain("skill:x");
  });

  it("detects a 3-node cycle: agent A → skill B → agent C → agent A", async () => {
    const agentA = art({
      kind: "agent",
      sourcePlasmid: "p1" as PlasmidId,
      targetPath: "/tmp/project/.dhelix/agents/a.md",
      contents:
        "---\nname: a\ndescription: a\nskills:\n  - b\n---\n\nbody\n",
    });
    const skillB = art({
      kind: "skill",
      sourcePlasmid: "p1" as PlasmidId,
      targetPath: "/tmp/project/.dhelix/skills/b/SKILL.md",
      contents: "---\nname: b\ndescription: b\n---\n\nCall @agent-c please.\n",
    });
    const agentC = art({
      kind: "agent",
      sourcePlasmid: "p1" as PlasmidId,
      targetPath: "/tmp/project/.dhelix/agents/c.md",
      contents: "---\nname: c\ndescription: c\nagents: [a]\n---\n\nbody\n",
    });
    const report = await validateWiring(
      [agentA, skillB, agentC],
      emptyReorg(),
      "/tmp/project",
    );
    const cycles = report.findings.filter(
      (f) => f.checkId === "WIRING_CYCLIC_DEPENDENCY",
    );
    expect(cycles.length).toBeGreaterThanOrEqual(1);
    const msg = cycles[0]?.message ?? "";
    expect(msg).toContain("agent:a");
    expect(msg).toContain("skill:b");
    expect(msg).toContain("agent:c");
  });

  it("accepts an acyclic chain: agent → skill → agent (no back edge)", async () => {
    const agentA = art({
      kind: "agent",
      sourcePlasmid: "p1" as PlasmidId,
      targetPath: "/tmp/project/.dhelix/agents/a.md",
      contents:
        "---\nname: a\ndescription: a\nskills: [b]\n---\n\nbody\n",
    });
    const skillB = art({
      kind: "skill",
      sourcePlasmid: "p1" as PlasmidId,
      targetPath: "/tmp/project/.dhelix/skills/b/SKILL.md",
      contents: "---\nname: b\ndescription: b\n---\n\n@agent-c helps.\n",
    });
    const agentC = art({
      kind: "agent",
      sourcePlasmid: "p1" as PlasmidId,
      targetPath: "/tmp/project/.dhelix/agents/c.md",
      contents: "---\nname: c\ndescription: c\n---\n\nbody\n",
    });
    const report = await validateWiring(
      [agentA, skillB, agentC],
      emptyReorg(),
      "/tmp/project",
    );
    expect(
      report.findings.some((f) => f.checkId === "WIRING_CYCLIC_DEPENDENCY"),
    ).toBe(false);
  });

  it("emits WIRING_REFERENCE_MISSING_SKILL for dangling skill reference in-run", async () => {
    const agentA = art({
      kind: "agent",
      sourcePlasmid: "p1" as PlasmidId,
      targetPath: "/tmp/project/.dhelix/agents/a.md",
      contents:
        "---\nname: a\ndescription: a\nskills: [ghost]\n---\n\nbody\n",
    });
    const report = await validateWiring(
      [agentA],
      emptyReorg(),
      "/tmp/project",
    );
    expect(
      report.findings.some(
        (f) => f.checkId === "WIRING_REFERENCE_MISSING_SKILL",
      ),
    ).toBe(true);
    expect(
      report.findings.some((f) => f.checkId === "WIRING_CYCLIC_DEPENDENCY"),
    ).toBe(false);
  });

  it("preserves upstream self-loop detection via reorg locationAfter", async () => {
    const plan: ReorgPlan = {
      ...emptyReorg(),
      ops: [
        {
          kind: "insert",
          markerId: "self",
          heading: "H",
          body: "body",
          locationAfter: "self",
        },
      ],
    };
    const report = await validateWiring([], plan, "/tmp/project");
    expect(
      report.findings.some((f) => f.checkId === "WIRING_CYCLIC_DEPENDENCY"),
    ).toBe(true);
  });
});

describe("validateWiring — Phase 2 regression", () => {
  it("still flags markdown artifacts missing frontmatter", async () => {
    const bare = art({
      contents: "# no frontmatter here\n",
      targetPath: "/tmp/project/.dhelix/rules/bare.md",
    });
    const report = await validateWiring(
      [bare],
      emptyReorg(),
      "/tmp/project",
    );
    expect(
      report.findings.some((f) => f.checkId === "WIRING_FRONTMATTER_SCHEMA"),
    ).toBe(true);
  });

  it("throws when the signal is already aborted", async () => {
    const ac = new AbortController();
    ac.abort();
    await expect(
      validateWiring([], emptyReorg(), "/tmp/project", ac.signal),
    ).rejects.toThrow(/aborted/);
  });
});
