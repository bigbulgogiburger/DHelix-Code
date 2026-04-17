/**
 * Unit tests for /skill-eval slash command.
 *
 * Tests cover metadata, arg parsing, schema validation, happy path with a
 * stubbed `runEvals`, spawner unavailability, and graceful grader failure.
 *
 * All I/O (fs, workspace.persistRunResult/writeBenchmark/appendHistory,
 * nextIterationNumber) is exercised against a real tmpdir so we can assert
 * the on-disk artefacts produced by the command.
 */

import * as fsp from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createSkillEvalCommand,
  skillEvalCommand,
} from "../../../src/commands/skill-eval.js";
import {
  type CommandContext,
} from "../../../src/commands/registry.js";
import type {
  EvalConfig,
  EvalsFile,
  Grading,
  RawRunResult,
} from "../../../src/skills/creator/evals/types.js";
import type { RunnerDeps } from "../../../src/skills/creator/evals/runner.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const SAMPLE_EVALS: EvalsFile = {
  skill_name: "sample-skill",
  version: 1,
  cases: [
    {
      id: "c1",
      prompt: "do the first thing",
      expectations: ["first expectation"],
      trigger_only: false,
      should_trigger: true,
    },
    {
      id: "c2",
      prompt: "do the second thing",
      expectations: ["second expectation"],
      trigger_only: false,
      should_trigger: true,
    },
  ],
};

const SAMPLE_SKILL_MD = `---
name: sample-skill
description: sample
---

# Sample Skill Body

Instructions go here.
`;

function buildGrading(caseId: string, passed: boolean): Grading {
  return {
    case_id: caseId,
    expectations: [{ text: "first expectation", passed, evidence: "e" }],
  };
}

function buildRunResult(
  caseId: string,
  configName: string,
  passed: boolean,
  durationMs: number,
): RawRunResult {
  return {
    caseId,
    configName,
    runId: `eval-${caseId}/${configName}`,
    output: `output for ${caseId}/${configName}`,
    transcript: "[]",
    metrics: {
      tool_calls_by_type: {},
      total_steps: 1,
      files_created: [],
      errors: [],
      output_chars: 10,
      transcript_chars: 2,
    },
    timing: { executor_duration_ms: durationMs },
    grading: buildGrading(caseId, passed),
  };
}

/** Build a CommandContext rooted at `workingDir`. */
function buildCtx(workingDir: string): CommandContext {
  return {
    workingDirectory: workingDir,
    sessionId: "s1",
    model: "test-model",
    emit: () => {},
  };
}

/**
 * Create `<workingDir>/.dhelix/skills/<name>/` with SKILL.md + evals/evals.json.
 * Returns the skillDir.
 */
async function seedSkill(
  workingDir: string,
  name: string,
  opts: { readonly evalsJson?: string; readonly skillMd?: string } = {},
): Promise<string> {
  const skillDir = join(workingDir, ".dhelix", "skills", name);
  await fsp.mkdir(join(skillDir, "evals"), { recursive: true });
  await fsp.writeFile(
    join(skillDir, "evals", "evals.json"),
    opts.evalsJson ?? JSON.stringify(SAMPLE_EVALS),
    "utf8",
  );
  await fsp.writeFile(
    join(skillDir, "SKILL.md"),
    opts.skillMd ?? SAMPLE_SKILL_MD,
    "utf8",
  );
  return skillDir;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("/skill-eval — metadata", () => {
  it("has correct name", () => {
    expect(skillEvalCommand.name).toBe("skill-eval");
  });
  it("has a non-trivial description mentioning key triggers", () => {
    expect(skillEvalCommand.description).toContain("evals");
    expect(skillEvalCommand.description.length).toBeGreaterThan(20);
  });
  it("advertises usage with skill name, --parallel, and --baseline", () => {
    expect(skillEvalCommand.usage).toContain("/skill-eval");
    expect(skillEvalCommand.usage).toContain("<skill-name>");
    expect(skillEvalCommand.usage).toContain("--parallel");
    expect(skillEvalCommand.usage).toContain("--baseline");
  });
  it("exposes execute as a function", () => {
    expect(skillEvalCommand.execute).toBeTypeOf("function");
  });
});

describe("/skill-eval — arg parsing & validation (no I/O)", () => {
  let workDir: string;

  beforeEach(async () => {
    workDir = await fsp.mkdtemp(join(tmpdir(), "skill-eval-args-"));
  });

  afterEach(async () => {
    await fsp.rm(workDir, { recursive: true, force: true });
  });

  it("returns error when no skill name is provided (empty args)", async () => {
    const cmd = createSkillEvalCommand();
    const result = await cmd.execute("", buildCtx(workDir));
    expect(result.success).toBe(false);
    expect(result.output.toLowerCase()).toContain("skill name");
  });

  it("returns error when args is whitespace only", async () => {
    const cmd = createSkillEvalCommand();
    const result = await cmd.execute("   ", buildCtx(workDir));
    expect(result.success).toBe(false);
    expect(result.output.toLowerCase()).toContain("skill name");
  });

  it("returns INVALID_NAME for non-kebab-case name", async () => {
    const cmd = createSkillEvalCommand();
    const result = await cmd.execute("BadName", buildCtx(workDir));
    expect(result.success).toBe(false);
    expect(result.output).toContain("INVALID_NAME");
    expect(result.output).toContain("BadName");
  });

  it("returns error for unknown flag", async () => {
    const cmd = createSkillEvalCommand();
    const result = await cmd.execute("my-skill --bogus", buildCtx(workDir));
    expect(result.success).toBe(false);
    expect(result.output).toContain("Unknown flag");
  });

  it("returns error for --parallel without value", async () => {
    const cmd = createSkillEvalCommand();
    const result = await cmd.execute("my-skill --parallel", buildCtx(workDir));
    expect(result.success).toBe(false);
    expect(result.output).toContain("--parallel");
  });

  it("returns error for non-numeric --parallel value", async () => {
    const cmd = createSkillEvalCommand();
    const result = await cmd.execute("my-skill --parallel abc", buildCtx(workDir));
    expect(result.success).toBe(false);
    expect(result.output).toContain("--parallel");
  });
});

describe("/skill-eval — skill / evals file validation", () => {
  let workDir: string;

  beforeEach(async () => {
    workDir = await fsp.mkdtemp(join(tmpdir(), "skill-eval-fs-"));
  });

  afterEach(async () => {
    await fsp.rm(workDir, { recursive: true, force: true });
  });

  it("returns error when skill directory is missing (evals.json not found)", async () => {
    const cmd = createSkillEvalCommand({
      createProductionSpawn: () => async () => ({
        output: "",
        transcript: "[]",
        durationMs: 0,
      }),
    });
    const result = await cmd.execute("missing-skill", buildCtx(workDir));
    expect(result.success).toBe(false);
    expect(result.output.toLowerCase()).toContain("evals.json");
    expect(result.output.toLowerCase()).toContain("not found");
  });

  it("returns error when evals.json contains invalid JSON", async () => {
    await seedSkill(workDir, "broken-skill", { evalsJson: "not-json {{" });
    const cmd = createSkillEvalCommand();
    const result = await cmd.execute("broken-skill", buildCtx(workDir));
    expect(result.success).toBe(false);
    expect(result.output).toContain("not valid JSON");
  });

  it("returns error when evals.json fails schema validation", async () => {
    // Missing required `cases` field → Zod failure
    await seedSkill(workDir, "bad-schema", {
      evalsJson: JSON.stringify({ skill_name: "bad-schema" }),
    });
    const cmd = createSkillEvalCommand();
    const result = await cmd.execute("bad-schema", buildCtx(workDir));
    expect(result.success).toBe(false);
    expect(result.output).toContain("failed schema validation");
    expect(result.output).toContain("cases");
  });
});

describe("/skill-eval — happy path with stubbed runner", () => {
  let workDir: string;

  beforeEach(async () => {
    workDir = await fsp.mkdtemp(join(tmpdir(), "skill-eval-happy-"));
  });

  afterEach(async () => {
    await fsp.rm(workDir, { recursive: true, force: true });
  });

  it("runs 2 cases × 2 configs, persists runs + benchmark + history, summary mentions both configs + delta", async () => {
    await seedSkill(workDir, "sample-skill", { skillMd: SAMPLE_SKILL_MD });

    const runEvals = vi.fn(
      async (
        _evalsFile: EvalsFile,
        configs: readonly EvalConfig[],
      ): Promise<readonly RawRunResult[]> => {
        const out: RawRunResult[] = [];
        for (const c of _evalsFile.cases) {
          for (const cfg of configs) {
            out.push(
              buildRunResult(
                c.id,
                cfg.name,
                cfg.name === "with_skill", // with_skill passes, baseline fails → delta >= 0.05
                cfg.name === "with_skill" ? 1000 : 1500,
              ),
            );
          }
        }
        return out;
      },
    );

    const spawnStub: RunnerDeps["spawn"] = async () => ({
      output: "",
      transcript: "[]",
      durationMs: 0,
    });
    const graderStub: RunnerDeps["gradeCase"] = async ({ caseData }) =>
      buildGrading(caseData.id, true);

    const cmd = createSkillEvalCommand({
      runEvals,
      createProductionSpawn: () => spawnStub,
      createGraderClient: () => graderStub,
    });

    const result = await cmd.execute("sample-skill", buildCtx(workDir));

    expect(result.success).toBe(true);
    expect(runEvals).toHaveBeenCalledTimes(1);

    // runEvals called with 2 configs (with_skill + baseline)
    const call = runEvals.mock.calls[0];
    expect(call).toBeDefined();
    const [passedEvals, passedConfigs, passedRunnerDeps, passedOpts] = call as [
      EvalsFile,
      readonly EvalConfig[],
      RunnerDeps,
      { readonly maxConcurrency?: number; readonly skillBody?: string } | undefined,
    ];
    expect(passedEvals.cases).toHaveLength(2);
    expect(passedConfigs.map((c) => c.name)).toEqual(["with_skill", "baseline"]);
    expect(passedRunnerDeps.spawn).toBeDefined();
    expect(passedRunnerDeps.gradeCase).toBeDefined();
    expect(passedOpts?.skillBody ?? "").toContain("Sample Skill Body");
    expect(passedOpts?.maxConcurrency).toBe(3);

    // Each result was persisted under .../workspace/iteration-0/eval-<id>/<config>/
    const iterDir = join(
      workDir,
      ".dhelix",
      "skills",
      "sample-skill",
      "workspace",
      "iteration-0",
    );
    for (const cid of ["c1", "c2"]) {
      for (const cfg of ["with_skill", "baseline"]) {
        const out = await fsp.readFile(
          join(iterDir, `eval-${cid}`, cfg, "output.md"),
          "utf8",
        );
        expect(out).toContain(`output for ${cid}/${cfg}`);
      }
    }

    // benchmark.json was written
    const benchmarkRaw = await fsp.readFile(
      join(iterDir, "benchmark.json"),
      "utf8",
    );
    const benchmark = JSON.parse(benchmarkRaw) as {
      readonly skill_name: string;
      readonly iteration: number;
      readonly configs: Record<string, unknown>;
      readonly delta?: { readonly pass_rate: number };
    };
    expect(benchmark.skill_name).toBe("sample-skill");
    expect(benchmark.iteration).toBe(0);
    expect(Object.keys(benchmark.configs).sort()).toEqual(["baseline", "with_skill"]);
    expect(benchmark.delta?.pass_rate).toBeCloseTo(1.0, 3);

    // history.json was appended with grading_result matching classifyBenchmark
    const historyRaw = await fsp.readFile(
      join(workDir, ".dhelix", "skills", "sample-skill", "workspace", "history.json"),
      "utf8",
    );
    const history = JSON.parse(historyRaw) as {
      readonly entries: readonly {
        readonly version: number;
        readonly parent_version: number | null;
        readonly grading_result: string;
      }[];
    };
    expect(history.entries).toHaveLength(1);
    const firstEntry = history.entries[0];
    expect(firstEntry).toBeDefined();
    if (firstEntry) {
      expect(firstEntry.version).toBe(0);
      expect(firstEntry.parent_version).toBeNull();
      expect(firstEntry.grading_result).toBe("won");
    }

    // summary output
    expect(result.output).toContain("with_skill");
    expect(result.output).toContain("baseline");
    expect(result.output).toContain("delta");
    expect(result.output).toContain("iteration 0");
    expect(result.output).toContain("benchmark:");
  });

  it("forwards --parallel 5 as maxConcurrency", async () => {
    await seedSkill(workDir, "sample-skill");
    const runEvals = vi.fn(
      async (): Promise<readonly RawRunResult[]> => [],
    );
    const cmd = createSkillEvalCommand({
      runEvals,
      createProductionSpawn: () => async () => ({
        output: "",
        transcript: "[]",
        durationMs: 0,
      }),
      createGraderClient: () => undefined,
    });

    const result = await cmd.execute(
      "sample-skill --parallel 5 --no-baseline",
      buildCtx(workDir),
    );
    expect(result.success).toBe(true);
    expect(runEvals).toHaveBeenCalledTimes(1);
    const args = runEvals.mock.calls[0];
    expect(args).toBeDefined();
    const opts = args?.[3];
    expect(opts?.maxConcurrency).toBe(5);
  });

  it("--no-baseline: configs only include with_skill", async () => {
    await seedSkill(workDir, "sample-skill");
    const runEvals = vi.fn(
      async (): Promise<readonly RawRunResult[]> => [],
    );
    const cmd = createSkillEvalCommand({
      runEvals,
      createProductionSpawn: () => async () => ({
        output: "",
        transcript: "[]",
        durationMs: 0,
      }),
      createGraderClient: () => undefined,
    });

    const result = await cmd.execute(
      "sample-skill --no-baseline",
      buildCtx(workDir),
    );
    expect(result.success).toBe(true);
    const args = runEvals.mock.calls[0];
    expect(args).toBeDefined();
    const configs = args?.[1];
    expect(configs?.map((c) => c.name)).toEqual(["with_skill"]);
  });
});

describe("/skill-eval — spawner unavailable", () => {
  let workDir: string;

  beforeEach(async () => {
    workDir = await fsp.mkdtemp(join(tmpdir(), "skill-eval-spawn-"));
    await seedSkill(workDir, "sample-skill");
  });

  afterEach(async () => {
    await fsp.rm(workDir, { recursive: true, force: true });
  });

  it("returns success=false with actionable hint when createProductionSpawn returns null", async () => {
    const cmd = createSkillEvalCommand({
      createProductionSpawn: () => null,
    });
    const result = await cmd.execute("sample-skill", buildCtx(workDir));
    expect(result.success).toBe(false);
    expect(result.output.toLowerCase()).toContain("spawner unavailable");
    expect(result.output).toContain("RunnerDeps.spawn");
  });
});

describe("/skill-eval — grader failure falls back gracefully", () => {
  let workDir: string;

  beforeEach(async () => {
    workDir = await fsp.mkdtemp(join(tmpdir(), "skill-eval-nograder-"));
    await seedSkill(workDir, "sample-skill");
  });

  afterEach(async () => {
    await fsp.rm(workDir, { recursive: true, force: true });
  });

  it("proceeds without grader when createGraderClient throws; pass_rate defaults to 0", async () => {
    // Runner returns results WITHOUT .grading (because gradeCase is undefined).
    const runEvals = vi.fn(
      async (
        evalsFile: EvalsFile,
        configs: readonly EvalConfig[],
        deps: RunnerDeps,
      ): Promise<readonly RawRunResult[]> => {
        // Sanity: gradeCase should be undefined because createGraderClient threw.
        expect(deps.gradeCase).toBeUndefined();
        const out: RawRunResult[] = [];
        for (const c of evalsFile.cases) {
          for (const cfg of configs) {
            out.push({
              caseId: c.id,
              configName: cfg.name,
              runId: `eval-${c.id}/${cfg.name}`,
              output: "x",
              transcript: "[]",
              metrics: {
                tool_calls_by_type: {},
                total_steps: 0,
                files_created: [],
                errors: [],
                output_chars: 1,
                transcript_chars: 2,
              },
              timing: { executor_duration_ms: 100 },
              // no grading
            });
          }
        }
        return out;
      },
    );

    const cmd = createSkillEvalCommand({
      runEvals,
      createProductionSpawn: () => async () => ({
        output: "",
        transcript: "[]",
        durationMs: 0,
      }),
      createGraderClient: () => {
        throw new Error("no LLM configured");
      },
    });

    const result = await cmd.execute("sample-skill", buildCtx(workDir));
    expect(result.success).toBe(true);
    expect(result.output).toContain("with_skill");
    expect(result.output).toContain("grader unavailable");

    // benchmark pass_rate.mean should be 0 for both configs (passRateFromGrading → 0 when grading absent)
    const benchmarkRaw = await fsp.readFile(
      join(
        workDir,
        ".dhelix",
        "skills",
        "sample-skill",
        "workspace",
        "iteration-0",
        "benchmark.json",
      ),
      "utf8",
    );
    const benchmark = JSON.parse(benchmarkRaw) as {
      readonly configs: Record<
        string,
        { readonly summary: { readonly pass_rate: { readonly mean: number } } }
      >;
    };
    expect(benchmark.configs["with_skill"]?.summary.pass_rate.mean).toBe(0);
    expect(benchmark.configs["baseline"]?.summary.pass_rate.mean).toBe(0);
  });
});
