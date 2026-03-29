/**
 * 훅 설정 로더 — settings.json에서 훅 설정을 읽고 검증(validation)하는 모듈
 *
 * .dhelix/settings.json 파일의 "hooks" 키에서 훅 설정을 로드하고,
 * Zod 스키마를 사용하여 설정 값의 유효성을 엄격하게 검증합니다.
 *
 * 검증 항목:
 * - 이벤트 이름이 유효한 HookEvent인지 확인
 * - 각 핸들러의 type, command/url/prompt 등 필수 필드 확인
 * - 핸들러 타입별 discriminatedUnion(구분된 합집합)으로 타입 안전성 보장
 *
 * @example
 * const config = await loadHookConfig("/path/to/.dhelix");
 * // config: { PostToolUse: [{ matcher: "file_edit", hooks: [...] }] }
 *
 * @example
 * // 잘못된 이벤트 이름이 있으면 HookLoadError 발생
 * parseHookConfig({ "InvalidEvent": [...] }); // → HookLoadError
 */

import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { z } from "zod";
import { BaseError } from "../utils/error.js";
import { type HookConfig, type HookEvent, HOOK_EVENTS } from "./types.js";

/**
 * 훅 설정 로딩 에러.
 * 설정 파일 파싱 실패, 유효하지 않은 이벤트 이름 등의 경우에 발생합니다.
 */
export class HookLoadError extends BaseError {
  constructor(message: string, context: Record<string, unknown> = {}) {
    super(message, "HOOK_LOAD_ERROR", context);
  }
}

/**
 * Zod 스키마: 훅 핸들러 유효성 검사.
 *
 * discriminatedUnion: "type" 필드의 값에 따라 서로 다른 스키마를 적용합니다.
 * - type: "command" → command 필드 필수
 * - type: "http" → url 필드 필수
 * - type: "prompt" → prompt + promptMessage 필드 필수
 * - type: "agent" → prompt + validator + description 필드 필수
 */
const hookHandlerSchema = z.discriminatedUnion("type", [
  // command 핸들러: 셸 명령어 실행
  z.object({
    type: z.literal("command"),
    command: z.string().min(1),
    timeoutMs: z.number().positive().optional(),
    blocking: z.boolean().optional(),
  }),
  // http 핸들러: URL로 POST 요청
  z.object({
    type: z.literal("http"),
    url: z.string().url(),
    headers: z.record(z.string()).optional(),
    timeoutMs: z.number().positive().optional(),
    blocking: z.boolean().optional(),
  }),
  // prompt 핸들러: 사용자 확인 프롬프트
  z.object({
    type: z.literal("prompt"),
    prompt: z.string().min(1),
    promptMessage: z.string().min(1),
    timeout: z.number().positive().optional(),
    model: z.string().optional(),
    timeoutMs: z.number().positive().optional(),
    blocking: z.boolean().optional(),
  }),
  // agent 핸들러: 선언적 유효성 검사
  z.object({
    type: z.literal("agent"),
    prompt: z.string().min(1),
    validator: z.string().min(1),
    description: z.string().min(1),
    allowedTools: z.array(z.string()).optional(),
    model: z.string().optional(),
    timeoutMs: z.number().positive().optional(),
    blocking: z.boolean().optional(),
  }),
]);

/** Zod 스키마: 훅 규칙 — matcher(선택) + hooks 배열(최소 1개) */
const hookRuleSchema = z.object({
  matcher: z.string().optional(),
  hooks: z.array(hookHandlerSchema).min(1),
});

/** Zod 스키마: 전체 훅 설정 — 이벤트 이름(문자열)을 키로, 규칙 배열을 값으로 */
const hookConfigSchema = z.record(z.string(), z.array(hookRuleSchema));

/**
 * 원시(raw) 훅 설정의 모든 키가 유효한 HookEvent 이름인지 검증합니다.
 * 유효하지 않은 이벤트 이름이 있으면 HookLoadError를 던집니다.
 *
 * @param raw - 검증할 원시 설정 객체
 * @throws HookLoadError - 유효하지 않은 이벤트 이름 발견 시
 */
function validateEventNames(raw: Record<string, unknown>): void {
  const validEvents = new Set<string>(HOOK_EVENTS);
  for (const key of Object.keys(raw)) {
    if (!validEvents.has(key)) {
      throw new HookLoadError(`Unknown hook event: "${key}"`, {
        validEvents: [...validEvents],
      });
    }
  }
}

/**
 * 원시 훅 설정 객체를 파싱하고 검증하여 타입 안전한 HookConfig를 반환합니다.
 *
 * @param raw - 파싱할 원시 설정 값 (JSON 파싱 결과)
 * @returns 검증된 HookConfig 객체
 * @throws HookLoadError - 유효하지 않은 설정 시
 *
 * @example
 * const config = parseHookConfig({
 *   PostToolUse: [{ matcher: "file_edit", hooks: [{ type: "command", command: "eslint ." }] }]
 * });
 */
export function parseHookConfig(raw: unknown): HookConfig {
  // null/undefined는 빈 설정으로 처리
  if (raw === null || raw === undefined) return {};
  // 객체가 아니거나 배열이면 에러
  if (typeof raw !== "object" || Array.isArray(raw)) {
    throw new HookLoadError("Hook config must be an object");
  }

  // 1단계: 이벤트 이름 유효성 검증
  validateEventNames(raw as Record<string, unknown>);
  // 2단계: Zod 스키마로 구조 및 값 검증
  const parsed = hookConfigSchema.parse(raw);

  // 3단계: 검증된 키를 HookEvent 타입으로 캐스팅
  const config: Partial<Record<HookEvent, (typeof parsed)[string]>> = {};
  for (const [key, rules] of Object.entries(parsed)) {
    config[key as HookEvent] = rules;
  }
  return config;
}

/**
 * .dhelix/settings.json 파일에서 훅 설정을 로드합니다.
 * 파일의 "hooks" 키에서 훅 설정을 읽어 검증된 HookConfig를 반환합니다.
 *
 * 파일이 없거나 "hooks" 키가 없으면 빈 설정({})을 반환합니다.
 *
 * @param settingsDir - settings.json이 있는 디렉토리 경로 (예: ".dhelix")
 * @returns 검증된 훅 설정 객체
 * @throws HookLoadError - 파일 파싱 실패 또는 설정 검증 실패 시
 */
export async function loadHookConfig(settingsDir: string): Promise<HookConfig> {
  const settingsPath = join(settingsDir, "settings.json");

  try {
    // settings.json 파일 읽기 및 JSON 파싱
    const content = await readFile(settingsPath, "utf-8");
    const settings = JSON.parse(content) as Record<string, unknown>;
    // "hooks" 키만 추출하여 파싱
    return parseHookConfig(settings.hooks);
  } catch (error) {
    // ENOENT(파일 없음): 정상 상황 — 빈 설정 반환
    if (
      error instanceof Error &&
      "code" in error &&
      (error as NodeJS.ErrnoException).code === "ENOENT"
    ) {
      return {};
    }

    // HookLoadError는 그대로 상위로 전파
    if (error instanceof HookLoadError) throw error;

    // 그 외 에러: HookLoadError로 래핑하여 던짐
    throw new HookLoadError("Failed to load hook configuration", {
      path: settingsPath,
      cause: error instanceof Error ? error.message : String(error),
    });
  }
}
