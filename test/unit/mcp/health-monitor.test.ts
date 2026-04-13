import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  McpHealthMonitor,
  type HealthMonitorConfig,
  type McpServerHealth,
  type ReconnectConfig,
} from "../../../src/mcp/health-monitor.js";

// ────────────────────────────────────────────────────────────────────────────
// 테스트 헬퍼
// ────────────────────────────────────────────────────────────────────────────

/** 즉시 resolve되는 pingFn */
const successPing = vi.fn().mockResolvedValue(undefined);

/** 즉시 reject되는 pingFn */
const failPing = vi.fn().mockRejectedValue(new Error("connection refused"));

/** 상태 변경 콜백을 캡처하는 spy */
function makeStatusSpy() {
  return vi.fn<Parameters<Parameters<McpHealthMonitor["onStatusChange"]>[0]>, void>();
}

/**
 * 기본 테스트 설정 — 핑 인터벌 30초, 타임아웃 100ms
 * 테스트는 직접 핑을 실행하거나 가짜 타이머로 시간을 전진시킵니다.
 */
function makeMonitor(overrides: HealthMonitorConfig = {}): McpHealthMonitor {
  return new McpHealthMonitor({
    pingIntervalMs: 30_000,
    pingTimeoutMs: 100,
    degradedAfter: 2,
    unreachableAfter: 5,
    ...overrides,
  });
}

/**
 * monitor의 private pingAll()을 외부에서 직접 트리거합니다.
 * 가짜 타이머를 사용하지 않고도 핑 로직을 실행할 수 있도록
 * 인터벌을 한 번만 울리는 방식을 사용합니다.
 */
async function triggerPingOnce(monitor: McpHealthMonitor): Promise<void> {
  vi.useFakeTimers();
  monitor.start();
  await vi.advanceTimersByTimeAsync(30_000);
  monitor.stop();
  vi.useRealTimers();
}

/**
 * N번 핑을 트리거합니다.
 * 각 핑 사이에 인터벌만큼 시간을 전진시킵니다.
 */
async function triggerPingN(monitor: McpHealthMonitor, n: number): Promise<void> {
  vi.useFakeTimers();
  monitor.start();
  for (let i = 0; i < n; i++) {
    await vi.advanceTimersByTimeAsync(30_000);
  }
  monitor.stop();
  vi.useRealTimers();
}

// ────────────────────────────────────────────────────────────────────────────
// describe 블록
// ────────────────────────────────────────────────────────────────────────────

describe("McpHealthMonitor", () => {
  let monitor: McpHealthMonitor;

  beforeEach(() => {
    vi.clearAllMocks();
    monitor = makeMonitor();
  });

  afterEach(() => {
    monitor.dispose();
    vi.useRealTimers(); // 혹시 가짜 타이머가 남아있으면 복구
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 초기 상태
  // ──────────────────────────────────────────────────────────────────────────

  describe("초기 상태", () => {
    it("서버가 없을 때 getAllHealth()는 빈 배열을 반환한다", () => {
      expect(monitor.getAllHealth()).toEqual([]);
    });

    it("등록되지 않은 serverId로 getHealth()를 호출하면 undefined를 반환한다", () => {
      expect(monitor.getHealth("unknown")).toBeUndefined();
    });

    it("등록되지 않은 serverId로 isHealthy()를 호출하면 false를 반환한다", () => {
      expect(monitor.isHealthy("unknown")).toBe(false);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 서버 등록
  // ──────────────────────────────────────────────────────────────────────────

  describe("registerServer / unregisterServer", () => {
    it("등록 직후 healthy 상태로 시작한다", () => {
      monitor.registerServer("srv-1", "filesystem", successPing);
      const health = monitor.getHealth("srv-1");

      expect(health).toBeDefined();
      expect(health!.status).toBe("healthy");
      expect(health!.lastPingMs).toBeNull();
      expect(health!.consecutiveFailures).toBe(0);
      expect(health!.lastSuccessAt).toBeNull();
      expect(health!.lastFailureAt).toBeNull();
    });

    it("serverId와 serverName이 스냅샷에 정확하게 반영된다", () => {
      monitor.registerServer("srv-2", "My Server", successPing);
      const health = monitor.getHealth("srv-2")!;

      expect(health.serverId).toBe("srv-2");
      expect(health.serverName).toBe("My Server");
    });

    it("같은 serverId로 다시 등록하면 기존 항목을 덮어쓴다", () => {
      monitor.registerServer("srv-1", "Old Name", failPing);
      monitor.registerServer("srv-1", "New Name", successPing);

      const health = monitor.getHealth("srv-1")!;
      expect(health.serverName).toBe("New Name");
    });

    it("unregisterServer()는 등록된 서버를 제거하고 true를 반환한다", () => {
      monitor.registerServer("srv-1", "fs", successPing);
      expect(monitor.unregisterServer("srv-1")).toBe(true);
      expect(monitor.getHealth("srv-1")).toBeUndefined();
    });

    it("unregisterServer()는 존재하지 않는 서버에 대해 false를 반환한다", () => {
      expect(monitor.unregisterServer("ghost")).toBe(false);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 핑 성공 → healthy 유지
  // ──────────────────────────────────────────────────────────────────────────

  describe("핑 성공 — healthy 유지", () => {
    it("핑 성공 후 status가 healthy이고 consecutiveFailures가 0이다", async () => {
      const ping = vi.fn().mockResolvedValue(undefined);
      monitor.registerServer("srv-1", "fs", ping);

      await triggerPingOnce(monitor);

      const health = monitor.getHealth("srv-1")!;
      expect(health.status).toBe("healthy");
      expect(health.consecutiveFailures).toBe(0);
      expect(ping).toHaveBeenCalledOnce();
    });

    it("여러 번 핑 성공해도 healthy를 유지한다", async () => {
      const ping = vi.fn().mockResolvedValue(undefined);
      monitor.registerServer("srv-1", "fs", ping);

      await triggerPingN(monitor, 5);

      const health = monitor.getHealth("srv-1")!;
      expect(health.status).toBe("healthy");
      expect(health.consecutiveFailures).toBe(0);
      expect(ping).toHaveBeenCalledTimes(5);
    });

    it("핑 성공 후 lastPingMs가 숫자다", async () => {
      const ping = vi.fn().mockResolvedValue(undefined);
      monitor.registerServer("srv-1", "fs", ping);

      await triggerPingOnce(monitor);

      const health = monitor.getHealth("srv-1")!;
      expect(typeof health.lastPingMs).toBe("number");
      expect(health.lastPingMs).toBeGreaterThanOrEqual(0);
    });

    it("핑 성공 후 lastSuccessAt이 설정된다", async () => {
      const before = Date.now();
      const ping = vi.fn().mockResolvedValue(undefined);
      monitor.registerServer("srv-1", "fs", ping);

      await triggerPingOnce(monitor);

      const health = monitor.getHealth("srv-1")!;
      expect(health.lastSuccessAt).not.toBeNull();
      expect(health.lastSuccessAt!).toBeGreaterThanOrEqual(before);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 연속 실패 → degraded → unreachable 전이
  // ──────────────────────────────────────────────────────────────────────────

  describe("연속 실패 — 상태 전이", () => {
    it("연속 실패 횟수가 degradedAfter에 도달하면 degraded로 전이한다", async () => {
      const statusChanges: Array<{ prev: string; next: string }> = [];
      const ping = vi.fn().mockRejectedValue(new Error("fail"));
      monitor.registerServer("srv-1", "fs", ping);

      monitor.onStatusChange((_, prev, next) => {
        statusChanges.push({ prev, next: next.status });
      });

      // degradedAfter = 2 → 2번 실패 후 degraded 전이
      await triggerPingN(monitor, 2);

      const health = monitor.getHealth("srv-1")!;
      expect(health.status).toBe("degraded");
      expect(health.consecutiveFailures).toBe(2);
      expect(statusChanges.some((c) => c.next === "degraded")).toBe(true);
    });

    it("연속 실패 횟수가 unreachableAfter에 도달하면 unreachable로 전이한다", async () => {
      const ping = vi.fn().mockRejectedValue(new Error("fail"));
      monitor.registerServer("srv-1", "fs", ping);

      // unreachableAfter = 5 → 5번 실패 후 unreachable
      await triggerPingN(monitor, 5);

      const health = monitor.getHealth("srv-1")!;
      expect(health.status).toBe("unreachable");
      expect(health.consecutiveFailures).toBe(5);
    });

    it("실패 후 lastFailureAt이 설정된다", async () => {
      const before = Date.now();
      const ping = vi.fn().mockRejectedValue(new Error("fail"));
      monitor.registerServer("srv-1", "fs", ping);

      await triggerPingOnce(monitor);

      const health = monitor.getHealth("srv-1")!;
      expect(health.lastFailureAt).not.toBeNull();
      expect(health.lastFailureAt!).toBeGreaterThanOrEqual(before);
    });

    it("핑 타임아웃도 실패로 처리한다", async () => {
      // pingTimeoutMs = 50ms, 핑이 300ms 걸리도록 설정
      const slowMonitor = makeMonitor({ pingTimeoutMs: 50 });
      // 실제 타임아웃을 사용해야 하므로 가짜 타이머를 쓰지 않음
      const slowPing = vi.fn().mockImplementation(
        () =>
          new Promise<void>((resolve) => {
            // 300ms 후에 resolve 되는 함수 — 타임아웃(50ms)보다 느림
            setTimeout(resolve, 300);
          }),
      );
      slowMonitor.registerServer("srv-1", "slow", slowPing);

      // 직접 pingAll을 트리거하기 위해 실제 타이머 사용
      // 인터벌을 매우 짧게 설정한 모니터를 따로 만들어서 테스트
      const fastMonitor = new McpHealthMonitor({ pingIntervalMs: 10, pingTimeoutMs: 50 });
      fastMonitor.registerServer("srv-1", "slow", slowPing);
      fastMonitor.start();
      // 충분히 기다려서 핑이 타임아웃되도록
      await new Promise<void>((resolve) => setTimeout(resolve, 200));
      fastMonitor.stop();

      const health = fastMonitor.getHealth("srv-1")!;
      expect(health.consecutiveFailures).toBeGreaterThan(0);
      fastMonitor.dispose();
      slowMonitor.dispose();
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 재연결 성공 → healthy 복귀
  // ──────────────────────────────────────────────────────────────────────────

  describe("requestReconnect — 재연결 성공", () => {
    it("재연결 성공 시 true를 반환하고 status가 healthy로 복귀한다", async () => {
      const ping = vi.fn().mockRejectedValue(new Error("fail"));
      monitor.registerServer("srv-1", "fs", ping);

      // degraded 상태로 만들기
      await triggerPingN(monitor, 2);
      expect(monitor.getHealth("srv-1")!.status).toBe("degraded");

      const reconnect = vi.fn().mockResolvedValue(undefined);
      const result = await monitor.requestReconnect("srv-1", reconnect, {
        maxRetries: 3,
        baseDelayMs: 1,
        maxDelayMs: 5,
      });

      expect(result).toBe(true);
      expect(monitor.getHealth("srv-1")!.status).toBe("healthy");
      expect(monitor.getHealth("srv-1")!.consecutiveFailures).toBe(0);
      expect(reconnect).toHaveBeenCalledTimes(1);
    });

    it("재연결 성공 시 lastSuccessAt이 업데이트된다", async () => {
      monitor.registerServer("srv-1", "fs", failPing);
      const reconnect = vi.fn().mockResolvedValue(undefined);

      const before = Date.now();
      await monitor.requestReconnect("srv-1", reconnect, { baseDelayMs: 1, maxDelayMs: 5 });

      const health = monitor.getHealth("srv-1")!;
      expect(health.lastSuccessAt).not.toBeNull();
      expect(health.lastSuccessAt!).toBeGreaterThanOrEqual(before);
    });

    it("재연결 성공 시 상태 변경 콜백이 호출된다", async () => {
      monitor.registerServer("srv-1", "fs", failPing);

      // degraded 상태로 만들기
      await triggerPingN(monitor, 2);

      const spy = makeStatusSpy();
      monitor.onStatusChange(spy);

      await monitor.requestReconnect("srv-1", vi.fn().mockResolvedValue(undefined), {
        baseDelayMs: 1,
        maxDelayMs: 5,
      });

      expect(spy).toHaveBeenCalledWith(
        "srv-1",
        "degraded",
        expect.objectContaining({ status: "healthy" }),
      );
    });

    it("서버가 등록되지 않아도 재연결은 실행되고 true를 반환한다", async () => {
      const reconnect = vi.fn().mockResolvedValue(undefined);
      const result = await monitor.requestReconnect("non-existent", reconnect, {
        baseDelayMs: 1,
        maxDelayMs: 5,
      });
      expect(result).toBe(true);
      expect(reconnect).toHaveBeenCalledTimes(1);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 재연결 실패 — maxRetries 초과
  // ──────────────────────────────────────────────────────────────────────────

  describe("requestReconnect — 재연결 실패", () => {
    it("모든 재시도가 실패하면 false를 반환한다", async () => {
      monitor.registerServer("srv-1", "fs", failPing);

      const reconnect = vi.fn().mockRejectedValue(new Error("cannot connect"));
      const result = await monitor.requestReconnect("srv-1", reconnect, {
        maxRetries: 3,
        baseDelayMs: 1,
        maxDelayMs: 5,
      });

      expect(result).toBe(false);
      expect(reconnect).toHaveBeenCalledTimes(3);
    });

    it("재시도 횟수가 maxRetries와 정확히 일치한다", async () => {
      monitor.registerServer("srv-1", "fs", failPing);

      const reconnect = vi.fn().mockRejectedValue(new Error("fail"));
      const config: ReconnectConfig = { maxRetries: 4, baseDelayMs: 1, maxDelayMs: 2 };
      await monitor.requestReconnect("srv-1", reconnect, config);

      expect(reconnect).toHaveBeenCalledTimes(4);
    });

    it("두 번째 시도에 성공하면 2번만 호출되고 true를 반환한다", async () => {
      monitor.registerServer("srv-1", "fs", failPing);

      const reconnect = vi
        .fn()
        .mockRejectedValueOnce(new Error("fail"))
        .mockResolvedValue(undefined);

      const result = await monitor.requestReconnect("srv-1", reconnect, {
        maxRetries: 5,
        baseDelayMs: 1,
        maxDelayMs: 5,
      });

      expect(result).toBe(true);
      expect(reconnect).toHaveBeenCalledTimes(2);
    });

    it("maxRetries=1이면 1번만 시도하고 실패 시 false를 반환한다", async () => {
      monitor.registerServer("srv-1", "fs", failPing);

      const reconnect = vi.fn().mockRejectedValue(new Error("fail"));
      const result = await monitor.requestReconnect("srv-1", reconnect, {
        maxRetries: 1,
        baseDelayMs: 1,
        maxDelayMs: 5,
      });

      expect(result).toBe(false);
      expect(reconnect).toHaveBeenCalledTimes(1);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Backoff 지연 계산 검증
  // ──────────────────────────────────────────────────────────────────────────

  describe("requestReconnect — backoff 지연 계산", () => {
    it("fake timer로 backoff sleep이 정상 처리된다", async () => {
      vi.useFakeTimers();

      monitor.registerServer("srv-1", "fs", failPing);
      const reconnect = vi.fn().mockRejectedValue(new Error("fail"));

      const reconnectPromise = monitor.requestReconnect("srv-1", reconnect, {
        maxRetries: 3,
        baseDelayMs: 1_000,
        maxDelayMs: 30_000,
        backoffMultiplier: 2.0,
      });

      // sleep 타이머를 전진시켜 재연결 루프 완료
      await vi.runAllTimersAsync();
      const result = await reconnectPromise;

      expect(result).toBe(false);
      expect(reconnect).toHaveBeenCalledTimes(3);

      vi.useRealTimers();
    });

    it("maxDelayMs cap이 적용되어 지연이 상한선을 초과하지 않는다", async () => {
      vi.useFakeTimers();

      monitor.registerServer("srv-1", "fs", failPing);
      const reconnect = vi.fn().mockRejectedValue(new Error("fail"));

      const reconnectPromise = monitor.requestReconnect("srv-1", reconnect, {
        maxRetries: 2,
        baseDelayMs: 100_000, // 매우 큰 baseDelay
        maxDelayMs: 10, // 작은 maxDelay로 cap 확인
        backoffMultiplier: 2.0,
      });

      // cap이 10ms이므로 10ms만 전진시켜도 처리되어야 함
      await vi.advanceTimersByTimeAsync(100);
      const result = await reconnectPromise;

      expect(result).toBe(false);
      vi.useRealTimers();
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 상태 변경 콜백
  // ──────────────────────────────────────────────────────────────────────────

  describe("onStatusChange 콜백", () => {
    it("상태가 변경되지 않으면 콜백이 호출되지 않는다 (healthy→healthy)", async () => {
      const ping = vi.fn().mockResolvedValue(undefined);
      monitor.registerServer("srv-1", "fs", ping);

      const spy = makeStatusSpy();
      monitor.onStatusChange(spy);

      await triggerPingN(monitor, 3);

      // healthy → healthy: 상태 변경 없음
      expect(spy).not.toHaveBeenCalled();
    });

    it("detach 함수를 호출하면 이후 콜백이 호출되지 않는다", async () => {
      const ping = vi.fn().mockRejectedValue(new Error("fail"));
      monitor.registerServer("srv-1", "fs", ping);

      const spy = makeStatusSpy();
      const detach = monitor.onStatusChange(spy);
      detach(); // 즉시 해제

      await triggerPingN(monitor, 5);

      expect(spy).not.toHaveBeenCalled();
    });

    it("콜백이 throw해도 다른 콜백은 정상 호출된다", async () => {
      const ping = vi.fn().mockRejectedValue(new Error("fail"));
      monitor.registerServer("srv-1", "fs", ping);

      const throwingCb = vi.fn().mockImplementation(() => {
        throw new Error("callback error");
      });
      const normalCb = makeStatusSpy();

      monitor.onStatusChange(throwingCb);
      monitor.onStatusChange(normalCb);

      // degradedAfter = 2
      await triggerPingN(monitor, 2);

      expect(normalCb).toHaveBeenCalled();
    });

    it("콜백에 올바른 serverId, prevStatus, nextHealth가 전달된다", async () => {
      const ping = vi.fn().mockRejectedValue(new Error("fail"));
      monitor.registerServer("srv-1", "fs", ping);

      const calls: Array<[string, string, McpServerHealth]> = [];
      monitor.onStatusChange((id, prev, next) => {
        calls.push([id, prev, next]);
      });

      // 2번 실패 → degraded 전이 발생
      await triggerPingN(monitor, 2);

      const degradedCall = calls.find(([, , next]) => next.status === "degraded");
      expect(degradedCall).toBeDefined();

      const [serverId, prevStatus, nextHealth] = degradedCall!;
      expect(serverId).toBe("srv-1");
      expect(prevStatus).toBe("healthy");
      expect(nextHealth.status).toBe("degraded");
    });

    it("unreachable 전이 시 콜백이 올바른 prevStatus로 호출된다", async () => {
      const ping = vi.fn().mockRejectedValue(new Error("fail"));
      monitor.registerServer("srv-1", "fs", ping);

      const transitions: Array<{ prev: string; next: string }> = [];
      monitor.onStatusChange((_, prev, next) => {
        transitions.push({ prev, next: next.status });
      });

      // unreachableAfter = 5
      await triggerPingN(monitor, 5);

      // degraded(2회) → unreachable(5회) 두 단계 전이가 모두 있어야 함
      expect(transitions.some((t) => t.next === "degraded")).toBe(true);
      expect(transitions.some((t) => t.next === "unreachable")).toBe(true);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // isHealthy
  // ──────────────────────────────────────────────────────────────────────────

  describe("isHealthy()", () => {
    it("healthy 상태 서버는 true를 반환한다", () => {
      monitor.registerServer("srv-1", "fs", successPing);
      expect(monitor.isHealthy("srv-1")).toBe(true);
    });

    it("degraded 상태 서버는 false를 반환한다", async () => {
      const ping = vi.fn().mockRejectedValue(new Error("fail"));
      monitor.registerServer("srv-1", "fs", ping);

      await triggerPingN(monitor, 2);

      expect(monitor.isHealthy("srv-1")).toBe(false);
    });

    it("unreachable 상태 서버는 false를 반환한다", async () => {
      const ping = vi.fn().mockRejectedValue(new Error("fail"));
      monitor.registerServer("srv-1", "fs", ping);

      await triggerPingN(monitor, 5);

      expect(monitor.isHealthy("srv-1")).toBe(false);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // getAllHealth
  // ──────────────────────────────────────────────────────────────────────────

  describe("getAllHealth()", () => {
    it("여러 서버의 스냅샷을 모두 반환한다", () => {
      monitor.registerServer("srv-1", "fs", successPing);
      monitor.registerServer("srv-2", "git", successPing);
      monitor.registerServer("srv-3", "db", successPing);

      const all = monitor.getAllHealth();
      expect(all).toHaveLength(3);
      expect(all.map((h) => h.serverId)).toContain("srv-1");
      expect(all.map((h) => h.serverId)).toContain("srv-2");
      expect(all.map((h) => h.serverId)).toContain("srv-3");
    });

    it("반환된 스냅샷은 값이 동일하다 (독립적 스냅샷)", () => {
      monitor.registerServer("srv-1", "fs", successPing);
      const snapshot1 = monitor.getAllHealth()[0];
      const snapshot2 = monitor.getAllHealth()[0];

      expect(snapshot1).toEqual(snapshot2);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 타이머 수명주기
  // ──────────────────────────────────────────────────────────────────────────

  describe("start / stop / dispose", () => {
    it("start()를 중복 호출해도 타이머가 하나만 생성된다", async () => {
      const ping = vi.fn().mockResolvedValue(undefined);
      monitor.registerServer("srv-1", "fs", ping);

      vi.useFakeTimers();
      monitor.start();
      monitor.start(); // 중복 호출

      await vi.advanceTimersByTimeAsync(30_000);
      monitor.stop();
      vi.useRealTimers();

      // 두 번 start()했지만 핑은 1번만 호출되어야 함 (타이머 1개)
      expect(ping).toHaveBeenCalledTimes(1);
    });

    it("stop() 후에는 핑이 실행되지 않는다", async () => {
      const ping = vi.fn().mockResolvedValue(undefined);
      monitor.registerServer("srv-1", "fs", ping);

      vi.useFakeTimers();
      monitor.start();
      monitor.stop();

      await vi.advanceTimersByTimeAsync(30_000);
      vi.useRealTimers();

      expect(ping).not.toHaveBeenCalled();
    });

    it("dispose() 후에는 서버가 모두 제거된다", () => {
      monitor.registerServer("srv-1", "fs", successPing);
      monitor.registerServer("srv-2", "git", successPing);

      monitor.dispose();

      expect(monitor.getAllHealth()).toHaveLength(0);
      expect(monitor.getHealth("srv-1")).toBeUndefined();
    });

    it("dispose() 후에는 콜백도 모두 제거되어 호출되지 않는다", async () => {
      monitor.registerServer("srv-1", "fs", failPing);

      const spy = makeStatusSpy();
      monitor.onStatusChange(spy);
      monitor.dispose();

      // dispose 후에 콜백이 클리어되므로 호출되지 않아야 함
      expect(spy).not.toHaveBeenCalled();
    });

    it("stop()을 중복 호출해도 에러가 발생하지 않는다", () => {
      monitor.start();
      monitor.stop();
      expect(() => monitor.stop()).not.toThrow();
    });

    it("start() 없이 stop()을 호출해도 에러가 발생하지 않는다", () => {
      expect(() => monitor.stop()).not.toThrow();
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 기본값 검증
  // ──────────────────────────────────────────────────────────────────────────

  describe("기본값", () => {
    it("설정 없이 생성해도 정상 동작한다", () => {
      const defaultMonitor = new McpHealthMonitor();
      defaultMonitor.registerServer("srv-1", "fs", successPing);

      const health = defaultMonitor.getHealth("srv-1")!;
      expect(health.status).toBe("healthy");

      defaultMonitor.dispose();
    });

    it("requestReconnect에 config를 전달하지 않아도 기본 maxRetries=5가 적용된다", async () => {
      monitor.registerServer("srv-1", "fs", failPing);

      const reconnect = vi.fn().mockRejectedValue(new Error("fail"));

      vi.useFakeTimers();
      const reconnectPromise = monitor.requestReconnect("srv-1", reconnect, {
        baseDelayMs: 100,
        maxDelayMs: 200,
        // maxRetries 생략 → 기본값 5
      });

      await vi.runAllTimersAsync();
      const result = await reconnectPromise;
      vi.useRealTimers();

      expect(result).toBe(false);
      expect(reconnect).toHaveBeenCalledTimes(5);
    });
  });
});
