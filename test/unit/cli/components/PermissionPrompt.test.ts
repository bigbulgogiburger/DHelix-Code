import { describe, it, expect, vi, beforeEach } from "vitest";

// Capture the useInput callback
let useInputCallback: ((input: string, key: Record<string, boolean>) => void) | null = null;
let stateStore: Map<number, unknown>;
let stateIndex: number;

function resetState() {
  stateStore = new Map();
  stateIndex = 0;
}

// Mock react hooks
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
  };
});

// Mock ink
vi.mock("ink", () => ({
  Box: () => null,
  Text: () => null,
  useInput: (callback: (input: string, key: Record<string, boolean>) => void, opts?: { isActive?: boolean }) => {
    if (opts?.isActive !== false) {
      useInputCallback = callback;
    } else {
      useInputCallback = null;
    }
  },
}));

function key(overrides: Partial<Record<string, boolean>> = {}): Record<string, boolean> {
  return {
    return: false,
    leftArrow: false,
    rightArrow: false,
    ...overrides,
  };
}

async function getComponent() {
  const mod = await import("../../../../src/cli/components/PermissionPrompt.js");
  return mod.PermissionPrompt;
}

// State indices: 0 = selectedIndex, 1 = answered
function getSelectedIndex(): number {
  return stateStore.get(0) as number;
}

function getAnswered(): boolean {
  return stateStore.get(1) as boolean;
}

describe("PermissionPrompt", () => {
  let onResponse: ReturnType<typeof vi.fn>;
  let PermissionPrompt: Awaited<ReturnType<typeof getComponent>>;

  function rerender() {
    stateIndex = 0;
    PermissionPrompt({
      toolName: "bash_exec",
      description: "Run command: npm test",
      onResponse,
    });
  }

  function press(input: string, k: Partial<Record<string, boolean>> = {}) {
    if (useInputCallback) {
      useInputCallback(input, key(k));
    }
    rerender();
  }

  beforeEach(async () => {
    resetState();
    onResponse = vi.fn();
    PermissionPrompt = await getComponent();
    rerender();
  });

  describe("initial state", () => {
    it("should start with first option selected", () => {
      expect(getSelectedIndex()).toBe(0);
    });

    it("should not be answered initially", () => {
      expect(getAnswered()).toBe(false);
    });
  });

  describe("arrow key navigation", () => {
    it("should move right to next option", () => {
      press("", { rightArrow: true });
      expect(getSelectedIndex()).toBe(1);
    });

    it("should wrap around from last to first on right arrow", () => {
      press("", { rightArrow: true }); // 1
      press("", { rightArrow: true }); // 2
      press("", { rightArrow: true }); // 0 (wrap)
      expect(getSelectedIndex()).toBe(0);
    });

    it("should move left to previous option", () => {
      press("", { rightArrow: true }); // 1
      press("", { leftArrow: true }); // 0
      expect(getSelectedIndex()).toBe(0);
    });

    it("should wrap around from first to last on left arrow", () => {
      press("", { leftArrow: true }); // wrap to 2
      expect(getSelectedIndex()).toBe(2);
    });
  });

  describe("Enter confirms selection", () => {
    it("should call onResponse with 'yes' when Allow once is selected (index 0)", () => {
      press("", { return: true });
      expect(onResponse).toHaveBeenCalledWith("yes");
      expect(getAnswered()).toBe(true);
    });

    it("should call onResponse with 'always' when Allow for session is selected (index 1)", () => {
      press("", { rightArrow: true }); // index 1
      press("", { return: true });
      expect(onResponse).toHaveBeenCalledWith("always");
    });

    it("should call onResponse with 'no' when Deny is selected (index 2)", () => {
      press("", { rightArrow: true }); // 1
      press("", { rightArrow: true }); // 2
      press("", { return: true });
      expect(onResponse).toHaveBeenCalledWith("no");
    });

    it("should not respond to input after answered", () => {
      press("", { return: true }); // answered = true
      // After re-render with answered=true, useInput isActive should be false
      expect(useInputCallback).toBeNull();
    });
  });

  describe("exports", () => {
    it("should export PermissionPrompt function", async () => {
      const mod = await import("../../../../src/cli/components/PermissionPrompt.js");
      expect(typeof mod.PermissionPrompt).toBe("function");
    });
  });
});
