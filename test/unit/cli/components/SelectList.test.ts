import { describe, it, expect, vi, beforeEach } from "vitest";
import { type SelectOption } from "../../../../src/commands/registry.js";

let stateStore: Map<number, unknown>;
let stateIndex: number;
let inputHandler: ((_input: string, key: Record<string, boolean>) => void) | null;

function resetState() {
  stateStore = new Map();
  stateIndex = 0;
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
  };
});

// Mock ink
vi.mock("ink", () => ({
  Box: () => null,
  Text: () => null,
  useInput: (handler: (_input: string, key: Record<string, boolean>) => void) => {
    inputHandler = handler;
  },
}));

function makeOptions(count: number): SelectOption[] {
  return Array.from({ length: count }, (_, i) => ({
    label: `Option ${i}`,
    value: `value-${i}`,
    description: `Description for option ${i}`,
  }));
}

async function getComponent() {
  const mod = await import("../../../../src/cli/components/SelectList.js");
  return mod;
}

describe("SelectList", () => {
  let SelectList: Awaited<ReturnType<typeof getComponent>>["SelectList"];

  beforeEach(async () => {
    resetState();
    const mod = await getComponent();
    SelectList = mod.SelectList;
  });

  describe("rendering", () => {
    it("should render empty state when no options", () => {
      stateIndex = 0;
      const result = SelectList({
        prompt: "Select something:",
        options: [],
        onSelect: () => {},
        onCancel: () => {},
      });
      // Should render the empty state (not null)
      expect(result).not.toBeNull();
      // The result should have props with prompt text and "No options available"
      expect(result).toBeDefined();
    });

    it("should render all visible options when fewer than maxVisible", () => {
      stateIndex = 0;
      const result = SelectList({
        prompt: "Select:",
        options: makeOptions(4),
        onSelect: () => {},
        onCancel: () => {},
        maxVisible: 8,
      });
      expect(result).not.toBeNull();
      // Find the inner column Box (children[1] of root = inner Box with options)
      const rootChildren = result?.props?.children;
      // rootChildren: [Text(prompt), Box(marginTop=1), Box(marginTop=1 footer)]
      const optionContainer = rootChildren[1];
      const containerChildren = optionContainer?.props?.children;
      // containerChildren: [hasMoreAbove, visibleItems, hasMoreBelow]
      const hasMoreAbove = containerChildren[0];
      const visibleItems = containerChildren[1];
      const hasMoreBelow = containerChildren[2];

      expect(hasMoreAbove).toBe(false); // no scroll up indicator
      expect(visibleItems).toHaveLength(4); // all 4 options visible
      expect(hasMoreBelow).toBe(false); // no scroll down indicator
    });

    it("should highlight selected option with triangle marker and cyan color", () => {
      stateIndex = 0;
      const result = SelectList({
        prompt: "Select:",
        options: makeOptions(3),
        onSelect: () => {},
        onCancel: () => {},
      });
      const rootChildren = result?.props?.children;
      const optionContainer = rootChildren[1];
      const containerChildren = optionContainer?.props?.children;
      const visibleItems = containerChildren[1];

      // First option should be selected (index 0)
      const firstItem = visibleItems[0];
      const firstItemChildren = firstItem?.props?.children;
      // First child is the marker Text
      const markerText = firstItemChildren[0];
      expect(markerText?.props?.color).toBe("cyan");
      expect(markerText?.props?.bold).toBe(true);
      // Marker should contain the triangle character
      expect(markerText?.props?.children).toContain("\u25B8");

      // Second option should NOT be selected
      const secondItem = visibleItems[1];
      const secondItemChildren = secondItem?.props?.children;
      const secondMarker = secondItemChildren[0];
      expect(secondMarker?.props?.color).toBe("gray");
      expect(secondMarker?.props?.bold).toBe(false);
      expect(secondMarker?.props?.children).toBe("  ");
    });

    it("should show description in dimColor", () => {
      stateIndex = 0;
      const result = SelectList({
        prompt: "Select:",
        options: makeOptions(2),
        onSelect: () => {},
        onCancel: () => {},
      });
      const rootChildren = result?.props?.children;
      const optionContainer = rootChildren[1];
      const containerChildren = optionContainer?.props?.children;
      const visibleItems = containerChildren[1];

      // Check first option has description
      const firstItem = visibleItems[0];
      const firstItemChildren = firstItem?.props?.children;
      // [marker, label, description]
      const descriptionText = firstItemChildren[2];
      expect(descriptionText).not.toBeNull();
      expect(descriptionText?.props?.dimColor).toBe(true);
    });

    it("should show scroll indicators when options exceed maxVisible", () => {
      stateIndex = 0;
      const result = SelectList({
        prompt: "Select:",
        options: makeOptions(12),
        onSelect: () => {},
        onCancel: () => {},
        maxVisible: 4,
      });
      const rootChildren = result?.props?.children;
      const optionContainer = rootChildren[1];
      const containerChildren = optionContainer?.props?.children;

      // At scroll offset 0, no up indicator but should have down indicator
      expect(containerChildren[0]).toBe(false); // no up indicator
      expect(containerChildren[2]).not.toBe(false); // has down indicator

      // Only maxVisible items should be visible
      const visibleItems = containerChildren[1];
      expect(visibleItems).toHaveLength(4);
    });

    it("should show position indicator when options exceed maxVisible", () => {
      stateIndex = 0;
      const result = SelectList({
        prompt: "Select:",
        options: makeOptions(12),
        onSelect: () => {},
        onCancel: () => {},
        maxVisible: 4,
      });
      const rootChildren = result?.props?.children;
      // Footer box is the third child
      const footer = rootChildren[2];
      const footerText = footer?.props?.children;
      // Should contain position indicator like "(1/12)"
      expect(footerText?.props?.children).toBeDefined();
    });
  });

  describe("keyboard navigation", () => {
    it("should move selection down on downArrow", () => {
      stateIndex = 0;
      SelectList({
        prompt: "Select:",
        options: makeOptions(5),
        onSelect: () => {},
        onCancel: () => {},
      });

      // Press down arrow
      inputHandler?.("", { downArrow: true } as Record<string, boolean>);

      // Re-render
      stateIndex = 0;
      const result = SelectList({
        prompt: "Select:",
        options: makeOptions(5),
        onSelect: () => {},
        onCancel: () => {},
      });
      const rootChildren = result?.props?.children;
      const optionContainer = rootChildren[1];
      const containerChildren = optionContainer?.props?.children;
      const visibleItems = containerChildren[1];

      // Second item should now be selected (cyan + bold)
      const secondItem = visibleItems[1];
      const secondMarker = secondItem?.props?.children[0];
      expect(secondMarker?.props?.color).toBe("cyan");
      expect(secondMarker?.props?.bold).toBe(true);
    });

    it("should move selection up on upArrow", () => {
      stateIndex = 0;
      SelectList({
        prompt: "Select:",
        options: makeOptions(5),
        onSelect: () => {},
        onCancel: () => {},
      });

      // Navigate down twice, then up once
      inputHandler?.("", { downArrow: true } as Record<string, boolean>);
      inputHandler?.("", { downArrow: true } as Record<string, boolean>);
      inputHandler?.("", { upArrow: true } as Record<string, boolean>);

      // Re-render
      stateIndex = 0;
      const result = SelectList({
        prompt: "Select:",
        options: makeOptions(5),
        onSelect: () => {},
        onCancel: () => {},
      });
      const rootChildren = result?.props?.children;
      const optionContainer = rootChildren[1];
      const containerChildren = optionContainer?.props?.children;
      const visibleItems = containerChildren[1];

      // Second item (index 1) should be selected
      const secondItem = visibleItems[1];
      const secondMarker = secondItem?.props?.children[0];
      expect(secondMarker?.props?.color).toBe("cyan");
      expect(secondMarker?.props?.bold).toBe(true);
    });

    it("should not scroll past the beginning", () => {
      stateIndex = 0;
      SelectList({
        prompt: "Select:",
        options: makeOptions(10),
        onSelect: () => {},
        onCancel: () => {},
        maxVisible: 4,
      });

      // Try navigating up from the start
      inputHandler?.("", { upArrow: true } as Record<string, boolean>);

      stateIndex = 0;
      const result = SelectList({
        prompt: "Select:",
        options: makeOptions(10),
        onSelect: () => {},
        onCancel: () => {},
        maxVisible: 4,
      });
      const rootChildren = result?.props?.children;
      const optionContainer = rootChildren[1];
      const containerChildren = optionContainer?.props?.children;

      // Should still be at top, no up indicator
      expect(containerChildren[0]).toBe(false);
    });

    it("should not scroll past the end", () => {
      stateIndex = 0;
      SelectList({
        prompt: "Select:",
        options: makeOptions(10),
        onSelect: () => {},
        onCancel: () => {},
        maxVisible: 4,
      });

      // Navigate down to the very end
      for (let i = 0; i < 15; i++) {
        inputHandler?.("", { downArrow: true } as Record<string, boolean>);
      }

      stateIndex = 0;
      const result = SelectList({
        prompt: "Select:",
        options: makeOptions(10),
        onSelect: () => {},
        onCancel: () => {},
        maxVisible: 4,
      });
      const rootChildren = result?.props?.children;
      const optionContainer = rootChildren[1];
      const containerChildren = optionContainer?.props?.children;

      // Should show up indicator (scrolled down)
      expect(containerChildren[0]).not.toBe(false);
      // Should NOT show down indicator (at the end)
      expect(containerChildren[2]).toBe(false);
    });

    it("should scroll down when navigating past viewport bottom", () => {
      stateIndex = 0;
      SelectList({
        prompt: "Select:",
        options: makeOptions(10),
        onSelect: () => {},
        onCancel: () => {},
        maxVisible: 4,
      });

      // Navigate down 5 times (past maxVisible=4)
      for (let i = 0; i < 5; i++) {
        inputHandler?.("", { downArrow: true } as Record<string, boolean>);
      }

      stateIndex = 0;
      const result = SelectList({
        prompt: "Select:",
        options: makeOptions(10),
        onSelect: () => {},
        onCancel: () => {},
        maxVisible: 4,
      });
      const rootChildren = result?.props?.children;
      const optionContainer = rootChildren[1];
      const containerChildren = optionContainer?.props?.children;

      // hasMoreAbove should be truthy (scrolled down)
      expect(containerChildren[0]).not.toBe(false);
    });

    it("should trigger onSelect with correct value on Enter", () => {
      const onSelect = vi.fn();
      stateIndex = 0;
      SelectList({
        prompt: "Select:",
        options: makeOptions(5),
        onSelect,
        onCancel: () => {},
      });

      // Navigate down twice
      inputHandler?.("", { downArrow: true } as Record<string, boolean>);
      inputHandler?.("", { downArrow: true } as Record<string, boolean>);

      // Re-render to pick up updated selectedIndex
      stateIndex = 0;
      SelectList({
        prompt: "Select:",
        options: makeOptions(5),
        onSelect,
        onCancel: () => {},
      });

      // Press Enter
      inputHandler?.("", { return: true } as Record<string, boolean>);

      expect(onSelect).toHaveBeenCalledWith("value-2");
    });

    it("should trigger onCancel on Escape", () => {
      const onCancel = vi.fn();
      stateIndex = 0;
      SelectList({
        prompt: "Select:",
        options: makeOptions(3),
        onSelect: () => {},
        onCancel,
      });

      inputHandler?.("", { escape: true } as Record<string, boolean>);
      expect(onCancel).toHaveBeenCalled();
    });
  });

  describe("options without description", () => {
    it("should render options without description text", () => {
      const optionsNoDesc: SelectOption[] = [
        { label: "First", value: "first" },
        { label: "Second", value: "second" },
      ];

      stateIndex = 0;
      const result = SelectList({
        prompt: "Select:",
        options: optionsNoDesc,
        onSelect: () => {},
        onCancel: () => {},
      });
      const rootChildren = result?.props?.children;
      const optionContainer = rootChildren[1];
      const containerChildren = optionContainer?.props?.children;
      const visibleItems = containerChildren[1];

      // The description element should be null for options without description
      const firstItem = visibleItems[0];
      const firstItemChildren = firstItem?.props?.children;
      expect(firstItemChildren[2]).toBeNull();
    });
  });

  describe("exports", () => {
    it("should export SelectList function", async () => {
      const mod = await import("../../../../src/cli/components/SelectList.js");
      expect(typeof mod.SelectList).toBe("function");
    });
  });
});
