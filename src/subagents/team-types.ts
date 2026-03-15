/**
 * 에이전트 팀 시스템 타입 정의 — 팀 기반 멀티에이전트 협업의 데이터 구조 모듈
 *
 * "팀 리더(Team Lead)" 에이전트가 여러 "워커(Worker)" 에이전트로 구성된 팀을
 * 생성하고 관리하여 복잡한 작업을 의존성 인식 스케줄링으로 협업 수행합니다.
 *
 * 이 모듈은 팀 시스템에서 사용하는 모든 타입과 인터페이스를 정의합니다:
 * - TeamStatus: 팀의 라이프사이클 상태
 * - MemberStatus: 개별 멤버의 실행 상태
 * - TeamMember: 팀 멤버 정보
 * - TeamDefinition: 팀 구성 정의
 * - TeamSession: 실행 중인 팀의 상태
 * - CreateTeamConfig: 팀 생성 설정
 * - TeamEvent: 팀 이벤트 (이벤트 기반 알림용)
 */

/**
 * 팀의 라이프사이클 상태
 *
 * creating → active → completing → completed
 *                   → failed
 *
 * - creating: 팀이 생성되었지만 아직 실행 시작 전
 * - active: 멤버들이 실행 중
 * - completing: 마무리 단계 (취소 처리 등)
 * - completed: 모든 멤버가 성공적으로 완료
 * - failed: 하나 이상의 멤버가 실패하거나 팀이 취소됨
 */
export type TeamStatus = "creating" | "active" | "completing" | "completed" | "failed";

/**
 * 팀 멤버의 실행 상태
 *
 * pending → running → completed
 *                   → failed
 *                   → cancelled (의존 멤버 실패 또는 팀 취소 시)
 */
export type MemberStatus = "pending" | "running" | "completed" | "failed" | "cancelled";

/**
 * 팀 멤버 정의 — 팀 내 개별 에이전트의 역할과 상태 정보
 *
 * 각 멤버는 고유한 역할(role)과 유형(type)을 가지며,
 * dependsOn으로 다른 멤버에 대한 의존성을 선언할 수 있습니다.
 */
export interface TeamMember {
  /** 멤버 고유 식별자 (UUID) */
  readonly id: string;
  /** 멤버 이름 (사람이 읽기 쉬운 식별자, 예: "코드 분석가") */
  readonly name: string;
  /** 멤버의 역할 설명 (예: "프론트엔드 코드를 분석합니다") */
  readonly role: string;
  /** 서브에이전트 유형 (예: "explore", "general") */
  readonly type: string;
  /** 이 멤버에게 전달할 작업 지시(프롬프트) */
  readonly prompt: string;
  /** 현재 실행 상태 */
  readonly status: MemberStatus;
  /** 할당된 서브에이전트의 ID (생성(spawn) 시 부여됨) */
  readonly agentId?: string;
  /** 실행 결과 텍스트 (완료 또는 실패 시) */
  readonly result?: string;
  /** 실행 시작 시각 (Unix 타임스탬프, 밀리초) */
  readonly startedAt?: number;
  /** 실행 완료 시각 */
  readonly completedAt?: number;
  /** 이 멤버가 의존하는 다른 멤버들의 ID 목록 (이 멤버들이 완료되어야 시작) */
  readonly dependsOn?: readonly string[];
}

/**
 * 팀 정의 — 팀의 구성과 목표를 나타내는 불변 객체
 */
export interface TeamDefinition {
  /** 팀 이름 (예: "보안 분석팀") */
  readonly name: string;
  /** 팀 설명 */
  readonly description: string;
  /** 팀의 최종 목표 */
  readonly objective: string;
  /** 팀 멤버 목록 */
  readonly members: readonly TeamMember[];
  /** 최대 동시 실행 멤버 수 (기본값: 전체 멤버를 동시에) */
  readonly maxConcurrency?: number;
}

/**
 * 팀 세션 — 실행 중인 팀의 현재 상태를 나타내는 읽기 전용 스냅샷
 *
 * team-manager가 내부적으로 가변 상태를 관리하고,
 * 외부에는 이 읽기 전용 인터페이스를 통해 상태를 노출합니다.
 */
export interface TeamSession {
  /** 세션 고유 식별자 (UUID) */
  readonly id: string;
  /** 팀 정의 (구성 정보) */
  readonly definition: TeamDefinition;
  /** 현재 팀 상태 */
  readonly status: TeamStatus;
  /** 현재 멤버들의 상태 스냅샷 */
  readonly members: readonly TeamMember[];
  /** 세션 생성 시각 */
  readonly createdAt: number;
  /** 세션 완료 시각 (완료 또는 실패 시) */
  readonly completedAt?: number;
  /** 멤버별 실행 결과 (멤버 ID → 결과 텍스트) */
  readonly results: ReadonlyMap<string, string>;
}

/**
 * 팀 생성 설정 — createTeam()에 전달하는 입력 데이터
 *
 * members에서 id와 status는 자동으로 할당되므로 Omit으로 제외합니다.
 */
export interface CreateTeamConfig {
  /** 팀 이름 */
  readonly name: string;
  /** 팀 설명 */
  readonly description: string;
  /** 팀의 최종 목표 */
  readonly objective: string;
  /** 멤버 설정 목록 (id와 status는 자동 생성되므로 제외) */
  readonly members: readonly Omit<TeamMember, "id" | "status">[];
  /** 최대 동시 실행 멤버 수 */
  readonly maxConcurrency?: number;
}

/**
 * 팀 이벤트 — 팀의 라이프사이클 중 발생하는 이벤트를 나타내는 유니온 타입
 *
 * TypeScript의 구별된 유니온(Discriminated Union) 패턴을 사용합니다.
 * type 필드의 값으로 어떤 이벤트인지 구별하고,
 * 그에 따라 어떤 추가 필드가 있는지 타입 시스템이 보장합니다.
 *
 * 이벤트 흐름:
 * team:created → team:member-started → team:member-completed (또는 team:member-failed)
 *             → team:completed (또는 team:failed)
 */
export type TeamEvent =
  /** 팀이 생성됨 */
  | { readonly type: "team:created"; readonly teamId: string }
  /** 팀 멤버가 실행을 시작함 */
  | { readonly type: "team:member-started"; readonly teamId: string; readonly memberId: string }
  /** 팀 멤버가 성공적으로 완료됨 */
  | {
      readonly type: "team:member-completed";
      readonly teamId: string;
      readonly memberId: string;
      readonly result: string;
    }
  /** 팀 멤버가 실패함 */
  | {
      readonly type: "team:member-failed";
      readonly teamId: string;
      readonly memberId: string;
      readonly error: string;
    }
  /** 팀 전체가 성공적으로 완료됨 */
  | { readonly type: "team:completed"; readonly teamId: string }
  /** 팀 전체가 실패함 (하나 이상의 멤버 실패 또는 취소) */
  | { readonly type: "team:failed"; readonly teamId: string; readonly error: string };
