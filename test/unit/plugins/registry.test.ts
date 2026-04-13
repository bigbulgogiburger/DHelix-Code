import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { writeFile, mkdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { PluginRegistry } from "../../../src/plugins/registry.js";

const testDir = join(tmpdir(), "dhelix-registry-test-" + Date.now());

beforeAll(async () => {
  await mkdir(testDir, { recursive: true });
});

afterAll(async () => {
  await rm(testDir, { recursive: true, force: true });
});

/**
 * 테스트용 플러그인 디렉토리를 생성합니다.
 *
 * @param name - 플러그인 이름 (디렉토리명으로도 사용)
 * @param moduleCode - 플러그인 모듈 소스코드
 * @returns manifest.json 절대 경로
 */
async function createTestPlugin(name: string, moduleCode: string): Promise<string> {
  const pluginDir = join(testDir, name);
  await mkdir(pluginDir, { recursive: true });

  await writeFile(
    join(pluginDir, "manifest.json"),
    JSON.stringify({
      id: name,
      version: "1.0.0",
      description: `Test plugin: ${name}`,
      main: "./plugin.mjs",
    }),
  );

  await writeFile(join(pluginDir, "plugin.mjs"), moduleCode);
  return join(pluginDir, "manifest.json");
}

// ---------------------------------------------------------------------------
// PluginRegistry — register / unregister
// ---------------------------------------------------------------------------

describe("PluginRegistry", () => {
  let registry: PluginRegistry;

  beforeEach(async () => {
    registry = new PluginRegistry();
  });

  describe("register", () => {
    it("should register a plugin and return active instance", async () => {
      const manifestPath = await createTestPlugin(
        "reg-basic-" + Date.now(),
        `export function activate(api) { api.log("info", "hi"); }`,
      );

      const instance = await registry.register(manifestPath);
      expect(instance.status).toBe("active");
      expect(instance.manifest.version).toBe("1.0.0");
    });

    it("should replace existing plugin with same id", async () => {
      const pluginName = "reg-replace-" + Date.now();
      const manifestPath = await createTestPlugin(
        pluginName,
        `export function activate(api) { api.registerHook("onSystemPrompt", (p) => p + " v1"); }`,
      );

      await registry.register(manifestPath);
      expect(registry.listAll()).toHaveLength(1);

      // Re-register should replace
      await registry.register(manifestPath);
      expect(registry.listAll()).toHaveLength(1);
    });
  });

  describe("unregister", () => {
    it("should unregister a registered plugin", async () => {
      const pluginName = "unreg-" + Date.now();
      const manifestPath = await createTestPlugin(pluginName, `export function activate() {}`);

      const instance = await registry.register(manifestPath);
      expect(registry.get(instance.manifest.id)).toBeDefined();

      await registry.unregister(instance.manifest.id);
      expect(registry.get(instance.manifest.id)).toBeUndefined();
    });

    it("should no-op for unknown plugin id", async () => {
      // Should not throw
      await registry.unregister("nonexistent-plugin");
    });
  });

  describe("get", () => {
    it("should return instance for registered plugin", async () => {
      const pluginName = "get-" + Date.now();
      const manifestPath = await createTestPlugin(pluginName, `export function activate() {}`);

      await registry.register(manifestPath);
      const instance = registry.get(pluginName);
      expect(instance).toBeDefined();
      expect(instance!.manifest.id).toBe(pluginName);
    });

    it("should return undefined for unregistered plugin", () => {
      expect(registry.get("does-not-exist")).toBeUndefined();
    });
  });

  describe("listActive", () => {
    it("should return only active plugins", async () => {
      const name1 = "active-a-" + Date.now();
      const name2 = "active-b-" + Date.now();
      const path1 = await createTestPlugin(name1, `export function activate() {}`);
      const path2 = await createTestPlugin(name2, `export function activate() {}`);

      await registry.register(path1);
      await registry.register(path2);

      const active = registry.listActive();
      expect(active).toHaveLength(2);
      expect(active.every((p) => p.status === "active")).toBe(true);
    });

    it("should exclude error-status plugins from active list", async () => {
      const name = "error-status-" + Date.now();
      const manifestPath = await createTestPlugin(
        name,
        `export function activate() { throw new Error("fail"); }`,
      );

      await registry.register(manifestPath);
      expect(registry.listActive()).toHaveLength(0);
      expect(registry.listAll()).toHaveLength(1);
    });
  });

  describe("getHooks", () => {
    it("should return hooks registered by active plugins", async () => {
      const name = "hooks-" + Date.now();
      const manifestPath = await createTestPlugin(
        name,
        `export function activate(api) {
          api.registerHook("onSystemPrompt", (prompt) => prompt + " modified");
          api.registerHook("onBeforeToolCall", (name, args) => args);
        }`,
      );

      await registry.register(manifestPath);

      const promptHooks = registry.getHooks("onSystemPrompt");
      expect(promptHooks).toHaveLength(1);

      const toolHooks = registry.getHooks("onBeforeToolCall");
      expect(toolHooks).toHaveLength(1);

      const emptyHooks = registry.getHooks("onAfterToolCall");
      expect(emptyHooks).toHaveLength(0);
    });

    it("should aggregate hooks from multiple plugins", async () => {
      const name1 = "multi-hook-a-" + Date.now();
      const name2 = "multi-hook-b-" + Date.now();

      const path1 = await createTestPlugin(
        name1,
        `export function activate(api) {
          api.registerHook("onSystemPrompt", (p) => p + " a");
        }`,
      );
      const path2 = await createTestPlugin(
        name2,
        `export function activate(api) {
          api.registerHook("onSystemPrompt", (p) => p + " b");
        }`,
      );

      await registry.register(path1);
      await registry.register(path2);

      const hooks = registry.getHooks("onSystemPrompt");
      expect(hooks).toHaveLength(2);
    });

    it("should not return hooks from error-status plugins", async () => {
      const name = "error-hooks-" + Date.now();
      const manifestPath = await createTestPlugin(
        name,
        `export function activate(api) {
          api.registerHook("onSystemPrompt", (p) => p);
          throw new Error("fail after registering");
        }`,
      );

      await registry.register(manifestPath);
      // Plugin is in error status, hooks should not be returned
      const hooks = registry.getHooks("onSystemPrompt");
      expect(hooks).toHaveLength(0);
    });
  });

  describe("getTools", () => {
    it("should return tools registered by active plugins", async () => {
      const name = "tools-" + Date.now();
      const manifestPath = await createTestPlugin(
        name,
        `export function activate(api) {
          api.registerTool({ name: "custom_tool", description: "A custom tool" });
        }`,
      );

      await registry.register(manifestPath);
      const tools = registry.getTools();
      expect(tools).toHaveLength(1);
      expect(tools[0]).toEqual({ name: "custom_tool", description: "A custom tool" });
    });
  });

  describe("dispose", () => {
    it("should unregister all plugins", async () => {
      const name1 = "dispose-a-" + Date.now();
      const name2 = "dispose-b-" + Date.now();

      const path1 = await createTestPlugin(name1, `export function activate() {}`);
      const path2 = await createTestPlugin(name2, `export function activate() {}`);

      await registry.register(path1);
      await registry.register(path2);
      expect(registry.listAll()).toHaveLength(2);

      await registry.dispose();
      expect(registry.listAll()).toHaveLength(0);
    });

    it("should handle errors during dispose gracefully", async () => {
      const name = "dispose-error-" + Date.now();
      const manifestPath = await createTestPlugin(
        name,
        `export function activate() {}
         export function deactivate() { throw new Error("cleanup fail"); }`,
      );

      await registry.register(manifestPath);

      // Should not throw
      await registry.dispose();
      expect(registry.listAll()).toHaveLength(0);
    });
  });
});
