/**
 * DashboardServer — Node.js http 모듈 기반 REST API 서버
 *
 * Express 등 외부 프레임워크 없이 Node.js 내장 http 모듈만 사용합니다.
 * DHelix Code CLI의 상태(세션, MCP 서버, 작업, 메트릭)를 JSON REST API로 노출하며,
 * SSE(Server-Sent Events) 엔드포인트를 통해 실시간 이벤트를 전송합니다.
 *
 * 라우트:
 * - GET /api/sessions — 세션 목록
 * - GET /api/sessions/:id — 세션 상세
 * - GET /api/mcp/servers — MCP 서버 상태
 * - GET /api/jobs — 작업 목록
 * - GET /api/metrics — 런타임 메트릭
 * - GET /api/events — SSE 이벤트 스트림
 * - GET /health — 서버 헬스체크
 *
 * @module dashboard/server
 */

import { createServer, type IncomingMessage, type ServerResponse, type Server } from "node:http";
import {
  type DashboardServerConfig,
  type SessionDataSource,
  type McpDataSource,
  type JobDataSource,
  type MetricsDataSource,
} from "./types.js";
import { DashboardEventBridge } from "./websocket.js";

/** 기본 HTTP 서버 포트 */
const DEFAULT_PORT = 18120;

/** 서버 시작 시간 (uptime 계산용) */
const SERVER_START_TIME = Date.now();

/**
 * API 응답 헬퍼 — JSON 응답을 작성합니다.
 *
 * CORS 헤더를 포함하여 localhost 개발 환경에서의 크로스 오리진 요청을 허용합니다.
 *
 * @param res - HTTP 응답 객체
 * @param statusCode - HTTP 상태 코드
 * @param data - JSON으로 직렬화될 응답 데이터
 */
function sendJson(res: ServerResponse, statusCode: number, data: unknown): void {
  const body = JSON.stringify(data);
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Cache-Control": "no-cache",
  });
  res.end(body);
}

/**
 * 404 Not Found 응답을 전송합니다.
 *
 * @param res - HTTP 응답 객체
 * @param message - 에러 메시지 (기본값: "Not Found")
 */
function sendNotFound(res: ServerResponse, message = "Not Found"): void {
  sendJson(res, 404, { error: message });
}

/**
 * 500 Internal Server Error 응답을 전송합니다.
 *
 * @param res - HTTP 응답 객체
 * @param message - 에러 메시지 (기본값: "Internal Server Error")
 */
function sendError(res: ServerResponse, message = "Internal Server Error"): void {
  sendJson(res, 500, { error: message });
}

/**
 * CORS preflight (OPTIONS) 요청을 처리합니다.
 *
 * @param res - HTTP 응답 객체
 */
function handleCorsOptions(res: ServerResponse): void {
  res.writeHead(204, {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
  });
  res.end();
}

/**
 * URL 경로에서 세션 ID를 추출합니다.
 *
 * "/api/sessions/abc-123" → "abc-123"
 *
 * @param pathname - URL 경로
 * @returns 세션 ID 또는 null
 */
function extractSessionId(pathname: string): string | null {
  const prefix = "/api/sessions/";
  if (!pathname.startsWith(prefix)) {
    return null;
  }
  const id = pathname.slice(prefix.length);
  // ID에 슬래시가 포함되면 무효
  if (id.length === 0 || id.includes("/")) {
    return null;
  }
  return id;
}

/**
 * DashboardServer — DHelix Code 상태 노출 REST API + SSE 서버
 *
 * 외부 의존성 없이 Node.js http 모듈만 사용합니다.
 * 데이터 소스는 생성자에서 인터페이스로 주입받아 느슨한 결합을 유지합니다.
 *
 * @example
 * ```typescript
 * const server = new DashboardServer({
 *   port: 18120,
 *   sessions: mySessionDataSource,
 *   mcp: myMcpDataSource,
 *   jobs: myJobDataSource,
 *   metrics: myMetricsDataSource,
 * });
 * await server.start();
 *
 * // SSE 이벤트 전송
 * server.broadcastEvent({
 *   type: 'session:updated',
 *   data: { ... }
 * });
 *
 * await server.stop();
 * ```
 */
export class DashboardServer {
  /** HTTP 서버 포트 */
  private readonly port: number;
  /** 세션 데이터 소스 */
  private readonly sessions: SessionDataSource;
  /** MCP 데이터 소스 */
  private readonly mcp: McpDataSource;
  /** 작업 데이터 소스 */
  private readonly jobs: JobDataSource;
  /** 메트릭 데이터 소스 */
  private readonly metrics: MetricsDataSource;
  /** SSE 이벤트 브릿지 */
  private readonly eventBridge: DashboardEventBridge;
  /** Node.js HTTP 서버 인스턴스 */
  private httpServer: Server | null = null;

  constructor(config: DashboardServerConfig) {
    this.port = config.port ?? DEFAULT_PORT;
    this.sessions = config.sessions;
    this.mcp = config.mcp;
    this.jobs = config.jobs;
    this.metrics = config.metrics;
    this.eventBridge = new DashboardEventBridge();
  }

  /**
   * HTTP 서버를 시작합니다.
   *
   * 이미 시작된 상태에서 다시 호출하면 무시됩니다.
   *
   * @returns 서버가 리슨을 시작하면 resolve되는 Promise
   */
  async start(): Promise<void> {
    if (this.httpServer) {
      return;
    }

    const server = createServer((req, res) => {
      void this.handleRequest(req, res);
    });

    this.httpServer = server;

    return new Promise<void>((resolve, reject) => {
      server.on("error", reject);
      server.listen(this.port, () => {
        server.removeListener("error", reject);
        resolve();
      });
    });
  }

  /**
   * HTTP 서버를 중지하고 모든 리소스를 정리합니다.
   *
   * SSE 이벤트 브릿지도 함께 정리됩니다.
   */
  async stop(): Promise<void> {
    this.eventBridge.dispose();

    const server = this.httpServer;
    if (!server) {
      return;
    }

    this.httpServer = null;

    return new Promise<void>((resolve) => {
      server.close(() => {
        resolve();
      });
    });
  }

  /**
   * 모든 SSE 클라이언트에 이벤트를 브로드캐스트합니다.
   *
   * @param event - 전송할 DashboardEvent
   * @returns 전송 성공한 클라이언트 수
   */
  broadcastEvent(event: import("./types.js").DashboardEvent): number {
    return this.eventBridge.broadcast(event);
  }

  /**
   * 현재 서버가 리슨 중인 포트를 반환합니다.
   *
   * @returns 포트 번호
   */
  getPort(): number {
    return this.port;
  }

  /**
   * 연결된 SSE 클라이언트 수를 반환합니다.
   *
   * @returns 클라이언트 수
   */
  getEventClientCount(): number {
    return this.eventBridge.getClientCount();
  }

  // ---------------------------------------------------------------------------
  // 요청 핸들링
  // ---------------------------------------------------------------------------

  /**
   * 모든 HTTP 요청의 진입점 — URL 경로에 따라 적절한 핸들러로 분기합니다.
   *
   * @param req - HTTP 요청 객체
   * @param res - HTTP 응답 객체
   */
  private async handleRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const method = req.method ?? "GET";
    const url = new URL(req.url ?? "/", `http://localhost:${this.port}`);
    const pathname = url.pathname;

    // CORS preflight 처리
    if (method === "OPTIONS") {
      handleCorsOptions(res);
      return;
    }

    // GET 요청만 허용
    if (method !== "GET") {
      sendJson(res, 405, { error: "Method Not Allowed" });
      return;
    }

    try {
      // 라우팅 테이블
      if (pathname === "/health") {
        await this.handleHealth(res);
      } else if (pathname === "/api/sessions") {
        await this.handleGetSessions(res);
      } else if (pathname.startsWith("/api/sessions/")) {
        const sessionId = extractSessionId(pathname);
        if (sessionId) {
          await this.handleGetSessionById(res, sessionId);
        } else {
          sendNotFound(res);
        }
      } else if (pathname === "/api/mcp/servers") {
        await this.handleGetMcpServers(res);
      } else if (pathname === "/api/jobs") {
        await this.handleGetJobs(res);
      } else if (pathname === "/api/metrics") {
        await this.handleGetMetrics(res);
      } else if (pathname === "/api/events") {
        this.handleSseEvents(res);
      } else {
        sendNotFound(res);
      }
    } catch {
      sendError(res);
    }
  }

  // ---------------------------------------------------------------------------
  // 라우트 핸들러
  // ---------------------------------------------------------------------------

  /**
   * GET /health — 서버 헬스체크
   *
   * 서버 상태, 업타임, SSE 클라이언트 수를 반환합니다.
   */
  private async handleHealth(res: ServerResponse): Promise<void> {
    sendJson(res, 200, {
      status: "ok",
      uptime: Date.now() - SERVER_START_TIME,
      sseClients: this.eventBridge.getClientCount(),
    });
  }

  /**
   * GET /api/sessions — 모든 세션 목록
   */
  private async handleGetSessions(res: ServerResponse): Promise<void> {
    const sessions = await this.sessions.getSessions();
    sendJson(res, 200, { sessions });
  }

  /**
   * GET /api/sessions/:id — 특정 세션 상세
   */
  private async handleGetSessionById(res: ServerResponse, id: string): Promise<void> {
    const session = await this.sessions.getSessionById(id);
    if (!session) {
      sendNotFound(res, `Session not found: ${id}`);
      return;
    }
    sendJson(res, 200, { session });
  }

  /**
   * GET /api/mcp/servers — MCP 서버 상태 목록
   */
  private async handleGetMcpServers(res: ServerResponse): Promise<void> {
    const servers = await this.mcp.getServers();
    sendJson(res, 200, { servers });
  }

  /**
   * GET /api/jobs — 작업 목록
   */
  private async handleGetJobs(res: ServerResponse): Promise<void> {
    const jobs = await this.jobs.getJobs();
    sendJson(res, 200, { jobs });
  }

  /**
   * GET /api/metrics — 런타임 메트릭
   */
  private async handleGetMetrics(res: ServerResponse): Promise<void> {
    const metrics = await this.metrics.getMetrics();
    sendJson(res, 200, { metrics });
  }

  /**
   * GET /api/events — SSE 이벤트 스트림
   *
   * 클라이언트를 SSE 브릿지에 등록하고, text/event-stream으로 응답합니다.
   * 이후 broadcast()로 전송되는 모든 이벤트를 수신합니다.
   */
  private handleSseEvents(res: ServerResponse): void {
    this.eventBridge.addClient(res);
  }
}
