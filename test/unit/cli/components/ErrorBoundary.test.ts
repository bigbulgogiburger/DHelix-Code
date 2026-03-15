import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock react with minimal class component support
vi.mock("react", () => {
  class Component<P = unknown, S = unknown> {
    props: P;
    state: S;
    constructor(props: P) {
      this.props = props;
      this.state = {} as S;
    }
    setState(partial: Partial<S>) {
      this.state = { ...this.state, ...partial };
    }
  }

  return {
    default: { Component },
    Component,
    createElement: vi.fn(),
  };
});

// Mock ink
vi.mock("ink", () => ({
  Box: vi.fn(),
  Text: vi.fn(),
}));

describe("ErrorBoundary", () => {
  let ErrorBoundary: typeof import("../../../../src/cli/components/ErrorBoundary.js").ErrorBoundary;

  beforeEach(async () => {
    vi.clearAllMocks();
    const mod = await import("../../../../src/cli/components/ErrorBoundary.js");
    ErrorBoundary = mod.ErrorBoundary;
  });

  it("should be exported as a named export", () => {
    expect(ErrorBoundary).toBeDefined();
    expect(typeof ErrorBoundary).toBe("function");
  });

  it("should initialize with hasError = false", () => {
    const boundary = new ErrorBoundary({ children: null });
    expect(boundary.state.hasError).toBe(false);
    expect(boundary.state.errorMessage).toBe(null);
  });

  it("getDerivedStateFromError should return error state", () => {
    const error = new Error("Test render crash");
    const state = ErrorBoundary.getDerivedStateFromError(error);

    expect(state.hasError).toBe(true);
    expect(state.errorMessage).toBe("Test render crash");
  });

  it("getDerivedStateFromError should handle empty error message", () => {
    const error = new Error("");
    const state = ErrorBoundary.getDerivedStateFromError(error);

    expect(state.hasError).toBe(true);
    expect(state.errorMessage).toBe("Unknown error");
  });

  it("componentDidCatch should log to stderr", () => {
    const stderrSpy = vi.spyOn(process.stderr, "write").mockImplementation(() => true);

    const boundary = new ErrorBoundary({ children: null });
    const error = new Error("Crash");
    const errorInfo = { componentStack: "\n    in App\n    in Root" };

    boundary.componentDidCatch(error, errorInfo as React.ErrorInfo);

    expect(stderrSpy).toHaveBeenCalledTimes(2);
    expect(stderrSpy).toHaveBeenCalledWith(
      expect.stringContaining("[ErrorBoundary] Uncaught render error: Crash"),
    );
    expect(stderrSpy).toHaveBeenCalledWith(
      expect.stringContaining("[ErrorBoundary] Component stack:"),
    );

    stderrSpy.mockRestore();
  });

  it("componentDidCatch should handle missing componentStack", () => {
    const stderrSpy = vi.spyOn(process.stderr, "write").mockImplementation(() => true);

    const boundary = new ErrorBoundary({ children: null });
    const error = new Error("Crash");
    const errorInfo = { componentStack: "" };

    boundary.componentDidCatch(error, errorInfo as React.ErrorInfo);

    // Should only log the error message, not the stack
    expect(stderrSpy).toHaveBeenCalledTimes(1);

    stderrSpy.mockRestore();
  });

  it("render should return children when no error", () => {
    const boundary = new ErrorBoundary({ children: "child content" });
    boundary.state = { hasError: false, errorMessage: null };

    const result = boundary.render();
    expect(result).toBe("child content");
  });

  it("render should return error UI when hasError is true", () => {
    const boundary = new ErrorBoundary({ children: "child content" });
    boundary.state = { hasError: true, errorMessage: "Something broke" };

    const result = boundary.render();
    // When hasError is true, render returns JSX (not the children)
    expect(result).not.toBe("child content");
  });
});
