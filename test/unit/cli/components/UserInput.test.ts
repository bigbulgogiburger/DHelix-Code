import { describe, it, expect, vi, beforeEach } from "vitest";

// Capture the useInput callback
let useInputCallback: ((input: string, key: Record<string, boolean>) => void) | null = null;
let stateStore: Map<number, unknown>;
let stateIndex: number;

function resetState() {
  stateStore = new Map();
  stateIndex = 0;
}

// Track history calls
const historyMock = {
  addToHistory: vi.fn(),
  navigateUp: vi.fn<[], string | undefined>(),
  navigateDown: vi.fn<[], string | undefined>(),
  reset: vi.fn(),
  history: [] as readonly string[],
};

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
    useRef: (initial: unknown) => {
      const idx = stateIndex++;
      if (!stateStore.has(idx)) {
        stateStore.set(idx, { current: initial });
      }
      return stateStore.get(idx);
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

// Mock useInputHistory hook
vi.mock("../../../../src/cli/hooks/useInput.js", () => ({
  useInputHistory: () => historyMock,
}));

async function getComponent() {
  const mod = await import("../../../../src/cli/components/UserInput.js");
  return mod.UserInput;
}

// State indices: 0 = value (string), 1 = cursorOffset (number), 2 = savedInputRef
function getValue(): string {
  return stateStore.get(0) as string;
}

function getCursor(): number {
  return stateStore.get(1) as number;
}

function getSavedInputRef(): { current: string | null } {
  return stateStore.get(2) as { current: string | null };
}

function key(overrides: Partial<Record<string, boolean>> = {}): Record<string, boolean> {
  return {
    return: false,
    backspace: false,
    delete: false,
    ctrl: false,
    meta: false,
    shift: false,
    leftArrow: false,
    rightArrow: false,
    upArrow: false,
    downArrow: false,
    ...overrides,
  };
}

describe("UserInput", () => {
  let onSubmit: ReturnType<typeof vi.fn>;
  let onChange: ReturnType<typeof vi.fn>;
  let UserInput: Awaited<ReturnType<typeof getComponent>>;

  // Re-render the component so useInput picks up fresh closures over current state
  function rerender(props?: { isDisabled?: boolean; slashMenuVisible?: boolean }) {
    stateIndex = 0;
    UserInput({
      onSubmit,
      onChange,
      isDisabled: props?.isDisabled ?? false,
      slashMenuVisible: props?.slashMenuVisible ?? false,
    });
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
    historyMock.addToHistory.mockClear();
    historyMock.navigateUp.mockClear();
    historyMock.navigateDown.mockClear();
    historyMock.reset.mockClear();
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

    it("should submit when terminal sends \\n (linefeed) instead of key.return", () => {
      press("h");
      press("i");
      press("\n");
      expect(onSubmit).toHaveBeenCalledWith("hi");
    });

    it("should submit when terminal sends \\r (carriage return) as input", () => {
      press("h");
      press("i");
      press("\r");
      expect(onSubmit).toHaveBeenCalledWith("hi");
    });

    it("should not insert \\n or \\r as text characters", () => {
      press("a");
      press("\n");
      // \n should trigger submit, not insert a newline
      expect(getValue()).toBe("");
      expect(onSubmit).toHaveBeenCalledWith("a");
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

    it("should add to history on submit", () => {
      press("h");
      press("i");
      press("", { return: true });
      expect(historyMock.addToHistory).toHaveBeenCalledWith("hi");
    });
  });

  describe("input history navigation", () => {
    it("should navigate up through history", () => {
      historyMock.navigateUp.mockReturnValue("previous command");
      press("current");
      press("", { upArrow: true });
      expect(historyMock.navigateUp).toHaveBeenCalled();
      expect(getValue()).toBe("previous command");
      expect(getCursor()).toBe("previous command".length);
    });

    it("should save current input when starting history navigation", () => {
      press("c");
      press("u");
      press("r");
      historyMock.navigateUp.mockReturnValue("old");
      press("", { upArrow: true });
      expect(getSavedInputRef().current).toBe("cur");
    });

    it("should restore saved input when navigating down past latest", () => {
      // Type something and navigate up
      press("m");
      press("y");
      historyMock.navigateUp.mockReturnValue("old");
      press("", { upArrow: true });
      expect(getSavedInputRef().current).toBe("my");

      // Navigate down returns empty string (past latest)
      historyMock.navigateDown.mockReturnValue("");
      press("", { downArrow: true });
      expect(getValue()).toBe("my");
      expect(getSavedInputRef().current).toBeNull();
    });

    it("should navigate down through history", () => {
      historyMock.navigateDown.mockReturnValue("next command");
      press("", { downArrow: true });
      expect(historyMock.navigateDown).toHaveBeenCalled();
      expect(getValue()).toBe("next command");
      expect(getCursor()).toBe("next command".length);
    });

    it("should do nothing when navigateUp returns undefined", () => {
      historyMock.navigateUp.mockReturnValue(undefined);
      press("a");
      press("b");
      press("", { upArrow: true });
      expect(getValue()).toBe("ab");
    });

    it("should do nothing when navigateDown returns undefined", () => {
      historyMock.navigateDown.mockReturnValue(undefined);
      press("a");
      press("b");
      press("", { downArrow: true });
      expect(getValue()).toBe("ab");
    });
  });

  describe("multiline input", () => {
    it("should submit on Shift+Enter (IME compatibility — Enter always submits)", () => {
      press("a");
      press("b");
      press("", { return: true, shift: true });
      // Enter always submits regardless of shift state (Korean IME sets shift=true)
      expect(onSubmit).toHaveBeenCalledWith("ab");
    });

    it("should insert newline on Ctrl+J", () => {
      press("h");
      press("i");
      press("j", { ctrl: true });
      expect(getValue()).toBe("hi\n");
      expect(getCursor()).toBe(3);
    });

    it("should insert newline at cursor position with Ctrl+J", () => {
      press("a");
      press("b");
      press("", { leftArrow: true }); // cursor at 1
      press("j", { ctrl: true }); // newline between a and b
      expect(getValue()).toBe("a\nb");
      expect(getCursor()).toBe(2);
    });

    it("should submit multiline input with Enter", () => {
      press("l");
      press("1");
      press("j", { ctrl: true }); // newline via Ctrl+J
      press("l");
      press("2");
      press("", { return: true }); // submit
      expect(onSubmit).toHaveBeenCalledWith("l1\nl2");
    });
  });

  describe("slashMenuVisible behavior", () => {
    function rerenderWithMenu() {
      rerender({ slashMenuVisible: true });
    }

    function pressWithMenu(input: string, k: Partial<Record<string, boolean>> = {}) {
      if (useInputCallback) {
        useInputCallback(input, key(k));
      }
      rerenderWithMenu();
    }

    it("should ignore upArrow when slashMenuVisible is true", () => {
      rerenderWithMenu();
      pressWithMenu("a");
      pressWithMenu("b");
      historyMock.navigateUp.mockReturnValue("old command");
      pressWithMenu("", { upArrow: true });
      // Should NOT navigate history — value unchanged
      expect(getValue()).toBe("ab");
      expect(historyMock.navigateUp).not.toHaveBeenCalled();
    });

    it("should ignore downArrow when slashMenuVisible is true", () => {
      rerenderWithMenu();
      historyMock.navigateDown.mockReturnValue("next command");
      pressWithMenu("", { downArrow: true });
      // Should NOT navigate history
      expect(historyMock.navigateDown).not.toHaveBeenCalled();
    });

    it("should ignore tab when slashMenuVisible is true", () => {
      rerenderWithMenu();
      pressWithMenu("h");
      const valueBefore = getValue();
      pressWithMenu("", { tab: true });
      // Tab should be ignored, value unchanged
      expect(getValue()).toBe(valueBefore);
    });

    it("should still accept character input when slashMenuVisible is true", () => {
      rerenderWithMenu();
      pressWithMenu("h");
      pressWithMenu("e");
      pressWithMenu("l");
      pressWithMenu("p");
      expect(getValue()).toBe("help");
    });

    it("should still handle backspace when slashMenuVisible is true", () => {
      rerenderWithMenu();
      pressWithMenu("a");
      pressWithMenu("b");
      pressWithMenu("", { backspace: true });
      expect(getValue()).toBe("a");
    });

    it("should still handle Ctrl+U when slashMenuVisible is true", () => {
      rerenderWithMenu();
      pressWithMenu("a");
      pressWithMenu("b");
      pressWithMenu("u", { ctrl: true });
      expect(getValue()).toBe("");
    });

    it("should still submit on Enter when slashMenuVisible is true", () => {
      rerenderWithMenu();
      pressWithMenu("h");
      pressWithMenu("i");
      pressWithMenu("", { return: true });
      expect(onSubmit).toHaveBeenCalledWith("hi");
    });

    it("should handle upArrow normally when slashMenuVisible is false", () => {
      rerender({ slashMenuVisible: false });
      press("a");
      historyMock.navigateUp.mockReturnValue("old");
      press("", { upArrow: true });
      expect(historyMock.navigateUp).toHaveBeenCalled();
      expect(getValue()).toBe("old");
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
