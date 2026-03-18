/**
 * 설정 로더 — 5단계 계층에서 설정을 병합하여 최종 설정을 생성하는 모듈
 *
 * 설정 우선순위 (높은 것이 낮은 것을 덮어씀):
 * 5. CLI 플래그 (--model gpt-4o) — 가장 높은 우선순위
 * 4. 환경변수 (DBCODE_MODEL=gpt-4o)
 * 3. 프로젝트 설정 (.dbcode/config.json) — 프로젝트별 설정
 * 2. 사용자 설정 (~/.dbcode/config.json) — 사용자 전역 설정
 * 1. 기본값 (src/config/defaults.ts) — 가장 낮은 우선순위
 *
 * 각 레벨의 설정은 deepMerge로 병합되므로, 상위 레벨에서 특정 키만
 * 덮어쓰고 나머지는 하위 레벨 값을 유지할 수 있습니다.
 */

import { readFile } from "node:fs/promises";
import { configSchema } from "./schema.js";
import { DEFAULT_CONFIG } from "./defaults.js";
import { type AppConfig, type ConfigSource, type ResolvedConfig } from "./types.js";
import { joinPath, resolvePath } from "../utils/path.js";
import { CONFIG_DIR } from "../constants.js";
import { ConfigError } from "../utils/error.js";

/**
 * JSON 설정 파일을 읽어 파싱하는 함수
 *
 * 파일이 존재하지 않거나 파싱에 실패하면 undefined를 반환합니다.
 * 에러를 던지지 않고 조용히 실패하므로, 선택적 설정 파일 로딩에 적합합니다.
 *
 * @param filePath - 읽을 JSON 파일의 절대 경로
 * @returns 파싱된 JSON 객체, 또는 파일이 없으면 undefined
 */
async function loadJsonFile(filePath: string): Promise<Record<string, unknown> | undefined> {
  try {
    const content = await readFile(filePath, "utf-8");
    return JSON.parse(content) as Record<string, unknown>;
  } catch {
    return undefined;
  }
}

/**
 * 환경변수에서 설정 관련 값을 추출하는 함수
 *
 * 환경변수 우선순위:
 * - DBCODE_* 변수가 OPENAI_* 변수보다 우선합니다.
 * - OPENAI_API_KEY만 설정되고 Base URL이 없으면 자동으로 OpenAI API URL을 사용합니다.
 *
 * 지원하는 환경변수:
 * - DBCODE_BASE_URL / OPENAI_BASE_URL: API 엔드포인트 URL
 * - DBCODE_API_KEY / OPENAI_API_KEY: API 인증 키
 * - DBCODE_MODEL / OPENAI_MODEL: 모델명
 * - DBCODE_VERBOSE: 상세 로깅 활성화 ("true")
 *
 * @returns 환경변수에서 추출된 부분 설정 객체
 */
function loadEnvConfig(): Partial<AppConfig> {
  const env: Partial<AppConfig> = {};
  const llm: Record<string, unknown> = {};

  // Base URL 결정: LOCAL_API_BASE_URL > DBCODE_BASE_URL > OPENAI_BASE_URL > 기본값
  if (process.env.LOCAL_API_BASE_URL) {
    llm.baseUrl = process.env.LOCAL_API_BASE_URL;
  } else if (process.env.DBCODE_BASE_URL) {
    llm.baseUrl = process.env.DBCODE_BASE_URL;
  } else if (process.env.OPENAI_BASE_URL) {
    llm.baseUrl = process.env.OPENAI_BASE_URL;
  }

  // API 키 결정: DBCODE_API_KEY > OPENAI_API_KEY
  if (process.env.DBCODE_API_KEY) {
    llm.apiKey = process.env.DBCODE_API_KEY;
  } else if (process.env.OPENAI_API_KEY) {
    llm.apiKey = process.env.OPENAI_API_KEY;
    // OPENAI_API_KEY만 설정된 경우, Base URL이 없으면 OpenAI 공식 URL 자동 설정
    if (!process.env.DBCODE_BASE_URL && !process.env.OPENAI_BASE_URL) {
      llm.baseUrl = "https://api.openai.com/v1";
    }
  }

  // 모델명 결정: LOCAL_MODEL > DBCODE_MODEL > OPENAI_MODEL > 기본값
  if (process.env.LOCAL_MODEL) {
    llm.model = process.env.LOCAL_MODEL;
  } else if (process.env.DBCODE_MODEL) {
    llm.model = process.env.DBCODE_MODEL;
  } else if (process.env.OPENAI_MODEL) {
    llm.model = process.env.OPENAI_MODEL;
  }

  // LLM 관련 환경변수가 하나라도 있으면, 기본 LLM 설정에 병합
  if (Object.keys(llm).length > 0) {
    env.llm = { ...DEFAULT_CONFIG.llm, ...llm };
  }

  // DBCODE_VERBOSE=true이면 상세 로깅 활성화
  if (process.env.DBCODE_VERBOSE === "true") {
    env.verbose = true;
  }

  return env;
}

/**
 * 5단계 계층 설정 로더 — 모든 설정 소스를 병합하여 최종 설정 생성
 *
 * 병합 순서 (낮은 → 높은 우선순위):
 * 1. defaults (기본값)
 * 2. user config (~/.dbcode/config.json)
 * 3. project config (.dbcode/config.json)
 * 4. environment variables (환경변수)
 * 5. CLI flags (명령줄 플래그)
 *
 * 최종 병합된 객체는 Zod 스키마로 검증됩니다.
 * 검증에 실패하면 ConfigError를 던집니다.
 *
 * @param cliOverrides - CLI 플래그로 전달된 설정 덮어쓰기 값
 * @param projectDir - 프로젝트 디렉토리 경로 (프로젝트 설정 파일 검색용)
 * @returns 소스 메타데이터가 포함된 최종 설정 객체
 * @throws ConfigError - Zod 검증 실패 시
 */
export async function loadConfig(
  cliOverrides: Partial<AppConfig> = {},
  projectDir?: string,
): Promise<ResolvedConfig> {
  // 각 설정 키의 출처를 추적하는 Map
  const sources = new Map<string, ConfigSource>();

  // Level 1: 기본값 — 모든 설정의 시작점
  let merged: Record<string, unknown> = { ...DEFAULT_CONFIG };
  sources.set("*", "defaults");

  // Level 2: 사용자 전역 설정 (~/.dbcode/config.json)
  const userConfigPath = joinPath(CONFIG_DIR, "config.json");
  const userConfig = await loadJsonFile(userConfigPath);
  if (userConfig) {
    merged = deepMerge(merged, userConfig);
    for (const key of Object.keys(userConfig)) {
      sources.set(key, "user");
    }
  }

  // Level 3: 프로젝트 설정 (.dbcode/config.json) — 프로젝트별 커스터마이징
  if (projectDir) {
    const projectConfigPath = joinPath(resolvePath(projectDir), ".dbcode", "config.json");
    const projectConfig = await loadJsonFile(projectConfigPath);
    if (projectConfig) {
      merged = deepMerge(merged, projectConfig);
      for (const key of Object.keys(projectConfig)) {
        sources.set(key, "project");
      }
    }
  }

  // Level 4: 환경변수 — 배포 환경별 설정 주입에 유용
  const envConfig = loadEnvConfig();
  if (Object.keys(envConfig).length > 0) {
    merged = deepMerge(merged, envConfig as Record<string, unknown>);
    for (const key of Object.keys(envConfig)) {
      sources.set(key, "environment");
    }
  }

  // Level 5: CLI 플래그 — 가장 높은 우선순위 (일회성 덮어쓰기)
  if (Object.keys(cliOverrides).length > 0) {
    merged = deepMerge(merged, cliOverrides as Record<string, unknown>);
    for (const key of Object.keys(cliOverrides)) {
      sources.set(key, "cli-flags");
    }
  }

  // Zod 스키마로 최종 검증 — 타입, 범위, 필수 필드 확인
  const result = configSchema.safeParse(merged);
  if (!result.success) {
    throw new ConfigError("Invalid configuration", {
      errors: result.error.flatten().fieldErrors,
    });
  }

  return {
    config: result.data,
    sources,
  };
}

/**
 * 두 객체를 재귀적으로 깊은 병합(deep merge)하는 유틸리티 함수
 *
 * - 양쪽 모두 객체(배열 제외)인 경우: 재귀적으로 병합
 * - 그 외: source 값이 target 값을 덮어씀
 *
 * 예시:
 * target: { llm: { model: "gpt-4o", timeout: 60000 } }
 * source: { llm: { model: "claude-3" } }
 * 결과:  { llm: { model: "claude-3", timeout: 60000 } }
 *
 * @param target - 병합 대상 (기존 값)
 * @param source - 병합 소스 (새로운 값, 이 값이 우선)
 * @returns 병합된 새 객체 (원본은 변경되지 않음 — 불변성 보장)
 */
function deepMerge(
  target: Record<string, unknown>,
  source: Record<string, unknown>,
): Record<string, unknown> {
  // 스프레드 연산자로 target을 복사하여 원본 불변성 보장
  const result = { ...target };

  for (const key of Object.keys(source)) {
    const sourceVal = source[key];
    const targetVal = target[key];

    // 양쪽 모두 순수 객체(배열 아님)이면 재귀적으로 병합
    if (
      sourceVal !== null &&
      typeof sourceVal === "object" &&
      !Array.isArray(sourceVal) &&
      targetVal !== null &&
      typeof targetVal === "object" &&
      !Array.isArray(targetVal)
    ) {
      result[key] = deepMerge(
        targetVal as Record<string, unknown>,
        sourceVal as Record<string, unknown>,
      );
    } else {
      // 원시값이나 배열은 source 값으로 그대로 덮어씀
      result[key] = sourceVal;
    }
  }

  return result;
}
