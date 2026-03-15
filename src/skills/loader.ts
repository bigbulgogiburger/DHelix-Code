/**
 * 스킬 로더 — 마크다운 파일에서 스킬을 파싱하고 로드하는 모듈
 *
 * 스킬 파일(.md)의 구조:
 * ---
 * name: my-skill
 * description: 스킬 설명
 * context: inline
 * ---
 * 프롬프트 본문...
 *
 * 이 모듈은 프론트매터(YAML 메타데이터)를 파싱하고,
 * 본문을 분리하여 SkillDefinition 객체를 생성합니다.
 *
 * 프론트매터 파서는 간소화된 YAML 서브셋을 지원합니다:
 * - key: value (문자열, 숫자, 불리언)
 * - key: [item1, item2] (인라인 배열)
 * - kebab-case 키는 자동으로 camelCase로 변환됩니다.
 */

import { readFile, readdir } from "node:fs/promises";
import { join, extname, basename } from "node:path";
import { BaseError } from "../utils/error.js";
import { skillFrontmatterSchema, type SkillDefinition } from "./types.js";

/**
 * 스킬 로딩 에러 — 파일 읽기/파싱 실패 시 발생
 */
export class SkillLoadError extends BaseError {
  constructor(message: string, context: Record<string, unknown> = {}) {
    super(message, "SKILL_LOAD_ERROR", context);
  }
}

/** 프론트매터 구분자 — 세 개의 대시(---) */
const FRONTMATTER_DELIMITER = "---";

/**
 * YAML 유사 프론트매터를 파싱하여 키-값 객체로 변환
 *
 * 지원하는 형식:
 * - key: value → { key: "value" }
 * - key: true/false → { key: true/false }
 * - key: [a, b, c] → { key: ["a", "b", "c"] }
 * - kebab-case-key → camelCaseKey로 자동 변환
 *
 * @param raw - ---와 --- 사이의 프론트매터 원본 텍스트
 * @returns 파싱된 키-값 객체
 */
function parseFrontmatter(raw: string): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  for (const line of raw.split("\n")) {
    const trimmed = line.trim();
    // 빈 줄이나 주석(#)은 건너뜀
    if (!trimmed || trimmed.startsWith("#")) continue;

    // 콜론(:)으로 키와 값을 분리
    const colonIdx = trimmed.indexOf(":");
    if (colonIdx === -1) continue;

    const key = trimmed.slice(0, colonIdx).trim();
    const value = trimmed.slice(colonIdx + 1).trim();

    // kebab-case를 camelCase로 변환 (예: "allowed-tools" → "allowedTools")
    const camelKey = key.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());

    result[camelKey] = parseValue(value);
  }

  return result;
}

/**
 * YAML 유사 값 문자열을 JavaScript 값으로 변환
 *
 * 변환 규칙:
 * - "true" → true (불리언)
 * - "false" → false (불리언)
 * - "null" 또는 "~" → null
 * - "" → 빈 문자열
 * - "[a, b, c]" → ["a", "b", "c"] (인라인 배열)
 * - 숫자 형태 → Number
 * - 따옴표로 감싼 문자열 → 따옴표 제거
 * - 그 외 → 문자열 그대로
 *
 * @param raw - 파싱할 값 문자열
 * @returns 변환된 JavaScript 값
 */
function parseValue(raw: string): unknown {
  if (raw === "true") return true;
  if (raw === "false") return false;
  if (raw === "null" || raw === "~") return null;
  if (raw === "") return "";

  // 인라인 배열: [item1, item2, item3]
  if (raw.startsWith("[") && raw.endsWith("]")) {
    const inner = raw.slice(1, -1).trim();
    if (!inner) return [];
    return inner.split(",").map((item) => {
      const trimmed = item.trim();
      // 따옴표로 감싼 항목은 따옴표 제거
      if (
        (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
        (trimmed.startsWith("'") && trimmed.endsWith("'"))
      ) {
        return trimmed.slice(1, -1);
      }
      // 재귀적으로 값 파싱 (숫자, 불리언 등)
      return parseValue(trimmed);
    });
  }

  // 숫자 형태: 정수 또는 소수점 포함
  if (/^-?\d+(\.\d+)?$/.test(raw)) return Number(raw);

  // 따옴표로 감싼 문자열: 따옴표 제거 후 반환
  if ((raw.startsWith('"') && raw.endsWith('"')) || (raw.startsWith("'") && raw.endsWith("'"))) {
    return raw.slice(1, -1);
  }

  // 그 외: 문자열 그대로 반환
  return raw;
}

/**
 * 스킬 파일을 프론트매터와 본문으로 분리
 *
 * 프론트매터는 파일 첫 줄의 ---로 시작하여 다음 ---까지의 영역입니다.
 * 프론트매터가 없으면 전체 내용을 본문으로 취급합니다.
 *
 * @param content - 스킬 파일의 전체 내용
 * @returns 프론트매터 원본과 본문 텍스트
 */
function splitFrontmatterAndBody(content: string): { frontmatterRaw: string; body: string } {
  const lines = content.split("\n");
  // 첫 줄이 ---가 아니면 프론트매터 없음
  if (lines[0]?.trim() !== FRONTMATTER_DELIMITER) {
    return { frontmatterRaw: "", body: content };
  }

  // 두 번째 ---를 찾아 프론트매터 끝 지점 결정
  const endIdx = lines.indexOf(FRONTMATTER_DELIMITER, 1);
  if (endIdx === -1) {
    return { frontmatterRaw: "", body: content };
  }

  // --- 사이의 내용이 프론트매터, 그 이후가 본문
  const frontmatterRaw = lines.slice(1, endIdx).join("\n");
  const body = lines
    .slice(endIdx + 1)
    .join("\n")
    .trim();
  return { frontmatterRaw, body };
}

/**
 * 단일 마크다운 파일에서 스킬을 로드
 *
 * 파일을 읽고, 프론트매터와 본문을 분리한 후,
 * 프론트매터를 Zod 스키마로 검증하여 SkillDefinition을 반환합니다.
 *
 * @param filePath - 스킬 .md 파일의 절대 경로
 * @returns 파싱된 스킬 정의 객체
 * @throws SkillLoadError - 프론트매터 누락 또는 파싱 실패 시
 */
export async function loadSkill(filePath: string): Promise<SkillDefinition> {
  try {
    const content = await readFile(filePath, "utf-8");
    const { frontmatterRaw, body } = splitFrontmatterAndBody(content);

    // 프론트매터가 없으면 유효한 스킬이 아님
    if (!frontmatterRaw) {
      throw new SkillLoadError("Skill file missing frontmatter", { path: filePath });
    }

    // 프론트매터를 파싱하고 Zod 스키마로 타입/범위 검증
    const rawData = parseFrontmatter(frontmatterRaw);
    const frontmatter = skillFrontmatterSchema.parse(rawData);

    return {
      frontmatter,
      body,
      sourcePath: filePath,
    };
  } catch (error) {
    if (error instanceof SkillLoadError) throw error;
    throw new SkillLoadError(`Failed to load skill from ${filePath}`, {
      path: filePath,
      cause: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * 디렉토리의 모든 .md 파일에서 스킬을 로드
 *
 * 개별 파일 로딩 실패는 해당 스킬만 건너뛰고 계속 진행합니다 (비치명적 오류).
 * 디렉토리가 존재하지 않으면 빈 배열을 반환합니다.
 *
 * @param directory - 스킬 파일이 있는 디렉토리 경로
 * @returns 성공적으로 로드된 스킬 정의 배열 (로딩 실패한 파일은 제외)
 * @throws SkillLoadError - 디렉토리 읽기 자체가 실패한 경우 (ENOENT 제외)
 */
export async function loadSkillsFromDirectory(
  directory: string,
): Promise<readonly SkillDefinition[]> {
  try {
    const entries = await readdir(directory);
    // .md 확장자 파일만 필터링
    const mdFiles = entries.filter((f) => extname(f) === ".md");

    const skills: SkillDefinition[] = [];
    const errors: Array<{ file: string; error: string }> = [];

    for (const file of mdFiles) {
      try {
        const skill = await loadSkill(join(directory, file));
        skills.push(skill);
      } catch (error) {
        // 개별 스킬 로딩 실패는 기록만 하고 다른 스킬 로딩 계속
        errors.push({
          file: basename(file),
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    if (errors.length > 0) {
      // 비치명적: 로딩 실패한 스킬은 건너뛰고, 에러는 디버깅용으로만 보존
    }

    return skills;
  } catch (error) {
    // 디렉토리가 존재하지 않으면 (ENOENT) 빈 배열 반환 — 정상 동작
    if (
      error instanceof Error &&
      "code" in error &&
      (error as NodeJS.ErrnoException).code === "ENOENT"
    ) {
      return [];
    }
    throw new SkillLoadError(`Failed to read skills directory: ${directory}`, {
      path: directory,
      cause: error instanceof Error ? error.message : String(error),
    });
  }
}
