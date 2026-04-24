/**
 * Unit tests for `src/recombination/wiring-validator.ts` — Phase-2 MVP
 * static check set (reference, frontmatter, marker duplication, path
 * scoping, template drift, trivial cycle).
 */
import { describe, expect, it } from "vitest";

import type {
  GeneratedArtifact,
  ReorgPlan,
} from "../../../src/recombination/types.js";
import { validateWiring } from "../../../src/recombination/wiring-validator.js";
import type { PlasmidId } from "../../../src/plasmids/types.js";

function art(overrides: Partial<GeneratedArtifact> = {}): GeneratedArtifact {
  return {
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

describe("validateWiring — happy path", () => {
  it("returns passed=true for an empty artifact set + empty plan", async () => {
    const report = await validateWiring([], emptyReorg(), "/tmp/project");
    expect(report.passed).toBe(true);
    expect(report.findings).toHaveLength(0);
    expect(report.errorCount).toBe(0);
  });

  it("accepts well-formed artifacts that stay under .dhelix/ with proper frontmatter", async () => {
    const report = await validateWiring(
      [art()],
      emptyReorg(),
      "/tmp/project",
    );
    expect(report.passed).toBe(true);
    expect(report.errorCount).toBe(0);
  });

  it("tolerates namespace:tool references (mcp:foo)", async () => {
    // Phase 4: requires an explicit trustLevel for bash (T2+); pre-Phase-4
    // callers that omit trustLevel now trigger WIRING_PERMISSION_MISMATCH.
    const report = await validateWiring(
      [
        art({
          requiredTools: ["read", "mcp:whatever", "bash"],
          trustLevel: "T2",
        }),
      ],
      emptyReorg(),
      "/tmp/project",
    );
    expect(report.errorCount).toBe(0);
  });
});

describe("validateWiring — error findings", () => {
  it("flags unknown tool references as WIRING_REFERENCE_MISSING_TOOL", async () => {
    const report = await validateWiring(
      [art({ requiredTools: ["totally-unknown-tool"] })],
      emptyReorg(),
      "/tmp",
    );
    expect(report.passed).toBe(false);
    expect(report.errorCount).toBeGreaterThanOrEqual(1);
    expect(
      report.findings.some((f) => f.checkId === "WIRING_REFERENCE_MISSING_TOOL"),
    ).toBe(true);
  });

  it("flags paths outside .dhelix/ as WIRING_PATH_OUT_OF_SCOPE", async () => {
    const report = await validateWiring(
      [art({ targetPath: "/tmp/project/src/forbidden.md" })],
      emptyReorg(),
      "/tmp/project",
    );
    expect(report.passed).toBe(false);
    expect(
      report.findings.some((f) => f.checkId === "WIRING_PATH_OUT_OF_SCOPE"),
    ).toBe(true);
  });

  it("flags missing markdown frontmatter as WIRING_FRONTMATTER_SCHEMA", async () => {
    const report = await validateWiring(
      [
        art({
          contents: "# no frontmatter here\n",
          targetPath: "/tmp/.dhelix/rules/bare.md",
        }),
      ],
      emptyReorg(),
      "/tmp",
    );
    expect(
      report.findings.some((f) => f.checkId === "WIRING_FRONTMATTER_SCHEMA"),
    ).toBe(true);
  });

  it("flags unterminated YAML frontmatter as WIRING_SYNTAX_INVALID", async () => {
    const report = await validateWiring(
      [
        art({
          contents: "---\nname: orphan\ndescription: missing closer\n",
          targetPath: "/tmp/.dhelix/rules/orphan.md",
        }),
      ],
      emptyReorg(),
      "/tmp",
    );
    expect(
      report.findings.some((f) => f.checkId === "WIRING_SYNTAX_INVALID"),
    ).toBe(true);
  });

  it("flags duplicated reorg markers as WIRING_MARKER_DUPLICATE", async () => {
    const plan: ReorgPlan = {
      ...emptyReorg(),
      ops: [
        {
          kind: "insert",
          markerId: "m1",
          heading: "Heading",
          body: "body",
        },
        {
          kind: "update",
          markerId: "m1",
          heading: "Heading",
          body: "body",
        },
      ],
    };
    const report = await validateWiring([], plan, "/tmp");
    expect(
      report.findings.some((f) => f.checkId === "WIRING_MARKER_DUPLICATE"),
    ).toBe(true);
  });

  it("flags update ops with empty body as WIRING_MARKER_UNTERMINATED", async () => {
    const plan: ReorgPlan = {
      ...emptyReorg(),
      ops: [
        { kind: "update", markerId: "m1", heading: "H", body: "   " },
      ],
    };
    const report = await validateWiring([], plan, "/tmp");
    expect(
      report.findings.some((f) => f.checkId === "WIRING_MARKER_UNTERMINATED"),
    ).toBe(true);
  });

  it("flags self-referential ops as WIRING_CYCLIC_DEPENDENCY", async () => {
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
    const report = await validateWiring([], plan, "/tmp");
    expect(
      report.findings.some((f) => f.checkId === "WIRING_CYCLIC_DEPENDENCY"),
    ).toBe(true);
  });
});

describe("validateWiring — informational / warn findings", () => {
  it("emits INFO for hook artifacts missing trustLevel (default applied)", async () => {
    const report = await validateWiring(
      [
        art({
          kind: "hook",
          targetPath: "/tmp/.dhelix/hooks/x.md",
        }),
      ],
      emptyReorg(),
      "/tmp",
    );
    expect(report.infoCount).toBeGreaterThanOrEqual(1);
    expect(
      report.findings.some((f) => f.checkId === "WIRING_DEFAULT_TRUST_APPLIED"),
    ).toBe(true);
  });

  it("emits WARN for project-layer artifacts with no templateId", async () => {
    const report = await validateWiring(
      [
        art({
          templateLayer: "project",
          templateId: "",
        }),
      ],
      emptyReorg(),
      "/tmp",
    );
    expect(report.warnCount).toBeGreaterThanOrEqual(1);
    expect(
      report.findings.some((f) => f.checkId === "WIRING_TEMPLATE_DRIFT"),
    ).toBe(true);
  });
});

describe("validateWiring — abort handling", () => {
  it("throws when the supplied signal is already aborted", async () => {
    const ac = new AbortController();
    ac.abort();
    await expect(
      validateWiring([], emptyReorg(), "/tmp", ac.signal),
    ).rejects.toThrow(/aborted/);
  });
});
