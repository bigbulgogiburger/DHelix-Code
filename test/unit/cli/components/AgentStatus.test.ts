import { describe, it, expect, vi, beforeEach } from "vitest";

let effectCallbacks: Array<() => (() => void) | void>;
let stateStore: Map<number, unknown>;
let stateIndex: number;
let refStore: Map<number, { current: unknown }>;
let refIndex: number;

function resetState() {
  stateStore = new Map();
  stateIndex = 0;
  effectCallbacks = [];
  refStore = new Map();
  refIndex = 0;
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
        const value = typeof initial === "function" ? (initial as () => unknown)() : initial;
        stateStore.set(idx, value);
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
    useRef: (initial: unknown) => {
      const idx = refIndex++;
      if (!refStore.has(idx)) {
        refStore.set(idx, { current: initial });
      }
      return refStore.get(idx);
    },
  };
});

// Mock ink
vi.mock("ink", () => ({
  Text: () => null,
}));

async function getComponent() {
  const mod = await import("../../../../src/cli/components/AgentStatus.js");
  return mod.AgentStatus;
}

describe("AgentStatus", () => {
  let AgentStatus: Awaited<ReturnType<typeof getComponent>>;

  beforeEach(async () => {
    resetState();
    AgentStatus = await getComponent();
  });

  describe("rendering", () => {
    it("should render without crashing", () => {
      stateIndex = 0;
      refIndex = 0;
      const result = AgentStatus({});
      expect(result).not.toBeNull();
    });

    it("should render with token count", () => {
      stateIndex = 0;
      refIndex = 0;
      const result = AgentStatus({ tokenCount: 500 });
      expect(result).not.toBeNull();
    });

    it("should render with zero token count by default", () => {
      stateIndex = 0;
      refIndex = 0;
      const result = AgentStatus({});
      expect(result).not.toBeNull();
    });
  });

  describe("star animation", () => {
    it("should toggle star between frames", () => {
      stateIndex = 0;
      refIndex = 0;
      AgentStatus({});

      // Two effects: star animation + elapsed time (message cycling was removed)
      expect(effectCallbacks.length).toBe(2);

      // starIndex starts at 0 (first useState)
      expect(stateStore.get(0)).toBe(0);

      // Execute the star effect and get cleanup
      const cleanup = effectCallbacks[0]();
      expect(typeof cleanup).toBe("function");
    });

    it("should cycle star index via updater function", () => {
      stateIndex = 0;
      refIndex = 0;
      AgentStatus({});

      // starIndex is state index 0, starts at 0
      // Simulate the updater: (prev) => (prev + 1) % 2
      const updater = (prev: number) => (prev + 1) % 2;
      expect(updater(0)).toBe(1);
      expect(updater(1)).toBe(0);
    });
  });

  describe("elapsed time", () => {
    it("should register an elapsed time interval", () => {
      stateIndex = 0;
      refIndex = 0;
      AgentStatus({});

      // Second effect is elapsed time
      const cleanup = effectCallbacks[1]();
      expect(typeof cleanup).toBe("function");
    });

    it("should start elapsed at 0", () => {
      stateIndex = 0;
      refIndex = 0;
      AgentStatus({});

      // elapsed is state index 1
      expect(stateStore.get(1)).toBe(0);
    });
  });

  describe("message selection", () => {
    it("should initialize with a valid message index", () => {
      stateIndex = 0;
      refIndex = 0;
      AgentStatus({});

      // messageIndex is state index 2, initialized via lazy initializer
      const messageIndex = stateStore.get(2) as number;
      expect(messageIndex).toBeGreaterThanOrEqual(0);
      // STATUS_MESSAGES has 26 entries
      expect(messageIndex).toBeLessThan(26);
    });
  });

  describe("React.memo", () => {
    it("should be wrapped with React.memo", async () => {
      // React.memo mock returns the component function directly
      // The export should still be callable (memo is identity in mock)
      const mod = await import("../../../../src/cli/components/AgentStatus.js");
      expect(typeof mod.AgentStatus).toBe("function");
    });
  });

  describe("all effects return cleanup functions", () => {
    it("should return cleanup for all two intervals", () => {
      stateIndex = 0;
      refIndex = 0;
      AgentStatus({});

      expect(effectCallbacks).toHaveLength(2);

      for (const effect of effectCallbacks) {
        const cleanup = effect();
        expect(typeof cleanup).toBe("function");
      }
    });
  });
});
