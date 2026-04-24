/**
 * Unit tests for the chunked interpreter strategy.
 */
import { describe, expect, it, vi } from "vitest";

import { runChunked, splitSections } from "../../../../src/recombination/interpreter/chunked.js";
import type {
  LLMCompletionFn,
  LLMCompletionRequest,
  LoadedPlasmid,
  PlasmidFingerprint,
  PlasmidId,
  PlasmidMetadata,
} from "../../../../src/recombination/types.js";

const META: PlasmidMetadata = {
  id: "multi-section" as PlasmidId,
  name: "multi",
  description: "fallback description",
  version: "0.1.0",
  tier: "L2",
  scope: "local",
  privacy: "local-only",
  created: "2026-01-01T00:00:00Z",
  updated: "2026-01-02T00:00:00Z",
};

const BODY = [
  "# Header",
  "",
  "## Intent",
  "Block commits with known CVEs.",
  "",
  "## Constraints",
  "- entropy >= 4.5",
  "",
  "## Evidence",
  "- OWASP A09",
].join("\n");

const PLASMID: LoadedPlasmid = {
  metadata: META,
  body: BODY,
  bodyFingerprint: "cccccc" as PlasmidFingerprint,
  evalCases: [],
  sourcePath: "/tmp/x/body.md",
  metadataPath: "/tmp/x/metadata.yaml",
  scopeOrigin: "local",
};

function makeLlm(responses: readonly string[]): LLMCompletionFn {
  let i = 0;
  return vi.fn<(req: LLMCompletionRequest) => Promise<string>>(async () => {
    const v = responses[Math.min(i, responses.length - 1)];
    i += 1;
    if (v === undefined) throw new Error("exhausted");
    if (v.startsWith("THROW")) throw new Error(v);
    return v;
  });
}

const SECTION_JSON = (title: string, kind = "rule"): string =>
  JSON.stringify({
    summary: `summary of ${title}`,
    intents: [
      {
        kind,
        title,
        description: `desc of ${title}`,
        constraints: [],
        evidence: [],
        params: {},
      },
    ],
  });

describe("splitSections", () => {
  it("splits on `## ` headings", () => {
    const sections = splitSections(BODY);
    // "# Header" is under Overview until the first ##; then 3 sections
    expect(sections.map((s) => s.name)).toEqual([
      "Overview",
      "Intent",
      "Constraints",
      "Evidence",
    ]);
  });

  it("returns empty array when body is empty", () => {
    expect(splitSections("")).toEqual([]);
  });

  it("ignores sections that contain only whitespace", () => {
    const body = "## A\n\n## B\nhello";
    const out = splitSections(body);
    expect(out.map((s) => s.name)).toEqual(["B"]);
  });
});

describe("runChunked", () => {
  it("merges intents across sections", async () => {
    const llm = makeLlm([
      SECTION_JSON("Overview line", "agent"),
      SECTION_JSON("Intent line", "hook"),
      SECTION_JSON("Constraint line", "rule"),
      SECTION_JSON("Evidence line", "rule"),
    ]);
    const out = await runChunked({
      plasmid: PLASMID,
      retries: 1,
      modelId: "llama3.1:70b",
      llm,
    });
    expect(out.payload.intents).toHaveLength(4);
    expect(llm).toHaveBeenCalledTimes(4);
  });

  it("skips first section then engages XML fallback after 2 consecutive failures", async () => {
    const xml = `
      <plasmid><summary>xmls</summary>
        <intent kind="rule"><title>xml-intent</title><description>d</description></intent>
      </plasmid>`;
    // section 1 good, sections 2+3 fail (with retries=0 that's 1 call each), section 4 xml.
    const llm = makeLlm([
      SECTION_JSON("A", "agent"),
      "nope",
      "nope",
      xml,
      xml,
    ]);
    const out = await runChunked({
      plasmid: PLASMID,
      retries: 0,
      modelId: "llama3.1:70b",
      llm,
    });
    expect(out.warnings.some((w) => w.includes("xml-fallback engaged"))).toBe(true);
  });

  it("falls back to metadata description when no summaries were collected", async () => {
    const llm = makeLlm(["nope", "nope", "nope", "nope", "nope", "nope", "nope", "nope"]);
    const out = await runChunked({
      plasmid: PLASMID,
      retries: 0,
      modelId: "llama3.1:70b",
      llm,
    });
    expect(out.payload.summary).toBe(META.description);
  });

  it("handles empty body without calling the LLM", async () => {
    const llm = vi.fn<(req: LLMCompletionRequest) => Promise<string>>();
    const out = await runChunked({
      plasmid: { ...PLASMID, body: "" },
      retries: 1,
      modelId: "x",
      llm,
    });
    expect(out.payload.intents).toHaveLength(0);
    expect(llm).not.toHaveBeenCalled();
  });
});
