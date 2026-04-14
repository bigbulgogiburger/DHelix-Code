import { describe, expect, it } from "vitest";

import {
  ChainedRecoveryStrategy,
  createDefaultRecoveryChain,
  type RecoveryStrategy,
} from "../../../src/core/recovery-strategy.js";

/**
 * Test chain with all three action types for the same error pattern.
 * This lets us verify escalation through retry → compact → fallback-strategy.
 */
const TEST_CHAIN: readonly RecoveryStrategy[] = [
  {
    errorPattern: /timeout/i,
    action: "retry",
    maxRetries: 2,
    backoffMs: 2000,
    description: "Timeout — retry with backoff",
  },
  {
    errorPattern: /timeout/i,
    action: "compact",
    maxRetries: 1,
    description: "Timeout — compact and retry",
  },
  {
    errorPattern: /timeout/i,
    action: "fallback-strategy",
    maxRetries: 1,
    description: "Timeout — fallback to text parsing",
  },
];

describe("ChainedRecoveryStrategy", () => {
  it("returns matching retry strategy first when no previous action", () => {
    const chain = new ChainedRecoveryStrategy(TEST_CHAIN);
    const error = new Error("Request timeout");

    const result = chain.findNext(error);

    expect(result).toBeDefined();
    expect(result!.action).toBe("retry");
    expect(result!.description).toBe("Timeout — retry with backoff");
  });

  it("suggests compact after retry failure", () => {
    const chain = new ChainedRecoveryStrategy(TEST_CHAIN);
    const error = new Error("Request timeout");

    const result = chain.findNext(error, "retry");

    expect(result).toBeDefined();
    expect(result!.action).toBe("compact");
    expect(result!.description).toBe("Timeout — compact and retry");
  });

  it("suggests fallback-strategy after compact failure", () => {
    const chain = new ChainedRecoveryStrategy(TEST_CHAIN);
    const error = new Error("Request timeout");

    const result = chain.findNext(error, "compact");

    expect(result).toBeDefined();
    expect(result!.action).toBe("fallback-strategy");
    expect(result!.description).toBe("Timeout — fallback to text parsing");
  });

  it("returns undefined after fallback-strategy failure (no more escalation)", () => {
    const chain = new ChainedRecoveryStrategy(TEST_CHAIN);
    const error = new Error("Request timeout");

    const result = chain.findNext(error, "fallback-strategy");

    expect(result).toBeUndefined();
  });

  it("returns undefined when no strategy matches the error", () => {
    const chain = new ChainedRecoveryStrategy(TEST_CHAIN);
    const error = new Error("Unknown catastrophic failure");

    const result = chain.findNext(error);

    expect(result).toBeUndefined();
  });

  it("caps backoff at 30 seconds", () => {
    const highBackoffChain: readonly RecoveryStrategy[] = [
      {
        errorPattern: /slow/i,
        action: "retry",
        maxRetries: 1,
        backoffMs: 60_000,
        description: "Slow — retry with high backoff",
      },
    ];
    const chain = new ChainedRecoveryStrategy(highBackoffChain);
    const error = new Error("Very slow response");

    const result = chain.findNext(error);

    expect(result).toBeDefined();
    expect(result!.backoffMs).toBe(30_000);
  });

  it("preserves backoff when under the cap", () => {
    const chain = new ChainedRecoveryStrategy(TEST_CHAIN);
    const error = new Error("Request timeout");

    const result = chain.findNext(error);

    expect(result).toBeDefined();
    expect(result!.backoffMs).toBe(2000);
  });

  it("preserves undefined backoff when strategy has none", () => {
    const chain = new ChainedRecoveryStrategy(TEST_CHAIN);
    const error = new Error("Request timeout");

    const result = chain.findNext(error, "retry");

    expect(result).toBeDefined();
    expect(result!.backoffMs).toBeUndefined();
  });

  it("does not mutate the original strategy objects", () => {
    const highBackoffChain: RecoveryStrategy[] = [
      {
        errorPattern: /slow/i,
        action: "retry",
        maxRetries: 1,
        backoffMs: 60_000,
        description: "Slow — retry",
      },
    ];
    const chain = new ChainedRecoveryStrategy(highBackoffChain);
    const error = new Error("Very slow");

    chain.findNext(error);

    expect(highBackoffChain[0]!.backoffMs).toBe(60_000);
  });
});

describe("createDefaultRecoveryChain", () => {
  it("returns a ChainedRecoveryStrategy instance", () => {
    const chain = createDefaultRecoveryChain();

    expect(chain).toBeInstanceOf(ChainedRecoveryStrategy);
  });

  it("finds a strategy for known error patterns", () => {
    const chain = createDefaultRecoveryChain();
    const error = new Error("429 Too Many Requests");

    const result = chain.findNext(error);

    expect(result).toBeDefined();
    expect(result!.action).toBe("retry");
  });

  it("escalates from retry to compact for context overflow errors", () => {
    const chain = createDefaultRecoveryChain();
    const error = new Error("request too large, context exceeded token limit");

    // First match should be compact (since the pattern matches compact action)
    const result = chain.findNext(error);

    expect(result).toBeDefined();
    expect(result!.action).toBe("compact");
  });
});
