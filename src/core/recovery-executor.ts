import { type RecoveryStrategy } from "./recovery-strategy.js";
import { type ChatMessage } from "../llm/provider.js";

/**
 * Result of executing a recovery strategy.
 * "retry" means the caller should re-attempt the operation.
 * "abort" means recovery failed and the caller should stop.
 */
export interface RecoveryResult {
  readonly action: "retry" | "abort";
  readonly messages?: readonly ChatMessage[];
  readonly overrides?: Record<string, unknown>;
  readonly strategyUsed: string;
}

/** Options for recovery execution */
export interface RecoveryExecutorOptions {
  readonly maxContextTokens?: number;
  readonly signal?: AbortSignal;
}

/** Internal tracking for retry attempts per strategy */
interface RetryState {
  readonly strategyDescription: string;
  attempts: number;
}

/** Map of strategy descriptions to their retry state */
const retryStates = new Map<string, RetryState>();

/**
 * Reset all retry state. Useful between sessions or for testing.
 */
export function resetRetryState(): void {
  retryStates.clear();
}

/**
 * Get or create retry state for a strategy.
 */
function getRetryState(strategy: RecoveryStrategy): RetryState {
  const existing = retryStates.get(strategy.description);
  if (existing) return existing;

  const state: RetryState = {
    strategyDescription: strategy.description,
    attempts: 0,
  };
  retryStates.set(strategy.description, state);
  return state;
}

/**
 * Wait for a delay, respecting an optional AbortSignal.
 */
function delayWithSignal(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    if (signal?.aborted) {
      reject(new Error("Aborted"));
      return;
    }
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener(
      "abort",
      () => {
        clearTimeout(timer);
        reject(new Error("Aborted"));
      },
      { once: true },
    );
  });
}

/**
 * Compact messages by summarizing older turns.
 * Keeps the system message and recent messages, replacing middle
 * messages with a summary message.
 */
function compactMessages(
  messages: readonly ChatMessage[],
  _maxContextTokens?: number,
): readonly ChatMessage[] {
  if (messages.length <= 4) return messages;

  // Keep system message (index 0) + last 3 messages
  const systemMessages = messages.filter((m) => m.role === "system");
  const nonSystem = messages.filter((m) => m.role !== "system");

  const keepRecent = 3;
  const recentMessages = nonSystem.slice(-keepRecent);
  const droppedCount = nonSystem.length - keepRecent;

  const summaryMessage: ChatMessage = {
    role: "user" as const,
    content: `[Context compacted: ${droppedCount} earlier messages were summarized to free context space. Key context has been preserved in recent messages.]`,
  };

  return [...systemMessages, summaryMessage, ...recentMessages];
}

/**
 * Execute a recovery strategy found by findRecoveryStrategy().
 *
 * Strategies:
 * - "compact": triggers context compaction (removes older messages), then retry
 * - "retry": exponential backoff delay, then retry
 * - "fallback-strategy": switches tool call strategy to text-parsing via overrides
 *
 * Returns a RecoveryResult indicating whether to retry or abort, with any
 * modified messages or configuration overrides.
 */
export async function executeRecovery(
  strategy: RecoveryStrategy,
  _error: Error,
  messages: readonly ChatMessage[],
  options?: RecoveryExecutorOptions,
): Promise<RecoveryResult> {
  const state = getRetryState(strategy);

  // Check if we've exceeded max retries for this strategy
  if (state.attempts >= strategy.maxRetries) {
    return {
      action: "abort",
      strategyUsed: strategy.description,
    };
  }

  state.attempts++;

  switch (strategy.action) {
    case "compact": {
      const compacted = compactMessages(messages, options?.maxContextTokens);
      return {
        action: "retry",
        messages: compacted,
        strategyUsed: strategy.description,
      };
    }

    case "retry": {
      const backoffMs = strategy.backoffMs ?? 1000;
      const delay = backoffMs * Math.pow(2, state.attempts - 1);

      await delayWithSignal(delay, options?.signal);

      return {
        action: "retry",
        messages,
        strategyUsed: strategy.description,
      };
    }

    case "fallback-strategy": {
      return {
        action: "retry",
        messages,
        overrides: {
          toolCallStrategy: "text-parsing",
        },
        strategyUsed: strategy.description,
      };
    }

    default: {
      return {
        action: "abort",
        strategyUsed: strategy.description,
      };
    }
  }
}
