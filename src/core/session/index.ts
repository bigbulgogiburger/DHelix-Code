/**
 * 세션 모듈 — SQLite 기반 세션 저장소의 공개 API
 *
 * 이 barrel export 파일은 세션 관련 모든 공개 타입과 클래스를 내보냅니다.
 *
 * @example
 * ```typescript
 * import { SQLiteSessionStore, StreamingSessionWriter, migrateJsonlToSqlite } from "../session/index.js";
 * ```
 */

export {
  SQLiteSessionStore,
  type SessionStore,
  type SessionRecord,
  type MessageRecord,
  type CompactionRecord,
  type CreateSessionOptions,
  type ListSessionsOptions,
  type SessionStatus,
} from "./sqlite-store.js";

export { StreamingSessionWriter } from "./streaming-writer.js";

export {
  migrateJsonlToSqlite,
  isMigrationComplete,
  type MigrationResult,
  type SessionMigrationResult,
  type WriterFactory,
} from "./migration.js";
