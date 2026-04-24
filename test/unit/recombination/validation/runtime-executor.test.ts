/**
 * Unit tests for src/recombination/validation/runtime-executor.ts.
 *
 * Covers:
 *   - single-case happy path: output captured, tool: + hook: parsed,
 *     files touched snapshot works
 *   - pre-aborted signal → all `"skipped"`
 *   - timeout budget → in-flight case becomes `"timeout"`, queued ones skipped
 *   - parallelism respected (simultaneity <= parallelism)
 *   - error-run ceiling aborts the remainder
 *   - setupFiles written into scratch/
 */
import { promises as fs } from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type {
  LLMCompletionFn,
  PipelineStrategies,
  RuntimeCase,
} from "../../../../src/recombination/types.js";
import { runCases } from "../../../../src/recombination/validation/runtime-executor.js";

function mkCase(overrides: Partial<RuntimeCase> & { readonly id: string }): RuntimeCase {
  return {
    plasmidId: "p-1",
    tier: "L1",
    origin: "eval-seed",
    prompt: overrides.prompt ?? "do something",
    expectations: overrides.expectations ?? ["output contains foo"],
    ...overrides,
  } as RuntimeCase;
}

const baseStrategies: PipelineStrategies = {
  interpreter: "single-pass",
  compression: "abstractive",
  reorgFallback: "deterministic-only",
  validationVolume: "minimal",
  validationParallelism: 1,
  gradingTiers: ["deterministic", "semi", "llm"],
  passThresholds: { L1: 0.95, L2: 0.9, L3: 0.8, L4: 0.7 },
  projectProfile: "static-template",
  artifactGeneration: "template-only",
  interpreterRetries: 1,
};

async function mkWorkspace(): Promise<string> {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "dhelix-ws-"));
  await fs.mkdir(path.join(root, "scratch"), { recursive: true });
  await fs.mkdir(path.join(root, ".dhelix/agents"), { recursive: true });
  await fs.writeFile(
    path.join(root, ".dhelix/agents/foo.md"),
    "agent",
    "utf8",
  );
  return root;
}

describe("runCases", () => {
  let workspaceRoot: string;
  beforeEach(async () => {
    workspaceRoot = await mkWorkspace();
  });
  afterEach(async () => {
    await fs.rm(workspaceRoot, { recursive: true, force: true });
  });

  it("happy path: captures output + tool/hook markers + filesTouched", async () => {
    const llm: LLMCompletionFn = async () => {
      // Write a file into scratch to ensure diff picks it up.
      await fs.writeFile(
        path.join(workspaceRoot, "scratch", "out.txt"),
        "hello",
        "utf8",
      );
      return "tool:edit\nhook:PostTest\nfinal answer: foo\n";
    };
    const cases: readonly RuntimeCase[] = [mkCase({ id: "c1" })];
    const results = await runCases({
      cases,
      strategies: baseStrategies,
      workingDirectory: "/unused",
      workspaceRoot,
      llm,
      timeBudgetMs: 5_000,
      parallelism: 1,
    });
    expect(results).toHaveLength(1);
    const r = results[0];
    expect(r).toBeDefined();
    if (!r) return;
    expect(r.status).toBe("ok");
    expect(r.output).toContain("final answer");
    expect(r.toolCalls).toEqual(["edit"]);
    expect(r.hookFires).toEqual(["PostTest"]);
    expect(r.filesTouched).toContainEqual({ path: "out.txt", op: "create" });
    expect(r.durationMs).toBeGreaterThanOrEqual(0);
  });

  it("returns all skipped when pre-aborted", async () => {
    const ctrl = new AbortController();
    ctrl.abort();
    const llm: LLMCompletionFn = async () => "never";
    const cases: readonly RuntimeCase[] = [mkCase({ id: "c1" }), mkCase({ id: "c2" })];
    const results = await runCases({
      cases,
      strategies: baseStrategies,
      workingDirectory: "/unused",
      workspaceRoot,
      llm,
      timeBudgetMs: 1_000,
      parallelism: 2,
      signal: ctrl.signal,
    });
    expect(results.every((r) => r.status === "skipped")).toBe(true);
    expect(results).toHaveLength(2);
  });

  it("marks in-flight case as timeout when budget elapses", async () => {
    const llm: LLMCompletionFn = async ({ signal }) =>
      new Promise((_, reject) => {
        signal?.addEventListener("abort", () => reject(new Error("aborted by executor")));
      });
    const cases: readonly RuntimeCase[] = [
      mkCase({ id: "c1" }),
      mkCase({ id: "c2" }),
    ];
    const results = await runCases({
      cases,
      strategies: baseStrategies,
      workingDirectory: "/unused",
      workspaceRoot,
      llm,
      timeBudgetMs: 50,
      parallelism: 1,
    });
    const statuses = results.map((r) => r.status).sort();
    // First case hits timeout, second is skipped (queued).
    expect(statuses).toEqual(["skipped", "timeout"]);
  });

  it("respects parallelism (max simultaneous llm calls)", async () => {
    let active = 0;
    let peak = 0;
    const llm: LLMCompletionFn = async () => {
      active += 1;
      if (active > peak) peak = active;
      await new Promise((r) => setTimeout(r, 30));
      active -= 1;
      return "ok";
    };
    const cases: readonly RuntimeCase[] = Array.from({ length: 6 }, (_, i) =>
      mkCase({ id: `c${i}` }),
    );
    await runCases({
      cases,
      strategies: baseStrategies,
      workingDirectory: "/unused",
      workspaceRoot,
      llm,
      timeBudgetMs: 10_000,
      parallelism: 3,
    });
    expect(peak).toBeLessThanOrEqual(3);
    expect(peak).toBeGreaterThanOrEqual(2);
  });

  it("bails after exceeding error-run ceiling", async () => {
    let attempts = 0;
    const llm: LLMCompletionFn = async () => {
      attempts += 1;
      throw new Error(`boom ${attempts}`);
    };
    const cases: readonly RuntimeCase[] = Array.from({ length: 30 }, (_, i) =>
      mkCase({ id: `c${i}` }),
    );
    const results = await runCases({
      cases,
      strategies: baseStrategies,
      workingDirectory: "/unused",
      workspaceRoot,
      llm,
      timeBudgetMs: 10_000,
      parallelism: 1,
    });
    const errors = results.filter((r) => r.status === "error").length;
    const skipped = results.filter((r) => r.status === "skipped").length;
    // At most ERROR_RUN_CEILING (10) + 1 errors, rest skipped.
    expect(errors).toBeLessThanOrEqual(11);
    expect(errors + skipped).toBe(30);
    expect(skipped).toBeGreaterThan(0);
  });

  it("writes setupFiles into scratch/ before llm invocation", async () => {
    const caseWithSetup: RuntimeCase = {
      id: "c-setup",
      plasmidId: "p-1",
      tier: "L2",
      origin: "deterministic",
      prompt: "check",
      expectations: ["output contains ok"],
      setupFiles: [
        { path: "fixtures/a.txt", content: "fixture-a" },
        { path: "top.md", content: "top" },
      ],
    };
    let seenContents = "";
    const llm: LLMCompletionFn = async () => {
      // Read the setup file to prove it exists pre-llm-call.
      seenContents = await fs.readFile(
        path.join(workspaceRoot, "scratch", "fixtures", "a.txt"),
        "utf8",
      );
      return "ok";
    };
    const results = await runCases({
      cases: [caseWithSetup],
      strategies: baseStrategies,
      workingDirectory: "/unused",
      workspaceRoot,
      llm,
      timeBudgetMs: 5_000,
      parallelism: 1,
    });
    expect(seenContents).toBe("fixture-a");
    const r = results[0];
    expect(r?.status).toBe("ok");
    // Setup files are part of "before" snapshot, so they shouldn't show as create.
    expect(r?.filesTouched).toEqual([]);
  });

  it("rejects setupFiles that escape scratch dir", async () => {
    const badCase: RuntimeCase = {
      id: "c-bad",
      plasmidId: "p-1",
      tier: "L1",
      origin: "deterministic",
      prompt: "x",
      expectations: ["output contains x"],
      setupFiles: [{ path: "../escape.txt", content: "no" }],
    };
    const llm: LLMCompletionFn = async () => "x";
    const results = await runCases({
      cases: [badCase],
      strategies: baseStrategies,
      workingDirectory: "/unused",
      workspaceRoot,
      llm,
      timeBudgetMs: 1_000,
      parallelism: 1,
    });
    expect(results[0]?.status).toBe("error");
    expect(results[0]?.errorMessage).toMatch(/escapes/);
  });
});
