/**
 * Cloud Runtime -- Background Agent Cloud Execution
 *
 * 원격 에이전트를 비동기로 실행하고 결과를 동기화하는 클라우드 실행 레이어입니다.
 * 현재는 로컬 인메모리 구현이며, 향후 AWS/GCP 등 클라우드 인프라 연동을 위한
 * 인터페이스를 확립합니다.
 *
 * @module cloud
 */

// Types
export type {
  ApplyResult,
  CloudArtifact,
  CloudConfig,
  CloudJob,
  CloudJobInput,
  CloudJobResult,
  JobFilter,
  JobPriority,
  JobStats,
  JobStatus,
  PendingFileChange,
  SyncRecord,
  SyncResult,
} from "./types.js";

export { DEFAULT_CLOUD_CONFIG, PRIORITY_ORDER } from "./types.js";

// Job Queue
export { JobQueue } from "./job-queue.js";

// Agent Runner
export { AgentRunner } from "./agent-runner.js";

// Result Sync
export { ResultSyncManager } from "./result-sync.js";
