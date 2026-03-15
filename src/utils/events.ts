import mitt from "mitt";

/** Default threshold — warn when any single event type exceeds this many listeners */
export const LISTENER_WARN_THRESHOLD = 20;

/** All application event types */
export type AppEvents = {
  /** LLM streaming started */
  "llm:start": { iteration: number };
  /** LLM text delta received during streaming */
  "llm:text-delta": { text: string };
  /** LLM tool call delta received */
  "llm:tool-delta": { toolName: string; args: string };
  /** LLM streaming completed */
  "llm:complete": { tokenCount: number };
  /** LLM token usage reported during streaming (via stream_options.include_usage) */
  "llm:usage": {
    usage: {
      readonly promptTokens: number;
      readonly completionTokens: number;
      readonly totalTokens: number;
    };
    model: string;
  };
  /** LLM streaming errored */
  "llm:error": { error: Error };

  /** Anthropic prompt cache hit/miss statistics per request */
  "llm:cache-stats": {
    readonly cacheCreationInputTokens: number;
    readonly cacheReadInputTokens: number;
    readonly model: string;
  };

  /** Agent loop iteration started */
  "agent:iteration": { iteration: number };
  /** Assistant message produced during agent loop (intermediate or final) */
  "agent:assistant-message": {
    readonly content: string;
    readonly toolCalls: readonly { readonly id: string; readonly name: string }[];
    readonly iteration: number;
    readonly isFinal: boolean;
  };

  /** Tool execution started */
  "tool:start": { name: string; id: string; args?: Record<string, unknown> };
  /** Tool execution completed */
  "tool:complete": {
    name: string;
    id: string;
    isError: boolean;
    output?: string;
    metadata?: Readonly<Record<string, unknown>>;
  };

  /** Context compaction is about to start */
  "context:pre-compact": { compactionNumber: number };

  /** Conversation message added */
  "conversation:message": { role: string };
  /** Conversation cleared */
  "conversation:clear": undefined;

  /** User input submitted */
  "input:submit": { content: string };
  /** User requested abort */
  "input:abort": undefined;

  /** Auto-lint requested after file mutation */
  "lint:request": {
    toolName: string;
    toolId: string;
    lintCommand: string;
    testCommand?: string;
  };

  /** Checkpoint created after file-modifying tool execution */
  "checkpoint:created": {
    checkpointId: string;
    description: string;
    fileCount: number;
  };
  /** Checkpoint restored via /rewind */
  "checkpoint:restored": {
    checkpointId: string;
    restoredFiles: number;
    skippedFiles: number;
  };

  /** Agent loop usage update emitted after each LLM call with running totals */
  "agent:usage-update": {
    readonly promptTokens: number;
    readonly completionTokens: number;
    readonly totalTokens: number;
    readonly iteration: number;
  };

  /** Agent loop completed with full summary */
  "agent:complete": {
    readonly iterations: number;
    readonly totalTokens: number;
    readonly toolCallCount: number;
    readonly aborted: boolean;
  };

  /** Voice input toggle (from /voice command) */
  "voice:toggle": { enabled: boolean };

  /** Permission mode changed (from /plan or other commands) */
  "permission:mode-change": { mode: string };

  /** Tool output streaming delta (for long-running tools like bash) */
  "tool:output-delta": { id: string; name: string; chunk: string };
};

/** Typed event emitter for the application */
export type AppEventEmitter = ReturnType<typeof mitt<AppEvents>>;

/**
 * Check listener counts across all event types on a mitt emitter.
 * Emits a warning to stderr if any event type exceeds the threshold.
 * Returns the maximum listener count found (useful for testing).
 */
export function checkListenerLeaks(
  emitter: AppEventEmitter,
  threshold: number = LISTENER_WARN_THRESHOLD,
): number {
  let maxCount = 0;
  for (const [eventType, handlers] of emitter.all) {
    const count = handlers?.length ?? 0;
    if (count > maxCount) maxCount = count;
    if (count > threshold) {
      process.stderr.write(
        `[events] Warning: "${String(eventType)}" has ${count} listeners (threshold: ${threshold}). Possible memory leak.\n`,
      );
    }
  }
  return maxCount;
}

/** Create a new typed event emitter */
export function createEventEmitter(): AppEventEmitter {
  return mitt<AppEvents>();
}
