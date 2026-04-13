/**
 * message-list-utils.test.ts — message-list-utils 유닛 테스트
 *
 * computeVisibleWindow, shouldSkipRerender, createPlaceholder,
 * computeHiddenCount 함수들의 동작을 검증합니다.
 */
import { describe, it, expect } from "vitest";
import {
  computeVisibleWindow,
  shouldSkipRerender,
  createPlaceholder,
  computeHiddenCount,
  DEFAULT_WINDOW_CONFIG,
  type WindowConfig,
} from "../../../../src/cli/components/message-list-utils.js";
import { type AnyMessage, MessageRole } from "../../../../src/core/message-types.js";

// ──────────────────────────────────────────────────────────────────────────────
// 헬퍼: 테스트용 메시지 생성
// ──────────────────────────────────────────────────────────────────────────────

function makeUserMessage(content: string, timestamp?: Date): AnyMessage {
  return {
    role: MessageRole.User,
    content,
    timestamp: timestamp ?? new Date("2026-01-01T00:00:00Z"),
  } as AnyMessage;
}

function makeAssistantMessage(content: string, timestamp?: Date): AnyMessage {
  return {
    role: MessageRole.Assistant,
    content,
    timestamp: timestamp ?? new Date("2026-01-01T00:00:00Z"),
    toolCalls: [],
  } as AnyMessage;
}

const defaultConfig: WindowConfig = { visibleCount: 50, overscan: 10 };

// ──────────────────────────────────────────────────────────────────────────────
// computeVisibleWindow
// ──────────────────────────────────────────────────────────────────────────────

describe("computeVisibleWindow", () => {
  describe("빈 배열 처리", () => {
    it("메시지가 없으면 start=0, end=-1 을 반환한다", () => {
      const result = computeVisibleWindow(0, 0, defaultConfig);
      expect(result).toEqual({ start: 0, end: -1 });
    });

    it("음수 메시지 수도 빈 배열로 처리한다", () => {
      const result = computeVisibleWindow(-5, 0, defaultConfig);
      expect(result).toEqual({ start: 0, end: -1 });
    });
  });

  describe("메시지 수 ≤ visibleCount", () => {
    it("메시지가 visibleCount 이하면 전체 범위를 반환한다", () => {
      const result = computeVisibleWindow(10, 0, defaultConfig);
      expect(result.start).toBe(0);
      expect(result.end).toBe(9);
    });

    it("메시지 1개면 start=0, end=0", () => {
      const result = computeVisibleWindow(1, 0, defaultConfig);
      expect(result.start).toBe(0);
      expect(result.end).toBe(0);
    });
  });

  describe("메시지 수 > visibleCount", () => {
    it("스크롤 없을 때 최신 메시지 기준으로 끝 범위를 계산한다", () => {
      // totalMessages=100, scrollOffset=0 => 최신 메시지 인덱스 99
      // overscan=10이면 windowSize=70, rawStart=99-70+1=30, rawEnd=99+10=109→99
      const result = computeVisibleWindow(100, 0, defaultConfig);
      expect(result.end).toBe(99); // 마지막 인덱스
      expect(result.start).toBeGreaterThanOrEqual(0);
      expect(result.end - result.start + 1).toBeLessThanOrEqual(
        defaultConfig.visibleCount + defaultConfig.overscan * 2 + 1,
      );
    });

    it("start 는 항상 0 이상이다", () => {
      const smallConfig: WindowConfig = { visibleCount: 50, overscan: 10 };
      const result = computeVisibleWindow(5, 0, smallConfig);
      expect(result.start).toBeGreaterThanOrEqual(0);
    });

    it("end 는 totalMessages-1 을 초과하지 않는다", () => {
      const result = computeVisibleWindow(30, 0, defaultConfig);
      expect(result.end).toBeLessThanOrEqual(29);
    });
  });

  describe("scrollOffset 처리", () => {
    it("scrollOffset > 0 이면 앵커가 위로 이동한다", () => {
      const noScroll = computeVisibleWindow(200, 0, defaultConfig);
      const withScroll = computeVisibleWindow(200, 20, defaultConfig);
      // 스크롤하면 anchorEnd가 줄어들므로 end 도 줄어든다
      expect(withScroll.end).toBeLessThan(noScroll.end);
    });

    it("scrollOffset이 totalMessages를 초과해도 start>=0", () => {
      const result = computeVisibleWindow(10, 999, defaultConfig);
      expect(result.start).toBeGreaterThanOrEqual(0);
    });
  });

  describe("DEFAULT_WINDOW_CONFIG 사용", () => {
    it("config 생략 시 기본값(visibleCount=50, overscan=10)을 사용한다", () => {
      const withDefault = computeVisibleWindow(100, 0);
      const withExplicit = computeVisibleWindow(100, 0, DEFAULT_WINDOW_CONFIG);
      expect(withDefault).toEqual(withExplicit);
    });
  });

  describe("소규모 config", () => {
    it("visibleCount=5, overscan=1 일 때 렌더링 범위가 제한된다", () => {
      const smallConfig: WindowConfig = { visibleCount: 5, overscan: 1 };
      const result = computeVisibleWindow(20, 0, smallConfig);
      const windowSize = result.end - result.start + 1;
      expect(windowSize).toBeLessThanOrEqual(
        smallConfig.visibleCount + smallConfig.overscan * 2 + 1,
      );
    });
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// shouldSkipRerender
// ──────────────────────────────────────────────────────────────────────────────

describe("shouldSkipRerender", () => {
  describe("완료된 메시지 (isStreaming=false)", () => {
    it("role, content, timestamp 가 모두 같으면 true (리렌더 생략)", () => {
      const ts = new Date("2026-01-01");
      const msg = makeUserMessage("Hello", ts);
      expect(
        shouldSkipRerender(
          { message: msg, isStreaming: false },
          { message: msg, isStreaming: false },
        ),
      ).toBe(true);
    });

    it("content 가 다르면 false (리렌더 필요)", () => {
      const ts = new Date("2026-01-01");
      const prev = makeUserMessage("Hello", ts);
      const next = makeUserMessage("World", ts);
      expect(
        shouldSkipRerender(
          { message: prev, isStreaming: false },
          { message: next, isStreaming: false },
        ),
      ).toBe(false);
    });

    it("role 이 다르면 false", () => {
      const ts = new Date("2026-01-01");
      const prev = makeUserMessage("Hi", ts);
      const next = makeAssistantMessage("Hi", ts);
      expect(
        shouldSkipRerender(
          { message: prev, isStreaming: false },
          { message: next, isStreaming: false },
        ),
      ).toBe(false);
    });

    it("timestamp 가 다르면 false", () => {
      const prev = makeUserMessage("Hi", new Date("2026-01-01"));
      const next = makeUserMessage("Hi", new Date("2026-01-02"));
      expect(
        shouldSkipRerender(
          { message: prev, isStreaming: false },
          { message: next, isStreaming: false },
        ),
      ).toBe(false);
    });
  });

  describe("스트리밍 메시지 (isStreaming=true)", () => {
    it("content 가 같으면 true (리렌더 생략)", () => {
      const msg = makeAssistantMessage("Hello");
      expect(
        shouldSkipRerender(
          { message: msg, isStreaming: true },
          { message: msg, isStreaming: true },
        ),
      ).toBe(true);
    });

    it("content 가 다르면 false (리렌더 필요 — 스트리밍 업데이트)", () => {
      const prev = makeAssistantMessage("Hello");
      const next = makeAssistantMessage("Hello World");
      expect(
        shouldSkipRerender(
          { message: prev, isStreaming: true },
          { message: next, isStreaming: true },
        ),
      ).toBe(false);
    });
  });

  describe("isStreaming 상태 변화", () => {
    it("isStreaming이 false→true 로 바뀌면 false (항상 리렌더)", () => {
      const msg = makeAssistantMessage("Hello");
      expect(
        shouldSkipRerender(
          { message: msg, isStreaming: false },
          { message: msg, isStreaming: true },
        ),
      ).toBe(false);
    });

    it("isStreaming이 true→false 로 바뀌면 false (완료 시 리렌더)", () => {
      const msg = makeAssistantMessage("Hello");
      expect(
        shouldSkipRerender(
          { message: msg, isStreaming: true },
          { message: msg, isStreaming: false },
        ),
      ).toBe(false);
    });
  });

  describe("isStreaming 미지정 (undefined)", () => {
    it("두 쪽 모두 undefined면 완료 메시지로 처리한다", () => {
      const ts = new Date("2026-01-01");
      const msg = makeUserMessage("Hi", ts);
      expect(shouldSkipRerender({ message: msg }, { message: msg })).toBe(true);
    });
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// createPlaceholder
// ──────────────────────────────────────────────────────────────────────────────

describe("createPlaceholder", () => {
  it("숨겨진 메시지가 없으면 hiddenCount=0, label='' 를 반환한다", () => {
    expect(createPlaceholder(0)).toEqual({ hiddenCount: 0, label: "" });
  });

  it("음수 입력도 hiddenCount=0으로 처리한다", () => {
    expect(createPlaceholder(-10)).toEqual({ hiddenCount: 0, label: "" });
  });

  it("숨겨진 메시지가 1개이면 단수 문자열", () => {
    const result = createPlaceholder(1);
    expect(result.hiddenCount).toBe(1);
    expect(result.label).toBe("... 1 earlier message ...");
  });

  it("숨겨진 메시지가 2개이면 복수 문자열", () => {
    const result = createPlaceholder(2);
    expect(result.hiddenCount).toBe(2);
    expect(result.label).toBe("... 2 earlier messages ...");
  });

  it("숨겨진 메시지가 47개인 일반적인 케이스", () => {
    const result = createPlaceholder(47);
    expect(result.hiddenCount).toBe(47);
    expect(result.label).toBe("... 47 earlier messages ...");
  });

  it("매우 큰 숫자도 올바르게 포매팅된다", () => {
    const result = createPlaceholder(9999);
    expect(result.hiddenCount).toBe(9999);
    expect(result.label).toContain("9999");
    expect(result.label).toContain("earlier messages");
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// computeHiddenCount
// ──────────────────────────────────────────────────────────────────────────────

describe("computeHiddenCount", () => {
  it("totalMessages=0 이면 0 반환", () => {
    expect(computeHiddenCount(0, { start: 0, end: -1 })).toBe(0);
  });

  it("window.start=0 이면 숨겨진 메시지 없음", () => {
    expect(computeHiddenCount(100, { start: 0, end: 49 })).toBe(0);
  });

  it("window.start=30 이면 앞의 30개가 숨겨짐", () => {
    expect(computeHiddenCount(100, { start: 30, end: 79 })).toBe(30);
  });

  it("window.start가 totalMessages보다 크면 그 값 그대로 반환", () => {
    // 비정상 케이스지만 함수는 start 값을 반환
    expect(computeHiddenCount(10, { start: 5, end: 9 })).toBe(5);
  });
});
