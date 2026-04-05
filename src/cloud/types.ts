/**
 * Cloud Runtime Types -- Background Agent Cloud Execution 타입 정의
 *
 * 원격 에이전트 실행의 기초 레이어 타입을 선언합니다.
 * 현재는 로컬 인메모리 구현이며, 향후 AWS/GCP 등 클라우드 인프라 연동을 위한
 * 인터페이스를 확립합니다.
 *
 * @module cloud/types
 */

// ---------------------------------------------------------------------------
// Job Status & Priority
// ---------------------------------------------------------------------------

/**
 * 클라우드 작업의 실행 상태
 *
 * - queued: 큐에 대기 중
 * - running: 실행 중
 * - completed: 성공적으로 완료됨
 * - failed: 실패함
 * - cancelled: 사용자 또는 시스템에 의해 취소됨
 */
export type JobStatus = 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';

/**
 * 클라우드 작업의 우선순위
 *
 * critical > high > normal > low 순으로 높은 우선순위를 가집니다.
 */
export type JobPriority = 'low' | 'normal' | 'high' | 'critical';

/**
 * 우선순위를 숫자로 변환하는 맵 (높을수록 우선)
 *
 * dequeue 시 가장 높은 숫자가 먼저 나옵니다.
 */
export const PRIORITY_ORDER: Readonly<Record<JobPriority, number>> = {
  low: 0,
  normal: 1,
  high: 2,
  critical: 3,
} as const;

// ---------------------------------------------------------------------------
// Cloud Artifact
// ---------------------------------------------------------------------------

/**
 * 작업 실행 결과로 생성된 산출물
 *
 * - file-change: 파일 변경 내용 (path 필수)
 * - test-result: 테스트 실행 결과 요약
 * - analysis: 분석 결과 텍스트
 */
export interface CloudArtifact {
  /** 산출물 유형 */
  readonly type: 'file-change' | 'test-result' | 'analysis';
  /** 파일 변경 시 대상 경로 (file-change 타입에서 필수) */
  readonly path?: string;
  /** 산출물 내용 */
  readonly content: string;
}

// ---------------------------------------------------------------------------
// Cloud Job Result
// ---------------------------------------------------------------------------

/**
 * 클라우드 작업 실행 결과
 *
 * 에이전트가 작업을 완료한 후 반환하는 결과 객체입니다.
 * 성공/실패 여부, 출력 텍스트, 산출물 목록, 토큰 소비량, 실행 시간을 포함합니다.
 */
export interface CloudJobResult {
  /** 작업 성공 여부 */
  readonly success: boolean;
  /** 에이전트 출력 텍스트 */
  readonly output: string;
  /** 생성된 산출물 목록 */
  readonly artifacts: readonly CloudArtifact[];
  /** 소비된 토큰 수 */
  readonly tokensUsed: number;
  /** 실행 소요 시간 (밀리초) */
  readonly durationMs: number;
  /** 실패 시 에러 메시지 */
  readonly error?: string;
}

// ---------------------------------------------------------------------------
// Cloud Job
// ---------------------------------------------------------------------------

/**
 * 클라우드 작업 객체
 *
 * 에이전트 실행 작업의 전체 수명주기를 나타냅니다.
 * 모든 필드가 readonly이며 상태 변경 시 새 객체를 생성합니다.
 */
export interface CloudJob {
  /** 작업 고유 식별자 (UUID v4) */
  readonly id: string;
  /** 실행할 에이전트 매니페스트 ID (예: "explore", "implement") */
  readonly agentManifestId: string;
  /** 에이전트에 전달할 프롬프트 */
  readonly prompt: string;
  /** 현재 작업 상태 */
  readonly status: JobStatus;
  /** 작업 우선순위 */
  readonly priority: JobPriority;
  /** 작업 생성 시각 (Unix ms) */
  readonly createdAt: number;
  /** 작업 실행 시작 시각 (Unix ms) */
  readonly startedAt?: number;
  /** 작업 완료 시각 (Unix ms) */
  readonly completedAt?: number;
  /** 작업 실행 결과 (완료 후 설정) */
  readonly result?: CloudJobResult;
  /** 추가 메타데이터 (사용자 정의) */
  readonly metadata?: Readonly<Record<string, unknown>>;
}

// ---------------------------------------------------------------------------
// Cloud Job Creation Input
// ---------------------------------------------------------------------------

/**
 * 새 작업 생성 시 전달하는 입력 타입
 *
 * id, status, createdAt은 시스템이 자동으로 부여하므로 제외합니다.
 */
export type CloudJobInput = Omit<CloudJob, 'id' | 'status' | 'createdAt'>;

// ---------------------------------------------------------------------------
// Cloud Config
// ---------------------------------------------------------------------------

/**
 * 클라우드 런타임 설정
 *
 * 동시 실행 수, 타임아웃, 재시도 정책 등을 구성합니다.
 * 모든 필드는 선택적이며 기본값이 존재합니다.
 */
export interface CloudConfig {
  /** 최대 동시 실행 작업 수 (기본: 3) */
  readonly maxConcurrentJobs?: number;
  /** 작업 타임아웃 밀리초 (기본: 300_000 = 5분) */
  readonly jobTimeoutMs?: number;
  /** 실패 시 자동 재시도 여부 (기본: false) */
  readonly retryOnFailure?: boolean;
  /** 최대 재시도 횟수 (기본: 1) */
  readonly maxRetries?: number;
}

/**
 * CloudConfig의 기본값
 */
export const DEFAULT_CLOUD_CONFIG: Readonly<Required<CloudConfig>> = {
  maxConcurrentJobs: 3,
  jobTimeoutMs: 300_000,
  retryOnFailure: false,
  maxRetries: 1,
} as const;

// ---------------------------------------------------------------------------
// Job Filter
// ---------------------------------------------------------------------------

/**
 * 작업 목록 조회 시 사용하는 필터
 *
 * 모든 필드는 선택적이며 AND 조건으로 결합됩니다.
 */
export interface JobFilter {
  /** 특정 상태의 작업만 조회 */
  readonly status?: JobStatus;
  /** 특정 우선순위의 작업만 조회 */
  readonly priority?: JobPriority;
}

// ---------------------------------------------------------------------------
// Job Stats
// ---------------------------------------------------------------------------

/**
 * 작업 큐 통계 요약
 */
export interface JobStats {
  readonly queued: number;
  readonly running: number;
  readonly completed: number;
  readonly failed: number;
  readonly cancelled: number;
}

// ---------------------------------------------------------------------------
// Result Sync Types
// ---------------------------------------------------------------------------

/**
 * 동기화 결과 요약
 */
export interface SyncResult {
  /** 동기화 ID */
  readonly syncId: string;
  /** 동기화 대상 작업 ID */
  readonly jobId: string;
  /** 생성된 대기 중 파일 변경 수 */
  readonly pendingFileChanges: number;
  /** 테스트 결과 요약 수 */
  readonly testResults: number;
  /** 분석 결과 수 */
  readonly analyses: number;
  /** 동기화 시각 (Unix ms) */
  readonly syncedAt: number;
}

/**
 * 대기 중인 파일 변경
 *
 * applyChanges()로 적용하거나 rejectChanges()로 거부할 수 있습니다.
 */
export interface PendingFileChange {
  /** 변경 고유 ID */
  readonly changeId: string;
  /** 원본 작업 ID */
  readonly jobId: string;
  /** 대상 파일 경로 */
  readonly filePath: string;
  /** 변경 내용 */
  readonly content: string;
  /** 생성 시각 (Unix ms) */
  readonly createdAt: number;
}

/**
 * 동기화 이력 레코드
 */
export interface SyncRecord {
  /** 동기화 ID */
  readonly syncId: string;
  /** 원본 작업 ID */
  readonly jobId: string;
  /** 동기화 결과 */
  readonly result: SyncResult;
  /** 동기화 시각 (Unix ms) */
  readonly syncedAt: number;
}

/**
 * 파일 변경 적용 결과
 */
export interface ApplyResult {
  /** 적용된 변경 수 */
  readonly applied: number;
  /** 적용 실패한 변경 수 */
  readonly failed: number;
  /** 실패 상세 (changeId → 에러 메시지) */
  readonly errors: Readonly<Record<string, string>>;
}
