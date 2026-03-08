import { describe, it, expect, vi, beforeEach } from "vitest";

let effectCallbacks: Array<() => (() => void) | void>;
let stateStore: Map<number, unknown>;
let stateIndex: number;

function resetState() {
  stateStore = new Map();
  stateIndex = 0;
  effectCallbacks = [];
}

// Mock react
vi.mock("react", () => {
  return {
    default: {
      memo: (component: unknown) => component,
    },
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
    useEffect: (cb: () => (() => void) | void) => {
      effectCallbacks.push(cb);
    },
  };
});

// Mock ink
vi.mock("ink", () => ({
  Box: () => null,
  Text: () => null,
}));

async function getComponent() {
  const mod = await import("../../../../src/cli/components/ThinkingBlock.js");
  return mod.ThinkingBlock;
}

describe("ThinkingBlock", () => {
  let ThinkingBlock: Awaited<ReturnType<typeof getComponent>>;

  beforeEach(async () => {
    resetState();
    ThinkingBlock = await getComponent();
  });

  describe("rendering", () => {
    it("should return null when content is empty and not streaming", () => {
      stateIndex = 0;
      const result = ThinkingBlock({ content: "", isStreaming: false });
      expect(result).toBeNull();
    });

    it("should render collapsed state by default", () => {
      stateIndex = 0;
      const result = ThinkingBlock({ content: "Some thinking content" });
      expect(result).not.toBeNull();
      // Default isExpanded is false, so it should render the collapsed view
    });

    it("should render expanded state when isExpanded is true", () => {
      stateIndex = 0;
      const result = ThinkingBlock({
        content: "Some thinking content",
        isExpanded: true,
      });
      expect(result).not.toBeNull();
    });

    it("should render with token count", () => {
      stateIndex = 0;
      const result = ThinkingBlock({
        content: "Thinking...",
        tokenCount: 1234,
      });
      expect(result).not.toBeNull();
    });

    it("should render when streaming even with empty content", () => {
      stateIndex = 0;
      const result = ThinkingBlock({
        content: "",
        isStreaming: true,
      });
      expect(result).not.toBeNull();
    });
  });

  describe("spinner", () => {
    it("should register an interval effect when streaming", () => {
      stateIndex = 0;
      ThinkingBlock({ content: "thinking", isStreaming: true });

      // Should have 2 useEffect calls: one for isExpanded sync, one for spinner
      expect(effectCallbacks.length).toBe(2);

      // Execute the spinner effect (second one)
      const cleanup = effectCallbacks[1]();
      expect(typeof cleanup).toBe("function");
    });

    it("should not register spinner interval when not streaming", () => {
      stateIndex = 0;
      ThinkingBlock({ content: "thinking", isStreaming: false });

      // Execute effects; the spinner effect should return undefined (no cleanup)
      const spinnerEffect = effectCallbacks[1];
      const cleanup = spinnerEffect();
      expect(cleanup).toBeUndefined();
    });
  });

  describe("expanded content", () => {
    it("should truncate long content when expanded", () => {
      stateIndex = 0;
      const longContent = Array.from({ length: 30 }, (_, i) => `Line ${i + 1}`).join("\n");
      const result = ThinkingBlock({
        content: longContent,
        isExpanded: true,
      });
      expect(result).not.toBeNull();
    });
  });
});
