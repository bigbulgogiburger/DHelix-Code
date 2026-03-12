import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  TeamHookEmitter,
  TeamHookError,
  createTeamHookEmitter,
  createTeamEventHandler,
  type TeamEvent,
  type TeammateIdleData,
  type TaskCompletedData,
} from "../../../src/hooks/team-events.js";
import { type HookRunResult } from "../../../src/hooks/types.js";

/** Create a non-blocked HookRunResult */
function makePassResult(contextOutput = ""): HookRunResult {
  return {
    blocked: false,
    results: [],
    contextOutput,
  };
}

/** Create a blocked HookRunResult */
function makeBlockedResult(reason = "blocked by hook"): HookRunResult {
  return {
    blocked: true,
    blockReason: reason,
    results: [
      {
        exitCode: 2,
        stdout: reason,
        stderr: "",
        blocked: true,
        handlerType: "command",
      },
    ],
    contextOutput: reason,
  };
}

/** Create a mock HookRunner */
function createMockHookRunner() {
  return {
    run: vi.fn<[], Promise<HookRunResult>>().mockResolvedValue(makePassResult()),
    hasHooks: vi.fn<[string], boolean>().mockReturnValue(false),
    getConfiguredEvents: vi.fn().mockReturnValue([]),
  };
}

/** Default TeammateIdleData for tests */
function makeTeammateIdleData(overrides: Partial<TeammateIdleData> = {}): TeammateIdleData {
  return {
    teamId: "team-1",
    teamName: "test-team",
    memberId: "member-1",
    memberName: "worker-1",
    memberRole: "general",
    status: "completed",
    remainingMembers: 2,
    totalMembers: 3,
    ...overrides,
  };
}

/** Default TaskCompletedData for tests */
function makeTaskCompletedData(overrides: Partial<TaskCompletedData> = {}): TaskCompletedData {
  return {
    taskId: "task-1",
    taskTitle: "Implement feature X",
    taskPriority: "high",
    dependentTasks: [],
    ...overrides,
  };
}

describe("TeamHookEmitter", () => {
  let mockRunner: ReturnType<typeof createMockHookRunner>;
  let emitter: TeamHookEmitter;
  const sessionId = "sess-abc-123";
  const workingDirectory = "/project";

  beforeEach(() => {
    mockRunner = createMockHookRunner();
    emitter = new TeamHookEmitter({
      hookRunner: mockRunner as never,
      sessionId,
      workingDirectory,
    });
  });

  // ---------- Constructor ----------

  describe("constructor", () => {
    it("should create an instance with provided config", () => {
      expect(emitter).toBeInstanceOf(TeamHookEmitter);
    });

    it("should store session ID and working directory", async () => {
      await emitter.emitTeammateIdle(makeTeammateIdleData());
      const payload = mockRunner.run.mock.calls[0][1];
      expect(payload.sessionId).toBe(sessionId);
      expect(payload.workingDirectory).toBe(workingDirectory);
    });
  });

  // ---------- emitTeammateIdle ----------

  describe("emitTeammateIdle", () => {
    it("should call hookRunner.run with TeammateIdle event", async () => {
      await emitter.emitTeammateIdle(makeTeammateIdleData());
      expect(mockRunner.run).toHaveBeenCalledTimes(1);
      expect(mockRunner.run.mock.calls[0][0]).toBe("TeammateIdle");
    });

    it("should build correct payload for completed member", async () => {
      const data = makeTeammateIdleData({
        status: "completed",
        result: "All tests pass",
      });
      await emitter.emitTeammateIdle(data);
      const payload = mockRunner.run.mock.calls[0][1];
      expect(payload.event).toBe("TeammateIdle");
      expect(payload.data).toEqual(
        expect.objectContaining({
          teamId: "team-1",
          teamName: "test-team",
          memberId: "member-1",
          memberName: "worker-1",
          memberRole: "general",
          status: "completed",
          result: "All tests pass",
          remainingMembers: 2,
          totalMembers: 3,
        }),
      );
    });

    it("should build correct payload for failed member", async () => {
      const data = makeTeammateIdleData({
        status: "failed",
        error: "Timeout exceeded",
      });
      await emitter.emitTeammateIdle(data);
      const payload = mockRunner.run.mock.calls[0][1];
      expect(payload.data).toEqual(
        expect.objectContaining({
          status: "failed",
          error: "Timeout exceeded",
        }),
      );
    });

    it("should build correct payload for cancelled member", async () => {
      const data = makeTeammateIdleData({ status: "cancelled" });
      await emitter.emitTeammateIdle(data);
      const payload = mockRunner.run.mock.calls[0][1];
      expect(payload.data).toEqual(expect.objectContaining({ status: "cancelled" }));
    });

    it("should include result data when provided", async () => {
      const data = makeTeammateIdleData({
        result: "Generated 5 files",
      });
      await emitter.emitTeammateIdle(data);
      const payload = mockRunner.run.mock.calls[0][1];
      expect(payload.data).toEqual(expect.objectContaining({ result: "Generated 5 files" }));
    });

    it("should include error data when provided", async () => {
      const data = makeTeammateIdleData({
        status: "failed",
        error: "Permission denied",
      });
      await emitter.emitTeammateIdle(data);
      const payload = mockRunner.run.mock.calls[0][1];
      expect(payload.data).toEqual(expect.objectContaining({ error: "Permission denied" }));
    });

    it("should include elapsedMs when provided", async () => {
      const data = makeTeammateIdleData({ elapsedMs: 5000 });
      await emitter.emitTeammateIdle(data);
      const payload = mockRunner.run.mock.calls[0][1];
      expect(payload.data).toEqual(expect.objectContaining({ elapsedMs: 5000 }));
    });

    it("should include sessionId in payload", async () => {
      await emitter.emitTeammateIdle(makeTeammateIdleData());
      const payload = mockRunner.run.mock.calls[0][1];
      expect(payload.sessionId).toBe(sessionId);
    });

    it("should include workingDirectory in payload", async () => {
      await emitter.emitTeammateIdle(makeTeammateIdleData());
      const payload = mockRunner.run.mock.calls[0][1];
      expect(payload.workingDirectory).toBe(workingDirectory);
    });

    it("should return the HookRunResult from the runner", async () => {
      const expected = makePassResult("hook output");
      mockRunner.run.mockResolvedValueOnce(expected);
      const result = await emitter.emitTeammateIdle(makeTeammateIdleData());
      expect(result).toBe(expected);
    });

    it("should propagate blocked result from hook runner", async () => {
      const blocked = makeBlockedResult("Member blocked");
      mockRunner.run.mockResolvedValueOnce(blocked);
      const result = await emitter.emitTeammateIdle(makeTeammateIdleData());
      expect(result.blocked).toBe(true);
      expect(result.blockReason).toBe("Member blocked");
    });

    it("should include remaining and total member counts", async () => {
      const data = makeTeammateIdleData({
        remainingMembers: 1,
        totalMembers: 5,
      });
      await emitter.emitTeammateIdle(data);
      const payload = mockRunner.run.mock.calls[0][1];
      expect(payload.data).toEqual(
        expect.objectContaining({
          remainingMembers: 1,
          totalMembers: 5,
        }),
      );
    });
  });

  // ---------- emitTaskCompleted ----------

  describe("emitTaskCompleted", () => {
    it("should call hookRunner.run with TaskCompleted event", async () => {
      await emitter.emitTaskCompleted(makeTaskCompletedData());
      expect(mockRunner.run).toHaveBeenCalledTimes(1);
      expect(mockRunner.run.mock.calls[0][0]).toBe("TaskCompleted");
    });

    it("should build correct payload for task with result", async () => {
      const data = makeTaskCompletedData({
        result: "Feature implemented successfully",
      });
      await emitter.emitTaskCompleted(data);
      const payload = mockRunner.run.mock.calls[0][1];
      expect(payload.event).toBe("TaskCompleted");
      expect(payload.data).toEqual(
        expect.objectContaining({
          taskId: "task-1",
          taskTitle: "Implement feature X",
          taskPriority: "high",
          result: "Feature implemented successfully",
        }),
      );
    });

    it("should build correct payload for task with dependencies", async () => {
      const data = makeTaskCompletedData({
        dependentTasks: ["task-2", "task-3"],
      });
      await emitter.emitTaskCompleted(data);
      const payload = mockRunner.run.mock.calls[0][1];
      expect(payload.data).toEqual(
        expect.objectContaining({
          dependentTasks: ["task-2", "task-3"],
        }),
      );
    });

    it("should build correct payload for task with team association", async () => {
      const data = makeTaskCompletedData({
        teamId: "team-alpha",
      });
      await emitter.emitTaskCompleted(data);
      const payload = mockRunner.run.mock.calls[0][1];
      expect(payload.data).toEqual(
        expect.objectContaining({
          teamId: "team-alpha",
        }),
      );
    });

    it("should include assignedTo when provided", async () => {
      const data = makeTaskCompletedData({
        assignedTo: "agent-42",
      });
      await emitter.emitTaskCompleted(data);
      const payload = mockRunner.run.mock.calls[0][1];
      expect(payload.data).toEqual(
        expect.objectContaining({
          assignedTo: "agent-42",
        }),
      );
    });

    it("should include elapsedMs when provided", async () => {
      const data = makeTaskCompletedData({ elapsedMs: 12000 });
      await emitter.emitTaskCompleted(data);
      const payload = mockRunner.run.mock.calls[0][1];
      expect(payload.data).toEqual(
        expect.objectContaining({
          elapsedMs: 12000,
        }),
      );
    });

    it("should include sessionId and workingDirectory in payload", async () => {
      await emitter.emitTaskCompleted(makeTaskCompletedData());
      const payload = mockRunner.run.mock.calls[0][1];
      expect(payload.sessionId).toBe(sessionId);
      expect(payload.workingDirectory).toBe(workingDirectory);
    });

    it("should return the HookRunResult from the runner", async () => {
      const expected = makePassResult("task hook done");
      mockRunner.run.mockResolvedValueOnce(expected);
      const result = await emitter.emitTaskCompleted(makeTaskCompletedData());
      expect(result).toBe(expected);
    });

    it("should propagate blocked result from hook runner", async () => {
      const blocked = makeBlockedResult("Task blocked");
      mockRunner.run.mockResolvedValueOnce(blocked);
      const result = await emitter.emitTaskCompleted(makeTaskCompletedData());
      expect(result.blocked).toBe(true);
      expect(result.blockReason).toBe("Task blocked");
    });

    it("should copy dependentTasks array to prevent mutation", async () => {
      const deps = ["task-a", "task-b"];
      const data = makeTaskCompletedData({ dependentTasks: deps });
      await emitter.emitTaskCompleted(data);
      const payload = mockRunner.run.mock.calls[0][1];
      const payloadDeps = (payload.data as Record<string, unknown>).dependentTasks as string[];
      expect(payloadDeps).toEqual(deps);
      expect(payloadDeps).not.toBe(deps);
    });
  });

  // ---------- handleTeamEvent ----------

  describe("handleTeamEvent", () => {
    it("should emit TeammateIdle for team:member-completed", async () => {
      const event: TeamEvent = {
        type: "team:member-completed",
        teamId: "t1",
        memberId: "m1",
        memberName: "worker",
        result: "done",
      };
      await emitter.handleTeamEvent(event);
      expect(mockRunner.run).toHaveBeenCalledTimes(1);
      expect(mockRunner.run.mock.calls[0][0]).toBe("TeammateIdle");
      const payload = mockRunner.run.mock.calls[0][1];
      expect(payload.data).toEqual(
        expect.objectContaining({
          status: "completed",
          result: "done",
          memberId: "m1",
          memberName: "worker",
        }),
      );
    });

    it("should emit TeammateIdle for team:member-failed", async () => {
      const event: TeamEvent = {
        type: "team:member-failed",
        teamId: "t1",
        memberId: "m2",
        memberName: "broken-worker",
        error: "Out of memory",
      };
      await emitter.handleTeamEvent(event);
      expect(mockRunner.run).toHaveBeenCalledTimes(1);
      expect(mockRunner.run.mock.calls[0][0]).toBe("TeammateIdle");
      const payload = mockRunner.run.mock.calls[0][1];
      expect(payload.data).toEqual(
        expect.objectContaining({
          status: "failed",
          error: "Out of memory",
        }),
      );
    });

    it("should not emit hooks for team:completed", async () => {
      const event: TeamEvent = {
        type: "team:completed",
        teamId: "t1",
        results: { m1: "ok" },
      };
      await emitter.handleTeamEvent(event);
      expect(mockRunner.run).not.toHaveBeenCalled();
    });

    it("should not emit hooks for team:created", async () => {
      const event: TeamEvent = {
        type: "team:created",
        teamId: "t1",
        teamName: "new-team",
      };
      await emitter.handleTeamEvent(event);
      expect(mockRunner.run).not.toHaveBeenCalled();
    });

    it("should not emit hooks for team:member-started", async () => {
      const event: TeamEvent = {
        type: "team:member-started",
        teamId: "t1",
        memberId: "m1",
        memberName: "w1",
      };
      await emitter.handleTeamEvent(event);
      expect(mockRunner.run).not.toHaveBeenCalled();
    });

    it("should not emit hooks for team:failed", async () => {
      const event: TeamEvent = {
        type: "team:failed",
        teamId: "t1",
        error: "catastrophic",
      };
      await emitter.handleTeamEvent(event);
      expect(mockRunner.run).not.toHaveBeenCalled();
    });

    it("should silently swallow errors from hook runner", async () => {
      mockRunner.run.mockRejectedValueOnce(new Error("Hook crash"));
      const event: TeamEvent = {
        type: "team:member-completed",
        teamId: "t1",
        memberId: "m1",
        memberName: "w1",
      };
      // Should not throw
      await expect(emitter.handleTeamEvent(event)).resolves.toBeUndefined();
    });

    it("should silently swallow non-Error throws from hook runner", async () => {
      mockRunner.run.mockRejectedValueOnce("string error");
      const event: TeamEvent = {
        type: "team:member-failed",
        teamId: "t1",
        memberId: "m1",
        memberName: "w1",
        error: "fail",
      };
      await expect(emitter.handleTeamEvent(event)).resolves.toBeUndefined();
    });
  });

  // ---------- hasTeamHooks / hasTeammateIdleHooks / hasTaskCompletedHooks ----------

  describe("hasTeamHooks", () => {
    it("should return false when no hooks configured", () => {
      mockRunner.hasHooks.mockReturnValue(false);
      expect(emitter.hasTeamHooks()).toBe(false);
    });

    it("should return true when TeammateIdle hooks configured", () => {
      mockRunner.hasHooks.mockImplementation((event: string) => event === "TeammateIdle");
      expect(emitter.hasTeamHooks()).toBe(true);
    });

    it("should return true when TaskCompleted hooks configured", () => {
      mockRunner.hasHooks.mockImplementation((event: string) => event === "TaskCompleted");
      expect(emitter.hasTeamHooks()).toBe(true);
    });

    it("should return true when both hooks configured", () => {
      mockRunner.hasHooks.mockReturnValue(true);
      expect(emitter.hasTeamHooks()).toBe(true);
    });
  });

  describe("hasTeammateIdleHooks", () => {
    it("should return true when TeammateIdle hooks configured", () => {
      mockRunner.hasHooks.mockImplementation((event: string) => event === "TeammateIdle");
      expect(emitter.hasTeammateIdleHooks()).toBe(true);
    });

    it("should return false when no TeammateIdle hooks configured", () => {
      mockRunner.hasHooks.mockReturnValue(false);
      expect(emitter.hasTeammateIdleHooks()).toBe(false);
    });

    it("should call hookRunner.hasHooks with correct event name", () => {
      emitter.hasTeammateIdleHooks();
      expect(mockRunner.hasHooks).toHaveBeenCalledWith("TeammateIdle");
    });
  });

  describe("hasTaskCompletedHooks", () => {
    it("should return true when TaskCompleted hooks configured", () => {
      mockRunner.hasHooks.mockImplementation((event: string) => event === "TaskCompleted");
      expect(emitter.hasTaskCompletedHooks()).toBe(true);
    });

    it("should return false when no TaskCompleted hooks configured", () => {
      mockRunner.hasHooks.mockReturnValue(false);
      expect(emitter.hasTaskCompletedHooks()).toBe(false);
    });

    it("should call hookRunner.hasHooks with correct event name", () => {
      emitter.hasTaskCompletedHooks();
      expect(mockRunner.hasHooks).toHaveBeenCalledWith("TaskCompleted");
    });
  });
});

// ---------- TeamHookError ----------

describe("TeamHookError", () => {
  it("should extend Error", () => {
    const err = new TeamHookError("test");
    expect(err).toBeInstanceOf(Error);
  });

  it("should have TEAM_HOOK_ERROR code", () => {
    const err = new TeamHookError("test");
    expect(err.code).toBe("TEAM_HOOK_ERROR");
  });

  it("should store message", () => {
    const err = new TeamHookError("something went wrong");
    expect(err.message).toBe("something went wrong");
  });

  it("should store context", () => {
    const err = new TeamHookError("fail", { teamId: "t1", memberId: "m1" });
    expect(err.context).toEqual({ teamId: "t1", memberId: "m1" });
  });

  it("should freeze context", () => {
    const err = new TeamHookError("fail", { key: "value" });
    expect(Object.isFrozen(err.context)).toBe(true);
  });

  it("should default context to empty object", () => {
    const err = new TeamHookError("fail");
    expect(err.context).toEqual({});
  });
});

// ---------- createTeamHookEmitter ----------

describe("createTeamHookEmitter", () => {
  it("should return a TeamHookEmitter instance", () => {
    const mockRunner = createMockHookRunner();
    const emitter = createTeamHookEmitter({
      hookRunner: mockRunner as never,
      sessionId: "s1",
      workingDirectory: "/tmp",
    });
    expect(emitter).toBeInstanceOf(TeamHookEmitter);
  });

  it("should create a functional emitter", async () => {
    const mockRunner = createMockHookRunner();
    const emitter = createTeamHookEmitter({
      hookRunner: mockRunner as never,
      sessionId: "s1",
      workingDirectory: "/tmp",
    });
    await emitter.emitTeammateIdle(makeTeammateIdleData());
    expect(mockRunner.run).toHaveBeenCalledTimes(1);
  });
});

// ---------- createTeamEventHandler ----------

describe("createTeamEventHandler", () => {
  let mockRunner: ReturnType<typeof createMockHookRunner>;
  let emitter: TeamHookEmitter;

  beforeEach(() => {
    mockRunner = createMockHookRunner();
    emitter = new TeamHookEmitter({
      hookRunner: mockRunner as never,
      sessionId: "sess-1",
      workingDirectory: "/project",
    });
  });

  it("should return a function", () => {
    const handler = createTeamEventHandler(emitter, "my-team", 3);
    expect(typeof handler).toBe("function");
  });

  it("should emit TeammateIdle on member-completed with correct remaining count", async () => {
    const handler = createTeamEventHandler(emitter, "my-team", 3);
    await handler({
      type: "team:member-completed",
      teamId: "t1",
      memberId: "m1",
      memberName: "w1",
      result: "done",
    });
    expect(mockRunner.run).toHaveBeenCalledTimes(1);
    const payload = mockRunner.run.mock.calls[0][1];
    expect(payload.data).toEqual(
      expect.objectContaining({
        teamName: "my-team",
        remainingMembers: 2,
        totalMembers: 3,
        status: "completed",
        result: "done",
      }),
    );
  });

  it("should decrement remaining members across calls", async () => {
    const handler = createTeamEventHandler(emitter, "my-team", 3);

    await handler({
      type: "team:member-completed",
      teamId: "t1",
      memberId: "m1",
      memberName: "w1",
    });
    expect((mockRunner.run.mock.calls[0][1].data as Record<string, unknown>).remainingMembers).toBe(
      2,
    );

    await handler({
      type: "team:member-completed",
      teamId: "t1",
      memberId: "m2",
      memberName: "w2",
    });
    expect((mockRunner.run.mock.calls[1][1].data as Record<string, unknown>).remainingMembers).toBe(
      1,
    );

    await handler({
      type: "team:member-completed",
      teamId: "t1",
      memberId: "m3",
      memberName: "w3",
    });
    expect((mockRunner.run.mock.calls[2][1].data as Record<string, unknown>).remainingMembers).toBe(
      0,
    );
  });

  it("should decrement remaining on member-failed", async () => {
    const handler = createTeamEventHandler(emitter, "team-x", 2);
    await handler({
      type: "team:member-failed",
      teamId: "t1",
      memberId: "m1",
      memberName: "w1",
      error: "crash",
    });
    const payload = mockRunner.run.mock.calls[0][1];
    expect(payload.data).toEqual(
      expect.objectContaining({
        remainingMembers: 1,
        totalMembers: 2,
        status: "failed",
        error: "crash",
      }),
    );
  });

  it("should not go below zero remaining members", async () => {
    const handler = createTeamEventHandler(emitter, "team-y", 1);
    await handler({
      type: "team:member-completed",
      teamId: "t1",
      memberId: "m1",
      memberName: "w1",
    });
    await handler({
      type: "team:member-completed",
      teamId: "t1",
      memberId: "m2",
      memberName: "w2",
    });
    expect((mockRunner.run.mock.calls[1][1].data as Record<string, unknown>).remainingMembers).toBe(
      0,
    );
  });

  it("should emit TaskCompleted on team:completed", async () => {
    const handler = createTeamEventHandler(emitter, "final-team", 2);
    await handler({
      type: "team:completed",
      teamId: "t1",
      results: { m1: "ok", m2: "ok" },
    });
    expect(mockRunner.run).toHaveBeenCalledTimes(1);
    expect(mockRunner.run.mock.calls[0][0]).toBe("TaskCompleted");
    const payload = mockRunner.run.mock.calls[0][1];
    expect(payload.data).toEqual(
      expect.objectContaining({
        taskId: "team-t1",
        taskTitle: "Team final-team completed",
        taskPriority: "high",
        teamId: "t1",
      }),
    );
  });

  it("should not emit hooks for team:created", async () => {
    const handler = createTeamEventHandler(emitter, "t", 1);
    await handler({ type: "team:created", teamId: "t1", teamName: "t" });
    expect(mockRunner.run).not.toHaveBeenCalled();
  });

  it("should not emit hooks for team:member-started", async () => {
    const handler = createTeamEventHandler(emitter, "t", 1);
    await handler({
      type: "team:member-started",
      teamId: "t1",
      memberId: "m1",
      memberName: "w1",
    });
    expect(mockRunner.run).not.toHaveBeenCalled();
  });

  it("should not emit hooks for team:failed", async () => {
    const handler = createTeamEventHandler(emitter, "t", 1);
    await handler({ type: "team:failed", teamId: "t1", error: "fail" });
    expect(mockRunner.run).not.toHaveBeenCalled();
  });

  it("should silently swallow errors", async () => {
    mockRunner.run.mockRejectedValue(new Error("hook crash"));
    const handler = createTeamEventHandler(emitter, "t", 2);
    await expect(
      handler({
        type: "team:member-completed",
        teamId: "t1",
        memberId: "m1",
        memberName: "w1",
      }),
    ).resolves.toBeUndefined();
  });

  it("should handle mixed event sequence correctly", async () => {
    const handler = createTeamEventHandler(emitter, "mixed-team", 4);

    await handler({ type: "team:created", teamId: "t1", teamName: "mixed-team" });
    expect(mockRunner.run).not.toHaveBeenCalled();

    await handler({
      type: "team:member-started",
      teamId: "t1",
      memberId: "m1",
      memberName: "w1",
    });
    expect(mockRunner.run).not.toHaveBeenCalled();

    await handler({
      type: "team:member-completed",
      teamId: "t1",
      memberId: "m1",
      memberName: "w1",
      result: "ok",
    });
    expect(mockRunner.run).toHaveBeenCalledTimes(1);
    expect((mockRunner.run.mock.calls[0][1].data as Record<string, unknown>).remainingMembers).toBe(
      3,
    );

    await handler({
      type: "team:member-failed",
      teamId: "t1",
      memberId: "m2",
      memberName: "w2",
      error: "timeout",
    });
    expect(mockRunner.run).toHaveBeenCalledTimes(2);
    expect((mockRunner.run.mock.calls[1][1].data as Record<string, unknown>).remainingMembers).toBe(
      2,
    );

    await handler({
      type: "team:completed",
      teamId: "t1",
      results: { m1: "ok" },
    });
    expect(mockRunner.run).toHaveBeenCalledTimes(3);
    expect(mockRunner.run.mock.calls[2][0]).toBe("TaskCompleted");
  });

  it("should serialize results as JSON in team:completed payload", async () => {
    const handler = createTeamEventHandler(emitter, "team-z", 2);
    const results = { m1: "success", m2: "partial" };
    await handler({
      type: "team:completed",
      teamId: "t1",
      results,
    });
    const payload = mockRunner.run.mock.calls[0][1];
    expect((payload.data as Record<string, unknown>).result).toBe(JSON.stringify(results));
  });

  it("should use team name in TaskCompleted title", async () => {
    const handler = createTeamEventHandler(emitter, "alpha-squad", 1);
    await handler({
      type: "team:completed",
      teamId: "t1",
      results: {},
    });
    const payload = mockRunner.run.mock.calls[0][1];
    expect((payload.data as Record<string, unknown>).taskTitle).toBe("Team alpha-squad completed");
  });
});
