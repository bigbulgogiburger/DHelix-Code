/**
 * 메모리 매니저 — 프로젝트별 메모리의 로드, 저장, 조회를 관리하는 중앙 클래스
 *
 * 하위 모듈(loader, writer, paths)의 기능을 하나의 인터페이스로 통합합니다.
 * 프로젝트당 하나의 인스턴스를 생성하여 사용합니다.
 *
 * 메모리 저장 위치: ~/.dbcode/projects/{프로젝트해시}/memory/
 * 프로젝트해시 = SHA-256(절대프로젝트경로).slice(0, 16)
 *
 * 사용 예시:
 * const memory = new MemoryManager('/path/to/project');
 * const loaded = await memory.loadMemory();     // 세션 시작 시
 * await memory.appendMemory({ topic: 'debug', content: '...' }); // 학습 시
 * await memory.clearMemory();                   // 초기화
 */

import { loadProjectMemory, loadTopicMemory, listTopicFiles } from "./loader.js";
import { appendMemory, saveMemory, writeTopicFile, clearMemory } from "./writer.js";
import { getMemoryDir, getMemoryFilePath, computeProjectHash } from "./paths.js";
import type { MemoryConfig, MemoryEntry, MemoryLoadResult } from "./types.js";
import { CONFIG_DIR } from "../constants.js";
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
   * @returns ~/.dbcode/projects/{해시}/memory/ 의 절대 경로
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
}
