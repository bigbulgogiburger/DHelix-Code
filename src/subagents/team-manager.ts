/**
 * 에이전트 팀 매니저 — 여러 워커 에이전트로 구성된 팀을 생성하고 실행하는 오케스트레이터 모듈
 *
 * "팀"이란 공통 목표를 위해 협업하는 여러 서브에이전트의 그룹입니다.
 * 팀 매니저는 이 팀의 라이프사이클 전체를 관리합니다:
 *
 * 1. 팀 생성(createTeam): 멤버 정의, 의존성 설정, 동시성 제한
 * 2. 팀 실행(executeTeam): 의존성 인식 스케줄링(위상 정렬)으로 멤버 실행
 * 3. 실패 전파: 멤버 실패 시 의존하는 모든 후속 멤버 자동 취소
 * 4. 이벤트 알림: 멤버 시작/완료/실패, 팀 완료/실패 이벤트 발행
 *
 * 위상 정렬(Topological Sort)이란?
 * 의존 관계가 있는 작업들의 실행 순서를 결정하는 알고리즘입니다.
 * 예: A→B→D, A→C→D에서 실행 순서는 [A] → [B, C] → [D]가 됩니다.
 * 같은 레벨(예: B와 C)은 병렬로 실행할 수 있습니다.
 */

import { randomUUID } from "node:crypto";
import { BaseError } from "../utils/error.js";
import { createSharedAgentState, type SharedAgentState } from "./shared-state.js";
import {
  type TeamDefinition,
  type TeamSession,
  type TeamMember,
  type CreateTeamConfig,
  type TeamEvent,
  type TeamStatus,
  type MemberStatus,
} from "./team-types.js";

/** 팀 작업 중 발생하는 에러 클래스 */
export class TeamManagerError extends BaseError {
  constructor(message: string, context: Record<string, unknown> = {}) {
    super(message, "TEAM_MANAGER_ERROR", context);
  }
}

/**
 * 에이전트 실행 함수의 타입 정의
 *
 * 팀 매니저는 에이전트를 직접 실행하지 않고, 외부에서 주입된
 * 이 실행 함수를 통해 각 멤버를 실행합니다 (의존성 주입 패턴).
 *
 * @param member - 실행할 팀 멤버 정보
 * @param sharedState - 팀 내 에이전트 간 공유 상태
 * @returns 에이전트 ID와 응답 텍스트
 */
export type AgentExecutor = (
  member: TeamMember,
  sharedState: SharedAgentState,
) => Promise<{
  readonly agentId: string;
  readonly response: string;
}>;

/**
 * 내부용 가변(mutable) 팀 세션 — 상태 관리를 위한 구조
 *
 * 외부에 공개할 때는 toReadonlySession()으로 읽기 전용 버전으로 변환합니다.
 */
interface MutableTeamSession {
  readonly id: string;
  readonly definition: TeamDefinition;
  /** 팀의 현재 상태 (가변) */
  status: TeamStatus;
  /** 팀 멤버 목록 (멤버 상태 업데이트를 위해 가변) */
  members: TeamMember[];
  readonly createdAt: number;
  completedAt?: number;
  /** 멤버별 실행 결과 (멤버 ID → 결과 텍스트) */
  readonly results: Map<string, string>;
  /** 팀 내 에이전트 간 공유 상태 */
  readonly sharedState: SharedAgentState;
}

/**
 * 에이전트 팀 매니저 클래스
 *
 * 팀을 생성하고 실행하는 핵심 오케스트레이터입니다.
 * 멤버 간 의존 관계를 분석하여 위상 정렬(topological sort)로 실행 순서를 결정하고,
 * 동시성 제한(concurrency limit)을 적용하여 병렬 실행합니다.
 *
 * 멤버 실패 시 해당 멤버에 의존하는 모든 후속 멤버를 자동으로 취소합니다.
 */
export class AgentTeamManager {
  /** 활성 팀 세션 저장소 (팀 ID → 세션) */
  private readonly sessions = new Map<string, MutableTeamSession>();
  /** 이벤트 리스너 목록 — 팀 이벤트를 구독하는 콜백 함수들 */
  private readonly eventListeners: Array<(event: TeamEvent) => void> = [];

  /**
   * 설정으로부터 새로운 팀을 생성합니다.
   *
   * 멤버 설정의 dependsOn에 멤버 **이름**을 사용한 경우,
   * 자동으로 해당 멤버의 UUID로 변환합니다.
   * 이를 통해 ID를 모르는 상태에서도 이름으로 의존성을 지정할 수 있습니다.
   *
   * @param config - 팀 생성 설정 (이름, 목표, 멤버 목록, 동시성 제한)
   * @returns 생성된 팀 세션 (읽기 전용)
   * @throws TeamManagerError — 멤버가 0명일 때
   */
  createTeam(config: CreateTeamConfig): TeamSession {
    if (config.members.length === 0) {
      throw new TeamManagerError("Team must have at least one member", {
        teamName: config.name,
      });
    }

    // 1단계: 각 멤버에 UUID를 할당하고, 이름→ID 매핑 테이블 구성
    const nameToId = new Map<string, string>();
    const members: TeamMember[] = config.members.map((m) => {
      const id = randomUUID();
      nameToId.set(m.name, id);
      return {
        ...m,
        id,
        status: "pending" as MemberStatus,
      };
    });

    // 2단계: dependsOn에 이름이 사용된 경우 실제 ID로 변환
    for (let i = 0; i < members.length; i++) {
      const member = members[i];
      if (member.dependsOn && member.dependsOn.length > 0) {
        // 이름 → ID 변환 (매핑에 없으면 원래 값 유지 — 이미 ID일 수 있음)
        const resolvedDeps = member.dependsOn.map((dep) => nameToId.get(dep) ?? dep);
        members[i] = { ...member, dependsOn: resolvedDeps };
      }
    }

    // 팀 정의 객체 구성
    const definition: TeamDefinition = {
      name: config.name,
      description: config.description,
      objective: config.objective,
      members,
      maxConcurrency: config.maxConcurrency,
    };

    // 팀 세션 생성
    const session: MutableTeamSession = {
      id: randomUUID(),
      definition,
      status: "creating",
      members,
      createdAt: Date.now(),
      results: new Map(),
      sharedState: createSharedAgentState(), // 팀 전용 공유 상태 인스턴스 생성
    };

    this.sessions.set(session.id, session);
    this.emit({ type: "team:created", teamId: session.id });

    return this.toReadonlySession(session);
  }

  /**
   * 팀을 실행합니다 — 멤버들을 의존성과 동시성을 고려하여 실행합니다.
   *
   * 실행 흐름:
   * 1. 의존성 그래프 유효성 검증 (순환 참조 검사)
   * 2. 위상 정렬로 실행 레벨 결정
   * 3. 각 레벨의 멤버를 동시성 제한 내에서 병렬 실행
   * 4. 모든 멤버 완료 또는 실패 시 팀 상태 업데이트
   *
   * @param teamId - 실행할 팀의 세션 ID
   * @param executor - 각 멤버를 실행할 함수 (의존성 주입)
   * @param options - 추가 옵션 (AbortSignal 등)
   * @returns 실행 완료된 팀 세션 (읽기 전용)
   * @throws TeamManagerError — 팀을 찾을 수 없거나 실행 불가 상태일 때
   */
  async executeTeam(
    teamId: string,
    executor: AgentExecutor,
    options?: { readonly signal?: AbortSignal },
  ): Promise<TeamSession> {
    const session = this.sessions.get(teamId);
    if (!session) {
      throw new TeamManagerError("Team session not found", { teamId });
    }

    // "creating" 상태에서만 실행 가능
    if (session.status !== "creating") {
      throw new TeamManagerError("Team is not in a valid state for execution", {
        teamId,
        currentStatus: session.status,
      });
    }

    // 의존성 그래프 유효성 검증 (순환 참조, 존재하지 않는 의존성 검사)
    this.validateDependencies(session);

    session.status = "active";
    const signal = options?.signal;

    try {
      // 위상 정렬 순서에 따라 멤버 실행
      await this.runMembers(session, executor, signal);

      // 실행 결과 판정: 실패하거나 취소된 멤버가 있으면 팀 전체 실패
      const hasFailures = session.members.some(
        (m) => m.status === "failed" || m.status === "cancelled",
      );

      if (hasFailures) {
        session.status = "failed";
        session.completedAt = Date.now();
        const failedMembers = session.members
          .filter((m) => m.status === "failed")
          .map((m) => m.name);
        this.emit({
          type: "team:failed",
          teamId: session.id,
          error: `Members failed: ${failedMembers.join(", ")}`,
        });
      } else {
        session.status = "completed";
        session.completedAt = Date.now();
        this.emit({ type: "team:completed", teamId: session.id });
      }
    } catch (error) {
      session.status = "failed";
      session.completedAt = Date.now();
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.emit({ type: "team:failed", teamId: session.id, error: errorMessage });
    }

    return this.toReadonlySession(session);
  }

  /**
   * 팀 세션 ID로 팀 세션을 조회합니다.
   *
   * @param teamId - 팀 세션 ID
   * @returns 팀 세션 (읽기 전용), 없으면 undefined
   */
  getSession(teamId: string): TeamSession | undefined {
    const session = this.sessions.get(teamId);
    return session ? this.toReadonlySession(session) : undefined;
  }

  /**
   * 현재 활성 중인(creating 또는 active) 팀 세션 목록을 반환합니다.
   *
   * @returns 활성 팀 세션 배열 (읽기 전용)
   */
  getActiveSessions(): readonly TeamSession[] {
    const active: TeamSession[] = [];
    for (const session of this.sessions.values()) {
      if (session.status === "active" || session.status === "creating") {
        active.push(this.toReadonlySession(session));
      }
    }
    return active;
  }

  /**
   * 실행 중인 팀을 취소합니다.
   *
   * 모든 대기(pending) 및 실행 중(running) 멤버를 "cancelled"로 변경합니다.
   * 이미 완료되었거나 실패한 팀에는 영향을 주지 않습니다.
   *
   * @param teamId - 취소할 팀 세션 ID
   * @throws TeamManagerError — 팀을 찾을 수 없을 때
   */
  async cancelTeam(teamId: string): Promise<void> {
    const session = this.sessions.get(teamId);
    if (!session) {
      throw new TeamManagerError("Team session not found", { teamId });
    }

    // 이미 완료/실패 상태면 아무 작업도 하지 않음
    if (session.status !== "active" && session.status !== "creating") {
      return;
    }

    session.status = "completing";

    // 대기 중이거나 실행 중인 멤버를 모두 취소 (불변 업데이트)
    session.members = session.members.map((m) =>
      m.status === "pending" || m.status === "running"
        ? { ...m, status: "cancelled" as MemberStatus, completedAt: Date.now() }
        : m,
    );

    session.status = "failed";
    session.completedAt = Date.now();
    this.emit({ type: "team:failed", teamId: session.id, error: "Team cancelled" });
  }

  /**
   * 팀의 현재 상태 요약을 사람이 읽기 쉬운 텍스트로 반환합니다.
   *
   * @param teamId - 팀 세션 ID
   * @returns 요약 텍스트 (예: 'Team "분석팀" [active] | Members: 3 total | 1 completed | 2 running')
   */
  getTeamSummary(teamId: string): string {
    const session = this.sessions.get(teamId);
    if (!session) {
      return "Team not found";
    }

    // 각 상태별 멤버 수 집계
    const counts = {
      pending: 0,
      running: 0,
      completed: 0,
      failed: 0,
      cancelled: 0,
    };

    for (const member of session.members) {
      counts[member.status]++;
    }

    // 요약 텍스트 구성
    const parts = [
      `Team "${session.definition.name}" [${session.status}]`,
      `Members: ${session.members.length} total`,
    ];

    if (counts.completed > 0) {
      parts.push(`${counts.completed} completed`);
    }
    if (counts.running > 0) {
      parts.push(`${counts.running} running`);
    }
    if (counts.pending > 0) {
      parts.push(`${counts.pending} pending`);
    }
    if (counts.failed > 0) {
      parts.push(`${counts.failed} failed`);
    }
    if (counts.cancelled > 0) {
      parts.push(`${counts.cancelled} cancelled`);
    }

    return parts.join(" | ");
  }

  /**
   * 팀 이벤트 리스너를 등록합니다.
   *
   * @param listener - 이벤트 발생 시 호출될 콜백 함수
   * @returns 리스너 해제(unsubscribe) 함수 — 호출하면 리스너가 제거됨
   */
  onEvent(listener: (event: TeamEvent) => void): () => void {
    this.eventListeners.push(listener);
    // 해제 함수 반환 (클로저 패턴)
    return () => {
      const index = this.eventListeners.indexOf(listener);
      if (index >= 0) {
        this.eventListeners.splice(index, 1);
      }
    };
  }

  /**
   * 완료되거나 실패한 팀 세션을 정리(제거)합니다.
   *
   * 공유 상태의 메모리를 해제하고 세션을 삭제합니다.
   * 활성 세션(creating, active)은 건드리지 않습니다.
   */
  cleanup(): void {
    const toRemove: string[] = [];
    for (const [id, session] of this.sessions) {
      if (session.status === "completed" || session.status === "failed") {
        session.sharedState.cleanup(); // 공유 상태 메모리 해제
        toRemove.push(id);
      }
    }
    for (const id of toRemove) {
      this.sessions.delete(id);
    }
  }

  // ---------------------------------------------------------------------------
  // 내부 헬퍼 메서드
  // ---------------------------------------------------------------------------

  /**
   * 멤버를 의존성 인식 위상 정렬 순서로 실행합니다.
   *
   * 위상 정렬로 실행 레벨을 구성한 뒤,
   * 각 레벨의 멤버를 동시성 제한 내에서 병렬 실행합니다.
   * AbortSignal이 발동되면 나머지 대기 멤버를 취소합니다.
   *
   * @param session - 실행할 팀 세션
   * @param executor - 멤버 실행 함수
   * @param signal - 취소 시그널 (선택적)
   */
  private async runMembers(
    session: MutableTeamSession,
    executor: AgentExecutor,
    signal?: AbortSignal,
  ): Promise<void> {
    // 위상 정렬로 실행 순서 결정 — 각 레벨은 병렬 실행 가능
    const executionLevels = this.buildExecutionOrder(session.members);

    for (const level of executionLevels) {
      // 취소 시그널 확인
      if (signal?.aborted) {
        this.cancelPendingMembers(session);
        break;
      }

      // 현재 레벨에서 아직 대기 중인 멤버만 필터링
      const readyIds = new Set(level);
      const readyMembers = session.members.filter(
        (m) => readyIds.has(m.id) && m.status === "pending",
      );

      if (readyMembers.length === 0) {
        continue;
      }

      // 동시성 제한 적용 (기본값: 레벨의 모든 멤버를 동시에)
      const maxConcurrency = session.definition.maxConcurrency ?? readyMembers.length;
      await this.executeMembersWithConcurrency(
        session,
        readyMembers,
        maxConcurrency,
        executor,
        signal,
      );
    }
  }

  /**
   * 동시성 제한을 적용하여 멤버 배치를 실행합니다.
   *
   * 세마포어(semaphore) 패턴으로 동시 실행 수를 제한합니다:
   * - 큐에서 멤버를 꺼내 maxConcurrency까지 동시 실행
   * - 하나가 완료되면 다음 멤버를 큐에서 꺼내 실행
   * - 모든 멤버가 완료될 때까지 반복
   *
   * @param session - 팀 세션
   * @param members - 실행할 멤버 목록
   * @param maxConcurrency - 최대 동시 실행 수
   * @param executor - 멤버 실행 함수
   * @param signal - 취소 시그널
   */
  private async executeMembersWithConcurrency(
    session: MutableTeamSession,
    members: readonly TeamMember[],
    maxConcurrency: number,
    executor: AgentExecutor,
    signal?: AbortSignal,
  ): Promise<void> {
    const queue = [...members];
    const running = new Set<Promise<void>>();

    const runOne = async (member: TeamMember): Promise<void> => {
      await this.executeSingleMember(session, member, executor, signal);
    };

    // 큐가 비고 모든 실행이 완료될 때까지 반복
    while (queue.length > 0 || running.size > 0) {
      // 동시성 제한까지 멤버를 꺼내 실행
      while (queue.length > 0 && running.size < maxConcurrency) {
        // 취소 시그널 확인
        if (signal?.aborted) {
          this.cancelPendingMembers(session);
          // 이미 실행 중인 태스크가 완료될 때까지 대기
          if (running.size > 0) {
            await Promise.allSettled([...running]);
          }
          return;
        }

        const member = queue.shift()!;

        // 의존성 실패로 이미 취소된 멤버는 건너뜀
        if (member.status !== "pending") {
          continue;
        }

        // 실행 Promise를 생성하고 완료 시 running Set에서 제거
        const promise = runOne(member).finally(() => {
          running.delete(promise);
        });
        running.add(promise);
      }

      // 실행 중인 것 중 하나가 완료될 때까지 대기
      if (running.size > 0) {
        await Promise.race([...running]);
      }
    }
  }

  /**
   * 단일 팀 멤버를 실행합니다.
   *
   * 성공 시: 결과를 저장하고 "completed" 이벤트 발행
   * 실패 시: 에러를 기록하고 "failed" 이벤트 발행 후 의존 멤버 취소
   *
   * @param session - 팀 세션
   * @param member - 실행할 멤버
   * @param executor - 멤버 실행 함수
   * @param signal - 취소 시그널
   */
  private async executeSingleMember(
    session: MutableTeamSession,
    member: TeamMember,
    executor: AgentExecutor,
    signal?: AbortSignal,
  ): Promise<void> {
    // 실행 전 취소 확인
    if (signal?.aborted) {
      this.updateMemberStatus(session, member.id, {
        status: "cancelled",
        completedAt: Date.now(),
      });
      return;
    }

    // 멤버 상태를 "running"으로 변경
    this.updateMemberStatus(session, member.id, {
      status: "running",
      startedAt: Date.now(),
    });
    this.emit({ type: "team:member-started", teamId: session.id, memberId: member.id });

    try {
      // 실제 에이전트 실행 (외부 주입된 executor 사용)
      const executionResult = await executor(member, session.sharedState);

      // 성공: 상태 업데이트 및 결과 저장
      this.updateMemberStatus(session, member.id, {
        status: "completed",
        agentId: executionResult.agentId,
        result: executionResult.response,
        completedAt: Date.now(),
      });

      session.results.set(member.id, executionResult.response);

      this.emit({
        type: "team:member-completed",
        teamId: session.id,
        memberId: member.id,
        result: executionResult.response,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);

      // 실패: 상태 업데이트 및 에러 기록
      this.updateMemberStatus(session, member.id, {
        status: "failed",
        result: errorMessage,
        completedAt: Date.now(),
      });

      this.emit({
        type: "team:member-failed",
        teamId: session.id,
        memberId: member.id,
        error: errorMessage,
      });

      // 실패한 멤버에 의존하는 모든 후속 멤버를 전이적(transitive)으로 취소
      this.cancelDependents(session, member.id);
    }
  }

  /**
   * 의존성 기반 위상 정렬(Topological Sort)로 실행 순서를 결정합니다.
   *
   * 반환값은 2차원 배열(레벨 배열)입니다:
   * - 각 내부 배열은 "실행 레벨"로, 같은 레벨의 멤버는 병렬 실행 가능
   * - 레벨 N+1의 멤버는 레벨 N의 멤버에 의존합니다
   *
   * 알고리즘: Kahn's Algorithm (BFS 기반 위상 정렬)
   * 1. 각 노드의 진입 차수(in-degree) 계산
   * 2. 진입 차수 0인 노드를 첫 번째 레벨로
   * 3. 해당 노드의 간선 제거 후 새로 진입 차수 0이 된 노드를 다음 레벨로
   * 4. 모든 노드가 배치될 때까지 반복
   *
   * @param members - 팀 멤버 목록
   * @returns 실행 레벨 배열 (각 레벨은 멤버 ID 배열)
   */
  private buildExecutionOrder(members: readonly TeamMember[]): readonly string[][] {
    const memberMap = new Map(members.map((m) => [m.id, m]));
    // 각 멤버의 진입 차수 (의존하는 다른 멤버의 수)
    const inDegree = new Map<string, number>();
    // 각 멤버에 의존하는 후속 멤버 목록
    const dependents = new Map<string, string[]>();

    // 초기화: 모든 멤버의 진입 차수를 0으로, 후속 멤버 목록을 빈 배열로
    for (const member of members) {
      inDegree.set(member.id, 0);
      dependents.set(member.id, []);
    }

    // 인접 리스트(adjacency list) 구성
    for (const member of members) {
      if (member.dependsOn) {
        for (const depId of member.dependsOn) {
          if (memberMap.has(depId)) {
            // 의존하는 멤버가 있으면 진입 차수 증가
            inDegree.set(member.id, (inDegree.get(member.id) ?? 0) + 1);
            // 의존 대상의 후속 멤버 목록에 추가
            dependents.get(depId)!.push(member.id);
          }
        }
      }
    }

    // BFS로 레벨별 실행 순서 구성
    const levels: string[][] = [];
    // 진입 차수가 0인 멤버들이 첫 번째 레벨 (아무 의존성 없음)
    let currentLevel = members.filter((m) => (inDegree.get(m.id) ?? 0) === 0).map((m) => m.id);

    while (currentLevel.length > 0) {
      levels.push([...currentLevel]);

      // 현재 레벨의 멤버에 의존하는 후속 멤버의 진입 차수 감소
      const nextLevel: string[] = [];
      for (const id of currentLevel) {
        for (const depId of dependents.get(id) ?? []) {
          const newDegree = (inDegree.get(depId) ?? 1) - 1;
          inDegree.set(depId, newDegree);
          // 진입 차수가 0이 되면 다음 레벨로 추가
          if (newDegree === 0) {
            nextLevel.push(depId);
          }
        }
      }

      currentLevel = nextLevel;
    }

    return levels;
  }

  /**
   * 의존성 그래프의 유효성을 검증합니다.
   *
   * 검사 항목:
   * 1. 존재하지 않는 멤버에 대한 의존성 참조
   * 2. 자기 자신에 대한 의존성 (self-dependency)
   * 3. 순환 참조(circular dependency) — 위상 정렬 결과로 감지
   *
   * @param session - 검증할 팀 세션
   * @throws TeamManagerError — 유효하지 않은 의존성이 발견될 때
   */
  private validateDependencies(session: MutableTeamSession): void {
    const memberIds = new Set(session.members.map((m) => m.id));

    for (const member of session.members) {
      if (member.dependsOn) {
        for (const depId of member.dependsOn) {
          // 존재하지 않는 멤버에 대한 의존성 검사
          if (!memberIds.has(depId)) {
            throw new TeamManagerError("Member depends on non-existent member", {
              memberId: member.id,
              memberName: member.name,
              missingDependency: depId,
            });
          }
          // 자기 자신에 대한 의존성 검사
          if (depId === member.id) {
            throw new TeamManagerError("Member cannot depend on itself", {
              memberId: member.id,
              memberName: member.name,
            });
          }
        }
      }
    }

    // 순환 참조 검사: 위상 정렬 결과에 모든 멤버가 포함되는지 확인
    // 순환이 있으면 일부 멤버의 진입 차수가 0이 되지 않아 누락됨
    const levels = this.buildExecutionOrder(session.members);
    const scheduled = new Set(levels.flat());
    if (scheduled.size !== session.members.length) {
      throw new TeamManagerError("Circular dependency detected in team members", {
        teamId: session.id,
        scheduledCount: scheduled.size,
        totalMembers: session.members.length,
      });
    }
  }

  /**
   * 실패한 멤버에 의존하는 모든 후속 멤버를 전이적(transitive)으로 취소합니다.
   *
   * BFS(너비 우선 탐색)로 의존 체인을 따라가며
   * 대기(pending) 상태의 멤버를 "cancelled"로 변경합니다.
   *
   * @param session - 팀 세션
   * @param failedMemberId - 실패한 멤버의 ID
   */
  private cancelDependents(session: MutableTeamSession, failedMemberId: string): void {
    const toCancel = new Set<string>();
    const queue = [failedMemberId];

    // BFS로 의존 체인을 따라감
    while (queue.length > 0) {
      const currentId = queue.shift()!;
      for (const member of session.members) {
        if (
          member.dependsOn?.includes(currentId) &&
          member.status === "pending" &&
          !toCancel.has(member.id)
        ) {
          toCancel.add(member.id);
          queue.push(member.id); // 이 멤버에 의존하는 멤버도 탐색
        }
      }
    }

    // 찾은 모든 의존 멤버를 취소
    for (const memberId of toCancel) {
      this.updateMemberStatus(session, memberId, {
        status: "cancelled",
        completedAt: Date.now(),
      });
    }
  }

  /**
   * 모든 대기(pending) 상태 멤버를 취소합니다.
   * AbortSignal 발동 시 호출됩니다.
   */
  private cancelPendingMembers(session: MutableTeamSession): void {
    session.members = session.members.map((m) =>
      m.status === "pending"
        ? { ...m, status: "cancelled" as MemberStatus, completedAt: Date.now() }
        : m,
    );
  }

  /**
   * 팀 이벤트를 모든 등록된 리스너에게 발행합니다.
   *
   * @param event - 발행할 팀 이벤트
   */
  private emit(event: TeamEvent): void {
    for (const listener of this.eventListeners) {
      listener(event);
    }
  }

  /**
   * 멤버 상태를 불변(immutable) 패턴으로 업데이트합니다.
   *
   * 기존 멤버 객체를 수정하지 않고, 새 객체로 교체합니다.
   *
   * @param session - 팀 세션
   * @param memberId - 업데이트할 멤버 ID
   * @param updates - 변경할 필드
   */
  private updateMemberStatus(
    session: MutableTeamSession,
    memberId: string,
    updates: Partial<TeamMember>,
  ): void {
    session.members = session.members.map((m) => (m.id === memberId ? { ...m, ...updates } : m));
  }

  /**
   * 가변(mutable) 세션을 읽기 전용(readonly) TeamSession으로 변환합니다.
   *
   * 내부 상태를 외부에 노출할 때 불변 복사본을 반환하여
   * 외부에서 실수로 내부 상태를 수정하는 것을 방지합니다.
   *
   * @param session - 변환할 내부 세션
   * @returns 읽기 전용 팀 세션
   */
  private toReadonlySession(session: MutableTeamSession): TeamSession {
    return {
      id: session.id,
      definition: session.definition,
      status: session.status,
      members: [...session.members],
      createdAt: session.createdAt,
      completedAt: session.completedAt,
      results: new Map(session.results),
    };
  }
}
