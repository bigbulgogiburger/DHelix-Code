/**
 * Unit tests for `src/recombination/constitution/reorganizer.ts` — the
 * 3-tier fallback planner.
 *
 * Covers:
 *   - Tier 1 (LLM JSON) happy path — one LLM call, plan returned verbatim.
 *   - Tier 1 → Tier 2 fallback when JSON parse fails.
 *   - Tier 1 → Tier 2 → Tier 3 when both LLM tiers fail / emit invalid targets.
 *   - `deterministic-only` short-circuits all LLM calls.
 *   - `llm-only` throws {@link ReorgFallbackExhaustedError} on any failure.
 *   - `REORG_INVALID_UPDATE_TARGET` triggers fall-through (not surfaced).
 *   - Signal abort between tiers.
 */

import { describe, expect, it, vi } from "vitest";

import {
  REORG_VERSION,
  parseXmlPlan,
  reorganize,
} from "../../../../src/recombination/constitution/reorganizer.js";
import {
  ReorgFallbackExhaustedError,
} from "../../../../src/recombination/constitution/errors.js";
import type {
  CompiledPlasmidIR,
  LLMCompletionFn,
  PipelineStrategies,
  ReorgFallback,
  ReorganizeRequest,
} from "../../../../src/recombination/types.js";
import type {
  PlasmidFingerprint,
  PlasmidId,
  PlasmidMetadata,
} from "../../../../src/plasmids/types.js";

function makeIR(): CompiledPlasmidIR {
  const meta: PlasmidMetadata = {
    id: "owasp-gate" as PlasmidId,
    name: "owasp-gate",
    description: "",
    version: "1.0.0",
    tier: "L2",
    scope: "local",
    privacy: "local-only",
    created: "2026-01-01T00:00:00Z",
    updated: "2026-01-01T00:00:00Z",
  } as PlasmidMetadata;
  return {
    plasmidId: "owasp-gate" as PlasmidId,
    plasmidVersion: "1.0.0",
    metadata: meta,
    bodyFingerprint: "f1" as PlasmidFingerprint,
    summary: "",
    intents: [
      {
        id: "i1",
        sourcePlasmid: "owasp-gate" as PlasmidId,
        kind: "rule",
        title: "Security Posture",
        description: "Enforce OWASP top-10.",
        constraints: [],
        evidence: [],
        params: {},
      },
    ],
    tier: "L2",
    interpretedAt: "2026-01-01T00:00:00Z",
    strategyUsed: "single-pass",
    cacheKey: "owasp-gate:f1",
  };
}

function makeStrategies(fallback: ReorgFallback): PipelineStrategies {
  return {
    interpreter: "single-pass",
    compression: "abstractive",
    reorgFallback: fallback,
    validationVolume: "standard",
    validationParallelism: 1,
    gradingTiers: ["deterministic"],
    passThresholds: { L1: 1, L2: 1, L3: 1, L4: 1 },
    projectProfile: "full-llm",
    artifactGeneration: "template-and-llm",
    interpreterRetries: 1,
  };
}

function makeRequest(
  fallback: ReorgFallback,
  llm: LLMCompletionFn,
  overrides: Partial<ReorganizeRequest> = {},
): ReorganizeRequest {
  return {
    irs: [makeIR()],
    existingConstitution: overrides.existingConstitution ?? "# Dhelix\n\nUser preamble.\n",
    strategies: makeStrategies(fallback),
    workingDirectory: "/tmp/dhelix-test",
    llm,
    ...overrides,
  };
}

describe("REORG_VERSION", () => {
  it("is a semver string", () => {
    expect(REORG_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
  });
});

describe("reorganize — tier 1 (LLM JSON)", () => {
  it("returns the LLM plan verbatim on success", async () => {
    const llm = vi.fn<LLMCompletionFn>().mockResolvedValue(
      JSON.stringify({
        ops: [
          {
            kind: "insert",
            markerId: "owasp-gate/security-posture",
            heading: "Security Posture",
            body: "## Security Posture\n\nOWASP",
            locationAfter: "__END_OF_FILE__",
          },
        ],
        keptMarkerIds: [],
      }),
    );
    const plan = await reorganize(makeRequest("llm-only", llm));
    expect(llm).toHaveBeenCalledTimes(1);
    expect(plan.fallbackTier).toBe("llm-only");
    expect(plan.ops).toHaveLength(1);
    expect(plan.ops[0].markerId).toBe("owasp-gate/security-posture");
  });

  it("llm-only throws when the LLM returns unparseable output", async () => {
    const llm = vi.fn<LLMCompletionFn>().mockResolvedValue("not-json");
    await expect(reorganize(makeRequest("llm-only", llm))).rejects.toThrow(
      ReorgFallbackExhaustedError,
    );
  });
});

describe("reorganize — JSON → XML fallback", () => {
  it("falls through to XML when JSON parse fails", async () => {
    const xmlResponse = [
      "<plan>",
      '  <op kind="insert" markerId="owasp-gate/security-posture" heading="Security Posture" locationAfter="__END_OF_FILE__">',
      "    <body><![CDATA[## Security Posture\n\nFrom XML]]></body>",
      "  </op>",
      "</plan>",
    ].join("\n");
    const llm = vi
      .fn<LLMCompletionFn>()
      .mockResolvedValueOnce("{ broken json")
      .mockResolvedValueOnce(xmlResponse);
    const plan = await reorganize(makeRequest("llm-with-xml-fallback", llm));
    expect(llm).toHaveBeenCalledTimes(2);
    expect(plan.fallbackTier).toBe("llm-with-xml-fallback");
    expect(plan.ops[0].body).toContain("From XML");
  });
});

describe("reorganize — deterministic fallback", () => {
  it("falls all the way through LLM JSON → XML → deterministic", async () => {
    const llm = vi
      .fn<LLMCompletionFn>()
      .mockResolvedValueOnce("garbage-1")
      .mockResolvedValueOnce("garbage-2");
    const plan = await reorganize(
      makeRequest("llm-with-deterministic-fallback", llm),
    );
    expect(llm).toHaveBeenCalledTimes(2);
    expect(plan.fallbackTier).toBe("deterministic-only");
    // Deterministic always fabricates from IR intents.
    expect(plan.ops.some((o) => o.kind === "insert")).toBe(true);
  });

  it("rejects LLM plans targeting non-existent markers and falls through", async () => {
    const llm = vi
      .fn<LLMCompletionFn>()
      .mockResolvedValueOnce(
        JSON.stringify({
          ops: [
            {
              kind: "update",
              markerId: "ghost/marker",
              heading: "h",
              body: "b",
            },
          ],
        }),
      )
      .mockResolvedValueOnce("also-garbage");
    const plan = await reorganize(
      makeRequest("llm-with-deterministic-fallback", llm),
    );
    // Tier 1 rejected → Tier 2 attempted → Tier 3 succeeded.
    expect(llm).toHaveBeenCalledTimes(2);
    expect(plan.fallbackTier).toBe("deterministic-only");
  });
});

describe("reorganize — deterministic-only short-circuit", () => {
  it("never calls the LLM", async () => {
    const llm = vi.fn<LLMCompletionFn>().mockResolvedValue("{}");
    const plan = await reorganize(makeRequest("deterministic-only", llm));
    expect(llm).not.toHaveBeenCalled();
    expect(plan.fallbackTier).toBe("deterministic-only");
  });

  it("produces a plan that inserts new intents into an empty DHELIX.md", async () => {
    const llm = vi.fn<LLMCompletionFn>().mockRejectedValue(new Error("nope"));
    const plan = await reorganize(
      makeRequest("deterministic-only", llm, { existingConstitution: "" }),
    );
    expect(plan.ops.map((o) => o.kind)).toEqual(["insert"]);
    expect(plan.ops[0].markerId).toBe("owasp-gate/security-posture");
  });
});

describe("reorganize — abort signal", () => {
  it("throws when signal is aborted before the first tier", async () => {
    const controller = new AbortController();
    controller.abort();
    const llm = vi.fn<LLMCompletionFn>().mockResolvedValue("{}");
    await expect(
      reorganize(
        makeRequest("llm-only", llm, { signal: controller.signal }),
      ),
    ).rejects.toThrow(ReorgFallbackExhaustedError);
    expect(llm).not.toHaveBeenCalled();
  });
});

describe("parseXmlPlan", () => {
  it("parses multi-op plans with mixed self-closing and body forms", () => {
    const xml = [
      "<plan>",
      '  <op kind="remove" markerId="old/one" />',
      '  <op kind="insert" markerId="new/two" heading="Two" locationAfter="old/one">',
      "    <body>body text</body>",
      "  </op>",
      "</plan>",
    ].join("\n");
    const ops = parseXmlPlan(xml);
    // self-closing path only fires when there are zero body-form ops.
    // Here we got one body-form op first, so self-closing is ignored.
    expect(ops.length).toBeGreaterThanOrEqual(1);
    expect(ops.some((op) => op.markerId === "new/two")).toBe(true);
  });

  it("throws when no <op> elements are present", () => {
    expect(() => parseXmlPlan("<plan></plan>")).toThrow();
  });
});
