import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  parseKeyCombo,
  formatKeyCombo,
  getEffectiveBindings,
  buildKeybindings,
  DEFAULT_BINDINGS,
  ACTION_DESCRIPTIONS,
} from "../../../src/cli/hooks/useKeybindings.js";
import { keybindingsCommand } from "../../../src/commands/keybindings.js";

describe("parseKeyCombo", () => {
  it("should parse simple keys", () => {
    expect(parseKeyCombo("escape")).toEqual({
      key: "escape",
      ctrl: false,
      meta: false,
      shift: false,
    });
  });

  it("should parse ctrl+key", () => {
    expect(parseKeyCombo("ctrl+o")).toEqual({ key: "o", ctrl: true, meta: false, shift: false });
  });

  it("should parse alt+key", () => {
    expect(parseKeyCombo("alt+t")).toEqual({ key: "t", ctrl: false, meta: true, shift: false });
  });

  it("should parse option+key as alt", () => {
    expect(parseKeyCombo("option+t")).toEqual({ key: "t", ctrl: false, meta: true, shift: false });
  });

  it("should parse shift+tab", () => {
    expect(parseKeyCombo("shift+tab")).toEqual({
      key: "tab",
      ctrl: false,
      meta: false,
      shift: true,
    });
  });

  it("should parse ctrl+j", () => {
    expect(parseKeyCombo("ctrl+j")).toEqual({ key: "j", ctrl: true, meta: false, shift: false });
  });

  it("should be case-insensitive", () => {
    expect(parseKeyCombo("Ctrl+O")).toEqual({ key: "o", ctrl: true, meta: false, shift: false });
  });
});

describe("formatKeyCombo", () => {
  it("should format simple key", () => {
    expect(formatKeyCombo({ key: "escape" })).toBe("Escape");
  });

  it("should format ctrl+key", () => {
    expect(formatKeyCombo({ key: "o", ctrl: true })).toBe("Ctrl+O");
  });

  it("should format alt+key", () => {
    expect(formatKeyCombo({ key: "t", meta: true })).toBe("Alt+T");
  });

  it("should format shift+tab", () => {
    expect(formatKeyCombo({ key: "tab", shift: true })).toBe("Shift+Tab");
  });

  it("should format ctrl+alt+key", () => {
    expect(formatKeyCombo({ key: "x", ctrl: true, meta: true })).toBe("Ctrl+Alt+X");
  });
});

describe("getEffectiveBindings", () => {
  it("should return defaults when no user config", () => {
    const result = getEffectiveBindings({});
    expect(result).toEqual(DEFAULT_BINDINGS);
  });

  it("should override defaults with user config", () => {
    const result = getEffectiveBindings({
      "ctrl+x": "cancel",
    });
    // "escape" -> "cancel" default should be removed since user remapped cancel
    expect(result["escape"]).toBeUndefined();
    expect(result["ctrl+x"]).toBe("cancel");
    // Other defaults should still exist
    expect(result["ctrl+o"]).toBe("toggle-verbose");
  });

  it("should add new user bindings", () => {
    const result = getEffectiveBindings({
      "ctrl+q": "exit",
    });
    // ctrl+d -> exit default should be removed since user remapped exit
    expect(result["ctrl+d"]).toBeUndefined();
    expect(result["ctrl+q"]).toBe("exit");
  });
});

describe("buildKeybindings", () => {
  it("should build keybindings from bindings map and handlers", () => {
    const handler = vi.fn();
    const result = buildKeybindings({ "ctrl+o": "toggle-verbose" }, { "toggle-verbose": handler });
    expect(result).toHaveLength(1);
    expect(result[0].key).toBe("o");
    expect(result[0].ctrl).toBe(true);
    expect(result[0].action).toBe("toggle-verbose");
    result[0].handler();
    expect(handler).toHaveBeenCalled();
  });

  it("should skip bindings without a matching handler", () => {
    const result = buildKeybindings({ "ctrl+o": "toggle-verbose" }, {});
    expect(result).toHaveLength(0);
  });

  it("should handle escape key", () => {
    const handler = vi.fn();
    const result = buildKeybindings({ escape: "cancel" }, { cancel: handler });
    expect(result).toHaveLength(1);
    expect(result[0].key).toBe("escape");
  });

  it("should handle shift modifier", () => {
    const handler = vi.fn();
    const result = buildKeybindings({ "shift+tab": "cycle-mode" }, { "cycle-mode": handler });
    expect(result).toHaveLength(1);
    expect(result[0].key).toBe("tab");
    expect(result[0].shift).toBe(true);
  });
});

describe("DEFAULT_BINDINGS", () => {
  it("should have all expected default bindings", () => {
    expect(DEFAULT_BINDINGS["escape"]).toBe("cancel");
    expect(DEFAULT_BINDINGS["ctrl+j"]).toBe("newline");
    expect(DEFAULT_BINDINGS["shift+tab"]).toBe("cycle-mode");
    expect(DEFAULT_BINDINGS["ctrl+o"]).toBe("toggle-verbose");
    expect(DEFAULT_BINDINGS["ctrl+d"]).toBe("exit");
    expect(DEFAULT_BINDINGS["alt+t"]).toBe("toggle-thinking");
  });
});

describe("ACTION_DESCRIPTIONS", () => {
  it("should have descriptions for all default actions", () => {
    const actions = new Set(Object.values(DEFAULT_BINDINGS));
    for (const action of actions) {
      expect(ACTION_DESCRIPTIONS[action]).toBeDefined();
    }
  });
});

describe("/keybindings command", () => {
  const baseContext = {
    workingDirectory: process.cwd(),
    model: "test-model",
    sessionId: "test-session",
    emit: () => {},
  };

  it("should have correct metadata", () => {
    expect(keybindingsCommand.name).toBe("keybindings");
    expect(keybindingsCommand.description).toBeDefined();
    expect(keybindingsCommand.execute).toBeTypeOf("function");
  });

  it("should display keyboard shortcuts", async () => {
    const result = await keybindingsCommand.execute("", baseContext);
    expect(result.success).toBe(true);
    expect(result.output).toContain("Keyboard Shortcuts:");
    expect(result.output).toContain("Escape");
    expect(result.output).toContain("Ctrl+O");
    expect(result.output).toContain("Ctrl+D");
    expect(result.output).toContain("Alt+T");
    expect(result.output).toContain("Ctrl+J");
    expect(result.output).toContain("Config:");
  });
});
