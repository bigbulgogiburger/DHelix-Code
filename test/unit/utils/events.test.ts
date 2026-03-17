import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  createEventEmitter,
  checkListenerLeaks,
  LISTENER_WARN_THRESHOLD,
  type AppEventEmitter,
} from "../../../src/utils/events.js";

describe("createEventEmitter", () => {
  it("should create a mitt-based emitter with on/off/emit", () => {
    const emitter = createEventEmitter();
    expect(emitter.on).toBeDefined();
    expect(emitter.off).toBeDefined();
    expect(emitter.emit).toBeDefined();
    expect(emitter.all).toBeInstanceOf(Map);
  });

  it("should emit and receive events", () => {
    const emitter = createEventEmitter();
    const handler = vi.fn();

    emitter.on("llm:start", handler);
    emitter.emit("llm:start", { iteration: 1 });

    expect(handler).toHaveBeenCalledWith({ iteration: 1 });
  });
});

describe("checkListenerLeaks", () => {
  let emitter: AppEventEmitter;

  beforeEach(() => {
    emitter = createEventEmitter();
  });

  it("should return 0 for an emitter with no listeners", () => {
    const max = checkListenerLeaks(emitter);
    expect(max).toBe(0);
  });

  it("should return the correct max count when under threshold", () => {
    for (let i = 0; i < 3; i++) {
      emitter.on("llm:start", () => {});
    }
    const max = checkListenerLeaks(emitter);
    expect(max).toBe(3);
  });

  it("should not warn when listener count is at or below threshold", () => {
    const stderrSpy = vi.spyOn(process.stderr, "write").mockImplementation(() => true);

    for (let i = 0; i < LISTENER_WARN_THRESHOLD; i++) {
      emitter.on("llm:start", () => {});
    }
    checkListenerLeaks(emitter);

    expect(stderrSpy).not.toHaveBeenCalled();
    stderrSpy.mockRestore();
  });

  it("should warn to stderr when listener count exceeds threshold", () => {
    const stderrSpy = vi.spyOn(process.stderr, "write").mockImplementation(() => true);

    for (let i = 0; i <= LISTENER_WARN_THRESHOLD; i++) {
      emitter.on("llm:start", () => {});
    }
    const max = checkListenerLeaks(emitter);

    expect(max).toBe(LISTENER_WARN_THRESHOLD + 1);
    expect(stderrSpy).toHaveBeenCalledWith(expect.stringContaining("Possible memory leak"));
    stderrSpy.mockRestore();
  });

  it("should accept a custom threshold", () => {
    const stderrSpy = vi.spyOn(process.stderr, "write").mockImplementation(() => true);

    for (let i = 0; i < 6; i++) {
      emitter.on("llm:start", () => {});
    }
    checkListenerLeaks(emitter, 5);

    expect(stderrSpy).toHaveBeenCalledWith(
      expect.stringContaining("has 6 listeners (threshold: 5)"),
    );
    stderrSpy.mockRestore();
  });

  it("should report max across multiple event types", () => {
    for (let i = 0; i < 5; i++) {
      emitter.on("llm:start", () => {});
    }
    for (let i = 0; i < 10; i++) {
      emitter.on("tool:start", () => {});
    }

    const max = checkListenerLeaks(emitter);
    expect(max).toBe(10);
  });

  it("should export LISTENER_WARN_THRESHOLD as 20", () => {
    expect(LISTENER_WARN_THRESHOLD).toBe(20);
  });
});
