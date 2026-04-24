/**
 * End-to-end interpreter tests at the `interpret()` boundary.
 */
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  INTERPRETER_VERSION,
  createDefaultLLM,
  interpret,
} from "../../../../src/recombination/interpreter/index.js";
import { buildCacheKey } from "../../../../src/recombination/interpreter/cache.js";
import type {
  InterpretRequest,
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
  description: "Guard commits.",
  version: "0.1.0",
  tier: "L2",
  scope: "local",
  privacy: "local-only",
  created: "2026-01-01T00:00:00Z",
  updated: "2026-01-02T00:00:00Z",
};

const PLASMID: LoadedPlasmid = {
  metadata: META,
  body: "## Intent\nBlock CVEs.\n",
  bodyFingerprint: "fingerprint-123" as PlasmidFingerprint,
  evalCases: [],
  sourcePath: "/tmp/x/body.md",
  metadataPath: "/tmp/x/metadata.yaml",
  scopeOrigin: "local",
};

const GOOD_JSON = JSON.stringify({
  summary: "Block known CVEs in commits.",
  intents: [
    {
      kind: "hook",
      title: "Block CVEs",
      description: "Fail commits touching known-vulnerable packages.",
      constraints: [],
      evidence: [],
      params: {},
    },
  ],
});

function cannedLlm(responses: readonly string[]): LLMCompletionFn {
  let i = 0;
  return vi.fn<(req: LLMCompletionRequest) => Promise<string>>(async () => {
    const v = responses[Math.min(i, responses.length - 1)];
    i += 1;
    if (v === undefined) throw new Error("exhausted");
    return v;
  });
}

let workdir: string;

beforeEach(async () => {
  workdir = await mkdtemp(join(tmpdir(), "dhelix-interp-"));
});

afterEach(async () => {
  await rm(workdir, { recursive: true, force: true });
});

function makeReq(overrides: Partial<InterpretRequest> = {}): InterpretRequest {
  return {
    plasmid: PLASMID,
    strategy: "single-pass",
    retries: 1,
    modelId: "gpt-4o",
    workingDirectory: workdir,
    llm: cannedLlm([GOOD_JSON]),
    ...overrides,
  };
}

describe("interpret (single-pass happy path)", () => {
  it("returns a CompiledPlasmidIR with intents", async () => {
    const result = await interpret(makeReq());
    expect(result.cacheHit).toBe(false);
    expect(result.ir.intents).toHaveLength(1);
    expect(result.ir.strategyUsed).toBe("single-pass");
    const expectedKey = buildCacheKey({
      bodyFingerprint: PLASMID.bodyFingerprint,
      modelId: "gpt-4o",
      strategy: "single-pass",
    });
    expect(result.ir.cacheKey).toBe(expectedKey);
  });

  it("populates INTERPRETER_VERSION as a semver string", () => {
    expect(INTERPRETER_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
  });
});

describe("interpret cache", () => {
  it("returns cacheHit=true on the second call with the same key", async () => {
    const llm = cannedLlm([GOOD_JSON, "SHOULD-NOT-BE-CALLED"]);
    const first = await interpret(makeReq({ llm }));
    expect(first.cacheHit).toBe(false);

    const second = await interpret(makeReq({ llm }));
    expect(second.cacheHit).toBe(true);
    expect(second.warnings).toEqual([]);
    // Only the first run should call the LLM
    expect(llm).toHaveBeenCalledTimes(1);
    // IRs should be equivalent (different interpretedAt is fine)
    expect(second.ir.cacheKey).toBe(first.ir.cacheKey);
    expect(second.ir.intents).toHaveLength(1);
  });

  it("cache miss on model change", async () => {
    const llm1 = cannedLlm([GOOD_JSON]);
    await interpret(makeReq({ llm: llm1, modelId: "gpt-4o" }));
    const llm2 = cannedLlm([GOOD_JSON]);
    const second = await interpret(makeReq({ llm: llm2, modelId: "gpt-4o-mini" }));
    expect(second.cacheHit).toBe(false);
    expect(llm2).toHaveBeenCalledTimes(1);
  });

  it("cache miss on strategy change", async () => {
    const llm1 = cannedLlm([GOOD_JSON]);
    await interpret(makeReq({ llm: llm1, strategy: "single-pass" }));
    const llm2 = cannedLlm([
      // chunked calls once per section; body has one section "Intent"
      GOOD_JSON,
    ]);
    const second = await interpret(
      makeReq({ llm: llm2, strategy: "chunked", retries: 0 }),
    );
    expect(second.cacheHit).toBe(false);
  });
});

describe("interpret guards", () => {
  it("rejects non-function llm", async () => {
    await expect(
      interpret({
        ...makeReq(),
        llm: undefined as unknown as LLMCompletionFn,
      }),
    ).rejects.toThrow(/req\.llm must be a function/);
  });

  it("rejects missing modelId", async () => {
    await expect(
      interpret({ ...makeReq(), modelId: "" }),
    ).rejects.toThrow(/modelId/);
  });

  it("rejects negative retries", async () => {
    await expect(interpret({ ...makeReq(), retries: -1 })).rejects.toThrow(/retries/);
  });

  it("rejects empty workingDirectory", async () => {
    await expect(
      interpret({ ...makeReq(), workingDirectory: "" }),
    ).rejects.toThrow(/workingDirectory/);
  });

  it("aborts when signal is already tripped", async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(
      interpret({ ...makeReq(), signal: controller.signal }),
    ).rejects.toThrow(/aborted/i);
  });
});

describe("createDefaultLLM", () => {
  it("returns a callable wrapping the project's LLM client factory", () => {
    // We do not issue a real network call; just assert the shape. Wiring is
    // exercised end-to-end by Team 5's executor tests.
    const llm = createDefaultLLM({
      model: "gpt-4o",
      baseURL: "http://localhost:9",
      apiKey: "sk-fake",
    });
    expect(typeof llm).toBe("function");
  });
});

describe("interpret strategy dispatch", () => {
  it("routes to chunked strategy", async () => {
    const llm = cannedLlm([GOOD_JSON]);
    const result = await interpret(
      makeReq({ strategy: "chunked", retries: 0, llm }),
    );
    expect(result.ir.strategyUsed).toBe("chunked");
  });

  it("routes to field-by-field strategy", async () => {
    const llm = vi.fn<(req: LLMCompletionRequest) => Promise<string>>(async (req) => {
      if (req.user.includes('"summary":')) return JSON.stringify({ summary: "s" });
      if (req.user.includes('"kind":')) return JSON.stringify({ kind: "rule" });
      if (req.user.includes('"title":')) return JSON.stringify({ title: "t" });
      if (req.user.includes('"description":')) return JSON.stringify({ description: "d" });
      if (req.user.includes('"constraints":')) return JSON.stringify({ constraints: [] });
      if (req.user.includes('"evidence":')) return JSON.stringify({ evidence: [] });
      return "{}";
    });
    const result = await interpret(
      makeReq({ strategy: "field-by-field", retries: 0, llm }),
    );
    expect(result.ir.strategyUsed).toBe("field-by-field");
    expect(result.ir.intents.length).toBeGreaterThan(0);
  });
});
