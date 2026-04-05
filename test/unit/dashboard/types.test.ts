import { describe, it, expect } from "vitest";
import {
  isDashboardSessionInfo,
  isDashboardMcpServerInfo,
  isDashboardJobInfo,
  isDashboardMetrics,
  isDashboardEvent,
} from "../../../src/dashboard/types.js";

// ---------------------------------------------------------------------------
// 헬퍼: 유효한 객체 팩토리
// ---------------------------------------------------------------------------

function makeValidSession() {
  return {
    id: "session-1",
    title: "Test Session",
    model: "claude-sonnet",
    messageCount: 42,
    status: "active" as const,
    createdAt: "2026-04-05T00:00:00Z",
    updatedAt: "2026-04-05T01:00:00Z",
  };
}

function makeValidMcpServer() {
  return {
    id: "mcp-1",
    name: "my-server",
    status: "healthy" as const,
    toolCount: 5,
    lastPingMs: 12,
  };
}

function makeValidJob() {
  return {
    id: "job-1",
    agentId: "agent-1",
    status: "running" as const,
    startedAt: Date.now(),
  };
}

function makeValidMetrics() {
  return {
    totalIterations: 10,
    totalTokens: 5000,
    activeAgents: 2,
    uptime: 60000,
  };
}

// ---------------------------------------------------------------------------
// isDashboardSessionInfo
// ---------------------------------------------------------------------------

describe("isDashboardSessionInfo", () => {
  it("유효한 세션 객체를 true로 판별한다", () => {
    expect(isDashboardSessionInfo(makeValidSession())).toBe(true);
  });

  it("모든 status 값에 대해 true를 반환한다", () => {
    for (const status of ["active", "completed", "archived"]) {
      expect(isDashboardSessionInfo({ ...makeValidSession(), status })).toBe(true);
    }
  });

  it("null을 false로 판별한다", () => {
    expect(isDashboardSessionInfo(null)).toBe(false);
  });

  it("undefined를 false로 판별한다", () => {
    expect(isDashboardSessionInfo(undefined)).toBe(false);
  });

  it("빈 객체를 false로 판별한다", () => {
    expect(isDashboardSessionInfo({})).toBe(false);
  });

  it("잘못된 status 값을 false로 판별한다", () => {
    expect(isDashboardSessionInfo({ ...makeValidSession(), status: "invalid" })).toBe(false);
  });

  it("필수 필드가 누락되면 false를 반환한다", () => {
    const { title: _, ...noTitle } = makeValidSession();
    expect(isDashboardSessionInfo(noTitle)).toBe(false);
  });

  it("messageCount가 문자열이면 false를 반환한다", () => {
    expect(isDashboardSessionInfo({ ...makeValidSession(), messageCount: "42" })).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// isDashboardMcpServerInfo
// ---------------------------------------------------------------------------

describe("isDashboardMcpServerInfo", () => {
  it("유효한 MCP 서버 객체를 true로 판별한다", () => {
    expect(isDashboardMcpServerInfo(makeValidMcpServer())).toBe(true);
  });

  it("lastPingMs가 null이어도 true를 반환한다", () => {
    expect(isDashboardMcpServerInfo({ ...makeValidMcpServer(), lastPingMs: null })).toBe(true);
  });

  it("모든 status 값에 대해 true를 반환한다", () => {
    for (const status of ["healthy", "degraded", "unreachable", "stopped"]) {
      expect(isDashboardMcpServerInfo({ ...makeValidMcpServer(), status })).toBe(true);
    }
  });

  it("잘못된 status 값을 false로 판별한다", () => {
    expect(isDashboardMcpServerInfo({ ...makeValidMcpServer(), status: "unknown" })).toBe(false);
  });

  it("null을 false로 판별한다", () => {
    expect(isDashboardMcpServerInfo(null)).toBe(false);
  });

  it("lastPingMs가 문자열이면 false를 반환한다", () => {
    expect(isDashboardMcpServerInfo({ ...makeValidMcpServer(), lastPingMs: "12" })).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// isDashboardJobInfo
// ---------------------------------------------------------------------------

describe("isDashboardJobInfo", () => {
  it("유효한 작업 객체를 true로 판별한다", () => {
    expect(isDashboardJobInfo(makeValidJob())).toBe(true);
  });

  it("progress와 completedAt이 있어도 true를 반환한다", () => {
    expect(
      isDashboardJobInfo({
        ...makeValidJob(),
        progress: 75,
        completedAt: Date.now() + 1000,
      }),
    ).toBe(true);
  });

  it("모든 status 값에 대해 true를 반환한다", () => {
    for (const status of ["pending", "running", "completed", "failed"]) {
      expect(isDashboardJobInfo({ ...makeValidJob(), status })).toBe(true);
    }
  });

  it("잘못된 status 값을 false로 판별한다", () => {
    expect(isDashboardJobInfo({ ...makeValidJob(), status: "cancelled" })).toBe(false);
  });

  it("startedAt이 문자열이면 false를 반환한다", () => {
    expect(isDashboardJobInfo({ ...makeValidJob(), startedAt: "now" })).toBe(false);
  });

  it("null을 false로 판별한다", () => {
    expect(isDashboardJobInfo(null)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// isDashboardMetrics
// ---------------------------------------------------------------------------

describe("isDashboardMetrics", () => {
  it("유효한 메트릭 객체를 true로 판별한다", () => {
    expect(isDashboardMetrics(makeValidMetrics())).toBe(true);
  });

  it("0 값도 유효한 메트릭이다", () => {
    expect(
      isDashboardMetrics({
        totalIterations: 0,
        totalTokens: 0,
        activeAgents: 0,
        uptime: 0,
      }),
    ).toBe(true);
  });

  it("필수 필드가 누락되면 false를 반환한다", () => {
    const { uptime: _, ...noUptime } = makeValidMetrics();
    expect(isDashboardMetrics(noUptime)).toBe(false);
  });

  it("문자열 값을 false로 판별한다", () => {
    expect(isDashboardMetrics({ ...makeValidMetrics(), totalTokens: "5000" })).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// isDashboardEvent
// ---------------------------------------------------------------------------

describe("isDashboardEvent", () => {
  it("session:updated 이벤트를 true로 판별한다", () => {
    expect(
      isDashboardEvent({
        type: "session:updated",
        data: makeValidSession(),
      }),
    ).toBe(true);
  });

  it("mcp:health-changed 이벤트를 true로 판별한다", () => {
    expect(
      isDashboardEvent({
        type: "mcp:health-changed",
        data: makeValidMcpServer(),
      }),
    ).toBe(true);
  });

  it("job:progress 이벤트를 true로 판별한다", () => {
    expect(
      isDashboardEvent({
        type: "job:progress",
        data: makeValidJob(),
      }),
    ).toBe(true);
  });

  it("metrics:updated 이벤트를 true로 판별한다", () => {
    expect(
      isDashboardEvent({
        type: "metrics:updated",
        data: makeValidMetrics(),
      }),
    ).toBe(true);
  });

  it("agent:message 이벤트를 true로 판별한다", () => {
    expect(
      isDashboardEvent({
        type: "agent:message",
        data: { agentId: "agent-1", content: "Hello" },
      }),
    ).toBe(true);
  });

  it("알 수 없는 이벤트 타입을 false로 판별한다", () => {
    expect(
      isDashboardEvent({
        type: "unknown:event",
        data: {},
      }),
    ).toBe(false);
  });

  it("data가 null이면 false를 반환한다", () => {
    expect(
      isDashboardEvent({
        type: "session:updated",
        data: null,
      }),
    ).toBe(false);
  });

  it("type이 없으면 false를 반환한다", () => {
    expect(isDashboardEvent({ data: {} })).toBe(false);
  });

  it("null을 false로 판별한다", () => {
    expect(isDashboardEvent(null)).toBe(false);
  });
});
