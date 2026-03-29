/**
 * 메모리 매니저 — 프로젝트별 메모리의 로드, 저장, 조회를 관리하는 중앙 클래스
 *
 * 하위 모듈(loader, writer, paths)의 기능을 하나의 인터페이스로 통합합니다.
 * 프로젝트당 하나의 인스턴스를 생성하여 사용합니다.
 *
 * 메모리 저장 위치: ~/.dhelix/projects/{프로젝트해시}/memory/
 * 프로젝트해시 = SHA-256(절대프로젝트경로).slice(0, 16)
 *
 * 사용 예시:
 * const memory = new MemoryManager('/path/to/project');
 * const loaded = await memory.loadMemory();     // 세션 시작 시
 * await memory.appendMemory({ topic: 'debug', content: '...' }); // 학습 시
 * await memory.clearMemory();                   // 초기화
 */

import { readFile, readdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { loadProjectMemory, loadTopicMemory, listTopicFiles } from "./loader.js";
import { appendMemory, saveMemory, writeTopicFile, clearMemory } from "./writer.js";
import { getMemoryDir, getMemoryFilePath, computeProjectHash } from "./paths.js";
import type { MemoryConfig, MemoryEntry, MemoryLoadResult, MemorySearchResult } from "./types.js";
import { CONFIG_DIR, MEMORY_DIR } from "../constants.js";
import { joinPath } from "../utils/path.js";

/**
 * 기본 메모리 설정값
 */
const DEFAULT_CONFIG: MemoryConfig = {
  maxLoadLines: 200, // 세션 시작 시 로드할 최대 줄 수
  maxMemoryLines: 200, // MEMORY.md 최대 줄 수 (초과 시 overflow)
  projectsBaseDir: joinPath(CONFIG_DIR, "projects"), // 프로젝트 메모리 기본 디렉토리
};

/**
 * MemoryManager 클래스 — 프로젝트 메모리의 CRUD 작업을 관리
 *
 * 이 클래스는 하위 모듈의 함수들을 래핑하여:
 * - projectRoot를 매번 전달할 필요 없이 생성 시 한 번만 설정
 * - 설정(config)을 중앙에서 관리
 * - 일관된 API를 제공
 */
export class MemoryManager {
  /** 메모리 시스템 설정 (읽기 전용) */
  readonly config: MemoryConfig;
  /** 이 매니저가 관리하는 프로젝트의 루트 경로 */
  private readonly projectRoot: string;

  /**
   * @param projectRoot - 프로젝트 루트의 절대 경로
   * @param config - 메모리 설정 오버라이드 (지정하지 않으면 기본값 사용)
   */
  constructor(projectRoot: string, config?: Partial<MemoryConfig>) {
    this.projectRoot = projectRoot;
    // 기본값에 사용자 설정을 스프레드로 병합
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * 프로젝트 메모리 로드 (MEMORY.md의 처음 maxLoadLines 줄)
   *
   * 세션 시작 시 호출하여 시스템 프롬프트에 주입합니다.
   *
   * @returns 메모리 로드 결과 (내용, 경로, 존재 여부, 토픽 파일 목록)
   */
  async loadMemory(): Promise<MemoryLoadResult> {
    return loadProjectMemory(this.projectRoot, this.config.maxLoadLines);
  }

  /**
   * MEMORY.md 전체 내용을 덮어쓰기
   *
   * 대량 업데이트나 메모리 재구성 시 사용합니다.
   *
   * @param content - 저장할 마크다운 내용
   */
  async saveMemory(content: string): Promise<void> {
    return saveMemory(this.projectRoot, content);
  }

  /**
   * 메모리에 새 항목 추가 (중복 제거 + 자동 overflow 포함)
   *
   * 같은 내용이 이미 있으면 중복으로 판단하여 건너뜁니다.
   * MEMORY.md가 maxMemoryLines를 초과하면 오래된 섹션을 토픽 파일로 분리합니다.
   *
   * @param entry - 추가할 메모리 항목 (토픽 + 내용)
   * @returns written: 실제로 기록되었는지, overflowed: overflow가 발생했는지
   */
  async appendMemory(
    entry: MemoryEntry,
  ): Promise<{ readonly written: boolean; readonly overflowed: boolean }> {
    return appendMemory(this.projectRoot, entry, this.config.maxMemoryLines);
  }

  /**
   * 사용 가능한 토픽 파일 목록 조회
   *
   * overflow로 분리된 토픽 파일들의 이름을 반환합니다.
   *
   * @returns 토픽 파일명 배열 (예: ["debugging.md", "patterns.md"])
   */
  async getTopicFiles(): Promise<readonly string[]> {
    return listTopicFiles(this.projectRoot);
  }

  /**
   * 특정 토픽 파일의 내용 읽기
   *
   * @param topic - 토픽 이름 또는 파일명
   * @returns 토픽 파일 내용 또는 null (파일 없음)
   */
  async readTopicFile(topic: string): Promise<string | null> {
    return loadTopicMemory(this.projectRoot, topic);
  }

  /**
   * 토픽 파일에 내용 쓰기
   *
   * 새 토픽 파일을 생성하거나 기존 파일을 덮어씁니다.
   *
   * @param topic - 토픽 이름
   * @param content - 저장할 마크다운 내용
   * @returns 정규화된 파일명 (예: "debugging.md")
   */
  async writeTopicFile(topic: string, content: string): Promise<string> {
    return writeTopicFile(this.projectRoot, topic, content);
  }

  /**
   * 이 프로젝트의 모든 메모리 삭제
   *
   * MEMORY.md를 비우고 모든 토픽 파일을 삭제합니다.
   * 주의: 이 작업은 되돌릴 수 없습니다.
   */
  async clearMemory(): Promise<void> {
    return clearMemory(this.projectRoot);
  }

  /**
   * 이 프로젝트의 해시값 반환
   *
   * 프로젝트 경로의 SHA-256 해시 앞 16자입니다.
   * 디버깅이나 메모리 디렉토리 직접 접근 시 유용합니다.
   *
   * @returns 16자 hex 문자열
   */
  getProjectHash(): string {
    return computeProjectHash(this.projectRoot);
  }

  /**
   * 이 프로젝트의 메모리 디렉토리 경로 반환
   *
   * @returns ~/.dhelix/projects/{해시}/memory/ 의 절대 경로
   */
  getMemoryDir(): string {
    return getMemoryDir(this.projectRoot);
  }

  /**
   * 이 프로젝트의 MEMORY.md 파일 경로 반환
   *
   * @returns MEMORY.md의 절대 경로
   */
  getMemoryFilePath(): string {
    return getMemoryFilePath(this.projectRoot);
  }

  /**
   * 프로젝트 + 전역 메모리에서 쿼리 문자열을 검색
   *
   * 검색 범위:
   * 1. 프로젝트 메모리 디렉토리 (MemoryManager의 projectRoot 기반)
   * 2. 전역 메모리 디렉토리 (~/.dhelix/memory/)
   *
   * 결과는 관련도(relevance) 점수 내림차순으로 정렬되며 최대 10건 반환합니다.
   *
   * @param query - 검색할 문자열 (공백으로 구분된 복수 키워드 지원)
   * @param projectDir - 프로젝트 디렉토리 경로 (기본: 생성 시 전달된 projectRoot)
   * @returns 관련도순 검색 결과 배열 (최대 10건)
   */
  async search(query: string, _projectDir?: string): Promise<readonly MemorySearchResult[]> {
    const results: MemorySearchResult[] = [];

    // 1. 프로젝트 메모리 검색
    const projectMemoryDir = this.getMemoryDir();
    await this.searchDirectory(projectMemoryDir, query, results);

    // 2. 전역 메모리 검색
    const globalMemoryDir = joinPath(
      CONFIG_DIR,
      MEMORY_DIR,
    );
    // 전역 디렉토리가 프로젝트 디렉토리와 다른 경우에만 검색 (중복 방지)
    if (globalMemoryDir !== projectMemoryDir) {
      await this.searchDirectory(globalMemoryDir, query, results);
    }

    // 3. 관련도순 정렬 후 상위 10건 반환
    return results
      .sort((a, b) => b.relevance - a.relevance)
      .slice(0, 10);
  }

  /**
   * 특정 디렉토리의 모든 .md 파일에서 쿼리를 검색
   *
   * 각 파일을 ## 섹션 단위로 분리하여 섹션별로 매칭합니다.
   * 매칭된 섹션은 주변 컨텍스트 줄과 함께 결과에 추가됩니다.
   *
   * @param dir - 검색할 디렉토리 경로
   * @param query - 검색 쿼리 문자열
   * @param results - 결과를 누적할 배열 (in-place 수정)
   */
  private async searchDirectory(
    dir: string,
    query: string,
    results: MemorySearchResult[],
  ): Promise<void> {
    if (!existsSync(dir)) return;

    let entries: string[];
    try {
      entries = await readdir(dir);
    } catch {
      return;
    }

    const mdFiles = entries.filter((e) => e.endsWith(".md")).sort();
    const keywords = query
      .toLowerCase()
      .split(/\s+/)
      .filter((k) => k.length > 0);

    if (keywords.length === 0) return;

    for (const file of mdFiles) {
      const filePath = joinPath(dir, file);
      let content: string;
      try {
        content = await readFile(filePath, "utf-8");
      } catch {
        continue;
      }

      // 섹션 단위로 분리하여 검색
      const sections = this.parseSectionsForSearch(content);

      for (const section of sections) {
        const lowerContent = section.body.toLowerCase();
        const lowerHeading = section.heading.toLowerCase();

        // 키워드별 매칭 계산
        let matchedKeywords = 0;
        let hasExactWordMatch = false;
        let hasCaseInsensitiveMatch = false;
        let hasSubstringMatch = false;

        for (const keyword of keywords) {
          // 정확한 단어 경계 매칭 (대소문자 무시)
          const wordBoundaryRegex = new RegExp(`\\b${escapeRegex(keyword)}\\b`, "i");
          if (wordBoundaryRegex.test(section.body) || wordBoundaryRegex.test(section.heading)) {
            matchedKeywords++;
            hasExactWordMatch = true;
          } else if (lowerContent.includes(keyword) || lowerHeading.includes(keyword)) {
            matchedKeywords++;
            hasCaseInsensitiveMatch = true;
          }

          // 부분 문자열 매칭 (키워드가 3자 이상일 때만)
          if (!hasExactWordMatch && !hasCaseInsensitiveMatch && keyword.length >= 3) {
            if (lowerContent.includes(keyword) || lowerHeading.includes(keyword)) {
              matchedKeywords++;
              hasSubstringMatch = true;
            }
          }
        }

        if (matchedKeywords === 0) continue;

        // 관련도 점수 계산
        let relevance: number;
        if (hasExactWordMatch) {
          relevance = 1.0;
        } else if (hasCaseInsensitiveMatch) {
          relevance = 0.8;
        } else if (hasSubstringMatch) {
          relevance = 0.5;
        } else {
          relevance = 0.3;
        }

        // 복수 키워드 매칭 보너스 (추가 키워드당 0.1, 최대 1.0)
        if (matchedKeywords > 1) {
          relevance = Math.min(1.0, relevance + (matchedKeywords - 1) * 0.1);
        }

        // 매칭된 줄 주변 컨텍스트 추출
        const contextContent = this.extractMatchContext(section.body, keywords);

        results.push({
          source: file,
          section: section.heading,
          content: contextContent,
          relevance,
        });
      }
    }
  }

  /**
   * 마크다운 내용을 ## 섹션 단위로 분리 (검색용)
   *
   * ## 헤더가 없는 내용은 "(top-level)" 섹션으로 취급합니다.
   *
   * @param content - 마크다운 파일 내용
   * @returns 섹션 배열 (heading + body)
   */
  private parseSectionsForSearch(
    content: string,
  ): readonly { readonly heading: string; readonly body: string }[] {
    const lines = content.split("\n");
    const sections: { heading: string; body: string }[] = [];
    let currentHeading = "";
    let currentLines: string[] = [];

    for (const line of lines) {
      const match = /^## (.+)$/.exec(line);
      if (match) {
        // 이전 섹션 저장
        if (currentLines.length > 0) {
          sections.push({
            heading: currentHeading,
            body: currentLines.join("\n"),
          });
        }
        currentHeading = match[1];
        currentLines = [line];
      } else {
        currentLines.push(line);
      }
    }

    // 마지막 섹션 저장
    if (currentLines.length > 0) {
      sections.push({
        heading: currentHeading,
        body: currentLines.join("\n"),
      });
    }

    return sections;
  }

  /**
   * 매칭된 키워드 주변 컨텍스트 줄 추출
   *
   * 각 매칭 줄의 앞뒤 1줄을 포함하여 컨텍스트를 제공합니다.
   * 줄이 너무 많으면 최대 10줄로 제한합니다.
   *
   * @param body - 섹션 본문
   * @param keywords - 소문자로 변환된 검색 키워드 배열
   * @returns 컨텍스트가 포함된 매칭 내용
   */
  private extractMatchContext(body: string, keywords: readonly string[]): string {
    const lines = body.split("\n");
    const matchedLineIndices = new Set<number>();

    for (let i = 0; i < lines.length; i++) {
      const lowerLine = lines[i].toLowerCase();
      for (const keyword of keywords) {
        if (lowerLine.includes(keyword)) {
          // 매칭 줄과 앞뒤 1줄 컨텍스트
          if (i > 0) matchedLineIndices.add(i - 1);
          matchedLineIndices.add(i);
          if (i < lines.length - 1) matchedLineIndices.add(i + 1);
          break;
        }
      }
    }

    if (matchedLineIndices.size === 0) {
      // 헤딩에서만 매칭된 경우 — 본문 처음 3줄 반환
      return lines.slice(0, 3).join("\n").trim();
    }

    const sortedIndices = [...matchedLineIndices].sort((a, b) => a - b);
    const contextLines = sortedIndices
      .slice(0, 10)
      .map((i) => lines[i]);

    return contextLines.join("\n").trim();
  }

  /**
   * 검색 가능한 토픽 인덱스 반환 (시스템 프롬프트 주입용)
   *
   * MEMORY.md와 토픽 파일들에서 ## 섹션 헤더를 추출하여
   * LLM이 어떤 주제의 메모리가 있는지 알 수 있게 합니다.
   *
   * @returns "Available memory topics: [topic1, topic2, ...]" 형식 문자열 또는 빈 문자열
   */
  async getSearchableTopics(): Promise<string> {
    const topics = new Set<string>();
    const memoryDir = this.getMemoryDir();

    if (!existsSync(memoryDir)) return "";

    let entries: string[];
    try {
      entries = await readdir(memoryDir);
    } catch {
      return "";
    }

    const mdFiles = entries.filter((e) => e.endsWith(".md")).sort();

    for (const file of mdFiles) {
      const filePath = joinPath(memoryDir, file);
      let content: string;
      try {
        content = await readFile(filePath, "utf-8");
      } catch {
        continue;
      }

      // ## 헤더에서 토픽 이름 추출
      const headingRegex = /^## (.+)$/gm;
      let match: RegExpExecArray | null;
      while ((match = headingRegex.exec(content)) !== null) {
        topics.add(match[1]);
      }

      // 토픽 파일명도 추가 (확장자 제외)
      if (file !== "MEMORY.md") {
        topics.add(file.replace(/\.md$/, ""));
      }
    }

    if (topics.size === 0) return "";

    const sortedTopics = [...topics].sort();
    return `Available memory topics: [${sortedTopics.join(", ")}]`;
  }
}

/**
 * 정규식 특수 문자를 이스케이프
 *
 * @param s - 이스케이프할 문자열
 * @returns 특수 문자가 이스케이프된 문자열
 */
function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
