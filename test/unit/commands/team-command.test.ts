import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  createTeamCommand,
  TeamCommandError,
  formatElapsed,
  formatTimestamp,
  formatMemberStatus,
  formatTeamTable,
  type AgentTeamManager,
} from "../../../src/commands/team.js";

/** Helper: create a mock AgentTeamManager */
function createMockTeamManager(overrides: Partial<AgentTeamManager> = {}): AgentTeamManager {
  return {
    createTeam: vi.fn().mockResolvedValue({
      id: "team-001-uuid",
      name: "Test Team",
      status: "creating",
      members: [],
      createdAt: Date.now(),
    }),
    executeTeam: vi.fn().mockResolvedValue({
      teamId: "team-001-uuid",
      status: "completed",
      memberResults: [],
    }),
    cancelTeam: vi.fn().mockResolvedValue(undefined),
    getTeamStatus: vi.fn().mockReturnValue(undefined),
    getActiveTeams: vi.fn().mockReturnValue([]),
    getTeamSummary: vi.fn().mockReturnValue("Team summary placeholder"),
    cleanup: vi.fn(),
    ...overrides,
  };
}

const baseContext = {
  workingDirectory: "/tmp/test",
  model: "test-model",
  sessionId: "test-session",
  emit: vi.fn(),
};

/** Helper: create a team member object for testing */
function createMember(overrides: Record<string, unknown> = {}) {
  return {
    id: "member-1",
    name: "researcher",
    role: "Research",
    type: "explore",
    prompt: "Investigate the codebase",
    status: "pending" as const,
    ...overrides,
  };
}

/** Helper: create a team session object for testing */
function createTeamSession(overrides: Record<string, unknown> = {}) {
  return {
    id: "team-001-uuid",
    name: "Feature Team",
    status: "active" as const,
    members: [] as ReturnType<typeof createMember>[],
    createdAt: Date.now() - 120_000, // 2 minutes ago
    ...overrides,
  };
}

describe("/team command", () => {
  let manager: AgentTeamManager;

  beforeEach(() => {
    vi.restoreAllMocks();
    manager = createMockTeamManager();
  });

  // ─── Factory ────────────────────────────────────────────────

  describe("createTeamCommand", () => {
    it("should return a SlashCommand object", () => {
      const cmd = createTeamCommand(manager);
      expect(cmd.name).toBe("team");
      expect(cmd.description).toBeDefined();
      expect(cmd.usage).toContain("/team");
      expect(typeof cmd.execute).toBe("function");
    });

    it("should return a function from factory", () => {
      const cmd = createTeamCommand(manager);
      expect(cmd).toBeDefined();
      expect(cmd.execute).toBeInstanceOf(Function);
    });
  });

  // ─── Help ───────────────────────────────────────────────────

  describe("help subcommand", () => {
    it("should show help text with no args", async () => {
      const cmd = createTeamCommand(manager);
      const result = await cmd.execute("", baseContext);
      expect(result.success).toBe(true);
      expect(result.output).toContain("Agent Teams");
      expect(result.output).toContain("/team create");
      expect(result.output).toContain("/team status");
      expect(result.output).toContain("/team cancel");
      expect(result.output).toContain("/team list");
      expect(result.output).toContain("/team summary");
    });

    it("should show help with explicit help subcommand", async () => {
      const cmd = createTeamCommand(manager);
      const result = await cmd.execute("help", baseContext);
      expect(result.success).toBe(true);
      expect(result.output).toContain("Agent Teams");
      expect(result.output).toContain("Usage:");
    });

    it("should show help with examples", async () => {
      const cmd = createTeamCommand(manager);
      const result = await cmd.execute("help", baseContext);
      expect(result.output).toContain("Examples:");
      expect(result.output).toContain("/team create");
      expect(result.output).toContain("/team cancel");
    });

    it("should fall to help for unknown subcommand", async () => {
      const cmd = createTeamCommand(manager);
      const result = await cmd.execute("unknown-subcommand", baseContext);
      expect(result.success).toBe(true);
      expect(result.output).toContain("Agent Teams");
    });
  });

  // ─── Create ─────────────────────────────────────────────────

  describe("create subcommand", () => {
    it("should create a team with a name", async () => {
      const cmd = createTeamCommand(manager);
      const result = await cmd.execute("create Feature Team", baseContext);
      expect(result.success).toBe(true);
      expect(result.output).toContain("Team created");
      expect(result.output).toContain("Test Team");
      expect(manager.createTeam).toHaveBeenCalledWith({ name: "Feature Team" });
    });

    it("should strip quotes from team name", async () => {
      const cmd = createTeamCommand(manager);
      await cmd.execute('create "Bug Fix Squad"', baseContext);
      expect(manager.createTeam).toHaveBeenCalledWith({ name: "Bug Fix Squad" });
    });

    it("should return error when name is missing", async () => {
      const cmd = createTeamCommand(manager);
      const result = await cmd.execute("create", baseContext);
      expect(result.success).toBe(false);
      expect(result.output).toContain("Missing team name");
      expect(result.output).toContain("Usage");
    });

    it("should set shouldInjectAsUserMessage on success", async () => {
      const cmd = createTeamCommand(manager);
      const result = await cmd.execute("create My Team", baseContext);
      expect(result.shouldInjectAsUserMessage).toBe(true);
    });

    it("should include the short team ID in output", async () => {
      const cmd = createTeamCommand(manager);
      const result = await cmd.execute("create My Team", baseContext);
      expect(result.output).toContain("team-001");
    });

    it("should throw TeamCommandError on createTeam failure", async () => {
      const failManager = createMockTeamManager({
        createTeam: vi.fn().mockRejectedValue(new Error("creation failed")),
      });
      const cmd = createTeamCommand(failManager);
      await expect(cmd.execute("create Fail Team", baseContext)).rejects.toThrow(TeamCommandError);
    });
  });

  // ─── Status ─────────────────────────────────────────────────

  describe("status subcommand", () => {
    it("should show 'no active teams' when none active", async () => {
      const cmd = createTeamCommand(manager);
      const result = await cmd.execute("status", baseContext);
      expect(result.success).toBe(true);
      expect(result.output).toContain("No active teams");
    });

    it("should show all active teams when no ID given", async () => {
      const team1 = createTeamSession({
        id: "team-aaa-uuid",
        name: "Alpha",
        members: [
          createMember({ status: "completed" }),
          createMember({ id: "m2", name: "dev", status: "running" }),
        ],
      });
      const team2 = createTeamSession({
        id: "team-bbb-uuid",
        name: "Beta",
        members: [createMember({ status: "pending" })],
      });
      const activeManager = createMockTeamManager({
        getActiveTeams: vi.fn().mockReturnValue([team1, team2]),
      });
      const cmd = createTeamCommand(activeManager);
      const result = await cmd.execute("status", baseContext);
      expect(result.success).toBe(true);
      expect(result.output).toContain("Alpha");
      expect(result.output).toContain("Beta");
      expect(result.output).toContain("1/2 complete");
      expect(result.output).toContain("0/1 complete");
    });

    it("should show specific team status by ID", async () => {
      const team = createTeamSession({
        id: "team-xyz-uuid",
        name: "Gamma Team",
        members: [
          createMember({
            name: "analyst",
            status: "completed",
            startedAt: 1000,
            completedAt: 13000,
          }),
          createMember({ id: "m2", name: "writer", status: "running", startedAt: 5000 }),
        ],
      });
      const idManager = createMockTeamManager({
        getTeamStatus: vi.fn().mockReturnValue(team),
      });
      const cmd = createTeamCommand(idManager);
      const result = await cmd.execute("status team-xyz", baseContext);
      expect(result.success).toBe(true);
      expect(result.output).toContain("Gamma Team");
      expect(result.output).toContain("team-xyz");
      expect(result.output).toContain("Members:");
      expect(result.output).toContain("analyst");
      expect(result.output).toContain("writer");
    });

    it("should return error for non-existent team ID", async () => {
      const cmd = createTeamCommand(manager);
      const result = await cmd.execute("status nonexistent-id", baseContext);
      expect(result.success).toBe(false);
      expect(result.output).toContain("Team not found");
      expect(result.output).toContain("nonexistent-id");
    });

    it("should show member count progress", async () => {
      const team = createTeamSession({
        members: [
          createMember({ status: "completed" }),
          createMember({ id: "m2", name: "dev", status: "completed" }),
          createMember({ id: "m3", name: "tester", status: "pending" }),
        ],
      });
      const statusManager = createMockTeamManager({
        getTeamStatus: vi.fn().mockReturnValue(team),
      });
      const cmd = createTeamCommand(statusManager);
      const result = await cmd.execute("status team-001", baseContext);
      expect(result.output).toContain("2/3 complete");
    });
  });

  // ─── Cancel ─────────────────────────────────────────────────

  describe("cancel subcommand", () => {
    it("should cancel an active team", async () => {
      const team = createTeamSession({
        status: "active",
        members: [
          createMember({ name: "researcher", status: "running" }),
          createMember({ id: "m2", name: "writer", status: "pending" }),
          createMember({ id: "m3", name: "reviewer", status: "completed" }),
        ],
      });
      const cancelManager = createMockTeamManager({
        getTeamStatus: vi.fn().mockReturnValue(team),
        cancelTeam: vi.fn().mockResolvedValue(undefined),
      });
      const cmd = createTeamCommand(cancelManager);
      const result = await cmd.execute("cancel team-001", baseContext);
      expect(result.success).toBe(true);
      expect(result.output).toContain("cancelled");
      expect(result.output).toContain("Affected members (2)");
      expect(result.output).toContain("researcher");
      expect(result.output).toContain("writer");
      expect(cancelManager.cancelTeam).toHaveBeenCalledWith("team-001");
    });

    it("should return error when ID is missing", async () => {
      const cmd = createTeamCommand(manager);
      const result = await cmd.execute("cancel", baseContext);
      expect(result.success).toBe(false);
      expect(result.output).toContain("Missing team ID");
    });

    it("should return error for non-existent team", async () => {
      const cmd = createTeamCommand(manager);
      const result = await cmd.execute("cancel ghost-id", baseContext);
      expect(result.success).toBe(false);
      expect(result.output).toContain("Team not found");
    });

    it("should refuse to cancel a completed team", async () => {
      const team = createTeamSession({ status: "completed" });
      const completedManager = createMockTeamManager({
        getTeamStatus: vi.fn().mockReturnValue(team),
      });
      const cmd = createTeamCommand(completedManager);
      const result = await cmd.execute("cancel team-001", baseContext);
      expect(result.success).toBe(false);
      expect(result.output).toContain("already completed");
    });

    it("should refuse to cancel a failed team", async () => {
      const team = createTeamSession({ status: "failed" });
      const failedManager = createMockTeamManager({
        getTeamStatus: vi.fn().mockReturnValue(team),
      });
      const cmd = createTeamCommand(failedManager);
      const result = await cmd.execute("cancel team-001", baseContext);
      expect(result.success).toBe(false);
      expect(result.output).toContain("already failed");
    });

    it("should throw TeamCommandError on cancelTeam failure", async () => {
      const team = createTeamSession({ status: "active" });
      const errorManager = createMockTeamManager({
        getTeamStatus: vi.fn().mockReturnValue(team),
        cancelTeam: vi.fn().mockRejectedValue(new Error("cancel failed")),
      });
      const cmd = createTeamCommand(errorManager);
      await expect(cmd.execute("cancel team-001", baseContext)).rejects.toThrow(TeamCommandError);
    });
  });

  // ─── List ───────────────────────────────────────────────────

  describe("list subcommand", () => {
    it("should show 'No teams found' when empty", async () => {
      const cmd = createTeamCommand(manager);
      const result = await cmd.execute("list", baseContext);
      expect(result.success).toBe(true);
      expect(result.output).toContain("No teams found");
    });

    it("should list multiple teams in table format", async () => {
      const teams = [
        createTeamSession({
          id: "aaaaaaaa-bbbb",
          name: "Alpha",
          status: "active",
          members: [
            createMember({ status: "completed" }),
            createMember({ id: "m2", status: "running" }),
          ],
        }),
        createTeamSession({
          id: "cccccccc-dddd",
          name: "Beta",
          status: "completed",
          members: [
            createMember({ status: "completed" }),
            createMember({ id: "m2", status: "completed" }),
          ],
        }),
      ];
      const listManager = createMockTeamManager({
        getActiveTeams: vi.fn().mockReturnValue(teams),
      });
      const cmd = createTeamCommand(listManager);
      const result = await cmd.execute("list", baseContext);
      expect(result.success).toBe(true);
      expect(result.output).toContain("ID");
      expect(result.output).toContain("Name");
      expect(result.output).toContain("Status");
      expect(result.output).toContain("Alpha");
      expect(result.output).toContain("Beta");
    });

    it("should show mixed statuses in list", async () => {
      const teams = [
        createTeamSession({ id: "aaaa0000-1111", name: "Active T", status: "active", members: [] }),
        createTeamSession({
          id: "bbbb0000-2222",
          name: "Done T",
          status: "completed",
          members: [],
        }),
        createTeamSession({ id: "cccc0000-3333", name: "Failed T", status: "failed", members: [] }),
      ];
      const mixedManager = createMockTeamManager({
        getActiveTeams: vi.fn().mockReturnValue(teams),
      });
      const cmd = createTeamCommand(mixedManager);
      const result = await cmd.execute("list", baseContext);
      expect(result.output).toContain("active");
      expect(result.output).toContain("completed");
      expect(result.output).toContain("failed");
    });

    it("should show member progress counts", async () => {
      const teams = [
        createTeamSession({
          id: "xxxx0000-yyyy",
          name: "Progress Team",
          members: [
            createMember({ status: "completed" }),
            createMember({ id: "m2", status: "completed" }),
            createMember({ id: "m3", status: "running" }),
          ],
        }),
      ];
      const progressManager = createMockTeamManager({
        getActiveTeams: vi.fn().mockReturnValue(teams),
      });
      const cmd = createTeamCommand(progressManager);
      const result = await cmd.execute("list", baseContext);
      expect(result.output).toContain("2/3");
    });
  });

  // ─── Summary ────────────────────────────────────────────────

  describe("summary subcommand", () => {
    it("should show team summary for valid ID", async () => {
      const team = createTeamSession();
      const summaryManager = createMockTeamManager({
        getTeamStatus: vi.fn().mockReturnValue(team),
        getTeamSummary: vi.fn().mockReturnValue("Detailed summary of team results"),
      });
      const cmd = createTeamCommand(summaryManager);
      const result = await cmd.execute("summary team-001", baseContext);
      expect(result.success).toBe(true);
      expect(result.output).toBe("Detailed summary of team results");
      expect(summaryManager.getTeamSummary).toHaveBeenCalledWith("team-001");
    });

    it("should return error when ID is missing", async () => {
      const cmd = createTeamCommand(manager);
      const result = await cmd.execute("summary", baseContext);
      expect(result.success).toBe(false);
      expect(result.output).toContain("Missing team ID");
    });

    it("should return error for non-existent team", async () => {
      const cmd = createTeamCommand(manager);
      const result = await cmd.execute("summary ghost-id", baseContext);
      expect(result.success).toBe(false);
      expect(result.output).toContain("Team not found");
    });
  });

  // ─── Format helpers ─────────────────────────────────────────

  describe("formatElapsed", () => {
    it("should format sub-minute durations as seconds", () => {
      expect(formatElapsed(0, 5000)).toBe("5s");
      expect(formatElapsed(0, 0)).toBe("0s");
      expect(formatElapsed(0, 59_000)).toBe("59s");
    });

    it("should format minutes without leftover seconds", () => {
      expect(formatElapsed(0, 60_000)).toBe("1m");
      expect(formatElapsed(0, 120_000)).toBe("2m");
    });

    it("should format minutes with remaining seconds", () => {
      expect(formatElapsed(0, 90_000)).toBe("1m 30s");
      expect(formatElapsed(0, 125_000)).toBe("2m 5s");
    });

    it("should format hours", () => {
      expect(formatElapsed(0, 3_600_000)).toBe("1h");
      expect(formatElapsed(0, 7_200_000)).toBe("2h");
    });

    it("should format hours with remaining minutes", () => {
      expect(formatElapsed(0, 3_660_000)).toBe("1h 1m");
      expect(formatElapsed(0, 5_400_000)).toBe("1h 30m");
    });

    it("should handle negative diff as 0s", () => {
      // endMs before startMs
      expect(formatElapsed(10_000, 5_000)).toBe("0s");
    });

    it("should use Date.now() when endMs is undefined", () => {
      const now = Date.now();
      const result = formatElapsed(now - 5000);
      // Should be approximately "5s" (could be 4s or 5s depending on timing)
      expect(result).toMatch(/^[45]s$/);
    });
  });

  describe("formatTimestamp", () => {
    it("should show seconds ago for recent timestamps", () => {
      const result = formatTimestamp(Date.now() - 30_000);
      expect(result).toMatch(/^\d+s ago$/);
    });

    it("should show minutes ago", () => {
      const result = formatTimestamp(Date.now() - 120_000);
      expect(result).toBe("2m ago");
    });

    it("should show hours ago", () => {
      const result = formatTimestamp(Date.now() - 3_600_000);
      expect(result).toBe("1h ago");
    });

    it("should show days ago", () => {
      const result = formatTimestamp(Date.now() - 86_400_000 * 2);
      expect(result).toBe("2d ago");
    });
  });

  describe("formatMemberStatus", () => {
    it("should show pending icon for pending members", () => {
      const member = createMember({ status: "pending" });
      const line = formatMemberStatus(member);
      expect(line).toContain("\u25CB"); // ○
      expect(line).toContain("researcher");
      expect(line).toContain("pending");
    });

    it("should show running icon with elapsed time", () => {
      const member = createMember({
        status: "running",
        startedAt: Date.now() - 8000,
      });
      const line = formatMemberStatus(member);
      expect(line).toContain("\u25D0"); // ◐
      expect(line).toContain("running");
      expect(line).toMatch(/\(\d+s\)/);
    });

    it("should show completed icon with duration", () => {
      const member = createMember({
        status: "completed",
        startedAt: 1000,
        completedAt: 13_000,
      });
      const line = formatMemberStatus(member);
      expect(line).toContain("\u25CF"); // ●
      expect(line).toContain("completed");
      expect(line).toContain("(12s)");
    });

    it("should show failed icon with error message", () => {
      const member = createMember({
        status: "failed",
        result: "timeout",
      });
      const line = formatMemberStatus(member);
      expect(line).toContain("\u2715"); // ✕
      expect(line).toContain("failed");
      expect(line).toContain("Error: timeout");
    });

    it("should show cancelled icon", () => {
      const member = createMember({ status: "cancelled" });
      const line = formatMemberStatus(member);
      expect(line).toContain("\u2298"); // ⊘
      expect(line).toContain("cancelled");
    });

    it("should not show elapsed for completed without startedAt", () => {
      const member = createMember({ status: "completed" });
      const line = formatMemberStatus(member);
      expect(line).not.toContain("(");
    });

    it("should not show error for failed without result", () => {
      const member = createMember({ status: "failed" });
      const line = formatMemberStatus(member);
      expect(line).not.toContain("Error:");
    });
  });

  describe("formatTeamTable", () => {
    it("should return 'No teams found' for empty array", () => {
      expect(formatTeamTable([])).toBe("No teams found.");
    });

    it("should include header row", () => {
      const teams = [createTeamSession()];
      const table = formatTeamTable(teams);
      expect(table).toContain("ID");
      expect(table).toContain("Name");
      expect(table).toContain("Status");
      expect(table).toContain("Members");
      expect(table).toContain("Created");
    });

    it("should include separator line", () => {
      const teams = [createTeamSession()];
      const table = formatTeamTable(teams);
      const lines = table.split("\n");
      // Second line should be dashes
      expect(lines[1]).toMatch(/^-+$/);
    });

    it("should format multiple teams with short IDs", () => {
      const teams = [
        createTeamSession({
          id: "12345678-abcd-efgh",
          name: "First",
          status: "active",
          members: [createMember({ status: "completed" })],
        }),
        createTeamSession({
          id: "abcdefgh-1234-5678",
          name: "Second",
          status: "completed",
          members: [
            createMember({ status: "completed" }),
            createMember({ id: "m2", status: "completed" }),
          ],
        }),
      ];
      const table = formatTeamTable(teams);
      expect(table).toContain("12345678");
      expect(table).toContain("abcdefgh");
      expect(table).toContain("First");
      expect(table).toContain("Second");
      expect(table).toContain("1/1");
      expect(table).toContain("2/2");
    });
  });

  // ─── TeamCommandError ───────────────────────────────────────

  describe("TeamCommandError", () => {
    it("should extend BaseError with correct code", () => {
      const err = new TeamCommandError("test error");
      expect(err.code).toBe("TEAM_COMMAND_ERROR");
      expect(err.message).toBe("test error");
      expect(err.name).toBe("TeamCommandError");
    });

    it("should accept context", () => {
      const err = new TeamCommandError("test", { teamId: "abc" });
      expect(err.context).toEqual({ teamId: "abc" });
    });
  });
});
