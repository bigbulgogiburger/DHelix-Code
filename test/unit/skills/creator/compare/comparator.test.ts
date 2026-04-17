/**
 * Unit tests for blind pairwise comparator.
 *
 * All I/O is exercised against a real tmpdir; the LLM judge is replaced by a
 * deterministic stub that counts invocations and returns scripted verdicts.
 */

import * as fsp from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  compareIterations,
  type ComparatorDeps,
  type JudgePairResult,
  type RubricScore,
} from "../../../../../src/skills/creator/compare/comparator.js";
import { getRunDir } from "../../../../../src/skills/creator/evals/workspace.js";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const rubric = (v: number): RubricScore => ({
  content: v,
  structure: v,
  safety: v,
  trigger_alignment: v,
});

async function seedIteration(
  skillDir: string,
  iteration: number,
  cases: readonly { readonly id: string; readonly output: string | null }[],
): Promise<void> {
  for (const c of cases) {
    if (c.output === null) continue;
    const dir = getRunDir(skillDir, iteration, c.id, "with_skill");
    await fsp.mkdir(dir, { recursive: true });
    await fsp.writeFile(join(dir, "output.md"), c.output, "utf8");
  }
}

async function seedEvals(
  skillDir: string,
  cases: readonly { readonly id: string; readonly prompt: string; readonly expectations: readonly string[] }[],
): Promise<void> {
  const evalsDir = join(skillDir, "evals");
  await fsp.mkdir(evalsDir, { recursive: true });
  await fsp.writeFile(
    join(evalsDir, "evals.json"),
    JSON.stringify({
      skill_name: "s",
      version: 1,
      cases: cases.map((c) => ({
        id: c.id,
        prompt: c.prompt,
        expectations: [...c.expectations],
        trigger_only: false,
        should_trigger: true,
      })),
    }),
    "utf8",
  );
}

function scriptedDeps(
  verdicts: Readonly<Record<string, JudgePairResult>>,
): { readonly deps: ComparatorDeps; readonly calls: { count: number } } {
  const calls = { count: 0 };
  const deps: ComparatorDeps = {
    judgePair: async ({ outputA }) => {
      calls.count += 1;
      // Map on outputA's first char as the "case id hint" (we pass "a1"/"a2"/"a3").
      const key = outputA.slice(0, 2);
      const v = verdicts[key];
      if (!v) throw new Error(`no scripted verdict for ${key}`);
      return v;
    },
  };
  return { deps, calls };
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

let work: string;

beforeEach(async () => {
  work = await fsp.mkdtemp(join(tmpdir(), "comparator-"));
});

afterEach(async () => {
  await fsp.rm(work, { recursive: true, force: true });
});

// ---------------------------------------------------------------------------
// Happy path
// ---------------------------------------------------------------------------

describe("compareIterations — happy path", () => {
  it("judges 3 cases present on both sides, aggregates winners and rubric", async () => {
    const skillDir = join(work, ".dhelix", "skills", "my-skill");
    await seedEvals(skillDir, [
      { id: "c1", prompt: "p1", expectations: ["e1"] },
      { id: "c2", prompt: "p2", expectations: ["e2"] },
      { id: "c3", prompt: "p3", expectations: ["e3"] },
    ]);
    // Iteration 0 outputs start with "a1","a2","a3"; iteration 1 with "b1" etc.
    await seedIteration(skillDir, 0, [
      { id: "c1", output: "a1 alpha" },
      { id: "c2", output: "a2 beta" },
      { id: "c3", output: "a3 gamma" },
    ]);
    await seedIteration(skillDir, 1, [
      { id: "c1", output: "B1 alpha" },
      { id: "c2", output: "B2 beta" },
      { id: "c3", output: "B3 gamma" },
    ]);

    const { deps, calls } = scriptedDeps({
      a1: { winner: "A", reason: "A better", rubricA: rubric(4), rubricB: rubric(2) },
      a2: { winner: "B", reason: "B better", rubricA: rubric(2), rubricB: rubric(4) },
      a3: { winner: "tie", reason: "tied", rubricA: rubric(3), rubricB: rubric(3) },
    });

    const result = await compareIterations(
      { skillDir, skillName: "my-skill", iterationA: 0, iterationB: 1 },
      deps,
    );

    expect(calls.count).toBe(3);
    expect(result.a_wins).toBe(1);
    expect(result.b_wins).toBe(1);
    expect(result.ties).toBe(1);
    expect(result.per_case_winners).toHaveLength(3);
    expect(result.rubric_a.content).toBeCloseTo((4 + 2 + 3) / 3);
    expect(result.rubric_b.content).toBeCloseTo((2 + 4 + 3) / 3);
    expect(result.skill_name).toBe("my-skill");
    expect(result.iteration_a).toBe(0);
    expect(result.iteration_b).toBe(1);
  });

  it("all A wins → a_wins equals n", async () => {
    const skillDir = join(work, "s");
    await seedEvals(skillDir, [
      { id: "c1", prompt: "p", expectations: ["e"] },
      { id: "c2", prompt: "p", expectations: ["e"] },
    ]);
    await seedIteration(skillDir, 0, [
      { id: "c1", output: "a1" },
      { id: "c2", output: "a2" },
    ]);
    await seedIteration(skillDir, 1, [
      { id: "c1", output: "b1" },
      { id: "c2", output: "b2" },
    ]);
    const { deps } = scriptedDeps({
      a1: { winner: "A", reason: "", rubricA: rubric(5), rubricB: rubric(1) },
      a2: { winner: "A", reason: "", rubricA: rubric(5), rubricB: rubric(1) },
    });
    const r = await compareIterations(
      { skillDir, skillName: "s", iterationA: 0, iterationB: 1 },
      deps,
    );
    expect(r.a_wins).toBe(2);
    expect(r.b_wins).toBe(0);
    expect(r.ties).toBe(0);
  });

  it("all B wins → b_wins equals n", async () => {
    const skillDir = join(work, "s");
    await seedEvals(skillDir, [{ id: "c1", prompt: "p", expectations: ["e"] }]);
    await seedIteration(skillDir, 0, [{ id: "c1", output: "a1" }]);
    await seedIteration(skillDir, 1, [{ id: "c1", output: "b1" }]);
    const { deps } = scriptedDeps({
      a1: { winner: "B", reason: "", rubricA: rubric(0), rubricB: rubric(5) },
    });
    const r = await compareIterations(
      { skillDir, skillName: "s", iterationA: 0, iterationB: 1 },
      deps,
    );
    expect(r.b_wins).toBe(1);
    expect(r.a_wins).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Missing outputs
// ---------------------------------------------------------------------------

describe("compareIterations — missing outputs are skipped", () => {
  it("skips cases where either side's output.md is absent", async () => {
    const skillDir = join(work, "s");
    await seedEvals(skillDir, [
      { id: "c1", prompt: "p", expectations: ["e"] },
      { id: "c2", prompt: "p", expectations: ["e"] },
      { id: "c3", prompt: "p", expectations: ["e"] },
    ]);
    await seedIteration(skillDir, 0, [
      { id: "c1", output: "a1" },
      { id: "c2", output: "a2" },
      { id: "c3", output: "a3" },
    ]);
    // iteration 1 only has c2
    await seedIteration(skillDir, 1, [{ id: "c2", output: "B2" }]);

    const { deps, calls } = scriptedDeps({
      a2: { winner: "A", reason: "", rubricA: rubric(4), rubricB: rubric(2) },
    });

    const r = await compareIterations(
      { skillDir, skillName: "s", iterationA: 0, iterationB: 1 },
      deps,
    );
    expect(calls.count).toBe(1);
    expect(r.a_wins + r.b_wins + r.ties).toBe(1);
    expect(r.per_case_winners).toHaveLength(1);
    expect(r.per_case_winners[0]?.case_id).toBe("c2");
  });

  it("returns an empty aggregate when no case has both outputs", async () => {
    const skillDir = join(work, "s");
    await seedEvals(skillDir, [{ id: "c1", prompt: "p", expectations: ["e"] }]);
    await seedIteration(skillDir, 0, [{ id: "c1", output: "a1" }]);
    // no iteration 1
    const judgeSpy = vi.fn();
    const r = await compareIterations(
      { skillDir, skillName: "s", iterationA: 0, iterationB: 1 },
      { judgePair: judgeSpy },
    );
    expect(judgeSpy).not.toHaveBeenCalled();
    expect(r.a_wins).toBe(0);
    expect(r.b_wins).toBe(0);
    expect(r.ties).toBe(0);
    expect(r.per_case_winners).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Abort
// ---------------------------------------------------------------------------

describe("compareIterations — abort", () => {
  it("rejects when signal is already aborted", async () => {
    const skillDir = join(work, "s");
    await seedEvals(skillDir, [{ id: "c1", prompt: "p", expectations: ["e"] }]);
    await seedIteration(skillDir, 0, [{ id: "c1", output: "a1" }]);
    await seedIteration(skillDir, 1, [{ id: "c1", output: "b1" }]);
    const controller = new AbortController();
    controller.abort(new Error("cancel"));
    const { deps } = scriptedDeps({
      a1: { winner: "A", reason: "", rubricA: rubric(0), rubricB: rubric(0) },
    });
    await expect(
      compareIterations(
        { skillDir, skillName: "s", iterationA: 0, iterationB: 1 },
        deps,
        { signal: controller.signal },
      ),
    ).rejects.toThrow();
  });
});

// ---------------------------------------------------------------------------
// Rubric averaging precision
// ---------------------------------------------------------------------------

describe("compareIterations — rubric averaging", () => {
  it("averages each rubric axis independently", async () => {
    const skillDir = join(work, "s");
    await seedEvals(skillDir, [
      { id: "c1", prompt: "p", expectations: ["e"] },
      { id: "c2", prompt: "p", expectations: ["e"] },
    ]);
    await seedIteration(skillDir, 0, [
      { id: "c1", output: "a1" },
      { id: "c2", output: "a2" },
    ]);
    await seedIteration(skillDir, 1, [
      { id: "c1", output: "b1" },
      { id: "c2", output: "b2" },
    ]);

    const { deps } = scriptedDeps({
      a1: {
        winner: "tie",
        reason: "",
        rubricA: { content: 5, structure: 1, safety: 3, trigger_alignment: 2 },
        rubricB: { content: 1, structure: 5, safety: 3, trigger_alignment: 4 },
      },
      a2: {
        winner: "tie",
        reason: "",
        rubricA: { content: 3, structure: 3, safety: 5, trigger_alignment: 4 },
        rubricB: { content: 3, structure: 1, safety: 1, trigger_alignment: 2 },
      },
    });

    const r = await compareIterations(
      { skillDir, skillName: "s", iterationA: 0, iterationB: 1 },
      deps,
    );
    expect(r.rubric_a.content).toBe(4);
    expect(r.rubric_a.structure).toBe(2);
    expect(r.rubric_a.safety).toBe(4);
    expect(r.rubric_a.trigger_alignment).toBe(3);
    expect(r.rubric_b.content).toBe(2);
    expect(r.rubric_b.structure).toBe(3);
    expect(r.rubric_b.safety).toBe(2);
    expect(r.rubric_b.trigger_alignment).toBe(3);
  });
});
