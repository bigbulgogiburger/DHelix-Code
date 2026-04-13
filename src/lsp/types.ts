/**
 * LSP 서브시스템 타입 정의
 * DHelix Code의 LSP on-demand 통합을 위한 인터페이스
 */

/** 지원하는 LSP 언어 식별자 */
export type LSPLanguageId = "typescript" | "python" | "go" | "rust" | "java";

/** 언어 서버 설정 */
export interface LSPServerConfig {
  readonly language: LSPLanguageId;
  readonly command: string;
  readonly args: readonly string[];
  readonly initializationOptions?: Record<string, unknown>;
}

/** 서버 인스턴스 상태 */
export type LSPServerState =
  | "starting"
  | "ready"
  | "running"
  | "error"
  | "stopping"
  | "stopped"
  | "shutdown";

/** 서버 인스턴스 정보 */
export interface LSPServerInstance {
  readonly language: LSPLanguageId;
  readonly state: LSPServerState;
  readonly pid: number | undefined;
  readonly startedAt: number;
  readonly lastUsedAt: number;
}

/** 정의 위치 결과 */
export interface DefinitionResult {
  readonly filePath: string;
  readonly line: number; // 1-based
  readonly column: number; // 1-based
  readonly endLine?: number;
  readonly endColumn?: number;
  readonly preview: string; // 해당 줄의 코드
}

/** 참조 위치 결과 */
export interface ReferenceResult {
  readonly filePath: string;
  readonly line: number;
  readonly column: number;
  readonly context: string; // 주변 코드 컨텍스트
  readonly isDefinition: boolean;
}

/** 타입 정보 결과 */
export interface TypeInfoResult {
  readonly type: string;
  readonly documentation?: string;
  readonly signature?: string;
}

/** 리네이밍 텍스트 편집 */
export interface RenameTextEdit {
  readonly startLine: number;
  readonly startColumn: number;
  readonly endLine: number;
  readonly endColumn: number;
  readonly newText: string;
}

/** 리네이밍 편집 결과 */
export interface RenameEdit {
  readonly filePath: string;
  readonly edits: readonly RenameTextEdit[];
}

/** LSP 세션 인터페이스 — 도구에서 사용 */
export interface LSPSession {
  readonly language: LSPLanguageId;
  readonly state: LSPServerState;

  /** 심볼 정의로 이동 */
  gotoDefinition(
    filePath: string,
    line: number,
    column: number,
  ): Promise<readonly DefinitionResult[]>;

  /** 심볼 참조 찾기 */
  findReferences(
    filePath: string,
    line: number,
    column: number,
    includeDeclaration?: boolean,
  ): Promise<readonly ReferenceResult[]>;

  /** 타입 정보 조회 */
  getTypeInfo(filePath: string, line: number, column: number): Promise<TypeInfoResult | undefined>;

  /** 심볼 리네이밍 */
  rename(
    filePath: string,
    line: number,
    column: number,
    newName: string,
  ): Promise<readonly RenameEdit[]>;

  /** 문서를 서버에 열기 (자동 호출됨) */
  openDocument(filePath: string): Promise<void>;

  /** 문서 닫기 */
  closeDocument(filePath: string): Promise<void>;
}

/** LSP 매니저 인터페이스 */
export interface LSPManagerInterface {
  /** 프로젝트에서 사용 가능한 LSP 서버 확인 */
  detectAvailableServers(projectDir: string): Promise<readonly LSPLanguageId[]>;

  /** LSP 세션 획득 (서버 자동 시작) */
  acquire(language: LSPLanguageId, projectDir: string): Promise<LSPSession>;

  /** 모든 서버 상태 조회 */
  getServerStatus(): readonly LSPServerInstance[];

  /** 유휴 서버 정리 */
  cleanup(): Promise<void>;

  /** 전체 종료 */
  dispose(): Promise<void>;
}

/** LSP 매니저 설정 */
export interface LSPManagerConfig {
  readonly idleTimeoutMs?: number; // 기본: 5분
  readonly maxServers?: number; // 기본: 3
  readonly startupTimeoutMs?: number; // 기본: 30초
  readonly requestTimeoutMs?: number; // 기본: 10초
}
