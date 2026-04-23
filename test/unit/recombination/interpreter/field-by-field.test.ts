/**
 * Unit tests for the field-by-field interpreter strategy.
 */
import { describe, expect, it, vi } from "vitest";

import { runFieldByField } from "../../../../src/recombination/interpreter/field-by-field.js";
import type {
  LLMCompletionFn,
  LLMCompletionRequest,
  LoadedPlasmid,
  PlasmidFingerprint,
  PlasmidId,
  PlasmidMetadata,
} from "../../../../src/recombination/types.js";

const META: PlasmidMetadata = {
  id: "tiny-model-plasmid" as PlasmidId,
  name: "tiny",
  description: "fallback description",
  version: "0.1.0",
  tier: "L2",
  scope: "local",
  privacy: "local-only",
  created: "2026-01-01T00:00:00Z",
  updated: "2026-01-02T00:00:00Z",
};

const BODY = [
  "## Intent",
  "Block insecure commits.",
  "## Rules",
  "No hard-coded secrets.",
].join("\n");

const PLASMID: LoadedPlasmid = {
  metadata: META,
  body: BODY,
  bodyFingerprint: "ffffff" as PlasmidFingerprint,
  evalCases: [],
  sourcePath: "/tmp/tiny/body.md",
  metadataPath: "/tmp/tiny/metadata.yaml",
  scopeOrigin: "local",
};

/** Script an LLM that answers based on what the field-by-field prompt asks. */
function scriptedLlm(): LLMCompletionFn {
  return vi.fn<(req: LLMCompletionRequest) => Promise<string>>(async (req) => {
    if (req.user.includes('"kind":') || req.user.includes("kind:")) {
      // Return a supported kind for every section
      return JSON.stringify({ kind: "rule" });
    }
    if (req.user.includes('"title":')) {
      return JSON.stringify({ title: "synthesised title" });
    }
    if (req.user.includes('"description":')) {
      return JSON.stringify({ description: "synthesised description" });
    }
    if (req.user.includes('"constraints":')) {
      return JSON.stringify({ constraints: ["no secrets"] });
    }
    if (req.user.includes('"evidence":')) {
      return JSON.stringify({ evidence: ["OWASP"] });
    }
    if (req.user.includes('"summary":')) {
      return JSON.stringify({ summary: "A tiny plasmid." });
    }
    return JSON.stringify({ kind: "rule" });
  });
}

describe("runFieldByField", () => {
  it("assembles one intent per section from individual field calls", async () => {
    const llm = scriptedLlm();
    const out = await runFieldByField({
      plasmid: PLASMID,
      retries: 2,
      modelId: "llama3.1:8b",
      llm,
    });
    expect(out.payload.intents).toHaveLength(2);
    expect(out.payload.intents[0]?.title).toBe("synthesised title");
    expect(out.payload.intents[0]?.description).toBe("synthesised description");
    expect(out.payload.intents[0]?.constraints).toEqual(["no secrets"]);
    expect(out.payload.intents[0]?.evidence).toEqual(["OWASP"]);
    expect(out.payload.summary).toBe("A tiny plasmid.");
  });

  it("defaults unknown kinds from the section heading", async () => {
    const llm = vi.fn<(req: LLMCompletionRequest) => Promise<string>>(async (req) => {
      if (req.user.includes('"kind":')) {
        return JSON.stringify({ kind: "banana" }); // invalid
      }
      if (req.user.includes('"title":')) return JSON.stringify({ title: "t" });
      if (req.user.includes('"description":')) return JSON.stringify({ description: "d" });
      if (req.user.includes('"constraints":')) return JSON.stringify({ constraints: [] });
      if (req.user.includes('"evidence":')) return JSON.stringify({ evidence: [] });
      if (req.user.includes('"summary":')) return JSON.stringify({ summary: "s" });
      return "{}";
    });
    const out = await runFieldByField({
      plasmid: PLASMID,
      retries: 0,
      modelId: "llama3.1:8b",
      llm,
    });
    // "## Rules" heading → rule; "## Intent" heading → agent (no keyword match → default)
    expect(out.payload.intents.map((i) => i.kind)).toEqual(["agent", "rule"]);
  });

  it("falls back to metadata description when summary call fails", async () => {
    const llm = vi.fn<(req: LLMCompletionRequest) => Promise<string>>(async (req) => {
      if (req.user.includes('"summary":')) throw new Error("boom");
      if (req.user.includes('"kind":')) return JSON.stringify({ kind: "rule" });
      if (req.user.includes('"title":')) return JSON.stringify({ title: "t" });
      if (req.user.includes('"description":')) return JSON.stringify({ description: "d" });
      return JSON.stringify({ constraints: [], evidence: [] });
    });
    const out = await runFieldByField({
      plasmid: PLASMID,
      retries: 0,
      modelId: "llama3.1:8b",
      llm,
    });
    expect(out.payload.summary).toBe(META.description);
    expect(out.warnings.some((w) => w.includes("summary pass failed"))).toBe(true);
  });

  it("engages XML fallback when the LLM is unusable", async () => {
    // Every call throws → XML fallback engages → XML mode is deterministic
    // (uses section heading/body) so intents still populate.
    const llm = vi.fn<(req: LLMCompletionRequest) => Promise<string>>(async () => {
      throw new Error("llm down");
    });
    const out = await runFieldByField({
      plasmid: PLASMID,
      retries: 0,
      modelId: "llama3.1:8b",
      llm,
    });
    expect(out.payload.intents.length).toBeGreaterThan(0);
    expect(out.warnings.some((w) => w.includes("xml-fallback engaged"))).toBe(true);
    // And summary pass should also have failed since the XML summary LLM call throws too
    expect(out.payload.summary).toBe(META.description);
  });
});
