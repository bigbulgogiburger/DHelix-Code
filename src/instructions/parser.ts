/**
 * 인스트럭션 파서 — DHELIX.md 파일의 @import 지시어를 해석하고 내용을 병합
 *
 * DHELIX.md 파일에서 다른 마크다운 파일을 가져올 수 있는 임포트 기능을 제공합니다.
 * 이를 통해 대규모 인스트럭션을 여러 파일로 분리하여 관리할 수 있습니다.
 *
 * 지원하는 임포트 문법:
 * 1. @import "./relative/path.md" — 표준 임포트 (주석 가능: # 코멘트)
 * 2. @./relative/path.md — 단축 임포트 (경로가 ./, ../, /로 시작)
 *
 * 안전 장치:
 * - .md 파일만 임포트 가능 (보안)
 * - 최대 5단계 중첩 임포트 (무한 재귀 방지)
 * - 순환 임포트 감지 및 건너뛰기
 * - 심볼릭 링크(symlink) 해석하여 실제 경로로 순환 감지
 */

import { readFile, realpath } from "node:fs/promises";
import { dirname, resolve, extname } from "node:path";
import { BaseError } from "../utils/error.js";

/**
 * 인스트럭션 파싱 에러 — 파일 임포트 처리 중 발생한 오류
 */
export class InstructionParseError extends BaseError {
  constructor(message: string, context: Record<string, unknown> = {}) {
    super(message, "INSTRUCTION_PARSE_ERROR", context);
  }
}

/**
 * @import 지시어를 매칭하는 정규식
 *
 * 매칭 형식: @import "./relative/path.md"  # 선택적 코멘트
 * 캡처 그룹 [1]: 따옴표 안의 경로 문자열
 */
const IMPORT_PATTERN = /^@import\s+"([^"]+)"\s*(?:#.*)?$/gm;

/**
 * @경로 단축 임포트를 매칭하는 정규식
 *
 * 매칭 형식: @./relative/path.md, @../parent/path.md, @/absolute/path.md
 * 경로가 ., .., /로 시작해야 @멘션과 구분됩니다.
 * 캡처 그룹 [1]: @ 이후의 경로 문자열
 */
const SHORTHAND_IMPORT_PATTERN = /^@(\.{1,2}\/[^\s]+|\/[^\s]+)$/gm;

/** 최대 임포트 중첩 깊이 — 무한 재귀 방지 */
const MAX_IMPORT_DEPTH = 5;

/**
 * 인스트럭션 내용에서 @import 경로를 추출
 *
 * 표준 형식(@import "path")과 단축 형식(@path) 모두 검색합니다.
 *
 * @param content - 임포트 지시어가 포함된 원본 텍스트
 * @returns 발견된 임포트 경로 배열
 */
export function extractImports(content: string): readonly string[] {
  const imports: string[] = [];

  // @import "path" 형식 매칭
  const importRegex = new RegExp(IMPORT_PATTERN.source, "gm");
  let match: RegExpExecArray | null;
  while ((match = importRegex.exec(content)) !== null) {
    imports.push(match[1]);
  }

  // @path 단축 형식 매칭
  const shorthandRegex = new RegExp(SHORTHAND_IMPORT_PATTERN.source, "gm");
  while ((match = shorthandRegex.exec(content)) !== null) {
    imports.push(match[1]);
  }

  return imports;
}

/**
 * 파일 경로가 .md 확장자인지 확인
 * 보안을 위해 마크다운 파일만 임포트를 허용합니다.
 *
 * @param filePath - 확인할 파일 경로
 * @returns .md 확장자이면 true
 */
function isMdFile(filePath: string): boolean {
  return extname(filePath).toLowerCase() === ".md";
}

/**
 * @import 지시어를 재귀적으로 해석하여 가져온 파일 내용으로 교체
 *
 * 처리 흐름:
 * 1. 내용에서 @import 패턴을 모두 찾음
 * 2. 각 임포트 경로를 절대 경로로 해석
 * 3. 순환 참조 확인 (이미 방문한 파일이면 건너뜀)
 * 4. 파일을 읽고, 재귀적으로 중첩 임포트 해석
 * 5. 원본의 @import 줄을 가져온 내용으로 교체
 *
 * @param content - @import가 포함된 원본 내용
 * @param baseDir - 상대 경로를 해석할 기준 디렉토리
 * @param depth - 현재 재귀 깊이 (내부용, 최초 호출 시 0)
 * @param visited - 이미 방문한 파일 경로 집합 (순환 참조 방지, 내부용)
 * @returns 모든 @import가 실제 내용으로 교체된 최종 텍스트
 */
export async function resolveImports(
  content: string,
  baseDir: string,
  depth: number = 0,
  visited: Set<string> = new Set(),
): Promise<string> {
  // 최대 깊이 도달 시 더 이상 임포트를 해석하지 않음
  if (depth >= MAX_IMPORT_DEPTH) {
    return content;
  }

  // 양쪽 패턴에서 모든 매칭을 수집
  const matches: { fullMatch: string; importPath: string }[] = [];

  const importRegex = new RegExp(IMPORT_PATTERN.source, "gm");
  let match: RegExpExecArray | null;
  while ((match = importRegex.exec(content)) !== null) {
    matches.push({ fullMatch: match[0], importPath: match[1] });
  }

  const shorthandRegex = new RegExp(SHORTHAND_IMPORT_PATTERN.source, "gm");
  while ((match = shorthandRegex.exec(content)) !== null) {
    matches.push({ fullMatch: match[0], importPath: match[1] });
  }

  let result = content;

  for (const { fullMatch, importPath } of matches) {
    // .md 파일만 임포트 가능 — 보안을 위해 다른 확장자는 건너뜀
    if (!isMdFile(importPath)) {
      result = result.replace(fullMatch, `<!-- import skipped (not .md): ${importPath} -->`);
      continue;
    }

    // 상대 경로를 절대 경로로 해석
    const resolvedPath = resolve(baseDir, importPath);

    // 심볼릭 링크를 해석하여 실제 경로를 얻음 (순환 참조 감지에 필요)
    let normalizedPath: string;
    try {
      const realPath = await realpath(resolvedPath);
      normalizedPath = realPath.replace(/\\/g, "/");
    } catch {
      // 파일이 존재하지 않으면 해석된 경로를 에러 메시지용으로 사용
      normalizedPath = resolvedPath.replace(/\\/g, "/");
    }

    // 순환 임포트 감지 — 이미 방문한 파일이면 건너뜀
    if (visited.has(normalizedPath)) {
      result = result.replace(fullMatch, `<!-- circular import skipped: ${importPath} -->`);
      continue;
    }

    try {
      // 방문 기록 추가 후 파일 읽기
      visited.add(normalizedPath);
      const importedContent = await readFile(resolvedPath, "utf-8");

      // 가져온 파일 내에 중첩 임포트가 있을 수 있으므로 재귀 해석
      const resolvedContent = await resolveImports(
        importedContent,
        dirname(resolvedPath), // 가져온 파일의 디렉토리를 새 기준으로 사용
        depth + 1,
        visited,
      );

      // 원본의 @import 줄을 가져온 내용으로 교체
      result = result.replace(fullMatch, resolvedContent);
    } catch (error) {
      if (error instanceof InstructionParseError) throw error;
      // 파일을 찾을 수 없으면 경고 주석으로 교체
      result = result.replace(fullMatch, `<!-- import not found: ${importPath} -->`);
    }
  }

  return result;
}

/**
 * 인스트럭션 내용을 파싱 — @import를 해석하고 최종 텍스트를 반환
 *
 * resolveImports의 편의 래퍼(wrapper) 함수입니다.
 *
 * @param content - 파싱할 인스트럭션 원본
 * @param baseDir - 상대 경로 해석 기준 디렉토리
 * @returns 임포트가 해석된 최종 인스트럭션 텍스트
 */
export async function parseInstructions(content: string, baseDir: string): Promise<string> {
  return resolveImports(content, baseDir);
}
