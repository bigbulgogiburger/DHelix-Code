import React, { useMemo } from "react";
import { Box, Text } from "ink";

// ─── Types ───────────────────────────────────────────────────────────────────

/** Simplified team member data for display purposes */
export interface TeamMemberSummary {
  readonly name: string;
  readonly role: string;
  readonly status: string;
  readonly elapsed?: number; // milliseconds
}

/** Simplified team session data for display purposes */
export interface TeamSessionSummary {
  readonly id: string;
  readonly name: string;
  readonly status: string;
  readonly members: readonly TeamMemberSummary[];
  readonly createdAt: number;
  readonly completedAt?: number;
}

/** Props for the compact teammate indicator (shown in StatusBar area) */
export interface TeammateIndicatorProps {
  readonly teams: readonly TeamSessionSummary[];
}

/** Props for the detailed teammate panel (shown below activity feed) */
export interface TeammateDetailPanelProps {
  readonly teams: readonly TeamSessionSummary[];
  readonly expanded?: boolean;
}

/** Props for a single team member row */
export interface TeamMemberRowProps {
  readonly member: TeamMemberSummary;
  readonly maxNameLength?: number;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const MAX_DISPLAY_NAME_LENGTH = 20;
const MAX_TEAM_NAME_LENGTH = 40;

/** Status icons for team member states */
const STATUS_ICONS: Record<string, string> = {
  pending: "\u25CB", // ○
  running: "\u25D0", // ◐
  completed: "\u25CF", // ●
  failed: "\u2715", // ✕
  cancelled: "\u2298", // ⊘
};

/** Status colors for team member states */
const STATUS_COLORS: Record<string, string> = {
  pending: "gray",
  running: "yellow",
  completed: "green",
  failed: "red",
  cancelled: "gray",
};

// ─── Helper Functions ────────────────────────────────────────────────────────

/** Get status icon for a member status */
export function getStatusIcon(status: string): string {
  return STATUS_ICONS[status] ?? "?";
}

/** Get status color for a member status */
export function getStatusColor(status: string): string {
  return STATUS_COLORS[status] ?? "white";
}

/** Format elapsed time in milliseconds to human-readable string */
export function formatElapsedTime(ms: number): string {
  if (ms < 0) {
    return "0s";
  }
  const totalSeconds = Math.floor(ms / 1000);
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

/** Calculate team progress: how many members completed vs total */
export function getTeamProgress(members: readonly TeamMemberSummary[]): {
  readonly completed: number;
  readonly total: number;
} {
  const completed = members.filter((m) => m.status === "completed").length;
  return { completed, total: members.length };
}

/** Count active (non-completed, non-cancelled, non-failed) teams */
export function countActiveTeams(teams: readonly TeamSessionSummary[]): number {
  return teams.filter((t) => t.status === "active" || t.status === "running").length;
}

/** Truncate a string to a max length, adding ellipsis if needed */
export function truncateString(str: string, maxLength: number): string {
  if (str.length <= maxLength) {
    return str;
  }
  return str.slice(0, maxLength - 1) + "\u2026";
}

/** Get aggregate member counts across all teams */
export function getAggregateMemberCounts(teams: readonly TeamSessionSummary[]): {
  readonly completed: number;
  readonly total: number;
} {
  let completed = 0;
  let total = 0;
  for (const team of teams) {
    const progress = getTeamProgress(team.members);
    completed += progress.completed;
    total += progress.total;
  }
  return { completed, total };
}

// ─── Components ──────────────────────────────────────────────────────────────

/** Render a single team member row with status icon, name, status, and elapsed time */
export const TeamMemberRow = React.memo(function TeamMemberRow({
  member,
  maxNameLength = MAX_DISPLAY_NAME_LENGTH,
}: TeamMemberRowProps) {
  const icon = getStatusIcon(member.status);
  const color = getStatusColor(member.status);
  const displayName = truncateString(member.name, maxNameLength);
  const paddedName = displayName.padEnd(maxNameLength);
  const isDim = member.status === "cancelled";
  const isBold = member.status === "running";

  return (
    <Box gap={1}>
      <Text color={color}>{icon}</Text>
      <Text bold={isBold} dimColor={isDim}>
        {paddedName}
      </Text>
      <Text color={color} bold={isBold} dimColor={isDim}>
        {member.status.padEnd(10)}
      </Text>
      {member.elapsed !== undefined && member.elapsed > 0 ? (
        <Text color="gray">{formatElapsedTime(member.elapsed)}</Text>
      ) : null}
    </Box>
  );
});

/**
 * Compact teammate indicator for StatusBar area.
 * Shows a single-line summary: [Teams: N active | X/Y members done]
 * Returns null when there are no teams to display.
 */
export const TeammateIndicator = React.memo(function TeammateIndicator({
  teams,
}: TeammateIndicatorProps) {
  const activeCount = useMemo(() => countActiveTeams(teams), [teams]);
  const aggregate = useMemo(() => getAggregateMemberCounts(teams), [teams]);

  if (teams.length === 0) {
    return null;
  }

  const allDone = aggregate.completed === aggregate.total && aggregate.total > 0;
  const indicatorColor = allDone ? "green" : "yellow";

  return (
    <Box>
      <Text color={indicatorColor}>
        [Teams: {activeCount} active | {aggregate.completed}/{aggregate.total} members done]
      </Text>
    </Box>
  );
});

/**
 * Detailed teammate panel showing all teams and their member statuses.
 * Renders a bordered box per team with member rows and progress.
 * When collapsed (expanded=false), shows only the team header with progress.
 */
export const TeammateDetailPanel = React.memo(function TeammateDetailPanel({
  teams,
  expanded = true,
}: TeammateDetailPanelProps) {
  if (teams.length === 0) {
    return null;
  }

  return (
    <Box flexDirection="column">
      {teams.map((team) => {
        const progress = getTeamProgress(team.members);
        const displayTeamName = truncateString(team.name, MAX_TEAM_NAME_LENGTH);
        const isTeamDone = progress.completed === progress.total && progress.total > 0;
        const borderColor = isTeamDone ? "green" : "yellow";

        return (
          <Box
            key={team.id}
            flexDirection="column"
            borderStyle="single"
            borderColor={borderColor}
            paddingX={1}
            marginBottom={1}
          >
            <Box marginBottom={expanded ? 1 : 0}>
              <Text bold color={borderColor}>
                Team: {displayTeamName}
              </Text>
              {!expanded ? (
                <Text color="gray">
                  {" "}
                  ({progress.completed}/{progress.total} complete)
                </Text>
              ) : null}
            </Box>
            {expanded
              ? team.members.map((member, index) => (
                  <TeamMemberRow key={`${team.id}-${index}`} member={member} />
                ))
              : null}
            {expanded ? (
              <Box marginTop={1}>
                <Text color="gray">
                  {progress.completed}/{progress.total} complete
                </Text>
              </Box>
            ) : null}
          </Box>
        );
      })}
    </Box>
  );
});
