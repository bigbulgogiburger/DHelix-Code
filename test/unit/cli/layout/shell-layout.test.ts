/**
 * shell-layout.test.tsx — ShellLayout 모듈 테스트
 *
 * 순수 로직 테스트 위주:
 * - computeTranscriptMinHeight 계산 검증
 * - getTerminalSize 기본값 폴백 검증
 * - createInitialScrollState 초기 상태 검증
 * - ShellLayout 컴포넌트 렌더링 (slot 배치 순서 및 누락 처리)
 * - FooterBar 컴포넌트 렌더링 (항목 배치)
 * - TranscriptFrame 컴포넌트 렌더링
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ── React mock ──
let stateStore: Map<number, unknown>;
let stateIndex: number;
let effectCallbacks: Array<() => (() => void) | void>;
let refStore: Map<number, { current: unknown }>;
let refIndex: number;
let memoStore: Map<number, { deps: unknown[]; value: unknown }>;
let memoIndex: number;

function resetState() {
  stateStore = new Map();
  stateIndex = 0;
  effectCallbacks = [];
  refStore = new Map();
  refIndex = 0;
  memoStore = new Map();
  memoIndex = 0;
}

vi.mock("react", () => {
  return {
    default: {
      memo: (component: unknown) => component,
    },
    memo: (component: unknown) => component,
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
    useCallback: (cb: unknown) => cb,
    useMemo: (factory: () => unknown, deps: unknown[]) => {
      const idx = memoIndex++;
      const existing = memoStore.get(idx);
      if (existing) {
        const depsChanged = deps.some((d, i) => d !== existing.deps[i]);
        if (!depsChanged) return existing.value;
      }
      const value = factory();
      memoStore.set(idx, { deps, value });
      return value;
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

// ── Ink mock ──
vi.mock("ink", () => ({
  Box: ({ children }: { children?: unknown }) => children,
  Text: ({ children }: { children?: unknown }) => children,
  useStdout: () => ({
    stdout: { columns: 120, rows: 40 },
  }),
}));

// ── Theme mock ──
vi.mock("../../../src/cli/renderer/theme.js", () => ({
  getActiveTheme: () => ({
    name: "dark",
    colors: {
      primary: "cyan",
      secondary: "#00BCD4",
      success: "#00E5FF",
      warning: "yellow",
      error: "red",
      info: "cyanBright",
      muted: "gray",
      text: "white",
      border: "#0097A7",
      background: "black",
      highlight: "cyanBright",
      code: "cyanBright",
    },
  }),
}));

// ── Import helpers ──
async function getShellLayoutModule() {
  return import("../../../../src/cli/layout/shell-layout.js");
}

async function getTranscriptFrameModule() {
  return import("../../../../src/cli/layout/transcript-frame.js");
}

async function getFooterBarModule() {
  return import("../../../../src/cli/layout/footer-bar.js");
}

async function getIndexModule() {
  return import("../../../../src/cli/layout/index.js");
}

// ── Tests ──

describe("computeTranscriptMinHeight", () => {
  let computeTranscriptMinHeight: Awaited<ReturnType<typeof getShellLayoutModule>>["computeTranscriptMinHeight"];

  beforeEach(async () => {
    resetState();
    const mod = await getShellLayoutModule();
    computeTranscriptMinHeight = mod.computeTranscriptMinHeight;
  });

  it("should compute height with no header and no footer", () => {
    // 24 rows - 2 (prompt) - 2 (padding*2) = 20
    const result = computeTranscriptMinHeight(24, false, false, 1);
    expect(result).toBe(20);
  });

  it("should compute height with header and footer", () => {
    // 24 rows - 2 (prompt) - 2 (padding*2) - 3 (header) - 3 (footer) = 14
    const result = computeTranscriptMinHeight(24, true, true, 1);
    expect(result).toBe(14);
  });

  it("should compute height with only header", () => {
    // 24 rows - 2 - 2 - 3 = 17
    const result = computeTranscriptMinHeight(24, true, false, 1);
    expect(result).toBe(17);
  });

  it("should compute height with only footer", () => {
    // 24 rows - 2 - 2 - 3 = 17
    const result = computeTranscriptMinHeight(24, false, true, 1);
    expect(result).toBe(17);
  });

  it("should return minimum 3 for very small terminals", () => {
    // 8 rows - 2 - 2 - 3 - 3 = -2, but clamped to 3
    const result = computeTranscriptMinHeight(8, true, true, 1);
    expect(result).toBe(3);
  });

  it("should handle zero padding", () => {
    // 24 rows - 2 - 0 = 22
    const result = computeTranscriptMinHeight(24, false, false, 0);
    expect(result).toBe(22);
  });

  it("should handle large padding", () => {
    // 24 rows - 2 - 10 = 12
    const result = computeTranscriptMinHeight(24, false, false, 5);
    expect(result).toBe(12);
  });
});

describe("getTerminalSize", () => {
  let getTerminalSize: Awaited<ReturnType<typeof getShellLayoutModule>>["getTerminalSize"];

  beforeEach(async () => {
    resetState();
    const mod = await getShellLayoutModule();
    getTerminalSize = mod.getTerminalSize;
  });

  it("should return stdout dimensions when available", () => {
    const mockStdout = { columns: 200, rows: 50 } as NodeJS.WriteStream;
    const result = getTerminalSize(mockStdout);
    expect(result).toEqual({ columns: 200, rows: 50 });
  });

  it("should return defaults when stdout is undefined", () => {
    const result = getTerminalSize(undefined);
    expect(result).toEqual({ columns: 80, rows: 24 });
  });

  it("should return defaults when stdout lacks dimensions", () => {
    const mockStdout = {} as NodeJS.WriteStream;
    const result = getTerminalSize(mockStdout);
    expect(result).toEqual({ columns: 80, rows: 24 });
  });
});

describe("ShellLayout", () => {
  let ShellLayout: Awaited<ReturnType<typeof getShellLayoutModule>>["ShellLayout"];

  beforeEach(async () => {
    resetState();
    const mod = await getShellLayoutModule();
    ShellLayout = mod.ShellLayout;
  });

  it("should render with all slots provided", () => {
    stateIndex = 0;
    memoIndex = 0;
    refIndex = 0;

    const result = ShellLayout({
      slots: {
        header: "header-content",
        transcript: "transcript-content",
        prompt: "prompt-content",
        footer: "footer-content",
      },
    });

    expect(result).not.toBeNull();
  });

  it("should render without optional header", () => {
    stateIndex = 0;
    memoIndex = 0;
    refIndex = 0;

    const result = ShellLayout({
      slots: {
        transcript: "transcript-content",
        prompt: "prompt-content",
      },
    });

    expect(result).not.toBeNull();
  });

  it("should render without optional footer", () => {
    stateIndex = 0;
    memoIndex = 0;
    refIndex = 0;

    const result = ShellLayout({
      slots: {
        transcript: "transcript-content",
        prompt: "prompt-content",
        footer: undefined,
      },
    });

    expect(result).not.toBeNull();
  });

  it("should render with custom padding", () => {
    stateIndex = 0;
    memoIndex = 0;
    refIndex = 0;

    const result = ShellLayout({
      slots: {
        transcript: "transcript-content",
        prompt: "prompt-content",
      },
      padding: 2,
    });

    expect(result).not.toBeNull();
  });

  it("should render with only required slots (transcript + prompt)", () => {
    stateIndex = 0;
    memoIndex = 0;
    refIndex = 0;

    const result = ShellLayout({
      slots: {
        transcript: "transcript-content",
        prompt: "prompt-content",
      },
    });

    expect(result).not.toBeNull();
  });
});

describe("TranscriptFrame", () => {
  let TranscriptFrame: Awaited<ReturnType<typeof getTranscriptFrameModule>>["TranscriptFrame"];

  beforeEach(async () => {
    resetState();
    const mod = await getTranscriptFrameModule();
    TranscriptFrame = mod.TranscriptFrame;
  });

  it("should render children", () => {
    stateIndex = 0;
    memoIndex = 0;
    refIndex = 0;

    const result = TranscriptFrame({
      children: "test-content",
    });

    expect(result).not.toBeNull();
  });

  it("should render with autoScroll disabled", () => {
    stateIndex = 0;
    memoIndex = 0;
    refIndex = 0;

    const result = TranscriptFrame({
      children: "test-content",
      autoScroll: false,
    });

    expect(result).not.toBeNull();
  });

  it("should render with custom minHeight", () => {
    stateIndex = 0;
    memoIndex = 0;
    refIndex = 0;

    const result = TranscriptFrame({
      children: "test-content",
      minHeight: 10,
    });

    expect(result).not.toBeNull();
  });

  it("should accept onScrollStateChange callback", () => {
    stateIndex = 0;
    memoIndex = 0;
    refIndex = 0;

    const onScrollStateChange = vi.fn();
    const result = TranscriptFrame({
      children: "test-content",
      onScrollStateChange,
    });

    expect(result).not.toBeNull();
  });
});

describe("createInitialScrollState", () => {
  it("should return initial state with isAtBottom true", async () => {
    const mod = await getTranscriptFrameModule();
    const state = mod.createInitialScrollState();
    expect(state.isAtBottom).toBe(true);
    expect(state.childCount).toBe(0);
  });
});

describe("FooterBar", () => {
  let FooterBar: Awaited<ReturnType<typeof getFooterBarModule>>["FooterBar"];

  beforeEach(async () => {
    resetState();
    const mod = await getFooterBarModule();
    FooterBar = mod.FooterBar;
  });

  it("should render with all sections", () => {
    stateIndex = 0;
    memoIndex = 0;
    refIndex = 0;

    const result = FooterBar({
      left: [{ label: "gpt-4o", colorToken: "primary" }],
      center: [{ label: "[Default]", colorToken: "border" }],
      right: [{ label: "ready", colorToken: "muted" }],
    });

    expect(result).not.toBeNull();
  });

  it("should render with empty sections", () => {
    stateIndex = 0;
    memoIndex = 0;
    refIndex = 0;

    const result = FooterBar({});

    expect(result).not.toBeNull();
  });

  it("should render with custom borderColor", () => {
    stateIndex = 0;
    memoIndex = 0;
    refIndex = 0;

    const result = FooterBar({
      left: [{ label: "test" }],
      borderColor: "red",
    });

    expect(result).not.toBeNull();
  });

  it("should render items with bold flag", () => {
    stateIndex = 0;
    memoIndex = 0;
    refIndex = 0;

    const result = FooterBar({
      left: [{ label: "bold-item", colorToken: "primary", bold: true }],
    });

    expect(result).not.toBeNull();
  });

  it("should render multiple items in each section", () => {
    stateIndex = 0;
    memoIndex = 0;
    refIndex = 0;

    const result = FooterBar({
      left: [
        { label: "model", colorToken: "primary" },
        { label: "v0.2.0", colorToken: "muted" },
      ],
      center: [
        { label: "[###-----] 30%", colorToken: "success" },
        { label: "[Default]", colorToken: "border" },
      ],
      right: [
        { label: "MCP: ok", colorToken: "info" },
        { label: "ready", colorToken: "muted" },
      ],
    });

    expect(result).not.toBeNull();
  });
});

describe("barrel export (index.ts)", () => {
  it("should export all public APIs", async () => {
    const mod = await getIndexModule();

    // ShellLayout exports
    expect(mod.ShellLayout).toBeDefined();
    expect(mod.computeTranscriptMinHeight).toBeDefined();
    expect(mod.getTerminalSize).toBeDefined();

    // TranscriptFrame exports
    expect(mod.TranscriptFrame).toBeDefined();
    expect(mod.createInitialScrollState).toBeDefined();

    // FooterBar exports
    expect(mod.FooterBar).toBeDefined();
  });
});
