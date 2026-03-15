/**
 * 메모리 경로 유틸리티 — 프로젝트별 메모리 파일 경로를 계산하는 모듈
 *
 * 각 프로젝트의 메모리는 프로젝트 경로의 SHA-256 해시를 기반으로
 * 고유한 디렉토리에 저장됩니다.
 *
 * 경로 구조:
 * ~/.dbcode/projects/{해시16자}/memory/MEMORY.md
 * ~/.dbcode/projects/{해시16자}/memory/{토픽}.md
 *
 * 해시를 사용하는 이유:
 * - 프로젝트 경로에 특수문자가 있어도 안전한 디렉토리명 생성
 * - 절대 경로 기반이므로 같은 프로젝트는 항상 같은 해시 → 같은 메모리
 */

import { createHash } from "node:crypto";
import { homedir } from "node:os";
import { resolve } from "node:path";
import { APP_NAME } from "../constants.js";
import { joinPath } from "../utils/path.js";

/** 모든 프로젝트 메모리의 기본 디렉토리: ~/.dbcode/projects/ */
const PROJECTS_BASE_DIR = joinPath(homedir(), `.${APP_NAME}`, "projects");

/** 메인 메모리 파일명 */
const MEMORY_FILE = "MEMORY.md";

/**
 * 프로젝트 루트 경로에서 안정적인(stable) 해시를 생성
 *
 * SHA-256 해시의 앞 16자를 사용합니다.
 * 같은 절대 경로는 항상 같은 해시를 생성하므로,
 * 세션 간에 메모리 디렉토리를 안정적으로 찾을 수 있습니다.
 *
 * @param projectRoot - 프로젝트 루트의 절대 경로
 * @returns 16자 hex 문자열 (예: "a1b2c3d4e5f6g7h8")
 */
export function computeProjectHash(projectRoot: string): string {
  // resolve()로 절대 경로를 정규화하여 동일 프로젝트의 해시 일관성 보장
  const absolutePath = resolve(projectRoot);
  const hash = createHash("sha256").update(absolutePath).digest("hex");
  return hash.slice(0, 16);
}

/**
 * 프로젝트의 메모리 디렉토리 경로를 반환
 *
 * 경로: ~/.dbcode/projects/{프로젝트해시}/memory/
 *
 * @param projectRoot - 프로젝트 루트의 절대 경로
 * @returns 메모리 디렉토리의 절대 경로
 */
export function getMemoryDir(projectRoot: string): string {
  const projectHash = computeProjectHash(projectRoot);
  return joinPath(PROJECTS_BASE_DIR, projectHash, "memory");
}

/**
 * 프로젝트의 메인 MEMORY.md 파일 경로를 반환
 *
 * @param projectRoot - 프로젝트 루트의 절대 경로
 * @returns MEMORY.md의 절대 경로
 */
export function getMemoryFilePath(projectRoot: string): string {
  return joinPath(getMemoryDir(projectRoot), MEMORY_FILE);
}

/**
 * 특정 토픽의 메모리 파일 경로를 반환
 *
 * 토픽 파일은 MEMORY.md가 overflow될 때 오래된 섹션이 분리되어 저장되는 파일입니다.
 *
 * @param projectRoot - 프로젝트 루트의 절대 경로
 * @param topicFileName - 토픽 파일명 (예: "debugging.md")
 * @returns 토픽 파일의 절대 경로
 */
export function getTopicFilePath(projectRoot: string, topicFileName: string): string {
  return joinPath(getMemoryDir(projectRoot), topicFileName);
}

/**
 * 프로젝트 기본 디렉토리 경로를 반환
 *
 * @returns ~/.dbcode/projects/ 의 절대 경로
 */
export function getProjectsBaseDir(): string {
  return PROJECTS_BASE_DIR;
}
