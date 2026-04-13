import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { writeFile, mkdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  validateManifest,
  loadPlugin,
  unloadPlugin,
  PluginLoadError,
} from "../../../src/plugins/loader.js";
import {
  type PluginAPI,
  type PluginInstance,
  type PluginModule,
} from "../../../src/plugins/types.js";

const testDir = join(tmpdir(), "dhelix-plugin-test-" + Date.now());

beforeAll(async () => {
  await mkdir(testDir, { recursive: true });
});

afterAll(async () => {
  await rm(testDir, { recursive: true, force: true });
});

// ---------------------------------------------------------------------------
// validateManifest
// ---------------------------------------------------------------------------

describe("validateManifest", () => {
  it("should validate a correct manifest", () => {
    const manifest = validateManifest({
      id: "test-plugin",
      version: "1.0.0",
      description: "A test plugin",
      main: "./index.js",
    });

    expect(manifest.id).toBe("test-plugin");
    expect(manifest.version).toBe("1.0.0");
    expect(manifest.description).toBe("A test plugin");
    expect(manifest.main).toBe("./index.js");
  });

  it("should validate a manifest with optional fields", () => {
    const manifest = validateManifest({
      id: "full-plugin",
      version: "2.0.0",
      description: "Full plugin",
      author: "Test Author",
      main: "./dist/index.js",
      permissions: ["file_read", "bash_exec"],
      trustTier: "T2",
    });

    expect(manifest.author).toBe("Test Author");
    expect(manifest.permissions).toEqual(["file_read", "bash_exec"]);
    expect(manifest.trustTier).toBe("T2");
  });

  it("should throw PluginLoadError for missing id", () => {
    expect(() =>
      validateManifest({
        version: "1.0.0",
        description: "No id",
        main: "./index.js",
      }),
    ).toThrow(PluginLoadError);
  });

  it("should throw PluginLoadError for missing version", () => {
    expect(() =>
      validateManifest({
        id: "test",
        description: "No version",
        main: "./index.js",
      }),
    ).toThrow(PluginLoadError);
  });

  it("should throw PluginLoadError for missing description", () => {
    expect(() =>
      validateManifest({
        id: "test",
        version: "1.0.0",
        main: "./index.js",
      }),
    ).toThrow(PluginLoadError);
  });

  it("should throw PluginLoadError for missing main", () => {
    expect(() =>
      validateManifest({
        id: "test",
        version: "1.0.0",
        description: "No main",
      }),
    ).toThrow(PluginLoadError);
  });

  it("should throw PluginLoadError for empty id", () => {
    expect(() =>
      validateManifest({
        id: "",
        version: "1.0.0",
        description: "Empty id",
        main: "./index.js",
      }),
    ).toThrow(PluginLoadError);
  });

  it("should throw PluginLoadError for non-object input", () => {
    expect(() => validateManifest("not an object")).toThrow(PluginLoadError);
    expect(() => validateManifest(null)).toThrow(PluginLoadError);
    expect(() => validateManifest(42)).toThrow(PluginLoadError);
  });
});

// ---------------------------------------------------------------------------
// loadPlugin
// ---------------------------------------------------------------------------

describe("loadPlugin", () => {
  /**
   * 테스트용 PluginAPI 생성 — 훅/도구 등록을 추적
   */
  function createTestAPI(): PluginAPI & {
    readonly registeredHooks: Array<{ hookName: string; handler: unknown }>;
    readonly registeredTools: unknown[];
    readonly logs: Array<{ level: string; message: string }>;
  } {
    const registeredHooks: Array<{ hookName: string; handler: unknown }> = [];
    const registeredTools: unknown[] = [];
    const logs: Array<{ level: string; message: string }> = [];

    return {
      registeredHooks,
      registeredTools,
      logs,
      registerHook: (hookName, handler) => {
        registeredHooks.push({ hookName, handler });
      },
      registerTool: (definition) => {
        registeredTools.push(definition);
      },
      getConfig: () => ({}),
      log: (level, message) => {
        logs.push({ level, message });
      },
    };
  }

  it("should load and activate a valid plugin", async () => {
    // 플러그인 디렉토리 생성
    const pluginDir = join(testDir, "valid-plugin");
    await mkdir(pluginDir, { recursive: true });

    // manifest.json 작성
    await writeFile(
      join(pluginDir, "manifest.json"),
      JSON.stringify({
        id: "valid-plugin",
        version: "1.0.0",
        description: "A valid test plugin",
        main: "./plugin.mjs",
      }),
    );

    // 플러그인 모듈 작성
    await writeFile(
      join(pluginDir, "plugin.mjs"),
      `export function activate(api) {
        api.registerHook("onSystemPrompt", (prompt) => prompt + " [modified]");
        api.log("info", "Plugin activated");
      }
      export function deactivate() {}`,
    );

    const api = createTestAPI();
    const { instance } = await loadPlugin(join(pluginDir, "manifest.json"), api);

    expect(instance.status).toBe("active");
    expect(instance.manifest.id).toBe("valid-plugin");
    expect(instance.loadedAt).toBeGreaterThan(0);
    expect(api.registeredHooks).toHaveLength(1);
    expect(api.registeredHooks[0]!.hookName).toBe("onSystemPrompt");
    expect(api.logs).toHaveLength(1);
  });

  it("should return error instance when activate throws", async () => {
    const pluginDir = join(testDir, "error-plugin");
    await mkdir(pluginDir, { recursive: true });

    await writeFile(
      join(pluginDir, "manifest.json"),
      JSON.stringify({
        id: "error-plugin",
        version: "1.0.0",
        description: "Plugin that fails on activate",
        main: "./plugin.mjs",
      }),
    );

    await writeFile(
      join(pluginDir, "plugin.mjs"),
      `export function activate() { throw new Error("Activation boom"); }`,
    );

    const api = createTestAPI();
    const { instance } = await loadPlugin(join(pluginDir, "manifest.json"), api);

    expect(instance.status).toBe("error");
    expect(instance.error).toContain("Activation boom");
  });

  it("should throw PluginLoadError for non-existent manifest", async () => {
    const api = createTestAPI();
    await expect(loadPlugin(join(testDir, "nonexistent", "manifest.json"), api)).rejects.toThrow(
      PluginLoadError,
    );
  });

  it("should throw PluginLoadError for invalid JSON manifest", async () => {
    const pluginDir = join(testDir, "invalid-json-plugin");
    await mkdir(pluginDir, { recursive: true });

    await writeFile(join(pluginDir, "manifest.json"), "not valid json {{{");

    const api = createTestAPI();
    await expect(loadPlugin(join(pluginDir, "manifest.json"), api)).rejects.toThrow(
      PluginLoadError,
    );
  });

  it("should throw PluginLoadError when module has no activate function", async () => {
    const pluginDir = join(testDir, "no-activate-plugin");
    await mkdir(pluginDir, { recursive: true });

    await writeFile(
      join(pluginDir, "manifest.json"),
      JSON.stringify({
        id: "no-activate",
        version: "1.0.0",
        description: "Missing activate",
        main: "./plugin.mjs",
      }),
    );

    await writeFile(
      join(pluginDir, "plugin.mjs"),
      `export const name = "no activate function here";`,
    );

    const api = createTestAPI();
    await expect(loadPlugin(join(pluginDir, "manifest.json"), api)).rejects.toThrow(
      "does not export an activate function",
    );
  });
});

// ---------------------------------------------------------------------------
// unloadPlugin
// ---------------------------------------------------------------------------

describe("unloadPlugin", () => {
  it("should call deactivate and return unloaded instance", async () => {
    let deactivated = false;
    const pluginModule: PluginModule = {
      activate: () => {},
      deactivate: () => {
        deactivated = true;
      },
    };
    const instance: PluginInstance = {
      manifest: { id: "test", version: "1.0.0", description: "test", main: "./index.js" },
      status: "active",
      loadedAt: Date.now(),
    };

    const result = await unloadPlugin(pluginModule, instance);
    expect(result.status).toBe("unloaded");
    expect(deactivated).toBe(true);
  });

  it("should handle missing deactivate gracefully", async () => {
    const pluginModule: PluginModule = {
      activate: () => {},
    };
    const instance: PluginInstance = {
      manifest: { id: "test", version: "1.0.0", description: "test", main: "./index.js" },
      status: "active",
      loadedAt: Date.now(),
    };

    const result = await unloadPlugin(pluginModule, instance);
    expect(result.status).toBe("unloaded");
  });

  it("should handle deactivate error gracefully", async () => {
    const pluginModule: PluginModule = {
      activate: () => {},
      deactivate: () => {
        throw new Error("Deactivation failed");
      },
    };
    const instance: PluginInstance = {
      manifest: { id: "test", version: "1.0.0", description: "test", main: "./index.js" },
      status: "active",
      loadedAt: Date.now(),
    };

    // Should not throw
    const result = await unloadPlugin(pluginModule, instance);
    expect(result.status).toBe("unloaded");
  });
});
