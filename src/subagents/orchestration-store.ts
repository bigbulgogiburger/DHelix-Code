/**
 * 오케스트레이션 이벤트 스토어 — 멀티에이전트 실행 이력을 인메모리로 관리하는 모듈
 *
 * AgentTeamManager 등 오케스트레이터에서 발생하는 모든 에이전트 관련 이벤트를
 * 시간 순서대로 저장하고, 다양한 필터로 조회할 수 있는 이벤트 소싱(Event Sourcing) 패턴 구현체.
 *
 * 주요 기능:
 * - 에이전트 스폰/완료/실패, 메시지 송수신, 쿼터 소비, 모델 전환 이벤트 저장
 * - 타임스탬프 범위, 에이전트 ID, 이벤트 유형 기반 필터 조회
 * - 에이전트별 타임라인 조회
 * - 비용/토큰 집계 요약
 * - JSON Lines 형식으로 내보내기 (나중에 SQLite/파일 확장 가능)
 *
 * @example
 * ```ts
 * const store = new OrchestrationEventStore();
 * store.append({ type: "agent-spawned", agentId: "agent-1", timestamp: Date.now() });
 * const timeline = store.getAgentTimeline("agent-1");
 * const cost = store.getCostSummary();
 * ```
 */

import { randomUUID } from "node:crypto";

// ---------------------------------------------------------------------------
// 이벤트 유니온 타입
// ---------------------------------------------------------------------------

/**
 * 에이전트가 새로 생성(스폰)됨
 *
 * @property agentId - 새로 생성된 에이전트 ID
 * @property parentId - 부모 에이전트 ID (최상위 에이전트는 undefined)
 * @property timestamp - 이벤트 발생 시각 (Unix ms)
 */
export type AgentSpawnedEvent = {
  readonly type: "agent-spawned";
  readonly agentId: string;
  readonly parentId?: string;
  readonly timestamp: number;
};

/**
 * 에이전트가 성공적으로 완료됨
 *
 * @property agentId - 완료된 에이전트 ID
 * @property duration - 에이전트 실행 소요 시간 (ms)
 * @property timestamp - 이벤트 발생 시각 (Unix ms)
 */
export type AgentCompletedEvent = {
  readonly type: "agent-completed";
  readonly agentId: string;
  readonly duration: number;
  readonly timestamp: number;
};

/**
 * 에이전트가 에러로 실패함
 *
 * @property agentId - 실패한 에이전트 ID
 * @property error - 에러 메시지
 * @property retryable - 재시도 가능 여부
 * @property timestamp - 이벤트 발생 시각 (Unix ms)
 */
export type AgentFailedEvent = {
  readonly type: "agent-failed";
  readonly agentId: string;
  readonly error: string;
  readonly retryable: boolean;
  readonly timestamp: number;
};

/**
 * 에이전트 간 메시지가 전송됨
 *
 * @property fromAgentId - 송신 에이전트 ID
 * @property toAgentId - 수신 에이전트 ID
 * @property topic - 메시지 주제
 * @property timestamp - 이벤트 발생 시각 (Unix ms)
 */
export type MessageSentEvent = {
  readonly type: "message-sent";
  readonly fromAgentId: string;
  readonly toAgentId: string;
  readonly topic: string;
  readonly timestamp: number;
};

/**
 * 에이전트가 토큰/비용을 소비함
 *
 * @property agentId - 소비한 에이전트 ID
 * @property tokens - 소비된 토큰 수
 * @property cost - 소비된 비용 (USD)
 * @property timestamp - 이벤트 발생 시각 (Unix ms)
 */
export type QuotaConsumedEvent = {
  readonly type: "quota-consumed";
  readonly agentId: string;
  readonly tokens: number;
  readonly cost: number;
  readonly timestamp: number;
};

/**
 * 사용 모델이 전환됨
 *
 * @property fromModel - 이전 모델 이름
 * @property toModel - 새 모델 이름
 * @property trigger - 전환 트리거 사유 (예: "cost-threshold", "task-complexity")
 * @property timestamp - 이벤트 발생 시각 (Unix ms)
 */
export type ModelSwitchedEvent = {
  readonly type: "model-switched";
  readonly fromModel: string;
  readonly toModel: string;
  readonly trigger: string;
  readonly timestamp: number;
};

/** 오케스트레이션 이벤트 유니온 타입 */
export type OrchestratedEvent =
  | AgentSpawnedEvent
  | AgentCompletedEvent
  | AgentFailedEvent
  | MessageSentEvent
  | QuotaConsumedEvent
  | ModelSwitchedEvent;

// ---------------------------------------------------------------------------
// 필터 & 결과 인터페이스
// ---------------------------------------------------------------------------

/**
 * 이벤트 조회 필터 옵션
 *
 * 모든 필드는 선택적이며, AND 조건으로 결합됩니다.
 *
 * @property fromTimestamp - 이 시각 이후 발생한 이벤트만 (포함)
 * @property toTimestamp - 이 시각 이전에 발생한 이벤트만 (포함)
 * @property agentId - 특정 에이전트 ID와 관련된 이벤트만
 * @property eventTypes - 지정한 이벤트 유형 목록 중 하나인 이벤트만
 */
export interface EventFilter {
  readonly fromTimestamp?: number;
  readonly toTimestamp?: number;
  readonly agentId?: string;
  readonly eventTypes?: readonly string[];
}

/**
 * 비용 요약 결과
 *
 * @property totalTokens - 전체 소비 토큰 수
 * @property totalCost - 전체 소비 비용 (USD)
 * @property byAgent - 에이전트별 비용 집계 (에이전트 ID → 비용 USD)
 */
export interface CostSummary {
  readonly totalTokens: number;
  readonly totalCost: number;
  readonly byAgent: Readonly<Record<string, number>>;
}

/**
 * 내부 저장 항목 — 이벤트 + 자동 생성 ID
 */
interface StoredEntry {
  readonly eventId: string;
  readonly event: OrchestratedEvent;
}

// ---------------------------------------------------------------------------
// 유틸리티: 이벤트에서 agentId 추출
// ---------------------------------------------------------------------------

/**
 * 이벤트에서 관련 에이전트 ID 목록을 추출합니다.
 *
 * message-sent 이벤트의 경우 fromAgentId와 toAgentId 모두를 반환하고,
 * model-switched 이벤트는 에이전트와 무관하므로 빈 배열을 반환합니다.
 *
 * @param event - 분석할 오케스트레이션 이벤트
 * @returns 관련 에이전트 ID 배열
 */
function extractAgentIds(event: OrchestratedEvent): readonly string[] {
  switch (event.type) {
    case "agent-spawned":
      return [event.agentId];
    case "agent-completed":
      return [event.agentId];
    case "agent-failed":
      return [event.agentId];
    case "message-sent":
      return [event.fromAgentId, event.toAgentId];
    case "quota-consumed":
      return [event.agentId];
    case "model-switched":
      return [];
  }
}

// ---------------------------------------------------------------------------
// OrchestrationEventStore 클래스
// ---------------------------------------------------------------------------

/**
 * 오케스트레이션 이벤트 스토어
 *
 * 멀티에이전트 실행 이력을 인메모리 배열에 순서대로 저장하고
 * 다양한 조회 메서드를 제공합니다. 싱글턴 패턴이 아닌 인스턴스 기반으로
 * 설계되어 팀 단위 또는 세션 단위 스토어로 독립 운영 가능합니다.
 *
 * 확장성: 현재는 인메모리 배열 기반이며, 추후 SQLite 또는 파일
 * 백엔드로 교체할 수 있도록 인터페이스를 안정적으로 설계합니다.
 */
export class OrchestrationEventStore {
  /** 저장된 이벤트 엔트리 배열 — 시간 순서 보장 */
  private readonly entries: StoredEntry[] = [];

  // ---------------------------------------------------------------------------
  // 쓰기 메서드
  // ---------------------------------------------------------------------------

  /**
   * 이벤트를 스토어에 추가합니다.
   *
   * UUID를 자동 생성하여 각 이벤트에 고유 ID를 부여합니다.
   * 이벤트 객체는 불변(readonly)으로 저장됩니다.
   *
   * @param event - 저장할 오케스트레이션 이벤트
   * @returns 생성된 이벤트 ID (UUID v4)
   */
  append(event: OrchestratedEvent): string {
    const eventId = randomUUID();
    this.entries.push({ eventId, event });
    return eventId;
  }

  /**
   * 스토어의 모든 이벤트를 삭제합니다.
   *
   * 테스트 초기화 또는 세션 리셋 시 사용합니다.
   */
  clear(): void {
    this.entries.length = 0;
  }

  // ---------------------------------------------------------------------------
  // 조회 메서드
  // ---------------------------------------------------------------------------

  /**
   * 필터 조건에 맞는 이벤트 목록을 반환합니다.
   *
   * 모든 필터 조건은 AND로 결합됩니다. 필터가 없으면 전체 이벤트를 반환합니다.
   * agentId 필터는 message-sent 이벤트의 경우 fromAgentId 또는 toAgentId와 매칭합니다.
   *
   * @param filter - 조회 필터 옵션 (선택적)
   * @returns 필터를 통과한 이벤트 배열 (시간 순서)
   */
  query(filter: EventFilter = {}): OrchestratedEvent[] {
    return this.entries
      .filter(({ event }) => {
        // 타임스탬프 범위 필터
        if (filter.fromTimestamp !== undefined && event.timestamp < filter.fromTimestamp) {
          return false;
        }
        if (filter.toTimestamp !== undefined && event.timestamp > filter.toTimestamp) {
          return false;
        }

        // 에이전트 ID 필터 — 이벤트 타입별로 관련 에이전트 ID 확인
        if (filter.agentId !== undefined) {
          const agentIds = extractAgentIds(event);
          if (!agentIds.includes(filter.agentId)) {
            return false;
          }
        }

        // 이벤트 유형 필터
        if (filter.eventTypes !== undefined && filter.eventTypes.length > 0) {
          if (!filter.eventTypes.includes(event.type)) {
            return false;
          }
        }

        return true;
      })
      .map(({ event }) => event);
  }

  /**
   * 현재 저장된 전체 이벤트 수를 반환합니다.
   *
   * @returns 이벤트 총 개수
   */
  getEventCount(): number {
    return this.entries.length;
  }

  /**
   * 특정 에이전트와 관련된 모든 이벤트를 시간 순서로 반환합니다.
   *
   * message-sent의 경우 송신자 또는 수신자가 해당 에이전트일 때 포함됩니다.
   * model-switched는 에이전트 ID 기반이 아니므로 포함되지 않습니다.
   *
   * @param agentId - 타임라인을 조회할 에이전트 ID
   * @returns 해당 에이전트와 관련된 이벤트 배열 (시간 순서)
   */
  getAgentTimeline(agentId: string): OrchestratedEvent[] {
    return this.query({ agentId });
  }

  /**
   * 전체 비용/토큰 소비 요약을 반환합니다.
   *
   * quota-consumed 이벤트만 집계하며,
   * 에이전트별 USD 비용을 byAgent에 담아 반환합니다.
   *
   * @returns 전체 및 에이전트별 비용 요약
   */
  getCostSummary(): CostSummary {
    let totalTokens = 0;
    let totalCost = 0;
    const byAgent: Record<string, number> = {};

    for (const { event } of this.entries) {
      if (event.type === "quota-consumed") {
        totalTokens += event.tokens;
        totalCost += event.cost;
        byAgent[event.agentId] = (byAgent[event.agentId] ?? 0) + event.cost;
      }
    }

    return { totalTokens, totalCost, byAgent };
  }

  // ---------------------------------------------------------------------------
  // 내보내기
  // ---------------------------------------------------------------------------

  /**
   * 저장된 모든 이벤트를 JSON Lines(JSONL) 형식으로 직렬화합니다.
   *
   * JSON Lines는 각 줄이 유효한 JSON 객체인 포맷으로,
   * 로그 집계 시스템(Loki, Elasticsearch 등)과 호환됩니다.
   * 각 줄에는 eventId와 event 데이터가 함께 포함됩니다.
   *
   * @returns JSONL 형식 문자열 (이벤트가 없으면 빈 문자열)
   */
  export(): string {
    if (this.entries.length === 0) {
      return "";
    }

    return this.entries
      .map(({ eventId, event }) => JSON.stringify({ eventId, ...event }))
      .join("\n");
  }
}
