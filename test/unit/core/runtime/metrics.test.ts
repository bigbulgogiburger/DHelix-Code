import { describe, it, expect, beforeEach } from "vitest";
import {
  RuntimeMetricsCollector,
  type StageMetrics,
  type RuntimeMetricsSnapshot,
} from "../../../../src/core/runtime/metrics.js";

describe("RuntimeMetricsCollector", () => {
  let collector: RuntimeMetricsCollector;

  beforeEach(() => {
    collector = new RuntimeMetricsCollector();
  });

  // ── recordStage ─────────────────────────────────────────────────────────

  describe("recordStage", () => {
    it("첫 실행을 기록하면 totalExecutions가 1이 된다", () => {
      collector.recordStage("sample-llm", 100);
      const snap = collector.snapshot();
      const stage = snap.stages.find((s) => s.stageName === "sample-llm");
      expect(stage?.totalExecutions).toBe(1);
    });

    it("동일 stage를 여러 번 기록하면 totalExecutions가 누적된다", () => {
      collector.recordStage("sample-llm", 100);
      collector.recordStage("sample-llm", 200);
      collector.recordStage("sample-llm", 300);
      const snap = collector.snapshot();
      const stage = snap.stages.find((s) => s.stageName === "sample-llm");
      expect(stage?.totalExecutions).toBe(3);
    });

    it("totalDurationMs는 모든 실행 시간의 합이다", () => {
      collector.recordStage("execute-tools", 50);
      collector.recordStage("execute-tools", 150);
      const snap = collector.snapshot();
      const stage = snap.stages.find((s) => s.stageName === "execute-tools");
      expect(stage?.totalDurationMs).toBe(200);
    });

    it("averageDurationMs는 총 시간을 실행 횟수로 나눈 값이다", () => {
      collector.recordStage("prepare-context", 100);
      collector.recordStage("prepare-context", 200);
      const snap = collector.snapshot();
      const stage = snap.stages.find((s) => s.stageName === "prepare-context");
      expect(stage?.averageDurationMs).toBe(150);
    });

    it("error=true로 기록하면 errorCount가 증가한다", () => {
      collector.recordStage("sample-llm", 100);
      collector.recordStage("sample-llm", 200, true);
      collector.recordStage("sample-llm", 300, true);
      const snap = collector.snapshot();
      const stage = snap.stages.find((s) => s.stageName === "sample-llm");
      expect(stage?.errorCount).toBe(2);
    });

    it("error를 지정하지 않으면 errorCount가 증가하지 않는다", () => {
      collector.recordStage("resolve-tools", 50);
      collector.recordStage("resolve-tools", 80);
      const snap = collector.snapshot();
      const stage = snap.stages.find((s) => s.stageName === "resolve-tools");
      expect(stage?.errorCount).toBe(0);
    });

    it("lastExecutedAt은 ISO 8601 문자열이다", () => {
      collector.recordStage("extract-calls", 10);
      const snap = collector.snapshot();
      const stage = snap.stages.find((s) => s.stageName === "extract-calls");
      expect(stage?.lastExecutedAt).toBeTruthy();
      expect(() => new Date(stage!.lastExecutedAt!)).not.toThrow();
    });

    it("한 번도 기록하지 않은 stage의 lastExecutedAt은 null이다", () => {
      // snapshot에 해당 stage가 없으면 find는 undefined 반환 — 이는 정상
      const snap = collector.snapshot();
      const stage = snap.stages.find((s) => s.stageName === "persist-results");
      expect(stage).toBeUndefined();
    });

    it("서로 다른 stage를 독립적으로 추적한다", () => {
      collector.recordStage("prepare-context", 10);
      collector.recordStage("sample-llm", 300);
      const snap = collector.snapshot();
      expect(snap.stages.length).toBe(2);
    });
  });

  // ── p95 계산 ────────────────────────────────────────────────────────────

  describe("p95DurationMs", () => {
    it("샘플이 1개면 p95는 그 값이다", () => {
      collector.recordStage("sample-llm", 500);
      const snap = collector.snapshot();
      const stage = snap.stages.find((s) => s.stageName === "sample-llm");
      expect(stage?.p95DurationMs).toBe(500);
    });

    it("샘플이 20개면 p95는 19번째 정렬값(index 18)이다", () => {
      // 1~20ms 순서로 기록
      for (let i = 1; i <= 20; i++) {
        collector.recordStage("sample-llm", i);
      }
      const snap = collector.snapshot();
      const stage = snap.stages.find((s) => s.stageName === "sample-llm");
      // ceil(20 * 0.95) - 1 = 19 - 1 = 18 → sorted[18] = 19
      expect(stage?.p95DurationMs).toBe(19);
    });

    it("샘플이 100개면 p95는 95번째 정렬값(index 94)이다", () => {
      for (let i = 1; i <= 100; i++) {
        collector.recordStage("execute-tools", i);
      }
      const snap = collector.snapshot();
      const stage = snap.stages.find((s) => s.stageName === "execute-tools");
      // ceil(100 * 0.95) - 1 = 95 - 1 = 94 → sorted[94] = 95
      expect(stage?.p95DurationMs).toBe(95);
    });

    it("모든 샘플이 동일하면 p95도 그 값이다", () => {
      for (let i = 0; i < 10; i++) {
        collector.recordStage("sample-llm", 200);
      }
      const snap = collector.snapshot();
      const stage = snap.stages.find((s) => s.stageName === "sample-llm");
      expect(stage?.p95DurationMs).toBe(200);
    });
  });

  // ── recordTransition ─────────────────────────────────────────────────────

  describe("recordTransition", () => {
    it("transition reason을 기록하면 transitionReasons에 반영된다", () => {
      collector.recordTransition("tool-results");
      collector.recordTransition("tool-results");
      collector.recordTransition("recovery");
      const snap = collector.snapshot();
      expect(snap.transitionReasons["tool-results"]).toBe(2);
      expect(snap.transitionReasons["recovery"]).toBe(1);
    });

    it("기록이 없으면 transitionReasons는 빈 객체다", () => {
      const snap = collector.snapshot();
      expect(snap.transitionReasons).toEqual({});
    });
  });

  // ── recordIteration ──────────────────────────────────────────────────────

  describe("recordIteration", () => {
    it("iteration을 기록하면 totalIterations가 증가한다", () => {
      collector.recordIteration(500);
      collector.recordIteration(700);
      const snap = collector.snapshot();
      expect(snap.totalIterations).toBe(2);
    });

    it("totalDurationMs는 iteration 시간의 합이다", () => {
      collector.recordIteration(300);
      collector.recordIteration(400);
      const snap = collector.snapshot();
      expect(snap.totalDurationMs).toBe(700);
    });

    it("iteration을 기록하지 않으면 totalIterations는 0이다", () => {
      const snap = collector.snapshot();
      expect(snap.totalIterations).toBe(0);
      expect(snap.totalDurationMs).toBe(0);
    });
  });

  // ── recordCompaction ─────────────────────────────────────────────────────

  describe("recordCompaction", () => {
    it("compaction을 기록하면 compactionCount가 증가한다", () => {
      collector.recordCompaction();
      collector.recordCompaction();
      const snap = collector.snapshot();
      expect(snap.compactionCount).toBe(2);
    });

    it("기록이 없으면 compactionCount는 0이다", () => {
      const snap = collector.snapshot();
      expect(snap.compactionCount).toBe(0);
    });
  });

  // ── snapshot ─────────────────────────────────────────────────────────────

  describe("snapshot", () => {
    it("snapshot은 독립적인 객체를 반환한다 (참조 공유 없음)", () => {
      collector.recordStage("sample-llm", 100);
      const snap1 = collector.snapshot();
      collector.recordStage("sample-llm", 200);
      const snap2 = collector.snapshot();
      // snap1은 변경되지 않아야 한다
      expect(snap1.stages.find((s) => s.stageName === "sample-llm")?.totalExecutions).toBe(1);
      expect(snap2.stages.find((s) => s.stageName === "sample-llm")?.totalExecutions).toBe(2);
    });

    it("빈 상태에서 snapshot을 호출하면 기본값을 반환한다", () => {
      const snap = collector.snapshot();
      expect(snap.stages).toEqual([]);
      expect(snap.totalIterations).toBe(0);
      expect(snap.totalDurationMs).toBe(0);
      expect(snap.compactionCount).toBe(0);
      expect(snap.transitionReasons).toEqual({});
    });
  });

  // ── reset ─────────────────────────────────────────────────────────────────

  describe("reset", () => {
    it("reset 후 snapshot은 초기 상태와 동일하다", () => {
      collector.recordStage("sample-llm", 100, true);
      collector.recordTransition("tool-results");
      collector.recordIteration(500);
      collector.recordCompaction();

      collector.reset();

      const snap = collector.snapshot();
      expect(snap.stages).toEqual([]);
      expect(snap.totalIterations).toBe(0);
      expect(snap.totalDurationMs).toBe(0);
      expect(snap.compactionCount).toBe(0);
      expect(snap.transitionReasons).toEqual({});
    });

    it("reset 후 새 기록은 정상적으로 누적된다", () => {
      collector.recordStage("sample-llm", 999);
      collector.reset();
      collector.recordStage("sample-llm", 50);
      const snap = collector.snapshot();
      const stage = snap.stages.find((s) => s.stageName === "sample-llm");
      expect(stage?.totalExecutions).toBe(1);
      expect(stage?.totalDurationMs).toBe(50);
    });
  });

  // ── 통합 시나리오 ─────────────────────────────────────────────────────────

  describe("통합 시나리오", () => {
    it("여러 stage와 iteration을 복합 기록한 스냅샷이 올바르다", () => {
      // Iteration 1
      collector.recordStage("prepare-context", 10);
      collector.recordStage("sample-llm", 300);
      collector.recordStage("execute-tools", 150);
      collector.recordTransition("tool-results");
      collector.recordIteration(460);

      // Iteration 2
      collector.recordStage("prepare-context", 12);
      collector.recordStage("sample-llm", 280, true); // LLM error
      collector.recordStage("execute-tools", 120);
      collector.recordTransition("recovery");
      collector.recordIteration(412);

      collector.recordCompaction();

      const snap: RuntimeMetricsSnapshot = collector.snapshot();

      expect(snap.totalIterations).toBe(2);
      expect(snap.totalDurationMs).toBe(872);
      expect(snap.compactionCount).toBe(1);
      expect(snap.transitionReasons["tool-results"]).toBe(1);
      expect(snap.transitionReasons["recovery"]).toBe(1);

      const llm = snap.stages.find((s) => s.stageName === "sample-llm");
      expect(llm?.totalExecutions).toBe(2);
      expect(llm?.totalDurationMs).toBe(580);
      expect(llm?.averageDurationMs).toBe(290);
      expect(llm?.errorCount).toBe(1);
    });
  });
});
