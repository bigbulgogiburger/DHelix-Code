import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { buildProjectProfile } from "../../../../src/recombination/compression/project-profiler.js";
import type { LLMCompletionFn } from "../../../../src/recombination/types.js";

async function writeFixture(dir: string, name: string, content: string): Promise<void> {
  await writeFile(join(dir, name), content, { encoding: "utf8" });
}

describe("buildProjectProfile", () => {
  let working: string;

  beforeEach(async () => {
    working = await mkdtemp(join(tmpdir(), "profile-"));
  });

  afterEach(async () => {
    await rm(working, { recursive: true, force: true });
  });

  it("static-template builds markdown without invoking the LLM", async () => {
    const llm: LLMCompletionFn = vi.fn(async () => "SHOULD NOT BE CALLED");
    await writeFixture(
      working,
      "package.json",
      JSON.stringify({
        name: "demo-pkg",
        version: "1.2.3",
        description: "Demo package for tests.",
        dependencies: { typescript: "^5.8.0" },
      }),
    );
    const result = await buildProjectProfile({
      workingDirectory: working,
      mode: "static-template",
      modelId: "mock",
      llm,
    });
    expect(llm).not.toHaveBeenCalled();
    expect(result.markdown).toContain("## Project Profile");
    expect(result.markdown).toContain("demo-pkg");
    expect(result.markdown).toContain("1.2.3");
    expect(result.markdown).toContain("TypeScript");
    expect(result.tokenEstimate).toBeGreaterThan(0);
  });

  it("static-template handles missing package.json and DHELIX.md", async () => {
    const llm: LLMCompletionFn = vi.fn(async () => "");
    const result = await buildProjectProfile({
      workingDirectory: working,
      mode: "static-template",
      modelId: "mock",
      llm,
    });
    expect(result.markdown).toContain("project name unknown");
    expect(result.markdown).toContain("no DHELIX.md present");
  });

  it("full-llm mode invokes the LLM once and caches subsequent calls", async () => {
    await writeFixture(
      working,
      "package.json",
      JSON.stringify({ name: "cached", version: "0.1.0" }),
    );
    const llm = vi
      .fn<LLMCompletionFn>()
      .mockResolvedValue("A concise description of the project.");
    const first = await buildProjectProfile({
      workingDirectory: working,
      mode: "full-llm",
      modelId: "mock",
      llm,
    });
    expect(llm).toHaveBeenCalledTimes(1);
    expect(first.cacheHit).toBe(false);
    expect(first.markdown).toContain("concise description");

    const second = await buildProjectProfile({
      workingDirectory: working,
      mode: "full-llm",
      modelId: "mock",
      llm,
    });
    expect(second.cacheHit).toBe(true);
    expect(llm).toHaveBeenCalledTimes(1);
  });

  it("llm-summary falls back to the static template when the LLM throws", async () => {
    await writeFixture(
      working,
      "package.json",
      JSON.stringify({ name: "fallback", version: "0.0.1" }),
    );
    const llm: LLMCompletionFn = vi.fn(async () => {
      throw new Error("model down");
    });
    const result = await buildProjectProfile({
      workingDirectory: working,
      mode: "llm-summary",
      modelId: "mock",
      llm,
    });
    // Static template breadcrumb identifies the fallback path.
    expect(result.markdown).toContain("static project profile");
    expect(result.markdown).toContain("fallback");
  });

  it("llm-summary falls back when the LLM returns an empty string", async () => {
    await writeFixture(
      working,
      "package.json",
      JSON.stringify({ name: "empty-out", version: "0.0.1" }),
    );
    const llm: LLMCompletionFn = vi.fn(async () => "   \n");
    const result = await buildProjectProfile({
      workingDirectory: working,
      mode: "llm-summary",
      modelId: "mock",
      llm,
    });
    expect(result.markdown).toContain("static project profile");
  });

  it("aborts via signal before reading package.json", async () => {
    const controller = new AbortController();
    controller.abort();
    const llm: LLMCompletionFn = vi.fn(async () => "");
    await expect(
      buildProjectProfile({
        workingDirectory: working,
        mode: "static-template",
        modelId: "mock",
        llm,
        signal: controller.signal,
      }),
    ).rejects.toThrow(/aborted/);
  });
});
