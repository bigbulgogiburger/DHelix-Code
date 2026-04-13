/**
 * SQLite 기반 세션 저장소 (Session Store)
 *
 * better-sqlite3를 사용하여 세션 메타데이터와 메시지를 SQLite에 저장합니다.
 * JSONL 기반 세션 저장소의 대안으로, 더 빠른 조회와 ACID 트랜잭션을 제공합니다.
 *
 * 주요 특징:
 * - WAL 모드로 동시 읽기/쓰기 지원
 * - 트랜잭션으로 데이터 무결성 보장
 * - 인메모리 모드(`:memory:`) 지원 (테스트용)
 * - ON DELETE CASCADE로 세션 삭제 시 관련 데이터 자동 정리
 *
 * 스키마:
 * - sessions: 세션 메타데이터 (ID, 제목, 모델, 상태 등)
 * - messages: 대화 메시지 (세션별 순서 보장)
 * - compaction_history: 컨텍스트 압축 이력
 */
import Database from "better-sqlite3";

/**
 * 세션 상태 — 세션의 현재 라이프사이클 단계
 * - active: 현재 사용 중인 세션
 * - completed: 완료된 세션
 * - archived: 보관된 세션
 */
export type SessionStatus = "active" | "completed" | "archived";

/**
 * SQLite에 저장되는 세션 레코드
 */
export interface SessionRecord {
  readonly id: string;
  readonly title: string | null;
  readonly model: string;
  readonly working_directory: string;
  readonly created_at: string;
  readonly updated_at: string;
  readonly message_count: number;
  readonly total_tokens: number;
  readonly status: SessionStatus;
}

/**
 * SQLite에 저장되는 메시지 레코드
 */
export interface MessageRecord {
  readonly id: number;
  readonly session_id: string;
  readonly sequence: number;
  readonly role: string;
  readonly content: string | null;
  readonly tool_calls: string | null;
  readonly tool_call_id: string | null;
  readonly tokens: number | null;
  readonly created_at: string;
}

/**
 * 컴팩션 이력 레코드
 */
export interface CompactionRecord {
  readonly id: number;
  readonly session_id: string;
  readonly original_tokens: number;
  readonly compacted_tokens: number;
  readonly removed_messages: number;
  readonly summary: string;
  readonly strategy: string;
  readonly created_at: string;
}

/**
 * 세션 생성 옵션
 */
export interface CreateSessionOptions {
  readonly id?: string;
  readonly title?: string;
  readonly model: string;
  readonly workingDirectory: string;
  readonly status?: SessionStatus;
}

/**
 * 세션 목록 조회 옵션
 */
export interface ListSessionsOptions {
  readonly status?: SessionStatus;
  readonly limit?: number;
  readonly offset?: number;
}

/**
 * 세션 저장소 인터페이스 — SQLite 및 JSONL 백엔드가 구현해야 하는 공통 계약
 */
export interface SessionStore {
  /** 새 세션 생성 */
  createSession(options: CreateSessionOptions): string;
  /** 세션 조회 */
  getSession(sessionId: string): SessionRecord | undefined;
  /** 세션 목록 조회 (최근 수정 순) */
  listSessions(options?: ListSessionsOptions): readonly SessionRecord[];
  /** 세션 삭제 */
  deleteSession(sessionId: string): boolean;
  /** 세션 메타데이터 업데이트 */
  updateSession(
    sessionId: string,
    updates: Partial<Pick<SessionRecord, "title" | "status" | "message_count" | "total_tokens">>,
  ): boolean;
  /** 리소스 정리 */
  close(): void;
}

/**
 * SQLite 스키마 초기화 SQL
 */
const SCHEMA_SQL = `
  CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    title TEXT,
    model TEXT NOT NULL,
    working_directory TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    message_count INTEGER DEFAULT 0,
    total_tokens INTEGER DEFAULT 0,
    status TEXT DEFAULT 'active'
  );

  CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    sequence INTEGER NOT NULL,
    role TEXT NOT NULL,
    content TEXT,
    tool_calls TEXT,
    tool_call_id TEXT,
    tokens INTEGER,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(session_id, sequence)
  );

  CREATE TABLE IF NOT EXISTS compaction_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    original_tokens INTEGER NOT NULL,
    compacted_tokens INTEGER NOT NULL,
    removed_messages INTEGER NOT NULL,
    summary TEXT NOT NULL,
    strategy TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_messages_session ON messages(session_id, sequence);
  CREATE INDEX IF NOT EXISTS idx_sessions_updated ON sessions(updated_at DESC);
  CREATE INDEX IF NOT EXISTS idx_sessions_status ON sessions(status);
`;

/**
 * SQLite 기반 세션 저장소 구현
 *
 * better-sqlite3의 동기 API를 사용합니다.
 * 세션 저장/조회는 짧은 작업이므로 동기 API가 더 단순하고 빠릅니다.
 *
 * @example
 * ```typescript
 * const store = new SQLiteSessionStore("/path/to/sessions.db");
 * const sessionId = store.createSession({
 *   model: "gpt-4",
 *   workingDirectory: "/my/project",
 * });
 * const session = store.getSession(sessionId);
 * store.close();
 * ```
 */
export class SQLiteSessionStore implements SessionStore {
  /** 내부 SQLite 데이터베이스 인스턴스 */
  private readonly db: Database.Database;

  /**
   * SQLiteSessionStore를 생성합니다.
   *
   * @param dbPath - SQLite 데이터베이스 파일 경로. `:memory:`로 인메모리 DB 사용 가능
   */
  constructor(dbPath: string) {
    this.db = new Database(dbPath);
    this.initialize();
  }

  /**
   * 데이터베이스를 초기화합니다.
   * PRAGMA 설정과 스키마 생성을 수행합니다.
   */
  private initialize(): void {
    // WAL 모드: 읽기와 쓰기를 동시에 수행할 수 있어 성능이 향상됨
    this.db.pragma("journal_mode = WAL");
    // NORMAL: 성능과 안전성의 균형 (FULL보다 빠르고, OFF보다 안전)
    this.db.pragma("synchronous = NORMAL");
    // 외래 키 제약 활성화 (ON DELETE CASCADE 등)
    this.db.pragma("foreign_keys = ON");

    this.db.exec(SCHEMA_SQL);
  }

  /**
   * 내부 Database 인스턴스를 반환합니다.
   * StreamingSessionWriter 등 다른 모듈에서 같은 DB에 접근할 때 사용합니다.
   */
  getDatabase(): Database.Database {
    return this.db;
  }

  /**
   * 새 세션을 생성합니다.
   *
   * @param options - 세션 생성 옵션
   * @returns 생성된 세션의 ID (UUID)
   */
  createSession(options: CreateSessionOptions): string {
    const id = options.id ?? crypto.randomUUID();
    const now = new Date().toISOString();

    const stmt = this.db.prepare(`
      INSERT INTO sessions (id, title, model, working_directory, created_at, updated_at, status)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      id,
      options.title ?? null,
      options.model,
      options.workingDirectory,
      now,
      now,
      options.status ?? "active",
    );

    return id;
  }

  /**
   * 세션을 조회합니다.
   *
   * @param sessionId - 조회할 세션 ID
   * @returns 세션 레코드, 없으면 undefined
   */
  getSession(sessionId: string): SessionRecord | undefined {
    const stmt = this.db.prepare("SELECT * FROM sessions WHERE id = ?");
    const row = stmt.get(sessionId) as SessionRecord | undefined;
    return row;
  }

  /**
   * 세션 목록을 조회합니다 (최근 수정 순).
   *
   * @param options - 조회 옵션 (상태 필터, 페이지네이션)
   * @returns 세션 레코드 배열
   */
  listSessions(options?: ListSessionsOptions): readonly SessionRecord[] {
    const conditions: string[] = [];
    const params: unknown[] = [];

    if (options?.status) {
      conditions.push("status = ?");
      params.push(options.status);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
    const limit = options?.limit ?? 100;
    const offset = options?.offset ?? 0;

    const stmt = this.db.prepare(
      `SELECT * FROM sessions ${where} ORDER BY updated_at DESC LIMIT ? OFFSET ?`,
    );
    params.push(limit, offset);

    return stmt.all(...params) as SessionRecord[];
  }

  /**
   * 세션을 삭제합니다.
   * ON DELETE CASCADE에 의해 관련 messages와 compaction_history도 함께 삭제됩니다.
   *
   * @param sessionId - 삭제할 세션 ID
   * @returns 삭제 성공 여부
   */
  deleteSession(sessionId: string): boolean {
    const stmt = this.db.prepare("DELETE FROM sessions WHERE id = ?");
    const result = stmt.run(sessionId);
    return result.changes > 0;
  }

  /**
   * 세션 메타데이터를 부분 업데이트합니다.
   *
   * @param sessionId - 업데이트할 세션 ID
   * @param updates - 업데이트할 필드들
   * @returns 업데이트 성공 여부
   */
  updateSession(
    sessionId: string,
    updates: Partial<Pick<SessionRecord, "title" | "status" | "message_count" | "total_tokens">>,
  ): boolean {
    const setClauses: string[] = [];
    const params: unknown[] = [];

    if (updates.title !== undefined) {
      setClauses.push("title = ?");
      params.push(updates.title);
    }
    if (updates.status !== undefined) {
      setClauses.push("status = ?");
      params.push(updates.status);
    }
    if (updates.message_count !== undefined) {
      setClauses.push("message_count = ?");
      params.push(updates.message_count);
    }
    if (updates.total_tokens !== undefined) {
      setClauses.push("total_tokens = ?");
      params.push(updates.total_tokens);
    }

    if (setClauses.length === 0) {
      return false;
    }

    // updated_at은 항상 갱신
    setClauses.push("updated_at = ?");
    params.push(new Date().toISOString());
    params.push(sessionId);

    const stmt = this.db.prepare(`UPDATE sessions SET ${setClauses.join(", ")} WHERE id = ?`);
    const result = stmt.run(...params);
    return result.changes > 0;
  }

  /**
   * 컴팩션 이력을 기록합니다.
   *
   * @param sessionId - 세션 ID
   * @param record - 컴팩션 정보
   */
  addCompactionRecord(
    sessionId: string,
    record: {
      readonly originalTokens: number;
      readonly compactedTokens: number;
      readonly removedMessages: number;
      readonly summary: string;
      readonly strategy: string;
    },
  ): void {
    const stmt = this.db.prepare(`
      INSERT INTO compaction_history (session_id, original_tokens, compacted_tokens, removed_messages, summary, strategy)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      sessionId,
      record.originalTokens,
      record.compactedTokens,
      record.removedMessages,
      record.summary,
      record.strategy,
    );
  }

  /**
   * 세션의 컴팩션 이력을 조회합니다.
   *
   * @param sessionId - 세션 ID
   * @returns 컴팩션 이력 배열 (최신순)
   */
  getCompactionHistory(sessionId: string): readonly CompactionRecord[] {
    const stmt = this.db.prepare(
      "SELECT * FROM compaction_history WHERE session_id = ? ORDER BY created_at DESC",
    );
    return stmt.all(sessionId) as CompactionRecord[];
  }

  /**
   * 트랜잭션 내에서 함수를 실행합니다.
   *
   * @param fn - 트랜잭션 내에서 실행할 함수
   * @returns 함수의 반환값
   */
  transaction<T>(fn: () => T): T {
    const wrapped = this.db.transaction(fn);
    return wrapped();
  }

  /**
   * 데이터베이스 연결을 닫습니다.
   * 프로세스 종료 시 또는 더 이상 DB를 사용하지 않을 때 호출합니다.
   */
  close(): void {
    this.db.close();
  }
}
