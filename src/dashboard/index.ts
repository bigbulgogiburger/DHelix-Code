/**
 * Dashboard 모듈 — Barrel export
 *
 * DHelix Code CLI의 상태를 외부 웹 대시보드에 노출하는 서버 레이어입니다.
 * Node.js http 모듈 기반 REST API + SSE(Server-Sent Events) 이벤트 브릿지를 제공합니다.
 *
 * @module dashboard
 */

export { DashboardServer } from "./server.js";
export { DashboardEventBridge, formatSseMessage } from "./websocket.js";
export {
  type DashboardSessionInfo,
  type DashboardMcpServerInfo,
  type DashboardJobInfo,
  type DashboardMetrics,
  type DashboardEvent,
  type DashboardServerConfig,
  type SessionDataSource,
  type McpDataSource,
  type JobDataSource,
  type MetricsDataSource,
  isDashboardSessionInfo,
  isDashboardMcpServerInfo,
  isDashboardJobInfo,
  isDashboardMetrics,
  isDashboardEvent,
} from "./types.js";
