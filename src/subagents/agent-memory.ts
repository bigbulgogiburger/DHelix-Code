/**
 * 에이전트 메모리 관리자 — 서브에이전트의 영속적(persistent) 메모리를 관리하는 모듈
 *
 * 서브에이전트는 일반적으로 실행이 끝나면 모든 컨텍스트가 사라집니다.
 * 이 모듈은 에이전트가 세션(대화) 간에 지식을 유지할 수 있도록
 * 파일 기반의 영속적 메모리 시스템을 제공합니다.
 *
 * 예를 들어 코드 리뷰 에이전트가 "이 프로젝트에서는 var 대신 const를 쓴다"는
 * 패턴을 학습하면, 다음 세션에서도 그 지식을 활용할 수 있습니다.
 *
 * 메모리 스코프(범위):
 * - user: 사용자 전역 (~/.dbcode/agent-memory/) — 모든 프로젝트에서 공유
 * - project: 프로젝트 단위 (.dbcode/agent-memory/) — 해당 프로젝트에서만 사용
 * - local: 로컬 전용 (.dbcode/agent-memory-local/) — Git에 커밋하지 않는 개인 메모리
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { homedir } from "node:os";
import { getLogger } from "../utils/logger.js";

// ---------------------------------------------------------------------------
// 타입 정의
// ---------------------------------------------------------------------------

/** 에이전트 메모리의 저장 범위를 나타내는 타입 */
export type AgentMemoryScope = "user" | "project" | "local";

/** MEMORY.md에서 읽을 최대 줄 수 — 너무 길면 시스템 프롬프트가 비대해지므로 제한 */
const MEMORY_MAX_LINES = 200;

/** 에이전트가 자체 메모리를 관리하기 위해 필요한 도구 이름 목록 */
const REQUIRED_TOOLS = ["file_read", "file_write", "file_edit"] as const;

// ---------------------------------------------------------------------------
// AgentMemoryManager 클래스
// ---------------------------------------------------------------------------

/**
 * 특정 에이전트 유형의 영속적 메모리를 관리하는 클래스
 *
 * 각 에이전트는 자신만의 메모리 디렉토리를 가지며(스코프별 분리),
 * MEMORY.md 파일과 선택적으로 주제별 파일을 저장합니다.
 * 메모리 내용은 에이전트의 시스템 프롬프트에 주입되어
 * 이전 세션의 경험을 바탕으로 더 나은 결과를 만들 수 있습니다.
 *
 * 사용 흐름:
 * 1. initialize() — 메모리 디렉토리 생성
 * 2. readMemory() — 기존 메모리 읽기
 * 3. getMemoryPromptSection() — 시스템 프롬프트에 삽입할 텍스트 생성
 * 4. writeMemory() — 새로운 인사이트 저장
 */
export class AgentMemoryManager {
  /** 에이전트 이름 (디렉토리 이름으로 사용됨) */
  private readonly agentName: string;
  /** 메모리 저장 범위 (user, project, local) */
  private readonly scope: AgentMemoryScope;
  /** 작업 디렉토리 경로 (project/local 스코프에서 기준점) */
  private readonly workingDirectory: string;

  /**
   * @param agentName - 에이전트 이름 (예: "code-reviewer")
   * @param scope - 메모리 저장 범위
   * @param workingDirectory - 작업 디렉토리 (기본값: process.cwd())
   */
  constructor(agentName: string, scope: AgentMemoryScope, workingDirectory?: string) {
    this.agentName = agentName;
    this.scope = scope;
    this.workingDirectory = workingDirectory ?? process.cwd();
  }

  /**
   * 스코프에 따른 메모리 디렉토리 경로를 반환합니다.
   *
   * - user:    ~/.dbcode/agent-memory/{agent-name}/    (사용자 전역)
   * - project: .dbcode/agent-memory/{agent-name}/      (프로젝트 단위, Git 추적 가능)
   * - local:   .dbcode/agent-memory-local/{agent-name}/ (로컬 전용, Git 무시)
   *
   * @returns 메모리 디렉토리의 절대 경로
   */
  getMemoryDir(): string {
    switch (this.scope) {
      case "user":
        return join(homedir(), ".dbcode", "agent-memory", this.agentName);
      case "project":
        return join(this.workingDirectory, ".dbcode", "agent-memory", this.agentName);
      case "local":
        return join(this.workingDirectory, ".dbcode", "agent-memory-local", this.agentName);
    }
  }

  /**
   * 메모리 디렉토리를 생성합니다. (이미 존재하면 아무 작업도 하지 않음)
   * recursive: true 옵션으로 중간 디렉토리도 자동 생성합니다.
   */
  async initialize(): Promise<void> {
    const dir = this.getMemoryDir();
    try {
      await mkdir(dir, { recursive: true });
    } catch (error: unknown) {
      // 디렉토리 생성 실패는 치명적이지 않으므로 경고만 기록
      const logger = getLogger();
      logger.warn({ error: String(error), dir }, "Failed to create agent memory directory");
    }
  }

  /**
   * MEMORY.md 파일의 내용을 읽어 반환합니다 (최대 200줄).
   *
   * 200줄 제한은 시스템 프롬프트의 크기가 과도하게 커지는 것을 방지합니다.
   * 파일이 없거나 읽을 수 없으면 빈 문자열을 반환합니다 (에러 아님).
   *
   * @returns MEMORY.md의 내용 (최대 200줄) 또는 빈 문자열
   */
  async readMemory(): Promise<string> {
    const memoryPath = join(this.getMemoryDir(), "MEMORY.md");
    try {
      const content = await readFile(memoryPath, "utf-8");
      const lines = content.split("\n");
      // 200줄을 초과하면 앞부분만 반환
      if (lines.length > MEMORY_MAX_LINES) {
        return lines.slice(0, MEMORY_MAX_LINES).join("\n");
      }
      return content;
    } catch {
      // 파일이 아직 없거나 읽기 불가 — 정상적인 상황
      return "";
    }
  }

  /**
   * MEMORY.md 파일에 내용을 저장합니다. 파일이 없으면 새로 생성합니다.
   *
   * @param content - 저장할 메모리 내용 (마크다운 형식 권장)
   */
  async writeMemory(content: string): Promise<void> {
    const dir = this.getMemoryDir();
    // 디렉토리가 없을 수 있으므로 먼저 생성
    await mkdir(dir, { recursive: true });
    const memoryPath = join(dir, "MEMORY.md");
    await writeFile(memoryPath, content, "utf-8");
  }

  /**
   * 에이전트의 시스템 프롬프트에 삽입할 메모리 컨텍스트 섹션을 생성합니다.
   *
   * 이 텍스트가 서브에이전트의 시스템 프롬프트에 추가되면,
   * 에이전트는 이전 세션에서 축적한 지식을 참조하여 더 나은 결과를 낼 수 있습니다.
   *
   * @returns 시스템 프롬프트에 삽입할 메모리 섹션 텍스트
   */
  async getMemoryPromptSection(): Promise<string> {
    const dir = this.getMemoryDir();
    const content = await this.readMemory();

    // 메모리가 없으면 안내 메시지를 표시
    const memoryContent = content
      ? content
      : "No memory file yet. Create one to start building knowledge.";

    return [
      "# Agent Memory",
      "",
      `You have a persistent agent memory directory at \`${dir}\`. Its contents persist across conversations.`,
      "",
      "## How to use your memory:",
      "- Consult MEMORY.md before starting work for accumulated knowledge",
      "- Update MEMORY.md as you discover patterns and insights",
      "- Create topic-specific files for detailed notes",
      "- Keep MEMORY.md concise (under 200 lines)",
      "",
      "## Current MEMORY.md:",
      memoryContent,
    ].join("\n");
  }

  /**
   * 메모리 기능에 필요한 도구 이름 목록을 반환합니다.
   *
   * 에이전트가 자체적으로 메모리를 읽고 쓰려면
   * file_read, file_write, file_edit 도구가 필요합니다.
   *
   * @returns 필수 도구 이름 배열 (읽기 전용)
   */
  static getRequiredTools(): readonly string[] {
    return REQUIRED_TOOLS;
  }
}
