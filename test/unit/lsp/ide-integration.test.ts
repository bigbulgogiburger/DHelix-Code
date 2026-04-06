/**
 * IDEIntegration — Unit Tests
 *
 * diagnostics 포워딩, inline diff 요청, 이벤트 구독/해제,
 * debounce 동작, dispose 후 정리를 검증합니다.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ── Module under test ──
import type {
  IDEEvent,
  DiagnosticInfo,
  InlineDiffRequest,
  IDEIntegrationConfig,
} from "../../../src/lsp/ide-integration.js";

// ── Helpers ──

/** DiagnosticInfo 픽스처 팩토리 */
function makeDiag(overrides?: Partial<DiagnosticInfo>): DiagnosticInfo {
  return {
    filePath: "/src/foo.ts",
    line: 5,
    column: 1,
    severity: "error",
    message: "Type error",
    source: "typescript",
    ...overrides,
  };
}

/** InlineDiffRequest 픽스처 팩토리 */
function makeDiff(overrides?: Partial<InlineDiffRequest>): InlineDiffRequest {
  return {
    filePath: "/src/foo.ts",
    before: "const x = 1;",
    after: "const x: number = 1;",
    description: "add type annotation",
    ...overrides,
  };
}

// ── Tests ──

describe("IDEIntegration", () => {
  let IDEIntegration: typeof import("../../../src/lsp/ide-integration.js").IDEIntegration;

  beforeEach(async () => {
    // 매 테스트마다 fresh import
    vi.resetModules();
    ({ IDEIntegration } = await import("../../../src/lsp/ide-integration.js"));
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // ── Constructor & Config ──

  describe("constructor", () => {
    it("기본 설정으로 생성 시 enableDiagnostics, enableInlineDiff = true, debounceMs = 300", () => {
      const ide = new IDEIntegration();
      expect(ide.getPendingDiagnostics()).toHaveLength(0);
      expect(ide.getPendingDiffs()).toHaveLength(0);
      const stats = ide.getStats();
      expect(stats.diagnosticsForwarded).toBe(0);
      expect(stats.diffsRequested).toBe(0);
      expect(stats.eventsReceived).toBe(0);
      ide.dispose();
    });

    it("커스텀 설정으로 생성 가능", () => {
      const config: IDEIntegrationConfig = {
        enableDiagnostics: false,
        enableInlineDiff: false,
        debounceMs: 100,
      };
      const ide = new IDEIntegration(config);
      // enableDiagnostics=false → forward 무시
      ide.forwardDiagnostics([makeDiag()]);
      expect(ide.getPendingDiagnostics()).toHaveLength(0);
      ide.dispose();
    });
  });

  // ── Diagnostics Forwarding & Queueing ──

  describe("forwardDiagnostics", () => {
    it("diagnostics가 pendingDiagnostics 큐에 추가된다", () => {
      const ide = new IDEIntegration();
      const diag = makeDiag();
      ide.forwardDiagnostics([diag]);
      expect(ide.getPendingDiagnostics()).toHaveLength(1);
      expect(ide.getPendingDiagnostics()[0]).toEqual(diag);
      ide.dispose();
    });

    it("여러 번 호출 시 누적된다", () => {
      const ide = new IDEIntegration();
      ide.forwardDiagnostics([makeDiag({ message: "A" })]);
      ide.forwardDiagnostics([makeDiag({ message: "B" }), makeDiag({ message: "C" })]);
      expect(ide.getPendingDiagnostics()).toHaveLength(3);
      ide.dispose();
    });

    it("stats.diagnosticsForwarded가 증가한다", () => {
      const ide = new IDEIntegration();
      ide.forwardDiagnostics([makeDiag(), makeDiag()]);
      expect(ide.getStats().diagnosticsForwarded).toBe(2);
      ide.dispose();
    });

    it("enableDiagnostics=false 시 무시된다", () => {
      const ide = new IDEIntegration({ enableDiagnostics: false });
      ide.forwardDiagnostics([makeDiag()]);
      expect(ide.getPendingDiagnostics()).toHaveLength(0);
      expect(ide.getStats().diagnosticsForwarded).toBe(0);
      ide.dispose();
    });

    it("dispose 후에는 무시된다", () => {
      const ide = new IDEIntegration();
      ide.dispose();
      ide.forwardDiagnostics([makeDiag()]);
      expect(ide.getPendingDiagnostics()).toHaveLength(0);
    });

    it("debounce 후 'diagnostic' 이벤트가 발행된다", () => {
      const ide = new IDEIntegration({ debounceMs: 300 });
      const events: IDEEvent[] = [];
      ide.onEvent((e) => events.push(e));

      ide.forwardDiagnostics([makeDiag()]);
      expect(events).toHaveLength(0); // 아직 debounce 전

      vi.advanceTimersByTime(300);
      expect(events).toHaveLength(1);
      expect(events[0].type).toBe("diagnostic");
      expect(events[0].filePath).toBe("/src/foo.ts");

      ide.dispose();
    });

    it("debounce 전 연속 호출은 마지막 한 번만 발행한다", () => {
      const ide = new IDEIntegration({ debounceMs: 300 });
      const events: IDEEvent[] = [];
      ide.onEvent((e) => events.push(e));

      ide.forwardDiagnostics([makeDiag({ message: "A" })]);
      vi.advanceTimersByTime(100);
      ide.forwardDiagnostics([makeDiag({ message: "B" })]);
      vi.advanceTimersByTime(100);
      ide.forwardDiagnostics([makeDiag({ message: "C" })]);
      vi.advanceTimersByTime(300); // 마지막 호출 기준 300ms 경과

      // 파일이 동일하므로 1개 이벤트 (파일별 그룹화)
      expect(events).toHaveLength(1);
      expect(events[0].type).toBe("diagnostic");

      ide.dispose();
    });

    it("파일이 다른 diagnostics는 각각 별도 이벤트로 발행된다", () => {
      const ide = new IDEIntegration({ debounceMs: 100 });
      const events: IDEEvent[] = [];
      ide.onEvent((e) => events.push(e));

      ide.forwardDiagnostics([
        makeDiag({ filePath: "/src/a.ts" }),
        makeDiag({ filePath: "/src/b.ts" }),
      ]);
      vi.advanceTimersByTime(100);

      // 파일별 2개 이벤트
      expect(events).toHaveLength(2);
      const filePaths = events.map((e) => e.filePath).sort();
      expect(filePaths).toEqual(["/src/a.ts", "/src/b.ts"]);

      ide.dispose();
    });
  });

  // ── Inline Diff Requests ──

  describe("requestInlineDiff", () => {
    it("diff 요청이 pendingDiffs 큐에 추가된다", () => {
      const ide = new IDEIntegration();
      const diff = makeDiff();
      ide.requestInlineDiff(diff);
      expect(ide.getPendingDiffs()).toHaveLength(1);
      expect(ide.getPendingDiffs()[0]).toEqual(diff);
      ide.dispose();
    });

    it("여러 번 호출 시 누적된다", () => {
      const ide = new IDEIntegration();
      ide.requestInlineDiff(makeDiff({ description: "A" }));
      ide.requestInlineDiff(makeDiff({ description: "B" }));
      expect(ide.getPendingDiffs()).toHaveLength(2);
      ide.dispose();
    });

    it("stats.diffsRequested가 증가한다", () => {
      const ide = new IDEIntegration();
      ide.requestInlineDiff(makeDiff());
      ide.requestInlineDiff(makeDiff());
      expect(ide.getStats().diffsRequested).toBe(2);
      ide.dispose();
    });

    it("enableInlineDiff=false 시 무시된다", () => {
      const ide = new IDEIntegration({ enableInlineDiff: false });
      ide.requestInlineDiff(makeDiff());
      expect(ide.getPendingDiffs()).toHaveLength(0);
      expect(ide.getStats().diffsRequested).toBe(0);
      ide.dispose();
    });

    it("dispose 후에는 무시된다", () => {
      const ide = new IDEIntegration();
      ide.dispose();
      ide.requestInlineDiff(makeDiff());
      expect(ide.getPendingDiffs()).toHaveLength(0);
    });

    it("debounce 후 'diff-applied' 이벤트가 발행된다", () => {
      const ide = new IDEIntegration({ debounceMs: 200 });
      const events: IDEEvent[] = [];
      ide.onEvent((e) => events.push(e));

      ide.requestInlineDiff(makeDiff());
      expect(events).toHaveLength(0);

      vi.advanceTimersByTime(200);
      expect(events).toHaveLength(1);
      expect(events[0].type).toBe("diff-applied");
      expect(events[0].filePath).toBe("/src/foo.ts");

      ide.dispose();
    });

    it("debounce 전 연속 diff 요청은 마지막 한 번만 발행한다", () => {
      const ide = new IDEIntegration({ debounceMs: 300 });
      const events: IDEEvent[] = [];
      ide.onEvent((e) => events.push(e));

      ide.requestInlineDiff(makeDiff({ description: "A" }));
      vi.advanceTimersByTime(100);
      ide.requestInlineDiff(makeDiff({ description: "B" }));
      vi.advanceTimersByTime(300);

      // 2개 diff가 누적 → 각각 이벤트 1개씩 (flush 시점에 2개 남음)
      expect(events).toHaveLength(2);
      expect(events.every((e) => e.type === "diff-applied")).toBe(true);

      ide.dispose();
    });
  });

  // ── Event Subscription & Unsubscription ──

  describe("onEvent", () => {
    it("이벤트 구독 후 receiveEvent 시 콜백이 호출된다", () => {
      const ide = new IDEIntegration();
      const received: IDEEvent[] = [];
      ide.onEvent((e) => received.push(e));

      const event: IDEEvent = {
        type: "file-changed",
        filePath: "/src/a.ts",
        timestamp: Date.now(),
        data: null,
      };
      ide.receiveEvent(event);

      expect(received).toHaveLength(1);
      expect(received[0]).toEqual(event);
      ide.dispose();
    });

    it("여러 구독자가 모두 이벤트를 받는다", () => {
      const ide = new IDEIntegration();
      const calls1: IDEEvent[] = [];
      const calls2: IDEEvent[] = [];

      ide.onEvent((e) => calls1.push(e));
      ide.onEvent((e) => calls2.push(e));

      ide.receiveEvent({
        type: "cursor-moved",
        filePath: "/src/b.ts",
        timestamp: Date.now(),
        data: { line: 10, column: 3 },
      });

      expect(calls1).toHaveLength(1);
      expect(calls2).toHaveLength(1);
      ide.dispose();
    });

    it("구독 해제 함수 호출 후 콜백이 더 이상 호출되지 않는다", () => {
      const ide = new IDEIntegration();
      const received: IDEEvent[] = [];
      const unsub = ide.onEvent((e) => received.push(e));

      unsub(); // 구독 해제

      ide.receiveEvent({
        type: "selection-changed",
        filePath: "/src/c.ts",
        timestamp: Date.now(),
        data: {},
      });

      expect(received).toHaveLength(0);
      ide.dispose();
    });

    it("구독 해제 후 다른 구독자는 계속 이벤트를 받는다", () => {
      const ide = new IDEIntegration();
      const a: IDEEvent[] = [];
      const b: IDEEvent[] = [];

      const unsubA = ide.onEvent((e) => a.push(e));
      ide.onEvent((e) => b.push(e));

      unsubA();

      ide.receiveEvent({
        type: "file-changed",
        filePath: "/x.ts",
        timestamp: Date.now(),
        data: null,
      });

      expect(a).toHaveLength(0);
      expect(b).toHaveLength(1);
      ide.dispose();
    });

    it("구독자 콜백에서 예외 발생 시 다른 구독자에 영향 없다", () => {
      const ide = new IDEIntegration();
      const goodCalls: IDEEvent[] = [];

      ide.onEvent(() => { throw new Error("bad subscriber"); });
      ide.onEvent((e) => goodCalls.push(e));

      expect(() => {
        ide.receiveEvent({
          type: "file-changed",
          filePath: "/err.ts",
          timestamp: Date.now(),
          data: null,
        });
      }).not.toThrow();

      expect(goodCalls).toHaveLength(1);
      ide.dispose();
    });

    it("stats.eventsReceived가 receiveEvent 호출마다 증가한다", () => {
      const ide = new IDEIntegration();
      ide.receiveEvent({ type: "file-changed", filePath: "/a.ts", timestamp: Date.now(), data: null });
      ide.receiveEvent({ type: "cursor-moved", filePath: "/b.ts", timestamp: Date.now(), data: null });
      expect(ide.getStats().eventsReceived).toBe(2);
      ide.dispose();
    });

    it("dispose 후 receiveEvent는 무시된다", () => {
      const ide = new IDEIntegration();
      const received: IDEEvent[] = [];
      ide.onEvent((e) => received.push(e));
      ide.dispose();

      ide.receiveEvent({ type: "file-changed", filePath: "/x.ts", timestamp: Date.now(), data: null });
      expect(received).toHaveLength(0);
    });
  });

  // ── clearPending ──

  describe("clearPending", () => {
    it("대기 중인 diagnostics와 diffs를 모두 초기화한다", () => {
      const ide = new IDEIntegration();
      ide.forwardDiagnostics([makeDiag()]);
      ide.requestInlineDiff(makeDiff());

      ide.clearPending();

      expect(ide.getPendingDiagnostics()).toHaveLength(0);
      expect(ide.getPendingDiffs()).toHaveLength(0);
      ide.dispose();
    });

    it("clearPending 후 debounce 타이머가 취소된다 — 이벤트 발행 없음", () => {
      const ide = new IDEIntegration({ debounceMs: 300 });
      const events: IDEEvent[] = [];
      ide.onEvent((e) => events.push(e));

      ide.forwardDiagnostics([makeDiag()]);
      ide.requestInlineDiff(makeDiff());
      ide.clearPending();

      vi.advanceTimersByTime(500); // 타이머가 취소되었으므로 이벤트 없음
      expect(events).toHaveLength(0);
      ide.dispose();
    });
  });

  // ── Debounce Behavior ──

  describe("debounce", () => {
    it("debounceMs=0 시 즉시 발행된다", () => {
      const ide = new IDEIntegration({ debounceMs: 0 });
      const events: IDEEvent[] = [];
      ide.onEvent((e) => events.push(e));

      ide.forwardDiagnostics([makeDiag()]);
      vi.advanceTimersByTime(0);

      expect(events).toHaveLength(1);
      ide.dispose();
    });

    it("debounce 기간 내 여러 diagnostics 호출은 한 번의 flush로 처리된다", () => {
      const flushFn = vi.fn();
      const ide = new IDEIntegration({ debounceMs: 500 });
      ide.onEvent(flushFn);

      ide.forwardDiagnostics([makeDiag({ message: "1" })]);
      vi.advanceTimersByTime(100);
      ide.forwardDiagnostics([makeDiag({ message: "2" })]);
      vi.advanceTimersByTime(100);
      ide.forwardDiagnostics([makeDiag({ message: "3" })]);
      vi.advanceTimersByTime(500);

      // 파일이 동일하므로 한 번만 flush
      expect(flushFn).toHaveBeenCalledTimes(1);
      ide.dispose();
    });
  });

  // ── getStats ──

  describe("getStats", () => {
    it("초기 통계는 모두 0이다", () => {
      const ide = new IDEIntegration();
      const stats = ide.getStats();
      expect(stats.diagnosticsForwarded).toBe(0);
      expect(stats.diffsRequested).toBe(0);
      expect(stats.eventsReceived).toBe(0);
      ide.dispose();
    });

    it("각 작업 후 통계가 올바르게 집계된다", () => {
      const ide = new IDEIntegration();
      ide.forwardDiagnostics([makeDiag(), makeDiag()]);
      ide.requestInlineDiff(makeDiff());
      ide.receiveEvent({ type: "file-changed", filePath: "/a.ts", timestamp: Date.now(), data: null });
      ide.receiveEvent({ type: "cursor-moved", filePath: "/b.ts", timestamp: Date.now(), data: null });

      const stats = ide.getStats();
      expect(stats.diagnosticsForwarded).toBe(2);
      expect(stats.diffsRequested).toBe(1);
      expect(stats.eventsReceived).toBe(2);
      ide.dispose();
    });
  });

  // ── dispose ──

  describe("dispose", () => {
    it("dispose 후 getPendingDiagnostics, getPendingDiffs가 빈 배열 반환", () => {
      const ide = new IDEIntegration();
      ide.forwardDiagnostics([makeDiag()]);
      ide.requestInlineDiff(makeDiff());
      ide.dispose();

      expect(ide.getPendingDiagnostics()).toHaveLength(0);
      expect(ide.getPendingDiffs()).toHaveLength(0);
    });

    it("dispose 후 forwardDiagnostics는 무시된다", () => {
      const ide = new IDEIntegration();
      ide.dispose();
      ide.forwardDiagnostics([makeDiag()]);
      expect(ide.getPendingDiagnostics()).toHaveLength(0);
    });

    it("dispose 후 requestInlineDiff는 무시된다", () => {
      const ide = new IDEIntegration();
      ide.dispose();
      ide.requestInlineDiff(makeDiff());
      expect(ide.getPendingDiffs()).toHaveLength(0);
    });

    it("dispose 후 debounce 타이머가 취소된다 — 이벤트 발행 없음", () => {
      const ide = new IDEIntegration({ debounceMs: 300 });
      const events: IDEEvent[] = [];
      ide.onEvent((e) => events.push(e));

      ide.forwardDiagnostics([makeDiag()]);
      ide.dispose(); // 타이머 취소

      vi.advanceTimersByTime(500);
      expect(events).toHaveLength(0);
    });

    it("dispose를 여러 번 호출해도 에러가 발생하지 않는다", () => {
      const ide = new IDEIntegration();
      expect(() => {
        ide.dispose();
        ide.dispose();
        ide.dispose();
      }).not.toThrow();
    });

    it("dispose 후 구독자 목록이 비워진다", () => {
      const ide = new IDEIntegration();
      const calls: IDEEvent[] = [];
      ide.onEvent((e) => calls.push(e));
      ide.dispose();

      // receiveEvent는 dispose 후 무시되므로 구독자에게 전달 안 됨
      ide.receiveEvent({ type: "file-changed", filePath: "/x.ts", timestamp: Date.now(), data: null });
      expect(calls).toHaveLength(0);
    });
  });
});
