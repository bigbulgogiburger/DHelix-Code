import { type HookRunner } from "./runner.js";
import { type HookEventPayload, type HookRunResult } from "./types.js";
import { BaseError } from "../utils/error.js";

/** Error thrown when team hook operations fail */
export class TeamHookError extends BaseError {
  constructor(message: string, context: Record<string, unknown> = {}) {
    super(message, "TEAM_HOOK_ERROR", context);
  }
}

/**
 * Team event types emitted by the Agent Team Manager.
 * These are mapped to hook events (TeammateIdle, TaskCompleted) by the TeamHookEmitter.
 */
export type TeamEvent =
  | { readonly type: "team:created"; readonly teamId: string; readonly teamName: string }
  | {
      readonly type: "team:member-started";
      readonly teamId: string;
      readonly memberId: string;
      readonly memberName: string;
    }
  | {
      readonly type: "team:member-completed";
      readonly teamId: string;
      readonly memberId: string;
      readonly memberName: string;
      readonly result?: string;
    }
  | {
      readonly type: "team:member-failed";
      readonly teamId: string;
      readonly memberId: string;
      readonly memberName: string;
      readonly error: string;
    }
  | {
      readonly type: "team:completed";
      readonly teamId: string;
      readonly results: Readonly<Record<string, string>>;
    }
  | { readonly type: "team:failed"; readonly teamId: string; readonly error: string };

/** Teammate idle event data — emitted when a team member finishes work */
export interface TeammateIdleData {
  readonly teamId: string;
  readonly teamName: string;
  readonly memberId: string;
  readonly memberName: string;
  readonly memberRole: string;
  readonly status: "completed" | "failed" | "cancelled";
  readonly result?: string;
  readonly error?: string;
  readonly elapsedMs?: number;
  readonly remainingMembers: number;
  readonly totalMembers: number;
}

/** Task completed event data — emitted when a shared task is completed */
export interface TaskCompletedData {
  readonly taskId: string;
  readonly taskTitle: string;
  readonly taskPriority: string;
  readonly assignedTo?: string;
  readonly result?: string;
  readonly elapsedMs?: number;
  readonly dependentTasks: readonly string[];
  readonly teamId?: string;
}

/**
 * Build a HookEventPayload for a TeammateIdle event.
 */
function buildTeammateIdlePayload(
  data: TeammateIdleData,
  sessionId: string,
  workingDirectory: string,
): HookEventPayload {
  return {
    event: "TeammateIdle",
    sessionId,
    workingDirectory,
    data: {
      teamId: data.teamId,
      teamName: data.teamName,
      memberId: data.memberId,
      memberName: data.memberName,
      memberRole: data.memberRole,
      status: data.status,
      result: data.result,
      error: data.error,
      elapsedMs: data.elapsedMs,
      remainingMembers: data.remainingMembers,
      totalMembers: data.totalMembers,
    },
  };
}

/**
 * Build a HookEventPayload for a TaskCompleted event.
 */
function buildTaskCompletedPayload(
  data: TaskCompletedData,
  sessionId: string,
  workingDirectory: string,
): HookEventPayload {
  return {
    event: "TaskCompleted",
    sessionId,
    workingDirectory,
    data: {
      taskId: data.taskId,
      taskTitle: data.taskTitle,
      taskPriority: data.taskPriority,
      assignedTo: data.assignedTo,
      result: data.result,
      elapsedMs: data.elapsedMs,
      dependentTasks: [...data.dependentTasks],
      teamId: data.teamId,
    },
  };
}

/** Configuration for creating a TeamHookEmitter */
export interface TeamHookEmitterConfig {
  readonly hookRunner: HookRunner;
  readonly sessionId: string;
  readonly workingDirectory: string;
}

/**
 * Integrates the hook system with the Agent Team Manager.
 *
 * Emits `TeammateIdle` and `TaskCompleted` hook events when team members
 * finish work or tasks are completed. Provides error isolation so hook
 * failures never crash team execution.
 */
export class TeamHookEmitter {
  private readonly hookRunner: HookRunner;
  private readonly sessionId: string;
  private readonly workingDirectory: string;

  constructor(config: TeamHookEmitterConfig) {
    this.hookRunner = config.hookRunner;
    this.sessionId = config.sessionId;
    this.workingDirectory = config.workingDirectory;
  }

  /** Emit TeammateIdle when a team member finishes work */
  async emitTeammateIdle(data: TeammateIdleData): Promise<HookRunResult> {
    const payload = buildTeammateIdlePayload(data, this.sessionId, this.workingDirectory);
    return this.hookRunner.run("TeammateIdle", payload);
  }

  /** Emit TaskCompleted when a shared task is completed */
  async emitTaskCompleted(data: TaskCompletedData): Promise<HookRunResult> {
    const payload = buildTaskCompletedPayload(data, this.sessionId, this.workingDirectory);
    return this.hookRunner.run("TaskCompleted", payload);
  }

  /**
   * Convert a team event to the appropriate hook emissions.
   * Silently handles errors so hooks never crash team execution.
   */
  async handleTeamEvent(event: TeamEvent): Promise<void> {
    try {
      switch (event.type) {
        case "team:member-completed": {
          await this.emitTeammateIdle({
            teamId: event.teamId,
            teamName: "",
            memberId: event.memberId,
            memberName: event.memberName,
            memberRole: "",
            status: "completed",
            result: event.result,
            remainingMembers: 0,
            totalMembers: 0,
          });
          break;
        }
        case "team:member-failed": {
          await this.emitTeammateIdle({
            teamId: event.teamId,
            teamName: "",
            memberId: event.memberId,
            memberName: event.memberName,
            memberRole: "",
            status: "failed",
            error: event.error,
            remainingMembers: 0,
            totalMembers: 0,
          });
          break;
        }
        case "team:created":
        case "team:member-started":
        case "team:completed":
        case "team:failed":
          // No hook emission for these event types
          break;
      }
    } catch {
      // Silently swallow errors — hooks must not crash team execution
    }
  }

  /** Check if any hooks are configured for team events */
  hasTeamHooks(): boolean {
    return this.hasTeammateIdleHooks() || this.hasTaskCompletedHooks();
  }

  /** Check if TeammateIdle hooks are configured */
  hasTeammateIdleHooks(): boolean {
    return this.hookRunner.hasHooks("TeammateIdle");
  }

  /** Check if TaskCompleted hooks are configured */
  hasTaskCompletedHooks(): boolean {
    return this.hookRunner.hasHooks("TaskCompleted");
  }
}

/** Factory function to create a TeamHookEmitter */
export function createTeamHookEmitter(config: TeamHookEmitterConfig): TeamHookEmitter {
  return new TeamHookEmitter(config);
}

/**
 * Wire a TeamHookEmitter to a team manager's event callback.
 * Returns a callback function suitable for AgentTeamManager's onEvent.
 *
 * Tracks remaining member count and decrements on member-completed/failed events.
 */
export function createTeamEventHandler(
  emitter: TeamHookEmitter,
  teamName: string,
  totalMembers: number,
): (event: TeamEvent) => Promise<void> {
  let remaining = totalMembers;

  return async (event: TeamEvent): Promise<void> => {
    try {
      switch (event.type) {
        case "team:member-completed": {
          remaining = Math.max(0, remaining - 1);
          await emitter.emitTeammateIdle({
            teamId: event.teamId,
            teamName,
            memberId: event.memberId,
            memberName: event.memberName,
            memberRole: "",
            status: "completed",
            result: event.result,
            remainingMembers: remaining,
            totalMembers,
          });
          break;
        }
        case "team:member-failed": {
          remaining = Math.max(0, remaining - 1);
          await emitter.emitTeammateIdle({
            teamId: event.teamId,
            teamName,
            memberId: event.memberId,
            memberName: event.memberName,
            memberRole: "",
            status: "failed",
            error: event.error,
            remainingMembers: remaining,
            totalMembers,
          });
          break;
        }
        case "team:completed": {
          await emitter.emitTaskCompleted({
            taskId: `team-${event.teamId}`,
            taskTitle: `Team ${teamName} completed`,
            taskPriority: "high",
            result: JSON.stringify(event.results),
            dependentTasks: [],
            teamId: event.teamId,
          });
          break;
        }
        case "team:created":
        case "team:member-started":
        case "team:failed":
          // No hook emission for these event types
          break;
      }
    } catch {
      // Silently swallow errors — hooks must not crash team execution
    }
  };
}
