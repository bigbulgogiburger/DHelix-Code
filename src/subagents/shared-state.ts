import { BaseError } from "../utils/error.js";

/** Error thrown when shared state operations fail */
export class SharedStateError extends BaseError {
  constructor(message: string, context: Record<string, unknown> = {}) {
    super(message, "SHARED_STATE_ERROR", context);
  }
}

/** Maximum number of messages retained in the message queue */
const MAX_MESSAGE_QUEUE_SIZE = 200;

/** A message exchanged between agents */
export interface AgentMessage {
  readonly fromAgentId: string;
  /** Target agent ID. undefined means broadcast to all agents. */
  readonly toAgentId?: string;
  readonly type: "result" | "progress" | "request" | "error";
  readonly content: string;
  readonly timestamp: number;
}

/** Progress entry for a single agent */
export interface AgentProgress {
  readonly progress: number;
  readonly status: string;
}

/** Shared state interface for inter-agent communication */
export interface SharedAgentState {
  // Key-value store shared across agents
  set(key: string, value: unknown): void;
  get(key: string): unknown | undefined;
  getAll(): ReadonlyMap<string, unknown>;

  // Inter-agent messaging
  send(message: AgentMessage): void;
  getMessages(agentId: string): readonly AgentMessage[];
  getBroadcasts(): readonly AgentMessage[];

  // Progress tracking
  reportProgress(agentId: string, progress: number, status: string): void;
  getProgress(): ReadonlyMap<string, AgentProgress>;

  // Lifecycle
  cleanup(): void;
}

/**
 * Concrete implementation of SharedAgentState.
 *
 * Provides a bounded key-value store, a bounded message queue, and per-agent
 * progress tracking. All data structures are synchronous Map-based, safe for
 * single-threaded Node.js concurrency (Promise interleaving).
 */
export class SharedAgentStateImpl implements SharedAgentState {
  private readonly store = new Map<string, unknown>();
  private readonly messages: AgentMessage[] = [];
  private readonly progressMap = new Map<string, AgentProgress>();

  // -- Key-value store --------------------------------------------------------

  set(key: string, value: unknown): void {
    this.store.set(key, value);
  }

  get(key: string): unknown | undefined {
    return this.store.get(key);
  }

  getAll(): ReadonlyMap<string, unknown> {
    return this.store;
  }

  // -- Inter-agent messaging --------------------------------------------------

  send(message: AgentMessage): void {
    this.messages.push(message);

    // Evict oldest messages when the queue exceeds the bound
    if (this.messages.length > MAX_MESSAGE_QUEUE_SIZE) {
      const excess = this.messages.length - MAX_MESSAGE_QUEUE_SIZE;
      this.messages.splice(0, excess);
    }
  }

  /**
   * Return all messages addressed to `agentId` **or** broadcast to all agents.
   */
  getMessages(agentId: string): readonly AgentMessage[] {
    return this.messages.filter(
      (m) => m.toAgentId === agentId || m.toAgentId === undefined,
    );
  }

  /**
   * Return all broadcast messages (toAgentId is undefined).
   */
  getBroadcasts(): readonly AgentMessage[] {
    return this.messages.filter((m) => m.toAgentId === undefined);
  }

  // -- Progress tracking ------------------------------------------------------

  reportProgress(agentId: string, progress: number, status: string): void {
    const clamped = Math.max(0, Math.min(1, progress));
    this.progressMap.set(agentId, { progress: clamped, status });
  }

  getProgress(): ReadonlyMap<string, AgentProgress> {
    return this.progressMap;
  }

  // -- Lifecycle --------------------------------------------------------------

  /** Reset all shared state, messages, and progress tracking. */
  cleanup(): void {
    this.store.clear();
    this.messages.length = 0;
    this.progressMap.clear();
  }
}

/** Factory function to create a new SharedAgentState instance. */
export function createSharedAgentState(): SharedAgentState {
  return new SharedAgentStateImpl();
}
