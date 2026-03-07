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
    useCallback: (fn: unknown) => fn,
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

async function getComponent() {
  const mod = await import("../../../../src/cli/components/UserInput.js");
  return mod.UserInput;
}

// State indices: 0 = value (string), 1 = cursorOffset (number)
function getValue(): string {
  return stateStore.get(0) as string;
}

function getCursor(): number {
  return stateStore.get(1) as number;
}

function key(overrides: Partial<Record<string, boolean>> = {}): Record<string, boolean> {
  return {
    return: false,
    backspace: false,
    delete: false,
    ctrl: false,
    meta: false,
    leftArrow: false,
    rightArrow: false,
    ...overrides,
  };
}

describe("UserInput", () => {
  let onSubmit: ReturnType<typeof vi.fn>;
  let onChange: ReturnType<typeof vi.fn>;
  let UserInput: Awaited<ReturnType<typeof getComponent>>;

  // Re-render the component so useInput picks up fresh closures over current state
  function rerender(props?: { isDisabled?: boolean }) {
    stateIndex = 0;
    UserInput({ onSubmit, onChange, isDisabled: props?.isDisabled ?? false });
  }

  // Simulate a key press, then re-render to refresh closures
  function press(input: string, k: Partial<Record<string, boolean>> = {}) {
    if (useInputCallback) {
      useInputCallback(input, key(k));
    }
    rerender();
  }

  beforeEach(async () => {
    resetState();
    onSubmit = vi.fn();
    onChange = vi.fn();
    UserInput = await getComponent();
    rerender();
  });

  describe("character insertion", () => {
    it("should insert characters at cursor position", () => {
      press("a");
      expect(getValue()).toBe("a");
      expect(getCursor()).toBe(1);

      press("b");
      expect(getValue()).toBe("ab");
      expect(getCursor()).toBe(2);
    });

    it("should insert character in the middle when cursor is moved", () => {
      press("a");
      press("c");
      press("", { leftArrow: true }); // cursor at 1
      press("b"); // insert 'b' between 'a' and 'c'
      expect(getValue()).toBe("abc");
      expect(getCursor()).toBe(2);
    });
  });

  describe("cursor movement", () => {
    it("should move cursor left", () => {
      press("a");
      press("b");
      press("", { leftArrow: true });
      expect(getCursor()).toBe(1);
    });

    it("should not move cursor left past 0", () => {
      press("", { leftArrow: true });
      expect(getCursor()).toBe(0);
    });

    it("should move cursor right", () => {
      press("a");
      press("b");
      press("", { leftArrow: true });
      press("", { leftArrow: true });
      expect(getCursor()).toBe(0);
      press("", { rightArrow: true });
      expect(getCursor()).toBe(1);
    });

    it("should not move cursor right past value length", () => {
      press("a");
      press("", { rightArrow: true });
      expect(getCursor()).toBe(1);
    });
  });

  describe("backspace", () => {
    it("should delete character before cursor", () => {
      press("a");
      press("b");
      press("c");
      press("", { backspace: true });
      expect(getValue()).toBe("ab");
      expect(getCursor()).toBe(2);
    });

    it("should delete in the middle when cursor is moved", () => {
      press("a");
      press("b");
      press("c");
      press("", { leftArrow: true }); // cursor at 2
      press("", { backspace: true }); // deletes 'b'
      expect(getValue()).toBe("ac");
      expect(getCursor()).toBe(1);
    });

    it("should do nothing when cursor is at start", () => {
      press("a");
      press("", { leftArrow: true });
      press("", { backspace: true });
      expect(getValue()).toBe("a");
      expect(getCursor()).toBe(0);
    });
  });

  describe("readline shortcuts", () => {
    it("Ctrl+A should jump cursor to start", () => {
      press("a");
      press("b");
      press("c");
      expect(getCursor()).toBe(3);
      press("a", { ctrl: true });
      expect(getCursor()).toBe(0);
    });

    it("Ctrl+E should jump cursor to end", () => {
      press("a");
      press("b");
      press("c");
      press("", { leftArrow: true });
      press("", { leftArrow: true });
      expect(getCursor()).toBe(1);
      press("e", { ctrl: true });
      expect(getCursor()).toBe(3);
    });

    it("Ctrl+K should kill from cursor to end of line", () => {
      press("a");
      press("b");
      press("c");
      press("d");
      press("", { leftArrow: true });
      press("", { leftArrow: true });
      expect(getCursor()).toBe(2);
      press("k", { ctrl: true });
      expect(getValue()).toBe("ab");
      expect(getCursor()).toBe(2);
    });

    it("Ctrl+U should kill entire line", () => {
      press("a");
      press("b");
      press("c");
      press("u", { ctrl: true });
      expect(getValue()).toBe("");
      expect(getCursor()).toBe(0);
    });
  });

  describe("onChange callback", () => {
    it("should fire onChange on character insertion", () => {
      onChange.mockClear();
      press("x");
      expect(onChange).toHaveBeenCalledWith("x");
    });

    it("should fire onChange on backspace", () => {
      press("a");
      press("b");
      onChange.mockClear();
      press("", { backspace: true });
      expect(onChange).toHaveBeenCalledWith("a");
    });

    it("should fire onChange on Ctrl+U", () => {
      press("a");
      onChange.mockClear();
      press("u", { ctrl: true });
      expect(onChange).toHaveBeenCalledWith("");
    });

    it("should fire onChange on Ctrl+K", () => {
      press("a");
      press("b");
      press("c");
      press("", { leftArrow: true }); // cursor at 2
      onChange.mockClear();
      press("k", { ctrl: true });
      expect(onChange).toHaveBeenCalledWith("ab");
    });
  });

  describe("onSubmit", () => {
    it("should call onSubmit with trimmed value on Enter", () => {
      press("h");
      press("i");
      press("", { return: true });
      expect(onSubmit).toHaveBeenCalledWith("hi");
    });

    it("should not submit empty input", () => {
      press("", { return: true });
      expect(onSubmit).not.toHaveBeenCalled();
    });

    it("should reset value and cursor after submit", () => {
      press("h");
      press("i");
      press("", { return: true });
      expect(getValue()).toBe("");
      expect(getCursor()).toBe(0);
    });
  });

  describe("disabled state", () => {
    it("should not process input when disabled", () => {
      resetState();
      stateIndex = 0;
      UserInput({ onSubmit, onChange, isDisabled: true });
      // useInput should have been called with isActive: false, so callback is null
      expect(useInputCallback).toBeNull();
    });
  });

  describe("exports", () => {
    it("should export UserInput function", async () => {
      const mod = await import("../../../../src/cli/components/UserInput.js");
      expect(typeof mod.UserInput).toBe("function");
    });
  });
});
