/**
 * 메모리 로더 — 프로젝트 메모리 파일을 디스크에서 읽어오는 모듈
 *
 * 세션 시작 시 MEMORY.md를 읽어 시스템 프롬프트에 주입하여,
 * AI가 이전 세션에서 학습한 내용을 기억하도록 합니다.
 *
 * 주요 기능:
 * - MEMORY.md 로드 (최대 줄 수 제한으로 컨텍스트 절약)
 * - 토픽 파일 로드 (특정 주제의 상세 메모리 접근)
 * - 토픽 파일 목록 조회 (overflow된 섹션 파악)
 */

import { readFile, readdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { BaseError } from "../utils/error.js";
import { getMemoryDir, getMemoryFilePath } from "./paths.js";
import type { MemoryLoadResult } from "./types.js";

/**
 * 메모리 로딩 에러 — 메모리 파일 읽기 중 발생한 오류
 */
export class MemoryLoadError extends BaseError {
  constructor(message: string, context: Record<string, unknown> = {}) {
    super(message, "MEMORY_LOAD_ERROR", context);
  }
}

/** MEMORY.md에서 로드할 기본 최대 줄 수 — 너무 길면 컨텍스트 윈도우를 낭비 */
const DEFAULT_MAX_LOAD_LINES = 200;

/**
 * 프로젝트 메모리를 MEMORY.md에서 로드
 *
 * 파일의 처음 maxLines 줄까지만 읽어 컨텍스트를 절약합니다.
 * 메모리 디렉토리나 파일이 없으면 빈 결과를 우아하게(gracefully) 반환합니다.
 *
 * @param projectRoot - 프로젝트 루트의 절대 경로
 * @param maxLines - 로드할 최대 줄 수 (기본: 200)
 * @returns 메모리 로드 결과 (내용, 경로, 존재 여부, 토픽 파일 목록)
 * @throws MemoryLoadError - 파일은 존재하지만 읽기 실패 시
 */
export async function loadProjectMemory(
  projectRoot: string,
  maxLines: number = DEFAULT_MAX_LOAD_LINES,
): Promise<MemoryLoadResult> {
  const memoryDir = getMemoryDir(projectRoot);
  const memoryFilePath = getMemoryFilePath(projectRoot);

  // 메모리 디렉토리나 파일이 없으면 — 첫 사용 또는 초기화 전
  if (!existsSync(memoryDir) || !existsSync(memoryFilePath)) {
    return {
      content: "",
      memoryFilePath,
      exists: false,
      topicFiles: [],
    };
  }

  try {
    const rawContent = await readFile(memoryFilePath, "utf-8");
    // maxLines까지만 잘라서 컨텍스트 윈도우 절약
    const lines = rawContent.split("\n");
    const truncatedContent = lines.slice(0, maxLines).join("\n").trimEnd();
    // overflow된 토픽 파일 목록도 함께 반환
    const topicFiles = await listTopicFiles(projectRoot);

    return {
      content: truncatedContent,
      memoryFilePath,
      exists: true,
      topicFiles,
    };
  } catch (error: unknown) {
    throw new MemoryLoadError("Failed to load project memory", {
      projectRoot,
      memoryFilePath,
      cause: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * 특정 토픽 메모리 파일을 로드
 *
 * 토픽 파일은 MEMORY.md에서 overflow된 섹션이 저장된 개별 파일입니다.
 * AI가 특정 주제에 대한 상세 메모리가 필요할 때 호출합니다.
 *
 * @param projectRoot - 프로젝트 루트의 절대 경로
 * @param topic - 토픽 이름 또는 파일명
 * @returns 토픽 파일 내용 또는 null (파일 없음)
 * @throws MemoryLoadError - 파일은 존재하지만 읽기 실패 시
 */
export async function loadTopicMemory(projectRoot: string, topic: string): Promise<string | null> {
  const memoryDir = getMemoryDir(projectRoot);
  // 토픽 이름을 안전한 파일명으로 정규화
  const topicFileName = normalizeTopicFileName(topic);
  const topicFilePath = `${memoryDir}/${topicFileName}`;

  if (!existsSync(topicFilePath)) {
    return null;
  }

  try {
    return await readFile(topicFilePath, "utf-8");
  } catch (error: unknown) {
    throw new MemoryLoadError("Failed to load topic memory", {
      projectRoot,
      topic,
      topicFilePath,
      cause: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * 메모리 디렉토리의 모든 토픽 파일 목록을 반환
 *
 * MEMORY.md를 제외한 .md 파일들을 검색합니다.
 * 토픽 파일은 MEMORY.md가 overflow될 때 자동으로 생성됩니다.
 *
 * @param projectRoot - 프로젝트 루트의 절대 경로
 * @returns 정렬된 토픽 파일명 배열 (경로 없이 파일명만, 예: ["debugging.md", "patterns.md"])
 */
export async function listTopicFiles(projectRoot: string): Promise<readonly string[]> {
  const memoryDir = getMemoryDir(projectRoot);

  if (!existsSync(memoryDir)) {
    return [];
  }

  try {
    const entries = await readdir(memoryDir);
    // .md 파일 중 MEMORY.md를 제외하고 정렬
    return entries.filter((e) => e.endsWith(".md") && e !== "MEMORY.md").sort();
  } catch {
    return [];
  }
}

/**
 * 토픽 이름을 유효한 파일명으로 정규화
 *
 * 안전하지 않은 문자를 하이픈(-)으로 교체하고,
 * 소문자로 통일하여 일관된 파일명을 생성합니다.
 *
 * 예시: "User Preferences!" → "user-preferences.md"
 *
 * @param topic - 원본 토픽 이름
 * @returns 정규화된 파일명 (예: "debugging.md")
 */
function normalizeTopicFileName(topic: string): string {
  // .md 확장자가 있으면 제거 (나중에 다시 붙임)
  const base = topic.endsWith(".md") ? topic.slice(0, -3) : topic;
  // 소문자로 변환 → 영숫자, 하이픈, 밑줄만 유지 → 연속 하이픈 제거 → 양 끝 하이픈 제거
  const safe = base
    .toLowerCase()
    .replace(/[^a-z0-9-_]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  return `${safe || "untitled"}.md`;
}

export { normalizeTopicFileName };
