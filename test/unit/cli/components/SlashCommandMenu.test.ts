import { describe, it, expect, vi, beforeEach } from "vitest";
import { type SlashCommand } from "../../../../src/commands/registry.js";

let effectCallbacks: Array<() => (() => void) | void>;
let stateStore: Map<number, unknown>;
let stateIndex: number;
let inputHandler: ((_input: string, key: Record<string, boolean>) => void) | null;

function resetState() {
  stateStore = new Map();
  stateIndex = 0;
  effectCallbacks = [];
  inputHandler = null;
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
  useInput: (
    handler: (_input: string, key: Record<string, boolean>) => void,
    opts?: { isActive?: boolean },
  ) => {
    if (opts?.isActive !== false) {
      inputHandler = handler;
    }
  },
}));

function makeCommands(count: number): SlashCommand[] {
  return Array.from({ length: count }, (_, i) => ({
    name: `cmd${i}`,
    description: `Description for cmd${i}`,
    usage: `/cmd${i}`,
    execute: async () => ({ output: "", success: true }),
  }));
}

async function getComponent() {
  const mod = await import("../../../../src/cli/components/SlashCommandMenu.js");
  return mod;
}

describe("SlashCommandMenu", () => {
  let SlashCommandMenu: Awaited<ReturnType<typeof getComponent>>["SlashCommandMenu"];
  let getMatchingCommands: Awaited<ReturnType<typeof getComponent>>["getMatchingCommands"];

  beforeEach(async () => {
    resetState();
    const mod = await getComponent();
    SlashCommandMenu = mod.SlashCommandMenu;
    getMatchingCommands = mod.getMatchingCommands;
  });

  describe("getMatchingCommands", () => {
    const commands = makeCommands(5);

    it("should return empty array for non-slash input", () => {
      expect(getMatchingCommands("hello", commands)).toEqual([]);
    });

    it("should return all commands for bare slash", () => {
      expect(getMatchingCommands("/", commands)).toHaveLength(5);
    });

    it("should filter by prefix", () => {
      const result = getMatchingCommands("/cmd1", commands);
      expect(result).toHaveLength(1);
      expect(result[0]!.name).toBe("cmd1");
    });

    it("should return empty for prefix with space (already has args)", () => {
      expect(getMatchingCommands("/cmd1 arg", commands)).toEqual([]);
    });

    it("should match multiple commands with shared prefix", () => {
      const result = getMatchingCommands("/cmd", commands);
      expect(result).toHaveLength(5);
    });
  });

  describe("viewport rendering", () => {
    it("should return null when not visible", () => {
      stateIndex = 0;
      const result = SlashCommandMenu({
        commands: makeCommands(10),
        prefix: "/",
        onSelect: () => {},
        onClose: () => {},
        visible: false,
      });
      expect(result).toBeNull();
    });

    it("should return null when no commands match", () => {
      stateIndex = 0;
      const result = SlashCommandMenu({
        commands: makeCommands(3),
        prefix: "/zzz",
        onSelect: () => {},
        onClose: () => {},
        visible: true,
      });
      expect(result).toBeNull();
    });

    it("should render without scroll indicators when items fit in viewport", () => {
      stateIndex = 0;
      const result = SlashCommandMenu({
        commands: makeCommands(4),
        prefix: "/",
        onSelect: () => {},
        onClose: () => {},
        visible: true,
      });
      // Result is JSX (object), not null
      expect(result).not.toBeNull();
      // With 4 items (< MAX_VISIBLE=6), scrollOffset=0 => no indicators
      // Check the props of the rendered element
      const children = result?.props?.children;
      // children[0] = hasMoreAbove (false), children[2] = hasMoreBelow (false)
      expect(children[0]).toBe(false); // hasMoreAbove && ...
      expect(children[2]).toBe(false); // hasMoreBelow && ...
    });

    it("should show down indicator when more items exist below viewport", () => {
      stateIndex = 0;
      const result = SlashCommandMenu({
        commands: makeCommands(10),
        prefix: "/",
        onSelect: () => {},
        onClose: () => {},
        visible: true,
      });
      expect(result).not.toBeNull();
      const children = result?.props?.children;
      // hasMoreAbove = false (scrollOffset starts at 0)
      expect(children[0]).toBe(false);
      // hasMoreBelow should be truthy (rendered element)
      expect(children[2]).not.toBe(false);
    });

    it("should only render MAX_VISIBLE items from the viewport", () => {
      stateIndex = 0;
      const result = SlashCommandMenu({
        commands: makeCommands(10),
        prefix: "/",
        onSelect: () => {},
        onClose: () => {},
        visible: true,
      });
      const children = result?.props?.children;
      // children[1] is the mapped array of visible items
      const visibleItems = children[1];
      expect(visibleItems).toHaveLength(6); // MAX_VISIBLE = 6
    });
  });

  describe("keyboard navigation with scroll", () => {
    it("should scroll down when navigating past viewport bottom", () => {
      // Render with 10 commands
      stateIndex = 0;
      SlashCommandMenu({
        commands: makeCommands(10),
        prefix: "/",
        onSelect: () => {},
        onClose: () => {},
        visible: true,
      });

      // Navigate down 6 times (past MAX_VISIBLE)
      for (let i = 0; i < 6; i++) {
        inputHandler?.("", { downArrow: true } as Record<string, boolean>);
      }

      // Re-render to see updated state
      stateIndex = 0;
      const result = SlashCommandMenu({
        commands: makeCommands(10),
        prefix: "/",
        onSelect: () => {},
        onClose: () => {},
        visible: true,
      });

      const children = result?.props?.children;
      // After scrolling down 6 times from index 0:
      // selectedIndex = 6, scrollOffset = max(0, 6 - 6 + 1) = 1
      // hasMoreAbove should be truthy
      expect(children[0]).not.toBe(false);
    });

    it("should scroll up when navigating past viewport top", () => {
      // Render with 10 commands
      stateIndex = 0;
      SlashCommandMenu({
        commands: makeCommands(10),
        prefix: "/",
        onSelect: () => {},
        onClose: () => {},
        visible: true,
      });

      // Navigate down 7 times then up 3 times
      for (let i = 0; i < 7; i++) {
        inputHandler?.("", { downArrow: true } as Record<string, boolean>);
      }
      for (let i = 0; i < 3; i++) {
        inputHandler?.("", { upArrow: true } as Record<string, boolean>);
      }

      // Re-render
      stateIndex = 0;
      const result = SlashCommandMenu({
        commands: makeCommands(10),
        prefix: "/",
        onSelect: () => {},
        onClose: () => {},
        visible: true,
      });

      // Result should still be valid
      expect(result).not.toBeNull();
    });

    it("should not scroll past the beginning", () => {
      stateIndex = 0;
      SlashCommandMenu({
        commands: makeCommands(10),
        prefix: "/",
        onSelect: () => {},
        onClose: () => {},
        visible: true,
      });

      // Try navigating up from the start
      inputHandler?.("", { upArrow: true } as Record<string, boolean>);

      stateIndex = 0;
      const result = SlashCommandMenu({
        commands: makeCommands(10),
        prefix: "/",
        onSelect: () => {},
        onClose: () => {},
        visible: true,
      });

      const children = result?.props?.children;
      // Should still be at top, no up indicator
      expect(children[0]).toBe(false);
    });

    it("should not scroll past the end", () => {
      stateIndex = 0;
      SlashCommandMenu({
        commands: makeCommands(10),
        prefix: "/",
        onSelect: () => {},
        onClose: () => {},
        visible: true,
      });

      // Navigate down to the very end
      for (let i = 0; i < 15; i++) {
        inputHandler?.("", { downArrow: true } as Record<string, boolean>);
      }

      stateIndex = 0;
      const result = SlashCommandMenu({
        commands: makeCommands(10),
        prefix: "/",
        onSelect: () => {},
        onClose: () => {},
        visible: true,
      });

      const children = result?.props?.children;
      // Should show up indicator (scrolled down)
      expect(children[0]).not.toBe(false);
      // Should NOT show down indicator (at the end)
      expect(children[2]).toBe(false);
    });

    it("should call onSelect with the correct command on Enter", () => {
      const onSelect = vi.fn();
      stateIndex = 0;
      SlashCommandMenu({
        commands: makeCommands(10),
        prefix: "/",
        onSelect,
        onClose: () => {},
        visible: true,
      });

      // Navigate down twice
      inputHandler?.("", { downArrow: true } as Record<string, boolean>);
      inputHandler?.("", { downArrow: true } as Record<string, boolean>);

      // Re-render to pick up updated selectedIndex in closure
      stateIndex = 0;
      SlashCommandMenu({
        commands: makeCommands(10),
        prefix: "/",
        onSelect,
        onClose: () => {},
        visible: true,
      });

      // Now press Enter with the updated selectedIndex
      inputHandler?.("", { return: true } as Record<string, boolean>);

      expect(onSelect).toHaveBeenCalledWith("cmd2");
    });

    it("should call onClose on Escape", () => {
      const onClose = vi.fn();
      stateIndex = 0;
      SlashCommandMenu({
        commands: makeCommands(3),
        prefix: "/",
        onSelect: () => {},
        onClose,
        visible: true,
      });

      inputHandler?.("", { escape: true } as Record<string, boolean>);
      expect(onClose).toHaveBeenCalled();
    });
  });

  describe("exports", () => {
    it("should export SlashCommandMenu function", async () => {
      const mod = await import("../../../../src/cli/components/SlashCommandMenu.js");
      expect(typeof mod.SlashCommandMenu).toBe("function");
    });

    it("should export getMatchingCommands function", async () => {
      const mod = await import("../../../../src/cli/components/SlashCommandMenu.js");
      expect(typeof mod.getMatchingCommands).toBe("function");
    });
  });
});
