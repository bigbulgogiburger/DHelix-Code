import mitt from "mitt";

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
  /** LLM streaming errored */
  "llm:error": { error: Error };

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
  "tool:complete": { name: string; id: string; isError: boolean; output?: string };

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
};

/** Typed event emitter for the application */
export type AppEventEmitter = ReturnType<typeof mitt<AppEvents>>;

/** Create a new typed event emitter */
export function createEventEmitter(): AppEventEmitter {
  return mitt<AppEvents>();
}
