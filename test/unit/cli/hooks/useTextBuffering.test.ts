import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

let stateStore: Map<number, unknown>;
let stateIndex: number;
let effectCleanups: Array<() => void>;

function resetState() {
  stateStore = new Map();
  stateIndex = 0;
  effectCleanups = [];
}

function runCleanups() {
  for (const cleanup of effectCleanups) {
    cleanup();
  }
  effectCleanups = [];
}

// Re-render: reset index so hooks read from same slots
function rerender() {
  stateIndex = 0;
}

vi.mock("react", () => {
  return {
    useState: (initial: unknown) => {
      const idx = stateIndex++;
      if (!stateStore.has(idx)) {
        stateStore.set(idx, initial);
      }
      const setState = (val: unknown) => {
        const current = stateStore.get(idx);
        const next = typeof val === "function" ? (val as (prev: unknown) => unknown)(current) : val;
        stateStore.set(idx, next);
      };
      return [stateStore.get(idx), setState];
    },
    useCallback: (fn: unknown) => fn,
    useRef: (initial: unknown) => {
      const idx = stateIndex++;
      if (!stateStore.has(idx)) {
        stateStore.set(idx, { current: initial });
      }
      return stateStore.get(idx);
    },
    useEffect: (fn: () => (() => void) | void) => {
      const cleanup = fn();
      if (typeof cleanup === "function") {
        effectCleanups.push(cleanup);
      }
    },
  };
});

import { useTextBuffering } from "../../../../src/cli/hooks/useTextBuffering.js";

describe("useTextBuffering", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    resetState();
  });

  afterEach(() => {
    runCleanups();
    vi.useRealTimers();
  });

  it("should start with empty text", () => {
    const { text } = useTextBuffering();
    expect(text).toBe("");
  });

  it("should not immediately flush appended text to state", () => {
    const { appendText } = useTextBuffering();
    appendText("hello");

    rerender();
    const { text } = useTextBuffering();
    expect(text).toBe("");
  });

  it("should flush buffered text after intervalMs", () => {
    const { appendText } = useTextBuffering(50);
    appendText("hello");

    vi.advanceTimersByTime(50);

    rerender();
    const { text } = useTextBuffering(50);
    expect(text).toBe("hello");
  });

  it("should batch multiple rapid appendText calls into one flush", () => {
    const { appendText } = useTextBuffering(50);
    appendText("a");
    appendText("b");
    appendText("c");

    vi.advanceTimersByTime(50);

    rerender();
    const { text } = useTextBuffering(50);
    expect(text).toBe("abc");
  });

  it("should accumulate across multiple flush cycles", () => {
    const { appendText } = useTextBuffering(50);
    appendText("first");

    vi.advanceTimersByTime(50);

    rerender();
    const hook2 = useTextBuffering(50);
    expect(hook2.text).toBe("first");

    hook2.appendText(" second");
    vi.advanceTimersByTime(50);

    rerender();
    const hook3 = useTextBuffering(50);
    expect(hook3.text).toBe("first second");
  });

  it("should immediately output all buffered text on flush()", () => {
    const { appendText, flush } = useTextBuffering(50);
    appendText("buf");
    appendText("fered");
    flush();

    rerender();
    const { text } = useTextBuffering(50);
    expect(text).toBe("buffered");
  });

  it("flush() should be a no-op when buffer is empty", () => {
    const { flush } = useTextBuffering(50);
    flush();

    rerender();
    const { text } = useTextBuffering(50);
    expect(text).toBe("");
  });

  it("should clear both buffer and state on reset()", () => {
    const { appendText } = useTextBuffering(50);
    appendText("some text");
    vi.advanceTimersByTime(50);

    rerender();
    const hook2 = useTextBuffering(50);
    expect(hook2.text).toBe("some text");

    hook2.appendText("more");
    hook2.reset();

    rerender();
    const hook3 = useTextBuffering(50);
    expect(hook3.text).toBe("");

    // Advancing timers should not resurface old buffered text
    vi.advanceTimersByTime(100);

    rerender();
    const hook4 = useTextBuffering(50);
    expect(hook4.text).toBe("");
  });

  it("should not lose text during rapid sequential input", () => {
    const { appendText, flush } = useTextBuffering(50);
    const chunks = Array.from({ length: 100 }, (_, i) => `c${i}`);

    for (const chunk of chunks) {
      appendText(chunk);
    }

    flush();

    rerender();
    const { text } = useTextBuffering(50);
    expect(text).toBe(chunks.join(""));
  });

  it("should handle interleaved append and flush cycles", () => {
    const { appendText } = useTextBuffering(50);
    appendText("A");
    appendText("B");

    vi.advanceTimersByTime(50);

    rerender();
    const hook2 = useTextBuffering(50);
    hook2.appendText("C");
    hook2.flush();

    rerender();
    const hook3 = useTextBuffering(50);
    expect(hook3.text).toBe("ABC");
  });

  it("should use custom interval", () => {
    const { appendText } = useTextBuffering(100);
    appendText("wait");

    vi.advanceTimersByTime(50);

    rerender();
    const hook2 = useTextBuffering(100);
    expect(hook2.text).toBe("");

    vi.advanceTimersByTime(50);

    rerender();
    const hook3 = useTextBuffering(100);
    expect(hook3.text).toBe("wait");
  });

  it("should clean up timer on unmount", () => {
    const clearTimeoutSpy = vi.spyOn(global, "clearTimeout");

    const { appendText } = useTextBuffering(50);
    appendText("pending");

    runCleanups();

    expect(clearTimeoutSpy).toHaveBeenCalled();
    clearTimeoutSpy.mockRestore();
  });
});
