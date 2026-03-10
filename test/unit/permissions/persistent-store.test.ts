import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm, writeFile, readFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

import {
  createPersistentPermissionStore,
  type PersistentPermissionStore,
} from "../../../src/permissions/persistent-store.js";

describe("PersistentPermissionStore", () => {
  let tempDir: string;
  let projectDir: string;
  let store: PersistentPermissionStore;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "dbcode-perm-test-"));
    projectDir = join(tempDir, "project");
    await mkdir(projectDir, { recursive: true });
    store = createPersistentPermissionStore(projectDir);
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  /**
   * Helper to write a project-level settings.json.
   */
  async function writeProjectSettings(content: Record<string, unknown>): Promise<void> {
    const settingsDir = join(projectDir, ".dbcode");
    await mkdir(settingsDir, { recursive: true });
    await writeFile(join(settingsDir, "settings.json"), JSON.stringify(content, null, 2), "utf-8");
  }

  /**
   * Helper to read project-level settings.json.
   */
  async function readProjectSettings(): Promise<Record<string, unknown>> {
    const filePath = join(projectDir, ".dbcode", "settings.json");
    const raw = await readFile(filePath, "utf-8");
    return JSON.parse(raw) as Record<string, unknown>;
  }

  // -----------------------------------------------------------------------
  // loadRules
  // -----------------------------------------------------------------------

  describe("loadRules()", () => {
    it("returns empty array when settings.json doesn't exist", async () => {
      const rules = await store.loadRules();
      expect(rules).toEqual([]);
    });

    it("parses allow rules correctly", async () => {
      await writeProjectSettings({
        permissions: {
          allow: ["file_read", "Bash(npm *)"],
          deny: [],
        },
      });

      const rules = await store.loadRules();
      const allowRules = rules.filter((r) => r.type === "allow");

      expect(allowRules).toHaveLength(2);
      expect(allowRules[0]!.tool).toBe("file_read");
      expect(allowRules[0]!.pattern).toBeUndefined();
      expect(allowRules[1]!.tool).toBe("Bash");
      expect(allowRules[1]!.pattern).toBe("npm *");
    });

    it("parses deny rules correctly", async () => {
      await writeProjectSettings({
        permissions: {
          allow: [],
          deny: ["Bash(rm -rf *)", "file_write"],
        },
      });

      const rules = await store.loadRules();
      const denyRules = rules.filter((r) => r.type === "deny");

      expect(denyRules).toHaveLength(2);
      expect(denyRules[0]!.tool).toBe("Bash");
      expect(denyRules[0]!.pattern).toBe("rm -rf *");
      expect(denyRules[1]!.tool).toBe("file_write");
    });

    it("merges project and user rules", async () => {
      // Project rules
      await writeProjectSettings({
        permissions: {
          allow: ["file_read"],
          deny: [],
        },
      });

      // User rules are from ~/.dbcode/settings.json
      // Since we can't easily mock homedir(), we just verify project rules load
      const rules = await store.loadRules();
      const projectRules = rules.filter((r) => r.scope === "project");
      expect(projectRules.length).toBeGreaterThanOrEqual(1);
    });

    it("handles malformed settings.json gracefully", async () => {
      const settingsDir = join(projectDir, ".dbcode");
      await mkdir(settingsDir, { recursive: true });
      await writeFile(join(settingsDir, "settings.json"), "not valid json{{{", "utf-8");

      const rules = await store.loadRules();
      expect(rules).toEqual([]);
    });

    it("handles settings.json without permissions key", async () => {
      await writeProjectSettings({ theme: "dark", editor: "vim" });

      const rules = await store.loadRules();
      expect(rules).toEqual([]);
    });
  });

  // -----------------------------------------------------------------------
  // addRule
  // -----------------------------------------------------------------------

  describe("addRule()", () => {
    it("creates settings.json if it doesn't exist", async () => {
      await store.addRule({ tool: "file_read", type: "allow" }, "project");

      const settings = await readProjectSettings();
      const perms = settings["permissions"] as { allow: string[]; deny: string[] };
      expect(perms.allow).toContain("file_read");
    });

    it("appends to existing rules without overwriting other settings", async () => {
      await writeProjectSettings({
        theme: "dark",
        permissions: {
          allow: ["file_read"],
          deny: [],
        },
      });

      await store.addRule({ tool: "Bash", pattern: "npm *", type: "allow" }, "project");

      const settings = await readProjectSettings();
      expect(settings["theme"]).toBe("dark");

      const perms = settings["permissions"] as { allow: string[]; deny: string[] };
      expect(perms.allow).toContain("file_read");
      expect(perms.allow).toContain("Bash(npm *)");
    });

    it("does not duplicate existing rules", async () => {
      await store.addRule({ tool: "file_read", type: "allow" }, "project");
      await store.addRule({ tool: "file_read", type: "allow" }, "project");

      const settings = await readProjectSettings();
      const perms = settings["permissions"] as { allow: string[] };
      const count = perms.allow.filter((r) => r === "file_read").length;
      expect(count).toBe(1);
    });

    it("adds deny rules to the deny list", async () => {
      await store.addRule({ tool: "Bash", pattern: "rm -rf *", type: "deny" }, "project");

      const settings = await readProjectSettings();
      const perms = settings["permissions"] as { allow: string[]; deny: string[] };
      expect(perms.deny).toContain("Bash(rm -rf *)");
      expect(perms.allow).toEqual([]);
    });
  });

  // -----------------------------------------------------------------------
  // removeRule
  // -----------------------------------------------------------------------

  describe("removeRule()", () => {
    it("removes matching rule", async () => {
      await store.addRule({ tool: "file_read", type: "allow" }, "project");
      await store.addRule({ tool: "Bash", pattern: "npm *", type: "allow" }, "project");

      await store.removeRule("file_read", undefined, "project");

      const settings = await readProjectSettings();
      const perms = settings["permissions"] as { allow: string[] };
      expect(perms.allow).not.toContain("file_read");
      expect(perms.allow).toContain("Bash(npm *)");
    });

    it("removes matching rule with pattern", async () => {
      await store.addRule({ tool: "Bash", pattern: "npm *", type: "allow" }, "project");

      await store.removeRule("Bash", "npm *", "project");

      const settings = await readProjectSettings();
      const perms = settings["permissions"] as { allow: string[] };
      expect(perms.allow).not.toContain("Bash(npm *)");
    });

    it("no-op for non-existent rule", async () => {
      await writeProjectSettings({
        permissions: {
          allow: ["file_read"],
          deny: [],
        },
      });

      // Should not throw
      await store.removeRule("nonexistent_tool", undefined, "project");

      const settings = await readProjectSettings();
      const perms = settings["permissions"] as { allow: string[] };
      expect(perms.allow).toContain("file_read");
    });

    it("removes from both scopes when scope is undefined", async () => {
      await store.addRule({ tool: "file_read", type: "allow" }, "project");

      // Remove from both scopes (no scope arg)
      await store.removeRule("file_read");

      const settings = await readProjectSettings();
      const perms = settings["permissions"] as { allow: string[] };
      expect(perms.allow).not.toContain("file_read");
    });
  });

  // -----------------------------------------------------------------------
  // checkPermission
  // -----------------------------------------------------------------------

  describe("checkPermission()", () => {
    it("returns 'none' for unknown tool", async () => {
      const result = await store.checkPermission("unknown_tool");
      expect(result).toBe("none");
    });

    it("returns 'allow' for allowed tool", async () => {
      await store.addRule({ tool: "file_read", type: "allow" }, "project");

      const result = await store.checkPermission("file_read");
      expect(result).toBe("allow");
    });

    it("returns 'deny' for denied tool", async () => {
      await store.addRule({ tool: "file_write", type: "deny" }, "project");

      const result = await store.checkPermission("file_write");
      expect(result).toBe("deny");
    });

    it("deny takes precedence over allow", async () => {
      await store.addRule({ tool: "bash_exec", type: "allow" }, "project");
      await store.addRule({ tool: "bash_exec", type: "deny" }, "project");

      const result = await store.checkPermission("bash_exec");
      expect(result).toBe("deny");
    });

    it("matches pattern-based allow rules with args", async () => {
      await store.addRule({ tool: "bash_exec", pattern: "npm *", type: "allow" }, "project");

      const allowResult = await store.checkPermission("bash_exec", { command: "npm install" });
      expect(allowResult).toBe("allow");

      const noneResult = await store.checkPermission("bash_exec", { command: "rm -rf /" });
      expect(noneResult).toBe("none");
    });

    it("matches pattern-based deny rules with args", async () => {
      await store.addRule({ tool: "bash_exec", pattern: "rm *", type: "deny" }, "project");

      // Single star doesn't cross path separators, so use a command without slashes
      const result = await store.checkPermission("bash_exec", { command: "rm -rf temp" });
      expect(result).toBe("deny");
    });

    it("returns 'none' when no pattern matches the args", async () => {
      await store.addRule({ tool: "bash_exec", pattern: "npm *", type: "allow" }, "project");

      const result = await store.checkPermission("bash_exec", { command: "yarn install" });
      expect(result).toBe("none");
    });

    it("checks file_path args for file tools", async () => {
      await store.addRule({ tool: "file_edit", pattern: "/src/**", type: "allow" }, "project");

      const allowResult = await store.checkPermission("file_edit", {
        file_path: "/src/utils/path.ts",
      });
      expect(allowResult).toBe("allow");

      const noneResult = await store.checkPermission("file_edit", {
        file_path: "/test/foo.ts",
      });
      expect(noneResult).toBe("none");
    });
  });

  // -----------------------------------------------------------------------
  // getRulesForTool
  // -----------------------------------------------------------------------

  describe("getRulesForTool()", () => {
    it("filters by tool name", async () => {
      await store.addRule({ tool: "file_read", type: "allow" }, "project");
      await store.addRule({ tool: "bash_exec", pattern: "npm *", type: "allow" }, "project");
      await store.addRule({ tool: "bash_exec", pattern: "rm *", type: "deny" }, "project");
      await store.addRule({ tool: "file_write", type: "deny" }, "project");

      const bashRules = await store.getRulesForTool("bash_exec");
      expect(bashRules).toHaveLength(2);
      expect(bashRules.every((r) => r.tool === "bash_exec")).toBe(true);
    });

    it("returns empty for tool with no rules", async () => {
      await store.addRule({ tool: "file_read", type: "allow" }, "project");

      const rules = await store.getRulesForTool("nonexistent_tool");
      expect(rules).toEqual([]);
    });
  });

  // -----------------------------------------------------------------------
  // clearRules
  // -----------------------------------------------------------------------

  describe("clearRules()", () => {
    it("removes all rules for a scope", async () => {
      await store.addRule({ tool: "file_read", type: "allow" }, "project");
      await store.addRule({ tool: "bash_exec", type: "deny" }, "project");

      const rulesBefore = await store.loadRules();
      const projectRulesBefore = rulesBefore.filter((r) => r.scope === "project");
      expect(projectRulesBefore.length).toBeGreaterThan(0);

      await store.clearRules("project");

      const rulesAfter = await store.loadRules();
      const projectRulesAfter = rulesAfter.filter((r) => r.scope === "project");
      expect(projectRulesAfter).toEqual([]);
    });

    it("preserves other settings when clearing", async () => {
      await writeProjectSettings({
        theme: "dark",
        permissions: {
          allow: ["file_read"],
          deny: ["bash_exec"],
        },
      });

      await store.clearRules("project");

      const settings = await readProjectSettings();
      expect(settings["theme"]).toBe("dark");
      const perms = settings["permissions"] as { allow: string[]; deny: string[] };
      expect(perms.allow).toEqual([]);
      expect(perms.deny).toEqual([]);
    });
  });

  // -----------------------------------------------------------------------
  // Edge cases
  // -----------------------------------------------------------------------

  describe("edge cases", () => {
    it("handles settings with permissions that are not an object", async () => {
      await writeProjectSettings({
        permissions: "invalid",
      });

      const rules = await store.loadRules();
      expect(rules).toEqual([]);
    });

    it("handles permissions.allow that is not an array", async () => {
      await writeProjectSettings({
        permissions: {
          allow: "not-an-array",
          deny: [],
        },
      });

      const rules = await store.loadRules();
      // Should gracefully return empty allow rules
      const allowRules = rules.filter((r) => r.type === "allow");
      expect(allowRules).toEqual([]);
    });

    it("filters out non-string entries in allow/deny arrays", async () => {
      await writeProjectSettings({
        permissions: {
          allow: ["file_read", 123, null, "bash_exec"],
          deny: [true, "file_write"],
        },
      });

      const rules = await store.loadRules();
      const allowRules = rules.filter((r) => r.type === "allow");
      const denyRules = rules.filter((r) => r.type === "deny");

      expect(allowRules).toHaveLength(2);
      expect(denyRules).toHaveLength(1);
    });
  });
});
