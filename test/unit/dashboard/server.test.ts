import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { request as httpRequest } from "node:http";
import { DashboardServer } from "../../../src/dashboard/server.js";
import {
  type SessionDataSource,
  type McpDataSource,
  type JobDataSource,
  type MetricsDataSource,
  type DashboardSessionInfo,
  type DashboardMcpServerInfo,
  type DashboardJobInfo,
  type DashboardMetrics,
} from "../../../src/dashboard/types.js";

// ---------------------------------------------------------------------------
// Mock 데이터 소스
// ---------------------------------------------------------------------------

const mockSessions: DashboardSessionInfo[] = [
  {
    id: "s1",
    title: "First Session",
    model: "claude-sonnet",
    messageCount: 10,
    status: "active",
    createdAt: "2026-04-05T00:00:00Z",
    updatedAt: "2026-04-05T01:00:00Z",
  },
  {
    id: "s2",
    title: "Second Session",
    model: "claude-haiku",
    messageCount: 5,
    status: "completed",
    createdAt: "2026-04-04T00:00:00Z",
    updatedAt: "2026-04-04T02:00:00Z",
  },
];

const mockMcpServers: DashboardMcpServerInfo[] = [
  {
    id: "mcp-1",
    name: "context7",
    status: "healthy",
    toolCount: 3,
    lastPingMs: 15,
  },
];

const mockJobs: DashboardJobInfo[] = [
  {
    id: "j1",
    agentId: "agent-1",
    status: "running",
    progress: 50,
    startedAt: 1712300000000,
  },
];

const mockMetrics: DashboardMetrics = {
  totalIterations: 42,
  totalTokens: 150000,
  activeAgents: 3,
  uptime: 3600000,
};

function createMockSessions(): SessionDataSource {
  return {
    getSessions: async () => mockSessions,
    getSessionById: async (id: string) => mockSessions.find((s) => s.id === id) ?? null,
  };
}

function createMockMcp(): McpDataSource {
  return {
    getServers: async () => mockMcpServers,
  };
}

function createMockJobs(): JobDataSource {
  return {
    getJobs: async () => mockJobs,
  };
}

function createMockMetrics(): MetricsDataSource {
  return {
    getMetrics: async () => mockMetrics,
  };
}

// ---------------------------------------------------------------------------
// HTTP 요청 헬퍼
// ---------------------------------------------------------------------------

function httpGet(port: number, path: string): Promise<{ status: number; body: string; headers: Record<string, string | string[] | undefined> }> {
  return new Promise((resolve, reject) => {
    const req = httpRequest(
      { hostname: "127.0.0.1", port, path, method: "GET" },
      (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (chunk: Buffer) => chunks.push(chunk));
        res.on("end", () => {
          resolve({
            status: res.statusCode ?? 0,
            body: Buffer.concat(chunks).toString("utf-8"),
            headers: res.headers as Record<string, string | string[] | undefined>,
          });
        });
      },
    );
    req.on("error", reject);
    req.end();
  });
}

function httpOptions(port: number, path: string): Promise<{ status: number; headers: Record<string, string | string[] | undefined> }> {
  return new Promise((resolve, reject) => {
    const req = httpRequest(
      { hostname: "127.0.0.1", port, path, method: "OPTIONS" },
      (res) => {
        res.resume();
        res.on("end", () => {
          resolve({
            status: res.statusCode ?? 0,
            headers: res.headers as Record<string, string | string[] | undefined>,
          });
        });
      },
    );
    req.on("error", reject);
    req.end();
  });
}

function httpPost(port: number, path: string): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const req = httpRequest(
      { hostname: "127.0.0.1", port, path, method: "POST" },
      (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (chunk: Buffer) => chunks.push(chunk));
        res.on("end", () => {
          resolve({
            status: res.statusCode ?? 0,
            body: Buffer.concat(chunks).toString("utf-8"),
          });
        });
      },
    );
    req.on("error", reject);
    req.end();
  });
}

// ---------------------------------------------------------------------------
// 테스트 — 사용할 포트를 동적으로 선택하여 충돌 방지
// ---------------------------------------------------------------------------

// 테스트마다 다른 포트 사용
let portCounter = 19100;
function nextPort(): number {
  return portCounter++;
}

describe("DashboardServer", () => {
  let server: DashboardServer;
  let port: number;

  beforeEach(async () => {
    port = nextPort();
    server = new DashboardServer({
      port,
      sessions: createMockSessions(),
      mcp: createMockMcp(),
      jobs: createMockJobs(),
      metrics: createMockMetrics(),
    });
    await server.start();
  });

  afterEach(async () => {
    await server.stop();
  });

  // -------------------------------------------------------------------------
  // GET /health
  // -------------------------------------------------------------------------

  describe("GET /health", () => {
    it("200과 status ok를 반환한다", async () => {
      const res = await httpGet(port, "/health");
      expect(res.status).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.status).toBe("ok");
      expect(typeof body.uptime).toBe("number");
      expect(typeof body.sseClients).toBe("number");
    });

    it("CORS 헤더를 포함한다", async () => {
      const res = await httpGet(port, "/health");
      expect(res.headers["access-control-allow-origin"]).toBe("*");
    });
  });

  // -------------------------------------------------------------------------
  // GET /api/sessions
  // -------------------------------------------------------------------------

  describe("GET /api/sessions", () => {
    it("세션 목록을 반환한다", async () => {
      const res = await httpGet(port, "/api/sessions");
      expect(res.status).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.sessions).toHaveLength(2);
      expect(body.sessions[0].id).toBe("s1");
      expect(body.sessions[1].id).toBe("s2");
    });
  });

  // -------------------------------------------------------------------------
  // GET /api/sessions/:id
  // -------------------------------------------------------------------------

  describe("GET /api/sessions/:id", () => {
    it("존재하는 세션을 반환한다", async () => {
      const res = await httpGet(port, "/api/sessions/s1");
      expect(res.status).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.session.id).toBe("s1");
      expect(body.session.title).toBe("First Session");
    });

    it("존재하지 않는 세션에 404를 반환한다", async () => {
      const res = await httpGet(port, "/api/sessions/nonexistent");
      expect(res.status).toBe(404);
      const body = JSON.parse(res.body);
      expect(body.error).toContain("Session not found");
    });
  });

  // -------------------------------------------------------------------------
  // GET /api/mcp/servers
  // -------------------------------------------------------------------------

  describe("GET /api/mcp/servers", () => {
    it("MCP 서버 목록을 반환한다", async () => {
      const res = await httpGet(port, "/api/mcp/servers");
      expect(res.status).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.servers).toHaveLength(1);
      expect(body.servers[0].name).toBe("context7");
    });
  });

  // -------------------------------------------------------------------------
  // GET /api/jobs
  // -------------------------------------------------------------------------

  describe("GET /api/jobs", () => {
    it("작업 목록을 반환한다", async () => {
      const res = await httpGet(port, "/api/jobs");
      expect(res.status).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.jobs).toHaveLength(1);
      expect(body.jobs[0].status).toBe("running");
    });
  });

  // -------------------------------------------------------------------------
  // GET /api/metrics
  // -------------------------------------------------------------------------

  describe("GET /api/metrics", () => {
    it("런타임 메트릭을 반환한다", async () => {
      const res = await httpGet(port, "/api/metrics");
      expect(res.status).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.metrics.totalIterations).toBe(42);
      expect(body.metrics.totalTokens).toBe(150000);
      expect(body.metrics.activeAgents).toBe(3);
    });
  });

  // -------------------------------------------------------------------------
  // 404 — 알 수 없는 경로
  // -------------------------------------------------------------------------

  describe("404 처리", () => {
    it("알 수 없는 경로에 404를 반환한다", async () => {
      const res = await httpGet(port, "/unknown/path");
      expect(res.status).toBe(404);
      const body = JSON.parse(res.body);
      expect(body.error).toBe("Not Found");
    });
  });

  // -------------------------------------------------------------------------
  // CORS OPTIONS
  // -------------------------------------------------------------------------

  describe("CORS OPTIONS", () => {
    it("OPTIONS 요청에 204와 CORS 헤더를 반환한다", async () => {
      const res = await httpOptions(port, "/api/sessions");
      expect(res.status).toBe(204);
      expect(res.headers["access-control-allow-origin"]).toBe("*");
      expect(res.headers["access-control-allow-methods"]).toContain("GET");
    });
  });

  // -------------------------------------------------------------------------
  // 405 — 허용되지 않는 메서드
  // -------------------------------------------------------------------------

  describe("405 처리", () => {
    it("POST 요청에 405를 반환한다", async () => {
      const res = await httpPost(port, "/api/sessions");
      expect(res.status).toBe(405);
      const body = JSON.parse(res.body);
      expect(body.error).toBe("Method Not Allowed");
    });
  });

  // -------------------------------------------------------------------------
  // JSON 응답 형식
  // -------------------------------------------------------------------------

  describe("JSON 응답 형식", () => {
    it("Content-Type이 application/json이다", async () => {
      const res = await httpGet(port, "/api/sessions");
      expect(res.headers["content-type"]).toContain("application/json");
    });

    it("응답이 유효한 JSON이다", async () => {
      const res = await httpGet(port, "/api/metrics");
      expect(() => JSON.parse(res.body)).not.toThrow();
    });
  });

  // -------------------------------------------------------------------------
  // 서버 수명주기
  // -------------------------------------------------------------------------

  describe("서버 수명주기", () => {
    it("이중 start()는 안전하다", async () => {
      // 이미 시작된 상태에서 다시 start
      await expect(server.start()).resolves.not.toThrow();
    });

    it("이중 stop()은 안전하다", async () => {
      await server.stop();
      await expect(server.stop()).resolves.not.toThrow();
    });

    it("getPort()는 설정된 포트를 반환한다", () => {
      expect(server.getPort()).toBe(port);
    });

    it("getEventClientCount()는 초기에 0이다", () => {
      expect(server.getEventClientCount()).toBe(0);
    });
  });

  // -------------------------------------------------------------------------
  // SSE 엔드포인트 (GET /api/events)
  // -------------------------------------------------------------------------

  describe("GET /api/events (SSE)", () => {
    it("text/event-stream 응답을 반환하고 연결을 유지한다", async () => {
      // SSE 연결은 long-lived이므로 짧게 연결 후 해제
      const result = await new Promise<{ status: number; headers: Record<string, string | string[] | undefined>; firstChunk: string }>((resolve, reject) => {
        const req = httpRequest(
          { hostname: "127.0.0.1", port, path: "/api/events", method: "GET" },
          (res) => {
            let firstChunk = "";
            res.on("data", (chunk: Buffer) => {
              firstChunk += chunk.toString();
              // 첫 데이터를 받으면 즉시 종료
              req.destroy();
              resolve({
                status: res.statusCode ?? 0,
                headers: res.headers as Record<string, string | string[] | undefined>,
                firstChunk,
              });
            });
          },
        );
        req.on("error", (err) => {
          // 연결이 destroy된 후의 에러는 무시
          if (!("status" in result)) {
            reject(err);
          }
        });
        req.end();
      });

      expect(result.status).toBe(200);
      expect(result.headers["content-type"]).toBe("text/event-stream");
      expect(result.firstChunk).toContain(": connected");
    });
  });
});
