/**
 * JSONL → SQLite 마이그레이션 모듈
 *
 * 기존 JSONL 형식의 세션 데이터를 SQLite로 변환합니다.
 * 첫 실행 시 자동으로 수행되며, 완료 후 JSONL 파일은 보존됩니다 (rollback 대비).
 *
 * 마이그레이션 프로세스:
 * 1. index.json에서 세션 목록 로드
 * 2. 각 세션의 metadata.json + transcript.jsonl 파싱
 * 3. SQLite sessions + messages 테이블에 INSERT
 * 4. 메시지 수 일치 검증
 * 5. migration_complete 마커 파일 생성
 *
 * 설계 원칙:
 * - 원본 JSONL 파일은 절대 삭제하지 않음 (안전한 rollback)
 * - 개별 세션 실패 시 나머지 세션은 계속 처리
 * - 이미 마이그레이션된 경우 중복 실행하지 않음
 */
import { readFile, readdir, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { SQLiteSessionStore } from "./sqlite-store.js";
import type { StreamingSessionWriter } from "./streaming-writer.js";

/**
 * JSONL 메시지 한 줄의 구조 (기존 transcript.jsonl 형식)
 */
interface JsonlMessage {
  readonly role: string;
  readonly content: string;
  readonly timestamp?: string;
  readonly toolCallId?: string;
  readonly toolCalls?: readonly { id: string; name: string; arguments: string }[];
}

/**
 * 기존 세션 메타데이터 구조 (metadata.json)
 */
interface LegacySessionMetadata {
  readonly id: string;
  readonly name: string;
  readonly createdAt: string;
  readonly lastUsedAt: string;
  readonly workingDirectory: string;
  readonly model: string;
  readonly messageCount: number;
}

/**
 * 기존 세션 인덱스 항목 구조 (index.json)
 */
interface LegacyIndexEntry {
  readonly id: string;
  readonly name: string;
  readonly createdAt: string;
  readonly lastUsedAt: string;
  readonly messageCount: number;
}

/**
 * 개별 세션 마이그레이션 결과
 */
export interface SessionMigrationResult {
  readonly sessionId: string;
  readonly success: boolean;
  readonly messageCount: number;
  readonly error?: string;
}

/**
 * 전체 마이그레이션 결과
 */
export interface MigrationResult {
  readonly totalSessions: number;
  readonly successCount: number;
  readonly failCount: number;
  readonly sessions: readonly SessionMigrationResult[];
  readonly alreadyMigrated: boolean;
}

/**
 * StreamingSessionWriter를 생성하는 팩토리 함수 타입.
 * 테스트에서 의존성 주입에 사용됩니다.
 */
export type WriterFactory = (
  store: SQLiteSessionStore,
  sessionId: string,
) => StreamingSessionWriter;

/**
 * 기본 WriterFactory 구현.
 * StreamingSessionWriter를 직접 import하여 생성합니다.
 */
async function defaultWriterFactory(
  store: SQLiteSessionStore,
  sessionId: string,
): Promise<StreamingSessionWriter> {
  const { StreamingSessionWriter: Writer } = await import("./streaming-writer.js");
  return new Writer(store.getDatabase(), sessionId);
}

/**
 * 마이그레이션 완료 마커 파일 경로를 반환합니다.
 *
 * @param jsonlDir - JSONL 세션 디렉토리
 * @returns 마커 파일 경로
 */
function migrationMarkerPath(jsonlDir: string): string {
  return join(jsonlDir, ".migration_complete");
}

/**
 * 마이그레이션이 이미 완료되었는지 확인합니다.
 *
 * @param jsonlDir - JSONL 세션 디렉토리
 * @returns 이미 완료된 경우 true
 */
export async function isMigrationComplete(jsonlDir: string): Promise<boolean> {
  try {
    await stat(migrationMarkerPath(jsonlDir));
    return true;
  } catch {
    return false;
  }
}

/**
 * 기존 JSONL 세션을 SQLite로 마이그레이션합니다.
 *
 * 이 함수는 idempotent합니다:
 * - 이미 마이그레이션이 완료된 경우 즉시 반환
 * - 개별 세션 실패 시 나머지 세션은 계속 처리
 * - 원본 JSONL 파일은 보존
 *
 * @param jsonlDir - JSONL 세션이 저장된 디렉토리 (예: ~/.dhelix/sessions/)
 * @param store - SQLiteSessionStore 인스턴스
 * @param writerFactory - StreamingSessionWriter 팩토리 (테스트용 DI)
 * @returns 마이그레이션 결과
 */
export async function migrateJsonlToSqlite(
  jsonlDir: string,
  store: SQLiteSessionStore,
  writerFactory?: WriterFactory,
): Promise<MigrationResult> {
  // 이미 마이그레이션 완료 확인
  if (await isMigrationComplete(jsonlDir)) {
    return {
      totalSessions: 0,
      successCount: 0,
      failCount: 0,
      sessions: [],
      alreadyMigrated: true,
    };
  }

  // 세션 목록 로드 (index.json 또는 디렉토리 스캔)
  const sessionIds = await discoverSessions(jsonlDir);
  const results: SessionMigrationResult[] = [];

  for (const sessionId of sessionIds) {
    try {
      const result = await migrateOneSession(jsonlDir, sessionId, store, writerFactory);
      results.push(result);
    } catch (err: unknown) {
      results.push({
        sessionId,
        success: false,
        messageCount: 0,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  const successCount = results.filter((r) => r.success).length;
  const failCount = results.filter((r) => !r.success).length;

  // 마이그레이션 완료 마커 생성
  if (successCount > 0) {
    const markerContent = JSON.stringify({
      migratedAt: new Date().toISOString(),
      totalSessions: sessionIds.length,
      successCount,
      failCount,
    });
    await writeFile(migrationMarkerPath(jsonlDir), markerContent, "utf-8");
  }

  return {
    totalSessions: sessionIds.length,
    successCount,
    failCount,
    sessions: results,
    alreadyMigrated: false,
  };
}

/**
 * JSONL 세션 디렉토리에서 세션 ID 목록을 수집합니다.
 *
 * 우선 index.json을 시도하고, 없으면 디렉토리를 직접 스캔합니다.
 *
 * @param jsonlDir - JSONL 세션 디렉토리
 * @returns 세션 ID 배열
 */
async function discoverSessions(jsonlDir: string): Promise<readonly string[]> {
  // 1. index.json 시도
  try {
    const indexContent = await readFile(join(jsonlDir, "index.json"), "utf-8");
    const entries = JSON.parse(indexContent) as readonly LegacyIndexEntry[];
    return entries.map((e) => e.id);
  } catch {
    // index.json이 없으면 디렉토리 스캔
  }

  // 2. 디렉토리 스캔 — UUID 형태의 디렉토리만 수집
  try {
    const entries = await readdir(jsonlDir, { withFileTypes: true });
    const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    return entries
      .filter((e) => e.isDirectory() && uuidPattern.test(e.name))
      .map((e) => e.name);
  } catch {
    return [];
  }
}

/**
 * 단일 세션을 마이그레이션합니다.
 *
 * @param jsonlDir - JSONL 세션 루트 디렉토리
 * @param sessionId - 마이그레이션할 세션 ID
 * @param store - SQLiteSessionStore 인스턴스
 * @param writerFactory - StreamingSessionWriter 팩토리
 * @returns 마이그레이션 결과
 */
async function migrateOneSession(
  jsonlDir: string,
  sessionId: string,
  store: SQLiteSessionStore,
  writerFactory?: WriterFactory,
): Promise<SessionMigrationResult> {
  const sessionDir = join(jsonlDir, sessionId);

  // 1. 메타데이터 로드
  const metadataPath = join(sessionDir, "metadata.json");
  let metadata: LegacySessionMetadata;
  try {
    const content = await readFile(metadataPath, "utf-8");
    metadata = JSON.parse(content) as LegacySessionMetadata;
  } catch {
    return {
      sessionId,
      success: false,
      messageCount: 0,
      error: "Failed to read metadata.json",
    };
  }

  // 2. 세션 레코드 생성
  store.createSession({
    id: sessionId,
    title: metadata.name,
    model: metadata.model,
    workingDirectory: metadata.workingDirectory,
  });

  // 3. transcript.jsonl 파싱 및 메시지 삽입
  const transcriptPath = join(sessionDir, "transcript.jsonl");
  let messages: JsonlMessage[] = [];
  try {
    const content = await readFile(transcriptPath, "utf-8");
    if (content.trim()) {
      const lines = content.trim().split("\n");
      for (const line of lines) {
        if (line.trim()) {
          messages.push(JSON.parse(line) as JsonlMessage);
        }
      }
    }
  } catch {
    // transcript.jsonl이 없거나 비어있을 수 있음 — 메시지 0건으로 계속 진행
  }

  // 4. 메시지 삽입
  if (messages.length > 0) {
    let writer: StreamingSessionWriter;
    if (writerFactory) {
      writer = writerFactory(store, sessionId);
    } else {
      writer = await defaultWriterFactory(store, sessionId);
    }

    writer.appendMessages(
      messages.map((msg) => ({
        role: msg.role as "user" | "assistant" | "system" | "tool",
        content: msg.content,
        ...(msg.toolCallId ? { toolCallId: msg.toolCallId } : {}),
        ...(msg.toolCalls ? { toolCalls: msg.toolCalls } : {}),
      })),
    );
  }

  // 5. 검증 — 메시지 수 일치 확인
  const storedSession = store.getSession(sessionId);
  const storedCount = storedSession?.message_count ?? 0;

  if (storedCount !== messages.length) {
    return {
      sessionId,
      success: false,
      messageCount: storedCount,
      error: `Message count mismatch: expected ${messages.length}, got ${storedCount}`,
    };
  }

  return {
    sessionId,
    success: true,
    messageCount: messages.length,
  };
}
