/**
 * Unit tests for /skill-review slash command.
 */

import * as fsp from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createSkillReviewCommand,
  skillReviewCommand,
} from "../../../src/commands/skill-review.js";
import { type CommandContext } from "../../../src/commands/registry.js";
import type {
  Comparison,
  ComparatorDeps,
} from "../../../src/skills/creator/compare/comparator.js";
import type { ReportInput } from "../../../src/skills/creator/compare/html-report.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildCtx(workingDir: string): CommandContext {
  return {
    workingDirectory: workingDir,
    sessionId: "s1",
    model: "test-model",
    emit: () => {},
  };
}

async function seedSkillDir(workingDir: string, name: string): Promise<string> {
  const skillDir = join(workingDir, ".dhelix", "skills", name);
  await fsp.mkdir(skillDir, { recursive: true });
  await fsp.writeFile(join(skillDir, "SKILL.md"), "# body", "utf8");
  return skillDir;
}

// ---------------------------------------------------------------------------
// Metadata
// ---------------------------------------------------------------------------

describe("/skill-review — metadata", () => {
  it("has the correct name", () => {
    expect(skillReviewCommand.name).toBe("skill-review");
  });
  it("exposes a meaningful description", () => {
    expect(skillReviewCommand.description.length).toBeGreaterThan(20);
    expect(skillReviewCommand.description).toContain("report");
  });
  it("advertises usage with <skill-name> and flags", () => {
    expect(skillReviewCommand.usage).toContain("/skill-review");
    expect(skillReviewCommand.usage).toContain("<skill-name>");
    expect(skillReviewCommand.usage).toContain("--iteration");
    expect(skillReviewCommand.usage).toContain("--compare");
    expect(skillReviewCommand.usage).toContain("--static");
  });
  it("execute is a function", () => {
    expect(skillReviewCommand.execute).toBeTypeOf("function");
  });
});

// ---------------------------------------------------------------------------
// Arg parsing & validation
// ---------------------------------------------------------------------------

describe("/skill-review — argument validation", () => {
  let work: string;
  beforeEach(async () => {
    work = await fsp.mkdtemp(join(tmpdir(), "skill-review-args-"));
  });
  afterEach(async () => {
    await fsp.rm(work, { recursive: true, force: true });
  });

  it("fails when no skill name is provided", async () => {
    const cmd = createSkillReviewCommand();
    const r = await cmd.execute("", buildCtx(work));
    expect(r.success).toBe(false);
    expect(r.output.toLowerCase()).toContain("skill name");
  });

  it("fails for non-kebab-case name", async () => {
    const cmd = createSkillReviewCommand();
    const r = await cmd.execute("BadName", buildCtx(work));
    expect(r.success).toBe(false);
    expect(r.output).toContain("INVALID_NAME");
  });

  it("fails for unknown flag", async () => {
    const cmd = createSkillReviewCommand();
    const r = await cmd.execute("my-skill --weird", buildCtx(work));
    expect(r.success).toBe(false);
    expect(r.output).toContain("Unknown flag");
  });

  it("fails for --iteration without value", async () => {
    const cmd = createSkillReviewCommand();
    const r = await cmd.execute("my-skill --iteration", buildCtx(work));
    expect(r.success).toBe(false);
    expect(r.output).toContain("--iteration");
  });

  it("fails when skill directory does not exist (with hint)", async () => {
    const cmd = createSkillReviewCommand();
    const r = await cmd.execute("nonexistent-skill", buildCtx(work));
    expect(r.success).toBe(false);
    expect(r.output.toLowerCase()).toContain("not found");
    expect(r.output.toLowerCase()).toContain("hint");
  });
});

// ---------------------------------------------------------------------------
// Happy path
// ---------------------------------------------------------------------------

describe("/skill-review — happy path", () => {
  let work: string;
  beforeEach(async () => {
    work = await fsp.mkdtemp(join(tmpdir(), "skill-review-happy-"));
  });
  afterEach(async () => {
    await fsp.rm(work, { recursive: true, force: true });
  });

  it("writes a report to the default path and reports it", async () => {
    await seedSkillDir(work, "my-skill");
    const writeSpy = vi
      .fn<(path: string, input: ReportInput, fs?: typeof fsp) => Promise<string>>()
      .mockImplementation(async (path: string) => path);
    const renderSpy = vi.fn().mockReturnValue("<!doctype html><html></html>");

    const cmd = createSkillReviewCommand({
      nextIterationNumber: async () => 3, // latest = 2
      writeHtmlReport: writeSpy,
      renderHtmlReport: renderSpy,
      now: () => new Date("2026-04-17T00:00:00.000Z"),
    });

    const r = await cmd.execute("my-skill", buildCtx(work));
    expect(r.success).toBe(true);
    expect(writeSpy).toHaveBeenCalledTimes(1);
    const [outPath, input] = writeSpy.mock.calls[0] ?? [];
    expect(outPath).toContain("iteration-2");
    expect(outPath).toContain("report.html");
    expect(input?.iteration).toBe(2);
    expect(input?.skillName).toBe("my-skill");
    expect(input?.skillMd).toContain("# body");
    expect(r.output).toContain(String(outPath));
    expect(r.output).toContain("iteration 2");
  });

  it("uses --iteration when explicitly provided", async () => {
    await seedSkillDir(work, "my-skill");
    const writeSpy = vi.fn(async (p: string) => p);
    const cmd = createSkillReviewCommand({
      nextIterationNumber: async () => 99,
      writeHtmlReport: writeSpy,
    });
    const r = await cmd.execute("my-skill --iteration 5", buildCtx(work));
    expect(r.success).toBe(true);
    const input = writeSpy.mock.calls[0]?.[1] as ReportInput | undefined;
    expect(input?.iteration).toBe(5);
  });

  it("honors absolute --static path", async () => {
    await seedSkillDir(work, "my-skill");
    const out = join(work, "custom", "report.html");
    const writeSpy = vi.fn(async (p: string) => p);
    const cmd = createSkillReviewCommand({
      nextIterationNumber: async () => 1,
      writeHtmlReport: writeSpy,
    });
    const r = await cmd.execute(`my-skill --static ${out}`, buildCtx(work));
    expect(r.success).toBe(true);
    expect(writeSpy.mock.calls[0]?.[0]).toBe(out);
    expect(r.output).toContain(out);
  });
});

// ---------------------------------------------------------------------------
// --compare triggers comparator
// ---------------------------------------------------------------------------

describe("/skill-review — --compare triggers comparator", () => {
  let work: string;
  beforeEach(async () => {
    work = await fsp.mkdtemp(join(tmpdir(), "skill-review-compare-"));
  });
  afterEach(async () => {
    await fsp.rm(work, { recursive: true, force: true });
  });

  it("invokes compareIterations with A=iteration, B=--compare and passes result to renderer", async () => {
    await seedSkillDir(work, "my-skill");
    const stubComparison: Comparison = {
      skill_name: "my-skill",
      iteration_a: 2,
      iteration_b: 1,
      a_wins: 2,
      b_wins: 1,
      ties: 0,
      rubric_a: { content: 4, structure: 4, safety: 4, trigger_alignment: 4 },
      rubric_b: { content: 3, structure: 3, safety: 3, trigger_alignment: 3 },
      per_case_winners: [],
    };
    const cmpSpy = vi.fn(async () => stubComparison);
    const stubDeps: ComparatorDeps = { judgePair: async () => ({ winner: "tie", reason: "", rubricA: { content: 0, structure: 0, safety: 0, trigger_alignment: 0 }, rubricB: { content: 0, structure: 0, safety: 0, trigger_alignment: 0 } }) };
    const createCmpSpy = vi.fn(() => stubDeps);
    const writeSpy = vi.fn(async (p: string) => p);

    const cmd = createSkillReviewCommand({
      nextIterationNumber: async () => 3,
      compareIterations: cmpSpy,
      createComparatorDeps: createCmpSpy,
      writeHtmlReport: writeSpy,
    });

    const r = await cmd.execute("my-skill --compare 1", buildCtx(work));
    expect(r.success).toBe(true);
    expect(createCmpSpy).toHaveBeenCalledTimes(1);
    expect(cmpSpy).toHaveBeenCalledTimes(1);
    const cmpArgs = cmpSpy.mock.calls[0]?.[0];
    expect(cmpArgs?.iterationA).toBe(2);
    expect(cmpArgs?.iterationB).toBe(1);
    expect(cmpArgs?.skillName).toBe("my-skill");
    const input = writeSpy.mock.calls[0]?.[1] as ReportInput | undefined;
    expect(input?.comparison).toBe(stubComparison);
    expect(r.output).toContain("A=2");
    expect(r.output).toContain("B=1");
  });

  it("does not invoke comparator when --compare is absent", async () => {
    await seedSkillDir(work, "my-skill");
    const cmpSpy = vi.fn();
    const createCmpSpy = vi.fn();
    const writeSpy = vi.fn(async (p: string) => p);
    const cmd = createSkillReviewCommand({
      nextIterationNumber: async () => 1,
      compareIterations: cmpSpy as never,
      createComparatorDeps: createCmpSpy as never,
      writeHtmlReport: writeSpy,
    });
    const r = await cmd.execute("my-skill", buildCtx(work));
    expect(r.success).toBe(true);
    expect(cmpSpy).not.toHaveBeenCalled();
    expect(createCmpSpy).not.toHaveBeenCalled();
  });
});
