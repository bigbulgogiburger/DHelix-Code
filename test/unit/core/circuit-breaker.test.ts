import { describe, it, expect, beforeEach } from "vitest";
import { CircuitBreaker, type IterationResult } from "../../../src/core/circuit-breaker.js";

/** Helper to create an iteration result */
function makeResult(overrides: Partial<IterationResult> = {}): IterationResult {
  return {
    filesModified: overrides.filesModified ?? new Set<string>(),
    error: overrides.error,
    hasOutput: overrides.hasOutput ?? false,
  };
}

describe("CircuitBreaker", () => {
  let breaker: CircuitBreaker;

  beforeEach(() => {
    breaker = new CircuitBreaker();
  });

  describe("initial state", () => {
    it("should start in closed state", () => {
      const status = breaker.getStatus();
      expect(status.state).toBe("closed");
      expect(status.reason).toBeUndefined();
      expect(status.iterationCount).toBe(0);
    });

    it("should allow continuation initially", () => {
      expect(breaker.shouldContinue()).toBe(true);
    });
  });

  describe("no file changes threshold", () => {
    it("should open after 5 consecutive iterations with no changes", () => {
      breaker.recordIteration(makeResult());
      expect(breaker.shouldContinue()).toBe(true);

      breaker.recordIteration(makeResult());
      expect(breaker.shouldContinue()).toBe(true);

      breaker.recordIteration(makeResult());
      expect(breaker.shouldContinue()).toBe(true);

      breaker.recordIteration(makeResult());
      expect(breaker.shouldContinue()).toBe(true);

      breaker.recordIteration(makeResult());
      expect(breaker.shouldContinue()).toBe(false);

      const status = breaker.getStatus();
      expect(status.state).toBe("open");
      expect(status.reason).toContain("no file changes");
    });

    it("should reset no-change counter when files are modified", () => {
      breaker.recordIteration(makeResult());
      breaker.recordIteration(makeResult());
      breaker.recordIteration(makeResult());
      breaker.recordIteration(makeResult());

      // File modification resets the counter
      breaker.recordIteration(makeResult({ filesModified: new Set(["file.ts"]) }));
      expect(breaker.shouldContinue()).toBe(true);

      // Need 5 more consecutive no-changes
      breaker.recordIteration(makeResult());
      breaker.recordIteration(makeResult());
      breaker.recordIteration(makeResult());
      breaker.recordIteration(makeResult());
      expect(breaker.shouldContinue()).toBe(true);
    });

    it("should reset no-change counter when output is produced", () => {
      breaker.recordIteration(makeResult());
      breaker.recordIteration(makeResult());
      breaker.recordIteration(makeResult());
      breaker.recordIteration(makeResult());

      // Output resets the counter
      breaker.recordIteration(makeResult({ hasOutput: true }));
      expect(breaker.shouldContinue()).toBe(true);

      // Need 5 more consecutive no-changes
      breaker.recordIteration(makeResult());
      breaker.recordIteration(makeResult());
      breaker.recordIteration(makeResult());
      breaker.recordIteration(makeResult());
      expect(breaker.shouldContinue()).toBe(true);
    });
  });

  describe("same error threshold", () => {
    it("should open after 5 consecutive same errors", () => {
      for (let i = 0; i < 4; i++) {
        breaker.recordIteration(makeResult({ error: "Network timeout", hasOutput: true }));
        expect(breaker.shouldContinue()).toBe(true);
      }

      breaker.recordIteration(makeResult({ error: "Network timeout", hasOutput: true }));
      expect(breaker.shouldContinue()).toBe(false);

      const status = breaker.getStatus();
      expect(status.state).toBe("open");
      expect(status.reason).toContain("same error");
      expect(status.reason).toContain("Network timeout");
    });

    it("should reset error counter when a different error occurs", () => {
      for (let i = 0; i < 4; i++) {
        breaker.recordIteration(makeResult({ error: "Error A", hasOutput: true }));
      }
      expect(breaker.shouldContinue()).toBe(true);

      // Different error resets the counter
      breaker.recordIteration(makeResult({ error: "Error B", hasOutput: true }));
      expect(breaker.shouldContinue()).toBe(true);

      const status = breaker.getStatus();
      expect(status.consecutiveSameErrorCount).toBe(1);
    });

    it("should reset error counter when no error occurs", () => {
      for (let i = 0; i < 4; i++) {
        breaker.recordIteration(makeResult({ error: "Error A", hasOutput: true }));
      }

      // Success resets the counter
      breaker.recordIteration(makeResult({ hasOutput: true }));
      expect(breaker.shouldContinue()).toBe(true);

      const status = breaker.getStatus();
      expect(status.consecutiveSameErrorCount).toBe(0);
    });
  });

  describe("max iterations", () => {
    it("should open at maxIterations limit", () => {
      const smallBreaker = new CircuitBreaker(5);

      for (let i = 0; i < 4; i++) {
        smallBreaker.recordIteration(
          makeResult({ filesModified: new Set(["file.ts"]), hasOutput: true }),
        );
        expect(smallBreaker.shouldContinue()).toBe(true);
      }

      smallBreaker.recordIteration(
        makeResult({ filesModified: new Set(["file.ts"]), hasOutput: true }),
      );
      expect(smallBreaker.shouldContinue()).toBe(false);

      const status = smallBreaker.getStatus();
      expect(status.reason).toContain("maximum iteration limit");
      expect(status.reason).toContain("5");
    });

    it("should use default maxIterations of 50", () => {
      const status = breaker.getStatus();
      expect(status.iterationCount).toBe(0);

      // Run 49 iterations with changes
      for (let i = 0; i < 49; i++) {
        breaker.recordIteration(
          makeResult({ filesModified: new Set(["file.ts"]), hasOutput: true }),
        );
      }
      expect(breaker.shouldContinue()).toBe(true);

      // 50th iteration should open
      breaker.recordIteration(makeResult({ filesModified: new Set(["file.ts"]), hasOutput: true }));
      expect(breaker.shouldContinue()).toBe(false);
    });
  });

  describe("reset", () => {
    it("should reset all state to initial values", () => {
      // Trigger circuit open
      breaker.recordIteration(makeResult());
      breaker.recordIteration(makeResult());
      breaker.recordIteration(makeResult());
      breaker.recordIteration(makeResult());
      breaker.recordIteration(makeResult());
      expect(breaker.shouldContinue()).toBe(false);

      // Reset
      breaker.reset();

      expect(breaker.shouldContinue()).toBe(true);
      const status = breaker.getStatus();
      expect(status.state).toBe("closed");
      expect(status.reason).toBeUndefined();
      expect(status.iterationCount).toBe(0);
      expect(status.consecutiveNoChangeCount).toBe(0);
      expect(status.consecutiveSameErrorCount).toBe(0);
    });

    it("should allow new iterations after reset", () => {
      // Open the circuit
      breaker.recordIteration(makeResult());
      breaker.recordIteration(makeResult());
      breaker.recordIteration(makeResult());
      breaker.recordIteration(makeResult());
      breaker.recordIteration(makeResult());

      breaker.reset();

      // Should work again
      breaker.recordIteration(makeResult({ filesModified: new Set(["file.ts"]), hasOutput: true }));
      expect(breaker.shouldContinue()).toBe(true);
      expect(breaker.getStatus().iterationCount).toBe(1);
    });
  });

  describe("does not record after open", () => {
    it("should not record iterations after circuit is open", () => {
      breaker.recordIteration(makeResult());
      breaker.recordIteration(makeResult());
      breaker.recordIteration(makeResult());
      breaker.recordIteration(makeResult());
      breaker.recordIteration(makeResult());
      expect(breaker.shouldContinue()).toBe(false);

      const statusBefore = breaker.getStatus();

      // Try to record more
      breaker.recordIteration(makeResult());
      breaker.recordIteration(makeResult());

      const statusAfter = breaker.getStatus();
      expect(statusAfter.iterationCount).toBe(statusBefore.iterationCount);
    });
  });

  describe("combined triggers", () => {
    it("should detect no-change even when errors are present", () => {
      // Errors without output or file changes trigger no-change
      breaker.recordIteration(makeResult({ error: "A" }));
      breaker.recordIteration(makeResult({ error: "B" }));
      breaker.recordIteration(makeResult({ error: "C" }));
      breaker.recordIteration(makeResult({ error: "D" }));
      breaker.recordIteration(makeResult({ error: "E" }));

      expect(breaker.shouldContinue()).toBe(false);
      // No-change threshold is hit before same-error threshold
      expect(breaker.getStatus().reason).toContain("no file changes");
    });

    it("should track iteration count accurately", () => {
      breaker.recordIteration(makeResult({ filesModified: new Set(["a.ts"]), hasOutput: true }));
      breaker.recordIteration(makeResult({ hasOutput: true }));
      breaker.recordIteration(makeResult({ filesModified: new Set(["b.ts"]), hasOutput: true }));

      expect(breaker.getStatus().iterationCount).toBe(3);
    });
  });
});
