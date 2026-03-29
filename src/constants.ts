/**
 * 전역 상수 모듈 — 애플리케이션 전체에서 사용되는 상수와 기본값 정의
 *
 * 이 파일은 아키텍처의 최하위 레이어(Leaf Module)에 위치하며,
 * 다른 모든 모듈이 이 파일을 참조할 수 있지만,
 * 이 파일은 다른 src/ 모듈을 import하지 않습니다 (순환 의존성 방지).
 *
 * 주요 원칙:
 * - 모델명 하드코딩 금지 → DEFAULT_MODEL (환경변수 기반 단일 소스)
 * - 경로 하드코딩 금지 → CONFIG_DIR, SESSIONS_DIR 등 상수 사용
 * - 매직 넘버 금지 → AGENT_LOOP, TOOL_TIMEOUTS 등 명명된 상수 사용
 */

import { homedir } from "node:os";
import { join } from "node:path";

/** 애플리케이션 버전 — package.json과 동기화 */
export const VERSION = "0.2.0";

/** 애플리케이션 이름 — 디렉토리명, 환경변수 접두사 등에 사용 */
export const APP_NAME = "dhelix";

/** 기본 설정 디렉토리: ~/.dhelix/ — 사용자 전역 설정이 저장되는 곳 */
export const CONFIG_DIR = join(homedir(), `.${APP_NAME}`);

/** 프로젝트 설정 파일명: DHELIX.md — 프로젝트 루트에 위치하는 인스트럭션 파일 */
export const PROJECT_CONFIG_FILE = `${APP_NAME.toUpperCase()}.md`;

/** 프로젝트 설정 디렉토리명: .dhelix — 프로젝트별 설정, 규칙, 스킬이 저장되는 곳 */
export const PROJECT_CONFIG_DIR = `.${APP_NAME}`;

/**
 * DHELIX.md 탐색 경로를 순서대로 반환
 *
 * 우선순위:
 * 1. {cwd}/DHELIX.md — 프로젝트 루트에 직접 (권장 방식)
 * 2. {cwd}/.dhelix/DHELIX.md — 하위 호환 폴백
 *
 * 모든 코드에서 DHELIX.md를 찾을 때 이 함수를 사용하여 일관성을 보장합니다.
 *
 * @param cwd - 탐색 시작 디렉토리
 * @returns DHELIX.md를 찾아볼 경로 배열 (우선순위 순)
 */
export function getProjectConfigPaths(cwd: string): readonly string[] {
  return [
    join(cwd, PROJECT_CONFIG_FILE), // DHELIX.md (프로젝트 루트 — 기본)
    join(cwd, PROJECT_CONFIG_DIR, PROJECT_CONFIG_FILE), // .dhelix/DHELIX.md (폴백)
  ];
}

/** 세션 저장 디렉토리: ~/.dhelix/sessions/ */
export const SESSIONS_DIR = join(CONFIG_DIR, "sessions");

/** 디버그 로그 파일 경로: ~/.dhelix/debug.log */
export const LOG_FILE = join(CONFIG_DIR, "debug.log");

/** 입력 히스토리 파일 경로: ~/.dhelix/input-history.json — 사용자 입력 기록 */
export const INPUT_HISTORY_FILE = join(CONFIG_DIR, "input-history.json");

/** 입력 히스토리 최대 항목 수 — 이 수를 초과하면 오래된 항목부터 삭제 */
export const INPUT_HISTORY_MAX = 500;

/**
 * 에이전트 루프 제한 상수 — AI의 자동 반복 실행을 제어
 *
 * 에이전트 루프는 "생각 → 도구 호출 → 결과 확인 → 다시 생각" 사이클입니다.
 * 무한 루프를 방지하고, 컨텍스트 윈도우를 효율적으로 관리합니다.
 */
export const AGENT_LOOP = {
  /** 최대 반복 횟수 — 이를 초과하면 강제 중단 */
  maxIterations: 50,
  /** 자동 컴팩션(compaction) 트리거 임계치 — 컨텍스트 윈도우의 83.5% 사용 시 */
  compactionThreshold: 0.835,
  /** 선제적 컴팩션 임계치 — LLM 호출 전 80% 도달 시 미리 컴팩션 실행 */
  preemptiveCompactionThreshold: 0.80,
  /** LLM 응답용 토큰 예약 비율 — 컨텍스트 윈도우의 20%를 응답에 남겨둠 */
  responseReserveRatio: 0.2,
} as const;

/**
 * 도구 실행 타임아웃 (밀리초) — 도구별 최대 실행 시간
 *
 * 셸 명령은 오래 걸릴 수 있으므로 가장 길고,
 * 파일 작업은 대부분 빠르므로 짧게 설정합니다.
 */
export const TOOL_TIMEOUTS = {
  /** Bash 명령 실행 타임아웃 (2분) — 빌드, 테스트 등 */
  bash: 120_000,
  /** 파일 작업 타임아웃 (30초) — 읽기, 쓰기, 편집 */
  fileOps: 30_000,
  /** 기본 타임아웃 (30초) — 기타 도구 */
  default: 30_000,
} as const;

/**
 * 기본 LLM 모델명 — 환경변수에서 결정되는 단일 소스(Single Source of Truth)
 *
 * 우선순위: LOCAL_MODEL > DHELIX_MODEL > OPENAI_MODEL > "gpt-4o-mini" (빌트인 폴백)
 *
 * 중요: 다른 파일에서 모델명을 하드코딩하지 마세요.
 * 항상 이 상수를 import하여 사용해야 합니다.
 */
export const DEFAULT_MODEL =
  process.env.LOCAL_MODEL ||
  process.env.DHELIX_MODEL ||
  process.env.OPENAI_MODEL ||
  process.env.ANTHROPIC_MODEL ||
  "gpt-4o-mini";

/**
 * 토큰 카운터 기본값
 */
export const TOKEN_DEFAULTS = {
  /** 토큰 카운팅에 사용할 기본 모델 */
  defaultModel: DEFAULT_MODEL,
  /** 최대 컨텍스트 윈도우 크기 (토큰) */
  maxContextWindow: 1_000_000,
} as const;

/**
 * LLM 기본 설정값 — 환경변수 기반으로 결정
 *
 * config/defaults.ts에서 이 값을 참조하여 하드코딩을 방지합니다.
 */
export const LLM_DEFAULTS = {
  /** 기본 API Base URL — LOCAL_API_BASE_URL > DHELIX_BASE_URL > OPENAI_BASE_URL > OpenAI 공식 */
  baseUrl:
    process.env.LOCAL_API_BASE_URL ||
    process.env.DHELIX_BASE_URL ||
    process.env.OPENAI_BASE_URL ||
    "https://api.openai.com/v1",
  /** 기본 모델명 — 환경변수에서 결정 */
  model: DEFAULT_MODEL,
  /** 기본 온도 — 0.0 (결정적, 동일 입력에 동일 출력) */
  temperature: 0.0,
  /** 기본 최대 응답 토큰 수 */
  maxTokens: 32768,
} as const;

/** 자동 메모리 — 디렉토리 및 파일 이름 상수 */
export const MEMORY_DIR = "memory" as const;
export const MEMORY_MAIN_FILE = "MEMORY.md" as const;

/**
 * 자동 메모리 — 제한 상수
 *
 * 메모리 시스템의 크기와 빈도를 제한하여
 * 컨텍스트 윈도우 낭비와 디스크 사용을 방지합니다.
 */
export const MEMORY_MAX_MAIN_LINES = 200; // MEMORY.md 최대 줄 수
export const MEMORY_MAX_TOPIC_LINES = 500; // 토픽 파일 최대 줄 수
export const MEMORY_MAX_ENTRIES_PER_SESSION = 20; // 세션당 최대 메모리 항목 수
export const MEMORY_MIN_CONFIDENCE = 0.7; // 메모리 저장 최소 신뢰도 (0.0~1.0)

/**
 * 프로젝트 레벨 메모리 디렉토리 경로를 반환
 *
 * @param projectDir - 프로젝트 디렉토리 경로
 * @returns {프로젝트}/.dhelix/memory/ 의 절대 경로
 */
export function getProjectMemoryDir(projectDir: string): string {
  return join(projectDir, PROJECT_CONFIG_DIR, MEMORY_DIR);
}

/**
 * 전역 사용자 메모리 디렉토리 경로를 반환
 *
 * @returns ~/.dhelix/memory/ 의 절대 경로
 */
export function getGlobalMemoryDir(): string {
  return join(CONFIG_DIR, MEMORY_DIR);
}
