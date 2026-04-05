/**
 * 플러그인 로더 — manifest.json 파싱, 모듈 동적 로딩, 플러그인 활성화/비활성화
 *
 * 로딩 프로세스:
 * 1. manifest.json 파일 읽기 및 JSON 파싱
 * 2. Zod 스키마로 매니페스트 검증
 * 3. main 엔트리포인트 모듈 동적 import
 * 4. activate(api) 호출로 플러그인 활성화
 *
 * 언로딩 프로세스:
 * 1. deactivate() 호출 (존재하는 경우)
 * 2. 등록된 훅/도구 자동 제거 (레지스트리에서 처리)
 */

import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { BaseError } from "../utils/error.js";
import {
  pluginManifestSchema,
  type PluginManifest,
  type PluginInstance,
  type PluginModule,
  type PluginAPI,
} from "./types.js";

/**
 * 플러그인 로딩 에러 — manifest 파싱 실패, 모듈 로드 실패, activate 실패 시 발생
 */
export class PluginLoadError extends BaseError {
  constructor(message: string, context: Record<string, unknown> = {}) {
    super(message, "PLUGIN_LOAD_ERROR", context);
  }
}

/**
 * manifest.json 데이터를 검증하여 PluginManifest 객체를 반환
 *
 * Zod 스키마를 사용하여 필수 필드, 타입, 값 범위를 검증합니다.
 * 검증 실패 시 PluginLoadError를 던집니다.
 *
 * @param data - JSON.parse()로 파싱된 원시 데이터
 * @returns 검증된 PluginManifest
 * @throws PluginLoadError - 스키마 검증 실패 시
 */
export function validateManifest(data: unknown): PluginManifest {
  const result = pluginManifestSchema.safeParse(data);
  if (!result.success) {
    const issues = result.error.issues
      .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
      .join(", ");
    throw new PluginLoadError(`Invalid plugin manifest: ${issues}`, {
      validationErrors: result.error.issues,
    });
  }

  const parsed = result.data;
  return {
    id: parsed.id,
    version: parsed.version,
    description: parsed.description,
    author: parsed.author,
    main: parsed.main,
    permissions: parsed.permissions,
    trustTier: parsed.trustTier,
  };
}

/**
 * manifest.json 파일을 읽고 검증된 PluginManifest를 반환
 *
 * @param manifestPath - manifest.json 파일의 절대 경로
 * @returns 검증된 매니페스트
 * @throws PluginLoadError - 파일 읽기 실패, JSON 파싱 실패, 스키마 검증 실패 시
 */
async function readManifest(manifestPath: string): Promise<PluginManifest> {
  try {
    const content = await readFile(manifestPath, "utf-8");
    const data: unknown = JSON.parse(content);
    return validateManifest(data);
  } catch (error) {
    if (error instanceof PluginLoadError) throw error;
    throw new PluginLoadError(`Failed to read plugin manifest: ${manifestPath}`, {
      path: manifestPath,
      cause: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * 플러그인 모듈을 동적으로 import
 *
 * manifest의 main 필드를 manifest.json 기준 상대 경로로 해석하여
 * ESM 동적 import를 수행합니다.
 *
 * @param manifest - 검증된 매니페스트
 * @param manifestPath - manifest.json 파일의 절대 경로
 * @returns 플러그인 모듈 (activate/deactivate 함수 포함)
 * @throws PluginLoadError - import 실패 또는 activate 함수 없음
 */
async function importPluginModule(
  manifest: PluginManifest,
  manifestPath: string,
): Promise<PluginModule> {
  const manifestDir = dirname(manifestPath);
  const modulePath = resolve(manifestDir, manifest.main);
  const moduleUrl = pathToFileURL(modulePath).href;

  try {
    const mod = (await import(moduleUrl)) as Record<string, unknown>;
    const activate = mod["activate"];

    if (typeof activate !== "function") {
      throw new PluginLoadError(
        `Plugin "${manifest.id}" module does not export an activate function`,
        { pluginId: manifest.id, modulePath },
      );
    }

    return {
      activate: activate as PluginModule["activate"],
      deactivate:
        typeof mod["deactivate"] === "function"
          ? (mod["deactivate"] as NonNullable<PluginModule["deactivate"]>)
          : undefined,
    };
  } catch (error) {
    if (error instanceof PluginLoadError) throw error;
    throw new PluginLoadError(`Failed to import plugin module: ${manifest.id}`, {
      pluginId: manifest.id,
      modulePath,
      cause: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * 플러그인을 로드하고 활성화합니다.
 *
 * manifest.json 파일을 읽고, main 모듈을 import한 후,
 * activate(api) 함수를 호출하여 플러그인을 활성화합니다.
 *
 * @param manifestPath - manifest.json 파일의 절대 경로
 * @param api - 플러그인에 제공할 API 인터페이스
 * @returns 활성화된 플러그인 인스턴스와 모듈
 * @throws PluginLoadError - 로딩 또는 활성화 실패 시
 */
export async function loadPlugin(
  manifestPath: string,
  api: PluginAPI,
): Promise<{ readonly instance: PluginInstance; readonly module: PluginModule }> {
  const manifest = await readManifest(manifestPath);
  const pluginModule = await importPluginModule(manifest, manifestPath);

  try {
    await pluginModule.activate(api);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      instance: {
        manifest,
        status: "error",
        loadedAt: Date.now(),
        error: `Activation failed: ${errorMessage}`,
      },
      module: pluginModule,
    };
  }

  return {
    instance: {
      manifest,
      status: "active",
      loadedAt: Date.now(),
    },
    module: pluginModule,
  };
}

/**
 * 플러그인을 비활성화합니다.
 *
 * deactivate() 함수가 존재하면 호출하고, 에러가 발생해도
 * 인스턴스 상태를 "unloaded"로 전환합니다.
 *
 * @param pluginModule - 언로드할 플러그인의 모듈
 * @param instance - 현재 플러그인 인스턴스
 * @returns 상태가 "unloaded"로 전환된 새 인스턴스
 */
export async function unloadPlugin(
  pluginModule: PluginModule,
  instance: PluginInstance,
): Promise<PluginInstance> {
  try {
    if (pluginModule.deactivate) {
      await pluginModule.deactivate();
    }
  } catch {
    // deactivate 실패는 무시 — 리소스 정리는 best-effort
  }

  return {
    manifest: instance.manifest,
    status: "unloaded",
    loadedAt: instance.loadedAt,
  };
}
