/**
 * Telemetry event schema definitions.
 * Structured events for tool decisions, errors, and session lifecycle.
 */

/** Base event with common fields */
interface BaseEvent {
  readonly timestamp: string;
  readonly sessionId?: string;
}

/** Tool decision event — recorded when a tool call is approved/denied */
export interface ToolDecisionEvent extends BaseEvent {
  readonly type: "tool_decision";
  readonly toolName: string;
  readonly decision: "approved" | "denied" | "auto_approved" | "blocked_by_hook";
  readonly reason?: string;
  readonly durationMs?: number;
}

/** Tool execution event — recorded when a tool completes */
export interface ToolExecutionEvent extends BaseEvent {
  readonly type: "tool_execution";
  readonly toolName: string;
  readonly success: boolean;
  readonly durationMs: number;
  readonly errorCode?: string;
}

/** LLM call event — recorded for each LLM API call */
export interface LLMCallEvent extends BaseEvent {
  readonly type: "llm_call";
  readonly model: string;
  readonly inputTokens: number;
  readonly outputTokens: number;
  readonly durationMs: number;
  readonly success: boolean;
  readonly errorCode?: string;
}

/** Session lifecycle event */
export interface SessionEvent extends BaseEvent {
  readonly type: "session_start" | "session_end";
  readonly model: string;
  readonly durationSeconds?: number;
  readonly totalIterations?: number;
  readonly totalTokens?: number;
}

/** Error event — recorded for significant errors */
export interface ErrorEvent extends BaseEvent {
  readonly type: "error";
  readonly category: "llm" | "tool" | "permission" | "config" | "internal";
  readonly code: string;
  readonly message: string;
  readonly recoverable: boolean;
}

/** Agent iteration event */
export interface AgentIterationEvent extends BaseEvent {
  readonly type: "agent_iteration";
  readonly iteration: number;
  readonly toolCalls: number;
  readonly model: string;
}

/** Union of all telemetry event types */
export type TelemetryEvent =
  | ToolDecisionEvent
  | ToolExecutionEvent
  | LLMCallEvent
  | SessionEvent
  | ErrorEvent
  | AgentIterationEvent;

/**
 * In-memory event buffer.
 * Collects events until they are exported or flushed.
 */
export class EventBuffer {
  private events: TelemetryEvent[] = [];
  private readonly maxSize: number;

  constructor(maxSize = 1000) {
    this.maxSize = maxSize;
  }

  /** Record an event */
  record(event: TelemetryEvent): void {
    this.events.push(event);
    // Evict oldest events if buffer is full
    if (this.events.length > this.maxSize) {
      this.events = this.events.slice(-this.maxSize);
    }
  }

  /** Get all buffered events and clear the buffer */
  flush(): readonly TelemetryEvent[] {
    const flushed = [...this.events];
    this.events = [];
    return flushed;
  }

  /** Get current buffer size */
  get size(): number {
    return this.events.length;
  }

  /** Peek at buffered events without clearing */
  peek(): readonly TelemetryEvent[] {
    return [...this.events];
  }
}

/** Create a telemetry event with automatic timestamp */
export function createEvent<T extends TelemetryEvent>(
  event: Omit<T, "timestamp"> & { timestamp?: string },
): T {
  return {
    ...event,
    timestamp: event.timestamp ?? new Date().toISOString(),
  } as T;
}

/** Singleton event buffer */
export const eventBuffer = new EventBuffer();
