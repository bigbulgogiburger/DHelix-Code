/**
 * TeammateStatus.tsx — 멀티 에이전트 팀 상태를 표시하는 컴포넌트 모음
 *
 * 멀티 에이전트 실행 시 팀원(에이전트)들의 상태를 시각적으로 보여줍니다.
 * 세 가지 수준의 표시를 제공합니다:
 *
 * 1. TeammateIndicator — 상태 바에 한 줄로 표시 "[Teams: 2 active | 5/8 members done]"
 * 2. TeammateDetailPanel — 팀별 멤버 행을 보여주는 상세 패널
 * 3. TeamMemberRow — 개별 멤버의 상태(아이콘, 이름, 경과시간) 표시
 *
 * 이 파일에는 타입 정의, 헬퍼 함수, 컴포넌트가 모두 포함되어 있습니다.
 */
import React, { useMemo } from "react";
import { Box, Text } from "ink";

// ─── 타입 정의 ───────────────────────────────────────────────────────────────

/** 표시용 팀 멤버 데이터 (간소화) */
export interface TeamMemberSummary {
  readonly name: string;
  readonly role: string;
  readonly status: string;
  readonly elapsed?: number; // milliseconds
}

/** 표시용 팀 세션 데이터 (간소화) */
export interface TeamSessionSummary {
  readonly id: string;
  readonly name: string;
  readonly status: string;
  readonly members: readonly TeamMemberSummary[];
  readonly createdAt: number;
  readonly completedAt?: number;
}

/** 상태 바에 표시되는 간략 팀 인디케이터의 Props */
export interface TeammateIndicatorProps {
  readonly teams: readonly TeamSessionSummary[];
}

/** 활동 피드 아래에 표시되는 상세 팀 패널의 Props */
export interface TeammateDetailPanelProps {
  readonly teams: readonly TeamSessionSummary[];
  readonly expanded?: boolean;
}

/** 개별 팀 멤버 행의 Props */
export interface TeamMemberRowProps {
  readonly member: TeamMemberSummary;
  readonly maxNameLength?: number;
}

// ─── 상수 정의 ───────────────────────────────────────────────────────────────

const MAX_DISPLAY_NAME_LENGTH = 20;
const MAX_TEAM_NAME_LENGTH = 40;

/** 팀 멤버 상태별 유니코드 아이콘 — ○ 대기, ◐ 실행 중, ● 완료, ✕ 실패, ⊘ 취소 */
const STATUS_ICONS: Record<string, string> = {
  pending: "\u25CB", // ○
  running: "\u25D0", // ◐
  completed: "\u25CF", // ●
  failed: "\u2715", // ✕
  cancelled: "\u2298", // ⊘
};

/** 팀 멤버 상태별 색상 — 대기=회색, 실행 중=노랑, 완료=초록, 실패=빨강, 취소=회색 */
const STATUS_COLORS: Record<string, string> = {
  pending: "gray",
  running: "yellow",
  completed: "green",
  failed: "red",
  cancelled: "gray",
};

// ─── 헬퍼 함수 ────────────────────────────────────────────────────────────

/** 멤버 상태에 해당하는 아이콘 문자를 반환 */
export function getStatusIcon(status: string): string {
  return STATUS_ICONS[status] ?? "?";
}

/** 멤버 상태에 해당하는 색상명을 반환 */
export function getStatusColor(status: string): string {
  return STATUS_COLORS[status] ?? "white";
}

/** 밀리초 단위 경과 시간을 사람이 읽기 쉬운 문자열로 변환 — "5s", "2m 30s", "1h 15m" */
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

/** 팀 진행률 계산 — 완료된 멤버 수 vs 전체 멤버 수 */
export function getTeamProgress(members: readonly TeamMemberSummary[]): {
  readonly completed: number;
  readonly total: number;
} {
  const completed = members.filter((m) => m.status === "completed").length;
  return { completed, total: members.length };
}

/** 활성 팀 수 계산 (완료/취소/실패가 아닌 팀만 카운트) */
export function countActiveTeams(teams: readonly TeamSessionSummary[]): number {
  return teams.filter((t) => t.status === "active" || t.status === "running").length;
}

/** 문자열을 최대 길이로 자르고, 초과 시 말줄임(…) 추가 */
export function truncateString(str: string, maxLength: number): string {
  if (str.length <= maxLength) {
    return str;
  }
  return str.slice(0, maxLength - 1) + "\u2026";
}

/** 모든 팀의 멤버 수를 합산하여 전체 완료/전체 수를 반환 */
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

// ─── 컴포넌트 ──────────────────────────────────────────────────────────────

/** 개별 팀 멤버 행 — 상태 아이콘, 이름, 상태 텍스트, 경과 시간을 한 줄로 표시 */
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
 * 상태 바용 간략 팀 인디케이터
 * 한 줄로 팀 요약을 표시: [Teams: N active | X/Y members done]
 * 팀이 없으면 null을 반환하여 표시하지 않습니다.
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
 * 상세 팀 패널 — 모든 팀과 멤버 상태를 표시
 *
 * 팀마다 테두리가 있는 박스로 표시하며, 내부에 멤버 행과 진행률을 보여줍니다.
 * 축소(expanded=false)시에는 팀 헤더와 진행률만 표시합니다.
 * 모든 멤버가 완료되면 테두리가 초록색, 아니면 노란색으로 변합니다.
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
