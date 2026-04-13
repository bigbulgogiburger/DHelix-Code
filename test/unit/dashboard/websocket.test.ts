import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { EventEmitter } from "node:events";
import { type ServerResponse } from "node:http";
import { DashboardEventBridge, formatSseMessage } from "../../../src/dashboard/websocket.js";
import { type DashboardEvent } from "../../../src/dashboard/types.js";

// ---------------------------------------------------------------------------
// Mock ServerResponse 팩토리
// ---------------------------------------------------------------------------

/**
 * SSE 테스트용 가짜 ServerResponse를 생성합니다.
 * write/writeHead/end 호출을 기록하여 검증할 수 있습니다.
 */
function createMockResponse(): {
  response: ServerResponse;
  written: string[];
  headers: Record<string, unknown>;
  ended: boolean;
} {
  const state = {
    written: [] as string[],
    headers: {} as Record<string, unknown>,
    ended: false,
  };

  const emitter = new EventEmitter();
  const response = Object.assign(emitter, {
    writeHead: vi.fn((statusCode: number, headers: Record<string, unknown>) => {
      state.headers = { statusCode, ...headers };
      return response;
    }),
    write: vi.fn((chunk: string) => {
      state.written.push(chunk);
      return true;
    }),
    end: vi.fn(() => {
      state.ended = true;
      emitter.emit("close");
      return response;
    }),
    get writableEnded() {
      return state.ended;
    },
  }) as unknown as ServerResponse;

  return {
    response,
    ...state,
    get ended() {
      return state.ended;
    },
  };
}

// ---------------------------------------------------------------------------
// formatSseMessage
// ---------------------------------------------------------------------------

describe("formatSseMessage", () => {
  it("SSE 프로토콜 형식으로 메시지를 포맷한다", () => {
    const result = formatSseMessage("session:updated", { id: "1" });
    expect(result).toBe('event: session:updated\ndata: {"id":"1"}\n\n');
  });

  it("복잡한 데이터도 JSON으로 직렬화한다", () => {
    const data = { a: 1, b: "hello", c: [1, 2, 3] };
    const result = formatSseMessage("test", data);
    expect(result).toContain("event: test\n");
    expect(result).toContain(`data: ${JSON.stringify(data)}\n\n`);
  });

  it("null 데이터도 처리한다", () => {
    const result = formatSseMessage("empty", null);
    expect(result).toBe("event: empty\ndata: null\n\n");
  });
});

// ---------------------------------------------------------------------------
// DashboardEventBridge
// ---------------------------------------------------------------------------

describe("DashboardEventBridge", () => {
  let bridge: DashboardEventBridge;

  beforeEach(() => {
    vi.useFakeTimers();
    bridge = new DashboardEventBridge();
  });

  afterEach(() => {
    bridge.dispose();
    vi.useRealTimers();
  });

  // -------------------------------------------------------------------------
  // addClient / removeClient / getClientCount
  // -------------------------------------------------------------------------

  describe("addClient", () => {
    it("클라이언트를 등록하고 ID를 반환한다", () => {
      const { response } = createMockResponse();
      const clientId = bridge.addClient(response);
      expect(clientId).toBeTruthy();
      expect(bridge.getClientCount()).toBe(1);
    });

    it("SSE 헤더를 설정한다", () => {
      const mock = createMockResponse();
      bridge.addClient(mock.response);
      expect(mock.response.writeHead).toHaveBeenCalledWith(
        200,
        expect.objectContaining({
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
        }),
      );
    });

    it("연결 확인 코멘트를 전송한다", () => {
      const mock = createMockResponse();
      bridge.addClient(mock.response);
      expect(mock.written).toContain(": connected\n\n");
    });

    it("여러 클라이언트를 등록할 수 있다", () => {
      const m1 = createMockResponse();
      const m2 = createMockResponse();
      const m3 = createMockResponse();
      bridge.addClient(m1.response);
      bridge.addClient(m2.response);
      bridge.addClient(m3.response);
      expect(bridge.getClientCount()).toBe(3);
    });
  });

  describe("removeClient", () => {
    it("존재하는 클라이언트를 제거하면 true를 반환한다", () => {
      const { response } = createMockResponse();
      const clientId = bridge.addClient(response);
      expect(bridge.removeClient(clientId)).toBe(true);
      expect(bridge.getClientCount()).toBe(0);
    });

    it("존재하지 않는 클라이언트를 제거하면 false를 반환한다", () => {
      expect(bridge.removeClient("nonexistent")).toBe(false);
    });

    it("클라이언트 연결이 끊어지면 자동으로 제거된다", () => {
      const mock = createMockResponse();
      bridge.addClient(mock.response);
      expect(bridge.getClientCount()).toBe(1);

      // 연결 해제 이벤트 발생
      (mock.response as unknown as EventEmitter).emit("close");
      expect(bridge.getClientCount()).toBe(0);
    });
  });

  // -------------------------------------------------------------------------
  // broadcast
  // -------------------------------------------------------------------------

  describe("broadcast", () => {
    const testEvent: DashboardEvent = {
      type: "session:updated",
      data: {
        id: "s1",
        title: "Test",
        model: "claude",
        messageCount: 1,
        status: "active",
        createdAt: "2026-01-01",
        updatedAt: "2026-01-01",
      },
    };

    it("모든 클라이언트에 SSE 형식으로 이벤트를 전송한다", () => {
      const m1 = createMockResponse();
      const m2 = createMockResponse();
      bridge.addClient(m1.response);
      bridge.addClient(m2.response);

      const sentCount = bridge.broadcast(testEvent);
      expect(sentCount).toBe(2);

      const expected = formatSseMessage("session:updated", testEvent.data);
      // 첫 번째 write는 ": connected\n\n", 두 번째가 이벤트
      expect(m1.written).toContain(expected);
      expect(m2.written).toContain(expected);
    });

    it("클라이언트가 없으면 0을 반환한다", () => {
      expect(bridge.broadcast(testEvent)).toBe(0);
    });

    it("이미 닫힌 클라이언트는 자동 제거되고 카운트에서 제외된다", () => {
      const m1 = createMockResponse();
      const m2 = createMockResponse();
      bridge.addClient(m1.response);
      bridge.addClient(m2.response);

      // m1 연결 종료
      m1.response.end();

      const sentCount = bridge.broadcast(testEvent);
      expect(sentCount).toBe(1);
      expect(bridge.getClientCount()).toBe(1);
    });

    it("dispose 이후에는 0을 반환한다", () => {
      const { response } = createMockResponse();
      bridge.addClient(response);
      bridge.dispose();
      expect(bridge.broadcast(testEvent)).toBe(0);
    });

    it("다양한 이벤트 타입을 브로드캐스트할 수 있다", () => {
      const mock = createMockResponse();
      bridge.addClient(mock.response);

      const events: DashboardEvent[] = [
        {
          type: "metrics:updated",
          data: { totalIterations: 1, totalTokens: 100, activeAgents: 1, uptime: 5000 },
        },
        { type: "agent:message", data: { agentId: "a1", content: "hello" } },
        {
          type: "job:progress",
          data: { id: "j1", agentId: "a1", status: "running", startedAt: Date.now() },
        },
      ];

      for (const event of events) {
        bridge.broadcast(event);
      }

      // connected + 3 events
      expect(mock.written.length).toBe(4);
    });
  });

  // -------------------------------------------------------------------------
  // dispose
  // -------------------------------------------------------------------------

  describe("dispose", () => {
    it("모든 클라이언트 연결을 종료한다", () => {
      const m1 = createMockResponse();
      const m2 = createMockResponse();
      bridge.addClient(m1.response);
      bridge.addClient(m2.response);

      bridge.dispose();

      expect(m1.response.end).toHaveBeenCalled();
      expect(m2.response.end).toHaveBeenCalled();
      expect(bridge.getClientCount()).toBe(0);
    });

    it("이중 dispose를 호출해도 안전하다", () => {
      bridge.dispose();
      expect(() => bridge.dispose()).not.toThrow();
    });
  });

  // -------------------------------------------------------------------------
  // heartbeat
  // -------------------------------------------------------------------------

  describe("heartbeat", () => {
    it("30초 간격으로 heartbeat 코멘트를 전송한다", () => {
      const mock = createMockResponse();
      bridge.addClient(mock.response);

      // 초기: connected 메시지만
      expect(mock.written.length).toBe(1);

      // 30초 경과
      vi.advanceTimersByTime(30_000);
      expect(mock.written).toContain(": heartbeat\n\n");
    });

    it("닫힌 클라이언트를 heartbeat 시 정리한다", () => {
      const m1 = createMockResponse();
      const m2 = createMockResponse();
      bridge.addClient(m1.response);
      bridge.addClient(m2.response);

      // m1 연결 종료
      m1.response.end();

      // heartbeat 실행
      vi.advanceTimersByTime(30_000);

      expect(bridge.getClientCount()).toBe(1);
    });
  });
});
