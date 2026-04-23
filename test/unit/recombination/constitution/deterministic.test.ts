/**
 * Unit tests for `src/recombination/constitution/deterministic.ts`.
 *
 * Covers:
 *   - `insert` for new intents when no matching marker exists.
 *   - `update` when the intent body changed.
 *   - `remove` when a marker has no backing intent any more.
 *   - `keep` (no op emitted, tracked via `keptMarkerIds`) when the body is already current.
 */

import { describe, expect, it } from "vitest";

import { buildDeterministicPlan } from "../../../../src/recombination/constitution/deterministic.js";
import { parse } from "../../../../src/recombination/constitution/section-tree.js";
import type {
  CompiledPlasmidIR,
  PlasmidIntentNode,
} from "../../../../src/recombination/types.js";
import type {
  PlasmidFingerprint,
  PlasmidId,
  PlasmidMetadata,
} from "../../../../src/plasmids/types.js";

function intent(overrides: Partial<PlasmidIntentNode>): PlasmidIntentNode {
  return {
    id: overrides.id ?? "intent-1",
    sourcePlasmid: (overrides.sourcePlasmid ?? "owasp-gate") as PlasmidId,
    kind: overrides.kind ?? "rule",
    title: overrides.title ?? "Security Posture",
    description: overrides.description ?? "Enforce OWASP top-10 protections.",
    constraints: overrides.constraints ?? [],
    evidence: overrides.evidence ?? [],
    params: overrides.params ?? {},
  };
}

function ir(
  plasmidId: string,
  intents: readonly PlasmidIntentNode[],
): CompiledPlasmidIR {
  const meta: PlasmidMetadata = {
    id: plasmidId as PlasmidId,
    name: plasmidId,
    description: "",
    version: "1.0.0",
    tier: "L2",
    scope: "local",
    privacy: "local-only",
    created: "2026-01-01T00:00:00Z",
    updated: "2026-01-01T00:00:00Z",
  } as PlasmidMetadata;
  return {
    plasmidId: plasmidId as PlasmidId,
    plasmidVersion: "1.0.0",
    metadata: meta,
    bodyFingerprint: "f1" as PlasmidFingerprint,
    summary: "",
    intents,
    tier: "L2",
    interpretedAt: "2026-01-01T00:00:00Z",
    strategyUsed: "single-pass",
    cacheKey: `${plasmidId}:f1`,
  };
}

describe("buildDeterministicPlan", () => {
  it("inserts new intents after the last marker", () => {
    const before = parse(
      "# Dhelix\n\nUser content.\n<!-- BEGIN plasmid-derived: owasp-gate/security-posture -->\nold\n<!-- END plasmid-derived: owasp-gate/security-posture -->\n",
    );
    const plan = buildDeterministicPlan({
      beforeTree: before,
      irs: [
        ir("owasp-gate", [intent({ title: "Security Posture" })]),
        ir("team-pr", [
          intent({ title: "PR Title Format", sourcePlasmid: "team-pr" as PlasmidId }),
        ]),
      ],
      preReorgContentHash: "c",
      intentGraphHash: "i",
    });
    const inserts = plan.ops.filter((o) => o.kind === "insert");
    expect(inserts).toHaveLength(1);
    expect(inserts[0].markerId).toBe("team-pr/pr-title-format");
    expect(inserts[0].locationAfter).toBe("owasp-gate/security-posture");
  });

  it("appends to EOF when no markers exist yet", () => {
    const before = parse("# Dhelix\n\nUser only.\n");
    const plan = buildDeterministicPlan({
      beforeTree: before,
      irs: [ir("owasp-gate", [intent({ title: "Security Posture" })])],
      preReorgContentHash: "c",
      intentGraphHash: "i",
    });
    expect(plan.ops.map((o) => o.kind)).toEqual(["insert"]);
    expect(plan.ops[0].locationAfter).toBe("__END_OF_FILE__");
  });

  it("removes markers whose plasmid is no longer active", () => {
    const before = parse(
      "<!-- BEGIN plasmid-derived: gone-plasmid/stale -->\nold\n<!-- END plasmid-derived: gone-plasmid/stale -->\n",
    );
    const plan = buildDeterministicPlan({
      beforeTree: before,
      irs: [],
      preReorgContentHash: "c",
      intentGraphHash: "i",
    });
    expect(plan.ops).toEqual([
      {
        kind: "remove",
        markerId: "gone-plasmid/stale",
        heading: "",
        body: "",
      },
    ]);
  });

  it("emits `update` when the body diverges from the intent", () => {
    const before = parse(
      "<!-- BEGIN plasmid-derived: owasp-gate/security-posture -->\noutdated body\n<!-- END plasmid-derived: owasp-gate/security-posture -->\n",
    );
    const plan = buildDeterministicPlan({
      beforeTree: before,
      irs: [
        ir("owasp-gate", [
          intent({ title: "Security Posture", description: "Refreshed text." }),
        ]),
      ],
      preReorgContentHash: "c",
      intentGraphHash: "i",
    });
    expect(plan.ops.map((o) => o.kind)).toEqual(["update"]);
    const op = plan.ops[0];
    expect(op.markerId).toBe("owasp-gate/security-posture");
    expect(op.body).toContain("Refreshed text.");
    expect(op.heading).toBe("Security Posture");
  });

  it("keeps markers with byte-identical bodies (no op, tracked in keptMarkerIds)", () => {
    const descIntent = intent({
      title: "Security Posture",
      description: "Keep me.",
    });
    const existingBody = `## Security Posture\n\nKeep me.`;
    const before = parse(
      `<!-- BEGIN plasmid-derived: owasp-gate/security-posture -->\n${existingBody}\n<!-- END plasmid-derived: owasp-gate/security-posture -->\n`,
    );
    const plan = buildDeterministicPlan({
      beforeTree: before,
      irs: [ir("owasp-gate", [descIntent])],
      preReorgContentHash: "c",
      intentGraphHash: "i",
    });
    expect(plan.ops).toEqual([]);
    expect(plan.keptMarkerIds).toEqual(["owasp-gate/security-posture"]);
  });

  it("labels the plan with `deterministic-only` tier", () => {
    const plan = buildDeterministicPlan({
      beforeTree: parse(""),
      irs: [],
      preReorgContentHash: "c",
      intentGraphHash: "i",
    });
    expect(plan.fallbackTier).toBe("deterministic-only");
  });
});
