/**
 * 플러그인 시스템 배럴 익스포트 — 플러그인 관련 모든 공개 API를 재내보냄
 */

export {
  type PluginManifest,
  type PluginInstance,
  type PluginStatus,
  type PluginHooks,
  type PluginHookName,
  type PluginAPI,
  type PluginModule,
  pluginManifestSchema,
  PLUGIN_HOOK_NAMES,
} from "./types.js";

export { loadPlugin, unloadPlugin, validateManifest, PluginLoadError } from "./loader.js";

export { PluginRegistry } from "./registry.js";
