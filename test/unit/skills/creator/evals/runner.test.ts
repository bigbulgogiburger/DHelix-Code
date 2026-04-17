/**
 * Runner unit tests — hand-rolled spawn / grader stubs (no production wiring).
 */
import { describe, expect, it } from "vitest";
import {
  createProductionSpawn,
  runEvals,
  type RunnerDeps,
} from "../../../../../src/skills/creator/evals/runner.js";
import type {
  EvalCase,
  EvalConfig,
  EvalsFile,
  Grading,
} from "../../../../../src/skills/creator/evals/types.js";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const makeCase = (id: string, prompt = `prompt-${id}`): EvalCase => ({
  id,
  prompt,
  expectations: [`exp-${id}`],
  trigger_only: false,
  should_trigger: true,
});

const makeEvalsFile = (cases: readonly EvalCase[]): EvalsFile => ({
  skill_name: "demo-skill",
  version: 1,
  cases: [...cases],
});

const withSkillConfig: EvalConfig = { name: "with_skill", withSkill: true };
const baselineConfig: EvalConfig = { name: "baseline", withSkill: false };

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface SpawnInvocation {
  readonly prompt: string;
  readonly systemPromptAddition?: string;
  readonly allowedTools?: readonly string[];
  readonly model?: string;
  readonly signal?: AbortSignal;
  /** monotonically increasing index to verify ordering */
  readonly calledAt: number;
}

const makeRecordingSpawn = (
  opts?: {
    readonly delayMs?: (args: SpawnInvocation) => number;
    readonly durationMs?: number;
    readonly metricsBuilder?: (args: SpawnInvocation) => {
      readonly toolCallsByType?: Readonly<Record<string, number>>;
      readonly totalSteps?: number;
      readonly filesCreated?: readonly string[];
      readonly errors?: readonly string[];
    };
  },
): {
  readonly spawn: RunnerDeps["spawn"];
  readonly invocations: readonly SpawnInvocation[];
  readonly inFlightMax: () => number;
} => {
  const invocations: SpawnInvocation[] = [];
  let inFlight = 0;
  let maxInFlight = 0;
  let counter = 0;

  const spawn: RunnerDeps["spawn"] = async (args) => {
    const record: SpawnInvocation = {
      prompt: args.prompt,
      ...(args.systemPromptAddition !== undefined
        ? { systemPromptAddition: args.systemPromptAddition }
        : {}),
      ...(args.allowedTools !== undefined ? { allowedTools: args.allowedTools } : {}),
      ...(args.model !== undefined ? { model: args.model } : {}),
      ...(args.signal !== undefined ? { signal: args.signal } : {}),
      calledAt: counter,
    };
    counter += 1;
    invocations.push(record);

    inFlight += 1;
    if (inFlight > maxInFlight) maxInFlight = inFlight;

    try {
      const delay = opts?.delayMs ? opts.delayMs(record) : 0;
      if (delay > 0) {
        await new Promise<void>((resolve, reject) => {
          const timer = setTimeout(resolve, delay);
          args.signal?.addEventListener(
            "abort",
            () => {
              clearTimeout(timer);
              reject(
                args.signal?.reason instanceof Error
                  ? args.signal.reason
                  : new Error("aborted"),
              );
            },
            { once: true },
          );
        });
      }
      return {
        output: `out:${args.prompt}:${args.systemPromptAddition ?? "none"}`,
        transcript: `[{"role":"user","content":"${args.prompt}"}]`,
        durationMs: opts?.durationMs ?? 42,
        ...(opts?.metricsBuilder ? { metrics: opts.metricsBuilder(record) } : {}),
      };
    } finally {
      inFlight -= 1;
    }
  };

  return {
    spawn,
    invocations,
    inFlightMax: () => maxInFlight,
  };
};

// ---------------------------------------------------------------------------
// Happy path
// ---------------------------------------------------------------------------

describe("runEvals — happy path", () => {
  it("runs every case × every config (2×2 = 4 spawns)", async () => {
    const cases = [makeCase("a"), makeCase("b")];
    const evals = makeEvalsFile(cases);
    const { spawn, invocations } = makeRecordingSpawn();

    const results = await runEvals(
      evals,
      [withSkillConfig, baselineConfig],
      { spawn },
      { skillBody: "SKILL BODY" },
    );

    expect(invocations).toHaveLength(4);
    expect(results).toHaveLength(4);
  });

  it("injects systemPromptAddition only when withSkill=true", async () => {
    const evals = makeEvalsFile([makeCase("x")]);
    const { spawn, invocations } = makeRecordingSpawn();

    await runEvals(
      evals,
      [withSkillConfig, baselineConfig],
      { spawn },
      { skillBody: "SKILL_MD_BODY" },
    );

    const withSkillCall = invocations.find((i) => i.prompt === "prompt-x" && i.systemPromptAddition !== undefined);
    const baselineCall = invocations.find(
      (i) => i.prompt === "prompt-x" && i.systemPromptAddition === undefined,
    );
    expect(withSkillCall?.systemPromptAddition).toBe("SKILL_MD_BODY");
    expect(baselineCall).toBeDefined();
  });

  it("produces runId of format eval-<caseId>/<configName> and preserves input order", async () => {
    const cases = [makeCase("alpha"), makeCase("bravo")];
    const evals = makeEvalsFile(cases);
    const { spawn } = makeRecordingSpawn();

    const results = await runEvals(
      evals,
      [withSkillConfig, baselineConfig],
      { spawn },
      { skillBody: "body" },
    );

    expect(results.map((r) => r.runId)).toEqual([
      "eval-alpha/with_skill",
      "eval-alpha/baseline",
      "eval-bravo/with_skill",
      "eval-bravo/baseline",
    ]);
    expect(results.map((r) => `${r.caseId}|${r.configName}`)).toEqual([
      "alpha|with_skill",
      "alpha|baseline",
      "bravo|with_skill",
      "bravo|baseline",
    ]);
  });
});

// ---------------------------------------------------------------------------
// Concurrency
// ---------------------------------------------------------------------------

describe("runEvals — concurrency", () => {
  it("never exceeds maxConcurrency=2 simultaneously", async () => {
    // 3 cases × 2 configs = 6 tasks; each takes 20ms.
    const cases = [makeCase("a"), makeCase("b"), makeCase("c")];
    const evals = makeEvalsFile(cases);
    const { spawn, inFlightMax } = makeRecordingSpawn({ delayMs: () => 20 });

    await runEvals(
      evals,
      [withSkillConfig, baselineConfig],
      { spawn },
      { maxConcurrency: 2, skillBody: "body" },
    );

    expect(inFlightMax()).toBeLessThanOrEqual(2);
    // must be > 1 to prove parallelism actually happened
    expect(inFlightMax()).toBeGreaterThanOrEqual(2);
  });

  it("uses default maxConcurrency=3 when not specified", async () => {
    const cases = [makeCase("a"), makeCase("b"), makeCase("c"), makeCase("d")];
    const evals = makeEvalsFile(cases);
    const { spawn, inFlightMax } = makeRecordingSpawn({ delayMs: () => 10 });

    await runEvals(evals, [withSkillConfig], { spawn }, { skillBody: "b" });

    expect(inFlightMax()).toBeLessThanOrEqual(3);
  });
});

// ---------------------------------------------------------------------------
// Grading
// ---------------------------------------------------------------------------

describe("runEvals — grading", () => {
  it("attaches grading when deps.gradeCase is provided", async () => {
    const evals = makeEvalsFile([makeCase("g1"), makeCase("g2")]);
    const { spawn } = makeRecordingSpawn();

    const gradeCase: NonNullable<RunnerDeps["gradeCase"]> = async ({ caseData, output }) => {
      return {
        case_id: caseData.id,
        expectations: [
          { text: `graded-${caseData.id}`, passed: output.length > 0, evidence: output },
        ],
      };
    };

    const results = await runEvals(
      evals,
      [withSkillConfig],
      { spawn, gradeCase },
      { skillBody: "body" },
    );

    expect(results).toHaveLength(2);
    for (const r of results) {
      expect(r.grading).toBeDefined();
      expect(r.grading?.case_id).toBe(r.caseId);
      expect(r.grading?.expectations[0]?.passed).toBe(true);
      expect(r.grading?.expectations[0]?.text).toBe(`graded-${r.caseId}`);
    }
  });

  it("omits grading when gradeCase is not provided", async () => {
    const evals = makeEvalsFile([makeCase("g1")]);
    const { spawn } = makeRecordingSpawn();

    const results = await runEvals(evals, [withSkillConfig], { spawn }, { skillBody: "b" });

    expect(results[0]?.grading).toBeUndefined();
  });

  it("wraps grader throw in a [grader-error] grading with passed=false", async () => {
    const evals = makeEvalsFile([makeCase("gx")]);
    const { spawn } = makeRecordingSpawn();

    const gradeCase: NonNullable<RunnerDeps["gradeCase"]> = async () => {
      throw new Error("LLM unavailable");
    };

    const results = await runEvals(
      evals,
      [withSkillConfig],
      { spawn, gradeCase },
      { skillBody: "b" },
    );

    const grading: Grading | undefined = results[0]?.grading;
    expect(grading).toBeDefined();
    expect(grading?.case_id).toBe("gx");
    expect(grading?.expectations).toHaveLength(1);
    expect(grading?.expectations[0]?.passed).toBe(false);
    expect(grading?.expectations[0]?.text).toContain("[grader-error]");
    expect(grading?.expectations[0]?.text).toContain("LLM unavailable");
  });
});

// ---------------------------------------------------------------------------
// Metrics
// ---------------------------------------------------------------------------

describe("runEvals — metrics passthrough", () => {
  it("preserves toolCallsByType and other metrics fields", async () => {
    const evals = makeEvalsFile([makeCase("m1")]);
    const { spawn } = makeRecordingSpawn({
      metricsBuilder: () => ({
        toolCallsByType: { read: 3, edit: 1 },
        totalSteps: 5,
        filesCreated: ["src/foo.ts"],
        errors: [],
      }),
    });

    const results = await runEvals(evals, [withSkillConfig], { spawn }, { skillBody: "b" });

    const m = results[0]?.metrics;
    expect(m).toBeDefined();
    expect(m?.tool_calls_by_type).toEqual({ read: 3, edit: 1 });
    expect(m?.total_steps).toBe(5);
    expect(m?.files_created).toEqual(["src/foo.ts"]);
    expect(m?.errors).toEqual([]);
    // output_chars + transcript_chars populated from spawn output
    expect(m?.output_chars).toBeGreaterThan(0);
    expect(m?.transcript_chars).toBeGreaterThan(0);
  });

  it("fills defaults when spawn returns no metrics", async () => {
    const evals = makeEvalsFile([makeCase("m2")]);
    const { spawn } = makeRecordingSpawn();

    const results = await runEvals(evals, [withSkillConfig], { spawn }, { skillBody: "b" });

    const m = results[0]?.metrics;
    expect(m?.tool_calls_by_type).toEqual({});
    expect(m?.total_steps).toBe(0);
    expect(m?.files_created).toEqual([]);
    expect(m?.errors).toEqual([]);
  });

  it("prefers spawner durationMs over wall-clock when present", async () => {
    const evals = makeEvalsFile([makeCase("t1")]);
    const { spawn } = makeRecordingSpawn({ delayMs: () => 15, durationMs: 9999 });

    const results = await runEvals(evals, [withSkillConfig], { spawn }, { skillBody: "b" });

    expect(results[0]?.timing.executor_duration_ms).toBe(9999);
  });
});

// ---------------------------------------------------------------------------
// Abort
// ---------------------------------------------------------------------------

describe("runEvals — abort", () => {
  it("rejects when signal is already aborted before start", async () => {
    const evals = makeEvalsFile([makeCase("a")]);
    const { spawn } = makeRecordingSpawn();

    const controller = new AbortController();
    controller.abort(new Error("pre-aborted"));

    await expect(
      runEvals(
        evals,
        [withSkillConfig],
        { spawn },
        { signal: controller.signal, skillBody: "b" },
      ),
    ).rejects.toThrow();
  });

  it("aborts in-flight spawns and does not include their results", async () => {
    const cases = [makeCase("fast"), makeCase("slow"), makeCase("queued")];
    const evals = makeEvalsFile(cases);

    // fast: 5ms, slow: 1000ms, queued: 5ms — with maxConcurrency=1 queued should
    // never run because abort kicks in during slow.
    const { spawn } = makeRecordingSpawn({
      delayMs: (rec) => {
        if (rec.prompt === "prompt-slow") return 1000;
        return 5;
      },
    });

    const controller = new AbortController();
    const promise = runEvals(
      evals,
      [withSkillConfig],
      { spawn },
      { signal: controller.signal, maxConcurrency: 1, skillBody: "b" },
    );

    // Abort after 'fast' completed and 'slow' is likely in flight.
    setTimeout(() => controller.abort(new Error("user-cancel")), 30);

    await expect(promise).rejects.toThrow();
  });
});

// ---------------------------------------------------------------------------
// createProductionSpawn
// ---------------------------------------------------------------------------

describe("createProductionSpawn", () => {
  it("returns null (intentionally unwired — see TODO in source)", () => {
    expect(createProductionSpawn()).toBeNull();
  });
});
