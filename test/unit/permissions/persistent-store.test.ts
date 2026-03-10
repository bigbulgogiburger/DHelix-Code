import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm, readFile, writeFile, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PersistentPermissionStore } from "../../../src/permissions/persistent-store.js";

describe("PersistentPermissionStore", () => {
  let tempDir: string;
  let settingsPath: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "dbcode-persist-test-"));
    settingsPath = join(tempDir, "settings.json");
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  describe("loadRules", () => {
    it("should return empty arrays when file does not exist", async () => {
      const store = new PersistentPermissionStore(settingsPath);
      const rules = await store.loadRules();

      expect(rules.allow).toEqual([]);
      expect(rules.deny).toEqual([]);
    });

    it("should return empty arrays for empty object", async () => {
      await writeFile(settingsPath, "{}", "utf-8");
      const store = new PersistentPermissionStore(settingsPath);
      const rules = await store.loadRules();

      expect(rules.allow).toEqual([]);
      expect(rules.deny).toEqual([]);
    });

    it("should load existing rules", async () => {
      const data = {
        permissions: {
          allow: ["Bash(npm *)", "Edit(/src/**)"],
          deny: ["Bash(rm -rf *)"],
        },
      };
      await writeFile(settingsPath, JSON.stringify(data), "utf-8");

      const store = new PersistentPermissionStore(settingsPath);
      const rules = await store.loadRules();

      expect(rules.allow).toEqual(["Bash(npm *)", "Edit(/src/**)"]);
      expect(rules.deny).toEqual(["Bash(rm -rf *)"]);
    });

    it("should return empty arrays for invalid JSON", async () => {
      await writeFile(settingsPath, "not json!!!", "utf-8");
      const store = new PersistentPermissionStore(settingsPath);
      const rules = await store.loadRules();

      expect(rules.allow).toEqual([]);
      expect(rules.deny).toEqual([]);
    });

    it("should preserve extra fields in settings when loading", async () => {
      const data = {
        permissions: { allow: ["Bash(npm *)"], deny: [] },
        llm: { model: "gpt-4" },
        customField: true,
      };
      await writeFile(settingsPath, JSON.stringify(data), "utf-8");

      const store = new PersistentPermissionStore(settingsPath);
      const rules = await store.loadRules();

      expect(rules.allow).toEqual(["Bash(npm *)"]);
    });

    it("should return immutable arrays", async () => {
      const data = {
        permissions: { allow: ["Bash(npm *)"], deny: ["Bash(rm *)"] },
      };
      await writeFile(settingsPath, JSON.stringify(data), "utf-8");

      const store = new PersistentPermissionStore(settingsPath);
      const rules = await store.loadRules();

      expect(Object.isFrozen(rules.allow)).toBe(true);
      expect(Object.isFrozen(rules.deny)).toBe(true);
    });
  });

  describe("addAllowRule", () => {
    it("should create settings file with allow rule if not exists", async () => {
      const store = new PersistentPermissionStore(settingsPath);
      await store.addAllowRule("Bash(npm *)");

      const content = JSON.parse(await readFile(settingsPath, "utf-8"));
      expect(content.permissions.allow).toEqual(["Bash(npm *)"]);
      expect(content.permissions.deny).toEqual([]);
    });

    it("should append to existing allow rules", async () => {
      const data = {
        permissions: { allow: ["Bash(npm *)"], deny: [] },
      };
      await writeFile(settingsPath, JSON.stringify(data), "utf-8");

      const store = new PersistentPermissionStore(settingsPath);
      await store.addAllowRule("Edit(/src/**)");

      const content = JSON.parse(await readFile(settingsPath, "utf-8"));
      expect(content.permissions.allow).toEqual(["Bash(npm *)", "Edit(/src/**)"]);
    });

    it("should not duplicate existing rule", async () => {
      const data = {
        permissions: { allow: ["Bash(npm *)"], deny: [] },
      };
      await writeFile(settingsPath, JSON.stringify(data), "utf-8");

      const store = new PersistentPermissionStore(settingsPath);
      await store.addAllowRule("Bash(npm *)");

      const content = JSON.parse(await readFile(settingsPath, "utf-8"));
      expect(content.permissions.allow).toEqual(["Bash(npm *)"]);
    });

    it("should preserve other settings fields", async () => {
      const data = {
        permissions: { allow: [], deny: [] },
        llm: { model: "gpt-4" },
        verbose: true,
      };
      await writeFile(settingsPath, JSON.stringify(data), "utf-8");

      const store = new PersistentPermissionStore(settingsPath);
      await store.addAllowRule("file_read");

      const content = JSON.parse(await readFile(settingsPath, "utf-8"));
      expect(content.llm.model).toBe("gpt-4");
      expect(content.verbose).toBe(true);
      expect(content.permissions.allow).toEqual(["file_read"]);
    });
  });

  describe("addDenyRule", () => {
    it("should add a deny rule", async () => {
      const store = new PersistentPermissionStore(settingsPath);
      await store.addDenyRule("Bash(rm -rf *)");

      const content = JSON.parse(await readFile(settingsPath, "utf-8"));
      expect(content.permissions.deny).toEqual(["Bash(rm -rf *)"]);
      expect(content.permissions.allow).toEqual([]);
    });

    it("should not duplicate existing deny rule", async () => {
      const data = {
        permissions: { allow: [], deny: ["Bash(rm *)"] },
      };
      await writeFile(settingsPath, JSON.stringify(data), "utf-8");

      const store = new PersistentPermissionStore(settingsPath);
      await store.addDenyRule("Bash(rm *)");

      const content = JSON.parse(await readFile(settingsPath, "utf-8"));
      expect(content.permissions.deny).toEqual(["Bash(rm *)"]);
    });
  });

  describe("removeRule", () => {
    it("should remove a rule from allow list", async () => {
      const data = {
        permissions: { allow: ["Bash(npm *)", "file_read"], deny: [] },
      };
      await writeFile(settingsPath, JSON.stringify(data), "utf-8");

      const store = new PersistentPermissionStore(settingsPath);
      const removed = await store.removeRule("Bash(npm *)");

      expect(removed).toBe(true);
      const content = JSON.parse(await readFile(settingsPath, "utf-8"));
      expect(content.permissions.allow).toEqual(["file_read"]);
    });

    it("should remove a rule from deny list", async () => {
      const data = {
        permissions: { allow: [], deny: ["Bash(rm -rf *)", "Bash(rm *)"] },
      };
      await writeFile(settingsPath, JSON.stringify(data), "utf-8");

      const store = new PersistentPermissionStore(settingsPath);
      const removed = await store.removeRule("Bash(rm -rf *)");

      expect(removed).toBe(true);
      const content = JSON.parse(await readFile(settingsPath, "utf-8"));
      expect(content.permissions.deny).toEqual(["Bash(rm *)"]);
    });

    it("should return false when rule does not exist", async () => {
      const data = {
        permissions: { allow: ["Bash(npm *)"], deny: [] },
      };
      await writeFile(settingsPath, JSON.stringify(data), "utf-8");

      const store = new PersistentPermissionStore(settingsPath);
      const removed = await store.removeRule("Edit(/src/**)");

      expect(removed).toBe(false);
    });

    it("should return false when file does not exist", async () => {
      const store = new PersistentPermissionStore(settingsPath);
      const removed = await store.removeRule("Bash(npm *)");

      expect(removed).toBe(false);
    });
  });

  describe("getAllRules", () => {
    it("should return all rules", async () => {
      const data = {
        permissions: {
          allow: ["Bash(npm *)", "file_read"],
          deny: ["Bash(rm -rf *)"],
        },
      };
      await writeFile(settingsPath, JSON.stringify(data), "utf-8");

      const store = new PersistentPermissionStore(settingsPath);
      const rules = await store.getAllRules();

      expect(rules.allow).toEqual(["Bash(npm *)", "file_read"]);
      expect(rules.deny).toEqual(["Bash(rm -rf *)"]);
    });
  });

  describe("nested directory creation", () => {
    it("should create parent directories when writing", async () => {
      const nestedPath = join(tempDir, "a", "b", "settings.json");
      const store = new PersistentPermissionStore(nestedPath);
      await store.addAllowRule("file_read");

      const content = JSON.parse(await readFile(nestedPath, "utf-8"));
      expect(content.permissions.allow).toEqual(["file_read"]);
    });
  });
});
