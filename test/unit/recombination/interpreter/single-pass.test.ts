/**
 * Unit tests for the single-pass interpreter strategy.
 */
import { describe, expect, it, vi } from "vitest";

import {
  InterpreterJsonFailureError,
  RecombinationAbortedError,
  assemblePlasmidIR,
  parseAndValidate,
  runSinglePass,
  stripJsonFences,
} from "../../../../src/recombination/interpreter/single-pass.js";
import type {
  LLMCompletionFn,
  LLMCompletionRequest,
  LoadedPlasmid,
  PlasmidFingerprint,
  PlasmidId,
  PlasmidMetadata,
} from "../../../../src/recombination/types.js";

const META: PlasmidMetadata = {
  id: "owasp-gate" as PlasmidId,
  name: "owasp-gate",
  description: "Guard commits against OWASP Top 10 leaks.",
  version: "0.1.0",
  tier: "L2",
  scope: "local",
  privacy: "local-only",
  created: "2026-01-01T00:00:00Z",
  updated: "2026-01-02T00:00:00Z",
};

const PLASMID: LoadedPlasmid = {
  metadata: META,
  body: "## Intent\nBlock insecure commits.\n",
  bodyFingerprint: "deadbeef" as PlasmidFingerprint,
  evalCases: [],
  sourcePath: "/tmp/owasp-gate/body.md",
  metadataPath: "/tmp/owasp-gate/metadata.yaml",
  scopeOrigin: "local",
};

function canned(jsonResponses: readonly string[]): LLMCompletionFn {
  let i = 0;
  return vi.fn<(req: LLMCompletionRequest) => Promise<string>>(async () => {
    const v = jsonResponses[Math.min(i, jsonResponses.length - 1)];
    i += 1;
    if (v === undefined) throw new Error("exhausted canned responses");
    return v;
  });
}

function throwingStub(): LLMCompletionFn {
  return vi.fn<(req: LLMCompletionRequest) => Promise<string>>(async () => {
    throw new Error("llm fail");
  });
}

const GOOD_JSON = JSON.stringify({
  summary: "Guard against OWASP Top 10 leaks.",
  intents: [
    {
      kind: "hook",
      title: "Block secret leaks",
      description: "Reject commits that contain high-entropy tokens.",
      constraints: ["entropy >= 4.5"],
      evidence: ["OWASP A02"],
      params: { event: "PreToolUse" },
    },
  ],
});

describe("stripJsonFences", () => {
  it("removes ```json fences", () => {
    expect(stripJsonFences("```json\n{\"a\":1}\n```")).toContain("{\"a\":1}");
  });
  it("leaves unfenced text alone", () => {
    expect(stripJsonFences("{\"a\":1}")).toBe("{\"a\":1}");
  });
});

describe("parseAndValidate", () => {
  it("accepts valid payloads", () => {
    const payload = parseAndValidate(GOOD_JSON);
    expect(payload.intents).toHaveLength(1);
  });
  it("throws on empty", () => {
    expect(() => parseAndValidate("   ")).toThrow();
  });
  it("throws on invalid JSON", () => {
    expect(() => parseAndValidate("not json")).toThrow();
  });
  it("throws on schema mismatch", () => {
    expect(() => parseAndValidate(JSON.stringify({ intents: [{}] }))).toThrow();
  });
});

describe("runSinglePass", () => {
  it("succeeds on first try", async () => {
    const llm = canned([GOOD_JSON]);
    const out = await runSinglePass({
      plasmid: PLASMID,
      retries: 1,
      modelId: "gpt-4o",
      llm,
    });
    expect(out.payload.intents).toHaveLength(1);
    expect(out.warnings).toHaveLength(0);
    expect(llm).toHaveBeenCalledTimes(1);
  });

  it("retries on bad JSON then succeeds", async () => {
    const llm = canned(["not-json", GOOD_JSON]);
    const out = await runSinglePass({
      plasmid: PLASMID,
      retries: 1,
      modelId: "gpt-4o",
      llm,
    });
    expect(out.payload.intents).toHaveLength(1);
    expect(llm).toHaveBeenCalledTimes(2);
    expect(out.warnings).toHaveLength(0);
  });

  it("engages XML fallback after JSON exhaustion", async () => {
    const xml = `
      <plasmid>
        <summary>Fallback summary</summary>
        <intent kind="rule">
          <title>Fallback</title>
          <description>From XML.</description>
        </intent>
      </plasmid>`;
    const llm = canned(["bad1", "bad2", xml]);
    const out = await runSinglePass({
      plasmid: PLASMID,
      retries: 1,
      modelId: "gpt-4o",
      llm,
    });
    expect(out.warnings.some((w) => w.includes("xml-fallback"))).toBe(true);
    expect(out.payload.summary).toBe("Fallback summary");
    expect(llm).toHaveBeenCalledTimes(3);
  });

  it("throws InterpreterJsonFailureError when XML also fails", async () => {
    const llm = canned(["nope", "nope", "still nope"]);
    await expect(
      runSinglePass({ plasmid: PLASMID, retries: 1, modelId: "gpt-4o", llm }),
    ).rejects.toBeInstanceOf(InterpreterJsonFailureError);
  });

  it("aborts when signal is already tripped", async () => {
    const controller = new AbortController();
    controller.abort();
    const llm = throwingStub();
    await expect(
      runSinglePass({
        plasmid: PLASMID,
        retries: 1,
        modelId: "gpt-4o",
        llm,
        signal: controller.signal,
      }),
    ).rejects.toBeInstanceOf(RecombinationAbortedError);
    expect(llm).not.toHaveBeenCalled();
  });
});

describe("assemblePlasmidIR", () => {
  it("injects sourcePlasmid and defaults missing ids", () => {
    const ir = assemblePlasmidIR({
      plasmid: PLASMID,
      payload: {
        summary: "s",
        intents: [
          {
            kind: "hook",
            title: "Block me",
            description: "d",
            constraints: [],
            evidence: [],
            params: {},
          },
        ],
      },
      strategy: "single-pass",
      cacheKey: "cafebabe",
    });
    expect(ir.intents).toHaveLength(1);
    expect(ir.intents[0]?.sourcePlasmid).toBe(META.id);
    expect(ir.intents[0]?.id).toBe(`${META.id}:block-me`);
    expect(ir.cacheKey).toBe("cafebabe");
    expect(ir.strategyUsed).toBe("single-pass");
  });

  it("disambiguates duplicate ids with a numeric suffix", () => {
    const dupIntent = {
      kind: "rule" as const,
      title: "Same",
      description: "d",
      constraints: [],
      evidence: [],
      params: {},
    };
    const ir = assemblePlasmidIR({
      plasmid: PLASMID,
      payload: { summary: "s", intents: [dupIntent, dupIntent] },
      strategy: "single-pass",
      cacheKey: "k",
    });
    const ids = ir.intents.map((i) => i.id);
    expect(new Set(ids).size).toBe(2);
    expect(ids[1]).toMatch(/-2$/);
  });
});
