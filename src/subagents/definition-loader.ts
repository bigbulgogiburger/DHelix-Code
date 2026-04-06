/**
 * 에이전트 정의 로더 — 마크다운(.md) 파일에서 에이전트 정의를 파싱하고 로드하는 모듈
 *
 * 에이전트 정의 파일이란 서브에이전트의 역할, 도구 권한, 시스템 프롬프트 등을
 * 마크다운 형식으로 기술한 파일입니다.
 *
 * 파일 구조 예시:
 * ```markdown
 * ---
 * name: code-reviewer
 * description: 코드 리뷰 에이전트
 * tools: [file_read, grep_search]
 * max-turns: 15
 * ---
 * 당신은 코드 리뷰 전문가입니다...
 * ```
 *
 * "---" 사이의 부분이 프론트매터(frontmatter)로 메타데이터를 담고 있고,
 * 그 아래가 시스템 프롬프트 본문입니다.
 *
 * 로드 우선순위:
 * 1. 프로젝트 단위: .dhelix/agents/*.md (높은 우선순위)
 * 2. 사용자 전역: ~/.dhelix/agents/*.md (낮은 우선순위)
 * 같은 이름의 에이전트가 양쪽에 있으면 프로젝트 단위가 우선합니다.
 */
import { readFile, readdir, stat } from "node:fs/promises";
import { join, extname } from "node:path";
import { homedir } from "node:os";
import { APP_NAME } from "../constants.js";
import { BaseError } from "../utils/error.js";
import {
  agentDefinitionSchema,
  type AgentDefinition,
  type AgentDefinitionSource,
} from "./definition-types.js";

/**
 * 에이전트 정의 로딩 중 발생하는 에러 클래스
 *
 * BaseError를 확장하여 에러 코드("AGENT_DEFINITION_LOAD_ERROR")와
 * 추가 컨텍스트 정보(파일 경로 등)를 포함합니다.
 */
export class AgentDefinitionLoadError extends BaseError {
  constructor(message: string, context: Record<string, unknown> = {}) {
    super(message, "AGENT_DEFINITION_LOAD_ERROR", context);
  }
}

/** 프론트매터 구분자 — YAML 프론트매터의 시작과 끝을 나타내는 "---" */
const FRONTMATTER_DELIMITER = "---";

/**
 * 간소화된 YAML 값을 JavaScript 타입으로 파싱합니다.
 *
 * 지원하는 타입:
 * - 불리언(boolean): "true" → true, "false" → false
 * - null: "null" 또는 "~" → null
 * - 숫자(number): "42" → 42, "3.14" → 3.14
 * - 인라인 배열: "[a, b, c]" → ["a", "b", "c"]
 * - 따옴표 문자열: '"hello"' → "hello"
 * - 일반 문자열: "hello" → "hello"
 *
 * @param raw - 파싱할 원시 문자열 값
 * @returns 파싱된 JavaScript 값
 */
function parseValue(raw: string): unknown {
  if (raw === "true") return true;
  if (raw === "false") return false;
  if (raw === "null" || raw === "~") return null;
  if (raw === "") return "";

  // 인라인 배열 파싱: [item1, item2, item3]
  if (raw.startsWith("[") && raw.endsWith("]")) {
    const inner = raw.slice(1, -1).trim();
    if (!inner) return [];
    return inner.split(",").map((item) => {
      const trimmed = item.trim();
      // 따옴표로 감싸진 항목은 따옴표 제거
      if (
        (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
        (trimmed.startsWith("'") && trimmed.endsWith("'"))
      ) {
        return trimmed.slice(1, -1);
      }
      return parseValue(trimmed) as string;
    });
  }

  // 숫자 파싱: 정수 또는 소수점 숫자
  if (/^-?\d+(\.\d+)?$/.test(raw)) return Number(raw);

  // 따옴표 문자열: 앞뒤 따옴표 제거
  if ((raw.startsWith('"') && raw.endsWith('"')) || (raw.startsWith("'") && raw.endsWith("'"))) {
    return raw.slice(1, -1);
  }

  // 그 외는 일반 문자열로 반환
  return raw;
}

/**
 * 간소화된 YAML 프론트매터를 키-값 레코드로 파싱합니다.
 *
 * 지원하는 형식은 "key: value" 형태의 평탄한(flat) 구조만 해당됩니다.
 * 중첩 구조(nested YAML)는 지원하지 않습니다.
 *
 * 특별 처리:
 * - 케밥 케이스(kebab-case)를 카멜 케이스(camelCase)로 자동 변환
 *   예: "max-turns" → "maxTurns"
 * - 빈 줄과 주석(#으로 시작)은 건너뜀
 *
 * @param raw - 프론트매터 원시 텍스트 ("---" 구분자 제외)
 * @returns 파싱된 키-값 레코드
 */
function parseFrontmatter(raw: string): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  for (const line of raw.split("\n")) {
    const trimmed = line.trim();
    // 빈 줄이나 주석은 건너뜀
    if (!trimmed || trimmed.startsWith("#")) continue;

    // 콜론(:)으로 키와 값을 분리
    const colonIdx = trimmed.indexOf(":");
    if (colonIdx === -1) continue;

    const key = trimmed.slice(0, colonIdx).trim();
    const value = trimmed.slice(colonIdx + 1).trim();

    // 케밥 케이스 → 카멜 케이스 변환 (예: max-turns → maxTurns)
    const camelKey = key.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());

    result[camelKey] = parseValue(value);
  }

  return result;
}

/**
 * 마크다운 파일에서 YAML 프론트매터를 파싱합니다.
 *
 * 프론트매터란 파일 맨 앞에 "---"로 감싸진 메타데이터 영역입니다:
 * ```
 * ---
 * name: my-agent
 * description: 설명
 * ---
 * 여기부터 본문(시스템 프롬프트)
 * ```
 *
 * @param content - 마크다운 파일 전체 내용
 * @returns frontmatter(메타데이터 객체)와 body(본문 텍스트)
 */
export function parseYamlFrontmatter(content: string): {
  readonly frontmatter: Record<string, unknown>;
  readonly body: string;
} {
  const lines = content.split("\n");

  // 첫 줄이 "---"가 아니면 프론트매터 없음 → 전체가 본문
  if (lines[0]?.trim() !== FRONTMATTER_DELIMITER) {
    return { frontmatter: {}, body: content };
  }

  // 닫는 "---"를 찾음 (인덱스 1부터 검색 — 열는 "---" 건너뜀)
  const endIdx = lines.indexOf(FRONTMATTER_DELIMITER, 1);
  if (endIdx === -1) {
    // 닫는 구분자가 없으면 프론트매터 없는 것으로 처리
    return { frontmatter: {}, body: content };
  }

  // "---" 사이의 내용을 프론트매터로, 그 이후를 본문으로 분리
  const frontmatterRaw = lines.slice(1, endIdx).join("\n");
  const body = lines
    .slice(endIdx + 1)
    .join("\n")
    .trim();

  return { frontmatter: parseFrontmatter(frontmatterRaw), body };
}

/**
 * 단일 에이전트 정의 파일을 파싱합니다.
 *
 * 프론트매터를 추출하고, Zod 스키마로 유효성을 검증한 뒤,
 * 완전한 AgentDefinition 객체를 반환합니다.
 *
 * @param content - 에이전트 정의 파일의 전체 내용
 * @param source - 정의가 로드된 출처 ("project" | "user" | "cli")
 * @param filePath - 파일 경로 (에러 메시지용, 선택적)
 * @returns 파싱되고 검증된 에이전트 정의 객체
 * @throws AgentDefinitionLoadError — 프론트매터가 없거나 유효하지 않을 때
 */
export function parseAgentFile(
  content: string,
  source: AgentDefinitionSource,
  filePath?: string,
): AgentDefinition {
  // 1단계: 프론트매터와 본문 분리
  const { frontmatter: rawFrontmatter, body } = parseYamlFrontmatter(content);

  // 프론트매터가 비어있으면 에러 (에이전트 정의에는 최소한 name과 description이 필요)
  if (Object.keys(rawFrontmatter).length === 0) {
    throw new AgentDefinitionLoadError("Agent file missing frontmatter", {
      path: filePath,
    });
  }

  // 2단계: Zod 스키마로 프론트매터 유효성 검증
  const parseResult = agentDefinitionSchema.safeParse(rawFrontmatter);
  if (!parseResult.success) {
    throw new AgentDefinitionLoadError(
      `Invalid agent frontmatter: ${parseResult.error.issues.map((i) => i.message).join(", ")}`,
      {
        path: filePath,
        issues: parseResult.error.issues,
      },
    );
  }

  // 3단계: 검증된 데이터로 AgentDefinition 객체 구성
  return {
    frontmatter: parseResult.data,
    systemPrompt: body, // 프론트매터 아래 본문이 시스템 프롬프트가 됨
    source,
    filePath,
  };
}

/**
 * 특정 디렉토리에서 모든 에이전트 정의 파일(.md)을 로드합니다.
 *
 * 디렉토리 내의 .md 파일을 하나씩 읽어 파싱하며,
 * 파싱에 실패한 파일은 조용히 건너뜁니다 (치명적 에러 아님).
 *
 * @param directory - 에이전트 정의 파일이 있는 디렉토리 경로
 * @param source - 정의 출처 (우선순위 결정에 사용)
 * @returns 성공적으로 파싱된 에이전트 정의 배열
 */
async function loadFromDirectory(
  directory: string,
  source: AgentDefinitionSource,
): Promise<readonly AgentDefinition[]> {
  try {
    // 디렉토리 내 파일 목록 읽기
    const entries = await readdir(directory);
    // .md 파일만 필터링
    const mdFiles = entries.filter((f) => extname(f) === ".md");

    const definitions: AgentDefinition[] = [];

    for (const file of mdFiles) {
      const filePath = join(directory, file);
      try {
        // 일반 파일인지 확인 (디렉토리나 심볼릭 링크 제외)
        const fileStat = await stat(filePath);
        if (!fileStat.isFile()) continue;

        // 파일 내용을 읽어 파싱
        const content = await readFile(filePath, "utf-8");
        const definition = parseAgentFile(content, source, filePath);
        definitions.push(definition);
      } catch {
        // 개별 파일 파싱 실패는 치명적이지 않음 — 건너뛰고 계속 진행
      }
    }

    return definitions;
  } catch (error) {
    // 디렉토리가 존재하지 않으면 빈 배열 반환 (정상적인 상황)
    if (
      error instanceof Error &&
      "code" in error &&
      (error as NodeJS.ErrnoException).code === "ENOENT"
    ) {
      return [];
    }
    // 다른 에러도 빈 배열로 처리 (에이전트 정의 로딩 실패가 전체 앱을 멈추면 안 됨)
    return [];
  }
}

/**
 * 모든 설정 디렉토리에서 에이전트 정의를 로드합니다.
 *
 * 로드 순서 (낮은 우선순위 → 높은 우선순위):
 * 1. 사용자 전역: ~/.dhelix/agents/*.md (우선순위 낮음)
 * 2. 프로젝트 단위: .dhelix/agents/*.md (우선순위 높음)
 *
 * 같은 이름(name)의 에이전트 정의가 여러 곳에 있으면,
 * 높은 우선순위 소스의 정의가 낮은 우선순위를 덮어씁니다.
 * → 프로젝트 단위 정의가 사용자 전역 정의를 오버라이드합니다.
 *
 * @param workingDirectory - 프로젝트 작업 디렉토리
 * @returns 에이전트 이름을 키로 하는 Map (이름 → AgentDefinition)
 */
export async function loadAgentDefinitions(
  workingDirectory: string,
): Promise<Map<string, AgentDefinition>> {
  const result = new Map<string, AgentDefinition>();

  // 1단계: 사용자 전역 에이전트 로드 (~/.dhelix/agents/) — 낮은 우선순위
  const userAgentsDir = join(homedir(), `.${APP_NAME}`, "agents");
  const userDefinitions = await loadFromDirectory(userAgentsDir, "user");
  for (const def of userDefinitions) {
    result.set(def.frontmatter.name, def);
  }

  // 2단계: 프로젝트 에이전트 로드 (.dhelix/agents/) — 높은 우선순위 (같은 이름이면 덮어씀)
  const projectAgentsDir = join(workingDirectory, `.${APP_NAME}`, "agents");
  const projectDefinitions = await loadFromDirectory(projectAgentsDir, "project");
  for (const def of projectDefinitions) {
    result.set(def.frontmatter.name, def);
  }

  return result;
}
