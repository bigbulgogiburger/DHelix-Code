/**
 * 인스트럭션 로더 — 다층 계층 구조에서 DHELIX.md 인스트럭션을 로드하고 병합
 *
 * 인스트럭션(지시사항)은 LLM의 시스템 프롬프트에 주입되어
 * AI의 행동 방식을 커스터마이징합니다.
 *
 * 병합 순서 (낮은 → 높은 우선순위):
 * 1. 전역 사용자 인스트럭션 (~/.dhelix/DHELIX.md)
 * 2. 전역 사용자 규칙 (~/.dhelix/rules/*.md)
 * 3. 상위 디렉토리 DHELIX.md (cwd에서 프로젝트 루트까지 상향 탐색)
 * 4. 프로젝트 인스트럭션 (DHELIX.md 또는 .dhelix/DHELIX.md)
 * 5. 프로젝트 경로 조건부 규칙 (.dhelix/rules/*.md)
 * 6. 로컬 오버라이드 (DHELIX.local.md — gitignore 대상)
 *
 * 각 레이어는 '\n\n---\n\n'으로 구분되어 합쳐집니다.
 */

import { readFile, readdir, stat, realpath } from "node:fs/promises";
import { join, dirname, relative } from "node:path";
import { homedir } from "node:os";
import { PROJECT_CONFIG_FILE, APP_NAME } from "../constants.js";
import { parseInstructions } from "./parser.js";
import { type PathRule, collectMatchingContent } from "./path-matcher.js";
import { BaseError } from "../utils/error.js";
import { matchPath } from "./path-matcher.js";

/**
 * 인스트럭션 로딩 에러
 */
export class InstructionLoadError extends BaseError {
  constructor(message: string, context: Record<string, unknown> = {}) {
    super(message, "INSTRUCTION_LOAD_ERROR", context);
  }
}

/**
 * 로드된 인스트럭션 결과 — 각 레이어별 내용과 최종 합산 내용을 포함
 */
export interface LoadedInstructions {
  /** 전역 사용자 인스트럭션 (~/.dhelix/DHELIX.md에서 로드) */
  readonly globalInstructions: string;
  /** 전역 사용자 규칙 (~/.dhelix/rules/*.md에서 로드) */
  readonly globalRules: string;
  /** 상위 디렉토리 DHELIX.md 파일들 (cwd에서 프로젝트 루트까지 수집) */
  readonly parentInstructions: string;
  /** 프로젝트 레벨 인스트럭션 (DHELIX.md에서 로드) */
  readonly projectInstructions: string;
  /** 경로 조건부 규칙 내용 (.dhelix/rules/*.md에서 현재 경로에 매칭된 것) */
  readonly pathRules: string;
  /** 로컬 오버라이드 인스트럭션 (DHELIX.local.md, gitignore 대상) */
  readonly localInstructions: string;
  /** 모든 레이어를 합산한 최종 인스트럭션 텍스트 (시스템 프롬프트에 주입) */
  readonly combined: string;
}

/**
 * 인스트럭션 로딩 옵션
 */
export interface LoadInstructionsOptions {
  /** 특정 규칙 파일을 제외할 glob 패턴 (예: ["test-*.md"]) */
  readonly excludePatterns?: readonly string[];
}

/**
 * 파일을 안전하게 읽는 유틸리티 — 파일이 없으면 빈 문자열 반환
 *
 * 심볼릭 링크(symlink)를 해석하여 실제 파일을 읽습니다.
 * 여러 프로젝트에서 공유 인스트럭션 파일을 심볼릭 링크로 연결할 수 있습니다.
 *
 * @param filePath - 읽을 파일 경로
 * @returns 파일 내용 또는 빈 문자열 (파일 없음/읽기 실패)
 */
async function safeReadFile(filePath: string): Promise<string> {
  try {
    // 심볼릭 링크를 해석하여 실제 파일 경로를 얻음
    const resolvedPath = await realpath(filePath);
    return await readFile(resolvedPath, "utf-8");
  } catch {
    return "";
  }
}

/**
 * 파일명이 제외 패턴과 일치하는지 확인
 *
 * @param fileName - 확인할 파일명
 * @param excludePatterns - 제외할 glob 패턴 배열
 * @returns 패턴 중 하나라도 일치하면 true (이 파일을 건너뛰어야 함)
 */
function isExcluded(fileName: string, excludePatterns: readonly string[]): boolean {
  if (excludePatterns.length === 0) return false;
  return excludePatterns.some((pattern) => matchPath(fileName, pattern));
}

/**
 * 프로젝트 루트 디렉토리를 찾기 위해 상향 탐색
 *
 * 현재 디렉토리에서 시작하여 파일 시스템 루트까지 올라가며
 * 프로젝트 루트 마커를 검색합니다.
 *
 * 탐지 순서 (디렉토리당, 첫 매칭 적용):
 * 1. DHELIX.md — 프로젝트 루트에 직접 위치 (권장 방식)
 * 2. .dhelix/DHELIX.md — 하위 호환 폴백
 * 3. .dhelix/ 디렉토리 존재 — DHELIX.md 없이도 프로젝트 표시
 *
 * @param startDir - 탐색 시작 디렉토리
 * @returns 프로젝트 루트 경로 또는 null (찾지 못한 경우)
 */
async function findProjectRoot(startDir: string): Promise<string | null> {
  let current = startDir;
  const root = dirname(current) === current ? current : undefined;

  while (true) {
    // 1. DHELIX.md가 루트에 직접 있는지 확인 (권장 방식)
    const rootConfigPath = join(current, PROJECT_CONFIG_FILE);
    try {
      await stat(rootConfigPath);
      return current;
    } catch {
      // 이 디렉토리에는 없음, 폴백 확인
    }

    // 2. .dhelix/DHELIX.md 확인 (하위 호환)
    const fallbackConfigPath = join(current, `.${APP_NAME}`, PROJECT_CONFIG_FILE);
    try {
      await stat(fallbackConfigPath);
      return current;
    } catch {
      // .dhelix/ 내에도 없음
    }

    // 3. .dhelix/ 디렉토리 자체가 있는지 확인 (프로젝트 표시 역할)
    const configDir = join(current, `.${APP_NAME}`);
    try {
      const dirStat = await stat(configDir);
      if (dirStat.isDirectory()) {
        return current;
      }
    } catch {
      // .dhelix/ 디렉토리 없음
    }

    // 상위 디렉토리로 이동
    const parent = dirname(current);
    if (parent === current || parent === root) {
      return null; // 파일 시스템 루트에 도달 — 프로젝트 루트 없음
    }
    current = parent;
  }
}

/**
 * cwd에서 프로젝트 루트까지 상향 탐색하며 DHELIX.md 파일 수집
 *
 * 프로젝트 루트의 DHELIX.md는 별도로 로드되므로 여기서 제외합니다.
 * 결과는 가장 먼 조상부터 가장 가까운 부모 순서로 정렬됩니다.
 * (낮은 우선순위 → 높은 우선순위)
 *
 * @param startDir - 탐색 시작 디렉토리 (보통 cwd)
 * @param projectRoot - 프로젝트 루트 경로 (여기서 멈춤)
 * @param excludePatterns - 제외할 패턴 배열
 * @returns 상위 디렉토리 DHELIX.md 내용을 합산한 문자열
 */
async function loadParentInstructions(
  startDir: string,
  projectRoot: string | null,
  excludePatterns: readonly string[],
): Promise<string> {
  if (isExcluded(PROJECT_CONFIG_FILE, excludePatterns)) return "";

  const parentContents: string[] = [];
  let current = dirname(startDir);

  while (true) {
    // 프로젝트 루트에 도달하면 중단 (프로젝트 루트는 별도 처리)
    if (projectRoot && current === projectRoot) break;

    const parent = dirname(current);
    if (parent === current) break; // 파일 시스템 루트에 도달

    const configPath = join(current, PROJECT_CONFIG_FILE);
    const content = await safeReadFile(configPath);
    if (content) {
      // @import 지시어 해석 포함
      const parsed = await parseInstructions(content, current);
      if (parsed) {
        // unshift로 앞에 추가하여 먼 조상이 먼저 오도록 정렬
        parentContents.unshift(parsed);
      }
    }

    current = parent;
  }

  return parentContents.filter(Boolean).join("\n\n");
}

/**
 * 프론트매터 블록 매칭 정규식 — 파일 시작의 --- ... --- 영역
 */
const FRONTMATTER_REGEX = /^---\s*\n([\s\S]*?)\n---/;

/**
 * 규칙 파일의 프론트매터에서 경로 패턴을 추출
 *
 * 지원 형식:
 * 1. 다중 경로 (권장):
 *    paths:
 *      - "src/components/**"
 *      - "src/pages/**"
 *
 * 2. 단일 경로 (레거시):
 *    pattern: "src/**"
 *
 * paths가 있으면 pattern보다 우선합니다.
 * 프론트매터가 없거나 패턴이 없으면 "**"(모든 경로 매칭)을 사용합니다.
 *
 * @param content - 규칙 파일의 전체 내용
 * @returns 경로 패턴 배열과 프론트매터를 제외한 규칙 본문
 */
function parseFrontmatterPatterns(content: string): {
  readonly patterns: readonly string[];
  readonly ruleContent: string;
} {
  const frontmatterMatch = content.match(FRONTMATTER_REGEX);

  // 프론트매터가 없으면 모든 경로에 적용 (기본 ***)
  if (!frontmatterMatch) {
    return { patterns: ["**"], ruleContent: content };
  }

  const frontmatterBody = frontmatterMatch[1];
  // 프론트매터 이후의 내용이 실제 규칙 본문
  const ruleContent = content.slice(frontmatterMatch[0].length).trim();

  // paths: 배열 형식 추출 시도 (우선)
  const pathsMatch = frontmatterBody.match(/paths:\s*\n((?:\s*-\s*"?[^"\n]+"?\s*\n?)+)/);
  if (pathsMatch) {
    const pathLines = pathsMatch[1];
    const patterns: string[] = [];
    const lineRegex = /\s*-\s*"?([^"\n]+?)"?\s*$/gm;
    let lineMatch: RegExpExecArray | null;
    while ((lineMatch = lineRegex.exec(pathLines)) !== null) {
      const trimmed = lineMatch[1].trim();
      if (trimmed) {
        patterns.push(trimmed);
      }
    }
    if (patterns.length > 0) {
      return { patterns, ruleContent };
    }
  }

  // 레거시 단일 pattern: 필드 폴백
  const patternMatch = frontmatterBody.match(/pattern:\s*"?([^"\n]+?)"?\s*$/m);
  if (patternMatch) {
    return { patterns: [patternMatch[1].trim()], ruleContent };
  }

  // 프론트매터는 있지만 경로 패턴 없음 — 모든 경로 매칭
  return { patterns: ["**"], ruleContent };
}

/**
 * rules 디렉토리에서 경로 기반 규칙 파일(*.md)을 로드
 *
 * 각 .md 파일의 프론트매터에서 경로 패턴을 추출하고,
 * 본문을 규칙 내용으로 파싱합니다.
 *
 * @param rulesDir - 규칙 파일이 있는 디렉토리 경로
 * @param excludePatterns - 제외할 파일명 패턴
 * @returns 파싱된 PathRule 배열
 */
async function loadPathRules(
  rulesDir: string,
  excludePatterns: readonly string[] = [],
): Promise<readonly PathRule[]> {
  try {
    const entries = await readdir(rulesDir);
    const rules: PathRule[] = [];

    for (const entry of entries) {
      // .md 파일만 처리
      if (!entry.endsWith(".md")) continue;
      // 제외 패턴에 매칭되면 건너뜀
      if (isExcluded(entry, excludePatterns)) continue;

      const filePath = join(rulesDir, entry);
      const fileStat = await stat(filePath);
      if (!fileStat.isFile()) continue;

      const content = await readFile(filePath, "utf-8");
      const { patterns, ruleContent } = parseFrontmatterPatterns(content);

      rules.push({
        patterns,
        content: ruleContent,
        description: entry.replace(/\.md$/, ""), // 파일명에서 확장자 제거하여 설명으로 사용
      });
    }

    return rules;
  } catch {
    // 디렉토리가 없거나 읽기 실패 시 빈 배열 반환
    return [];
  }
}

/**
 * 인스트럭션 로더 메인 함수 — 6개 레이어에서 인스트럭션을 수집하고 합산
 *
 * 병합 순서 (낮은 → 높은 우선순위):
 * 1. 전역 인스트럭션 (~/.dhelix/DHELIX.md) — 모든 프로젝트에 적용
 * 2. 전역 규칙 (~/.dhelix/rules/*.md) — 경로 조건부 전역 규칙
 * 3. 상위 디렉토리 DHELIX.md — 모노레포 등 중첩 프로젝트 지원
 * 4. 프로젝트 인스트럭션 (DHELIX.md) — 프로젝트 고유 지시사항
 * 5. 프로젝트 규칙 (.dhelix/rules/*.md) — 경로 조건부 프로젝트 규칙
 * 6. 로컬 오버라이드 (DHELIX.local.md) — 개인 설정 (gitignore)
 *
 * @param workingDirectory - 현재 작업 디렉토리
 * @param options - 로딩 옵션 (제외 패턴 등)
 * @returns 각 레이어별 내용과 합산된 최종 인스트럭션
 */
export async function loadInstructions(
  workingDirectory: string,
  options?: LoadInstructionsOptions,
): Promise<LoadedInstructions> {
  const excludePatterns = options?.excludePatterns ?? [];
  const globalDir = join(homedir(), `.${APP_NAME}`);

  // 레이어 1: 전역 사용자 인스트럭션 (~/.dhelix/DHELIX.md)
  let globalInstructions = "";
  if (!isExcluded(PROJECT_CONFIG_FILE, excludePatterns)) {
    const globalConfigPath = join(globalDir, PROJECT_CONFIG_FILE);
    const globalRaw = await safeReadFile(globalConfigPath);
    globalInstructions = globalRaw ? await parseInstructions(globalRaw, globalDir) : "";
  }

  // 레이어 2: 전역 사용자 규칙 (~/.dhelix/rules/*.md)
  const globalRulesDir = join(globalDir, "rules");
  const globalPathRules = await loadPathRules(globalRulesDir, excludePatterns);
  const globalRules = collectMatchingContent(globalPathRules, workingDirectory);

  // 프로젝트 루트 탐색 (상향)
  const projectRoot = await findProjectRoot(workingDirectory);

  // 레이어 3: 상위 디렉토리 DHELIX.md (cwd와 프로젝트 루트 사이)
  const parentInstructions = await loadParentInstructions(
    workingDirectory,
    projectRoot,
    excludePatterns,
  );

  // 레이어 4: 프로젝트 루트 DHELIX.md (+ .dhelix/DHELIX.md 폴백)
  let projectInstructions = "";
  if (projectRoot && !isExcluded(PROJECT_CONFIG_FILE, excludePatterns)) {
    // 기본: DHELIX.md (프로젝트 루트에 직접)
    const rootConfigPath = join(projectRoot, PROJECT_CONFIG_FILE);
    let rawContent = await safeReadFile(rootConfigPath);

    // 폴백: .dhelix/DHELIX.md (하위 호환)
    if (!rawContent) {
      const fallbackPath = join(projectRoot, `.${APP_NAME}`, PROJECT_CONFIG_FILE);
      rawContent = await safeReadFile(fallbackPath);
    }

    if (rawContent) {
      projectInstructions = await parseInstructions(rawContent, projectRoot);
    }
  }

  // 레이어 5: 프로젝트 경로 조건부 규칙 (.dhelix/rules/*.md)
  const configDir = join(workingDirectory, `.${APP_NAME}`);
  const rulesDir = join(configDir, "rules");
  const pathRules = await loadPathRules(rulesDir, excludePatterns);
  let pathRulesContent = collectMatchingContent(pathRules, workingDirectory);

  // 프로젝트 루트가 cwd와 다를 경우, 프로젝트 루트의 규칙도 로드
  if (projectRoot) {
    const projectRulesDir = join(projectRoot, `.${APP_NAME}`, "rules");
    const projectRules = await loadPathRules(projectRulesDir, excludePatterns);
    const projectPathRulesContent = collectMatchingContent(projectRules, workingDirectory);
    pathRulesContent = [pathRulesContent, projectPathRulesContent].filter(Boolean).join("\n\n");
  }

  // 레이어 6: 로컬 오버라이드 (DHELIX.local.md — 개인 설정, gitignore 대상)
  let localInstructions = "";
  if (projectRoot) {
    const localFileName = `${APP_NAME.toUpperCase()}.local.md`;
    if (!isExcluded(localFileName, excludePatterns)) {
      const localPath = join(projectRoot, localFileName);
      const localRaw = await safeReadFile(localPath);
      if (localRaw) {
        localInstructions = await parseInstructions(localRaw, projectRoot);
      }
    }
  }

  // 모든 레이어를 순서대로 합산 — 빈 레이어는 제외
  const parts = [
    globalInstructions,
    globalRules,
    parentInstructions,
    projectInstructions,
    pathRulesContent,
    localInstructions,
  ].filter(Boolean);

  return {
    globalInstructions,
    globalRules,
    parentInstructions,
    projectInstructions,
    pathRules: pathRulesContent,
    localInstructions,
    combined: parts.join("\n\n---\n\n"), // 각 레이어를 수평선으로 구분
  };
}

/**
 * 지연(Lazy) 인스트럭션 로더 — 파일 접근 시 해당 디렉토리의 DHELIX.md를 온디맨드 로드
 *
 * 시작 시 모든 인스트럭션을 로드하는 대신, 도구가 특정 파일에 접근할 때
 * 해당 디렉토리의 DHELIX.md를 그때 로드합니다.
 *
 * 이를 통해 대규모 프로젝트에서 불필요한 인스트럭션 로딩을 방지하고,
 * 실제로 작업하는 디렉토리의 규칙만 적용할 수 있습니다.
 *
 * 결과는 디렉토리별로 캐시되어, 같은 디렉토리 접근 시 재로딩하지 않습니다.
 */
export class LazyInstructionLoader {
  /** 디렉토리 → 인스트럭션 내용 캐시 (중복 로딩 방지) */
  private readonly cache = new Map<string, string>();
  /** 프로젝트 루트 경로 (탐색 상한선) */
  private readonly projectRoot: string;

  /**
   * @param projectRoot - 프로젝트 루트 경로 (이 위로는 탐색하지 않음)
   */
  constructor(projectRoot: string) {
    this.projectRoot = projectRoot;
  }

  /**
   * 특정 파일 경로에 관련된 인스트럭션을 수집
   *
   * 파일의 디렉토리에서 프로젝트 루트까지 상향 탐색하며,
   * 각 디렉토리의 DHELIX.md 내용을 수집합니다.
   *
   * 결과 순서: 가장 가까운 디렉토리 → 프로젝트 루트 (가까운 것이 먼저)
   *
   * @param filePath - 인스트럭션을 검색할 대상 파일 경로
   * @returns 수집된 인스트럭션을 합산한 문자열
   */
  async getInstructionsForFile(filePath: string): Promise<string> {
    const normalizedFile = filePath.replace(/\\/g, "/");
    const normalizedRoot = this.projectRoot.replace(/\\/g, "/");

    // 파일이 프로젝트 루트 내에 있는지 확인
    const rel = relative(normalizedRoot, normalizedFile);
    if (rel.startsWith("..") || rel.startsWith("/")) {
      return ""; // 프로젝트 외부 파일은 인스트럭션 없음
    }

    const instructions: string[] = [];
    let current = dirname(normalizedFile);

    while (true) {
      // 프로젝트 루트 위로 나가면 중단
      const relDir = relative(normalizedRoot, current);
      if (relDir.startsWith("..") || relDir.startsWith("/")) {
        break;
      }

      // 현재 디렉토리의 DHELIX.md 로드 (캐시 활용)
      const dirInstructions = await this.loadDirectoryInstructions(current);
      if (dirInstructions) {
        instructions.push(dirInstructions);
      }

      // 프로젝트 루트에 도달하면 중단
      if (current === normalizedRoot || current === this.projectRoot) {
        break;
      }

      const parent = dirname(current);
      if (parent === current) break; // 파일 시스템 루트
      current = parent;
    }

    return instructions.filter(Boolean).join("\n\n");
  }

  /**
   * 특정 디렉토리의 캐시된 인스트럭션을 무효화
   *
   * DHELIX.md가 수정되었을 때 호출하여 다음 접근 시 재로딩되도록 합니다.
   *
   * @param dirPath - 캐시를 무효화할 디렉토리 경로
   */
  invalidate(dirPath: string): void {
    const normalized = dirPath.replace(/\\/g, "/");
    this.cache.delete(normalized);
  }

  /**
   * 모든 캐시된 인스트럭션을 삭제
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * 특정 디렉토리의 DHELIX.md를 로드 (캐시가 있으면 캐시 반환)
   *
   * @param dirPath - DHELIX.md를 검색할 디렉토리 경로
   * @returns 파싱된 인스트럭션 내용 (파일이 없으면 빈 문자열)
   */
  private async loadDirectoryInstructions(dirPath: string): Promise<string> {
    const normalized = dirPath.replace(/\\/g, "/");

    // 캐시에 있으면 즉시 반환 (디스크 I/O 없음)
    if (this.cache.has(normalized)) {
      return this.cache.get(normalized)!;
    }

    const configPath = join(dirPath, PROJECT_CONFIG_FILE);
    const content = await safeReadFile(configPath);

    let parsed = "";
    if (content) {
      // @import 지시어 해석 포함
      parsed = await parseInstructions(content, dirPath);
    }

    // 결과를 캐시에 저장 (빈 문자열도 캐시하여 반복 디스크 접근 방지)
    this.cache.set(normalized, parsed);
    return parsed;
  }
}
