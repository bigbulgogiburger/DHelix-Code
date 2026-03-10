import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { permissionsCommand, validatePattern } from "../../../src/commands/permissions.js";
import { mkdir, rm, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { homedir } from "node:os";

/**
 * To avoid touching the real ~/.dbcode/settings.json during tests,
 * we test pattern validation directly and exercise the command's
 * subcommand parsing/formatting through a temporary settings directory.
 *
 * NOTE: The command reads from CONFIG_DIR (~/. dbcode). For isolated
 * integration testing, we set up a backup/restore mechanism for
 * the real settings file. For pure unit tests we rely on validatePattern
 * and output format assertions.
 */

const settingsDir = join(homedir(), ".dbcode");
const settingsPath = join(settingsDir, "settings.json");
let originalSettings: string | null = null;

const baseContext = {
  workingDirectory: process.cwd(),
  model: "test-model",
  sessionId: "test-session",
  emit: () => {},
};

describe("/permissions command", () => {
  beforeEach(async () => {
    // Back up existing settings if present
    try {
      originalSettings = await readFile(settingsPath, "utf-8");
    } catch {
      originalSettings = null;
    }
    // Ensure the directory exists and write a clean settings file
    await mkdir(settingsDir, { recursive: true });
    await writeFile(
      settingsPath,
      JSON.stringify({ permissionMode: "default", permissions: { allow: [], deny: [] } }, null, 2) + "\n",
      "utf-8",
    );
  });

  afterEach(async () => {
    // Restore original settings
    if (originalSettings !== null) {
      await writeFile(settingsPath, originalSettings, "utf-8");
    } else {
      try {
        await rm(settingsPath, { force: true });
      } catch {
        /* ignore */
      }
    }
  });

  describe("metadata", () => {
    it("should have correct name and description", () => {
      expect(permissionsCommand.name).toBe("permissions");
      expect(permissionsCommand.description).toBeDefined();
      expect(permissionsCommand.usage).toContain("/permissions");
    });
  });

  describe("show status (no args)", () => {
    it("should display current permission mode", async () => {
      const result = await permissionsCommand.execute("", baseContext);
      expect(result.success).toBe(true);
      expect(result.output).toContain("Mode: default");
      expect(result.output).toContain("Permission Status");
    });

    it("should display empty allow and deny rules", async () => {
      const result = await permissionsCommand.execute("", baseContext);
      expect(result.success).toBe(true);
      expect(result.output).toContain("Persistent Allow Rules:");
      expect(result.output).toContain("(none)");
      expect(result.output).toContain("Persistent Deny Rules:");
    });

    it("should display populated rules", async () => {
      // Pre-populate settings with rules
      await writeFile(
        settingsPath,
        JSON.stringify({
          permissionMode: "acceptEdits",
          permissions: {
            allow: ["Bash(npm *)"],
            deny: ["file_write"],
          },
        }, null, 2) + "\n",
        "utf-8",
      );

      const result = await permissionsCommand.execute("", baseContext);
      expect(result.success).toBe(true);
      expect(result.output).toContain("Mode: acceptEdits");
      expect(result.output).toContain("+ Bash(npm *)");
      expect(result.output).toContain("- file_write");
    });

    it("should show usage hints", async () => {
      const result = await permissionsCommand.execute("", baseContext);
      expect(result.output).toContain("/permissions allow <pattern>");
      expect(result.output).toContain("/permissions deny <pattern>");
      expect(result.output).toContain("/permissions remove <pattern>");
      expect(result.output).toContain("/permissions reset");
    });
  });

  describe("allow subcommand", () => {
    it("should add an allow rule", async () => {
      const result = await permissionsCommand.execute("allow file_read", baseContext);
      expect(result.success).toBe(true);
      expect(result.output).toContain("Added allow rule: file_read");

      // Verify settings file was updated
      const settings = JSON.parse(await readFile(settingsPath, "utf-8"));
      expect(settings.permissions.allow).toContain("file_read");
    });

    it("should add an allow rule with argument pattern", async () => {
      const result = await permissionsCommand.execute("allow Bash(npm *)", baseContext);
      expect(result.success).toBe(true);
      expect(result.output).toContain("Added allow rule: Bash(npm *)");
    });

    it("should reject duplicate allow rules", async () => {
      await permissionsCommand.execute("allow file_read", baseContext);
      const result = await permissionsCommand.execute("allow file_read", baseContext);
      expect(result.success).toBe(true);
      expect(result.output).toContain("already exists");
    });

    it("should reject invalid patterns", async () => {
      const result = await permissionsCommand.execute("allow (bad", baseContext);
      expect(result.success).toBe(false);
      expect(result.output).toContain("Invalid pattern");
    });

    it("should show usage when no pattern provided", async () => {
      const result = await permissionsCommand.execute("allow", baseContext);
      expect(result.success).toBe(false);
      expect(result.output).toContain("Usage:");
    });
  });

  describe("deny subcommand", () => {
    it("should add a deny rule", async () => {
      const result = await permissionsCommand.execute("deny bash_exec", baseContext);
      expect(result.success).toBe(true);
      expect(result.output).toContain("Added deny rule: bash_exec");

      const settings = JSON.parse(await readFile(settingsPath, "utf-8"));
      expect(settings.permissions.deny).toContain("bash_exec");
    });

    it("should add a deny rule with argument pattern", async () => {
      const result = await permissionsCommand.execute("deny Edit(/etc/**)", baseContext);
      expect(result.success).toBe(true);
      expect(result.output).toContain("Added deny rule: Edit(/etc/**)");
    });

    it("should reject duplicate deny rules", async () => {
      await permissionsCommand.execute("deny bash_exec", baseContext);
      const result = await permissionsCommand.execute("deny bash_exec", baseContext);
      expect(result.success).toBe(true);
      expect(result.output).toContain("already exists");
    });

    it("should reject invalid patterns", async () => {
      const result = await permissionsCommand.execute("deny ", baseContext);
      expect(result.success).toBe(false);
      expect(result.output).toContain("Usage:");
    });
  });

  describe("remove subcommand", () => {
    it("should remove an allow rule", async () => {
      await permissionsCommand.execute("allow file_read", baseContext);
      const result = await permissionsCommand.execute("remove file_read", baseContext);
      expect(result.success).toBe(true);
      expect(result.output).toContain("Removed rule from allow: file_read");

      const settings = JSON.parse(await readFile(settingsPath, "utf-8"));
      expect(settings.permissions.allow).not.toContain("file_read");
    });

    it("should remove a deny rule", async () => {
      await permissionsCommand.execute("deny bash_exec", baseContext);
      const result = await permissionsCommand.execute("remove bash_exec", baseContext);
      expect(result.success).toBe(true);
      expect(result.output).toContain("Removed rule from deny: bash_exec");

      const settings = JSON.parse(await readFile(settingsPath, "utf-8"));
      expect(settings.permissions.deny).not.toContain("bash_exec");
    });

    it("should report when rule is not found", async () => {
      const result = await permissionsCommand.execute("remove nonexistent", baseContext);
      expect(result.success).toBe(false);
      expect(result.output).toContain("Rule not found: nonexistent");
    });

    it("should show usage when no pattern provided", async () => {
      const result = await permissionsCommand.execute("remove", baseContext);
      expect(result.success).toBe(false);
      expect(result.output).toContain("Usage:");
    });
  });

  describe("reset subcommand", () => {
    it("should clear all rules", async () => {
      await permissionsCommand.execute("allow file_read", baseContext);
      await permissionsCommand.execute("deny bash_exec", baseContext);

      const result = await permissionsCommand.execute("reset", baseContext);
      expect(result.success).toBe(true);
      expect(result.output).toContain("Cleared 2 persistent permission rules");

      const settings = JSON.parse(await readFile(settingsPath, "utf-8"));
      expect(settings.permissions.allow).toEqual([]);
      expect(settings.permissions.deny).toEqual([]);
    });

    it("should handle reset when no rules exist", async () => {
      const result = await permissionsCommand.execute("reset", baseContext);
      expect(result.success).toBe(true);
      expect(result.output).toContain("No persistent rules to clear");
    });

    it("should use singular form for one rule", async () => {
      await permissionsCommand.execute("allow file_read", baseContext);
      const result = await permissionsCommand.execute("reset", baseContext);
      expect(result.success).toBe(true);
      expect(result.output).toContain("Cleared 1 persistent permission rule.");
    });
  });

  describe("unknown subcommand", () => {
    it("should return error for unknown subcommand", async () => {
      const result = await permissionsCommand.execute("foobar", baseContext);
      expect(result.success).toBe(false);
      expect(result.output).toContain("Unknown subcommand: foobar");
    });
  });
});

describe("validatePattern", () => {
  it("should accept simple tool names", () => {
    expect(validatePattern("file_read")).toBeNull();
    expect(validatePattern("bash_exec")).toBeNull();
    expect(validatePattern("Edit")).toBeNull();
  });

  it("should accept tool names with glob characters", () => {
    expect(validatePattern("file_*")).toBeNull();
    expect(validatePattern("*")).toBeNull();
    expect(validatePattern("bash?exec")).toBeNull();
  });

  it("should accept tool name with argument pattern", () => {
    expect(validatePattern("Bash(npm *)")).toBeNull();
    expect(validatePattern("Edit(/src/**)")).toBeNull();
    expect(validatePattern("file_read(*.ts)")).toBeNull();
  });

  it("should reject empty patterns", () => {
    expect(validatePattern("")).not.toBeNull();
    expect(validatePattern("  ")).not.toBeNull();
  });

  it("should reject unbalanced parentheses", () => {
    expect(validatePattern("Bash(npm")).not.toBeNull();
    expect(validatePattern("Bash)npm")).not.toBeNull();
    expect(validatePattern("(bad")).not.toBeNull();
  });

  it("should reject patterns starting with invalid characters", () => {
    expect(validatePattern("123tool")).not.toBeNull();
    expect(validatePattern("-tool")).not.toBeNull();
  });

  it("should trim whitespace and accept valid patterns", () => {
    // Leading/trailing whitespace is trimmed before validation
    expect(validatePattern(" tool")).toBeNull();
  });
});
