/**
 * 자동 메모리 시스템 타입 정의 — 프로젝트별 학습 내용의 영구 저장 구조
 *
 * 메모리 시스템은 AI가 세션 간에 학습한 내용(사용자 선호, 디버깅 패턴, 아키텍처 결정 등)을
 * 마크다운 파일로 저장하여 다음 세션에서 활용합니다.
 *
 * 저장 위치: ~/.dhelix/projects/{프로젝트해시}/memory/MEMORY.md
 *
 * MEMORY.md 구조:
 * # Project Memory
 * ## Debugging
 * - 이 프로젝트에서 자주 발생하는 에러 패턴...
 * ## Preferences
 * - 사용자는 함수형 컴포넌트를 선호...
 */

import { z } from "zod";

/**
 * 메모리 시스템 설정 인터페이스
 */
export interface MemoryConfig {
  /** 세션 시작 시 MEMORY.md에서 로드할 최대 줄 수 (너무 길면 컨텍스트 낭비) */
  readonly maxLoadLines: number;
  /** MEMORY.md의 최대 줄 수 — 초과 시 오래된 섹션을 토픽 파일로 분리(overflow) */
  readonly maxMemoryLines: number;
  /** 프로젝트 메모리 저장 기본 디렉토리 (~/.dhelix/projects/) */
  readonly projectsBaseDir: string;
}

/**
 * 추가할 단일 메모리 항목
 *
 * 메모리에 새로운 학습 내용을 추가할 때 사용합니다.
 * topic별로 MEMORY.md의 ## 섹션에 분류됩니다.
 */
export interface MemoryEntry {
  /** 항목이 속하는 토픽/섹션 (예: "debugging", "patterns", "preferences") */
  readonly topic: string;
  /** 저장할 내용 (마크다운 형식) */
  readonly content: string;
}

/**
 * 프로젝트 메모리 로드 결과
 *
 * loadProjectMemory() 호출 시 반환되는 구조체입니다.
 */
export interface MemoryLoadResult {
  /** MEMORY.md의 내용 (maxLoadLines까지 잘린 버전) */
  readonly content: string;
  /** MEMORY.md 파일의 절대 경로 */
  readonly memoryFilePath: string;
  /** MEMORY.md 파일이 디스크에 존재하는지 여부 */
  readonly exists: boolean;
  /** 사용 가능한 토픽 파일 목록 (overflow로 분리된 파일들) */
  readonly topicFiles: readonly string[];
}

/**
 * 메모리 항목 입력 검증용 Zod 스키마
 *
 * 외부 입력(도구 호출 등)으로 받은 메모리 항목의 유효성을 검증합니다.
 * - topic: 1~100자의 문자열
 * - content: 비어있지 않은 문자열
 */
export const memoryEntrySchema = z.object({
  topic: z.string().min(1).max(100),
  content: z.string().min(1),
});
