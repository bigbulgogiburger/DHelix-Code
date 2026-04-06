/**
 * 스트리밍 세션 라이터 (Streaming Session Writer)
 *
 * Codex의 RolloutRecorder 패턴에서 영감을 받은 streaming message writer.
 * 각 메시지를 즉시 SQLite DB에 저장하여 crash 시에도 데이터를 보존합니다.
 *
 * 주요 특징:
 * - 메시지 순서(sequence) 자동 관리
 * - 즉시 디스크 기록 (WAL 모드 활용)
 * - 세션의 message_count 자동 갱신
 * - 메시지 로드 시 ChatMessage 형식으로 자동 변환
 */
import type Database from "better-sqlite3";
import type { ChatMessage } from "../../llm/provider.js";

/**
 * 메시지 토큰 수를 간이 추정합니다.
 * 정확한 토큰 카운트가 아닌, 문자 기반 근사치입니다.
 * (영문 기준 4글자 ~ 1토큰, 한글 기준 2글자 ~ 1토큰)
 *
 * @param text - 토큰 수를 추정할 텍스트
 * @returns 추정 토큰 수
 */
function estimateTokens(text: string): number {
  if (!text) return 0;
  // 단순 근사: 4글자 = 1토큰 (영문 기준)
  return Math.ceil(text.length / 4);
}

/**
 * 스트리밍 세션 라이터 — 메시지를 즉시 SQLite에 기록합니다.
 *
 * agent loop에서 매 메시지 추가 시점에 appendMessage()를 호출하면
 * 즉시 DB에 INSERT됩니다. 프로세스가 비정상 종료되어도
 * 이미 기록된 메시지는 보존됩니다.
 *
 * @example
 * ```typescript
 * const writer = new StreamingSessionWriter(db, sessionId);
 * writer.appendMessage({ role: "user", content: "Hello!" });
 * writer.appendMessage({ role: "assistant", content: "Hi there!" });
 * const messages = writer.loadMessages();
 * ```
 */
export class StreamingSessionWriter {
  /** 내부 SQLite 데이터베이스 인스턴스 */
  private readonly db: Database.Database;

  /** 현재 세션 ID */
  private readonly sessionId: string;

  /** 다음 메시지의 sequence 번호 */
  private nextSequence: number;

  /**
   * StreamingSessionWriter를 생성합니다.
   *
   * 기존 메시지의 최대 sequence를 조회하여 이어쓰기를 지원합니다.
   *
   * @param db - better-sqlite3 Database 인스턴스
   * @param sessionId - 대상 세션 ID
   */
  constructor(db: Database.Database, sessionId: string) {
    this.db = db;
    this.sessionId = sessionId;

    // 기존 메시지의 최대 sequence 조회 (resume 지원)
    const row = this.db
      .prepare("SELECT MAX(sequence) as max_seq FROM messages WHERE session_id = ?")
      .get(sessionId) as { max_seq: number | null } | undefined;

    this.nextSequence = (row?.max_seq ?? -1) + 1;
  }

  /**
   * 단일 메시지를 즉시 DB에 append합니다.
   *
   * agent loop의 매 메시지 추가 시점에 호출됩니다.
   * 메시지는 순서(sequence)가 자동으로 할당되며,
   * 세션의 message_count와 total_tokens도 함께 갱신됩니다.
   *
   * @param message - 추가할 ChatMessage
   */
  appendMessage(message: ChatMessage): void {
    const tokens = estimateTokens(message.content ?? "");

    const insertStmt = this.db.prepare(`
      INSERT INTO messages (session_id, sequence, role, content, tool_calls, tool_call_id, tokens)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    insertStmt.run(
      this.sessionId,
      this.nextSequence,
      message.role,
      message.content ?? null,
      message.toolCalls ? JSON.stringify(message.toolCalls) : null,
      message.toolCallId ?? null,
      tokens,
    );

    this.nextSequence++;

    // 세션 메타데이터 갱신 (message_count, total_tokens, updated_at)
    this.db
      .prepare(
        `UPDATE sessions
         SET message_count = message_count + 1,
             total_tokens = total_tokens + ?,
             updated_at = datetime('now')
         WHERE id = ?`,
      )
      .run(tokens, this.sessionId);
  }

  /**
   * 여러 메시지를 트랜잭션으로 한번에 추가합니다.
   * 배치 쓰기로 개별 추가보다 효율적입니다.
   *
   * @param messages - 추가할 메시지 배열
   */
  appendMessages(messages: readonly ChatMessage[]): void {
    if (messages.length === 0) return;

    const insertStmt = this.db.prepare(`
      INSERT INTO messages (session_id, sequence, role, content, tool_calls, tool_call_id, tokens)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    const transaction = this.db.transaction(() => {
      let totalTokens = 0;

      for (const message of messages) {
        const tokens = estimateTokens(message.content ?? "");
        insertStmt.run(
          this.sessionId,
          this.nextSequence,
          message.role,
          message.content ?? null,
          message.toolCalls ? JSON.stringify(message.toolCalls) : null,
          message.toolCallId ?? null,
          tokens,
        );
        this.nextSequence++;
        totalTokens += tokens;
      }

      // 세션 메타데이터 일괄 갱신
      this.db
        .prepare(
          `UPDATE sessions
           SET message_count = message_count + ?,
               total_tokens = total_tokens + ?,
               updated_at = datetime('now')
           WHERE id = ?`,
        )
        .run(messages.length, totalTokens, this.sessionId);
    });

    transaction();
  }

  /**
   * 세션의 전체 메시지를 로드합니다 (resume 시 사용).
   *
   * sequence 순서대로 정렬된 ChatMessage 배열을 반환합니다.
   * tool_calls 필드는 JSON.parse로 역직렬화됩니다.
   *
   * @returns ChatMessage 배열
   */
  loadMessages(): readonly ChatMessage[] {
    const rows = this.db
      .prepare(
        "SELECT role, content, tool_calls, tool_call_id FROM messages WHERE session_id = ? ORDER BY sequence ASC",
      )
      .all(this.sessionId) as ReadonlyArray<{
      role: string;
      content: string | null;
      tool_calls: string | null;
      tool_call_id: string | null;
    }>;

    return rows.map((row) => ({
      role: row.role as ChatMessage["role"],
      content: row.content ?? "",
      ...(row.tool_call_id ? { toolCallId: row.tool_call_id } : {}),
      ...(row.tool_calls ? { toolCalls: JSON.parse(row.tool_calls) } : {}),
    }));
  }

  /**
   * 세션의 메시지 수를 조회합니다.
   *
   * @returns 메시지 수
   */
  getMessageCount(): number {
    const row = this.db
      .prepare("SELECT COUNT(*) as count FROM messages WHERE session_id = ?")
      .get(this.sessionId) as { count: number };
    return row.count;
  }

  /**
   * 현재 세션 ID를 반환합니다.
   */
  getSessionId(): string {
    return this.sessionId;
  }
}
