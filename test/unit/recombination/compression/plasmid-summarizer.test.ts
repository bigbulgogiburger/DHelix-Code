import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { summarizePlasmid } from "../../../../src/recombination/compression/plasmid-summarizer.js";
import type { LLMCompletionFn } from "../../../../src/recombination/types.js";

import { makeIR, makeIntent } from "./_fixtures.js";

describe("summarizePlasmid", () => {
  let working: string;

  beforeEach(async () => {
    working = await mkdtemp(join(tmpdir(), "summarizer-"));
  });

  afterEach(async () => {
    await rm(working, { recursive: true, force: true });
  });

  it("takes the extractive path without ever calling the LLM", async () => {
    const llm: LLMCompletionFn = vi.fn(async () => "SHOULD NOT BE CALLED");
    const ir = makeIR({
      id: "extract-only",
      tier: "L1",
      intents: [
        makeIntent("extract-only", { title: "short", description: "short desc" }),
      ],
    });
    const result = await summarizePlasmid({
      ir,
      bucket: "constraints",
      strategy: "extractive",
      modelId: "mock",
      workingDirectory: working,
      llm,
      signal: undefined,
    });
    expect(llm).not.toHaveBeenCalled();
    expect(result.cacheHit).toBe(false);
    expect(result.downgraded).toBe(false);
    expect(result.summary.plasmidId).toBe(ir.plasmidId);
    expect(result.summary.markdown).toContain("extract-only");
  });

  it("invokes the LLM once for the abstractive path when constraints are preserved", async () => {
    const constraint = "NEVER commit secrets";
    const llm: LLMCompletionFn = vi.fn(
      async () =>
        `Summary describing behaviour. The rule is: NEVER commit secrets. Always redact.`,
    );
    const ir = makeIR({
      id: "abstract-ok",
      intents: [makeIntent("abstract-ok", { constraints: [constraint] })],
    });
    const result = await summarizePlasmid({
      ir,
      bucket: "constraints",
      strategy: "abstractive",
      modelId: "mock",
      workingDirectory: working,
      llm,
    });
    expect(llm).toHaveBeenCalledTimes(1);
    expect(result.summary.preservedConstraints).toContain(constraint);
    expect(result.summary.markdown).toContain("NEVER commit secrets");
    expect(result.downgraded).toBe(false);
  });

  it("retries when the first LLM output drops a constraint", async () => {
    const llm = vi
      .fn<LLMCompletionFn>()
      .mockResolvedValueOnce("Summary without the magic phrase anywhere.")
      .mockResolvedValueOnce(
        "Summary including NEVER commit secrets verbatim as required.",
      );
    const ir = makeIR({
      id: "retry-ok",
      intents: [
        makeIntent("retry-ok", { constraints: ["NEVER commit secrets"] }),
      ],
    });
    const result = await summarizePlasmid({
      ir,
      bucket: "constraints",
      strategy: "abstractive",
      modelId: "mock",
      workingDirectory: working,
      llm,
    });
    expect(llm).toHaveBeenCalledTimes(2);
    expect(result.downgraded).toBe(false);
    expect(result.summary.markdown).toContain("NEVER commit secrets");
  });

  it("downgrades to extractive when both LLM attempts drop a constraint", async () => {
    const llm: LLMCompletionFn = vi.fn(async () => "Summary that ignores rules.");
    const ir = makeIR({
      id: "downgrade",
      intents: [makeIntent("downgrade", { constraints: ["MUST be idempotent"] })],
    });
    const result = await summarizePlasmid({
      ir,
      bucket: "constraints",
      strategy: "abstractive",
      modelId: "mock",
      workingDirectory: working,
      llm,
    });
    expect(llm).toHaveBeenCalledTimes(2);
    expect(result.downgraded).toBe(true);
    // Extractive output always includes the frontmatter id.
    expect(result.summary.markdown).toContain("downgrade");
  });

  it("caches abstractive success and short-circuits on the second call", async () => {
    const llm: LLMCompletionFn = vi.fn(
      async () => "Summary preserving the constraint NEVER break.",
    );
    const ir = makeIR({
      id: "cache-me",
      intents: [makeIntent("cache-me", { constraints: ["NEVER break"] })],
    });
    const first = await summarizePlasmid({
      ir,
      bucket: "constraints",
      strategy: "abstractive",
      modelId: "mock",
      workingDirectory: working,
      llm,
    });
    expect(first.cacheHit).toBe(false);

    const second = await summarizePlasmid({
      ir,
      bucket: "constraints",
      strategy: "abstractive",
      modelId: "mock",
      workingDirectory: working,
      llm,
    });
    expect(second.cacheHit).toBe(true);
    expect(llm).toHaveBeenCalledTimes(1);
    expect(second.summary.cacheKey).toBe(first.summary.cacheKey);
  });

  it("downgrades when the LLM throws on both attempts", async () => {
    const llm: LLMCompletionFn = vi.fn(async () => {
      throw new Error("boom");
    });
    const ir = makeIR({
      id: "error-case",
      intents: [makeIntent("error-case", { constraints: ["NO magic"] })],
    });
    const result = await summarizePlasmid({
      ir,
      bucket: "constraints",
      strategy: "abstractive",
      modelId: "mock",
      workingDirectory: working,
      llm,
    });
    expect(result.downgraded).toBe(true);
    expect(result.summary.plasmidId).toBe(ir.plasmidId);
  });

  it("never leaks the plasmid body into the LLM prompt", async () => {
    const capture: { system?: string; user?: string } = {};
    const llm: LLMCompletionFn = vi.fn(async (req) => {
      capture.system = req.system;
      capture.user = req.user;
      return "Ok summary.";
    });
    const ir = makeIR({
      id: "no-leak",
      summary: "INTERPRETED summary only",
      intents: [makeIntent("no-leak")],
    });
    await summarizePlasmid({
      ir,
      bucket: "capabilities",
      strategy: "abstractive",
      modelId: "mock",
      workingDirectory: working,
      llm,
    });
    expect(capture.user).toContain("INTERPRETED summary only");
    expect(capture.user).not.toContain("body");
  });

  it("aborts via signal before calling the LLM", async () => {
    const controller = new AbortController();
    controller.abort();
    const llm: LLMCompletionFn = vi.fn(async () => "");
    const ir = makeIR({ id: "aborted" });
    await expect(
      summarizePlasmid({
        ir,
        bucket: "constraints",
        strategy: "abstractive",
        modelId: "mock",
        workingDirectory: working,
        llm,
        signal: controller.signal,
      }),
    ).rejects.toThrow(/aborted/);
    expect(llm).not.toHaveBeenCalled();
  });
});
