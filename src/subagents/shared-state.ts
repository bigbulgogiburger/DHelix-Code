/**
 * 공유 상태(Shared State) — 서브에이전트 간 통신과 데이터 공유를 위한 모듈
 *
 * 여러 서브에이전트가 병렬로 실행될 때, 서로 데이터를 주고받거나
 * 작업 진행 상황을 공유해야 할 수 있습니다.
 *
 * 이 모듈은 세 가지 통신 메커니즘을 제공합니다:
 * 1. 키-값 저장소(Key-Value Store): 에이전트 간 데이터 공유
 *    예: agent A가 set("분석결과", data)하면 agent B가 get("분석결과")으로 읽음
 *
 * 2. 메시지 큐(Message Queue): 에이전트 간 메시지 전달
 *    예: agent A가 agent B에게 "파일 분석 완료" 메시지를 보냄
 *    또는 모든 에이전트에게 브로드캐스트(전체 알림)
 *
 * 3. 진행도 추적(Progress Tracking): 각 에이전트의 작업 진행률 모니터링
 *    예: agent A가 0.5 (50%) 진행, agent B가 0.8 (80%) 진행
 *
 * 모든 자료구조는 동기적(synchronous) Map 기반으로,
 * Node.js의 단일 스레드 환경에서 Promise 인터리빙에 안전합니다.
 */
import { BaseError } from "../utils/error.js";

/** 공유 상태 작업 중 발생하는 에러 클래스 */
export class SharedStateError extends BaseError {
  constructor(message: string, context: Record<string, unknown> = {}) {
    super(message, "SHARED_STATE_ERROR", context);
  }
}

/** 메시지 큐에 보관할 최대 메시지 수 — 메모리 과다 사용 방지 */
const MAX_MESSAGE_QUEUE_SIZE = 200;

/**
 * 에이전트 간에 교환되는 메시지 구조
 *
 * 한 에이전트가 다른 에이전트(또는 모든 에이전트)에게 보내는 메시지입니다.
 * toAgentId가 undefined이면 브로드캐스트(모든 에이전트에게 전달)입니다.
 */
export interface AgentMessage {
  /** 메시지를 보낸 에이전트의 고유 ID */
  readonly fromAgentId: string;
  /** 수신 에이전트 ID. undefined이면 모든 에이전트에게 브로드캐스트 */
  readonly toAgentId?: string;
  /**
   * 메시지 유형:
   * - result: 작업 결과 전달
   * - progress: 진행 상황 업데이트
   * - request: 다른 에이전트에게 요청
   * - error: 에러 알림
   */
  readonly type: "result" | "progress" | "request" | "error";
  /** 메시지 내용 (텍스트) */
  readonly content: string;
  /** 메시지 생성 시각 (Unix 타임스탬프, 밀리초) */
  readonly timestamp: number;
}

/**
 * 개별 에이전트의 진행 상태 정보
 *
 * progress는 0.0(시작)에서 1.0(완료) 사이의 값입니다.
 */
export interface AgentProgress {
  /** 진행률 (0.0 ~ 1.0, 예: 0.5 = 50%) */
  readonly progress: number;
  /** 현재 상태 설명 (예: "파일 분석 중", "완료") */
  readonly status: string;
}

/**
 * 에이전트 간 통신을 위한 공유 상태 인터페이스
 *
 * 이 인터페이스를 통해 서브에이전트들이 서로 데이터를 공유하고,
 * 메시지를 주고받고, 진행 상황을 보고할 수 있습니다.
 */
export interface SharedAgentState {
  // ── 키-값 저장소 (에이전트 간 데이터 공유) ──────────────────────
  /** 키-값 쌍을 저장합니다 */
  set(key: string, value: unknown): void;
  /** 키로 값을 조회합니다 */
  get(key: string): unknown | undefined;
  /** 모든 키-값 쌍을 읽기 전용 Map으로 반환합니다 */
  getAll(): ReadonlyMap<string, unknown>;

  // ── 에이전트 간 메시징 ──────────────────────────────────────────
  /** 메시지를 보냅니다 (특정 에이전트 또는 브로드캐스트) */
  send(message: AgentMessage): void;
  /** 특정 에이전트에게 온 메시지 + 브로드캐스트 메시지를 조회합니다 */
  getMessages(agentId: string): readonly AgentMessage[];
  /** 모든 브로드캐스트 메시지를 조회합니다 */
  getBroadcasts(): readonly AgentMessage[];

  // ── 진행도 추적 ────────────────────────────────────────────────
  /** 에이전트의 진행 상황을 보고합니다 */
  reportProgress(agentId: string, progress: number, status: string): void;
  /** 모든 에이전트의 진행 상황을 조회합니다 */
  getProgress(): ReadonlyMap<string, AgentProgress>;

  // ── 라이프사이클 ──────────────────────────────────────────────
  /** 모든 공유 상태를 초기화(제거)합니다 */
  cleanup(): void;
}

/**
 * SharedAgentState의 구현 클래스
 *
 * 경계가 있는(bounded) 키-값 저장소, 경계가 있는 메시지 큐,
 * 에이전트별 진행도 추적을 제공합니다.
 *
 * 모든 자료구조는 동기적 Map 기반으로,
 * Node.js의 단일 스레드 Promise 인터리빙에서 안전합니다.
 * (멀티스레드 환경이 아니므로 락(lock)이 필요 없습니다)
 */
export class SharedAgentStateImpl implements SharedAgentState {
  /** 키-값 저장소 */
  private readonly store = new Map<string, unknown>();
  /** 메시지 큐 (최대 MAX_MESSAGE_QUEUE_SIZE개 보관) */
  private readonly messages: AgentMessage[] = [];
  /** 에이전트별 진행 상태 */
  private readonly progressMap = new Map<string, AgentProgress>();

  // ── 키-값 저장소 메서드 ──────────────────────────────────────

  /** 키-값 쌍을 저장합니다 */
  set(key: string, value: unknown): void {
    this.store.set(key, value);
  }

  /** 키로 값을 조회합니다. 없으면 undefined 반환 */
  get(key: string): unknown | undefined {
    return this.store.get(key);
  }

  /** 모든 키-값 쌍을 읽기 전용 Map으로 반환합니다 */
  getAll(): ReadonlyMap<string, unknown> {
    return this.store;
  }

  // ── 에이전트 간 메시징 메서드 ──────────────────────────────────

  /**
   * 메시지를 큐에 추가합니다.
   * 큐가 최대 크기(200)를 초과하면 가장 오래된 메시지부터 제거합니다.
   */
  send(message: AgentMessage): void {
    this.messages.push(message);

    // 큐 크기 제한 초과 시 가장 오래된 메시지 제거 (FIFO)
    if (this.messages.length > MAX_MESSAGE_QUEUE_SIZE) {
      const excess = this.messages.length - MAX_MESSAGE_QUEUE_SIZE;
      this.messages.splice(0, excess);
    }
  }

  /**
   * 특정 에이전트에게 전달된 메시지와 브로드캐스트 메시지를 모두 반환합니다.
   *
   * @param agentId - 수신 에이전트의 고유 ID
   * @returns 해당 에이전트가 받아야 할 모든 메시지 배열
   */
  getMessages(agentId: string): readonly AgentMessage[] {
    return this.messages.filter((m) => m.toAgentId === agentId || m.toAgentId === undefined);
  }

  /**
   * 모든 브로드캐스트 메시지(toAgentId가 undefined인 메시지)를 반환합니다.
   */
  getBroadcasts(): readonly AgentMessage[] {
    return this.messages.filter((m) => m.toAgentId === undefined);
  }

  // ── 진행도 추적 메서드 ────────────────────────────────────────

  /**
   * 에이전트의 진행 상황을 기록합니다.
   * progress 값은 0~1 범위로 클램핑(제한)됩니다.
   *
   * @param agentId - 에이전트 고유 ID
   * @param progress - 진행률 (0.0 ~ 1.0)
   * @param status - 현재 상태 설명 텍스트
   */
  reportProgress(agentId: string, progress: number, status: string): void {
    // Math.max/min으로 0~1 범위를 벗어나지 않도록 클램핑
    const clamped = Math.max(0, Math.min(1, progress));
    this.progressMap.set(agentId, { progress: clamped, status });
  }

  /** 모든 에이전트의 진행 상황을 읽기 전용 Map으로 반환합니다 */
  getProgress(): ReadonlyMap<string, AgentProgress> {
    return this.progressMap;
  }

  // ── 라이프사이클 메서드 ──────────────────────────────────────

  /** 모든 공유 상태, 메시지, 진행 추적 데이터를 초기화합니다 */
  cleanup(): void {
    this.store.clear();
    this.messages.length = 0; // 배열을 비우는 효율적인 방법
    this.progressMap.clear();
  }
}

/**
 * 새로운 SharedAgentState 인스턴스를 생성하는 팩토리 함수
 *
 * 팩토리 패턴을 사용하여 구현 클래스를 직접 노출하지 않고,
 * 인터페이스를 통해 사용할 수 있도록 합니다.
 *
 * @returns SharedAgentState 인터페이스를 구현하는 새 인스턴스
 */
export function createSharedAgentState(): SharedAgentState {
  return new SharedAgentStateImpl();
}
