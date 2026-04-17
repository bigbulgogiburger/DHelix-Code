/**
 * Tests for src/commands/skill-install.ts — /skill-install slash command.
 *
 * Uses a stubbed `install` injected via createSkillInstallCommand() so we
 * exercise the command contract without touching the real tar reader.
 */

import { describe, expect, it, vi } from "vitest";

import {
  createSkillInstallCommand,
  skillInstallCommand,
} from "../../../src/commands/skill-install.js";
import {
  InstallError,
  type InstallOptions,
  type InstallResult,
} from "../../../src/skills/creator/packaging/install.js";
import type { CommandContext } from "../../../src/commands/registry.js";
import type { DskillManifest } from "../../../src/skills/creator/packaging/package.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeContext(overrides: Partial<CommandContext> = {}): CommandContext {
  return {
    workingDirectory: "C:/work",
    model: "test-model",
    emit: () => undefined,
    ...overrides,
  };
}

function makeManifest(): DskillManifest {
  return {
    name: "demo-skill",
    version: "0.1.0",
    description: "demo",
    trustLevel: "project",
    sha256: "deadbeef",
    createdAt: "2026-04-17T00:00:00.000Z",
    files: ["manifest.json", "SKILL.md"],
  };
}

function successfulInstallResult(): InstallResult {
  return {
    skillDir: "C:/work/.dhelix/skills/demo-skill",
    manifest: makeManifest(),
    filesExtracted: ["SKILL.md", "README.md"],
    verified: true,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("skillInstallCommand metadata", () => {
  it("has the expected shape", () => {
    expect(skillInstallCommand.name).toBe("skill-install");
    expect(skillInstallCommand.description).toMatch(/install/i);
    expect(skillInstallCommand.description).toMatch(/\.dskill/i);
    expect(skillInstallCommand.usage).toContain("/skill-install");
    expect(typeof skillInstallCommand.execute).toBe("function");
  });
});

describe("createSkillInstallCommand — argument parsing", () => {
  it("fails when archive path is missing", async () => {
    const cmd = createSkillInstallCommand({
      install: vi.fn(),
      fs: { stat: vi.fn().mockResolvedValue({}) },
    });
    const result = await cmd.execute("", makeContext());
    expect(result.success).toBe(false);
    expect(result.output).toContain("archive path is required");
  });

  it("fails when archive does not exist (stat rejects)", async () => {
    const cmd = createSkillInstallCommand({
      install: vi.fn(),
      fs: { stat: vi.fn().mockRejectedValue(new Error("ENOENT")) },
    });
    const result = await cmd.execute("nope.dskill", makeContext());
    expect(result.success).toBe(false);
    expect(result.output).toContain("archive not found");
  });

  it("rejects unknown flags", async () => {
    const cmd = createSkillInstallCommand({
      install: vi.fn(),
      fs: { stat: vi.fn().mockResolvedValue({}) },
    });
    const result = await cmd.execute("file.dskill --weird", makeContext());
    expect(result.success).toBe(false);
    expect(result.output).toContain("Unknown flag");
  });

  it("rejects invalid --trust value", async () => {
    const cmd = createSkillInstallCommand({
      install: vi.fn(),
      fs: { stat: vi.fn().mockResolvedValue({}) },
    });
    const result = await cmd.execute("file.dskill --trust bogus", makeContext());
    expect(result.success).toBe(false);
    expect(result.output).toContain("--trust value");
  });

  it("rejects --trust without value", async () => {
    const cmd = createSkillInstallCommand({
      install: vi.fn(),
      fs: { stat: vi.fn().mockResolvedValue({}) },
    });
    const result = await cmd.execute("file.dskill --trust", makeContext());
    expect(result.success).toBe(false);
    expect(result.output).toContain("--trust requires a value");
  });
});

describe("createSkillInstallCommand — happy path", () => {
  it("invokes installer with resolved options and prints summary", async () => {
    const install = vi.fn<
      (opts: InstallOptions) => Promise<InstallResult>
    >().mockResolvedValue(successfulInstallResult());

    const cmd = createSkillInstallCommand({
      install,
      fs: { stat: vi.fn().mockResolvedValue({}) },
    });

    const result = await cmd.execute(
      "some-skill.dskill --trust community",
      makeContext(),
    );

    expect(result.success).toBe(true);
    expect(install).toHaveBeenCalledTimes(1);
    const opts = install.mock.calls[0]?.[0];
    expect(opts?.trustLevel).toBe("community");
    expect(opts?.verify).toBe(true);
    expect(opts?.destDir).toContain(".dhelix");
    expect(result.output).toContain("installed skill");
    expect(result.output).toContain("trust level: community");
    expect(result.output).toContain("next: /skill-eval demo-skill");
  });

  it("forwards --trust untrusted --force flags", async () => {
    const install = vi.fn<
      (opts: InstallOptions) => Promise<InstallResult>
    >().mockResolvedValue(successfulInstallResult());

    const cmd = createSkillInstallCommand({
      install,
      fs: { stat: vi.fn().mockResolvedValue({}) },
    });

    await cmd.execute(
      "pkg.dskill --trust untrusted --force",
      makeContext(),
    );

    const opts = install.mock.calls[0]?.[0];
    expect(opts?.trustLevel).toBe("untrusted");
    expect(opts?.force).toBe(true);
  });
});

describe("createSkillInstallCommand — security error prefixes", () => {
  it.each([
    ["TAR_SLIP_REJECTED", "entry escapes destination"],
    ["SYMLINK_REJECTED", "entry is a symlink"],
    ["INTEGRITY_MISMATCH", "sha256 mismatch"],
    ["POLICY_VIOLATION", "untrusted skill cannot request tool"],
  ] as const)("prefixes [SECURITY] for %s", async (code, msg) => {
    const cmd = createSkillInstallCommand({
      install: vi.fn().mockRejectedValue(new InstallError(code, msg)),
      fs: { stat: vi.fn().mockResolvedValue({}) },
    });
    const result = await cmd.execute("x.dskill", makeContext());
    expect(result.success).toBe(false);
    expect(result.output.startsWith("[SECURITY]")).toBe(true);
    expect(result.output).toContain(code);
  });

  it("does not prefix non-security install errors", async () => {
    const cmd = createSkillInstallCommand({
      install: vi
        .fn()
        .mockRejectedValue(new InstallError("NAME_COLLISION", "already exists")),
      fs: { stat: vi.fn().mockResolvedValue({}) },
    });
    const result = await cmd.execute("x.dskill", makeContext());
    expect(result.success).toBe(false);
    expect(result.output.startsWith("[SECURITY]")).toBe(false);
    expect(result.output).toContain("NAME_COLLISION");
  });

  it("wraps unexpected errors as generic failures", async () => {
    const cmd = createSkillInstallCommand({
      install: vi.fn().mockRejectedValue(new Error("boom")),
      fs: { stat: vi.fn().mockResolvedValue({}) },
    });
    const result = await cmd.execute("x.dskill", makeContext());
    expect(result.success).toBe(false);
    expect(result.output).toContain("/skill-install failed");
  });
});
