import * as fsp from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  appendHistory,
  createIteration,
  getIterationDir,
  getRunDir,
  getWorkspaceRoot,
  nextIterationNumber,
  persistRunResult,
  readBenchmark,
  readRunGrading,
  readRunMetrics,
  readRunTiming,
  writeBenchmark,
} from "../../../../../src/skills/creator/evals/workspace.js";
import type {
  Benchmark,
  RawRunResult,
} from "../../../../../src/skills/creator/evals/types.js";

const sampleResult = (caseId: string, configName: string): RawRunResult => ({
  caseId,
  configName,
  runId: `test/eval-${caseId}/${configName}`,
  output: "# output",
  transcript: "[]",
  metrics: {
    tool_calls_by_type: { Read: 1 },
    total_steps: 1,
    files_created: [],
    errors: [],
    output_chars: 8,
    transcript_chars: 2,
  },
  timing: { executor_duration_ms: 1234 },
  grading: {
    case_id: caseId,
    expectations: [{ text: "e1", passed: true, evidence: "ok" }],
  },
});

describe("workspace pure helpers", () => {
  it("computes paths deterministically", () => {
    const skill = "/tmp/skill";
    expect(getWorkspaceRoot(skill)).toBe(join(skill, "workspace"));
    expect(getIterationDir(skill, 3)).toBe(join(skill, "workspace", "iteration-3"));
    expect(getRunDir(skill, 3, "e1", "with-skill")).toBe(
      join(skill, "workspace", "iteration-3", "eval-e1", "with-skill"),
    );
  });
});

describe("workspace I/O", () => {
  let skillDir: string;

  beforeEach(async () => {
    skillDir = await fsp.mkdtemp(join(tmpdir(), "dhelix-workspace-"));
  });

  afterEach(async () => {
    await fsp.rm(skillDir, { recursive: true, force: true });
  });

  it("nextIterationNumber returns 0 for empty workspace", async () => {
    expect(await nextIterationNumber(skillDir)).toBe(0);
  });

  it("nextIterationNumber returns max+1", async () => {
    await createIteration(skillDir, 0, ["e1"], ["with-skill"]);
    await createIteration(skillDir, 1, ["e1"], ["with-skill"]);
    await createIteration(skillDir, 3, ["e1"], ["with-skill"]);
    expect(await nextIterationNumber(skillDir)).toBe(4);
  });

  it("nextIterationNumber ignores unrelated dirs", async () => {
    const wsRoot = getWorkspaceRoot(skillDir);
    await fsp.mkdir(join(wsRoot, "not-an-iteration"), { recursive: true });
    await fsp.mkdir(join(wsRoot, "iteration-2"), { recursive: true });
    expect(await nextIterationNumber(skillDir)).toBe(3);
  });

  it("createIteration creates nested case + config dirs", async () => {
    await createIteration(skillDir, 0, ["e1", "e2"], ["with-skill", "baseline"]);
    for (const c of ["e1", "e2"]) {
      for (const cfg of ["with-skill", "baseline"]) {
        const exists = await fsp
          .stat(join(getIterationDir(skillDir, 0), `eval-${c}`, cfg))
          .then(() => true)
          .catch(() => false);
        expect(exists).toBe(true);
      }
    }
  });

  it("persistRunResult writes all five files", async () => {
    const r = sampleResult("e1", "with-skill");
    const dir = await persistRunResult(skillDir, 0, r);
    const files = ["output.md", "transcript.json", "metrics.json", "timing.json", "grading.json"];
    for (const f of files) {
      const ok = await fsp
        .stat(join(dir, f))
        .then(() => true)
        .catch(() => false);
      expect(ok).toBe(true);
    }
  });

  it("persistRunResult skips grading.json when grading missing", async () => {
    const r: RawRunResult = { ...sampleResult("e1", "baseline"), grading: undefined };
    const dir = await persistRunResult(skillDir, 0, r);
    const gradingExists = await fsp
      .stat(join(dir, "grading.json"))
      .then(() => true)
      .catch(() => false);
    expect(gradingExists).toBe(false);
  });

  it("readRunGrading/Metrics/Timing round-trip", async () => {
    const r = sampleResult("e1", "with-skill");
    await persistRunResult(skillDir, 0, r);
    const g = await readRunGrading(skillDir, 0, "e1", "with-skill");
    const m = await readRunMetrics(skillDir, 0, "e1", "with-skill");
    const t = await readRunTiming(skillDir, 0, "e1", "with-skill");
    expect(g?.case_id).toBe("e1");
    expect(m?.total_steps).toBe(1);
    expect(t?.executor_duration_ms).toBe(1234);
  });

  it("readRunGrading returns null on missing file", async () => {
    const g = await readRunGrading(skillDir, 99, "missing", "with-skill");
    expect(g).toBeNull();
  });

  it("writeBenchmark + readBenchmark round-trip", async () => {
    const b: Benchmark = {
      skill_name: "demo",
      iteration: 0,
      configs: {
        with_skill: {
          runs: [{ run_id: "r1", pass_rate: 0.8, duration_ms: 1000 }],
          summary: {
            pass_rate: { mean: 0.8, stddev: 0, min: 0.8, max: 0.8 },
            duration_ms: { mean: 1000, stddev: 0, min: 1000, max: 1000 },
          },
        },
      },
    };
    await writeBenchmark(skillDir, b);
    const read = await readBenchmark(skillDir, 0);
    expect(read?.skill_name).toBe("demo");
    expect(read?.configs["with_skill"]?.summary.pass_rate.mean).toBe(0.8);
  });

  it("appendHistory creates history.json and replaces same version", async () => {
    await appendHistory(skillDir, {
      version: 0,
      parent_version: null,
      description: "v0",
      skill_md_hash: "h0",
      expectation_pass_rate: 0.5,
      grading_result: "baseline",
      created_at: "2026-04-17T00:00:00Z",
    });
    await appendHistory(skillDir, {
      version: 1,
      parent_version: 0,
      description: "v1",
      skill_md_hash: "h1",
      expectation_pass_rate: 0.8,
      grading_result: "won",
      created_at: "2026-04-17T00:01:00Z",
    });
    // 같은 version 교체
    await appendHistory(skillDir, {
      version: 1,
      parent_version: 0,
      description: "v1-updated",
      skill_md_hash: "h1b",
      expectation_pass_rate: 0.9,
      grading_result: "won",
      created_at: "2026-04-17T00:02:00Z",
    });
    const path = join(getWorkspaceRoot(skillDir), "history.json");
    const raw = await fsp.readFile(path, "utf8");
    const parsed = JSON.parse(raw) as { entries: { version: number; description: string }[] };
    expect(parsed.entries.length).toBe(2);
    const v1 = parsed.entries.find((e) => e.version === 1);
    expect(v1?.description).toBe("v1-updated");
  });
});
