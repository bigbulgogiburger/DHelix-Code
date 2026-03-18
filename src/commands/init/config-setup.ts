/**
 * 프로젝트 디렉토리 설정 헬퍼 모듈
 *
 * init 명령에서 추출된 유틸리티 함수들로,
 * 파일 존재 확인, .gitignore 관리, .dbcode/ 디렉토리 구조 생성을 담당합니다.
 */
import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { APP_NAME, PROJECT_CONFIG_DIR, DEFAULT_MODEL } from "../../constants.js";

/** 로컬 지시 파일명 — .gitignore에 추가되어 git에 커밋되지 않는 개인 설정 */
export const LOCAL_INSTRUCTIONS_FILE = `${APP_NAME.toUpperCase()}.local.md`;

/** 기본 설정값 — .dbcode/settings.json에 기록되는 초기 설정 */
export const DEFAULT_SETTINGS: Readonly<{
  readonly model: string;
  readonly allowedTools: readonly string[];
}> = {
  model: DEFAULT_MODEL,
  allowedTools: ["file_read", "file_write", "file_edit", "bash_exec", "glob_search", "grep_search"],
};

/**
 * 주어진 경로에 파일 또는 디렉토리가 존재하는지 확인하는 헬퍼 함수
 *
 * fs/promises의 access를 사용하여 경로 접근 가능 여부를 판단합니다.
 * 파일이 존재하지 않거나 접근 권한이 없으면 false를 반환합니다.
 *
 * @param filePath - 확인할 파일 또는 디렉토리의 절대 경로
 * @returns 파일이 존재하면 true, 없으면 false
 */
export async function fileExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

/**
 * .gitignore에 DBCODE.local.md 항목을 추가하는 함수
 *
 * .gitignore가 존재하고 해당 항목이 아직 없는 경우에만 추가합니다.
 * 로컬 설정 파일이 git에 커밋되지 않도록 보호합니다.
 * .gitignore 파일이 존재하지 않으면 아무 작업도 수행하지 않습니다.
 *
 * @param cwd - 프로젝트 루트 디렉토리
 */
export async function ensureGitignoreEntry(cwd: string): Promise<void> {
  const gitignorePath = join(cwd, ".gitignore");
  try {
    const content = await readFile(gitignorePath, "utf-8");
    const lines = content.split("\n");
    if (lines.some((line) => line.trim() === LOCAL_INSTRUCTIONS_FILE)) {
      return;
    }
    const newline = content.endsWith("\n") ? "" : "\n";
    await writeFile(gitignorePath, content + newline + LOCAL_INSTRUCTIONS_FILE + "\n", "utf-8");
  } catch {
    // .gitignore가 없으면 건너뜀
  }
}

/**
 * .dbcode/ 디렉토리 구조를 생성하는 함수 (없는 경우에만)
 *
 * 생성되는 구조:
 *   .dbcode/
 *     settings.json    — 모델 및 도구 설정
 *     rules/           — 커스텀 규칙 파일 디렉토리
 *       .gitkeep       — 빈 디렉토리 유지용
 *
 * 이미 .dbcode/ 디렉토리가 존재하면 아무 작업도 수행하지 않고 false를 반환합니다.
 *
 * @param cwd - 프로젝트 루트 디렉토리
 * @returns 새로 생성됐으면 true, 이미 존재하면 false
 */
export async function ensureConfigDir(cwd: string): Promise<boolean> {
  const projectPath = join(cwd, PROJECT_CONFIG_DIR);
  if (await fileExists(projectPath)) {
    return false;
  }
  await mkdir(join(projectPath, "rules"), { recursive: true });
  await writeFile(join(projectPath, "rules", ".gitkeep"), "", "utf-8");
  await writeFile(
    join(projectPath, "settings.json"),
    JSON.stringify(DEFAULT_SETTINGS, null, 2) + "\n",
    "utf-8",
  );
  return true;
}
