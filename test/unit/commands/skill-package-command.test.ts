/**
 * Unit tests for the /skill-package slash command.
 *
 * All interaction with the packager is stubbed via createSkillPackageCommand's
 * DI factory so the tests are fast and fully deterministic.
 */

import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import {
  createSkillPackageCommand,
  skillPackageCommand,
} from "../../../src/commands/skill-package.js";
import { type CommandContext } from "../../../src/commands/registry.js";
import {
  PackageError,
  type PackageOptions,
  type PackageResult,
} from "../../../src/skills/creator/packaging/package.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeCtx(workingDirectory = "/tmp/project"): CommandContext {
  return {
    workingDirectory,
    model: "gpt-4o-mini",
    emit: () => undefined,
  };
}

function makeResult(overrides: Partial<PackageResult> = {}): PackageResult {
  return {
    outputPath: "/tmp/project/.dhelix/dist/demo-skill-0.1.0.dskill",
    sha256: "a".repeat(64),
    manifest: {
      name: "demo-skill",
      version: "0.1.0",
      description: "demo",
      trustLevel: "project",
      sha256: "a".repeat(64),
      createdAt: "2026-04-17T00:00:00.000Z",
      files: ["manifest.json", "SKILL.md", "README.md"],
    },
    fileCount: 3,
    bytes: 4096,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("skillPackageCommand — metadata", () => {
  it("has the expected name, description keywords, and usage", () => {
    expect(skillPackageCommand.name).toBe("skill-package");
    expect(skillPackageCommand.description).toMatch(/\.dskill/);
    expect(skillPackageCommand.description).toMatch(/package skill/i);
    expect(skillPackageCommand.usage).toContain("/skill-package");
    expect(skillPackageCommand.usage).toContain("--version");
    expect(skillPackageCommand.usage).toContain("--output");
    expect(skillPackageCommand.usage).toContain("--trust-level");
  });
});

describe("skillPackageCommand — argument validation", () => {
  it("fails when no skill name is provided", async () => {
    const cmd = createSkillPackageCommand({
      packageSkill: vi.fn(),
    });
    const res = await cmd.execute("", makeCtx());
    expect(res.success).toBe(false);
    expect(res.output).toMatch(/skill name is required/i);
  });

  it("fails when name is not kebab-case", async () => {
    const cmd = createSkillPackageCommand({ packageSkill: vi.fn() });
    const res = await cmd.execute("BadName", makeCtx());
    expect(res.success).toBe(false);
    expect(res.output).toMatch(/INVALID_NAME/);
  });

  it("fails on unknown flag", async () => {
    const cmd = createSkillPackageCommand({ packageSkill: vi.fn() });
    const res = await cmd.execute("demo-skill --bogus", makeCtx());
    expect(res.success).toBe(false);
    expect(res.output).toMatch(/Unknown flag/);
  });

  it("fails when --version has no value", async () => {
    const cmd = createSkillPackageCommand({ packageSkill: vi.fn() });
    const res = await cmd.execute("demo-skill --version", makeCtx());
    expect(res.success).toBe(false);
    expect(res.output).toMatch(/--version/);
  });

  it("fails when --trust-level value is invalid", async () => {
    const cmd = createSkillPackageCommand({ packageSkill: vi.fn() });
    const res = await cmd.execute(
      "demo-skill --trust-level sketchy",
      makeCtx(),
    );
    expect(res.success).toBe(false);
    expect(res.output).toMatch(/INVALID_TRUST_LEVEL/);
  });
});

describe("skillPackageCommand — error mapping", () => {
  it("returns a hint when skillDir is missing (SKILL_NOT_FOUND)", async () => {
    const cmd = createSkillPackageCommand({
      packageSkill: async () => {
        throw new PackageError("SKILL_NOT_FOUND", "nope");
      },
    });
    const res = await cmd.execute("demo-skill", makeCtx());
    expect(res.success).toBe(false);
    expect(res.output).toMatch(/not found/i);
    expect(res.output).toMatch(/create-skill/);
  });

  it("reports PackageError code for other packager failures", async () => {
    const cmd = createSkillPackageCommand({
      packageSkill: async () => {
        throw new PackageError("IO_ERROR", "disk full");
      },
    });
    const res = await cmd.execute("demo-skill", makeCtx());
    expect(res.success).toBe(false);
    expect(res.output).toMatch(/IO_ERROR/);
    expect(res.output).toMatch(/disk full/);
  });

  it("catches generic errors gracefully", async () => {
    const cmd = createSkillPackageCommand({
      packageSkill: async () => {
        throw new Error("unexpected");
      },
    });
    const res = await cmd.execute("demo-skill", makeCtx());
    expect(res.success).toBe(false);
    expect(res.output).toMatch(/failed/i);
  });
});

describe("skillPackageCommand — happy path & flag forwarding", () => {
  it("invokes packageSkill with default skillDir / outputDir", async () => {
    const spy = vi.fn(async (_opts: PackageOptions) => makeResult());
    const cmd = createSkillPackageCommand({ packageSkill: spy });
    const ctx = makeCtx("/project");
    const res = await cmd.execute("demo-skill", ctx);

    expect(spy).toHaveBeenCalledTimes(1);
    const opts = spy.mock.calls[0]?.[0] as PackageOptions;
    expect(opts.skillDir).toBe(join("/project", ".dhelix", "skills", "demo-skill"));
    expect(opts.outputDir).toBe(join("/project", ".dhelix", "dist"));
    expect(opts.version).toBeUndefined();
    expect(opts.trustLevel).toBeUndefined();
    expect(res.success).toBe(true);
  });

  it("forwards --version, --output, --trust-level to packageSkill", async () => {
    const spy = vi.fn(async (_opts: PackageOptions) =>
      makeResult({
        manifest: {
          ...makeResult().manifest,
          version: "1.2.3",
          trustLevel: "community",
        },
      }),
    );
    const cmd = createSkillPackageCommand({ packageSkill: spy });
    const res = await cmd.execute(
      "demo-skill --version 1.2.3 --output /out/dir --trust-level community",
      makeCtx("/project"),
    );

    const opts = spy.mock.calls[0]?.[0] as PackageOptions;
    expect(opts.version).toBe("1.2.3");
    expect(opts.outputDir).toBe("/out/dir");
    expect(opts.trustLevel).toBe("community");
    expect(res.success).toBe(true);
  });

  it("output summary mentions path, size, file count, sha256, and trust level", async () => {
    const cmd = createSkillPackageCommand({
      packageSkill: async () => makeResult(),
    });
    const res = await cmd.execute("demo-skill", makeCtx());
    expect(res.success).toBe(true);
    expect(res.output).toContain("demo-skill-0.1.0.dskill");
    expect(res.output).toMatch(/size:/);
    expect(res.output).toMatch(/files:\s+3/);
    expect(res.output).toContain("a".repeat(16));
    expect(res.output).toMatch(/trust:\s+project/);
  });
});
