/**
 * Agent Peer-to-Peer Message Bus — 에이전트 간 직접 메시지 교환을 위한 인메모리 메시지 버스
 *
 * 멀티에이전트 오케스트레이션에서 에이전트들이 중앙 오케스트레이터를 거치지 않고
 * 직접 메시지를 주고받을 수 있는 P2P 통신 채널을 제공합니다.
 *
 * 주요 기능:
 * - 1:1 메시지 전송 (send)
 * - 1:N 브로드캐스트 (broadcast, toAgentId = '*')
 * - topic 기반 구독 (glob 패턴 지원, 예: "type-*")
 * - 대화 이력 조회 (getConversation)
 * - 응답 대기 (waitForReply + timeout)
 * - 통계 집계 (getStats)
 *
 * 설계 원칙:
 * - 모든 필드는 readonly (불변 상태)
 * - any 타입 사용 금지 — unknown 사용
 * - Named export only (default export 없음)
 * - ESM import with .js extension
 *
 * @example
 * ```ts
 * const bus = new AgentMessageBus();
 * const unsub = bus.subscribe({
 *   agentId: "agent-2",
 *   handler: (msg) => console.log(msg.topic, msg.payload),
 * });
 * bus.send({ fromAgentId: "agent-1", toAgentId: "agent-2", topic: "schema-decision", payload: { table: "users" } });
 * unsub();
 * ```
 */

import { randomUUID } from "node:crypto";

// ---------------------------------------------------------------------------
// 인터페이스
// ---------------------------------------------------------------------------

/**
 * 에이전트 간 전달되는 메시지
 *
 * @property id - 고유 메시지 ID (UUID v4, 자동 생성)
 * @property fromAgentId - 송신 에이전트 ID
 * @property toAgentId - 수신 에이전트 ID ('*' = 브로드캐스트)
 * @property topic - 구조화된 메시지 주제 (예: "type-export", "schema-decision")
 * @property payload - 메시지 본문 데이터
 * @property timestamp - 메시지 생성 시각 (Unix ms, 자동 생성)
 * @property replyToId - 답장 대상 메시지 ID (선택적)
 */
export interface AgentMessage {
  readonly id: string;
  readonly fromAgentId: string;
  readonly toAgentId: string | "*";
  readonly topic: string;
  readonly payload: unknown;
  readonly timestamp: number;
  readonly replyToId?: string;
}

/**
 * 메시지 구독 설정
 *
 * @property agentId - 구독하는 에이전트 ID (이 에이전트에게 전달되는 메시지만 수신)
 * @property topicFilter - topic glob 패턴 필터 (선택적, 예: "type-*")
 * @property handler - 메시지 수신 시 호출되는 콜백
 */
export interface MessageSubscription {
  readonly agentId: string;
  readonly topicFilter?: string;
  readonly handler: (message: AgentMessage) => void | Promise<void>;
}

/**
 * 메시지 조회 필터
 *
 * @property topic - 특정 topic만 조회
 * @property fromTimestamp - 이 시각 이후 메시지만 (포함)
 * @property toTimestamp - 이 시각 이전 메시지만 (포함)
 */
export interface MessageFilter {
  readonly topic?: string;
  readonly fromTimestamp?: number;
  readonly toTimestamp?: number;
}

/**
 * 메시지 버스 통계
 *
 * @property totalMessages - 전체 메시지 수
 * @property byAgent - 에이전트별 송신 메시지 수
 * @property byTopic - topic별 메시지 수
 */
export interface MessageBusStats {
  readonly totalMessages: number;
  readonly byAgent: Readonly<Record<string, number>>;
  readonly byTopic: Readonly<Record<string, number>>;
}

// ---------------------------------------------------------------------------
// 유틸리티: glob 패턴 매칭
// ---------------------------------------------------------------------------

/**
 * 간단한 glob 패턴 매칭 (와일드카드 '*' 지원)
 *
 * '*'는 0개 이상의 임의 문자에 매칭됩니다.
 * '?' 등 다른 glob 문법은 지원하지 않습니다.
 *
 * @param pattern - glob 패턴 (예: "type-*", "*-export", "*")
 * @param value - 매칭 대상 문자열
 * @returns 매칭 여부
 */
export function matchTopicGlob(pattern: string, value: string): boolean {
  // '*'를 정규식 '.*'로 변환하고 나머지는 이스케이프
  const escaped = pattern.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*");
  const regex = new RegExp(`^${escaped}$`);
  return regex.test(value);
}

// ---------------------------------------------------------------------------
// AgentMessageBus 클래스
// ---------------------------------------------------------------------------

/**
 * 에이전트 P2P 메시지 버스
 *
 * 에이전트 간 직접 메시지 교환을 관리하는 인메모리 메시지 버스입니다.
 * 인스턴스 기반으로 설계되어 팀/세션 단위로 독립 운영 가능합니다.
 *
 * 메시지는 시간 순서대로 저장되며, 구독자에게는 비동기로 전달됩니다.
 * 브로드캐스트(toAgentId = '*')는 송신자를 제외한 모든 구독자에게 전달됩니다.
 */
export class AgentMessageBus {
  /** 저장된 메시지 배열 — 시간 순서 보장 */
  private readonly messages: AgentMessage[] = [];

  /** 활성 구독 목록 */
  private readonly subscriptions: MessageSubscription[] = [];

  /** dispose 여부 */
  private disposed = false;

  // ---------------------------------------------------------------------------
  // 메시지 전송
  // ---------------------------------------------------------------------------

  /**
   * 메시지를 전송합니다.
   *
   * id와 timestamp는 자동 생성됩니다. 메시지는 저장된 후 해당하는 구독자에게 전달됩니다.
   *
   * @param draft - id, timestamp를 제외한 메시지 데이터
   * @returns 생성된 메시지 ID (UUID v4)
   * @throws 버스가 dispose된 경우 에러
   */
  send(draft: Omit<AgentMessage, "id" | "timestamp">): string {
    this.assertNotDisposed();

    const message: AgentMessage = {
      ...draft,
      id: randomUUID(),
      timestamp: Date.now(),
    };

    this.messages.push(message);
    this.dispatch(message);

    return message.id;
  }

  /**
   * 브로드캐스트 메시지를 전송합니다.
   *
   * toAgentId를 '*'로 설정하여 모든 구독자에게 메시지를 전달합니다.
   * 송신자 자신은 수신하지 않습니다.
   *
   * @param fromAgentId - 송신 에이전트 ID
   * @param topic - 메시지 주제
   * @param payload - 메시지 본문
   * @returns 생성된 메시지 ID (UUID v4)
   */
  broadcast(fromAgentId: string, topic: string, payload: unknown): string {
    return this.send({ fromAgentId, toAgentId: "*", topic, payload });
  }

  // ---------------------------------------------------------------------------
  // 구독
  // ---------------------------------------------------------------------------

  /**
   * 메시지를 구독합니다.
   *
   * 구독한 에이전트에게 전달되는 메시지(직접 또는 브로드캐스트)만 핸들러에 전달됩니다.
   * topicFilter가 설정된 경우, topic이 glob 패턴에 매칭되는 메시지만 전달됩니다.
   *
   * @param subscription - 구독 설정
   * @returns unsubscribe 함수 (호출 시 구독 해제)
   */
  subscribe(subscription: MessageSubscription): () => void {
    this.assertNotDisposed();

    this.subscriptions.push(subscription);

    return () => {
      const idx = this.subscriptions.indexOf(subscription);
      if (idx !== -1) {
        this.subscriptions.splice(idx, 1);
      }
    };
  }

  // ---------------------------------------------------------------------------
  // 조회
  // ---------------------------------------------------------------------------

  /**
   * 특정 에이전트에게 전달된 메시지 목록을 반환합니다.
   *
   * 해당 에이전트가 수신자이거나 브로드캐스트인 메시지를 필터링합니다.
   * 추가로 topic, 타임스탬프 범위 필터를 적용할 수 있습니다.
   *
   * @param agentId - 조회할 에이전트 ID
   * @param filter - 추가 필터 옵션 (선택적)
   * @returns 필터를 통과한 메시지 배열 (시간 순서, readonly)
   */
  getMessages(agentId: string, filter?: MessageFilter): readonly AgentMessage[] {
    return this.messages.filter((msg) => {
      // 수신자 필터: 직접 수신 또는 브로드캐스트 (본인 송신 제외)
      const isRecipient =
        msg.toAgentId === agentId || (msg.toAgentId === "*" && msg.fromAgentId !== agentId);
      if (!isRecipient) return false;

      if (filter?.topic !== undefined && msg.topic !== filter.topic) return false;
      if (filter?.fromTimestamp !== undefined && msg.timestamp < filter.fromTimestamp) return false;
      if (filter?.toTimestamp !== undefined && msg.timestamp > filter.toTimestamp) return false;

      return true;
    });
  }

  /**
   * 두 에이전트 간의 대화 이력을 시간 순서로 반환합니다.
   *
   * 양방향 메시지를 모두 포함합니다 (A→B 및 B→A).
   *
   * @param agentId1 - 첫 번째 에이전트 ID
   * @param agentId2 - 두 번째 에이전트 ID
   * @returns 두 에이전트 간 대화 메시지 배열 (시간 순서, readonly)
   */
  getConversation(agentId1: string, agentId2: string): readonly AgentMessage[] {
    return this.messages.filter(
      (msg) =>
        (msg.fromAgentId === agentId1 && msg.toAgentId === agentId2) ||
        (msg.fromAgentId === agentId2 && msg.toAgentId === agentId1),
    );
  }

  /**
   * 특정 메시지에 대한 응답을 대기합니다.
   *
   * 지정된 시간 내에 replyToId가 해당 메시지 ID인 메시지가 도착하면 반환합니다.
   * 타임아웃 시 null을 반환합니다.
   *
   * @param messageId - 응답을 기다리는 원본 메시지 ID
   * @param timeoutMs - 최대 대기 시간 (밀리초)
   * @returns 응답 메시지 또는 null (타임아웃)
   */
  waitForReply(messageId: string, timeoutMs: number): Promise<AgentMessage | null> {
    // 이미 도착한 응답이 있는지 확인
    const existing = this.messages.find((msg) => msg.replyToId === messageId);
    if (existing) return Promise.resolve(existing);

    return new Promise<AgentMessage | null>((resolve) => {
      let settled = false;

      const timer = setTimeout(() => {
        if (!settled) {
          settled = true;
          cleanup();
          resolve(null);
        }
      }, timeoutMs);

      // 임시 구독으로 새 메시지 감시
      // 모든 메시지를 감시하는 인터셉터
      const interceptor = (msg: AgentMessage): void => {
        if (msg.replyToId === messageId && !settled) {
          settled = true;
          clearTimeout(timer);
          cleanup();
          resolve(msg);
        }
      };

      // 인터셉터를 구독 리스트에 추가 (특수 구독)
      const interceptSub: MessageSubscription = {
        agentId: "*",
        handler: interceptor,
      };
      this.subscriptions.push(interceptSub);

      const cleanup = (): void => {
        const idx = this.subscriptions.indexOf(interceptSub);
        if (idx !== -1) this.subscriptions.splice(idx, 1);
      };
    });
  }

  // ---------------------------------------------------------------------------
  // 통계
  // ---------------------------------------------------------------------------

  /**
   * 메시지 버스 통계를 반환합니다.
   *
   * @returns 전체 메시지 수, 에이전트별 송신 수, topic별 메시지 수
   */
  getStats(): MessageBusStats {
    const byAgent: Record<string, number> = {};
    const byTopic: Record<string, number> = {};

    for (const msg of this.messages) {
      byAgent[msg.fromAgentId] = (byAgent[msg.fromAgentId] ?? 0) + 1;
      byTopic[msg.topic] = (byTopic[msg.topic] ?? 0) + 1;
    }

    return {
      totalMessages: this.messages.length,
      byAgent,
      byTopic,
    };
  }

  // ---------------------------------------------------------------------------
  // 정리
  // ---------------------------------------------------------------------------

  /**
   * 모든 메시지를 삭제합니다. 구독은 유지됩니다.
   */
  clear(): void {
    this.messages.length = 0;
  }

  /**
   * 메시지 버스를 완전히 정리합니다.
   *
   * 모든 메시지와 구독을 제거하고, 이후 send/subscribe 호출 시 에러를 발생시킵니다.
   */
  dispose(): void {
    this.messages.length = 0;
    this.subscriptions.length = 0;
    this.disposed = true;
  }

  // ---------------------------------------------------------------------------
  // 내부 메서드
  // ---------------------------------------------------------------------------

  /**
   * 메시지를 해당하는 구독자에게 전달합니다.
   *
   * - 1:1 메시지: toAgentId와 일치하는 구독자에게만 전달
   * - 브로드캐스트: 송신자를 제외한 모든 구독자에게 전달
   * - topicFilter가 있으면 glob 매칭 후 전달
   * - agentId가 '*'인 특수 구독(waitForReply 인터셉터)에게도 전달
   */
  private dispatch(message: AgentMessage): void {
    for (const sub of [...this.subscriptions]) {
      // 특수 와일드카드 구독 (waitForReply 인터셉터)
      if (sub.agentId === "*") {
        void Promise.resolve(sub.handler(message)).catch(() => {
          /* 구독자 에러 무시 */
        });
        continue;
      }

      // 수신 대상 확인
      const isTarget =
        message.toAgentId === sub.agentId ||
        (message.toAgentId === "*" && message.fromAgentId !== sub.agentId);

      if (!isTarget) continue;

      // topic 필터 확인
      if (sub.topicFilter && !matchTopicGlob(sub.topicFilter, message.topic)) {
        continue;
      }

      void Promise.resolve(sub.handler(message)).catch(() => {
        /* 구독자 에러 무시 */
      });
    }
  }

  /**
   * dispose 상태 확인 — dispose된 버스에서 작업 시도 시 에러 발생
   */
  private assertNotDisposed(): void {
    if (this.disposed) {
      throw new Error("AgentMessageBus has been disposed");
    }
  }
}
