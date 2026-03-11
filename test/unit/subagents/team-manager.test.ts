import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  AgentTeamManager,
  TeamManagerError,
  type AgentExecutor,
} from "../../../src/subagents/team-manager.js";
import type { CreateTeamConfig, TeamEvent, TeamMember } from "../../../src/subagents/team-types.js";

/** Helper to create a basic team config with no dependencies */
function makeConfig(overrides: Partial<CreateTeamConfig> = {}): CreateTeamConfig {
  return {
    name: "Test Team",
    description: "A test team",
    objective: "Complete the test task",
    members: [
      { name: "Alice", role: "researcher", type: "explore", prompt: "Research the topic" },
      { name: "Bob", role: "writer", type: "general", prompt: "Write the report" },
    ],
    ...overrides,
  };
}

/** Helper to create a successful executor mock */
function makeExecutor(): AgentExecutor {
  return vi.fn(async (member: TeamMember) => ({
    agentId: `agent-${member.id}`,
    response: `Result from ${member.name}`,
  }));
}

describe("AgentTeamManager", () => {
  let manager: AgentTeamManager;

  beforeEach(() => {
    manager = new AgentTeamManager();
  });

  // ---------------------------------------------------------------------------
  // createTeam
  // ---------------------------------------------------------------------------

  describe("createTeam", () => {
    it("should create a team with assigned member IDs", () => {
      const session = manager.createTeam(makeConfig());

      expect(session.id).toBeDefined();
      expect(session.status).toBe("creating");
      expect(session.members).toHaveLength(2);
      expect(session.members[0].id).toBeDefined();
      expect(session.members[1].id).toBeDefined();
      expect(session.members[0].id).not.toBe(session.members[1].id);
    });

    it("should set all members to pending status", () => {
      const session = manager.createTeam(makeConfig());

      for (const member of session.members) {
        expect(member.status).toBe("pending");
      }
    });

    it("should preserve member properties from config", () => {
      const session = manager.createTeam(makeConfig());

      expect(session.members[0].name).toBe("Alice");
      expect(session.members[0].role).toBe("researcher");
      expect(session.members[0].type).toBe("explore");
      expect(session.members[0].prompt).toBe("Research the topic");
    });

    it("should store the team definition", () => {
      const session = manager.createTeam(makeConfig());

      expect(session.definition.name).toBe("Test Team");
      expect(session.definition.description).toBe("A test team");
      expect(session.definition.objective).toBe("Complete the test task");
    });

    it("should throw when members array is empty", () => {
      expect(() => manager.createTeam(makeConfig({ members: [] }))).toThrow(TeamManagerError);
    });

    it("should set createdAt timestamp", () => {
      const before = Date.now();
      const session = manager.createTeam(makeConfig());
      const after = Date.now();

      expect(session.createdAt).toBeGreaterThanOrEqual(before);
      expect(session.createdAt).toBeLessThanOrEqual(after);
    });

    it("should start with empty results map", () => {
      const session = manager.createTeam(makeConfig());
      expect(session.results.size).toBe(0);
    });

    it("should store maxConcurrency from config", () => {
      const session = manager.createTeam(makeConfig({ maxConcurrency: 2 }));
      expect(session.definition.maxConcurrency).toBe(2);
    });

    it("should resolve name-based dependsOn to member IDs", () => {
      const session = manager.createTeam(
        makeConfig({
          members: [
            { name: "A", role: "first", type: "general", prompt: "Task A" },
            {
              name: "B",
              role: "second",
              type: "general",
              prompt: "Task B",
              dependsOn: ["A"],
            },
          ],
        }),
      );

      const memberA = session.members.find((m) => m.name === "A")!;
      const memberB = session.members.find((m) => m.name === "B")!;

      // B's dependsOn should now contain A's UUID, not the name "A"
      expect(memberB.dependsOn).toHaveLength(1);
      expect(memberB.dependsOn![0]).toBe(memberA.id);
    });
  });

  // ---------------------------------------------------------------------------
  // executeTeam — no dependencies (all parallel)
  // ---------------------------------------------------------------------------

  describe("executeTeam — no dependencies", () => {
    it("should execute all members and complete successfully", async () => {
      const session = manager.createTeam(makeConfig());
      const executor = makeExecutor();

      const result = await manager.executeTeam(session.id, executor);

      expect(result.status).toBe("completed");
      expect(result.completedAt).toBeDefined();
      expect(result.results.size).toBe(2);
      expect(executor).toHaveBeenCalledTimes(2);
    });

    it("should set member statuses to completed", async () => {
      const session = manager.createTeam(makeConfig());
      const executor = makeExecutor();

      const result = await manager.executeTeam(session.id, executor);

      for (const member of result.members) {
        expect(member.status).toBe("completed");
        expect(member.result).toBeDefined();
        expect(member.startedAt).toBeDefined();
        expect(member.completedAt).toBeDefined();
      }
    });

    it("should store results keyed by member ID", async () => {
      const session = manager.createTeam(makeConfig());
      const executor = makeExecutor();

      const result = await manager.executeTeam(session.id, executor);

      for (const member of result.members) {
        expect(result.results.get(member.id)).toBe(`Result from ${member.name}`);
      }
    });

    it("should throw for non-existent team ID", async () => {
      await expect(manager.executeTeam("nonexistent-id", makeExecutor())).rejects.toThrow(
        TeamManagerError,
      );
    });

    it("should throw when team is already executed", async () => {
      const session = manager.createTeam(makeConfig());
      const executor = makeExecutor();

      await manager.executeTeam(session.id, executor);

      await expect(manager.executeTeam(session.id, executor)).rejects.toThrow(TeamManagerError);
    });
  });

  // ---------------------------------------------------------------------------
  // executeTeam — linear dependencies (A → B → C)
  // ---------------------------------------------------------------------------

  describe("executeTeam — linear dependencies", () => {
    it("should execute members in dependency order A then B then C", async () => {
      const executionOrder: string[] = [];
      const executor: AgentExecutor = vi.fn(async (member: TeamMember) => {
        executionOrder.push(member.name);
        await new Promise((resolve) => setTimeout(resolve, 10));
        return { agentId: `agent-${member.id}`, response: `Done: ${member.name}` };
      });

      const session = manager.createTeam({
        name: "Linear Chain",
        description: "Linear dependency test",
        objective: "A then B then C",
        members: [
          { name: "A", role: "first", type: "general", prompt: "Task A" },
          {
            name: "B",
            role: "second",
            type: "general",
            prompt: "Task B",
            dependsOn: ["A"],
          },
          {
            name: "C",
            role: "third",
            type: "general",
            prompt: "Task C",
            dependsOn: ["B"],
          },
        ],
      });

      const result = await manager.executeTeam(session.id, executor);

      expect(result.status).toBe("completed");
      expect(executionOrder).toEqual(["A", "B", "C"]);
    });

    it("should ensure dependent member starts after dependency completes", async () => {
      const timestamps: Record<string, { start: number; end: number }> = {};
      const executor: AgentExecutor = vi.fn(async (member: TeamMember) => {
        timestamps[member.name] = { start: Date.now(), end: 0 };
        await new Promise((resolve) => setTimeout(resolve, 15));
        timestamps[member.name].end = Date.now();
        return { agentId: `agent-${member.id}`, response: `Done: ${member.name}` };
      });

      const session = manager.createTeam({
        name: "Sequential",
        description: "Sequential test",
        objective: "Verify ordering",
        members: [
          { name: "First", role: "worker", type: "general", prompt: "Do first" },
          {
            name: "Second",
            role: "worker",
            type: "general",
            prompt: "Do second",
            dependsOn: ["First"],
          },
        ],
      });

      await manager.executeTeam(session.id, executor);

      // Second should start after First ends
      expect(timestamps["Second"].start).toBeGreaterThanOrEqual(timestamps["First"].end);
    });
  });

  // ---------------------------------------------------------------------------
  // executeTeam — diamond dependency (A→B, A→C, B→D, C→D)
  // ---------------------------------------------------------------------------

  describe("executeTeam — diamond dependencies", () => {
    it("should execute diamond pattern correctly", async () => {
      const executionOrder: string[] = [];
      const executor: AgentExecutor = vi.fn(async (member: TeamMember) => {
        executionOrder.push(member.name);
        await new Promise((resolve) => setTimeout(resolve, 5));
        return { agentId: `agent-${member.id}`, response: `Done: ${member.name}` };
      });

      const session = manager.createTeam({
        name: "Diamond",
        description: "Diamond dependency test",
        objective: "Test diamond pattern",
        members: [
          { name: "A", role: "base", type: "general", prompt: "Base task" },
          {
            name: "B",
            role: "mid-1",
            type: "general",
            prompt: "Middle task 1",
            dependsOn: ["A"],
          },
          {
            name: "C",
            role: "mid-2",
            type: "general",
            prompt: "Middle task 2",
            dependsOn: ["A"],
          },
          {
            name: "D",
            role: "final",
            type: "general",
            prompt: "Final task",
            dependsOn: ["B", "C"],
          },
        ],
      });

      const result = await manager.executeTeam(session.id, executor);

      expect(result.status).toBe("completed");
      expect(result.members.filter((m) => m.status === "completed")).toHaveLength(4);

      // A must be first
      expect(executionOrder[0]).toBe("A");
      // D must be last
      expect(executionOrder[3]).toBe("D");
      // B and C must be in between (either order)
      expect(executionOrder.slice(1, 3).sort()).toEqual(["B", "C"]);
    });
  });

  // ---------------------------------------------------------------------------
  // executeTeam — failure propagation
  // ---------------------------------------------------------------------------

  describe("executeTeam — failure propagation", () => {
    it("should cancel dependents when a member fails", async () => {
      const executor: AgentExecutor = vi.fn(async (member: TeamMember) => {
        if (member.name === "B") {
          throw new Error("B failed");
        }
        await new Promise((resolve) => setTimeout(resolve, 5));
        return { agentId: `agent-${member.id}`, response: `Done: ${member.name}` };
      });

      const session = manager.createTeam({
        name: "Failure Test",
        description: "Test failure propagation",
        objective: "Verify failure handling",
        members: [
          { name: "A", role: "base", type: "general", prompt: "Task A" },
          {
            name: "B",
            role: "failing",
            type: "general",
            prompt: "Will fail",
            dependsOn: ["A"],
          },
          {
            name: "C",
            role: "dependent",
            type: "general",
            prompt: "Depends on B",
            dependsOn: ["B"],
          },
        ],
      });

      const result = await manager.executeTeam(session.id, executor);

      expect(result.status).toBe("failed");
      expect(result.members.find((m) => m.name === "A")?.status).toBe("completed");
      expect(result.members.find((m) => m.name === "B")?.status).toBe("failed");
      expect(result.members.find((m) => m.name === "C")?.status).toBe("cancelled");
    });

    it("should still complete independent members when one fails", async () => {
      const executor: AgentExecutor = vi.fn(async (member: TeamMember) => {
        if (member.name === "Failing") {
          throw new Error("Task failed");
        }
        return { agentId: `agent-${member.id}`, response: `Done: ${member.name}` };
      });

      const session = manager.createTeam({
        name: "Mixed Results",
        description: "Some pass some fail",
        objective: "Test mixed results",
        members: [
          { name: "Independent", role: "solo", type: "general", prompt: "Solo task" },
          { name: "Failing", role: "failing", type: "general", prompt: "Will fail" },
          { name: "Also Independent", role: "solo", type: "general", prompt: "Another solo" },
        ],
      });

      const result = await manager.executeTeam(session.id, executor);

      expect(result.status).toBe("failed");
      expect(result.members.find((m) => m.name === "Failing")?.status).toBe("failed");
      expect(result.members.find((m) => m.name === "Independent")?.status).toBe("completed");
      expect(result.members.find((m) => m.name === "Also Independent")?.status).toBe("completed");
    });

    it("should cancel transitive dependents (A→B→C, B fails)", async () => {
      const executor: AgentExecutor = vi.fn(async (member: TeamMember) => {
        if (member.name === "B") {
          throw new Error("B exploded");
        }
        await new Promise((resolve) => setTimeout(resolve, 5));
        return { agentId: `agent-${member.id}`, response: `Done: ${member.name}` };
      });

      const session = manager.createTeam({
        name: "Transitive Cancel",
        description: "Transitive cancellation test",
        objective: "Test transitive dep cancel",
        members: [
          { name: "A", role: "first", type: "general", prompt: "Task A" },
          {
            name: "B",
            role: "middle",
            type: "general",
            prompt: "Will fail",
            dependsOn: ["A"],
          },
          {
            name: "C",
            role: "last",
            type: "general",
            prompt: "Depends on B",
            dependsOn: ["B"],
          },
          {
            name: "D",
            role: "also-last",
            type: "general",
            prompt: "Also depends on B",
            dependsOn: ["B"],
          },
        ],
      });

      const result = await manager.executeTeam(session.id, executor);

      expect(result.members.find((m) => m.name === "A")?.status).toBe("completed");
      expect(result.members.find((m) => m.name === "B")?.status).toBe("failed");
      expect(result.members.find((m) => m.name === "C")?.status).toBe("cancelled");
      expect(result.members.find((m) => m.name === "D")?.status).toBe("cancelled");
    });
  });

  // ---------------------------------------------------------------------------
  // executeTeam — maxConcurrency
  // ---------------------------------------------------------------------------

  describe("executeTeam — maxConcurrency", () => {
    it("should limit concurrent executions to maxConcurrency", async () => {
      let peakConcurrency = 0;
      let currentConcurrency = 0;

      const executor: AgentExecutor = vi.fn(async (member: TeamMember) => {
        currentConcurrency++;
        peakConcurrency = Math.max(peakConcurrency, currentConcurrency);
        await new Promise((resolve) => setTimeout(resolve, 20));
        currentConcurrency--;
        return { agentId: `agent-${member.id}`, response: `Done: ${member.name}` };
      });

      const session = manager.createTeam({
        name: "Concurrency Test",
        description: "Test concurrency limit",
        objective: "Verify maxConcurrency",
        maxConcurrency: 2,
        members: [
          { name: "W1", role: "worker", type: "general", prompt: "Work 1" },
          { name: "W2", role: "worker", type: "general", prompt: "Work 2" },
          { name: "W3", role: "worker", type: "general", prompt: "Work 3" },
          { name: "W4", role: "worker", type: "general", prompt: "Work 4" },
        ],
      });

      const result = await manager.executeTeam(session.id, executor);

      expect(result.status).toBe("completed");
      expect(peakConcurrency).toBeLessThanOrEqual(2);
      expect(executor).toHaveBeenCalledTimes(4);
    });

    it("should run all in parallel when maxConcurrency is not set", async () => {
      let peakConcurrency = 0;
      let currentConcurrency = 0;

      const executor: AgentExecutor = vi.fn(async (member: TeamMember) => {
        currentConcurrency++;
        peakConcurrency = Math.max(peakConcurrency, currentConcurrency);
        await new Promise((resolve) => setTimeout(resolve, 20));
        currentConcurrency--;
        return { agentId: `agent-${member.id}`, response: `Done: ${member.name}` };
      });

      const session = manager.createTeam({
        name: "No Limit",
        description: "Test no concurrency limit",
        objective: "Verify all parallel",
        members: [
          { name: "W1", role: "worker", type: "general", prompt: "Work 1" },
          { name: "W2", role: "worker", type: "general", prompt: "Work 2" },
          { name: "W3", role: "worker", type: "general", prompt: "Work 3" },
        ],
      });

      const result = await manager.executeTeam(session.id, executor);

      expect(result.status).toBe("completed");
      expect(peakConcurrency).toBe(3);
    });
  });

  // ---------------------------------------------------------------------------
  // executeTeam — abort signal
  // ---------------------------------------------------------------------------

  describe("executeTeam — abort signal", () => {
    it("should cancel remaining members when signal is aborted", async () => {
      const controller = new AbortController();

      const executor: AgentExecutor = vi.fn(async (member: TeamMember) => {
        if (member.name === "W1") {
          controller.abort();
        }
        await new Promise((resolve) => setTimeout(resolve, 50));
        return { agentId: `agent-${member.id}`, response: `Done: ${member.name}` };
      });

      const session = manager.createTeam({
        name: "Abort Test",
        description: "Test abort signal",
        objective: "Verify abort handling",
        maxConcurrency: 1,
        members: [
          { name: "W1", role: "worker", type: "general", prompt: "Work 1" },
          { name: "W2", role: "worker", type: "general", prompt: "Work 2" },
          { name: "W3", role: "worker", type: "general", prompt: "Work 3" },
        ],
      });

      const result = await manager.executeTeam(session.id, executor, {
        signal: controller.signal,
      });

      const cancelled = result.members.filter((m) => m.status === "cancelled");
      expect(cancelled.length).toBeGreaterThan(0);
    });

    it("should handle pre-aborted signal", async () => {
      const controller = new AbortController();
      controller.abort();

      const executor = makeExecutor();
      const session = manager.createTeam(makeConfig());

      const result = await manager.executeTeam(session.id, executor, {
        signal: controller.signal,
      });

      const cancelled = result.members.filter((m) => m.status === "cancelled");
      expect(cancelled.length).toBeGreaterThan(0);
    });
  });

  // ---------------------------------------------------------------------------
  // getSession
  // ---------------------------------------------------------------------------

  describe("getSession", () => {
    it("should return existing session", () => {
      const created = manager.createTeam(makeConfig());
      const retrieved = manager.getSession(created.id);

      expect(retrieved).toBeDefined();
      expect(retrieved!.id).toBe(created.id);
      expect(retrieved!.definition.name).toBe("Test Team");
    });

    it("should return undefined for non-existent session", () => {
      expect(manager.getSession("nonexistent")).toBeUndefined();
    });

    it("should reflect updated status after execution", async () => {
      const session = manager.createTeam(makeConfig());
      expect(manager.getSession(session.id)!.status).toBe("creating");

      await manager.executeTeam(session.id, makeExecutor());
      expect(manager.getSession(session.id)!.status).toBe("completed");
    });
  });

  // ---------------------------------------------------------------------------
  // getActiveSessions
  // ---------------------------------------------------------------------------

  describe("getActiveSessions", () => {
    it("should return creating sessions", () => {
      manager.createTeam(makeConfig());
      manager.createTeam(makeConfig({ name: "Team 2" }));

      const active = manager.getActiveSessions();
      expect(active).toHaveLength(2);
    });

    it("should not include completed sessions", async () => {
      const session = manager.createTeam(makeConfig());
      manager.createTeam(makeConfig({ name: "Team 2" }));

      await manager.executeTeam(session.id, makeExecutor());

      const active = manager.getActiveSessions();
      expect(active).toHaveLength(1);
    });

    it("should return empty array when no active sessions", async () => {
      const session = manager.createTeam(makeConfig());
      await manager.executeTeam(session.id, makeExecutor());

      expect(manager.getActiveSessions()).toHaveLength(0);
    });
  });

  // ---------------------------------------------------------------------------
  // cancelTeam
  // ---------------------------------------------------------------------------

  describe("cancelTeam", () => {
    it("should cancel a creating team", async () => {
      const session = manager.createTeam(makeConfig());
      await manager.cancelTeam(session.id);

      const updated = manager.getSession(session.id);
      expect(updated!.status).toBe("failed");
      expect(updated!.completedAt).toBeDefined();
    });

    it("should mark pending members as cancelled", async () => {
      const session = manager.createTeam(makeConfig());
      await manager.cancelTeam(session.id);

      const updated = manager.getSession(session.id)!;
      for (const member of updated.members) {
        expect(member.status).toBe("cancelled");
      }
    });

    it("should be a noop for completed teams", async () => {
      const session = manager.createTeam(makeConfig());
      await manager.executeTeam(session.id, makeExecutor());

      await manager.cancelTeam(session.id);

      const updated = manager.getSession(session.id)!;
      expect(updated.status).toBe("completed");
    });

    it("should throw for non-existent team", async () => {
      await expect(manager.cancelTeam("nonexistent")).rejects.toThrow(TeamManagerError);
    });
  });

  // ---------------------------------------------------------------------------
  // getTeamSummary
  // ---------------------------------------------------------------------------

  describe("getTeamSummary", () => {
    it("should return formatted summary for creating team", () => {
      const session = manager.createTeam(makeConfig());
      const summary = manager.getTeamSummary(session.id);

      expect(summary).toContain("Test Team");
      expect(summary).toContain("creating");
      expect(summary).toContain("2 pending");
    });

    it("should return formatted summary for completed team", async () => {
      const session = manager.createTeam(makeConfig());
      await manager.executeTeam(session.id, makeExecutor());

      const summary = manager.getTeamSummary(session.id);
      expect(summary).toContain("completed");
      expect(summary).toContain("2 completed");
    });

    it("should return 'Team not found' for non-existent team", () => {
      expect(manager.getTeamSummary("nonexistent")).toBe("Team not found");
    });

    it("should show failed count when members fail", async () => {
      const executor: AgentExecutor = vi.fn(async (member: TeamMember) => {
        if (member.name === "Alice") {
          throw new Error("Failed");
        }
        return { agentId: `agent-${member.id}`, response: "Done" };
      });

      const session = manager.createTeam(makeConfig());
      await manager.executeTeam(session.id, executor);

      const summary = manager.getTeamSummary(session.id);
      expect(summary).toContain("1 failed");
      expect(summary).toContain("1 completed");
    });
  });

  // ---------------------------------------------------------------------------
  // onEvent
  // ---------------------------------------------------------------------------

  describe("onEvent", () => {
    it("should notify listener on team creation", () => {
      const events: TeamEvent[] = [];
      manager.onEvent((event) => events.push(event));

      manager.createTeam(makeConfig());

      expect(events).toHaveLength(1);
      expect(events[0].type).toBe("team:created");
    });

    it("should notify listener on member start, completion, and team completion", async () => {
      const events: TeamEvent[] = [];
      manager.onEvent((event) => events.push(event));

      const session = manager.createTeam(makeConfig());
      await manager.executeTeam(session.id, makeExecutor());

      const memberStarted = events.filter((e) => e.type === "team:member-started");
      const memberCompleted = events.filter((e) => e.type === "team:member-completed");
      const teamCompleted = events.filter((e) => e.type === "team:completed");

      expect(memberStarted).toHaveLength(2);
      expect(memberCompleted).toHaveLength(2);
      expect(teamCompleted).toHaveLength(1);
    });

    it("should notify listener on member failure", async () => {
      const events: TeamEvent[] = [];
      manager.onEvent((event) => events.push(event));

      const executor: AgentExecutor = vi.fn(async () => {
        throw new Error("Boom");
      });

      const session = manager.createTeam(
        makeConfig({
          members: [{ name: "Failing", role: "worker", type: "general", prompt: "Fail" }],
        }),
      );
      await manager.executeTeam(session.id, executor);

      const failed = events.filter((e) => e.type === "team:member-failed");
      expect(failed).toHaveLength(1);
      expect((failed[0] as { type: "team:member-failed"; error: string }).error).toBe("Boom");
    });

    it("should support multiple listeners", () => {
      const events1: TeamEvent[] = [];
      const events2: TeamEvent[] = [];

      manager.onEvent((event) => events1.push(event));
      manager.onEvent((event) => events2.push(event));

      manager.createTeam(makeConfig());

      expect(events1).toHaveLength(1);
      expect(events2).toHaveLength(1);
    });

    it("should return an unsubscribe function", () => {
      const events: TeamEvent[] = [];
      const unsubscribe = manager.onEvent((event) => events.push(event));

      manager.createTeam(makeConfig({ name: "Team 1" }));
      expect(events).toHaveLength(1);

      unsubscribe();

      manager.createTeam(makeConfig({ name: "Team 2" }));
      // Should not receive the second event
      expect(events).toHaveLength(1);
    });
  });

  // ---------------------------------------------------------------------------
  // cleanup
  // ---------------------------------------------------------------------------

  describe("cleanup", () => {
    it("should remove completed sessions", async () => {
      const session = manager.createTeam(makeConfig());
      await manager.executeTeam(session.id, makeExecutor());

      expect(manager.getSession(session.id)).toBeDefined();

      manager.cleanup();

      expect(manager.getSession(session.id)).toBeUndefined();
    });

    it("should remove failed sessions", async () => {
      const executor: AgentExecutor = vi.fn(async () => {
        throw new Error("Fail");
      });

      const session = manager.createTeam(
        makeConfig({
          members: [{ name: "Failing", role: "worker", type: "general", prompt: "Fail" }],
        }),
      );
      await manager.executeTeam(session.id, executor);

      manager.cleanup();
      expect(manager.getSession(session.id)).toBeUndefined();
    });

    it("should not remove active/creating sessions", () => {
      const session = manager.createTeam(makeConfig());

      manager.cleanup();

      expect(manager.getSession(session.id)).toBeDefined();
    });

    it("should handle cleanup when no sessions exist", () => {
      expect(() => manager.cleanup()).not.toThrow();
    });
  });

  // ---------------------------------------------------------------------------
  // TeamManagerError
  // ---------------------------------------------------------------------------

  describe("TeamManagerError", () => {
    it("should extend BaseError with correct code", () => {
      const error = new TeamManagerError("test error");

      expect(error.message).toBe("test error");
      expect(error.code).toBe("TEAM_MANAGER_ERROR");
      expect(error.name).toBe("TeamManagerError");
    });

    it("should include context", () => {
      const error = new TeamManagerError("test", { teamId: "abc" });

      expect(error.context.teamId).toBe("abc");
    });
  });
});
