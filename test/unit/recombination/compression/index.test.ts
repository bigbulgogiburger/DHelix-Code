import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  COMPRESSION_VERSION,
  compress,
} from "../../../../src/recombination/compression/index.js";
import type {
  LLMCompletionFn,
  PipelineStrategies,
} from "../../../../src/recombination/types.js";

import { makeIR, makeIntent } from "./_fixtures.js";

function cloudStrategies(): PipelineStrategies {
  return {
    interpreter: "single-pass",
    compression: "abstractive",
    reorgFallback: "llm-only",
    validationVolume: "standard",
    validationParallelism: 10,
    gradingTiers: ["deterministic", "semi", "llm"],
    passThresholds: { L1: 0.95, L2: 0.8, L3: 0.7, L4: 0.6 },
    projectProfile: "full-llm",
    artifactGeneration: "template-and-llm",
    interpreterRetries: 1,
  };
}

function localSmallStrategies(): PipelineStrategies {
  return {
    interpreter: "field-by-field",
    compression: "extractive",
    reorgFallback: "deterministic-only",
    validationVolume: "minimal",
    validationParallelism: 1,
    gradingTiers: ["deterministic"],
    passThresholds: { L1: 0.85, L2: 0.6, L3: 0.5, L4: 0.4 },
    projectProfile: "static-template",
    artifactGeneration: "template-only",
    interpreterRetries: 3,
  };
}

describe("compress (Stage 2c public entry)", () => {
  let working: string;

  beforeEach(async () => {
    working = await mkdtemp(join(tmpdir(), "compress-e2e-"));
    await writeFile(
      join(working, "package.json"),
      JSON.stringify({ name: "e2e-demo", version: "0.0.1" }),
      { encoding: "utf8" },
    );
  });

  afterEach(async () => {
    await rm(working, { recursive: true, force: true });
  });

  it("exports a version string", () => {
    expect(COMPRESSION_VERSION).toMatch(/^\d+\.\d+\.\d+$/u);
  });

  it("returns an empty-but-valid output for zero plasmids (static template)", async () => {
    const llm: LLMCompletionFn = vi.fn(async () => "");
    const result = await compress({
      irs: [],
      strategies: localSmallStrategies(),
      workingDirectory: working,
      llm,
    });
    expect(result.summaries).toEqual([]);
    expect(result.sections).toEqual([]);
    expect(result.projectProfileMarkdown).toContain("## Project Profile");
    expect(result.budgetTokens).toBeGreaterThan(0);
    expect(result.droppedPlasmidIds).toEqual([]);
    expect(llm).not.toHaveBeenCalled();
  });

  it("runs the full 4-layer pipeline with multiple plasmids (abstractive)", async () => {
    const llm = vi.fn<LLMCompletionFn>().mockImplementation(async (req) => {
      if (req.user.includes("Plasmid ID: owasp-gate")) {
        return "Require OWASP Top 10 review. NEVER commit secrets.";
      }
      if (req.user.includes("Plasmid ID: lint-rule")) {
        return "Enforce ESLint recommended profile; fail CI on errors.";
      }
      return "Project profile summary for the demo package.";
    });

    const irs = [
      makeIR({
        id: "owasp-gate",
        tier: "L2",
        intents: [
          makeIntent("owasp-gate", {
            kind: "rule",
            constraints: ["NEVER commit secrets"],
          }),
        ],
      }),
      makeIR({
        id: "lint-rule",
        tier: "L1",
        intents: [
          makeIntent("lint-rule", { kind: "rule", constraints: [] }),
        ],
      }),
      makeIR({
        id: "team-skill",
        tier: "L2",
        intents: [makeIntent("team-skill", { kind: "skill" })],
      }),
    ];

    const result = await compress({
      irs,
      strategies: cloudStrategies(),
      workingDirectory: working,
      llm,
    });

    expect(result.summaries.length).toBe(3);
    expect(result.droppedPlasmidIds).toEqual([]);
    expect(result.projectProfileMarkdown).toContain("Project Profile");
    // Expect at least 2 bucket files — constraints + capabilities.
    const buckets = new Set(result.sections.map((s) => s.bucket));
    expect(buckets.has("constraints")).toBe(true);
    expect(buckets.has("capabilities")).toBe(true);
    expect(result.totalTokenEstimate).toBeGreaterThan(0);
    expect(result.budgetTokens).toBeGreaterThanOrEqual(300);
  });

  it("drops lowest-tier plasmids when the Layer-B total exceeds budget", async () => {
    // Pad intent descriptions so extractive output is large per plasmid.
    const bigBody = "x".repeat(2000);
    const irs = Array.from({ length: 12 }, (_, i) =>
      makeIR({
        id: `plasmid-${String(i).padStart(2, "0")}`,
        tier: i < 6 ? "L1" : "L4",
        intents: [
          makeIntent(`plasmid-${String(i).padStart(2, "0")}`, {
            description: bigBody,
          }),
        ],
      }),
    );
    const llm: LLMCompletionFn = vi.fn(async () => "unused");
    const result = await compress({
      irs,
      strategies: localSmallStrategies(),
      workingDirectory: working,
      llm,
    });
    expect(result.droppedPlasmidIds.length).toBeGreaterThan(0);
    // Every dropped id must be prefixed by one of the L1 tier (lowest) ones.
    const droppedLowerTier = result.droppedPlasmidIds.every((id) => {
      const index = Number(id.toString().split("-")[1]);
      return index < 6;
    });
    expect(droppedLowerTier).toBe(true);
  });

  it("never leaks raw plasmid body via the LLM prompt", async () => {
    const captures: Array<{ system: string; user: string }> = [];
    const llm: LLMCompletionFn = vi.fn(async (req) => {
      captures.push({ system: req.system, user: req.user });
      return "Safe summary.";
    });
    const irs = [
      makeIR({
        id: "leaky",
        intents: [makeIntent("leaky", { description: "REDACTED-BODY" })],
      }),
    ];
    await compress({
      irs,
      strategies: cloudStrategies(),
      workingDirectory: working,
      llm,
    });
    // description is fine to appear — it's part of the IR — but raw body
    // tokens like the `bodyFingerprint` should never cross.
    for (const { user } of captures) {
      expect(user).not.toContain("a".repeat(64));
    }
  });

  it("propagates abort errors instead of swallowing them", async () => {
    const controller = new AbortController();
    controller.abort();
    const llm: LLMCompletionFn = vi.fn(async () => "");
    await expect(
      compress({
        irs: [makeIR()],
        strategies: cloudStrategies(),
        workingDirectory: working,
        llm,
        signal: controller.signal,
      }),
    ).rejects.toThrow(/aborted/);
  });

  it("is deterministic when given the same input twice", async () => {
    const llm = vi.fn<LLMCompletionFn>().mockResolvedValue("Stable summary.");
    const irs = [
      makeIR({
        id: "alpha",
        intents: [makeIntent("alpha", { kind: "rule" })],
      }),
    ];
    const first = await compress({
      irs,
      strategies: cloudStrategies(),
      workingDirectory: working,
      llm,
    });
    const second = await compress({
      irs,
      strategies: cloudStrategies(),
      workingDirectory: working,
      llm,
    });
    expect(second.summaries.map((s) => s.plasmidId)).toEqual(
      first.summaries.map((s) => s.plasmidId),
    );
    expect(second.sections.map((s) => s.relativePath)).toEqual(
      first.sections.map((s) => s.relativePath),
    );
  });
});
