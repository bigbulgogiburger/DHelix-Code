/**
 * Agent Team Manager — orchestrates teams of worker agents.
 *
 * Handles team creation, dependency-aware scheduling with topological sort,
 * concurrency limits, failure propagation, and event notification.
 */

import { randomUUID } from "node:crypto";
import { BaseError } from "../utils/error.js";
import { createSharedAgentState, type SharedAgentState } from "./shared-state.js";
import {
  type TeamDefinition,
  type TeamSession,
  type TeamMember,
  type CreateTeamConfig,
  type TeamEvent,
  type TeamStatus,
  type MemberStatus,
} from "./team-types.js";

/** Error thrown when team operations fail */
export class TeamManagerError extends BaseError {
  constructor(message: string, context: Record<string, unknown> = {}) {
    super(message, "TEAM_MANAGER_ERROR", context);
  }
}

/** Callback type for agent execution */
export type AgentExecutor = (
  member: TeamMember,
  sharedState: SharedAgentState,
) => Promise<{
  readonly agentId: string;
  readonly response: string;
}>;

/** Internal mutable version of TeamSession for state management */
interface MutableTeamSession {
  readonly id: string;
  readonly definition: TeamDefinition;
  status: TeamStatus;
  members: TeamMember[];
  readonly createdAt: number;
  completedAt?: number;
  readonly results: Map<string, string>;
  readonly sharedState: SharedAgentState;
}

/**
 * Manages creation and execution of agent teams.
 *
 * Teams consist of members (agents) that can declare dependencies on each
 * other. The manager executes members in topological order, respecting
 * concurrency limits. When a member fails, all transitive dependents are
 * automatically cancelled.
 */
export class AgentTeamManager {
  private readonly sessions = new Map<string, MutableTeamSession>();
  private readonly eventListeners: Array<(event: TeamEvent) => void> = [];

  /**
   * Create a new team from configuration.
   *
   * If `dependsOn` entries in member configs contain member **names** rather
   * than UUIDs, they are automatically resolved to the assigned member IDs.
   * This allows callers to specify dependencies by name before IDs are known.
   */
  createTeam(config: CreateTeamConfig): TeamSession {
    if (config.members.length === 0) {
      throw new TeamManagerError("Team must have at least one member", {
        teamName: config.name,
      });
    }

    // First pass: assign IDs, build name→ID lookup
    const nameToId = new Map<string, string>();
    const members: TeamMember[] = config.members.map((m) => {
      const id = randomUUID();
      nameToId.set(m.name, id);
      return {
        ...m,
        id,
        status: "pending" as MemberStatus,
      };
    });

    // Second pass: resolve name-based dependsOn to actual IDs
    for (let i = 0; i < members.length; i++) {
      const member = members[i];
      if (member.dependsOn && member.dependsOn.length > 0) {
        const resolvedDeps = member.dependsOn.map((dep) => nameToId.get(dep) ?? dep);
        members[i] = { ...member, dependsOn: resolvedDeps };
      }
    }

    const definition: TeamDefinition = {
      name: config.name,
      description: config.description,
      objective: config.objective,
      members,
      maxConcurrency: config.maxConcurrency,
    };

    const session: MutableTeamSession = {
      id: randomUUID(),
      definition,
      status: "creating",
      members,
      createdAt: Date.now(),
      results: new Map(),
      sharedState: createSharedAgentState(),
    };

    this.sessions.set(session.id, session);
    this.emit({ type: "team:created", teamId: session.id });

    return this.toReadonlySession(session);
  }

  /** Execute a team — run members respecting dependencies and concurrency */
  async executeTeam(
    teamId: string,
    executor: AgentExecutor,
    options?: { readonly signal?: AbortSignal },
  ): Promise<TeamSession> {
    const session = this.sessions.get(teamId);
    if (!session) {
      throw new TeamManagerError("Team session not found", { teamId });
    }

    if (session.status !== "creating") {
      throw new TeamManagerError("Team is not in a valid state for execution", {
        teamId,
        currentStatus: session.status,
      });
    }

    // Validate dependency graph before execution
    this.validateDependencies(session);

    session.status = "active";
    const signal = options?.signal;

    try {
      await this.runMembers(session, executor, signal);

      const hasFailures = session.members.some(
        (m) => m.status === "failed" || m.status === "cancelled",
      );

      if (hasFailures) {
        session.status = "failed";
        session.completedAt = Date.now();
        const failedMembers = session.members
          .filter((m) => m.status === "failed")
          .map((m) => m.name);
        this.emit({
          type: "team:failed",
          teamId: session.id,
          error: `Members failed: ${failedMembers.join(", ")}`,
        });
      } else {
        session.status = "completed";
        session.completedAt = Date.now();
        this.emit({ type: "team:completed", teamId: session.id });
      }
    } catch (error) {
      session.status = "failed";
      session.completedAt = Date.now();
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.emit({ type: "team:failed", teamId: session.id, error: errorMessage });
    }

    return this.toReadonlySession(session);
  }

  /** Get a team session by ID */
  getSession(teamId: string): TeamSession | undefined {
    const session = this.sessions.get(teamId);
    return session ? this.toReadonlySession(session) : undefined;
  }

  /** Get all active team sessions */
  getActiveSessions(): readonly TeamSession[] {
    const active: TeamSession[] = [];
    for (const session of this.sessions.values()) {
      if (session.status === "active" || session.status === "creating") {
        active.push(this.toReadonlySession(session));
      }
    }
    return active;
  }

  /** Cancel a running team */
  async cancelTeam(teamId: string): Promise<void> {
    const session = this.sessions.get(teamId);
    if (!session) {
      throw new TeamManagerError("Team session not found", { teamId });
    }

    if (session.status !== "active" && session.status !== "creating") {
      // Already completed/failed/completing — nothing to do
      return;
    }

    session.status = "completing";

    // Mark all pending/running members as cancelled
    session.members = session.members.map((m) =>
      m.status === "pending" || m.status === "running"
        ? { ...m, status: "cancelled" as MemberStatus, completedAt: Date.now() }
        : m,
    );

    session.status = "failed";
    session.completedAt = Date.now();
    this.emit({ type: "team:failed", teamId: session.id, error: "Team cancelled" });
  }

  /** Get team status summary */
  getTeamSummary(teamId: string): string {
    const session = this.sessions.get(teamId);
    if (!session) {
      return "Team not found";
    }

    const counts = {
      pending: 0,
      running: 0,
      completed: 0,
      failed: 0,
      cancelled: 0,
    };

    for (const member of session.members) {
      counts[member.status]++;
    }

    const parts = [
      `Team "${session.definition.name}" [${session.status}]`,
      `Members: ${session.members.length} total`,
    ];

    if (counts.completed > 0) {
      parts.push(`${counts.completed} completed`);
    }
    if (counts.running > 0) {
      parts.push(`${counts.running} running`);
    }
    if (counts.pending > 0) {
      parts.push(`${counts.pending} pending`);
    }
    if (counts.failed > 0) {
      parts.push(`${counts.failed} failed`);
    }
    if (counts.cancelled > 0) {
      parts.push(`${counts.cancelled} cancelled`);
    }

    return parts.join(" | ");
  }

  /** Register event listener */
  onEvent(listener: (event: TeamEvent) => void): () => void {
    this.eventListeners.push(listener);
    return () => {
      const index = this.eventListeners.indexOf(listener);
      if (index >= 0) {
        this.eventListeners.splice(index, 1);
      }
    };
  }

  /** Cleanup completed sessions */
  cleanup(): void {
    const toRemove: string[] = [];
    for (const [id, session] of this.sessions) {
      if (session.status === "completed" || session.status === "failed") {
        session.sharedState.cleanup();
        toRemove.push(id);
      }
    }
    for (const id of toRemove) {
      this.sessions.delete(id);
    }
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  /** Run members in dependency-aware topological order with concurrency control */
  private async runMembers(
    session: MutableTeamSession,
    executor: AgentExecutor,
    signal?: AbortSignal,
  ): Promise<void> {
    const executionLevels = this.buildExecutionOrder(session.members);

    for (const level of executionLevels) {
      if (signal?.aborted) {
        this.cancelPendingMembers(session);
        break;
      }

      const readyIds = new Set(level);
      const readyMembers = session.members.filter(
        (m) => readyIds.has(m.id) && m.status === "pending",
      );

      if (readyMembers.length === 0) {
        continue;
      }

      const maxConcurrency = session.definition.maxConcurrency ?? readyMembers.length;
      await this.executeMembersWithConcurrency(
        session,
        readyMembers,
        maxConcurrency,
        executor,
        signal,
      );
    }
  }

  /** Execute a batch of members with concurrency limit */
  private async executeMembersWithConcurrency(
    session: MutableTeamSession,
    members: readonly TeamMember[],
    maxConcurrency: number,
    executor: AgentExecutor,
    signal?: AbortSignal,
  ): Promise<void> {
    const queue = [...members];
    const running = new Set<Promise<void>>();

    const runOne = async (member: TeamMember): Promise<void> => {
      await this.executeSingleMember(session, member, executor, signal);
    };

    while (queue.length > 0 || running.size > 0) {
      // Fill up to maxConcurrency
      while (queue.length > 0 && running.size < maxConcurrency) {
        if (signal?.aborted) {
          this.cancelPendingMembers(session);
          // Wait for in-flight tasks to settle
          if (running.size > 0) {
            await Promise.allSettled([...running]);
          }
          return;
        }

        const member = queue.shift()!;

        // Skip members that were cancelled due to dependency failure
        if (member.status !== "pending") {
          continue;
        }

        const promise = runOne(member).finally(() => {
          running.delete(promise);
        });
        running.add(promise);
      }

      // Wait for at least one to complete
      if (running.size > 0) {
        await Promise.race([...running]);
      }
    }
  }

  /** Execute a single team member */
  private async executeSingleMember(
    session: MutableTeamSession,
    member: TeamMember,
    executor: AgentExecutor,
    signal?: AbortSignal,
  ): Promise<void> {
    if (signal?.aborted) {
      this.updateMemberStatus(session, member.id, {
        status: "cancelled",
        completedAt: Date.now(),
      });
      return;
    }

    this.updateMemberStatus(session, member.id, {
      status: "running",
      startedAt: Date.now(),
    });
    this.emit({ type: "team:member-started", teamId: session.id, memberId: member.id });

    try {
      const executionResult = await executor(member, session.sharedState);

      this.updateMemberStatus(session, member.id, {
        status: "completed",
        agentId: executionResult.agentId,
        result: executionResult.response,
        completedAt: Date.now(),
      });

      session.results.set(member.id, executionResult.response);

      this.emit({
        type: "team:member-completed",
        teamId: session.id,
        memberId: member.id,
        result: executionResult.response,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);

      this.updateMemberStatus(session, member.id, {
        status: "failed",
        result: errorMessage,
        completedAt: Date.now(),
      });

      this.emit({
        type: "team:member-failed",
        teamId: session.id,
        memberId: member.id,
        error: errorMessage,
      });

      // Cancel all transitive dependents
      this.cancelDependents(session, member.id);
    }
  }

  /**
   * Build topological execution order from dependencies.
   * Returns an array of arrays — each inner array is a "level" of members
   * that can execute in parallel. Level N+1 depends on level N.
   */
  private buildExecutionOrder(members: readonly TeamMember[]): readonly string[][] {
    const memberMap = new Map(members.map((m) => [m.id, m]));
    const inDegree = new Map<string, number>();
    const dependents = new Map<string, string[]>();

    // Initialize
    for (const member of members) {
      inDegree.set(member.id, 0);
      dependents.set(member.id, []);
    }

    // Build adjacency
    for (const member of members) {
      if (member.dependsOn) {
        for (const depId of member.dependsOn) {
          if (memberMap.has(depId)) {
            inDegree.set(member.id, (inDegree.get(member.id) ?? 0) + 1);
            dependents.get(depId)!.push(member.id);
          }
        }
      }
    }

    const levels: string[][] = [];
    let currentLevel = members.filter((m) => (inDegree.get(m.id) ?? 0) === 0).map((m) => m.id);

    while (currentLevel.length > 0) {
      levels.push([...currentLevel]);

      const nextLevel: string[] = [];
      for (const id of currentLevel) {
        for (const depId of dependents.get(id) ?? []) {
          const newDegree = (inDegree.get(depId) ?? 1) - 1;
          inDegree.set(depId, newDegree);
          if (newDegree === 0) {
            nextLevel.push(depId);
          }
        }
      }

      currentLevel = nextLevel;
    }

    return levels;
  }

  /** Validate that the dependency graph has no cycles and all refs are valid */
  private validateDependencies(session: MutableTeamSession): void {
    const memberIds = new Set(session.members.map((m) => m.id));

    for (const member of session.members) {
      if (member.dependsOn) {
        for (const depId of member.dependsOn) {
          if (!memberIds.has(depId)) {
            throw new TeamManagerError("Member depends on non-existent member", {
              memberId: member.id,
              memberName: member.name,
              missingDependency: depId,
            });
          }
          if (depId === member.id) {
            throw new TeamManagerError("Member cannot depend on itself", {
              memberId: member.id,
              memberName: member.name,
            });
          }
        }
      }
    }

    // Detect cycles via topological sort
    const levels = this.buildExecutionOrder(session.members);
    const scheduled = new Set(levels.flat());
    if (scheduled.size !== session.members.length) {
      throw new TeamManagerError("Circular dependency detected in team members", {
        teamId: session.id,
        scheduledCount: scheduled.size,
        totalMembers: session.members.length,
      });
    }
  }

  /** Cancel all members that transitively depend on a failed member */
  private cancelDependents(session: MutableTeamSession, failedMemberId: string): void {
    const toCancel = new Set<string>();
    const queue = [failedMemberId];

    while (queue.length > 0) {
      const currentId = queue.shift()!;
      for (const member of session.members) {
        if (
          member.dependsOn?.includes(currentId) &&
          member.status === "pending" &&
          !toCancel.has(member.id)
        ) {
          toCancel.add(member.id);
          queue.push(member.id);
        }
      }
    }

    for (const memberId of toCancel) {
      this.updateMemberStatus(session, memberId, {
        status: "cancelled",
        completedAt: Date.now(),
      });
    }
  }

  /** Mark all pending members as cancelled */
  private cancelPendingMembers(session: MutableTeamSession): void {
    session.members = session.members.map((m) =>
      m.status === "pending"
        ? { ...m, status: "cancelled" as MemberStatus, completedAt: Date.now() }
        : m,
    );
  }

  /** Emit a team event to all listeners */
  private emit(event: TeamEvent): void {
    for (const listener of this.eventListeners) {
      listener(event);
    }
  }

  /** Update member status immutably */
  private updateMemberStatus(
    session: MutableTeamSession,
    memberId: string,
    updates: Partial<TeamMember>,
  ): void {
    session.members = session.members.map((m) => (m.id === memberId ? { ...m, ...updates } : m));
  }

  /** Convert mutable session to readonly TeamSession */
  private toReadonlySession(session: MutableTeamSession): TeamSession {
    return {
      id: session.id,
      definition: session.definition,
      status: session.status,
      members: [...session.members],
      createdAt: session.createdAt,
      completedAt: session.completedAt,
      results: new Map(session.results),
    };
  }
}
