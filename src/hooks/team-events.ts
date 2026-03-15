/**
 * 팀 이벤트 훅 — 에이전트 팀 매니저(Agent Team Manager)와 훅 시스템을 연결
 *
 * 에이전트 팀의 멤버가 작업을 완료하거나 실패할 때 훅 이벤트를 발행합니다.
 * 이를 통해 팀 작업의 진행 상황을 외부 시스템(웹훅, 알림 등)에 전달할 수 있습니다.
 *
 * 발행하는 훅 이벤트:
 * - TeammateIdle: 팀 멤버가 작업을 마쳤을 때 (완료 또는 실패)
 * - TaskCompleted: 팀 전체 작업이 완료되었을 때
 *
 * 에러 격리: 훅 실행 실패가 팀 실행을 절대 중단시키지 않습니다.
 *
 * @example
 * const emitter = createTeamHookEmitter({ hookRunner, sessionId, workingDirectory });
 * await emitter.emitTeammateIdle({ teamId: "t1", memberId: "m1", status: "completed", ... });
 */

import { type HookRunner } from "./runner.js";
import { type HookEventPayload, type HookRunResult } from "./types.js";
import { BaseError } from "../utils/error.js";

/** 팀 훅 작업 실패 시 발생하는 에러 */
export class TeamHookError extends BaseError {
  constructor(message: string, context: Record<string, unknown> = {}) {
    super(message, "TEAM_HOOK_ERROR", context);
  }
}

/**
 * 팀 이벤트 타입 — 에이전트 팀 매니저가 발행하는 이벤트들.
 *
 * TeamHookEmitter가 이 이벤트를 받아 적절한 훅 이벤트(TeammateIdle, TaskCompleted)로 변환합니다.
 *
 * - team:created — 팀이 생성됨
 * - team:member-started — 멤버가 작업을 시작함
 * - team:member-completed — 멤버가 작업을 완료함
 * - team:member-failed — 멤버가 작업에 실패함
 * - team:completed — 팀 전체 작업이 완료됨
 * - team:failed — 팀 전체 작업이 실패함
 */
export type TeamEvent =
  | { readonly type: "team:created"; readonly teamId: string; readonly teamName: string }
  | {
      readonly type: "team:member-started";
      readonly teamId: string;
      readonly memberId: string;
      readonly memberName: string;
    }
  | {
      readonly type: "team:member-completed";
      readonly teamId: string;
      readonly memberId: string;
      readonly memberName: string;
      readonly result?: string;
    }
  | {
      readonly type: "team:member-failed";
      readonly teamId: string;
      readonly memberId: string;
      readonly memberName: string;
      readonly error: string;
    }
  | {
      readonly type: "team:completed";
      readonly teamId: string;
      readonly results: Readonly<Record<string, string>>;
    }
  | { readonly type: "team:failed"; readonly teamId: string; readonly error: string };

/**
 * TeammateIdle 이벤트 데이터 — 팀 멤버가 유휴 상태가 될 때 전달되는 정보
 */
export interface TeammateIdleData {
  /** 팀 ID */
  readonly teamId: string;
  /** 팀 이름 */
  readonly teamName: string;
  /** 멤버 ID */
  readonly memberId: string;
  /** 멤버 이름 */
  readonly memberName: string;
  /** 멤버 역할 */
  readonly memberRole: string;
  /** 완료 상태: completed(완료), failed(실패), cancelled(취소) */
  readonly status: "completed" | "failed" | "cancelled";
  /** 작업 결과 (완료 시) */
  readonly result?: string;
  /** 에러 메시지 (실패 시) */
  readonly error?: string;
  /** 소요 시간 (밀리초) */
  readonly elapsedMs?: number;
  /** 아직 작업 중인 남은 멤버 수 */
  readonly remainingMembers: number;
  /** 팀 전체 멤버 수 */
  readonly totalMembers: number;
}

/**
 * TaskCompleted 이벤트 데이터 — 공유 작업이 완료될 때 전달되는 정보
 */
export interface TaskCompletedData {
  /** 작업 ID */
  readonly taskId: string;
  /** 작업 제목 */
  readonly taskTitle: string;
  /** 작업 우선순위 */
  readonly taskPriority: string;
  /** 담당자 */
  readonly assignedTo?: string;
  /** 작업 결과 */
  readonly result?: string;
  /** 소요 시간 (밀리초) */
  readonly elapsedMs?: number;
  /** 이 작업에 의존하는(종속되는) 작업 ID 목록 */
  readonly dependentTasks: readonly string[];
  /** 팀 ID */
  readonly teamId?: string;
}

/**
 * TeammateIdle 이벤트의 훅 페이로드를 구성합니다.
 *
 * @param data - TeammateIdle 이벤트 데이터
 * @param sessionId - 현재 세션 ID
 * @param workingDirectory - 작업 디렉토리 경로
 * @returns 훅 핸들러에 전달할 페이로드
 */
function buildTeammateIdlePayload(
  data: TeammateIdleData,
  sessionId: string,
  workingDirectory: string,
): HookEventPayload {
  return {
    event: "TeammateIdle",
    sessionId,
    workingDirectory,
    data: {
      teamId: data.teamId,
      teamName: data.teamName,
      memberId: data.memberId,
      memberName: data.memberName,
      memberRole: data.memberRole,
      status: data.status,
      result: data.result,
      error: data.error,
      elapsedMs: data.elapsedMs,
      remainingMembers: data.remainingMembers,
      totalMembers: data.totalMembers,
    },
  };
}

/**
 * TaskCompleted 이벤트의 훅 페이로드를 구성합니다.
 *
 * @param data - TaskCompleted 이벤트 데이터
 * @param sessionId - 현재 세션 ID
 * @param workingDirectory - 작업 디렉토리 경로
 * @returns 훅 핸들러에 전달할 페이로드
 */
function buildTaskCompletedPayload(
  data: TaskCompletedData,
  sessionId: string,
  workingDirectory: string,
): HookEventPayload {
  return {
    event: "TaskCompleted",
    sessionId,
    workingDirectory,
    data: {
      taskId: data.taskId,
      taskTitle: data.taskTitle,
      taskPriority: data.taskPriority,
      assignedTo: data.assignedTo,
      result: data.result,
      elapsedMs: data.elapsedMs,
      dependentTasks: [...data.dependentTasks],
      teamId: data.teamId,
    },
  };
}

/** TeamHookEmitter 생성 설정 */
export interface TeamHookEmitterConfig {
  /** 훅 러너 인스턴스 */
  readonly hookRunner: HookRunner;
  /** 현재 세션 ID */
  readonly sessionId: string;
  /** 작업 디렉토리 경로 */
  readonly workingDirectory: string;
}

/**
 * 에이전트 팀 매니저와 훅 시스템을 통합하는 이미터(emitter).
 *
 * 팀 멤버가 작업을 마치거나(TeammateIdle) 작업이 완료될 때(TaskCompleted)
 * 훅 이벤트를 발행합니다. 에러 격리를 제공하여 훅 실행 실패가
 * 팀 실행을 절대 중단시키지 않습니다.
 */
export class TeamHookEmitter {
  private readonly hookRunner: HookRunner;
  private readonly sessionId: string;
  private readonly workingDirectory: string;

  constructor(config: TeamHookEmitterConfig) {
    this.hookRunner = config.hookRunner;
    this.sessionId = config.sessionId;
    this.workingDirectory = config.workingDirectory;
  }

  /**
   * 팀 멤버가 작업을 마쳤을 때 TeammateIdle 훅 이벤트를 발행합니다.
   *
   * @param data - 멤버 유휴 상태 데이터
   * @returns 훅 실행 결과
   */
  async emitTeammateIdle(data: TeammateIdleData): Promise<HookRunResult> {
    const payload = buildTeammateIdlePayload(data, this.sessionId, this.workingDirectory);
    return this.hookRunner.run("TeammateIdle", payload);
  }

  /**
   * 공유 작업이 완료되었을 때 TaskCompleted 훅 이벤트를 발행합니다.
   *
   * @param data - 작업 완료 데이터
   * @returns 훅 실행 결과
   */
  async emitTaskCompleted(data: TaskCompletedData): Promise<HookRunResult> {
    const payload = buildTaskCompletedPayload(data, this.sessionId, this.workingDirectory);
    return this.hookRunner.run("TaskCompleted", payload);
  }

  /**
   * 팀 이벤트를 받아 적절한 훅 이벤트로 변환하여 발행합니다.
   *
   * 변환 규칙:
   * - team:member-completed → TeammateIdle (status: "completed")
   * - team:member-failed → TeammateIdle (status: "failed")
   * - team:created, team:member-started, team:completed, team:failed → 훅 발행 없음
   *
   * 에러는 조용히 삼켜집니다(swallowed) — 훅 실패가 팀 실행을 중단하면 안 됩니다.
   *
   * @param event - 팀 매니저로부터 받은 이벤트
   */
  async handleTeamEvent(event: TeamEvent): Promise<void> {
    try {
      switch (event.type) {
        case "team:member-completed": {
          await this.emitTeammateIdle({
            teamId: event.teamId,
            teamName: "",
            memberId: event.memberId,
            memberName: event.memberName,
            memberRole: "",
            status: "completed",
            result: event.result,
            remainingMembers: 0,
            totalMembers: 0,
          });
          break;
        }
        case "team:member-failed": {
          await this.emitTeammateIdle({
            teamId: event.teamId,
            teamName: "",
            memberId: event.memberId,
            memberName: event.memberName,
            memberRole: "",
            status: "failed",
            error: event.error,
            remainingMembers: 0,
            totalMembers: 0,
          });
          break;
        }
        case "team:created":
        case "team:member-started":
        case "team:completed":
        case "team:failed":
          // 이 이벤트 타입에 대해서는 훅을 발행하지 않음
          break;
      }
    } catch {
      // 에러를 조용히 삼킴 — 훅이 팀 실행을 절대 중단시키면 안 됨
    }
  }

  /**
   * 팀 관련 훅이 하나라도 설정되어 있는지 확인합니다.
   * @returns TeammateIdle 또는 TaskCompleted 훅이 있으면 true
   */
  hasTeamHooks(): boolean {
    return this.hasTeammateIdleHooks() || this.hasTaskCompletedHooks();
  }

  /** TeammateIdle 훅이 설정되어 있는지 확인합니다 */
  hasTeammateIdleHooks(): boolean {
    return this.hookRunner.hasHooks("TeammateIdle");
  }

  /** TaskCompleted 훅이 설정되어 있는지 확인합니다 */
  hasTaskCompletedHooks(): boolean {
    return this.hookRunner.hasHooks("TaskCompleted");
  }
}

/**
 * TeamHookEmitter를 생성하는 팩토리 함수.
 *
 * @param config - 이미터 설정 (hookRunner, sessionId, workingDirectory)
 * @returns 새로운 TeamHookEmitter 인스턴스
 */
export function createTeamHookEmitter(config: TeamHookEmitterConfig): TeamHookEmitter {
  return new TeamHookEmitter(config);
}

/**
 * TeamHookEmitter를 팀 매니저의 이벤트 콜백에 연결합니다.
 *
 * 남은 멤버 수를 자동으로 추적하며, 멤버 완료/실패 시 감소시킵니다.
 * AgentTeamManager의 onEvent 콜백으로 사용하기에 적합한 함수를 반환합니다.
 *
 * @param emitter - TeamHookEmitter 인스턴스
 * @param teamName - 팀 이름
 * @param totalMembers - 팀 전체 멤버 수
 * @returns 팀 이벤트를 처리하는 콜백 함수
 *
 * @example
 * const handler = createTeamEventHandler(emitter, "분석팀", 3);
 * teamManager.onEvent = handler; // 이벤트 발생 시 자동으로 훅 발행
 */
export function createTeamEventHandler(
  emitter: TeamHookEmitter,
  teamName: string,
  totalMembers: number,
): (event: TeamEvent) => Promise<void> {
  // 남은 멤버 수 추적 (멤버 완료/실패 시 1씩 감소)
  let remaining = totalMembers;

  return async (event: TeamEvent): Promise<void> => {
    try {
      switch (event.type) {
        case "team:member-completed": {
          // 남은 멤버 수 감소 (0 미만으로 내려가지 않도록 보호)
          remaining = Math.max(0, remaining - 1);
          await emitter.emitTeammateIdle({
            teamId: event.teamId,
            teamName,
            memberId: event.memberId,
            memberName: event.memberName,
            memberRole: "",
            status: "completed",
            result: event.result,
            remainingMembers: remaining,
            totalMembers,
          });
          break;
        }
        case "team:member-failed": {
          remaining = Math.max(0, remaining - 1);
          await emitter.emitTeammateIdle({
            teamId: event.teamId,
            teamName,
            memberId: event.memberId,
            memberName: event.memberName,
            memberRole: "",
            status: "failed",
            error: event.error,
            remainingMembers: remaining,
            totalMembers,
          });
          break;
        }
        case "team:completed": {
          // 팀 전체 완료 → TaskCompleted 훅 발행
          await emitter.emitTaskCompleted({
            taskId: `team-${event.teamId}`,
            taskTitle: `Team ${teamName} completed`,
            taskPriority: "high",
            result: JSON.stringify(event.results),
            dependentTasks: [],
            teamId: event.teamId,
          });
          break;
        }
        case "team:created":
        case "team:member-started":
        case "team:failed":
          // 이 이벤트 타입에 대해서는 훅을 발행하지 않음
          break;
      }
    } catch {
      // 에러를 조용히 삼킴 — 훅이 팀 실행을 절대 중단시키면 안 됨
    }
  };
}
