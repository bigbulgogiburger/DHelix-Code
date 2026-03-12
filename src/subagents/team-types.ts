/**
 * Type definitions for the Agent Teams system.
 *
 * A "Team Lead" agent can create and manage a team of worker agents
 * that collaborate on complex tasks with dependency-aware scheduling.
 */

/** Team status lifecycle */
export type TeamStatus = "creating" | "active" | "completing" | "completed" | "failed";

/** Team member status */
export type MemberStatus = "pending" | "running" | "completed" | "failed" | "cancelled";

/** Team member definition */
export interface TeamMember {
  readonly id: string;
  readonly name: string;
  readonly role: string;
  readonly type: string; // SubagentType
  readonly prompt: string;
  readonly status: MemberStatus;
  readonly agentId?: string; // Assigned when spawned
  readonly result?: string;
  readonly startedAt?: number;
  readonly completedAt?: number;
  readonly dependsOn?: readonly string[]; // IDs of members this depends on
}

/** Team definition */
export interface TeamDefinition {
  readonly name: string;
  readonly description: string;
  readonly objective: string;
  readonly members: readonly TeamMember[];
  readonly maxConcurrency?: number; // Max parallel members (default: all)
}

/** Team session — live team execution state */
export interface TeamSession {
  readonly id: string;
  readonly definition: TeamDefinition;
  readonly status: TeamStatus;
  readonly members: readonly TeamMember[];
  readonly createdAt: number;
  readonly completedAt?: number;
  readonly results: ReadonlyMap<string, string>;
}

/** Team creation config */
export interface CreateTeamConfig {
  readonly name: string;
  readonly description: string;
  readonly objective: string;
  readonly members: readonly Omit<TeamMember, "id" | "status">[];
  readonly maxConcurrency?: number;
}

/** Team event types */
export type TeamEvent =
  | { readonly type: "team:created"; readonly teamId: string }
  | { readonly type: "team:member-started"; readonly teamId: string; readonly memberId: string }
  | {
      readonly type: "team:member-completed";
      readonly teamId: string;
      readonly memberId: string;
      readonly result: string;
    }
  | {
      readonly type: "team:member-failed";
      readonly teamId: string;
      readonly memberId: string;
      readonly error: string;
    }
  | { readonly type: "team:completed"; readonly teamId: string }
  | { readonly type: "team:failed"; readonly teamId: string; readonly error: string };
