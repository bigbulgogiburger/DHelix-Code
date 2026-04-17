/**
 * Unit tests for /skill-improve slash command.
 */

import * as fsp from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createSkillImproveCommand,
  skillImproveCommand,
} from "../../../src/commands/skill-improve.js";
import { type CommandContext } from "../../../src/commands/registry.js";
import type {
  ImproveDeps,
  ImproveResult,
} from "../../../src/skills/creator/improve/improve.js";
import { ImproveError } from "../../../src/skills/creator/improve/improve.js";

function buildCtx(workingDir: string): CommandContext {
  return {
    workingDirectory: workingDir,
    sessionId: "s1",
    model: "test-model",
    emit: () => {},
  };
}

async function seedSkillDir(workDir: string, name: string): Promise<string> {
  const skillDir = join(workDir, ".dhelix", "skills", name);
  await fsp.mkdir(skillDir, { recursive: true });
  return skillDir;
}

function buildResult(newIteration: number): ImproveResult {
  return {
    previousIteration: newIteration - 1,
    newIteration,
    historyEntry: {
      version: newIteration,
      parent_version: newIteration - 1,
      description: "test",
      skill_md_hash: "abc123def456",
      expectation_pass_rate: 0,
      grading_result: "tie",
      created_at: "2026-04-17T12:00:00.000Z",
    },
    newSkillMdPath: "/tmp/iter/skill-md-candidate.md",
    diffSummary: "lines: 10 → 12 (+2)\nfeedback notes applied: 1\nfailing expectations addressed: 0",
  };
}

// ---------------------------------------------------------------------------
// Metadata
// ---------------------------------------------------------------------------

describe("/skill-improve — metadata", () => {
  it("has expected name/description/usage", () => {
    expect(skillImproveCommand.name).toBe("skill-improve");
    expect(skillImproveCommand.description.toLowerCase()).toContain("improve");
    expect(skillImproveCommand.usage).toContain("/skill-improve");
    expect(skillImproveCommand.usage).toContain("<skill-name>");
    expect(skillImproveCommand.usage).toContain("--from-iteration");
  });
  it("exposes execute as a function", () => {
    expect(skillImproveCommand.execute).toBeTypeOf("function");
  });
});

// ---------------------------------------------------------------------------
// Arg validation
// ---------------------------------------------------------------------------

describe("/skill-improve — arg validation", () => {
  let workDir: string;

  beforeEach(async () => {
    workDir = await fsp.mkdtemp(join(tmpdir(), "skill-improve-args-"));
  });
  afterEach(async () => {
    await fsp.rm(workDir, { recursive: true, force: true });
  });

  it("fails with no name", async () => {
    const cmd = createSkillImproveCommand();
    const result = await cmd.execute("", buildCtx(workDir));
    expect(result.success).toBe(false);
    expect(result.output.toLowerCase()).toContain("skill name");
  });

  it("fails with INVALID_NAME for non-kebab-case", async () => {
    const cmd = createSkillImproveCommand();
    const result = await cmd.execute("BadName", buildCtx(workDir));
    expect(result.success).toBe(false);
    expect(result.output).toContain("INVALID_NAME");
  });

  it("fails for unknown flag", async () => {
    const cmd = createSkillImproveCommand();
    const result = await cmd.execute("my-skill --bogus", buildCtx(workDir));
    expect(result.success).toBe(false);
    expect(result.output).toContain("Unknown flag");
  });

  it("fails for --from-iteration without value", async () => {
    const cmd = createSkillImproveCommand();
    const result = await cmd.execute("my-skill --from-iteration", buildCtx(workDir));
    expect(result.success).toBe(false);
    expect(result.output).toContain("--from-iteration");
  });

  it("fails for --from-iteration with non-numeric", async () => {
    const cmd = createSkillImproveCommand();
    const result = await cmd.execute(
      "my-skill --from-iteration abc",
      buildCtx(workDir),
    );
    expect(result.success).toBe(false);
    expect(result.output).toContain("--from-iteration");
  });
});

// ---------------------------------------------------------------------------
// Skill directory missing
// ---------------------------------------------------------------------------

describe("/skill-improve — skill directory", () => {
  let workDir: string;

  beforeEach(async () => {
    workDir = await fsp.mkdtemp(join(tmpdir(), "skill-improve-dir-"));
  });
  afterEach(async () => {
    await fsp.rm(workDir, { recursive: true, force: true });
  });

  it("returns actionable hint when skillDir is missing", async () => {
    const cmd = createSkillImproveCommand();
    const result = await cmd.execute("ghost-skill", buildCtx(workDir));
    expect(result.success).toBe(false);
    expect(result.output).toContain("skill directory not found");
    expect(result.output).toContain("/create-skill");
  });
});

// ---------------------------------------------------------------------------
// Happy path
// ---------------------------------------------------------------------------

describe("/skill-improve — happy path with stub improveSkill", () => {
  let workDir: string;

  beforeEach(async () => {
    workDir = await fsp.mkdtemp(join(tmpdir(), "skill-improve-happy-"));
  });
  afterEach(async () => {
    await fsp.rm(workDir, { recursive: true, force: true });
  });

  it("calls improveSkill with resolved baselineIteration = latest and reports candidate + next step", async () => {
    const skillDir = await seedSkillDir(workDir, "sample-skill");
    // Simulate iteration-2 already exists: nextIterationNumber → 3, baseline → 2
    await fsp.mkdir(join(skillDir, "workspace", "iteration-2"), { recursive: true });

    const improveSkill = vi.fn(async () => buildResult(3));
    const cmd = createSkillImproveCommand({
      improveSkill,
      createProductionDeps: (): ImproveDeps => ({
        rewriteSkill: async () => "",
      }),
    });

    const result = await cmd.execute("sample-skill", buildCtx(workDir));
    expect(result.success).toBe(true);
    expect(improveSkill).toHaveBeenCalledTimes(1);
    const call = improveSkill.mock.calls[0];
    expect(call).toBeDefined();
    const [callArgs] = call as [
      { skillDir: string; skillName: string; baselineIteration: number },
    ];
    expect(callArgs.skillDir).toBe(skillDir);
    expect(callArgs.skillName).toBe("sample-skill");
    expect(callArgs.baselineIteration).toBe(2);

    expect(result.output).toContain("candidate:");
    expect(result.output).toContain("/skill-eval sample-skill");
  });

  it("forwards --from-iteration flag", async () => {
    const skillDir = await seedSkillDir(workDir, "sample-skill");
    expect(skillDir).toBeDefined();

    const improveSkill = vi.fn(async () => buildResult(6));
    const cmd = createSkillImproveCommand({
      improveSkill,
      createProductionDeps: (): ImproveDeps => ({
        rewriteSkill: async () => "",
      }),
    });

    const result = await cmd.execute(
      "sample-skill --from-iteration 5",
      buildCtx(workDir),
    );
    expect(result.success).toBe(true);
    const call = improveSkill.mock.calls[0];
    expect(call).toBeDefined();
    const [callArgs] = call as [
      { baselineIteration: number },
    ];
    expect(callArgs.baselineIteration).toBe(5);
  });

  it("uses baselineIteration 0 when workspace has no iterations", async () => {
    await seedSkillDir(workDir, "sample-skill");
    const improveSkill = vi.fn(async () => buildResult(1));
    const cmd = createSkillImproveCommand({
      improveSkill,
      createProductionDeps: (): ImproveDeps => ({
        rewriteSkill: async () => "",
      }),
    });
    await cmd.execute("sample-skill", buildCtx(workDir));
    const call = improveSkill.mock.calls[0];
    const [callArgs] = call as [{ baselineIteration: number }];
    expect(callArgs.baselineIteration).toBe(0);
  });

  it("surfaces ImproveError with code prefix on failure", async () => {
    await seedSkillDir(workDir, "sample-skill");
    const improveSkill = vi.fn(async () => {
      throw new ImproveError("MISSING_FRONTMATTER", "no frontmatter in revision");
    });
    const cmd = createSkillImproveCommand({
      improveSkill,
      createProductionDeps: (): ImproveDeps => ({
        rewriteSkill: async () => "",
      }),
    });
    const result = await cmd.execute("sample-skill", buildCtx(workDir));
    expect(result.success).toBe(false);
    expect(result.output).toContain("MISSING_FRONTMATTER");
    expect(result.output).toContain("no frontmatter");
  });

  it("wraps generic errors with a friendly prefix", async () => {
    await seedSkillDir(workDir, "sample-skill");
    const improveSkill = vi.fn(async () => {
      throw new Error("boom");
    });
    const cmd = createSkillImproveCommand({
      improveSkill,
      createProductionDeps: (): ImproveDeps => ({
        rewriteSkill: async () => "",
      }),
    });
    const result = await cmd.execute("sample-skill", buildCtx(workDir));
    expect(result.success).toBe(false);
    expect(result.output).toContain("/skill-improve failed");
    expect(result.output).toContain("boom");
  });
});
