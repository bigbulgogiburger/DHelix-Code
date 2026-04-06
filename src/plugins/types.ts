/**
 * 플러그인 시스템 타입 정의 -- 플러그인의 매니페스트, 인스턴스, 훅, API를 정의
 *
 * 플러그인은 DHelix의 기능을 확장하는 독립적인 모듈입니다.
 * 각 플러그인은 manifest.json으로 메타데이터를 선언하고,
 * main 엔트리포인트에서 activate/deactivate 함수를 제공합니다.
 *
 * 플러그인 라이프사이클:
 * 1. manifest.json 로드 및 검증
 * 2. main 모듈 동적 import
 * 3. activate(api) 호출 → 훅/도구 등록
 * 4. unload 시 deactivate() 호출 → 등록 해제
 */

import { z } from "zod";
import { type TrustTier } from "../permissions/trust-tiers.js";

/**
 * 플러그인 상태 — 플러그인 인스턴스의 현재 라이프사이클 상태
 *
 * - "loaded": manifest 파싱 완료, 아직 activate 미호출
 * - "active": activate() 성공, 훅/도구 등록 완료
 * - "error": activate() 또는 실행 중 에러 발생
 * - "unloaded": deactivate() 호출 완료, 리소스 해제됨
 */
export type PluginStatus = "loaded" | "active" | "error" | "unloaded";

/**
 * 플러그인 매니페스트 Zod 스키마 — manifest.json의 유효성 검증
 */
export const pluginManifestSchema = z.object({
  /** 플러그인 고유 식별자 (예: "my-plugin") */
  id: z.string().min(1),
  /** 플러그인 버전 — semver 형식 (예: "1.0.0") */
  version: z.string().min(1),
  /** 플러그인 설명 */
  description: z.string().min(1),
  /** 플러그인 작성자 (선택) */
  author: z.string().optional(),
  /** 엔트리포인트 — manifest.json 기준 상대 경로 (예: "./index.js") */
  main: z.string().min(1),
  /** 플러그인이 요청하는 권한 목록 (선택) */
  permissions: z.array(z.string()).optional(),
  /** 플러그인 신뢰 등급 (선택, 기본값은 로더에서 결정) */
  trustTier: z
    .enum(["T0", "T1", "T2", "T3"])
    .optional()
    .transform((val) => val as TrustTier | undefined),
});

/**
 * 플러그인 매니페스트 — manifest.json에서 파싱된 플러그인 메타데이터
 */
export interface PluginManifest {
  readonly id: string;
  readonly version: string;
  readonly description: string;
  readonly author?: string;
  readonly main: string;
  readonly permissions?: readonly string[];
  readonly trustTier?: TrustTier;
}

/**
 * 플러그인 인스턴스 — 로드된 플러그인의 런타임 상태
 */
export interface PluginInstance {
  readonly manifest: PluginManifest;
  readonly status: PluginStatus;
  readonly loadedAt: number;
  readonly error?: string;
}

/**
 * 플러그인 훅 — 플러그인이 등록할 수 있는 라이프사이클 훅
 *
 * 각 훅은 에이전트 실행 파이프라인의 특정 시점에 개입하여
 * 데이터를 변환하거나 관찰할 수 있습니다.
 */
export interface PluginHooks {
  /** 시스템 프롬프트 변환 — LLM에 전달되기 전에 프롬프트를 수정 */
  readonly onSystemPrompt?: (prompt: string) => string;
  /** 도구 호출 전 — 도구 인수를 검사하거나 변환 */
  readonly onBeforeToolCall?: (toolName: string, args: unknown) => unknown;
  /** 도구 호출 후 — 도구 결과를 검사하거나 변환 */
  readonly onAfterToolCall?: (toolName: string, result: unknown) => unknown;
  /** 채팅 파라미터 변환 — LLM API 호출 파라미터를 수정 */
  readonly onChatParams?: (params: unknown) => unknown;
}

/** 플러그인 훅 이름 유니온 타입 */
export type PluginHookName = keyof PluginHooks;

/** 유효한 플러그인 훅 이름 배열 — 런타임 검증에 사용 */
export const PLUGIN_HOOK_NAMES: readonly PluginHookName[] = [
  "onSystemPrompt",
  "onBeforeToolCall",
  "onAfterToolCall",
  "onChatParams",
] as const;

/**
 * 플러그인 API — 플러그인의 activate() 함수에 전달되는 확장 인터페이스
 *
 * 플러그인은 이 API를 통해 훅을 등록하고, 도구를 추가하고,
 * 설정을 읽고, 로그를 기록할 수 있습니다.
 */
export interface PluginAPI {
  /** 훅 등록 — 특정 라이프사이클 시점에 핸들러를 추가 */
  readonly registerHook: <K extends PluginHookName>(
    hookName: K,
    handler: NonNullable<PluginHooks[K]>,
  ) => void;
  /** 도구 등록 — 플러그인이 제공하는 커스텀 도구를 에이전트에 추가 */
  readonly registerTool: (definition: Readonly<Record<string, unknown>>) => void;
  /** 플러그인 설정 조회 — 플러그인별 사용자 설정을 반환 */
  readonly getConfig: () => Readonly<Record<string, unknown>>;
  /** 로그 기록 — 플러그인 전용 로거 (플러그인 ID가 자동 접두사) */
  readonly log: (level: "info" | "warn" | "error", message: string) => void;
}

/**
 * 플러그인 모듈 인터페이스 — 플러그인의 main 엔트리포인트가 제공해야 하는 함수
 *
 * activate()는 플러그인 로드 시 호출되며, PluginAPI를 통해 훅/도구를 등록합니다.
 * deactivate()는 플러그인 언로드 시 호출되며, 리소스를 정리합니다 (선택적).
 */
export interface PluginModule {
  readonly activate: (api: PluginAPI) => void | Promise<void>;
  readonly deactivate?: () => void | Promise<void>;
}
