/**
 * Dashboard API 타입 정의 — Web Dashboard Server Layer
 *
 * DHelix Code CLI의 상태를 외부 웹 대시보드에 노출하기 위한
 * API 응답 타입, WebSocket(SSE) 이벤트 타입, 데이터 소스 인터페이스를 정의합니다.
 *
 * 모든 타입은 readonly로 불변성을 보장합니다.
 *
 * @module dashboard/types
 */

// ---------------------------------------------------------------------------
// API 응답 타입
// ---------------------------------------------------------------------------

/**
 * 세션 정보 — GET /api/sessions, GET /api/sessions/:id 응답
 *
 * SessionManager의 SessionMetadata를 대시보드용으로 변환한 DTO입니다.
 */
export interface DashboardSessionInfo {
  readonly id: string;
  readonly title: string;
  readonly model: string;
  readonly messageCount: number;
  readonly status: 'active' | 'completed' | 'archived';
  readonly createdAt: string;
  readonly updatedAt: string;
}

/**
 * MCP 서버 정보 — GET /api/mcp/servers 응답
 *
 * MCPManager의 연결 상태를 대시보드용으로 변환한 DTO입니다.
 */
export interface DashboardMcpServerInfo {
  readonly id: string;
  readonly name: string;
  readonly status: 'healthy' | 'degraded' | 'unreachable' | 'stopped';
  readonly toolCount: number;
  readonly lastPingMs: number | null;
}

/**
 * 작업(Job) 정보 — GET /api/jobs 응답
 *
 * OrchestrationEventStore의 에이전트 이벤트를 대시보드용으로 변환한 DTO입니다.
 */
export interface DashboardJobInfo {
  readonly id: string;
  readonly agentId: string;
  readonly status: 'pending' | 'running' | 'completed' | 'failed';
  readonly progress?: number;
  readonly startedAt: number;
  readonly completedAt?: number;
}

/**
 * 런타임 메트릭 — GET /api/metrics 응답
 *
 * RuntimeMetricsCollector의 스냅샷을 대시보드용으로 변환한 DTO입니다.
 */
export interface DashboardMetrics {
  readonly totalIterations: number;
  readonly totalTokens: number;
  readonly activeAgents: number;
  readonly uptime: number;
}

// ---------------------------------------------------------------------------
// SSE 이벤트 타입
// ---------------------------------------------------------------------------

/**
 * 대시보드 SSE(Server-Sent Events) 이벤트 유니온 타입
 *
 * GET /api/events 엔드포인트에서 text/event-stream 형식으로 전송됩니다.
 * 각 이벤트는 "event: {type}\ndata: {json}\n\n" 형식입니다.
 */
export type DashboardEvent =
  | { readonly type: 'session:updated'; readonly data: DashboardSessionInfo }
  | { readonly type: 'mcp:health-changed'; readonly data: DashboardMcpServerInfo }
  | { readonly type: 'job:progress'; readonly data: DashboardJobInfo }
  | { readonly type: 'metrics:updated'; readonly data: DashboardMetrics }
  | { readonly type: 'agent:message'; readonly data: { readonly agentId: string; readonly content: string } };

// ---------------------------------------------------------------------------
// 데이터 소스 인터페이스 (의존성 주입용)
// ---------------------------------------------------------------------------

/**
 * 세션 데이터 소스 — DashboardServer가 세션 데이터를 조회하는 인터페이스
 *
 * SessionManager에 직접 의존하지 않고 인터페이스를 통해 느슨한 결합을 유지합니다.
 */
export interface SessionDataSource {
  /** 모든 세션 목록을 반환합니다 */
  readonly getSessions: () => Promise<readonly DashboardSessionInfo[]>;
  /** 특정 세션의 상세 정보를 반환합니다 (없으면 null) */
  readonly getSessionById: (id: string) => Promise<DashboardSessionInfo | null>;
}

/**
 * MCP 데이터 소스 — DashboardServer가 MCP 서버 상태를 조회하는 인터페이스
 */
export interface McpDataSource {
  /** 연결된 모든 MCP 서버의 상태를 반환합니다 */
  readonly getServers: () => Promise<readonly DashboardMcpServerInfo[]>;
}

/**
 * 작업(Job) 데이터 소스 — DashboardServer가 에이전트 작업을 조회하는 인터페이스
 */
export interface JobDataSource {
  /** 모든 작업 목록을 반환합니다 */
  readonly getJobs: () => Promise<readonly DashboardJobInfo[]>;
}

/**
 * 메트릭 데이터 소스 — DashboardServer가 런타임 메트릭을 조회하는 인터페이스
 */
export interface MetricsDataSource {
  /** 현재 런타임 메트릭 스냅샷을 반환합니다 */
  readonly getMetrics: () => Promise<DashboardMetrics>;
}

/**
 * DashboardServer 생성자에 전달하는 설정 인터페이스
 */
export interface DashboardServerConfig {
  /** HTTP 서버 포트 (기본값: 18120) */
  readonly port?: number;
  /** 세션 데이터 소스 */
  readonly sessions: SessionDataSource;
  /** MCP 데이터 소스 */
  readonly mcp: McpDataSource;
  /** 작업 데이터 소스 */
  readonly jobs: JobDataSource;
  /** 메트릭 데이터 소스 */
  readonly metrics: MetricsDataSource;
}

// ---------------------------------------------------------------------------
// 타입 가드
// ---------------------------------------------------------------------------

/** DashboardSessionInfo의 status 값 목록 */
const SESSION_STATUSES: readonly string[] = ['active', 'completed', 'archived'];

/** DashboardMcpServerInfo의 status 값 목록 */
const MCP_STATUSES: readonly string[] = ['healthy', 'degraded', 'unreachable', 'stopped'];

/** DashboardJobInfo의 status 값 목록 */
const JOB_STATUSES: readonly string[] = ['pending', 'running', 'completed', 'failed'];

/** DashboardEvent의 type 값 목록 */
const EVENT_TYPES: readonly string[] = [
  'session:updated',
  'mcp:health-changed',
  'job:progress',
  'metrics:updated',
  'agent:message',
];

/**
 * 값이 유효한 DashboardSessionInfo인지 확인하는 타입 가드
 *
 * @param value - 검사할 값
 * @returns DashboardSessionInfo이면 true
 */
export function isDashboardSessionInfo(value: unknown): value is DashboardSessionInfo {
  if (typeof value !== 'object' || value === null) return false;
  const obj = value as Record<string, unknown>;
  return (
    typeof obj['id'] === 'string' &&
    typeof obj['title'] === 'string' &&
    typeof obj['model'] === 'string' &&
    typeof obj['messageCount'] === 'number' &&
    typeof obj['status'] === 'string' &&
    SESSION_STATUSES.includes(obj['status'] as string) &&
    typeof obj['createdAt'] === 'string' &&
    typeof obj['updatedAt'] === 'string'
  );
}

/**
 * 값이 유효한 DashboardMcpServerInfo인지 확인하는 타입 가드
 *
 * @param value - 검사할 값
 * @returns DashboardMcpServerInfo이면 true
 */
export function isDashboardMcpServerInfo(value: unknown): value is DashboardMcpServerInfo {
  if (typeof value !== 'object' || value === null) return false;
  const obj = value as Record<string, unknown>;
  return (
    typeof obj['id'] === 'string' &&
    typeof obj['name'] === 'string' &&
    typeof obj['status'] === 'string' &&
    MCP_STATUSES.includes(obj['status'] as string) &&
    typeof obj['toolCount'] === 'number' &&
    (obj['lastPingMs'] === null || typeof obj['lastPingMs'] === 'number')
  );
}

/**
 * 값이 유효한 DashboardJobInfo인지 확인하는 타입 가드
 *
 * @param value - 검사할 값
 * @returns DashboardJobInfo이면 true
 */
export function isDashboardJobInfo(value: unknown): value is DashboardJobInfo {
  if (typeof value !== 'object' || value === null) return false;
  const obj = value as Record<string, unknown>;
  return (
    typeof obj['id'] === 'string' &&
    typeof obj['agentId'] === 'string' &&
    typeof obj['status'] === 'string' &&
    JOB_STATUSES.includes(obj['status'] as string) &&
    typeof obj['startedAt'] === 'number' &&
    (obj['completedAt'] === undefined || typeof obj['completedAt'] === 'number') &&
    (obj['progress'] === undefined || typeof obj['progress'] === 'number')
  );
}

/**
 * 값이 유효한 DashboardMetrics인지 확인하는 타입 가드
 *
 * @param value - 검사할 값
 * @returns DashboardMetrics이면 true
 */
export function isDashboardMetrics(value: unknown): value is DashboardMetrics {
  if (typeof value !== 'object' || value === null) return false;
  const obj = value as Record<string, unknown>;
  return (
    typeof obj['totalIterations'] === 'number' &&
    typeof obj['totalTokens'] === 'number' &&
    typeof obj['activeAgents'] === 'number' &&
    typeof obj['uptime'] === 'number'
  );
}

/**
 * 값이 유효한 DashboardEvent인지 확인하는 타입 가드
 *
 * @param value - 검사할 값
 * @returns DashboardEvent이면 true
 */
export function isDashboardEvent(value: unknown): value is DashboardEvent {
  if (typeof value !== 'object' || value === null) return false;
  const obj = value as Record<string, unknown>;
  if (typeof obj['type'] !== 'string' || !EVENT_TYPES.includes(obj['type'] as string)) {
    return false;
  }
  return typeof obj['data'] === 'object' && obj['data'] !== null;
}
