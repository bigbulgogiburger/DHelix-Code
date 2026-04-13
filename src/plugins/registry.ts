/**
 * 플러그인 레지스트리 — 로드된 플러그인과 등록된 훅/도구를 관리하는 중앙 저장소
 *
 * PluginRegistry는 플러그인 인스턴스의 생명주기를 추적하고,
 * 각 플러그인이 등록한 훅 핸들러와 도구 정의를 관리합니다.
 *
 * 주요 기능:
 * - 플러그인 등록/해제 (register/unregister)
 * - 훅 핸들러 등록/조회 (registerHook/getHooks)
 * - 도구 등록/조회 (registerTool/getTools)
 * - 리소스 일괄 해제 (dispose)
 */

import {
  type PluginModule,
  type PluginInstance,
  type PluginHookName,
  type PluginAPI,
  PLUGIN_HOOK_NAMES,
} from "./types.js";
import { loadPlugin, unloadPlugin } from "./loader.js";
import { getLogger } from "../utils/logger.js";

/** 플러그인별 내부 상태 — 인스턴스, 모듈, 등록된 훅/도구 */
interface PluginEntry {
  instance: PluginInstance;
  module: PluginModule;
  readonly hooks: Map<PluginHookName, readonly ((...args: readonly never[]) => unknown)[]>;
  readonly tools: Readonly<Record<string, unknown>>[];
}

/**
 * PluginRegistry — 플러그인 인스턴스와 확장 포인트(훅, 도구)의 중앙 레지스트리
 *
 * 각 플러그인은 고유 ID로 식별되며, 중복 등록 시 기존 플러그인을 먼저 해제합니다.
 * dispose()를 호출하면 모든 플러그인이 순차적으로 언로드됩니다.
 */
export class PluginRegistry {
  /** 플러그인 ID → 내부 엔트리 매핑 */
  private readonly plugins: Map<string, PluginEntry> = new Map();
  private readonly log = getLogger();

  /**
   * 플러그인을 레지스트리에 등록합니다.
   *
   * manifest.json 경로를 받아 플러그인을 로드하고, 활성화하고,
   * 레지스트리에 추가합니다. 이미 같은 ID의 플러그인이 있으면
   * 먼저 해제한 후 새로 등록합니다.
   *
   * @param manifestPath - manifest.json 파일의 절대 경로
   * @returns 등록된 플러그인 인스턴스
   */
  async register(manifestPath: string): Promise<PluginInstance> {
    const entry = this.createEmptyEntry();
    const api = this.createPluginAPI(entry);

    const { instance, module: pluginModule } = await loadPlugin(manifestPath, api);
    const pluginId = instance.manifest.id;

    // 중복 등록 시 기존 플러그인 먼저 해제
    if (this.plugins.has(pluginId)) {
      await this.unregister(pluginId);
    }

    entry.instance = instance;
    entry.module = pluginModule;
    this.plugins.set(pluginId, entry);

    this.log.info({ pluginId, status: instance.status }, `Plugin registered: ${pluginId}`);
    return instance;
  }

  /**
   * 플러그인을 레지스트리에서 해제합니다.
   *
   * deactivate()를 호출하고, 등록된 훅/도구를 모두 제거한 후,
   * 레지스트리에서 플러그인 엔트리를 삭제합니다.
   *
   * @param pluginId - 해제할 플러그인의 고유 ID
   */
  async unregister(pluginId: string): Promise<void> {
    const entry = this.plugins.get(pluginId);
    if (!entry) return;

    await unloadPlugin(entry.module, entry.instance);

    // 훅과 도구 정리
    entry.hooks.clear();
    entry.tools.length = 0;

    this.plugins.delete(pluginId);
    this.log.info({ pluginId }, `Plugin unregistered: ${pluginId}`);
  }

  /**
   * 플러그인 인스턴스를 ID로 조회합니다.
   *
   * @param pluginId - 조회할 플러그인 ID
   * @returns 플러그인 인스턴스 또는 undefined
   */
  get(pluginId: string): PluginInstance | undefined {
    return this.plugins.get(pluginId)?.instance;
  }

  /**
   * 활성 상태(active)인 플러그인 목록을 반환합니다.
   *
   * @returns 활성 플러그인 인스턴스의 읽기 전용 배열
   */
  listActive(): readonly PluginInstance[] {
    const active: PluginInstance[] = [];
    for (const entry of this.plugins.values()) {
      if (entry.instance.status === "active") {
        active.push(entry.instance);
      }
    }
    return active;
  }

  /**
   * 모든 등록된 플러그인 목록을 반환합니다.
   *
   * @returns 모든 플러그인 인스턴스의 읽기 전용 배열
   */
  listAll(): readonly PluginInstance[] {
    return [...this.plugins.values()].map((entry) => entry.instance);
  }

  /**
   * 특정 훅에 등록된 모든 핸들러를 반환합니다.
   *
   * 여러 플러그인이 같은 훅에 핸들러를 등록할 수 있으며,
   * 등록 순서대로 반환됩니다.
   *
   * @param hookName - 조회할 훅 이름
   * @returns 해당 훅에 등록된 핸들러 함수 배열
   */
  getHooks<K extends PluginHookName>(
    hookName: K,
  ): readonly ((...args: readonly never[]) => unknown)[] {
    const handlers: ((...args: readonly never[]) => unknown)[] = [];
    for (const entry of this.plugins.values()) {
      if (entry.instance.status !== "active") continue;
      const entryHooks = entry.hooks.get(hookName);
      if (entryHooks) {
        handlers.push(...entryHooks);
      }
    }
    return handlers;
  }

  /**
   * 모든 플러그인이 등록한 도구 정의를 반환합니다.
   *
   * @returns 도구 정의 배열 (읽기 전용)
   */
  getTools(): readonly Readonly<Record<string, unknown>>[] {
    const tools: Readonly<Record<string, unknown>>[] = [];
    for (const entry of this.plugins.values()) {
      if (entry.instance.status !== "active") continue;
      tools.push(...entry.tools);
    }
    return tools;
  }

  /**
   * 모든 플러그인을 언로드하고 레지스트리를 초기화합니다.
   *
   * 각 플러그인의 deactivate()를 순차적으로 호출한 후,
   * 내부 맵을 비웁니다. 에러가 발생해도 다른 플러그인의
   * 정리를 계속 진행합니다.
   */
  async dispose(): Promise<void> {
    const pluginIds = [...this.plugins.keys()];
    for (const pluginId of pluginIds) {
      try {
        await this.unregister(pluginId);
      } catch (error) {
        this.log.error(
          { pluginId, error: error instanceof Error ? error.message : String(error) },
          `Error disposing plugin: ${pluginId}`,
        );
      }
    }
  }

  /**
   * 빈 플러그인 엔트리를 생성합니다 (로드 전 API 바인딩용).
   */
  private createEmptyEntry(): PluginEntry {
    // 임시 no-op 모듈 — loadPlugin 완료 후 실제 모듈로 교체됨
    const noopModule: PluginModule = {
      activate: () => {},
    };
    return {
      instance: {
        manifest: { id: "", version: "", description: "", main: "" },
        status: "loaded",
        loadedAt: 0,
      },
      module: noopModule,
      hooks: new Map(),
      tools: [],
    };
  }

  /**
   * 플러그인에 제공할 API를 생성합니다.
   *
   * API는 특정 PluginEntry에 바인딩되어,
   * 플러그인이 등록한 훅/도구가 해당 엔트리에 저장됩니다.
   *
   * @param entry - API를 바인딩할 플러그인 엔트리
   * @returns 플러그인 API 인터페이스
   */
  private createPluginAPI(entry: PluginEntry): PluginAPI {
    return {
      registerHook: <K extends PluginHookName>(
        hookName: K,
        handler: NonNullable<import("./types.js").PluginHooks[K]>,
      ) => {
        if (!PLUGIN_HOOK_NAMES.includes(hookName)) {
          this.log.warn({ hookName }, `Unknown plugin hook name: ${String(hookName)}`);
          return;
        }
        const existing = entry.hooks.get(hookName) ?? [];
        entry.hooks.set(hookName, [...existing, handler as (...args: readonly never[]) => unknown]);
      },
      registerTool: (definition: Readonly<Record<string, unknown>>) => {
        entry.tools.push(definition);
      },
      getConfig: () => ({}),
      log: (level: "info" | "warn" | "error", message: string) => {
        const pluginId = entry.instance.manifest.id || "unknown";
        this.log[level]({ pluginId }, `[plugin:${pluginId}] ${message}`);
      },
    };
  }
}
