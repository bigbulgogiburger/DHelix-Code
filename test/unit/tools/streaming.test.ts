/**
 * Tool Streaming Protocol 단위 테스트
 *
 * 테스트 대상:
 * - ToolStreamEmitter의 4가지 이벤트 타입 (progress, chunk, warning, complete)
 * - ToolStreamCollector의 이벤트 수집 및 detach
 * - events가 undefined일 때 에러 없이 동작 (no-op)
 * - metadata 옵션 전달 및 생략
 * - createToolStreamEmitter 팩토리 함수
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import mitt from "mitt";
import {
  ToolStreamEmitter,
  ToolStreamCollector,
  createToolStreamEmitter,
  type ToolStreamEvent,
} from "../../../src/tools/streaming.js";
import { type AppEvents, type AppEventEmitter } from "../../../src/utils/events.js";

// ─── 헬퍼 ────────────────────────────────────────────────────────────────────

/** 실제 mitt 기반 AppEventEmitter 생성 (타입 안전) */
function createMockEmitter(): AppEventEmitter {
  return mitt<AppEvents>();
}

/** ToolContext의 최소한의 모양 */
function makeContext(events?: AppEventEmitter, toolCallId?: string) {
  return {
    workingDirectory: "/tmp",
    abortSignal: new AbortController().signal,
    timeoutMs: 5000,
    platform: "darwin" as const,
    events,
    toolCallId,
  };
}

// ─── ToolStreamEmitter ────────────────────────────────────────────────────────

describe("ToolStreamEmitter", () => {
  const TOOL_CALL_ID = "call-abc-123";
  const TOOL_NAME = "grep_search";

  describe("progress()", () => {
    it("tool:stream 이벤트를 type=progress로 발행한다", () => {
      const emitter = createMockEmitter();
      const received: ToolStreamEvent[] = [];
      emitter.on("tool:stream", (e) => received.push(e));

      const stream = new ToolStreamEmitter(TOOL_CALL_ID, TOOL_NAME, emitter);
      stream.progress("스캔 중...");

      expect(received).toHaveLength(1);
      expect(received[0]).toMatchObject({
        type: "progress",
        toolCallId: TOOL_CALL_ID,
        toolName: TOOL_NAME,
        data: "스캔 중...",
      });
    });

    it("metadata를 포함하여 발행한다", () => {
      const emitter = createMockEmitter();
      const received: ToolStreamEvent[] = [];
      emitter.on("tool:stream", (e) => received.push(e));

      const stream = new ToolStreamEmitter(TOOL_CALL_ID, TOOL_NAME, emitter);
      stream.progress("진행 중...", { percentComplete: 50, itemsFound: 10 });

      expect(received[0].metadata).toEqual({ percentComplete: 50, itemsFound: 10 });
    });

    it("metadata를 생략하면 undefined이다", () => {
      const emitter = createMockEmitter();
      const received: ToolStreamEvent[] = [];
      emitter.on("tool:stream", (e) => received.push(e));

      const stream = new ToolStreamEmitter(TOOL_CALL_ID, TOOL_NAME, emitter);
      stream.progress("시작");

      expect(received[0].metadata).toBeUndefined();
    });
  });

  describe("chunk()", () => {
    it("tool:stream 이벤트를 type=chunk로 발행한다", () => {
      const emitter = createMockEmitter();
      const received: ToolStreamEvent[] = [];
      emitter.on("tool:stream", (e) => received.push(e));

      const stream = new ToolStreamEmitter(TOOL_CALL_ID, TOOL_NAME, emitter);
      stream.chunk("src/foo.ts:42  export function bar()");

      expect(received).toHaveLength(1);
      expect(received[0]).toMatchObject({
        type: "chunk",
        toolCallId: TOOL_CALL_ID,
        toolName: TOOL_NAME,
        data: "src/foo.ts:42  export function bar()",
      });
    });

    it("metadata를 포함하여 발행한다", () => {
      const emitter = createMockEmitter();
      const received: ToolStreamEvent[] = [];
      emitter.on("tool:stream", (e) => received.push(e));

      const stream = new ToolStreamEmitter(TOOL_CALL_ID, TOOL_NAME, emitter);
      stream.chunk("결과 데이터", { itemsFound: 5, bytesProcessed: 1024 });

      expect(received[0].metadata).toEqual({ itemsFound: 5, bytesProcessed: 1024 });
    });
  });

  describe("warning()", () => {
    it("tool:stream 이벤트를 type=warning으로 발행한다", () => {
      const emitter = createMockEmitter();
      const received: ToolStreamEvent[] = [];
      emitter.on("tool:stream", (e) => received.push(e));

      const stream = new ToolStreamEmitter(TOOL_CALL_ID, TOOL_NAME, emitter);
      stream.warning("파일 읽기 실패 — 건너뜁니다");

      expect(received).toHaveLength(1);
      expect(received[0]).toMatchObject({
        type: "warning",
        toolCallId: TOOL_CALL_ID,
        toolName: TOOL_NAME,
        data: "파일 읽기 실패 — 건너뜁니다",
      });
    });

    it("warning은 metadata를 받지 않으며 undefined이다", () => {
      const emitter = createMockEmitter();
      const received: ToolStreamEvent[] = [];
      emitter.on("tool:stream", (e) => received.push(e));

      const stream = new ToolStreamEmitter(TOOL_CALL_ID, TOOL_NAME, emitter);
      stream.warning("경고 메시지");

      expect(received[0].metadata).toBeUndefined();
    });
  });

  describe("complete()", () => {
    it("tool:stream 이벤트를 type=complete로 발행한다", () => {
      const emitter = createMockEmitter();
      const received: ToolStreamEvent[] = [];
      emitter.on("tool:stream", (e) => received.push(e));

      const stream = new ToolStreamEmitter(TOOL_CALL_ID, TOOL_NAME, emitter);
      stream.complete("검색 완료 — 42개 매칭 발견");

      expect(received).toHaveLength(1);
      expect(received[0]).toMatchObject({
        type: "complete",
        toolCallId: TOOL_CALL_ID,
        toolName: TOOL_NAME,
        data: "검색 완료 — 42개 매칭 발견",
      });
    });

    it("metadata를 포함하여 발행한다", () => {
      const emitter = createMockEmitter();
      const received: ToolStreamEvent[] = [];
      emitter.on("tool:stream", (e) => received.push(e));

      const stream = new ToolStreamEmitter(TOOL_CALL_ID, TOOL_NAME, emitter);
      stream.complete("완료", { itemsFound: 42, elapsedMs: 1500 });

      expect(received[0].metadata).toEqual({ itemsFound: 42, elapsedMs: 1500 });
    });
  });

  describe("events가 undefined일 때 (no-op)", () => {
    it("progress() 호출이 에러를 던지지 않는다", () => {
      const stream = new ToolStreamEmitter(TOOL_CALL_ID, TOOL_NAME, undefined);
      expect(() => stream.progress("메시지")).not.toThrow();
    });

    it("chunk() 호출이 에러를 던지지 않는다", () => {
      const stream = new ToolStreamEmitter(TOOL_CALL_ID, TOOL_NAME, undefined);
      expect(() => stream.chunk("데이터")).not.toThrow();
    });

    it("warning() 호출이 에러를 던지지 않는다", () => {
      const stream = new ToolStreamEmitter(TOOL_CALL_ID, TOOL_NAME, undefined);
      expect(() => stream.warning("경고")).not.toThrow();
    });

    it("complete() 호출이 에러를 던지지 않는다", () => {
      const stream = new ToolStreamEmitter(TOOL_CALL_ID, TOOL_NAME, undefined);
      expect(() => stream.complete("완료")).not.toThrow();
    });

    it("이벤트가 발행되지 않는다 (no emit)", () => {
      const emitter = createMockEmitter();
      const spy = vi.fn();
      emitter.on("tool:stream", spy);

      // undefined events로 emitter 생성 후 발행
      const stream = new ToolStreamEmitter(TOOL_CALL_ID, TOOL_NAME, undefined);
      stream.progress("무시됨");
      stream.chunk("무시됨");
      stream.warning("무시됨");
      stream.complete("무시됨");

      // emitter에는 이벤트가 도달하지 않아야 함
      expect(spy).not.toHaveBeenCalled();
    });
  });

  describe("toolCallId와 toolName이 이벤트에 포함된다", () => {
    it("다른 toolCallId로 생성된 emitter는 해당 ID를 사용한다", () => {
      const emitter = createMockEmitter();
      const received: ToolStreamEvent[] = [];
      emitter.on("tool:stream", (e) => received.push(e));

      const stream = new ToolStreamEmitter("different-id", "web_fetch", emitter);
      stream.chunk("청크");

      expect(received[0].toolCallId).toBe("different-id");
      expect(received[0].toolName).toBe("web_fetch");
    });
  });
});

// ─── createToolStreamEmitter ──────────────────────────────────────────────────

describe("createToolStreamEmitter", () => {
  it("ToolContext에서 ToolStreamEmitter를 생성한다", () => {
    const emitter = createMockEmitter();
    const received: ToolStreamEvent[] = [];
    emitter.on("tool:stream", (e) => received.push(e));

    const context = makeContext(emitter, "ctx-call-1");
    const stream = createToolStreamEmitter(context, context.toolCallId!, "glob_search");
    stream.progress("검색 중...");

    expect(received).toHaveLength(1);
    expect(received[0].toolCallId).toBe("ctx-call-1");
    expect(received[0].toolName).toBe("glob_search");
  });

  it("context.events가 undefined이면 no-op emitter를 반환한다", () => {
    const context = makeContext(undefined, "call-999");
    const stream = createToolStreamEmitter(context, "call-999", "file_read");

    // 에러 없이 실행되어야 함
    expect(() => {
      stream.progress("진행");
      stream.chunk("청크");
      stream.warning("경고");
      stream.complete("완료");
    }).not.toThrow();
  });

  it("ToolStreamEmitter 인스턴스를 반환한다", () => {
    const context = makeContext(createMockEmitter(), "call-777");
    const stream = createToolStreamEmitter(context, "call-777", "bash_exec");
    expect(stream).toBeInstanceOf(ToolStreamEmitter);
  });
});

// ─── ToolStreamCollector ──────────────────────────────────────────────────────

describe("ToolStreamCollector", () => {
  let emitter: AppEventEmitter;
  let collector: ToolStreamCollector;

  beforeEach(() => {
    emitter = createMockEmitter();
    collector = new ToolStreamCollector();
  });

  it("attach 후 이벤트를 수집한다", () => {
    collector.attach(emitter);

    const stream = new ToolStreamEmitter("id-1", "tool_a", emitter);
    stream.progress("시작");
    stream.chunk("결과1");
    stream.complete("완료");

    expect(collector.events).toHaveLength(3);
    expect(collector.events[0].type).toBe("progress");
    expect(collector.events[1].type).toBe("chunk");
    expect(collector.events[2].type).toBe("complete");
  });

  it("detach 후에는 이벤트를 수집하지 않는다", () => {
    const detach = collector.attach(emitter);

    const stream = new ToolStreamEmitter("id-2", "tool_b", emitter);
    stream.progress("이벤트 1");
    expect(collector.events).toHaveLength(1);

    detach();

    stream.chunk("이벤트 2 — 수집 안 됨");
    expect(collector.events).toHaveLength(1); // 그대로여야 함
  });

  it("여러 도구의 이벤트를 모두 수집한다", () => {
    collector.attach(emitter);

    const streamA = new ToolStreamEmitter("id-a", "tool_a", emitter);
    const streamB = new ToolStreamEmitter("id-b", "tool_b", emitter);

    streamA.progress("A 진행");
    streamB.warning("B 경고");
    streamA.complete("A 완료");

    expect(collector.events).toHaveLength(3);
    expect(collector.events.map((e) => e.toolCallId)).toEqual(["id-a", "id-b", "id-a"]);
  });

  it("clear()가 수집된 이벤트를 모두 제거한다", () => {
    collector.attach(emitter);

    const stream = new ToolStreamEmitter("id-c", "tool_c", emitter);
    stream.progress("이벤트");
    stream.chunk("이벤트");

    expect(collector.events).toHaveLength(2);
    collector.clear();
    expect(collector.events).toHaveLength(0);
  });

  it("이벤트 수집 시 metadata가 올바르게 전달된다", () => {
    collector.attach(emitter);

    const stream = new ToolStreamEmitter("id-d", "tool_d", emitter);
    stream.progress("진행", { percentComplete: 75, bytesProcessed: 7680 });

    expect(collector.events[0].metadata).toEqual({
      percentComplete: 75,
      bytesProcessed: 7680,
    });
  });

  it("attach 없이 events 배열은 빈 배열로 시작한다", () => {
    expect(collector.events).toEqual([]);
  });

  it("attach를 여러 번 호출하면 각각 독립적으로 동작한다", () => {
    const collector2 = new ToolStreamCollector();
    const detach1 = collector.attach(emitter);
    const detach2 = collector2.attach(emitter);

    const stream = new ToolStreamEmitter("id-e", "tool_e", emitter);
    stream.chunk("공유 이벤트");

    expect(collector.events).toHaveLength(1);
    expect(collector2.events).toHaveLength(1);

    detach1();
    detach2();
  });
});
