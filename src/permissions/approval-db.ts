/**
 * Persistent Approval Database — SQLite 기반 승인 결정 영구 저장소
 *
 * 사용자가 도구 실행을 허용/거부할 때, 그 결정을 SQLite DB에 저장합니다.
 * 세션 간 또는 프로젝트 전체에서 재사용할 수 있습니다.
 *
 * 스코프(scope):
 * - "session" : 현재 세션에만 유효 (만료 시간 짧음)
 * - "project" : 프로젝트 디렉토리 내 모든 세션에 유효
 * - "global"  : 모든 프로젝트에 유효 (~/.dhelix/ 저장)
 *
 * 동일 (tool, command) 쌍에 대해 가장 최근 결정이 반환됩니다.
 * 만료된 레코드는 자동으로 필터링됩니다.
 *
 * @example
 * ```ts
 * const db = new ApprovalDatabase(":memory:");
 *
 * db.save({
 *   id: crypto.randomUUID(),
 *   tool: "bash_exec",
 *   command: "npm install",
 *   action: "allow",
 *   scope: "project",
 *   createdAt: Date.now(),
 *   expiresAt: null,
 * });
 *
 * const record = db.findLatest("bash_exec", "npm install");
 * // record.action === "allow"
 *
 * db.close();
 * ```
 */

import Database from "better-sqlite3";

/**
 * 개별 승인/거부 기록
 */
export interface ApprovalRecord {
  /** UUID — 고유 식별자 */
  readonly id: string;
  /** 도구 이름 (예: "bash_exec", "file_write") */
  readonly tool: string;
  /** 실행한 명령/인수 문자열 */
  readonly command: string;
  /** 사용자의 결정 */
  readonly action: "allow" | "deny";
  /** 결정의 유효 범위 */
  readonly scope: "session" | "project" | "global";
  /** 생성 시각 (Unix timestamp, ms) */
  readonly createdAt: number;
  /** 만료 시각 (Unix timestamp, ms), null이면 영구 유효 */
  readonly expiresAt: number | null;
}

/**
 * 쿼리 필터 — query() 메서드에서 레코드를 필터링하는 조건
 */
export interface ApprovalFilter {
  /** 도구 이름 필터 (완전 일치) */
  readonly tool?: string;
  /** 명령 필터 (완전 일치) */
  readonly command?: string;
  /** 동작 필터 */
  readonly action?: "allow" | "deny";
  /** 스코프 필터 */
  readonly scope?: "session" | "project" | "global";
  /** 만료된 레코드 포함 여부 (기본: false) */
  readonly includeExpired?: boolean;
}

// ─── 내부 DB 행 타입 ──────────────────────────────────────────────────────────

interface DbRow {
  readonly id: string;
  readonly tool: string;
  readonly command: string;
  readonly action: string;
  readonly scope: string;
  readonly created_at: number;
  readonly expires_at: number | null;
}

/**
 * DbRow를 ApprovalRecord로 변환합니다.
 */
function rowToRecord(row: DbRow): ApprovalRecord {
  return {
    id: row.id,
    tool: row.tool,
    command: row.command,
    action: row.action as "allow" | "deny",
    scope: row.scope as "session" | "project" | "global",
    createdAt: row.created_at,
    expiresAt: row.expires_at,
  };
}

// ─── ApprovalDatabase ─────────────────────────────────────────────────────────

/**
 * SQLite 기반 승인 결정 영구 저장소
 *
 * better-sqlite3를 사용하여 동기 API로 안정적인 I/O를 제공합니다.
 * ":memory:" 경로를 사용하면 인메모리 DB로 동작합니다 (테스트용).
 */
export class ApprovalDatabase {
  private readonly db: Database.Database;

  /**
   * ApprovalDatabase 인스턴스를 생성합니다.
   *
   * @param dbPath - SQLite 파일 경로. ":memory:"를 사용하면 인메모리 DB
   */
  constructor(dbPath: string) {
    this.db = new Database(dbPath);
    this.initSchema();
  }

  /**
   * 승인 기록을 저장합니다.
   *
   * 동일한 id가 이미 존재하면 REPLACE(upsert)합니다.
   *
   * @param record - 저장할 승인 기록
   */
  save(record: ApprovalRecord): void {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO approvals
        (id, tool, command, action, scope, created_at, expires_at)
      VALUES
        (@id, @tool, @command, @action, @scope, @created_at, @expires_at)
    `);

    stmt.run({
      id: record.id,
      tool: record.tool,
      command: record.command,
      action: record.action,
      scope: record.scope,
      created_at: record.createdAt,
      expires_at: record.expiresAt,
    });
  }

  /**
   * 특정 (tool, command) 쌍에 대한 가장 최근 유효한 기록을 반환합니다.
   *
   * 만료된 레코드는 자동으로 제외됩니다.
   *
   * @param tool - 도구 이름
   * @param command - 명령/인수 문자열
   * @returns 가장 최근 유효한 기록, 없으면 null
   */
  findLatest(tool: string, command: string): ApprovalRecord | null {
    const now = Date.now();
    const stmt = this.db.prepare(`
      SELECT * FROM approvals
      WHERE tool = @tool
        AND command = @command
        AND (expires_at IS NULL OR expires_at > @now)
      ORDER BY created_at DESC
      LIMIT 1
    `);

    const row = stmt.get({ tool, command, now }) as DbRow | undefined;
    return row ? rowToRecord(row) : null;
  }

  /**
   * 필터 조건에 맞는 모든 기록을 반환합니다.
   *
   * @param filter - 필터 조건 (선택적)
   * @returns 조건에 맞는 기록 배열 (최신순)
   */
  query(filter: ApprovalFilter = {}): ApprovalRecord[] {
    const now = Date.now();
    const conditions: string[] = [];
    const params: Record<string, unknown> = { now };

    if (filter.tool !== undefined) {
      conditions.push("tool = @tool");
      params["tool"] = filter.tool;
    }

    if (filter.command !== undefined) {
      conditions.push("command = @command");
      params["command"] = filter.command;
    }

    if (filter.action !== undefined) {
      conditions.push("action = @action");
      params["action"] = filter.action;
    }

    if (filter.scope !== undefined) {
      conditions.push("scope = @scope");
      params["scope"] = filter.scope;
    }

    if (!filter.includeExpired) {
      conditions.push("(expires_at IS NULL OR expires_at > @now)");
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
    const sql = `SELECT * FROM approvals ${where} ORDER BY created_at DESC`;
    const rows = this.db.prepare(sql).all(params) as DbRow[];

    return rows.map(rowToRecord);
  }

  /**
   * 만료된 모든 기록을 삭제합니다.
   *
   * @returns 삭제된 기록 수
   */
  deleteExpired(): number {
    const now = Date.now();
    const stmt = this.db.prepare(`
      DELETE FROM approvals
      WHERE expires_at IS NOT NULL AND expires_at <= @now
    `);
    const result = stmt.run({ now });
    return result.changes;
  }

  /**
   * 특정 스코프의 모든 기록을 삭제합니다.
   *
   * @param scope - 삭제할 스코프
   */
  clear(scope: "session" | "project" | "global"): void {
    this.db.prepare("DELETE FROM approvals WHERE scope = @scope").run({ scope });
  }

  /**
   * DB 연결을 닫습니다.
   *
   * 인스턴스 사용 후 반드시 호출해야 합니다.
   */
  close(): void {
    this.db.close();
  }

  /**
   * 스키마를 초기화합니다.
   * approvals 테이블이 없으면 생성합니다.
   */
  private initSchema(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS approvals (
        id          TEXT PRIMARY KEY,
        tool        TEXT NOT NULL,
        command     TEXT NOT NULL,
        action      TEXT NOT NULL CHECK (action IN ('allow', 'deny')),
        scope       TEXT NOT NULL CHECK (scope IN ('session', 'project', 'global')),
        created_at  INTEGER NOT NULL,
        expires_at  INTEGER
      );

      CREATE INDEX IF NOT EXISTS idx_approvals_tool_command
        ON approvals (tool, command);

      CREATE INDEX IF NOT EXISTS idx_approvals_scope
        ON approvals (scope);

      CREATE INDEX IF NOT EXISTS idx_approvals_created_at
        ON approvals (created_at DESC);
    `);
  }
}
