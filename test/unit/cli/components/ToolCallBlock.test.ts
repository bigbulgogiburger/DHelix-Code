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
  const mod = await import("../../../../src/cli/components/ToolCallBlock.js");
  return mod.ToolCallBlock;
}

describe("ToolCallBlock", () => {
  let ToolCallBlock: Awaited<ReturnType<typeof getComponent>>;

  beforeEach(async () => {
    resetState();
    ToolCallBlock = await getComponent();
  });

  describe("spinner", () => {
    it("should register an interval effect when status is running", () => {
      stateIndex = 0;
      ToolCallBlock({
        name: "bash_exec",
        status: "running",
        args: { command: "npm test" },
      });
      expect(effectCallbacks.length).toBeGreaterThan(0);
    });

    it("should return a cleanup function when running", () => {
      stateIndex = 0;
      ToolCallBlock({
        name: "bash_exec",
        status: "running",
        args: { command: "npm test" },
      });
      const cleanup = effectCallbacks[0]?.();
      expect(typeof cleanup).toBe("function");
    });

    it("should not register interval when status is complete", () => {
      stateIndex = 0;
      ToolCallBlock({
        name: "bash_exec",
        status: "complete",
        args: { command: "npm test" },
      });
      // The effect runs but returns early since active=false
      const cleanup = effectCallbacks[0]?.();
      expect(cleanup).toBeUndefined();
    });
  });

  describe("status icon integration", () => {
    it("should use spinner char for running status", async () => {
      const { getToolStatusIcon, SPINNER_FRAMES } = await import(
        "../../../../src/cli/renderer/tool-display.js"
      );
      expect(SPINNER_FRAMES[0]).toBe(getToolStatusIcon("running"));
    });

    it("should return checkmark for complete", async () => {
      const { getToolStatusIcon } = await import("../../../../src/cli/renderer/tool-display.js");
      expect(getToolStatusIcon("complete")).toBe("\u2713");
    });

    it("should return X for error", async () => {
      const { getToolStatusIcon } = await import("../../../../src/cli/renderer/tool-display.js");
      expect(getToolStatusIcon("error")).toBe("\u2717");
    });

    it("should return ! for denied", async () => {
      const { getToolStatusIcon } = await import("../../../../src/cli/renderer/tool-display.js");
      expect(getToolStatusIcon("denied")).toBe("!");
    });
  });

  describe("tool display text integration", () => {
    it("should generate display text for file_read running", async () => {
      const { getToolDisplayText } = await import("../../../../src/cli/renderer/tool-display.js");
      expect(getToolDisplayText("file_read", "running", { file_path: "/a.ts" })).toBe(
        "Reading /a.ts",
      );
    });

    it("should generate display text for bash_exec complete", async () => {
      const { getToolDisplayText } = await import("../../../../src/cli/renderer/tool-display.js");
      expect(getToolDisplayText("bash_exec", "complete", { command: "ls" })).toBe("Ran ls");
    });
  });

  describe("metadata forwarding", () => {
    it("should pass metadata to getToolHeaderInfo", async () => {
      const { getToolHeaderInfo } = await import("../../../../src/cli/renderer/tool-display.js");
      // Verify getToolHeaderInfo accepts metadata parameter
      const info = getToolHeaderInfo(
        "file_read",
        "complete",
        { file_path: "/a.ts" },
        "content",
        undefined,
        { path: "/a.ts", totalLines: 10 },
      );
      expect(info.subtext).toContain("/a.ts");
    });
  });

  describe("exports", () => {
    it("should export ToolCallBlock function", async () => {
      const mod = await import("../../../../src/cli/components/ToolCallBlock.js");
      expect(typeof mod.ToolCallBlock).toBe("function");
    });
  });
});
