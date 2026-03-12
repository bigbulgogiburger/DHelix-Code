import { type SlashCommand, type CommandResult, type CommandContext } from "./registry.js";
import { BaseError } from "../utils/error.js";

/** Error thrown by the /team command */
export class TeamCommandError extends BaseError {
  constructor(message: string, context: Record<string, unknown> = {}) {
    super(message, "TEAM_COMMAND_ERROR", context);
  }
}

/** Team status type */
type TeamStatus = "creating" | "active" | "completing" | "completed" | "failed";

/** Member status type */
type MemberStatus = "pending" | "running" | "completed" | "failed" | "cancelled";

/** A single team member */
interface TeamMember {
  readonly id: string;
  readonly name: string;
  readonly role: string;
  readonly type: string;
  readonly prompt: string;
  readonly status: MemberStatus;
  readonly agentId?: string;
  readonly result?: string;
  readonly startedAt?: number;
  readonly completedAt?: number;
  readonly dependsOn?: readonly string[];
}

/** A team session */
interface TeamSession {
  readonly id: string;
  readonly name: string;
  readonly status: TeamStatus;
  readonly members: readonly TeamMember[];
  readonly createdAt: number;
  readonly completedAt?: number;
}

/** Configuration for creating a team */
interface TeamConfig {
  readonly name: string;
  readonly members?: readonly {
    readonly name: string;
    readonly role: string;
    readonly type: string;
    readonly prompt: string;
    readonly dependsOn?: readonly string[];
  }[];
}

/** Result from team execution */
interface TeamResult {
  readonly teamId: string;
  readonly status: TeamStatus;
  readonly memberResults: readonly {
    readonly memberId: string;
    readonly status: MemberStatus;
    readonly result?: string;
  }[];
}

/** Interface for the AgentTeamManager dependency */
export interface AgentTeamManager {
  createTeam(config: TeamConfig): Promise<TeamSession>;
  executeTeam(teamId: string): Promise<TeamResult>;
  cancelTeam(teamId: string): Promise<void>;
  getTeamStatus(teamId: string): TeamSession | undefined;
  getActiveTeams(): TeamSession[];
  getTeamSummary(teamId: string): string;
  cleanup(): void;
}

/** Status indicator symbols for each member status */
const MEMBER_STATUS_ICONS: Readonly<Record<MemberStatus, string>> = {
  pending: "\u25CB",
  running: "\u25D0",
  completed: "\u25CF",
  failed: "\u2715",
  cancelled: "\u2298",
};

/**
 * Format elapsed time from start to end (or now if still running).
 * Returns a human-readable string like "12s", "2m", "1h 3m".
 */
export function formatElapsed(startMs: number, endMs?: number): string {
  const end = endMs ?? Date.now();
  const diffMs = Math.max(0, end - startMs);
  const totalSeconds = Math.floor(diffMs / 1000);

  if (totalSeconds < 60) {
    return `${totalSeconds}s`;
  }

  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  if (minutes < 60) {
    return seconds > 0 ? `${minutes}m ${seconds}s` : `${minutes}m`;
  }

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours}h`;
}

/**
 * Format a timestamp as relative time (e.g., "2m ago", "1h ago").
 */
export function formatTimestamp(ms: number): string {
  const diffMs = Math.max(0, Date.now() - ms);
  const totalSeconds = Math.floor(diffMs / 1000);

  if (totalSeconds < 60) {
    return `${totalSeconds}s ago`;
  }

  const minutes = Math.floor(totalSeconds / 60);
  if (minutes < 60) {
    return `${minutes}m ago`;
  }

  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return `${hours}h ago`;
  }

  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

/**
 * Format a single team member's status line.
 */
export function formatMemberStatus(member: TeamMember): string {
  const icon = MEMBER_STATUS_ICONS[member.status];
  const name = member.name.padEnd(16);
  const status = member.status.padEnd(12);

  const parts = [`  ${icon} ${name}${status}`];

  if (member.status === "completed" && member.startedAt) {
    parts.push(`(${formatElapsed(member.startedAt, member.completedAt)})`);
  } else if (member.status === "running" && member.startedAt) {
    parts.push(`(${formatElapsed(member.startedAt)})`);
  } else if (member.status === "failed" && member.result) {
    parts.push(`Error: ${member.result}`);
  }

  return parts.join(" ");
}

/**
 * Format a table of teams for the /team list subcommand.
 */
export function formatTeamTable(teams: readonly TeamSession[]): string {
  if (teams.length === 0) {
    return "No teams found.";
  }

  const header = `${"ID".padEnd(10)}${"Name".padEnd(20)}${"Status".padEnd(14)}${"Members".padEnd(10)}Created`;
  const separator = "-".repeat(header.length);

  const rows = teams.map((team) => {
    const shortId = team.id.slice(0, 8);
    const completedCount = team.members.filter((m) => m.status === "completed").length;
    const memberProgress = `${completedCount}/${team.members.length}`;
    const created = formatTimestamp(team.createdAt);

    return `${shortId.padEnd(10)}${team.name.padEnd(20)}${team.status.padEnd(14)}${memberProgress.padEnd(10)}${created}`;
  });

  return [header, separator, ...rows].join("\n");
}

/**
 * Handle /team help — show usage information.
 */
function handleHelp(): CommandResult {
  const output = [
    "Agent Teams \u2014 Coordinate multiple AI agents in parallel",
    "",
    "Usage:",
    "  /team create <name>              Create a new team",
    "  /team status [id]                Show team status (all or specific)",
    "  /team cancel <id>                Cancel a running team",
    "  /team list                       List all teams (active + completed)",
    "  /team summary <id>               Show detailed team summary",
    "  /team help                       Show this help",
    "",
    "Examples:",
    '  /team create "Feature Team"',
    "  /team status",
    "  /team cancel abc123",
  ].join("\n");

  return { output, success: true };
}

/**
 * Handle /team create <name> — create a new team.
 */
async function handleCreate(
  nameArg: string,
  teamManager: AgentTeamManager,
  _context: CommandContext,
): Promise<CommandResult> {
  const name = nameArg.replace(/^["']|["']$/g, "").trim();

  if (!name) {
    return {
      output: [
        "Missing team name.",
        "",
        "Usage: /team create <name>",
        "",
        'Example: /team create "Feature Team"',
      ].join("\n"),
      success: false,
    };
  }

  try {
    const team = await teamManager.createTeam({ name });

    return {
      output: [
        `Team created: ${team.name} (${team.id.slice(0, 8)})`,
        "",
        "Define team members by describing the roles and tasks needed.",
        "The LLM will coordinate the team execution.",
      ].join("\n"),
      success: true,
      shouldInjectAsUserMessage: true,
    };
  } catch (error) {
    throw new TeamCommandError("Failed to create team", {
      name,
      cause: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * Handle /team status [id] — show team status.
 */
function handleStatus(idArg: string | undefined, teamManager: AgentTeamManager): CommandResult {
  if (idArg) {
    const team = teamManager.getTeamStatus(idArg);
    if (!team) {
      return {
        output: `Team not found: ${idArg}`,
        success: false,
      };
    }

    const completedCount = team.members.filter((m) => m.status === "completed").length;
    const lines = [
      `Team: ${team.name} (${team.id.slice(0, 8)})`,
      `Status: ${team.status} | Members: ${completedCount}/${team.members.length} complete`,
      "",
      "Members:",
      ...team.members.map(formatMemberStatus),
    ];

    return { output: lines.join("\n"), success: true };
  }

  // No ID: show all active teams
  const activeTeams = teamManager.getActiveTeams();

  if (activeTeams.length === 0) {
    return {
      output: "No active teams.\n\nUse /team create <name> to start a new team.",
      success: true,
    };
  }

  const sections = activeTeams.map((team) => {
    const completedCount = team.members.filter((m) => m.status === "completed").length;
    const lines = [
      `Team: ${team.name} (${team.id.slice(0, 8)})`,
      `Status: ${team.status} | Members: ${completedCount}/${team.members.length} complete`,
      "",
      "Members:",
      ...team.members.map(formatMemberStatus),
    ];
    return lines.join("\n");
  });

  return { output: sections.join("\n\n"), success: true };
}

/**
 * Handle /team cancel <id> — cancel a running team.
 */
async function handleCancel(
  idArg: string | undefined,
  teamManager: AgentTeamManager,
): Promise<CommandResult> {
  if (!idArg) {
    return {
      output: "Missing team ID.\n\nUsage: /team cancel <id>",
      success: false,
    };
  }

  const team = teamManager.getTeamStatus(idArg);
  if (!team) {
    return {
      output: `Team not found: ${idArg}`,
      success: false,
    };
  }

  if (team.status === "completed" || team.status === "failed") {
    return {
      output: `Team "${team.name}" has already ${team.status}. Cannot cancel.`,
      success: false,
    };
  }

  try {
    await teamManager.cancelTeam(idArg);

    const cancelledMembers = team.members.filter(
      (m) => m.status === "running" || m.status === "pending",
    );

    const lines = [
      `Team "${team.name}" cancelled.`,
      "",
      `Affected members (${cancelledMembers.length}):`,
      ...cancelledMembers.map((m) => `  - ${m.name} (${m.role}): was ${m.status}`),
    ];

    return { output: lines.join("\n"), success: true };
  } catch (error) {
    throw new TeamCommandError("Failed to cancel team", {
      teamId: idArg,
      cause: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * Handle /team list — list all teams.
 */
function handleList(teamManager: AgentTeamManager): CommandResult {
  const teams = teamManager.getActiveTeams();
  const output = formatTeamTable(teams);
  return { output, success: true };
}

/**
 * Handle /team summary <id> — show detailed team summary.
 */
function handleSummary(idArg: string | undefined, teamManager: AgentTeamManager): CommandResult {
  if (!idArg) {
    return {
      output: "Missing team ID.\n\nUsage: /team summary <id>",
      success: false,
    };
  }

  const team = teamManager.getTeamStatus(idArg);
  if (!team) {
    return {
      output: `Team not found: ${idArg}`,
      success: false,
    };
  }

  const summary = teamManager.getTeamSummary(idArg);
  return { output: summary, success: true };
}

/**
 * Factory function that creates the /team slash command.
 *
 * Accepts an AgentTeamManager dependency so the command can be
 * wired up at registration time without tight coupling.
 */
export function createTeamCommand(teamManager: AgentTeamManager): SlashCommand {
  return {
    name: "team",
    description: "Manage Agent Teams (create, status, cancel, list)",
    usage: "/team <create|status|cancel|list|summary|help> [args]",

    async execute(args: string, context: CommandContext): Promise<CommandResult> {
      const trimmed = args.trim();
      const [subcommand, ...rest] = trimmed.split(/\s+/);

      switch (subcommand || "help") {
        case "create":
          return handleCreate(rest.join(" "), teamManager, context);

        case "status":
          return handleStatus(rest[0], teamManager);

        case "cancel":
          return handleCancel(rest[0], teamManager);

        case "list":
          return handleList(teamManager);

        case "summary":
          return handleSummary(rest[0], teamManager);

        case "help":
        default:
          return handleHelp();
      }
    },
  };
}
