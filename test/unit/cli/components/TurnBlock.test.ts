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
      memo: (fn: unknown) => fn,
      createElement: () => null,
    },
    memo: (fn: unknown) => fn,
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
  Static: () => null,
}));

// Mock child components
vi.mock("../../../../src/cli/components/ToolCallBlock.js", () => ({
  ToolCallBlock: () => null,
}));

vi.mock("../../../../src/cli/components/StreamingMessage.js", () => ({
  StreamingMessage: () => null,
}));

async function getComponent() {
  const mod = await import("../../../../src/cli/components/TurnBlock.js");
  return mod.TurnBlock;
}

describe("TurnBlock", () => {
  let TurnBlock: Awaited<ReturnType<typeof getComponent>>;

  beforeEach(async () => {
    resetState();
    TurnBlock = await getComponent();
  });

  describe("exports", () => {
    it("should export TurnBlock function", async () => {
      const mod = await import("../../../../src/cli/components/TurnBlock.js");
      expect(typeof mod.TurnBlock).toBe("function");
    });

    it("should be a named export", async () => {
      const mod = await import("../../../../src/cli/components/TurnBlock.js");
      expect(mod).not.toHaveProperty("default");
    });
  });

  describe("rendering", () => {
    it("should render without crashing with empty entries", () => {
      stateIndex = 0;
      const result = TurnBlock({
        turn: {
          id: "test-turn-1",
          entries: [],
          isComplete: true,
        },
      });
      expect(result).toBeDefined();
    });

    it("should render with user-message entry", () => {
      stateIndex = 0;
      const result = TurnBlock({
        turn: {
          id: "test-turn-2",
          entries: [
            {
              type: "user-message",
              timestamp: new Date(),
              data: { content: "Hello" },
            },
          ],
          isComplete: true,
        },
      });
      expect(result).toBeDefined();
    });

    it("should render with assistant-text entry", () => {
      stateIndex = 0;
      const result = TurnBlock({
        turn: {
          id: "test-turn-3",
          entries: [
            {
              type: "assistant-text",
              timestamp: new Date(),
              data: { content: "Response text", isComplete: true },
            },
          ],
          isComplete: true,
        },
      });
      expect(result).toBeDefined();
    });

    it("should render with tool entries", () => {
      stateIndex = 0;
      const result = TurnBlock({
        turn: {
          id: "test-turn-4",
          entries: [
            {
              type: "tool-start",
              timestamp: new Date(),
              data: { name: "file_read", args: { file_path: "/a.ts" } },
            },
            {
              type: "tool-complete",
              timestamp: new Date(),
              data: { name: "file_read", isError: false, output: "file contents" },
            },
          ],
          isComplete: true,
        },
      });
      expect(result).toBeDefined();
    });

    it("should render error entries", () => {
      stateIndex = 0;
      const result = TurnBlock({
        turn: {
          id: "test-turn-5",
          entries: [
            {
              type: "error",
              timestamp: new Date(),
              data: { message: "Something went wrong" },
            },
          ],
          isComplete: true,
        },
      });
      expect(result).toBeDefined();
    });

    it("should render tool-denied entries", () => {
      stateIndex = 0;
      const result = TurnBlock({
        turn: {
          id: "test-turn-6",
          entries: [
            {
              type: "tool-denied",
              timestamp: new Date(),
              data: { name: "bash_exec" },
            },
          ],
          isComplete: true,
        },
      });
      expect(result).toBeDefined();
    });

    it("should accept isLive prop", () => {
      stateIndex = 0;
      const result = TurnBlock({
        turn: {
          id: "test-turn-7",
          entries: [
            {
              type: "assistant-text",
              timestamp: new Date(),
              data: { content: "streaming..." },
            },
          ],
          isComplete: false,
        },
        isLive: true,
      });
      expect(result).toBeDefined();
    });

    it("should render a mixed turn with interleaved entries", () => {
      stateIndex = 0;
      const result = TurnBlock({
        turn: {
          id: "test-turn-8",
          entries: [
            {
              type: "user-message",
              timestamp: new Date(),
              data: { content: "Fix the bug" },
            },
            {
              type: "assistant-text",
              timestamp: new Date(),
              data: { content: "Let me read the file." },
            },
            {
              type: "tool-start",
              timestamp: new Date(),
              data: { name: "file_read", args: { file_path: "/bug.ts" } },
            },
            {
              type: "tool-complete",
              timestamp: new Date(),
              data: { name: "file_read", isError: false, output: "code" },
            },
            {
              type: "assistant-text",
              timestamp: new Date(),
              data: { content: "Found the issue.", isComplete: true },
            },
          ],
          isComplete: true,
        },
      });
      expect(result).toBeDefined();
    });
  });
});
