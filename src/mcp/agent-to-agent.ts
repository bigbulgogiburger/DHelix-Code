/**
 * MCP Agent-to-Agent Bridge — MCP 2026 Q3 스펙 기반 에이전트 간 통신 준비 모듈
 *
 * MCP(Model Context Protocol)의 Agent-to-Agent(A2A) 프로토콜 확장을 준비합니다.
 * 에이전트들이 서로를 발견(discover)하고, 세션을 생성하여 구조화된 메시지를 교환할 수 있는
 * 인메모리 브리지를 제공합니다.
 *
 * 핵심 개념:
 * - AgentCard: 에이전트의 ID, 이름, 역할, 엔드포인트를 담은 명함(card)
 * - A2ASession: 2개 이상의 에이전트가 참여하는 대화 세션
 * - A2AMessage: 세션 내에서 주고받는 구조화된 메시지
 *
 * 설계 원칙:
 * - 모든 인터페이스 필드는 readonly (불변 상태)
 * - any 타입 금지 — unknown 사용
 * - Named export only (default export 없음)
 * - ESM import with .js extension
 *
 * @example
 * ```ts
 * const bridge = new AgentToAgentBridge();
 *
 * const planner: AgentCard = {
 *   agentId: "planner-1",
 *   name: "Planner Agent",
 *   capabilities: ["planning", "code-review"],
 *   protocol: "mcp",
 * };
 * bridge.registerAgent(planner);
 *
 * const session = bridge.createSession([planner, reviewer]);
 * const msgId = bridge.sendMessage(session.id, {
 *   from: planner,
 *   to: reviewer,
 *   type: "request",
 *   method: "request-review",
 *   params: { file: "src/index.ts" },
 * });
 * ```
 */

import { randomUUID } from "node:crypto";
import { BaseError } from "../utils/error.js";

// ---------------------------------------------------------------------------
// 에러
// ---------------------------------------------------------------------------

/**
 * Agent-to-Agent 통신 관련 에러 클래스
 *
 * 에이전트 등록, 세션 관리, 메시지 전송 중 발생하는 에러를 나타냅니다.
 * 에러 코드 "A2A_ERROR"로 식별됩니다.
 */
export class A2AError extends BaseError {
  constructor(message: string, context: Record<string, unknown> = {}) {
    super(message, "A2A_ERROR", context);
  }
}

// ---------------------------------------------------------------------------
// 인터페이스
// ---------------------------------------------------------------------------

/**
 * 에이전트 카드 — 에이전트의 신원(identity)과 역할(capability)을 표현합니다.
 *
 * MCP A2A 프로토콜에서 에이전트는 서로를 AgentCard로 식별하며,
 * capabilities를 통해 어떤 작업을 수행할 수 있는지 광고(advertise)합니다.
 *
 * @property agentId - 에이전트 고유 식별자 (시스템 내 유일)
 * @property name - 사람이 읽을 수 있는 에이전트 이름
 * @property capabilities - 에이전트가 제공하는 기능 목록 (예: "code-review", "testing")
 * @property endpoint - MCP 서버 또는 HTTP 엔드포인트 (원격 에이전트에서 사용)
 * @property protocol - 통신 프로토콜 종류
 * @property metadata - 추가 메타데이터 (벤더별 확장 필드 등)
 */
export interface AgentCard {
  readonly agentId: string;
  readonly name: string;
  readonly capabilities: readonly string[];
  readonly endpoint?: string;
  readonly protocol: "mcp" | "http" | "stdio";
  readonly metadata?: Readonly<Record<string, unknown>>;
}

/**
 * A2A 메시지 — 에이전트 간에 교환되는 구조화된 메시지입니다.
 *
 * MCP A2A 프로토콜의 메시지 형식으로, 요청(request), 응답(response),
 * 알림(notification) 세 가지 유형을 지원합니다.
 *
 * @property id - 메시지 고유 ID (UUID v4, 자동 생성)
 * @property from - 송신 에이전트의 AgentCard
 * @property to - 수신 에이전트의 AgentCard
 * @property type - 메시지 유형: 요청/응답/알림
 * @property method - 메서드 이름 (예: "execute-task", "share-context", "request-review")
 * @property params - 요청/알림의 매개변수 (선택)
 * @property result - 응답의 결과 값 (선택)
 * @property timestamp - 메시지 생성 시각 (Unix ms, 자동 생성)
 */
export interface A2AMessage {
  readonly id: string;
  readonly from: AgentCard;
  readonly to: AgentCard;
  readonly type: "request" | "response" | "notification";
  readonly method: string;
  readonly params?: unknown;
  readonly result?: unknown;
  readonly timestamp: number;
}

/**
 * A2A 세션 — 2개 이상의 에이전트가 참여하는 대화 세션입니다.
 *
 * 세션은 createSession()으로 생성되며, 참여 에이전트들의 AgentCard,
 * 생성 시각, 현재 상태, 교환된 메시지 수를 추적합니다.
 *
 * @property id - 세션 고유 ID (UUID v4, 자동 생성)
 * @property participants - 세션에 참여한 에이전트 목록
 * @property createdAt - 세션 생성 시각 (Unix ms)
 * @property status - 세션 상태: 활성/완료/실패
 * @property messageCount - 이 세션에서 교환된 메시지 총 수
 */
export interface A2ASession {
  readonly id: string;
  readonly participants: readonly AgentCard[];
  readonly createdAt: number;
  readonly status: "active" | "completed" | "failed";
  readonly messageCount: number;
}

/**
 * AgentToAgentBridge 통계 정보
 *
 * @property agents - 현재 등록된 에이전트 수
 * @property sessions - 생성된 세션 총 수
 * @property messages - 교환된 메시지 총 수
 */
export interface A2AStats {
  readonly agents: number;
  readonly sessions: number;
  readonly messages: number;
}

// ---------------------------------------------------------------------------
// 내부 가변 세션 — 외부에는 readonly A2ASession으로 노출
// ---------------------------------------------------------------------------

/** 내부에서 messageCount를 증가시키기 위한 가변 세션 레코드 */
interface MutableSession {
  id: string;
  participants: readonly AgentCard[];
  createdAt: number;
  status: "active" | "completed" | "failed";
  messageCount: number;
}

// ---------------------------------------------------------------------------
// AgentToAgentBridge 클래스
// ---------------------------------------------------------------------------

/**
 * MCP Agent-to-Agent 브리지
 *
 * 에이전트의 등록/해제, 역할 기반 발견(discovery), 세션 관리,
 * 메시지 교환을 담당하는 인메모리 브리지입니다.
 *
 * 이 클래스는 MCP 2026 Q3 A2A 스펙이 공식화되기 전까지
 * 로컬 인메모리로 동작하며, 향후 원격 에이전트 연동을 위한
 * 기반(scaffold)을 제공합니다.
 *
 * 수명주기:
 * 1. new AgentToAgentBridge()
 * 2. registerAgent(card) — 에이전트를 브리지에 등록
 * 3. createSession([...cards]) — 에이전트들 사이의 세션 생성
 * 4. sendMessage(sessionId, draft) — 세션 내 메시지 전송
 * 5. closeSession(sessionId) — 세션 완료 처리
 * 6. dispose() — 전체 리소스 정리
 */
export class AgentToAgentBridge {
  /** 등록된 에이전트 맵 (agentId → AgentCard) */
  private readonly agents = new Map<string, AgentCard>();

  /** 세션 맵 (sessionId → MutableSession) */
  private readonly sessions = new Map<string, MutableSession>();

  /** 세션별 메시지 목록 (sessionId → A2AMessage[]) */
  private readonly sessionMessages = new Map<string, A2AMessage[]>();

  /** 전체 메시지 카운터 */
  private totalMessages = 0;

  /** dispose 여부 */
  private disposed = false;

  // ---------------------------------------------------------------------------
  // 에이전트 등록/해제
  // ---------------------------------------------------------------------------

  /**
   * 에이전트를 브리지에 등록합니다.
   *
   * 같은 agentId로 다시 등록하면 기존 카드가 덮어쓰여집니다(upsert 방식).
   * 이는 에이전트가 재시작하거나 capabilities를 업데이트할 때 유용합니다.
   *
   * @param card - 등록할 에이전트 카드
   * @throws A2AError 브리지가 dispose된 경우
   */
  registerAgent(card: AgentCard): void {
    this.assertNotDisposed();
    this.agents.set(card.agentId, card);
  }

  /**
   * 에이전트를 브리지에서 해제합니다.
   *
   * 존재하지 않는 agentId를 해제하면 아무 동작도 하지 않습니다(멱등성).
   * 해제된 에이전트가 참여한 세션은 유지되지만, 이후 발견(discover)에는 나타나지 않습니다.
   *
   * @param agentId - 해제할 에이전트 ID
   * @throws A2AError 브리지가 dispose된 경우
   */
  unregisterAgent(agentId: string): void {
    this.assertNotDisposed();
    this.agents.delete(agentId);
  }

  /**
   * 등록된 에이전트를 검색합니다.
   *
   * capability 필터를 지정하면 해당 역할을 가진 에이전트만 반환합니다.
   * 필터가 없으면 모든 등록된 에이전트를 반환합니다.
   *
   * @param capability - 필터링할 역할 이름 (예: "code-review", "testing")
   * @returns 필터를 만족하는 에이전트 카드 배열 (readonly)
   * @throws A2AError 브리지가 dispose된 경우
   *
   * @example
   * const reviewers = bridge.discoverAgents("code-review");
   */
  discoverAgents(capability?: string): readonly AgentCard[] {
    this.assertNotDisposed();
    const all = Array.from(this.agents.values());
    if (capability === undefined) return all;
    return all.filter((card) => card.capabilities.includes(capability));
  }

  // ---------------------------------------------------------------------------
  // 세션 관리
  // ---------------------------------------------------------------------------

  /**
   * 새 A2A 세션을 생성합니다.
   *
   * 참여자 목록(participants)은 최소 1명 이상이어야 합니다.
   * 세션은 "active" 상태로 시작되며, closeSession()으로 "completed"로 전환됩니다.
   *
   * @param participants - 세션에 참여할 에이전트 카드 배열
   * @returns 생성된 세션 정보 (readonly)
   * @throws A2AError 참여자가 없거나 브리지가 dispose된 경우
   */
  createSession(participants: AgentCard[]): A2ASession {
    this.assertNotDisposed();

    if (participants.length === 0) {
      throw new A2AError("Session must have at least one participant", {
        participantCount: participants.length,
      });
    }

    const session: MutableSession = {
      id: randomUUID(),
      participants,
      createdAt: Date.now(),
      status: "active",
      messageCount: 0,
    };

    this.sessions.set(session.id, session);
    this.sessionMessages.set(session.id, []);

    return this.toReadonlySession(session);
  }

  /**
   * 세션을 "completed" 상태로 닫습니다.
   *
   * 닫힌 세션에는 더 이상 메시지를 보낼 수 없습니다.
   * 이미 닫혔거나 실패한 세션에 대해 호출하면 아무 동작도 하지 않습니다(멱등성).
   *
   * @param sessionId - 닫을 세션 ID
   * @throws A2AError 세션이 존재하지 않거나 브리지가 dispose된 경우
   */
  closeSession(sessionId: string): void {
    this.assertNotDisposed();

    const session = this.getSessionOrThrow(sessionId);
    if (session.status !== "active") return;

    session.status = "completed";
  }

  // ---------------------------------------------------------------------------
  // 메시지
  // ---------------------------------------------------------------------------

  /**
   * 세션에 메시지를 전송합니다.
   *
   * id와 timestamp는 자동 생성됩니다. 메시지는 세션의 메시지 목록에 추가되고
   * 세션의 messageCount가 증가합니다.
   *
   * @param sessionId - 메시지를 전송할 세션 ID
   * @param draft - id, timestamp를 제외한 메시지 데이터
   * @returns 생성된 메시지 ID (UUID v4)
   * @throws A2AError 세션이 없거나 active 상태가 아닌 경우, 브리지가 dispose된 경우
   */
  sendMessage(sessionId: string, draft: Omit<A2AMessage, "id" | "timestamp">): string {
    this.assertNotDisposed();

    const session = this.getSessionOrThrow(sessionId);
    if (session.status !== "active") {
      throw new A2AError("Cannot send message to a non-active session", {
        sessionId,
        status: session.status,
      });
    }

    const message: A2AMessage = {
      ...draft,
      id: randomUUID(),
      timestamp: Date.now(),
    };

    const messages = this.sessionMessages.get(sessionId);
    // sessionMessages는 createSession에서 항상 함께 초기화되므로 항상 존재함
    messages!.push(message);

    session.messageCount += 1;
    this.totalMessages += 1;

    return message.id;
  }

  /**
   * 세션의 메시지 목록을 반환합니다.
   *
   * 메시지는 전송 순서대로 정렬되어 반환됩니다.
   *
   * @param sessionId - 조회할 세션 ID
   * @returns 세션의 메시지 배열 (readonly, 전송 순서)
   * @throws A2AError 세션이 존재하지 않거나 브리지가 dispose된 경우
   */
  getSessionMessages(sessionId: string): readonly A2AMessage[] {
    this.assertNotDisposed();
    this.getSessionOrThrow(sessionId);
    return this.sessionMessages.get(sessionId) ?? [];
  }

  // ---------------------------------------------------------------------------
  // 통계
  // ---------------------------------------------------------------------------

  /**
   * 브리지 전체 통계를 반환합니다.
   *
   * @returns 등록된 에이전트 수, 생성된 세션 수, 교환된 메시지 총 수
   * @throws A2AError 브리지가 dispose된 경우
   */
  getStats(): A2AStats {
    this.assertNotDisposed();
    return {
      agents: this.agents.size,
      sessions: this.sessions.size,
      messages: this.totalMessages,
    };
  }

  // ---------------------------------------------------------------------------
  // 정리
  // ---------------------------------------------------------------------------

  /**
   * 브리지의 모든 리소스를 해제합니다.
   *
   * 등록된 에이전트, 세션, 메시지를 모두 삭제하며,
   * 이후 모든 메서드 호출은 A2AError를 발생시킵니다.
   */
  dispose(): void {
    this.agents.clear();
    this.sessions.clear();
    this.sessionMessages.clear();
    this.totalMessages = 0;
    this.disposed = true;
  }

  // ---------------------------------------------------------------------------
  // 내부 헬퍼
  // ---------------------------------------------------------------------------

  /**
   * dispose 상태 확인 — dispose된 브리지에서 작업 시도 시 에러 발생
   */
  private assertNotDisposed(): void {
    if (this.disposed) {
      throw new A2AError("AgentToAgentBridge has been disposed");
    }
  }

  /**
   * 세션 ID로 세션을 가져옵니다. 존재하지 않으면 에러를 던집니다.
   *
   * @param sessionId - 찾을 세션 ID
   * @returns 내부 가변 세션 레코드
   * @throws A2AError 세션이 존재하지 않는 경우
   */
  private getSessionOrThrow(sessionId: string): MutableSession {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new A2AError("Session not found", { sessionId });
    }
    return session;
  }

  /**
   * 내부 가변 세션을 readonly A2ASession으로 변환합니다.
   *
   * @param session - 내부 가변 세션
   * @returns readonly A2ASession 뷰
   */
  private toReadonlySession(session: MutableSession): A2ASession {
    return {
      id: session.id,
      participants: session.participants,
      createdAt: session.createdAt,
      status: session.status,
      messageCount: session.messageCount,
    };
  }
}
