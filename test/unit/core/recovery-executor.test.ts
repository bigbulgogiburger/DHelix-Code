import { describe, it, expect, beforeEach } from "vitest";
import {
  executeRecovery,
  resetRetryState,
  type RecoveryResult,
} from "../../../src/core/recovery-executor.js";
import {
  type RecoveryStrategy,
  findRecoveryStrategy,
  RECOVERY_STRATEGIES,
} from "../../../src/core/recovery-strategy.js";
import { type ChatMessage } from "../../../src/llm/provider.js";

const sampleMessages: readonly ChatMessage[] = [
  { role: "system", content: "You are a helpful assistant." },
  { role: "user", content: "Hello" },
  { role: "assistant", content: "Hi there!" },
  { role: "user", content: "Do something" },
  { role: "assistant", content: "Done." },
  { role: "user", content: "Another request" },
  { role: "assistant", content: "Another response." },
];

describe("executeRecovery", () => {
  beforeEach(() => {
    resetRetryState();
  });

  describe("compact strategy", () => {
    const compactStrategy: RecoveryStrategy = {
      errorPattern: /request too large/i,
      action: "compact",
      maxRetries: 1,
      description: "Context overflow — auto-compact and retry",
    };

    it("should compact messages and return retry action", async () => {
      const error = new Error("Request too large");
      const result = await executeRecovery(compactStrategy, error, sampleMessages);

      expect(result.action).toBe("retry");
      expect(result.strategyUsed).toBe("Context overflow — auto-compact and retry");
      expect(result.messages).toBeDefined();
      // Compacted messages should be shorter than original
      expect(result.messages!.length).toBeLessThan(sampleMessages.length);
    });

    it("should keep system messages during compaction", async () => {
      const error = new Error("Request too large");
      const result = await executeRecovery(compactStrategy, error, sampleMessages);

      const systemMessages = result.messages!.filter((m) => m.role === "system");
      expect(systemMessages).toHaveLength(1);
      expect(systemMessages[0].content).toBe("You are a helpful assistant.");
    });

    it("should abort after exceeding maxRetries", async () => {
      const error = new Error("Request too large");

      // First attempt should succeed
      const first = await executeRecovery(compactStrategy, error, sampleMessages);
      expect(first.action).toBe("retry");

      // Second attempt should abort (maxRetries = 1)
      const second = await executeRecovery(compactStrategy, error, sampleMessages);
      expect(second.action).toBe("abort");
    });

    it("should not compact when messages are too short", async () => {
      const shortMessages: readonly ChatMessage[] = [
        { role: "system", content: "System" },
        { role: "user", content: "Hi" },
      ];
      const error = new Error("Request too large");
      const result = await executeRecovery(compactStrategy, error, shortMessages);

      expect(result.action).toBe("retry");
      // With <= 4 messages, compaction returns them as-is
      expect(result.messages!.length).toBe(shortMessages.length);
    });
  });

  describe("retry strategy", () => {
    const retryStrategy: RecoveryStrategy = {
      errorPattern: /timeout/i,
      action: "retry",
      maxRetries: 2,
      backoffMs: 10, // Use small backoff for tests
      description: "Timeout — retry with backoff",
    };

    it("should return retry action with original messages", async () => {
      const error = new Error("Timeout");
      const result = await executeRecovery(retryStrategy, error, sampleMessages);

      expect(result.action).toBe("retry");
      expect(result.messages).toBe(sampleMessages);
      expect(result.strategyUsed).toBe("Timeout — retry with backoff");
    });

    it("should allow multiple retries up to maxRetries", async () => {
      const error = new Error("Timeout");

      const first = await executeRecovery(retryStrategy, error, sampleMessages);
      expect(first.action).toBe("retry");

      const second = await executeRecovery(retryStrategy, error, sampleMessages);
      expect(second.action).toBe("retry");

      const third = await executeRecovery(retryStrategy, error, sampleMessages);
      expect(third.action).toBe("abort");
    });

    it("should abort when signal is already aborted", async () => {
      const error = new Error("Timeout");
      const controller = new AbortController();
      controller.abort();

      await expect(
        executeRecovery(retryStrategy, error, sampleMessages, { signal: controller.signal }),
      ).rejects.toThrow("Aborted");
    });

    it("should use default backoff when backoffMs is not specified", async () => {
      const noBackoffStrategy: RecoveryStrategy = {
        errorPattern: /lock/i,
        action: "retry",
        maxRetries: 1,
        description: "Lock — retry",
      };
      const error = new Error("ELOCK");

      const start = Date.now();
      const result = await executeRecovery(noBackoffStrategy, error, sampleMessages);
      const elapsed = Date.now() - start;

      expect(result.action).toBe("retry");
      // Default backoff is 1000ms * 2^0 = 1000ms; actual might be slightly less due to timing
      expect(elapsed).toBeGreaterThanOrEqual(900);
    });
  });

  describe("fallback-strategy", () => {
    const fallbackStrategy: RecoveryStrategy = {
      errorPattern: /parse.*error/i,
      action: "fallback-strategy",
      maxRetries: 1,
      description: "Parse error — fallback to text parsing",
    };

    it("should return overrides with text-parsing strategy", async () => {
      const error = new Error("Parse error in response");
      const result = await executeRecovery(fallbackStrategy, error, sampleMessages);

      expect(result.action).toBe("retry");
      expect(result.overrides).toEqual({ toolCallStrategy: "text-parsing" });
      expect(result.messages).toBe(sampleMessages);
      expect(result.strategyUsed).toBe("Parse error — fallback to text parsing");
    });

    it("should abort after maxRetries exceeded", async () => {
      const error = new Error("Parse error");

      const first = await executeRecovery(fallbackStrategy, error, sampleMessages);
      expect(first.action).toBe("retry");

      const second = await executeRecovery(fallbackStrategy, error, sampleMessages);
      expect(second.action).toBe("abort");
    });
  });

  describe("resetRetryState", () => {
    it("should allow retries again after reset", async () => {
      const strategy: RecoveryStrategy = {
        errorPattern: /test/i,
        action: "retry",
        maxRetries: 1,
        backoffMs: 10,
        description: "Test strategy",
      };
      const error = new Error("test error");

      await executeRecovery(strategy, error, sampleMessages);
      const exhausted = await executeRecovery(strategy, error, sampleMessages);
      expect(exhausted.action).toBe("abort");

      resetRetryState();

      const afterReset = await executeRecovery(strategy, error, sampleMessages);
      expect(afterReset.action).toBe("retry");
    });
  });
});

describe("findRecoveryStrategy — MCP-specific patterns", () => {
  it("should match MCP tool timeout error", () => {
    const error = new Error("MCP tool error: Request timed out: tools/call");
    const strategy = findRecoveryStrategy(error);
    expect(strategy).toBeDefined();
    expect(strategy!.description).toContain("MCP tool timeout");
    expect(strategy!.maxRetries).toBe(1);
  });

  it("should match MCP connection refused error", () => {
    const error = new Error("MCP server ECONNREFUSED: connection refused");
    const strategy = findRecoveryStrategy(error);
    expect(strategy).toBeDefined();
    expect(strategy!.description).toContain("MCP connection lost");
    expect(strategy!.action).toBe("compact");
  });

  it("should match MCP disconnected error", () => {
    const error = new Error("MCP client disconnected unexpectedly");
    const strategy = findRecoveryStrategy(error);
    expect(strategy).toBeDefined();
    expect(strategy!.description).toContain("MCP connection lost");
  });

  it("should prefer MCP timeout over generic timeout", () => {
    // MCP-specific pattern should match before the generic timeout
    const mcpError = new Error("MCP tool error: Request timed out: tools/call");
    const strategy = findRecoveryStrategy(mcpError);
    expect(strategy).toBeDefined();
    expect(strategy!.description).toContain("MCP tool timeout");
    // Should get only 1 retry (not 2 like generic timeout)
    expect(strategy!.maxRetries).toBe(1);
  });

  it("should match generic timeout for non-MCP errors", () => {
    const error = new Error("Connection timeout to API server");
    const strategy = findRecoveryStrategy(error);
    expect(strategy).toBeDefined();
    expect(strategy!.description).toBe("Timeout — retry with backoff");
    expect(strategy!.maxRetries).toBe(2);
  });

  it("MCP timeout strategy should execute with single retry + 3s backoff", async () => {
    resetRetryState();
    const mcpTimeoutStrategy = RECOVERY_STRATEGIES.find((s) =>
      s.description.includes("MCP tool timeout"),
    );
    expect(mcpTimeoutStrategy).toBeDefined();

    const error = new Error("MCP tool error: Request timed out");

    // First attempt should succeed
    const first = await executeRecovery(mcpTimeoutStrategy!, error, sampleMessages, {
      signal: undefined,
    });
    expect(first.action).toBe("retry");

    // Second attempt should abort (maxRetries = 1)
    const second = await executeRecovery(mcpTimeoutStrategy!, error, sampleMessages);
    expect(second.action).toBe("abort");
  }, 10000);
});
