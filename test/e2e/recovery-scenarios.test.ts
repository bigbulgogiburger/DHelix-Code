import { describe, it, expect, beforeEach } from "vitest";
import { CircuitBreaker } from "../../src/core/circuit-breaker.js";
import {
  findRecoveryStrategy,
  getRecoveryExplanation,
} from "../../src/core/recovery-strategy.js";
import {
  executeRecovery,
  resetRetryState,
} from "../../src/core/recovery-executor.js";

describe("Recovery Scenarios", () => {
  describe("Circuit Breaker", () => {
    it("should allow iterations within limits", () => {
      const cb = new CircuitBreaker(10);
      for (let i = 0; i < 5; i++) {
        cb.recordIteration({
          filesModified: new Set(["file.ts"]),
          hasOutput: true,
        });
      }
      expect(cb.shouldContinue()).toBe(true);
    });

    it("should open circuit after max iterations", () => {
      const cb = new CircuitBreaker(3);
      for (let i = 0; i < 3; i++) {
        cb.recordIteration({
          filesModified: new Set(["file.ts"]),
          hasOutput: true,
        });
      }
      expect(cb.shouldContinue()).toBe(false);
      const status = cb.getStatus();
      expect(status.reason).toBeDefined();
      expect(status.reason!.toLowerCase()).toContain("maximum");
    });

    it("should open circuit after consecutive no-change iterations", () => {
      const cb = new CircuitBreaker(50);
      for (let i = 0; i < 5; i++) {
        cb.recordIteration({
          filesModified: new Set(),
          hasOutput: false,
        });
      }
      expect(cb.shouldContinue()).toBe(false);
      const status = cb.getStatus();
      expect(status.reason).toBeDefined();
      expect(status.reason!.toLowerCase()).toContain("no file changes");
    });

    it("should open circuit after same error repeated", () => {
      const cb = new CircuitBreaker(50);
      for (let i = 0; i < 5; i++) {
        cb.recordIteration({
          filesModified: new Set(["f.ts"]),
          hasOutput: true,
          error: "same error message",
        });
      }
      expect(cb.shouldContinue()).toBe(false);
      const status = cb.getStatus();
      expect(status.reason).toBeDefined();
      expect(status.reason!.toLowerCase()).toContain("same error");
    });

    it("should reset properly", () => {
      const cb = new CircuitBreaker(3);
      for (let i = 0; i < 3; i++) {
        cb.recordIteration({
          filesModified: new Set(),
          hasOutput: false,
        });
      }
      expect(cb.shouldContinue()).toBe(false);
      cb.reset();
      expect(cb.shouldContinue()).toBe(true);
    });

    it("should provide user-friendly reason", () => {
      const cb = new CircuitBreaker(2);
      cb.recordIteration({
        filesModified: new Set(["f.ts"]),
        hasOutput: true,
      });
      cb.recordIteration({
        filesModified: new Set(["f.ts"]),
        hasOutput: true,
      });
      expect(cb.shouldContinue()).toBe(false);
      const reason = cb.getUserFriendlyReason();
      expect(reason).toContain("maximum number of steps");
    });

    it("should track iteration count accurately", () => {
      const cb = new CircuitBreaker(10);
      cb.recordIteration({
        filesModified: new Set(["a.ts"]),
        hasOutput: true,
      });
      cb.recordIteration({
        filesModified: new Set(["b.ts"]),
        hasOutput: true,
      });
      const status = cb.getStatus();
      expect(status.iterationCount).toBe(2);
      expect(status.state).toBe("closed");
    });

    it("should not record after circuit opens", () => {
      const cb = new CircuitBreaker(2);
      cb.recordIteration({
        filesModified: new Set(["f.ts"]),
        hasOutput: true,
      });
      cb.recordIteration({
        filesModified: new Set(["f.ts"]),
        hasOutput: true,
      });
      // Circuit is now open
      cb.recordIteration({
        filesModified: new Set(["g.ts"]),
        hasOutput: true,
      });
      // Should still show 2, not 3 (recording skipped when open)
      expect(cb.getStatus().iterationCount).toBe(2);
    });
  });

  describe("Recovery Strategy Matching", () => {
    it("should match context overflow errors", () => {
      const strategy = findRecoveryStrategy(
        new Error("request too large for model"),
      );
      expect(strategy).toBeDefined();
      expect(strategy!.action).toBe("compact");
    });

    it("should match rate limit errors", () => {
      const strategy = findRecoveryStrategy(
        new Error("429 Too Many Requests"),
      );
      expect(strategy).toBeDefined();
      expect(strategy!.action).toBe("retry");
    });

    it("should match timeout errors", () => {
      const strategy = findRecoveryStrategy(new Error("ETIMEDOUT"));
      expect(strategy).toBeDefined();
      expect(strategy!.action).toBe("retry");
    });

    it("should match JSON parse errors", () => {
      const strategy = findRecoveryStrategy(
        new Error("Unexpected token in JSON"),
      );
      expect(strategy).toBeDefined();
      expect(strategy!.action).toBe("fallback-strategy");
    });

    it("should return undefined for unknown errors", () => {
      const strategy = findRecoveryStrategy(
        new Error("Something completely unknown xyz123"),
      );
      expect(strategy).toBeUndefined();
    });

    it("should provide user-friendly explanations", () => {
      const strategy = findRecoveryStrategy(new Error("request too large"));
      expect(strategy).toBeDefined();
      const explanation = getRecoveryExplanation(strategy!, 1);
      expect(explanation).toContain("Context too large");
      expect(explanation).toContain("compressing");
    });

    it("should match server overload errors", () => {
      const strategy = findRecoveryStrategy(
        new Error("503 Service Unavailable"),
      );
      expect(strategy).toBeDefined();
      expect(strategy!.action).toBe("retry");
    });

    it("should match MCP tool timeout errors", () => {
      const strategy = findRecoveryStrategy(
        new Error("MCP tool error: request timed out"),
      );
      expect(strategy).toBeDefined();
      expect(strategy!.action).toBe("retry");
    });
  });

  describe("Recovery Execution", () => {
    beforeEach(() => {
      resetRetryState();
    });

    it("should compact messages on context overflow", async () => {
      const strategy = findRecoveryStrategy(
        new Error("request too large"),
      );
      expect(strategy).toBeDefined();

      const messages = [
        { role: "system" as const, content: "You are helpful." },
        { role: "user" as const, content: "msg 1" },
        { role: "assistant" as const, content: "resp 1" },
        { role: "user" as const, content: "msg 2" },
        { role: "assistant" as const, content: "resp 2" },
        { role: "user" as const, content: "msg 3" },
        { role: "assistant" as const, content: "resp 3" },
      ];

      const result = await executeRecovery(
        strategy!,
        new Error("request too large"),
        messages,
      );
      expect(result.action).toBe("retry");
      expect(result.messages).toBeDefined();
      // Compacted messages should be shorter than the original
      expect(result.messages!.length).toBeLessThan(messages.length);
    });

    it("should abort after max retries", async () => {
      // Use a compact strategy (no backoff delay) to avoid timeout issues
      const strategy = findRecoveryStrategy(
        new Error("request too large"),
      );
      expect(strategy).toBeDefined();
      expect(strategy!.action).toBe("compact");

      const messages = [
        { role: "system" as const, content: "sys" },
        { role: "user" as const, content: "u1" },
        { role: "assistant" as const, content: "a1" },
      ];

      // Exhaust all retries (compact maxRetries = 1)
      for (let i = 0; i < strategy!.maxRetries; i++) {
        const result = await executeRecovery(
          strategy!,
          new Error("request too large"),
          messages,
        );
        expect(result.action).toBe("retry");
      }

      // Next attempt should abort
      const finalResult = await executeRecovery(
        strategy!,
        new Error("request too large"),
        messages,
      );
      expect(finalResult.action).toBe("abort");
    });

    it("should switch to fallback strategy on parse errors", async () => {
      const strategy = findRecoveryStrategy(
        new Error("Unexpected token in JSON"),
      );
      expect(strategy).toBeDefined();

      const result = await executeRecovery(
        strategy!,
        new Error("Unexpected token in JSON"),
        [{ role: "user" as const, content: "test" }],
      );

      expect(result.action).toBe("retry");
      expect(result.overrides).toBeDefined();
      expect(result.overrides!["toolCallStrategy"]).toBe("text-parsing");
    });

    it("should reset retry state between independent recovery attempts", async () => {
      // Use compact strategy (no backoff delay) to keep test fast
      const strategy = findRecoveryStrategy(
        new Error("request too large"),
      );
      expect(strategy).toBeDefined();

      const messages = [
        { role: "system" as const, content: "sys" },
        { role: "user" as const, content: "u" },
      ];

      // Use up retries
      for (let i = 0; i < strategy!.maxRetries; i++) {
        await executeRecovery(
          strategy!,
          new Error("request too large"),
          messages,
        );
      }
      const aborted = await executeRecovery(
        strategy!,
        new Error("request too large"),
        messages,
      );
      expect(aborted.action).toBe("abort");

      // After resetting, retries should be available again
      resetRetryState();
      const fresh = await executeRecovery(
        strategy!,
        new Error("request too large"),
        messages,
      );
      expect(fresh.action).toBe("retry");
    });
  });
});
