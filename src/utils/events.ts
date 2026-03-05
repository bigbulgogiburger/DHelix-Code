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

  /** Tool execution started */
  "tool:start": { name: string; id: string };
  /** Tool execution completed */
  "tool:complete": { name: string; id: string; isError: boolean };

  /** Conversation message added */
  "conversation:message": { role: string };
  /** Conversation cleared */
  "conversation:clear": undefined;

  /** User input submitted */
  "input:submit": { content: string };
  /** User requested abort */
  "input:abort": undefined;
};

/** Typed event emitter for the application */
export type AppEventEmitter = ReturnType<typeof mitt<AppEvents>>;

/** Create a new typed event emitter */
export function createEventEmitter(): AppEventEmitter {
  return mitt<AppEvents>();
}
