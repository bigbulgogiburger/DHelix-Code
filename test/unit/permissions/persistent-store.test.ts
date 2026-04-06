import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdtemp, rm, readFile, writeFile, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

// Mock homedir so user-scope settings also go to our temp dir
const { mockHomedir } = vi.hoisted(() => {
  // Provide a default so module-level calls (e.g. constants.ts CONFIG_DIR) don't crash
  const mockHomedir = vi.fn<() => string>().mockReturnValue("/tmp/dhelix-mock-home");
  return { mockHomedir };
});

vi.mock("node:os", async () => {
  const actual = await vi.importActual<typeof import("node:os")>("node:os");
  return { ...actual, homedir: () => mockHomedir() };
});

import {
  createPersistentPermissionStore,
  type PersistentPermissionRule,
} from "../../../src/permissions/persistent-store.js";

describe("PersistentPermissionStore", () => {
  let tempDir: string;
  /** The project-scope settings path: {tempDir}/.dhelix/settings.json */
  let projectSettingsPath: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "dhelix-persist-test-"));
    // Point homedir to a subfolder so user-scope writes don't collide
    mockHomedir.mockReturnValue(tempDir);
    projectSettingsPath = join(tempDir, ".dhelix", "settings.json");
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  /** Helper: write a project-scope settings file */
  async function writeProjectSettings(data: unknown): Promise<void> {
    await mkdir(join(tempDir, ".dhelix"), { recursive: true });
    await writeFile(projectSettingsPath, JSON.stringify(data), "utf-8");
  }

  /** Helper: read back the project-scope settings file */
  async function readProjectSettings(): Promise<Record<string, unknown>> {
    const raw = await readFile(projectSettingsPath, "utf-8");
    return JSON.parse(raw) as Record<string, unknown>;
  }

  describe("loadRules", () => {
    it("should return empty array when file does not exist", async () => {
      const store = createPersistentPermissionStore(tempDir);
      const rules = await store.loadRules();

      expect(rules).toEqual([]);
    });

    it("should return empty array for empty object", async () => {
      await writeProjectSettings({});
      const store = createPersistentPermissionStore(tempDir);
      const rules = await store.loadRules();

      expect(rules).toEqual([]);
    });

    it("should load existing rules", async () => {
      const data = {
        permissions: {
          allow: ["Bash(npm *)", "Edit(/src/**)"],
          deny: ["Bash(rm -rf *)"],
        },
      };
      await writeProjectSettings(data);

      const store = createPersistentPermissionStore(tempDir);
      const rules = await store.loadRules();

      const allowRules = rules.filter((r) => r.type === "allow");
      const denyRules = rules.filter((r) => r.type === "deny");

      expect(allowRules).toHaveLength(2);
      expect(allowRules[0]).toMatchObject({ tool: "Bash", pattern: "npm *", type: "allow" });
      expect(allowRules[1]).toMatchObject({ tool: "Edit", pattern: "/src/**", type: "allow" });
      expect(denyRules).toHaveLength(1);
      expect(denyRules[0]).toMatchObject({ tool: "Bash", pattern: "rm -rf *", type: "deny" });
    });

    it("should return empty array for invalid JSON", async () => {
      await mkdir(join(tempDir, ".dhelix"), { recursive: true });
      await writeFile(projectSettingsPath, "not json!!!", "utf-8");
      const store = createPersistentPermissionStore(tempDir);
      const rules = await store.loadRules();

      expect(rules).toEqual([]);
    });

    it("should preserve extra fields in settings when loading", async () => {
      const data = {
        permissions: { allow: ["Bash(npm *)"], deny: [] },
        llm: { model: "gpt-4" },
        customField: true,
      };
      await writeProjectSettings(data);

      const store = createPersistentPermissionStore(tempDir);
      const rules = await store.loadRules();

      const allowRules = rules.filter((r) => r.type === "allow");
      expect(allowRules).toHaveLength(1);
      expect(allowRules[0]).toMatchObject({ tool: "Bash", pattern: "npm *" });
    });

    it("should return frozen array", async () => {
      const data = {
        permissions: { allow: ["Bash(npm *)"], deny: ["Bash(rm *)"] },
      };
      await writeProjectSettings(data);

      const store = createPersistentPermissionStore(tempDir);
      const rules = await store.loadRules();

      expect(Object.isFrozen(rules)).toBe(true);
    });
  });

  describe("addRule (allow)", () => {
    it("should create settings file with allow rule if not exists", async () => {
      const store = createPersistentPermissionStore(tempDir);
      await store.addRule({ tool: "Bash", pattern: "npm *", type: "allow" }, "project");

      const content = await readProjectSettings();
      const perms = content.permissions as { allow: string[]; deny: string[] };
      expect(perms.allow).toEqual(["Bash(npm *)"]);
      expect(perms.deny).toEqual([]);
    });

    it("should append to existing allow rules", async () => {
      const data = {
        permissions: { allow: ["Bash(npm *)"], deny: [] },
      };
      await writeProjectSettings(data);

      const store = createPersistentPermissionStore(tempDir);
      await store.addRule({ tool: "Edit", pattern: "/src/**", type: "allow" }, "project");

      const content = await readProjectSettings();
      const perms = content.permissions as { allow: string[]; deny: string[] };
      expect(perms.allow).toEqual(["Bash(npm *)", "Edit(/src/**)"]);
    });

    it("should not duplicate existing rule", async () => {
      const data = {
        permissions: { allow: ["Bash(npm *)"], deny: [] },
      };
      await writeProjectSettings(data);

      const store = createPersistentPermissionStore(tempDir);
      await store.addRule({ tool: "Bash", pattern: "npm *", type: "allow" }, "project");

      const content = await readProjectSettings();
      const perms = content.permissions as { allow: string[]; deny: string[] };
      expect(perms.allow).toEqual(["Bash(npm *)"]);
    });

    it("should preserve other settings fields", async () => {
      const data = {
        permissions: { allow: [], deny: [] },
        llm: { model: "gpt-4" },
        verbose: true,
      };
      await writeProjectSettings(data);

      const store = createPersistentPermissionStore(tempDir);
      await store.addRule({ tool: "file_read", type: "allow" }, "project");

      const content = await readProjectSettings();
      expect((content.llm as Record<string, unknown>).model).toBe("gpt-4");
      expect(content.verbose).toBe(true);
      const perms = content.permissions as { allow: string[]; deny: string[] };
      expect(perms.allow).toEqual(["file_read"]);
    });
  });

  describe("addRule (deny)", () => {
    it("should add a deny rule", async () => {
      const store = createPersistentPermissionStore(tempDir);
      await store.addRule({ tool: "Bash", pattern: "rm -rf *", type: "deny" }, "project");

      const content = await readProjectSettings();
      const perms = content.permissions as { allow: string[]; deny: string[] };
      expect(perms.deny).toEqual(["Bash(rm -rf *)"]);
      expect(perms.allow).toEqual([]);
    });

    it("should not duplicate existing deny rule", async () => {
      const data = {
        permissions: { allow: [], deny: ["Bash(rm *)"] },
      };
      await writeProjectSettings(data);

      const store = createPersistentPermissionStore(tempDir);
      await store.addRule({ tool: "Bash", pattern: "rm *", type: "deny" }, "project");

      const content = await readProjectSettings();
      const perms = content.permissions as { allow: string[]; deny: string[] };
      expect(perms.deny).toEqual(["Bash(rm *)"]);
    });
  });

  describe("removeRule", () => {
    it("should remove a rule from allow list", async () => {
      const data = {
        permissions: { allow: ["Bash(npm *)", "file_read"], deny: [] },
      };
      await writeProjectSettings(data);

      const store = createPersistentPermissionStore(tempDir);
      await store.removeRule("Bash", "npm *", "project");

      const content = await readProjectSettings();
      const perms = content.permissions as { allow: string[]; deny: string[] };
      expect(perms.allow).toEqual(["file_read"]);
    });

    it("should remove a rule from deny list", async () => {
      const data = {
        permissions: { allow: [], deny: ["Bash(rm -rf *)", "Bash(rm *)"] },
      };
      await writeProjectSettings(data);

      const store = createPersistentPermissionStore(tempDir);
      await store.removeRule("Bash", "rm -rf *", "project");

      const content = await readProjectSettings();
      const perms = content.permissions as { allow: string[]; deny: string[] };
      expect(perms.deny).toEqual(["Bash(rm *)"]);
    });

    it("should be safe when rule does not exist", async () => {
      const data = {
        permissions: { allow: ["Bash(npm *)"], deny: [] },
      };
      await writeProjectSettings(data);

      const store = createPersistentPermissionStore(tempDir);
      // Should not throw — removeRule returns void
      await store.removeRule("Edit", "/src/**", "project");

      const content = await readProjectSettings();
      const perms = content.permissions as { allow: string[]; deny: string[] };
      expect(perms.allow).toEqual(["Bash(npm *)"]);
    });

    it("should be safe when file does not exist", async () => {
      const store = createPersistentPermissionStore(tempDir);
      // Should not throw — removeRule handles missing files gracefully
      await store.removeRule("Bash", "npm *", "project");
    });
  });

  describe("getRulesForTool", () => {
    it("should return all rules for a specific tool", async () => {
      const data = {
        permissions: {
          allow: ["Bash(npm *)", "file_read"],
          deny: ["Bash(rm -rf *)"],
        },
      };
      await writeProjectSettings(data);

      const store = createPersistentPermissionStore(tempDir);
      const rules = await store.getRulesForTool("Bash");

      expect(rules).toHaveLength(2);
      expect(rules[0]).toMatchObject({ tool: "Bash", pattern: "npm *", type: "allow" });
      expect(rules[1]).toMatchObject({ tool: "Bash", pattern: "rm -rf *", type: "deny" });
    });
  });

  describe("nested directory creation", () => {
    it("should create parent directories when writing", async () => {
      // Use a fresh nested temp dir as project dir so .dhelix/ needs to be created
      const nestedProjectDir = join(tempDir, "a", "b");
      const store = createPersistentPermissionStore(nestedProjectDir);
      await store.addRule({ tool: "file_read", type: "allow" }, "project");

      const nestedSettingsPath = join(nestedProjectDir, ".dhelix", "settings.json");
      const content = JSON.parse(await readFile(nestedSettingsPath, "utf-8"));
      expect(content.permissions.allow).toEqual(["file_read"]);
    });
  });
});
