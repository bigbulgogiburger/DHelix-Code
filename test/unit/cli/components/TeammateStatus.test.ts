import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── React & Ink Mocks ──────────────────────────────────────────────────────

let memoCallbacks: Map<number, unknown>;
let memoIndex: number;
let useMemoResults: unknown[];
let useMemoIndex: number;

function resetState() {
  memoCallbacks = new Map();
  memoIndex = 0;
  useMemoResults = [];
  useMemoIndex = 0;
}

vi.mock("react", () => {
  return {
    default: {
      memo: (component: unknown) => component,
    },
    useMemo: (factory: () => unknown) => {
      const result = factory();
      useMemoResults.push(result);
      return result;
    },
  };
});

vi.mock("ink", () => ({
  Box: () => null,
  Text: () => null,
}));

// ─── Module Import ───────────────────────────────────────────────────────────

async function getModule() {
  return await import("../../../../src/cli/components/TeammateStatus.js");
}

// ─── Test Data Factories ─────────────────────────────────────────────────────

interface TeamMemberSummary {
  readonly name: string;
  readonly role: string;
  readonly status: string;
  readonly elapsed?: number;
}

interface TeamSessionSummary {
  readonly id: string;
  readonly name: string;
  readonly status: string;
  readonly members: readonly TeamMemberSummary[];
  readonly createdAt: number;
  readonly completedAt?: number;
}

function createMember(overrides: Partial<TeamMemberSummary> = {}): TeamMemberSummary {
  return {
    name: "test-member",
    role: "worker",
    status: "pending",
    ...overrides,
  };
}

function createTeam(overrides: Partial<TeamSessionSummary> = {}): TeamSessionSummary {
  return {
    id: "team-1",
    name: "Test Team",
    status: "active",
    members: [],
    createdAt: Date.now(),
    ...overrides,
  };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("TeammateStatus", () => {
  let mod: Awaited<ReturnType<typeof getModule>>;

  beforeEach(async () => {
    resetState();
    mod = await getModule();
  });

  // ─── getStatusIcon ───────────────────────────────────────────────────────

  describe("getStatusIcon", () => {
    it("should return circle for pending", () => {
      expect(mod.getStatusIcon("pending")).toBe("\u25CB");
    });

    it("should return half-circle for running", () => {
      expect(mod.getStatusIcon("running")).toBe("\u25D0");
    });

    it("should return filled circle for completed", () => {
      expect(mod.getStatusIcon("completed")).toBe("\u25CF");
    });

    it("should return X for failed", () => {
      expect(mod.getStatusIcon("failed")).toBe("\u2715");
    });

    it("should return slashed circle for cancelled", () => {
      expect(mod.getStatusIcon("cancelled")).toBe("\u2298");
    });

    it("should return ? for unknown status", () => {
      expect(mod.getStatusIcon("unknown")).toBe("?");
    });

    it("should return ? for empty string status", () => {
      expect(mod.getStatusIcon("")).toBe("?");
    });
  });

  // ─── getStatusColor ──────────────────────────────────────────────────────

  describe("getStatusColor", () => {
    it("should return gray for pending", () => {
      expect(mod.getStatusColor("pending")).toBe("gray");
    });

    it("should return yellow for running", () => {
      expect(mod.getStatusColor("running")).toBe("yellow");
    });

    it("should return green for completed", () => {
      expect(mod.getStatusColor("completed")).toBe("green");
    });

    it("should return red for failed", () => {
      expect(mod.getStatusColor("failed")).toBe("red");
    });

    it("should return gray for cancelled", () => {
      expect(mod.getStatusColor("cancelled")).toBe("gray");
    });

    it("should return white for unknown status", () => {
      expect(mod.getStatusColor("unknown")).toBe("white");
    });

    it("should return white for empty string status", () => {
      expect(mod.getStatusColor("")).toBe("white");
    });
  });

  // ─── formatElapsedTime ───────────────────────────────────────────────────

  describe("formatElapsedTime", () => {
    it("should format 0 milliseconds as 0s", () => {
      expect(mod.formatElapsedTime(0)).toBe("0s");
    });

    it("should format sub-second as 0s", () => {
      expect(mod.formatElapsedTime(500)).toBe("0s");
    });

    it("should format seconds correctly", () => {
      expect(mod.formatElapsedTime(5000)).toBe("5s");
    });

    it("should format 59 seconds correctly", () => {
      expect(mod.formatElapsedTime(59000)).toBe("59s");
    });

    it("should format exactly 1 minute", () => {
      expect(mod.formatElapsedTime(60000)).toBe("1m");
    });

    it("should format minutes and seconds", () => {
      expect(mod.formatElapsedTime(90000)).toBe("1m 30s");
    });

    it("should format multiple minutes without seconds", () => {
      expect(mod.formatElapsedTime(300000)).toBe("5m");
    });

    it("should format exactly 1 hour", () => {
      expect(mod.formatElapsedTime(3600000)).toBe("1h");
    });

    it("should format hours and minutes", () => {
      expect(mod.formatElapsedTime(5400000)).toBe("1h 30m");
    });

    it("should format negative values as 0s", () => {
      expect(mod.formatElapsedTime(-1000)).toBe("0s");
    });

    it("should format large values (multi-hour)", () => {
      expect(mod.formatElapsedTime(7200000)).toBe("2h");
    });

    it("should format hours with remaining minutes", () => {
      // 2h 15m = 8100s = 8100000ms
      expect(mod.formatElapsedTime(8100000)).toBe("2h 15m");
    });
  });

  // ─── getTeamProgress ─────────────────────────────────────────────────────

  describe("getTeamProgress", () => {
    it("should return 0/0 for empty members", () => {
      const result = mod.getTeamProgress([]);
      expect(result).toEqual({ completed: 0, total: 0 });
    });

    it("should count completed members", () => {
      const members = [
        createMember({ status: "completed" }),
        createMember({ status: "running" }),
        createMember({ status: "pending" }),
      ];
      const result = mod.getTeamProgress(members);
      expect(result).toEqual({ completed: 1, total: 3 });
    });

    it("should return all completed when all done", () => {
      const members = [
        createMember({ status: "completed" }),
        createMember({ status: "completed" }),
      ];
      const result = mod.getTeamProgress(members);
      expect(result).toEqual({ completed: 2, total: 2 });
    });

    it("should not count failed or cancelled as completed", () => {
      const members = [
        createMember({ status: "failed" }),
        createMember({ status: "cancelled" }),
        createMember({ status: "completed" }),
      ];
      const result = mod.getTeamProgress(members);
      expect(result).toEqual({ completed: 1, total: 3 });
    });

    it("should return 0 completed when none are done", () => {
      const members = [createMember({ status: "running" }), createMember({ status: "pending" })];
      const result = mod.getTeamProgress(members);
      expect(result).toEqual({ completed: 0, total: 2 });
    });
  });

  // ─── countActiveTeams ────────────────────────────────────────────────────

  describe("countActiveTeams", () => {
    it("should return 0 for empty teams", () => {
      expect(mod.countActiveTeams([])).toBe(0);
    });

    it("should count active teams", () => {
      const teams = [
        createTeam({ id: "1", status: "active" }),
        createTeam({ id: "2", status: "completed" }),
        createTeam({ id: "3", status: "running" }),
      ];
      expect(mod.countActiveTeams(teams)).toBe(2);
    });

    it("should count running status as active", () => {
      const teams = [createTeam({ status: "running" })];
      expect(mod.countActiveTeams(teams)).toBe(1);
    });

    it("should not count completed or failed teams", () => {
      const teams = [
        createTeam({ id: "1", status: "completed" }),
        createTeam({ id: "2", status: "failed" }),
      ];
      expect(mod.countActiveTeams(teams)).toBe(0);
    });
  });

  // ─── truncateString ──────────────────────────────────────────────────────

  describe("truncateString", () => {
    it("should not truncate short strings", () => {
      expect(mod.truncateString("hello", 10)).toBe("hello");
    });

    it("should not truncate strings at exact max length", () => {
      expect(mod.truncateString("hello", 5)).toBe("hello");
    });

    it("should truncate long strings with ellipsis", () => {
      expect(mod.truncateString("a very long team name here", 10)).toBe("a very lo\u2026");
    });

    it("should handle single character max length", () => {
      expect(mod.truncateString("hello", 1)).toBe("\u2026");
    });

    it("should handle empty string", () => {
      expect(mod.truncateString("", 10)).toBe("");
    });
  });

  // ─── getAggregateMemberCounts ────────────────────────────────────────────

  describe("getAggregateMemberCounts", () => {
    it("should return 0/0 for empty teams", () => {
      const result = mod.getAggregateMemberCounts([]);
      expect(result).toEqual({ completed: 0, total: 0 });
    });

    it("should aggregate counts across multiple teams", () => {
      const teams = [
        createTeam({
          id: "1",
          members: [createMember({ status: "completed" }), createMember({ status: "running" })],
        }),
        createTeam({
          id: "2",
          members: [
            createMember({ status: "completed" }),
            createMember({ status: "completed" }),
            createMember({ status: "pending" }),
          ],
        }),
      ];
      const result = mod.getAggregateMemberCounts(teams);
      expect(result).toEqual({ completed: 3, total: 5 });
    });

    it("should handle teams with zero members", () => {
      const teams = [createTeam({ members: [] })];
      const result = mod.getAggregateMemberCounts(teams);
      expect(result).toEqual({ completed: 0, total: 0 });
    });
  });

  // ─── TeammateIndicator (Component) ───────────────────────────────────────

  describe("TeammateIndicator", () => {
    it("should return null when teams is empty", () => {
      useMemoIndex = 0;
      const result = mod.TeammateIndicator({ teams: [] });
      expect(result).toBeNull();
    });

    it("should render when a single active team exists", () => {
      const teams = [
        createTeam({
          members: [createMember({ status: "completed" }), createMember({ status: "running" })],
        }),
      ];
      useMemoIndex = 0;
      const result = mod.TeammateIndicator({ teams });
      expect(result).not.toBeNull();
    });

    it("should render with multiple active teams", () => {
      const teams = [
        createTeam({ id: "1", status: "active", members: [createMember({ status: "running" })] }),
        createTeam({ id: "2", status: "running", members: [createMember({ status: "pending" })] }),
      ];
      useMemoIndex = 0;
      const result = mod.TeammateIndicator({ teams });
      expect(result).not.toBeNull();
    });

    it("should render when all members are completed", () => {
      const teams = [
        createTeam({
          members: [createMember({ status: "completed" }), createMember({ status: "completed" })],
        }),
      ];
      useMemoIndex = 0;
      const result = mod.TeammateIndicator({ teams });
      expect(result).not.toBeNull();
    });

    it("should render with mix of member statuses", () => {
      const teams = [
        createTeam({
          members: [
            createMember({ status: "completed" }),
            createMember({ status: "running" }),
            createMember({ status: "failed" }),
            createMember({ status: "pending" }),
            createMember({ status: "cancelled" }),
          ],
        }),
      ];
      useMemoIndex = 0;
      const result = mod.TeammateIndicator({ teams });
      expect(result).not.toBeNull();
    });

    it("should render even with a completed team (non-active status)", () => {
      const teams = [
        createTeam({
          status: "completed",
          members: [createMember({ status: "completed" })],
        }),
      ];
      useMemoIndex = 0;
      const result = mod.TeammateIndicator({ teams });
      expect(result).not.toBeNull();
    });
  });

  // ─── TeammateDetailPanel (Component) ─────────────────────────────────────

  describe("TeammateDetailPanel", () => {
    it("should return null when teams is empty", () => {
      const result = mod.TeammateDetailPanel({ teams: [] });
      expect(result).toBeNull();
    });

    it("should render a single team with all member statuses", () => {
      const teams = [
        createTeam({
          name: "Feature Implementation",
          members: [
            createMember({ name: "researcher", status: "completed", elapsed: 12000 }),
            createMember({ name: "implementer", status: "running", elapsed: 8000 }),
            createMember({ name: "tester", status: "pending" }),
            createMember({ name: "reviewer", status: "failed", elapsed: 5000 }),
            createMember({ name: "documenter", status: "cancelled" }),
          ],
        }),
      ];
      const result = mod.TeammateDetailPanel({ teams });
      expect(result).not.toBeNull();
    });

    it("should render multiple teams", () => {
      const teams = [
        createTeam({
          id: "1",
          name: "Team Alpha",
          members: [createMember({ status: "completed" })],
        }),
        createTeam({
          id: "2",
          name: "Team Beta",
          members: [createMember({ status: "running" })],
        }),
      ];
      const result = mod.TeammateDetailPanel({ teams });
      expect(result).not.toBeNull();
    });

    it("should render expanded mode by default", () => {
      const teams = [
        createTeam({
          members: [createMember({ status: "running" })],
        }),
      ];
      const result = mod.TeammateDetailPanel({ teams });
      expect(result).not.toBeNull();
    });

    it("should render collapsed mode when expanded=false", () => {
      const teams = [
        createTeam({
          members: [createMember({ status: "running" })],
        }),
      ];
      const result = mod.TeammateDetailPanel({ teams, expanded: false });
      expect(result).not.toBeNull();
    });

    it("should render team with zero members", () => {
      const teams = [createTeam({ members: [] })];
      const result = mod.TeammateDetailPanel({ teams });
      expect(result).not.toBeNull();
    });

    it("should handle very long team names with truncation", () => {
      const teams = [
        createTeam({
          name: "This is a very long team name that should be truncated because it exceeds the max display length",
          members: [createMember()],
        }),
      ];
      const result = mod.TeammateDetailPanel({ teams });
      expect(result).not.toBeNull();
    });
  });

  // ─── TeamMemberRow (Component) ───────────────────────────────────────────

  describe("TeamMemberRow", () => {
    it("should render pending member", () => {
      const member = createMember({ name: "worker-1", status: "pending" });
      const result = mod.TeamMemberRow({ member });
      expect(result).not.toBeNull();
    });

    it("should render running member", () => {
      const member = createMember({ name: "worker-1", status: "running", elapsed: 5000 });
      const result = mod.TeamMemberRow({ member });
      expect(result).not.toBeNull();
    });

    it("should render completed member", () => {
      const member = createMember({ name: "worker-1", status: "completed", elapsed: 12000 });
      const result = mod.TeamMemberRow({ member });
      expect(result).not.toBeNull();
    });

    it("should render failed member", () => {
      const member = createMember({ name: "worker-1", status: "failed", elapsed: 3000 });
      const result = mod.TeamMemberRow({ member });
      expect(result).not.toBeNull();
    });

    it("should render cancelled member", () => {
      const member = createMember({ name: "worker-1", status: "cancelled" });
      const result = mod.TeamMemberRow({ member });
      expect(result).not.toBeNull();
    });

    it("should render without elapsed time when not provided", () => {
      const member = createMember({ name: "worker-1", status: "pending" });
      const result = mod.TeamMemberRow({ member });
      expect(result).not.toBeNull();
    });

    it("should render with elapsed time when provided", () => {
      const member = createMember({ name: "worker-1", status: "running", elapsed: 30000 });
      const result = mod.TeamMemberRow({ member });
      expect(result).not.toBeNull();
    });

    it("should not render elapsed time when elapsed is 0", () => {
      const member = createMember({ name: "worker-1", status: "running", elapsed: 0 });
      const result = mod.TeamMemberRow({ member });
      expect(result).not.toBeNull();
    });

    it("should handle very long member names", () => {
      const member = createMember({
        name: "this-is-a-very-long-member-name-that-exceeds-display",
        status: "running",
      });
      const result = mod.TeamMemberRow({ member });
      expect(result).not.toBeNull();
    });

    it("should respect custom maxNameLength", () => {
      const member = createMember({ name: "short", status: "completed" });
      const result = mod.TeamMemberRow({ member, maxNameLength: 10 });
      expect(result).not.toBeNull();
    });
  });

  // ─── Edge Cases ──────────────────────────────────────────────────────────

  describe("edge cases", () => {
    it("should handle team with only failed members", () => {
      const teams = [
        createTeam({
          members: [createMember({ status: "failed" }), createMember({ status: "failed" })],
        }),
      ];
      const progress = mod.getTeamProgress(teams[0].members);
      expect(progress.completed).toBe(0);
      expect(progress.total).toBe(2);
    });

    it("should handle team with only cancelled members", () => {
      const teams = [
        createTeam({
          members: [createMember({ status: "cancelled" }), createMember({ status: "cancelled" })],
        }),
      ];
      const progress = mod.getTeamProgress(teams[0].members);
      expect(progress.completed).toBe(0);
      expect(progress.total).toBe(2);
    });

    it("should handle single member team", () => {
      const members = [createMember({ status: "completed" })];
      const progress = mod.getTeamProgress(members);
      expect(progress).toEqual({ completed: 1, total: 1 });
    });

    it("should handle many teams for aggregate counts", () => {
      const teams = Array.from({ length: 10 }, (_, i) =>
        createTeam({
          id: `team-${i}`,
          members: [createMember({ status: i % 2 === 0 ? "completed" : "running" })],
        }),
      );
      const result = mod.getAggregateMemberCounts(teams);
      expect(result.completed).toBe(5);
      expect(result.total).toBe(10);
    });

    it("should handle formatElapsedTime with very large values", () => {
      // 100 hours
      const result = mod.formatElapsedTime(360000000);
      expect(result).toBe("100h");
    });

    it("should handle formatElapsedTime with exactly 1000ms", () => {
      expect(mod.formatElapsedTime(1000)).toBe("1s");
    });

    it("should handle getStatusIcon with arbitrary string", () => {
      expect(mod.getStatusIcon("whatever-status")).toBe("?");
    });

    it("should handle getStatusColor with arbitrary string", () => {
      expect(mod.getStatusColor("whatever-status")).toBe("white");
    });
  });

  // ─── Export Verification ─────────────────────────────────────────────────

  describe("exports", () => {
    it("should export TeammateIndicator as a function", () => {
      expect(typeof mod.TeammateIndicator).toBe("function");
    });

    it("should export TeammateDetailPanel as a function", () => {
      expect(typeof mod.TeammateDetailPanel).toBe("function");
    });

    it("should export TeamMemberRow as a function", () => {
      expect(typeof mod.TeamMemberRow).toBe("function");
    });

    it("should export getStatusIcon as a function", () => {
      expect(typeof mod.getStatusIcon).toBe("function");
    });

    it("should export getStatusColor as a function", () => {
      expect(typeof mod.getStatusColor).toBe("function");
    });

    it("should export formatElapsedTime as a function", () => {
      expect(typeof mod.formatElapsedTime).toBe("function");
    });

    it("should export getTeamProgress as a function", () => {
      expect(typeof mod.getTeamProgress).toBe("function");
    });

    it("should export countActiveTeams as a function", () => {
      expect(typeof mod.countActiveTeams).toBe("function");
    });

    it("should export truncateString as a function", () => {
      expect(typeof mod.truncateString).toBe("function");
    });

    it("should export getAggregateMemberCounts as a function", () => {
      expect(typeof mod.getAggregateMemberCounts).toBe("function");
    });
  });
});
