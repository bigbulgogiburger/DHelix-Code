/**
 * /team 명령어 핸들러 — 에이전트 팀 관리 (생성, 상태, 취소, 목록)
 *
 * 에이전트 팀(Agent Team)이란? 여러 AI 에이전트를 동시에(병렬로)
 * 실행하여 복잡한 작업을 분담하는 기능입니다.
 *
 * 예를 들어, "보안 분석", "성능 리뷰", "타입 검사"를 각각 다른
 * 에이전트에게 병렬로 맡겨 전체 작업 시간을 단축할 수 있습니다.
 *
 * 주요 서브커맨드:
 *   /team create <이름>   — 새 팀 생성
 *   /team status [ID]     — 팀 상태 조회 (전체 또는 특정 팀)
 *   /team cancel <ID>     — 실행 중인 팀 취소
 *   /team list             — 모든 팀 목록 (활성 + 완료)
 *   /team summary <ID>    — 팀 상세 요약
 *   /team help             — 사용법 안내
 *
 * 이 파일은 팩토리 패턴(createTeamCommand)을 사용하여
 * AgentTeamManager 의존성을 주입받습니다.
 */
import { type SlashCommand, type CommandResult, type CommandContext } from "./registry.js";
import { BaseError } from "../utils/error.js";

/** /team 명령어에서 발생하는 에러 클래스 */
export class TeamCommandError extends BaseError {
  constructor(message: string, context: Record<string, unknown> = {}) {
    super(message, "TEAM_COMMAND_ERROR", context);
  }
}

/** 팀 상태 타입 — 팀의 생명주기를 나타냄 */
type TeamStatus = "creating" | "active" | "completing" | "completed" | "failed";

/** 멤버 상태 타입 — 개별 팀원(에이전트)의 실행 상태 */
type MemberStatus = "pending" | "running" | "completed" | "failed" | "cancelled";

/**
 * 단일 팀 멤버(에이전트) 인터페이스
 *
 * @property id - 멤버 고유 ID
 * @property name - 멤버 이름 (예: "보안 분석가")
 * @property role - 역할 설명
 * @property type - 에이전트 타입
 * @property prompt - 에이전트에게 전달할 프롬프트
 * @property status - 현재 실행 상태
 * @property dependsOn - 이 멤버가 의존하는 다른 멤버의 ID 배열
 */
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

/** 팀 세션 인터페이스 — 팀의 전체 정보를 담는 구조체 */
interface TeamSession {
  readonly id: string;
  readonly name: string;
  readonly status: TeamStatus;
  readonly members: readonly TeamMember[];
  readonly createdAt: number;
  readonly completedAt?: number;
}

/** 팀 생성 설정 인터페이스 — 팀 이름과 멤버 구성 */
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

/** 팀 실행 결과 인터페이스 — 팀 전체와 각 멤버의 실행 결과 */
interface TeamResult {
  readonly teamId: string;
  readonly status: TeamStatus;
  readonly memberResults: readonly {
    readonly memberId: string;
    readonly status: MemberStatus;
    readonly result?: string;
  }[];
}

/**
 * AgentTeamManager 의존성 인터페이스
 *
 * /team 명령어가 팀을 관리하기 위해 필요한 메서드를 정의합니다.
 * 팩토리 함수(createTeamCommand)에서 이 인터페이스의 구현체를 주입받습니다.
 */
export interface AgentTeamManager {
  createTeam(config: TeamConfig): Promise<TeamSession>;
  executeTeam(teamId: string): Promise<TeamResult>;
  cancelTeam(teamId: string): Promise<void>;
  getTeamStatus(teamId: string): TeamSession | undefined;
  getActiveTeams(): TeamSession[];
  getTeamSummary(teamId: string): string;
  cleanup(): void;
}

/** 멤버 상태별 표시 아이콘 — 터미널에서 시각적으로 상태를 구분 */
const MEMBER_STATUS_ICONS: Readonly<Record<MemberStatus, string>> = {
  pending: "\u25CB",
  running: "\u25D0",
  completed: "\u25CF",
  failed: "\u2715",
  cancelled: "\u2298",
};

/**
 * 시작부터 종료까지의 경과 시간을 포맷하는 함수
 *
 * 종료 시간이 없으면 현재 시각까지의 경과 시간을 계산합니다 (실행 중인 경우).
 *
 * @param startMs - 시작 시각 (밀리초 타임스탬프)
 * @param endMs - 종료 시각 (선택적, 없으면 Date.now() 사용)
 * @returns 포맷된 경과 시간 문자열 (예: "12s", "2m", "1h 3m")
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
 * 타임스탬프를 상대 시간으로 포맷하는 함수
 *
 * @param ms - 타임스탬프 (밀리초)
 * @returns 상대 시간 문자열 (예: "2m ago", "1h ago", "3d ago")
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
 * 단일 팀 멤버의 상태를 한 줄로 포맷하는 함수
 *
 * 아이콘, 이름, 상태, 경과 시간 또는 에러 메시지를 포함합니다.
 *
 * @param member - 팀 멤버 객체
 * @returns 포맷된 상태 라인 (예: "  ● reviewer    completed  (12s)")
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
 * /team list 서브커맨드를 위한 팀 테이블 포맷 함수
 *
 * ID, 이름, 상태, 멤버 진행률, 생성 시각을 테이블로 포맷합니다.
 *
 * @param teams - 팀 세션 배열
 * @returns 테이블 형태의 문자열 (팀이 없으면 "No teams found.")
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
 * /team help 핸들러 — 사용법 안내 표시
 *
 * @returns 도움말 텍스트와 성공 여부
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
 * /team create <name> 핸들러 — 새 팀 생성
 *
 * 팀을 생성하고 shouldInjectAsUserMessage로 LLM에게
 * 팀 멤버 구성을 안내하는 프롬프트를 주입합니다.
 *
 * @param nameArg - 팀 이름 (따옴표 제거 처리)
 * @param teamManager - 팀 관리 객체
 * @param _context - 명령어 컨텍스트
 * @returns 생성 결과
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
 * /team status [id] 핸들러 — 팀 상태 표시
 *
 * ID를 지정하면 해당 팀의 상세 상태를, 생략하면 모든 활성 팀을 표시합니다.
 *
 * @param idArg - 팀 ID (선택적)
 * @param teamManager - 팀 관리 객체
 * @returns 상태 텍스트와 성공 여부
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
 * /team cancel <id> 핸들러 — 실행 중인 팀 취소
 *
 * 이미 완료/실패한 팀은 취소할 수 없습니다.
 * 취소 시 running/pending 상태의 멤버 목록을 보여줍니다.
 *
 * @param idArg - 취소할 팀 ID
 * @param teamManager - 팀 관리 객체
 * @returns 취소 결과
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
 * /team list 핸들러 — 모든 팀 목록 테이블 표시
 *
 * @param teamManager - 팀 관리 객체
 * @returns 팀 목록 테이블과 성공 여부
 */
function handleList(teamManager: AgentTeamManager): CommandResult {
  const teams = teamManager.getActiveTeams();
  const output = formatTeamTable(teams);
  return { output, success: true };
}

/**
 * /team summary <id> 핸들러 — 팀 상세 요약 표시
 *
 * @param idArg - 요약을 볼 팀 ID
 * @param teamManager - 팀 관리 객체
 * @returns 요약 텍스트와 성공 여부
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
 * /team 슬래시 명령어를 생성하는 팩토리 함수
 *
 * AgentTeamManager 의존성을 인자로 받아 명령어를 생성합니다.
 * 팩토리 패턴을 사용하여 등록 시점에 의존성을 주입하고
 * 강한 결합(tight coupling)을 방지합니다.
 *
 * @param teamManager - 팀 관리 기능을 제공하는 객체
 * @returns /team 슬래시 명령어 객체
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
