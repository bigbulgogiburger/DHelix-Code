/**
 * Unit tests for improveSkill — Phase 3 deliverable P3.2.
 *
 * Uses a real tmpdir for on-disk artefacts so we can assert candidate file
 * placement, history append, and error paths end-to-end.
 */

import * as fsp from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  ImproveError,
  createProductionImproveDeps,
  improveSkill,
  type Feedback,
  type ImproveDeps,
} from "../../../../../src/skills/creator/improve/improve.js";
import type { Grading } from "../../../../../src/skills/creator/evals/types.js";
import { persistRunResult } from "../../../../../src/skills/creator/evals/workspace.js";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const ORIGINAL_SKILL_MD = `---
name: sample-skill
description: sample skill for refinement
---

# Body

Original instructions.
`;

const REVISED_SKILL_MD = `---
name: sample-skill
description: sample skill for refinement, now clearer
---

# Body

Improved instructions with more detail.
`;

const REVISED_NO_FRONTMATTER = `# Body only\n\nNo frontmatter here.\n`;

const REVISED_BAD_MANIFEST = `---
description: missing required name field
---

# Body
`;

async function seedSkill(workDir: string, name: string): Promise<string> {
  const skillDir = join(workDir, ".dhelix", "skills", name);
  await fsp.mkdir(skillDir, { recursive: true });
  await fsp.writeFile(join(skillDir, "SKILL.md"), ORIGINAL_SKILL_MD, "utf8");
  return skillDir;
}

function buildGrading(caseId: string, failing: readonly string[]): Grading {
  return {
    case_id: caseId,
    expectations: failing.map((text) => ({
      text,
      passed: false,
      evidence: "",
    })),
  };
}

async function seedIterationGrading(
  skillDir: string,
  iteration: number,
  caseId: string,
  failing: readonly string[],
): Promise<void> {
  await persistRunResult(skillDir, iteration, {
    caseId,
    configName: "with_skill",
    runId: `eval-${caseId}/with_skill`,
    output: "out",
    transcript: "[]",
    metrics: {
      tool_calls_by_type: {},
      total_steps: 1,
      files_created: [],
      errors: [],
      output_chars: 3,
      transcript_chars: 2,
    },
    timing: { executor_duration_ms: 10 },
    grading: buildGrading(caseId, failing),
  });
}

function stubDeps(
  rewriter: (args: Parameters<ImproveDeps["rewriteSkill"]>[0]) => Promise<string>,
): ImproveDeps {
  return { rewriteSkill: rewriter };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("improveSkill — missing inputs", () => {
  let workDir: string;
  beforeEach(async () => {
    workDir = await fsp.mkdtemp(join(tmpdir(), "improve-missing-"));
  });
  afterEach(async () => {
    await fsp.rm(workDir, { recursive: true, force: true });
  });

  it("throws MISSING_SKILL when SKILL.md is absent", async () => {
    const skillDir = join(workDir, ".dhelix", "skills", "ghost-skill");
    await fsp.mkdir(skillDir, { recursive: true });
    const deps = stubDeps(async () => REVISED_SKILL_MD);
    await expect(
      improveSkill(
        { skillDir, skillName: "ghost-skill", baselineIteration: 0 },
        deps,
      ),
    ).rejects.toMatchObject({ code: "MISSING_SKILL" });
  });

  it("throws ABORTED when the signal fires before the call", async () => {
    const skillDir = await seedSkill(workDir, "sample-skill");
    const controller = new AbortController();
    controller.abort();
    const deps = stubDeps(async () => REVISED_SKILL_MD);
    await expect(
      improveSkill(
        { skillDir, skillName: "sample-skill", baselineIteration: 0 },
        deps,
        { signal: controller.signal },
      ),
    ).rejects.toMatchObject({ code: "ABORTED" });
  });
});

describe("improveSkill — feedback.json handling", () => {
  let workDir: string;
  beforeEach(async () => {
    workDir = await fsp.mkdtemp(join(tmpdir(), "improve-fb-"));
  });
  afterEach(async () => {
    await fsp.rm(workDir, { recursive: true, force: true });
  });

  it("treats missing feedback.json as empty feedback", async () => {
    const skillDir = await seedSkill(workDir, "sample-skill");
    const seen: Feedback[][] = [];
    const deps = stubDeps(async (args) => {
      seen.push([...args.feedback]);
      return REVISED_SKILL_MD;
    });
    await improveSkill(
      { skillDir, skillName: "sample-skill", baselineIteration: 0 },
      deps,
    );
    expect(seen.length).toBe(1);
    expect(seen[0]).toEqual([]);
  });

  it("loads entries from feedback.json and passes them into the rewriter", async () => {
    const skillDir = await seedSkill(workDir, "sample-skill");
    await fsp.mkdir(join(skillDir, "workspace"), { recursive: true });
    const entries = [
      { caseId: "c1", note: "describe triggers better", kind: "clarify" },
      { note: "add an example", kind: "add" },
    ];
    await fsp.writeFile(
      join(skillDir, "workspace", "feedback.json"),
      JSON.stringify({ entries }),
      "utf8",
    );

    const deps = stubDeps(async (args) => {
      expect(args.feedback.length).toBe(2);
      expect(args.feedback[0]?.caseId).toBe("c1");
      expect(args.feedback[1]?.kind).toBe("add");
      return REVISED_SKILL_MD;
    });
    await improveSkill(
      { skillDir, skillName: "sample-skill", baselineIteration: 0 },
      deps,
    );
  });

  it("throws FEEDBACK_INVALID when feedback.json is malformed", async () => {
    const skillDir = await seedSkill(workDir, "sample-skill");
    await fsp.mkdir(join(skillDir, "workspace"), { recursive: true });
    await fsp.writeFile(
      join(skillDir, "workspace", "feedback.json"),
      "{not valid json",
      "utf8",
    );
    const deps = stubDeps(async () => REVISED_SKILL_MD);
    await expect(
      improveSkill(
        { skillDir, skillName: "sample-skill", baselineIteration: 0 },
        deps,
      ),
    ).rejects.toMatchObject({ code: "FEEDBACK_INVALID" });
  });
});

describe("improveSkill — rewriter output validation", () => {
  let workDir: string;
  beforeEach(async () => {
    workDir = await fsp.mkdtemp(join(tmpdir(), "improve-rewriter-"));
  });
  afterEach(async () => {
    await fsp.rm(workDir, { recursive: true, force: true });
  });

  it("throws MISSING_FRONTMATTER when the rewriter drops the frontmatter", async () => {
    const skillDir = await seedSkill(workDir, "sample-skill");
    const deps = stubDeps(async () => REVISED_NO_FRONTMATTER);
    await expect(
      improveSkill(
        { skillDir, skillName: "sample-skill", baselineIteration: 0 },
        deps,
      ),
    ).rejects.toMatchObject({ code: "MISSING_FRONTMATTER" });
  });

  it("throws MANIFEST_INVALID when the revised frontmatter fails validation", async () => {
    const skillDir = await seedSkill(workDir, "sample-skill");
    const deps = stubDeps(async () => REVISED_BAD_MANIFEST);
    await expect(
      improveSkill(
        { skillDir, skillName: "sample-skill", baselineIteration: 0 },
        deps,
      ),
    ).rejects.toMatchObject({ code: "MANIFEST_INVALID" });
  });

  it("throws REWRITER_EMPTY when the rewriter returns whitespace", async () => {
    const skillDir = await seedSkill(workDir, "sample-skill");
    const deps = stubDeps(async () => "   \n  ");
    await expect(
      improveSkill(
        { skillDir, skillName: "sample-skill", baselineIteration: 0 },
        deps,
      ),
    ).rejects.toMatchObject({ code: "REWRITER_EMPTY" });
  });
});

describe("improveSkill — happy path", () => {
  let workDir: string;
  beforeEach(async () => {
    workDir = await fsp.mkdtemp(join(tmpdir(), "improve-happy-"));
  });
  afterEach(async () => {
    await fsp.rm(workDir, { recursive: true, force: true });
  });

  it("writes candidate + appends history, returns structured result", async () => {
    const skillDir = await seedSkill(workDir, "sample-skill");
    const rewrite = vi.fn(async () => REVISED_SKILL_MD);
    const fixedNow = new Date("2026-04-17T12:00:00Z");

    const result = await improveSkill(
      { skillDir, skillName: "sample-skill", baselineIteration: 0 },
      { rewriteSkill: rewrite },
      { now: () => fixedNow },
    );

    expect(result.previousIteration).toBe(0);
    expect(result.newIteration).toBe(1);
    expect(result.historyEntry.version).toBe(1);
    expect(result.historyEntry.parent_version).toBe(0);
    expect(result.historyEntry.grading_result).toBe("tie");
    expect(result.historyEntry.created_at).toBe(fixedNow.toISOString());
    expect(result.newSkillMdPath).toBe(
      join(skillDir, "workspace", "iteration-1", "skill-md-candidate.md"),
    );

    // Candidate file is on disk with the revised body.
    const written = await fsp.readFile(result.newSkillMdPath, "utf8");
    expect(written.trim()).toBe(REVISED_SKILL_MD.trim());

    // SKILL.md is NOT overwritten.
    const untouched = await fsp.readFile(join(skillDir, "SKILL.md"), "utf8");
    expect(untouched).toBe(ORIGINAL_SKILL_MD);

    // history.json has our entry.
    const historyRaw = await fsp.readFile(
      join(skillDir, "workspace", "history.json"),
      "utf8",
    );
    const history = JSON.parse(historyRaw) as {
      entries: Array<{ version: number; skill_md_hash: string }>;
    };
    expect(history.entries.some((e) => e.version === 1)).toBe(true);

    // diffSummary mentions line stats.
    expect(result.diffSummary).toMatch(/lines:/);
  });

  it("propagates failing expectations from the baseline iteration into the rewriter", async () => {
    const skillDir = await seedSkill(workDir, "sample-skill");
    await seedIterationGrading(skillDir, 0, "c1", [
      "first exp should pass",
      "second exp should pass",
    ]);
    await seedIterationGrading(skillDir, 0, "c2", ["second exp should pass"]);

    const seen: string[][] = [];
    const deps = stubDeps(async (args) => {
      seen.push([...(args.failingExpectations ?? [])]);
      return REVISED_SKILL_MD;
    });
    await improveSkill(
      { skillDir, skillName: "sample-skill", baselineIteration: 0 },
      deps,
    );
    expect(seen.length).toBe(1);
    const got = seen[0] ?? [];
    expect(got).toContain("first exp should pass");
    expect(got).toContain("second exp should pass");
    // deduped (length 2, not 3)
    expect(got.length).toBe(2);
  });
});

describe("createProductionImproveDeps", () => {
  it("returns an object with a rewriteSkill function (no LLM call)", () => {
    const deps = createProductionImproveDeps({ model: "claude-haiku-4-5-20251001" });
    expect(typeof deps.rewriteSkill).toBe("function");
  });
});

describe("ImproveError", () => {
  it("exposes code + details + proper name", () => {
    const err = new ImproveError("MISSING_SKILL", "nope", { path: "/x" });
    expect(err.name).toBe("ImproveError");
    expect(err.code).toBe("MISSING_SKILL");
    expect(err.details).toEqual({ path: "/x" });
  });
});
