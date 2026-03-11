import { randomUUID } from "node:crypto";

/** Types of entries that can appear in an activity feed */
export type ActivityEntryType =
  | "user-message"
  | "assistant-text"
  | "assistant-intermediate"
  | "tool-start"
  | "tool-complete"
  | "tool-denied"
  | "error";

/** A single activity entry within a turn */
export interface ActivityEntry {
  readonly type: ActivityEntryType;
  readonly timestamp: Date;
  readonly data: Readonly<Record<string, unknown>>;
}

/** A complete turn of activity (one user message + agent response cycle) */
export interface TurnActivity {
  readonly id: string;
  readonly entries: readonly ActivityEntry[];
  readonly isComplete: boolean;
}

/**
 * Collects activity entries during agent loop execution.
 * Organizes entries into turns (one per user message cycle).
 * Immutable entry storage — entries are never mutated after creation.
 */
export class ActivityCollector {
  private _currentTurn: { readonly id: string; entries: ActivityEntry[] } | null = null;
  private readonly _completedTurns: TurnActivity[] = [];

  /** Start a new turn. Completes any in-progress turn first. */
  startTurn(): string {
    if (this._currentTurn) {
      this.completeTurn();
    }
    const id = randomUUID();
    this._currentTurn = { id, entries: [] };
    return id;
  }

  /** Add an entry to the current turn. Auto-starts a turn if none is active. */
  addEntry(type: ActivityEntryType, data: Readonly<Record<string, unknown>> = {}): void {
    if (!this._currentTurn) {
      this.startTurn();
    }
    this._currentTurn!.entries.push({
      type,
      timestamp: new Date(),
      data,
    });
  }

  /** Mark the current turn as complete. */
  completeTurn(): void {
    if (!this._currentTurn) {
      return;
    }
    this._completedTurns.push({
      id: this._currentTurn.id,
      entries: [...this._currentTurn.entries],
      isComplete: true,
    });
    this._currentTurn = null;
  }

  /** Get the current in-progress turn, or null if none. */
  getCurrentTurn(): TurnActivity | null {
    if (!this._currentTurn) {
      return null;
    }
    return {
      id: this._currentTurn.id,
      entries: [...this._currentTurn.entries],
      isComplete: false,
    };
  }

  /** Get all completed turns. */
  getCompletedTurns(): readonly TurnActivity[] {
    return [...this._completedTurns];
  }

  /** Get all turns (completed + current if active). */
  getAllTurns(): readonly TurnActivity[] {
    const turns: TurnActivity[] = [...this._completedTurns];
    const current = this.getCurrentTurn();
    if (current) {
      turns.push(current);
    }
    return turns;
  }
}
