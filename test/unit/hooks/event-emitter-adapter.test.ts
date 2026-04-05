/**
 * HookEventAdapter — 어댑터 연결/해제, 이벤트 전달 테스트
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import mitt from "mitt";
import {
  createHookAdapter,
  SUPPORTED_SOURCE_EVENTS,
  type SupportedSourceEvent,
} from "../../../src/hooks/event-emitter-adapter.js";
import { HookRunner } from "../../../src/hooks/runner.js";
import { type AppEvents, type AppEventEmitter } from "../../../src/utils/events.js";
import { type HookConfig } from "../../../src/hooks/types.js";

// ---------------------------------------------------------------------------
// 헬퍼
// ---------------------------------------------------------------------------

/** 새로운 mitt 기반 AppEventEmitter를 생성합니다 */
function createTestEmitter(): AppEventEmitter {
  return mitt<AppEvents>();
}

/** HookRunner.run()을 spy하여 호출 기록을 추적합니다 */
function createSpyRunner() {
  const config: HookConfig = {};
  const runner = new HookRunner(config);
  const spy = vi.spyOn(runner, "run");
  return { runner, spy };
}

// ---------------------------------------------------------------------------
// SUPPORTED_SOURCE_EVENTS
// ---------------------------------------------------------------------------

describe("SUPPORTED_SOURCE_EVENTS", () => {
  it("5개의 지원 이벤트를 포함한다", () => {
    expect(SUPPORTED_SOURCE_EVENTS).toHaveLength(5);
  });

  it("모든 예상 이벤트가 포함된다", () => {
    const expected: SupportedSourceEvent[] = [
      "tool:start",
      "tool:complete",
      "context:pre-compact",
      "context:post-compact",
      "permission:mode-change",
    ];
    for (const ev of expected) {
      expect(SUPPORTED_SOURCE_EVENTS).toContain(ev);
    }
  });
});

// ---------------------------------------------------------------------------
// createHookAdapter — 기본 생성
// ---------------------------------------------------------------------------

describe("createHookAdapter()", () => {
  it("HookEventAdapter 인터페이스를 구현한 객체를 반환한다", () => {
    const events = createTestEmitter();
    const { runner } = createSpyRunner();
    const adapter = createHookAdapter(events, runner);
    expect(typeof adapter.attach).toBe("function");
    expect(typeof adapter.detach).toBe("function");
    expect(typeof adapter.isAttached).toBe("boolean");
  });

  it("생성 직후 isAttached는 false다", () => {
    const events = createTestEmitter();
    const { runner } = createSpyRunner();
    const adapter = createHookAdapter(events, runner);
    expect(adapter.isAttached).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// attach / detach
// ---------------------------------------------------------------------------

describe("attach() / detach()", () => {
  it("attach() 후 isAttached가 true가 된다", () => {
    const events = createTestEmitter();
    const { runner } = createSpyRunner();
    const adapter = createHookAdapter(events, runner);
    adapter.attach();
    expect(adapter.isAttached).toBe(true);
  });

  it("detach() 후 isAttached가 false가 된다", () => {
    const events = createTestEmitter();
    const { runner } = createSpyRunner();
    const adapter = createHookAdapter(events, runner);
    adapter.attach();
    adapter.detach();
    expect(adapter.isAttached).toBe(false);
  });

  it("detach() 후 이벤트를 발행해도 훅이 실행되지 않는다", async () => {
    const events = createTestEmitter();
    const { runner, spy } = createSpyRunner();
    const adapter = createHookAdapter(events, runner);

    adapter.attach();
    adapter.detach();

    events.emit("tool:start", { name: "file_read", id: "tc-001" });
    // 비동기 핸들러가 있을 수 있으므로 짧게 대기
    await new Promise((r) => setTimeout(r, 10));

    expect(spy).not.toHaveBeenCalled();
  });

  it("enabledEvents 설정으로 특정 이벤트만 연결할 수 있다", async () => {
    const events = createTestEmitter();
    const { runner, spy } = createSpyRunner();
    const adapter = createHookAdapter(events, runner, {
      enabledEvents: ["tool:start"],
    });
    adapter.attach();

    // tool:complete는 enabledEvents에 없으므로 무시됨
    events.emit("tool:complete", { name: "file_read", id: "tc-002", isError: false });
    await new Promise((r) => setTimeout(r, 10));
    expect(spy).not.toHaveBeenCalled();

    // tool:start는 포함되어 있으므로 훅 실행
    events.emit("tool:start", { name: "bash_exec", id: "tc-003" });
    await new Promise((r) => setTimeout(r, 10));
    expect(spy).toHaveBeenCalledWith("PreToolUse", expect.objectContaining({ event: "PreToolUse" }));

    adapter.detach();
  });
});

// ---------------------------------------------------------------------------
// tool:start → PreToolUse
// ---------------------------------------------------------------------------

describe("tool:start → PreToolUse 변환", () => {
  it("tool:start 이벤트가 PreToolUse 훅을 트리거한다", async () => {
    const events = createTestEmitter();
    const { runner, spy } = createSpyRunner();
    const adapter = createHookAdapter(events, runner, { sessionId: "sess-1" });
    adapter.attach();

    events.emit("tool:start", { name: "file_write", id: "tc-100", args: { path: "/foo.ts" } });
    await new Promise((r) => setTimeout(r, 20));

    expect(spy).toHaveBeenCalledWith(
      "PreToolUse",
      expect.objectContaining({
        event: "PreToolUse",
        sessionId: "sess-1",
        toolCall: expect.objectContaining({ name: "file_write", id: "tc-100" }),
      }),
    );

    adapter.detach();
  });

  it("args가 없어도 빈 arguments로 구성된다", async () => {
    const events = createTestEmitter();
    const { runner, spy } = createSpyRunner();
    const adapter = createHookAdapter(events, runner);
    adapter.attach();

    events.emit("tool:start", { name: "glob_search", id: "tc-101" });
    await new Promise((r) => setTimeout(r, 20));

    const call = spy.mock.calls[0];
    expect(call[1].toolCall?.arguments).toEqual({});

    adapter.detach();
  });

  it("subagentId가 data에 포함된다", async () => {
    const events = createTestEmitter();
    const { runner, spy } = createSpyRunner();
    const adapter = createHookAdapter(events, runner);
    adapter.attach();

    events.emit("tool:start", { name: "bash_exec", id: "tc-102", subagentId: "sub-42" });
    await new Promise((r) => setTimeout(r, 20));

    const call = spy.mock.calls[0];
    expect(call[1].data?.subagentId).toBe("sub-42");

    adapter.detach();
  });
});

// ---------------------------------------------------------------------------
// tool:complete (성공) → PostToolUse
// ---------------------------------------------------------------------------

describe("tool:complete (isError: false) → PostToolUse 변환", () => {
  it("성공적인 도구 완료가 PostToolUse 훅을 트리거한다", async () => {
    const events = createTestEmitter();
    const { runner, spy } = createSpyRunner();
    const adapter = createHookAdapter(events, runner, { workingDirectory: "/project" });
    adapter.attach();

    events.emit("tool:complete", { name: "file_read", id: "tc-200", isError: false, output: "Hello" });
    await new Promise((r) => setTimeout(r, 20));

    expect(spy).toHaveBeenCalledWith(
      "PostToolUse",
      expect.objectContaining({
        event: "PostToolUse",
        workingDirectory: "/project",
        toolCall: expect.objectContaining({ name: "file_read" }),
      }),
    );

    adapter.detach();
  });
});

// ---------------------------------------------------------------------------
// tool:complete (에러) → PostToolUseFailure
// ---------------------------------------------------------------------------

describe("tool:complete (isError: true) → PostToolUseFailure 변환", () => {
  it("에러 종료 도구가 PostToolUseFailure 훅을 트리거한다", async () => {
    const events = createTestEmitter();
    const { runner, spy } = createSpyRunner();
    const adapter = createHookAdapter(events, runner);
    adapter.attach();

    events.emit("tool:complete", {
      name: "bash_exec",
      id: "tc-300",
      isError: true,
      output: "command not found",
    });
    await new Promise((r) => setTimeout(r, 20));

    expect(spy).toHaveBeenCalledWith(
      "PostToolUseFailure",
      expect.objectContaining({ event: "PostToolUseFailure" }),
    );

    adapter.detach();
  });
});

// ---------------------------------------------------------------------------
// context:pre-compact → PreCompact
// ---------------------------------------------------------------------------

describe("context:pre-compact → PreCompact 변환", () => {
  it("pre-compact 이벤트가 PreCompact 훅을 트리거한다", async () => {
    const events = createTestEmitter();
    const { runner, spy } = createSpyRunner();
    const adapter = createHookAdapter(events, runner, { sessionId: "sess-2" });
    adapter.attach();

    events.emit("context:pre-compact", { compactionNumber: 3 });
    await new Promise((r) => setTimeout(r, 20));

    expect(spy).toHaveBeenCalledWith(
      "PreCompact",
      expect.objectContaining({
        event: "PreCompact",
        sessionId: "sess-2",
        data: expect.objectContaining({ compactionNumber: 3 }),
      }),
    );

    adapter.detach();
  });
});

// ---------------------------------------------------------------------------
// context:post-compact → PreCompact (compactionComplete 플래그)
// ---------------------------------------------------------------------------

describe("context:post-compact → PreCompact(compactionComplete) 변환", () => {
  it("post-compact 이벤트가 compactionComplete 플래그와 함께 PreCompact 훅을 트리거한다", async () => {
    const events = createTestEmitter();
    const { runner, spy } = createSpyRunner();
    const adapter = createHookAdapter(events, runner);
    adapter.attach();

    events.emit("context:post-compact", {
      originalTokens: 8000,
      compactedTokens: 2500,
      removedMessages: 10,
    });
    await new Promise((r) => setTimeout(r, 20));

    expect(spy).toHaveBeenCalledWith(
      "PreCompact",
      expect.objectContaining({
        data: expect.objectContaining({
          compactionComplete: true,
          originalTokens: 8000,
          compactedTokens: 2500,
          removedMessages: 10,
        }),
      }),
    );

    adapter.detach();
  });
});

// ---------------------------------------------------------------------------
// permission:mode-change → PermissionRequest
// ---------------------------------------------------------------------------

describe("permission:mode-change → PermissionRequest 변환", () => {
  it("mode-change 이벤트가 PermissionRequest 훅을 트리거한다", async () => {
    const events = createTestEmitter();
    const { runner, spy } = createSpyRunner();
    const adapter = createHookAdapter(events, runner);
    adapter.attach();

    events.emit("permission:mode-change", { mode: "confirm" });
    await new Promise((r) => setTimeout(r, 20));

    expect(spy).toHaveBeenCalledWith(
      "PermissionRequest",
      expect.objectContaining({
        event: "PermissionRequest",
        data: expect.objectContaining({ permissionMode: "confirm" }),
      }),
    );

    adapter.detach();
  });
});

// ---------------------------------------------------------------------------
// 에러 격리(error isolation)
// ---------------------------------------------------------------------------

describe("에러 격리", () => {
  it("훅 실행 중 에러가 발생해도 이벤트 에미터가 중단되지 않는다", async () => {
    const events = createTestEmitter();
    const config: HookConfig = {};
    const runner = new HookRunner(config);
    // runner.run()이 에러를 던지도록 설정
    vi.spyOn(runner, "run").mockRejectedValue(new Error("Hook failed intentionally"));

    const stderrSpy = vi.spyOn(process.stderr, "write").mockImplementation(() => true);

    const adapter = createHookAdapter(events, runner);
    adapter.attach();

    // 에러가 발생해도 예외가 전파되지 않아야 함
    expect(() => {
      events.emit("tool:start", { name: "bash_exec", id: "tc-err" });
    }).not.toThrow();

    await new Promise((r) => setTimeout(r, 20));

    // stderr에 경고가 출력되어야 함
    expect(stderrSpy).toHaveBeenCalledWith(
      expect.stringContaining("[hook-adapter]"),
    );

    adapter.detach();
    stderrSpy.mockRestore();
  });
});

// ---------------------------------------------------------------------------
// 여러 이벤트 연속 처리
// ---------------------------------------------------------------------------

describe("여러 이벤트 연속 처리", () => {
  it("동일 이벤트를 여러 번 발행해도 각각 훅을 트리거한다", async () => {
    const events = createTestEmitter();
    const { runner, spy } = createSpyRunner();
    const adapter = createHookAdapter(events, runner);
    adapter.attach();

    events.emit("tool:start", { name: "tool_a", id: "tc-1" });
    events.emit("tool:start", { name: "tool_b", id: "tc-2" });
    events.emit("tool:start", { name: "tool_c", id: "tc-3" });
    await new Promise((r) => setTimeout(r, 30));

    expect(spy).toHaveBeenCalledTimes(3);

    adapter.detach();
  });

  it("서로 다른 이벤트 타입을 발행하면 각각 적절한 HookEvent로 변환된다", async () => {
    const events = createTestEmitter();
    const { runner, spy } = createSpyRunner();
    const adapter = createHookAdapter(events, runner);
    adapter.attach();

    events.emit("tool:start", { name: "bash_exec", id: "tc-a" });
    events.emit("tool:complete", { name: "bash_exec", id: "tc-a", isError: false });
    events.emit("context:pre-compact", { compactionNumber: 1 });
    await new Promise((r) => setTimeout(r, 30));

    const hookEvents = spy.mock.calls.map((call) => call[0]);
    expect(hookEvents).toContain("PreToolUse");
    expect(hookEvents).toContain("PostToolUse");
    expect(hookEvents).toContain("PreCompact");

    adapter.detach();
  });
});
