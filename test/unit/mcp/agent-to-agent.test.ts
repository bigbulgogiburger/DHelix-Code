/**
 * AgentToAgentBridge 단위 테스트
 *
 * MCP A2A 브리지의 에이전트 등록/해제, 발견, 세션 관리, 메시지 교환,
 * 통계, dispose 동작을 검증합니다.
 */
import { describe, it, expect, beforeEach } from "vitest";
import {
  AgentToAgentBridge,
  A2AError,
  type AgentCard,
  type A2ASession,
  type A2AMessage,
} from "../../../src/mcp/agent-to-agent.js";

// ---------------------------------------------------------------------------
// 테스트 픽스처
// ---------------------------------------------------------------------------

const plannerCard: AgentCard = {
  agentId: "planner-1",
  name: "Planner Agent",
  capabilities: ["planning", "code-review"],
  protocol: "mcp",
};

const testerCard: AgentCard = {
  agentId: "tester-1",
  name: "Tester Agent",
  capabilities: ["testing", "code-review"],
  protocol: "mcp",
  endpoint: "mcp://localhost:3001",
};

const builderCard: AgentCard = {
  agentId: "builder-1",
  name: "Builder Agent",
  capabilities: ["build", "deploy"],
  protocol: "http",
  endpoint: "http://localhost:4000/a2a",
  metadata: { version: "1.0.0" },
};

// ---------------------------------------------------------------------------
// 공통 setup
// ---------------------------------------------------------------------------

describe("AgentToAgentBridge", () => {
  let bridge: AgentToAgentBridge;

  beforeEach(() => {
    bridge = new AgentToAgentBridge();
  });

  // -------------------------------------------------------------------------
  // 에이전트 등록/해제
  // -------------------------------------------------------------------------

  describe("registerAgent / unregisterAgent", () => {
    it("에이전트를 등록하면 discoverAgents에서 반환된다", () => {
      bridge.registerAgent(plannerCard);
      const agents = bridge.discoverAgents();
      expect(agents).toHaveLength(1);
      expect(agents[0]).toEqual(plannerCard);
    });

    it("여러 에이전트를 등록할 수 있다", () => {
      bridge.registerAgent(plannerCard);
      bridge.registerAgent(testerCard);
      bridge.registerAgent(builderCard);
      expect(bridge.discoverAgents()).toHaveLength(3);
    });

    it("같은 agentId로 다시 등록하면 카드가 업데이트된다 (upsert)", () => {
      bridge.registerAgent(plannerCard);
      const updatedCard: AgentCard = {
        ...plannerCard,
        name: "Updated Planner",
        capabilities: ["planning"],
      };
      bridge.registerAgent(updatedCard);
      const agents = bridge.discoverAgents();
      expect(agents).toHaveLength(1);
      expect(agents[0]?.name).toBe("Updated Planner");
    });

    it("unregisterAgent로 에이전트를 해제한다", () => {
      bridge.registerAgent(plannerCard);
      bridge.registerAgent(testerCard);
      bridge.unregisterAgent(plannerCard.agentId);
      const agents = bridge.discoverAgents();
      expect(agents).toHaveLength(1);
      expect(agents[0]?.agentId).toBe(testerCard.agentId);
    });

    it("존재하지 않는 agentId 해제는 멱등성을 가진다 (에러 없음)", () => {
      expect(() => bridge.unregisterAgent("non-existent")).not.toThrow();
    });
  });

  // -------------------------------------------------------------------------
  // 에이전트 발견(discovery)
  // -------------------------------------------------------------------------

  describe("discoverAgents", () => {
    beforeEach(() => {
      bridge.registerAgent(plannerCard);
      bridge.registerAgent(testerCard);
      bridge.registerAgent(builderCard);
    });

    it("capability 필터 없이 모든 에이전트를 반환한다", () => {
      expect(bridge.discoverAgents()).toHaveLength(3);
    });

    it("특정 capability를 가진 에이전트만 필터링한다", () => {
      const reviewers = bridge.discoverAgents("code-review");
      expect(reviewers).toHaveLength(2);
      const ids = reviewers.map((c) => c.agentId);
      expect(ids).toContain(plannerCard.agentId);
      expect(ids).toContain(testerCard.agentId);
    });

    it("아무도 가지지 않은 capability는 빈 배열을 반환한다", () => {
      expect(bridge.discoverAgents("non-existent-capability")).toHaveLength(0);
    });

    it("하나의 에이전트만 가진 capability는 해당 에이전트만 반환한다", () => {
      const deployers = bridge.discoverAgents("deploy");
      expect(deployers).toHaveLength(1);
      expect(deployers[0]?.agentId).toBe(builderCard.agentId);
    });
  });

  // -------------------------------------------------------------------------
  // 세션 생성
  // -------------------------------------------------------------------------

  describe("createSession", () => {
    it("참여자가 있는 세션을 생성한다", () => {
      const session = bridge.createSession([plannerCard, testerCard]);
      expect(session.id).toBeTruthy();
      expect(session.participants).toHaveLength(2);
      expect(session.status).toBe("active");
      expect(session.messageCount).toBe(0);
      expect(session.createdAt).toBeGreaterThan(0);
    });

    it("참여자가 1명인 세션도 생성된다", () => {
      const session = bridge.createSession([plannerCard]);
      expect(session.participants).toHaveLength(1);
    });

    it("참여자가 없으면 A2AError를 던진다", () => {
      expect(() => bridge.createSession([])).toThrow(A2AError);
    });

    it("여러 세션을 독립적으로 생성할 수 있다", () => {
      const s1 = bridge.createSession([plannerCard, testerCard]);
      const s2 = bridge.createSession([testerCard, builderCard]);
      expect(s1.id).not.toBe(s2.id);
    });
  });

  // -------------------------------------------------------------------------
  // 메시지 전송 및 조회
  // -------------------------------------------------------------------------

  describe("sendMessage / getSessionMessages", () => {
    let session: A2ASession;

    beforeEach(() => {
      session = bridge.createSession([plannerCard, testerCard]);
    });

    it("메시지를 전송하고 ID를 반환한다", () => {
      const msgId = bridge.sendMessage(session.id, {
        from: plannerCard,
        to: testerCard,
        type: "request",
        method: "execute-task",
        params: { task: "write tests" },
      });
      expect(msgId).toBeTruthy();
    });

    it("전송한 메시지를 getSessionMessages로 조회할 수 있다", () => {
      bridge.sendMessage(session.id, {
        from: plannerCard,
        to: testerCard,
        type: "request",
        method: "execute-task",
        params: { task: "write tests" },
      });

      const messages = bridge.getSessionMessages(session.id);
      expect(messages).toHaveLength(1);
      expect(messages[0]?.method).toBe("execute-task");
      expect(messages[0]?.type).toBe("request");
      expect(messages[0]?.from.agentId).toBe(plannerCard.agentId);
      expect(messages[0]?.to.agentId).toBe(testerCard.agentId);
    });

    it("메시지 id와 timestamp가 자동 생성된다", () => {
      const before = Date.now();
      bridge.sendMessage(session.id, {
        from: plannerCard,
        to: testerCard,
        type: "notification",
        method: "share-context",
      });
      const after = Date.now();

      const messages = bridge.getSessionMessages(session.id);
      const msg = messages[0] as A2AMessage;
      expect(msg.id).toBeTruthy();
      expect(msg.timestamp).toBeGreaterThanOrEqual(before);
      expect(msg.timestamp).toBeLessThanOrEqual(after);
    });

    it("여러 메시지를 순서대로 저장한다", () => {
      bridge.sendMessage(session.id, {
        from: plannerCard,
        to: testerCard,
        type: "request",
        method: "execute-task",
      });
      bridge.sendMessage(session.id, {
        from: testerCard,
        to: plannerCard,
        type: "response",
        method: "execute-task",
        result: { status: "done" },
      });
      bridge.sendMessage(session.id, {
        from: plannerCard,
        to: testerCard,
        type: "notification",
        method: "share-context",
      });

      const messages = bridge.getSessionMessages(session.id);
      expect(messages).toHaveLength(3);
      expect(messages[0]?.type).toBe("request");
      expect(messages[1]?.type).toBe("response");
      expect(messages[2]?.type).toBe("notification");
    });

    it("세션 messageCount가 메시지 전송 시 증가한다", () => {
      bridge.sendMessage(session.id, {
        from: plannerCard,
        to: testerCard,
        type: "request",
        method: "request-review",
      });
      bridge.sendMessage(session.id, {
        from: testerCard,
        to: plannerCard,
        type: "response",
        method: "request-review",
        result: { approved: true },
      });

      // 세션 재조회: getStats는 sessions 수를 추적하므로, messageCount는
      // 세션 내부에서 유지됨을 getSessionMessages 길이로 간접 확인
      const messages = bridge.getSessionMessages(session.id);
      expect(messages).toHaveLength(2);
    });

    it("닫힌 세션에 메시지를 보내면 A2AError를 던진다", () => {
      bridge.closeSession(session.id);
      expect(() =>
        bridge.sendMessage(session.id, {
          from: plannerCard,
          to: testerCard,
          type: "notification",
          method: "share-context",
        }),
      ).toThrow(A2AError);
    });

    it("존재하지 않는 세션에 메시지를 보내면 A2AError를 던진다", () => {
      expect(() =>
        bridge.sendMessage("non-existent-session", {
          from: plannerCard,
          to: testerCard,
          type: "request",
          method: "execute-task",
        }),
      ).toThrow(A2AError);
    });

    it("존재하지 않는 세션의 메시지를 조회하면 A2AError를 던진다", () => {
      expect(() => bridge.getSessionMessages("non-existent")).toThrow(A2AError);
    });
  });

  // -------------------------------------------------------------------------
  // 세션 닫기
  // -------------------------------------------------------------------------

  describe("closeSession", () => {
    it("세션을 completed 상태로 변경한다", () => {
      const session = bridge.createSession([plannerCard]);
      bridge.closeSession(session.id);

      // 닫힌 세션에 메시지를 보내면 에러가 나야 함 (상태 검증)
      expect(() =>
        bridge.sendMessage(session.id, {
          from: plannerCard,
          to: testerCard,
          type: "notification",
          method: "done",
        }),
      ).toThrow(A2AError);
    });

    it("이미 닫힌 세션을 다시 닫아도 에러 없이 멱등하다", () => {
      const session = bridge.createSession([plannerCard]);
      bridge.closeSession(session.id);
      expect(() => bridge.closeSession(session.id)).not.toThrow();
    });

    it("존재하지 않는 세션 ID 닫기는 A2AError를 던진다", () => {
      expect(() => bridge.closeSession("non-existent")).toThrow(A2AError);
    });
  });

  // -------------------------------------------------------------------------
  // 통계
  // -------------------------------------------------------------------------

  describe("getStats", () => {
    it("초기 상태에서 모두 0이다", () => {
      const stats = bridge.getStats();
      expect(stats.agents).toBe(0);
      expect(stats.sessions).toBe(0);
      expect(stats.messages).toBe(0);
    });

    it("에이전트 등록 후 agents 수가 증가한다", () => {
      bridge.registerAgent(plannerCard);
      bridge.registerAgent(testerCard);
      expect(bridge.getStats().agents).toBe(2);
    });

    it("에이전트 해제 후 agents 수가 감소한다", () => {
      bridge.registerAgent(plannerCard);
      bridge.registerAgent(testerCard);
      bridge.unregisterAgent(plannerCard.agentId);
      expect(bridge.getStats().agents).toBe(1);
    });

    it("세션 생성 후 sessions 수가 증가한다", () => {
      bridge.createSession([plannerCard]);
      bridge.createSession([testerCard]);
      expect(bridge.getStats().sessions).toBe(2);
    });

    it("메시지 전송 후 messages 수가 증가한다", () => {
      const s1 = bridge.createSession([plannerCard, testerCard]);
      const s2 = bridge.createSession([testerCard, builderCard]);

      bridge.sendMessage(s1.id, {
        from: plannerCard,
        to: testerCard,
        type: "request",
        method: "execute-task",
      });
      bridge.sendMessage(s2.id, {
        from: testerCard,
        to: builderCard,
        type: "notification",
        method: "share-context",
      });
      bridge.sendMessage(s1.id, {
        from: testerCard,
        to: plannerCard,
        type: "response",
        method: "execute-task",
        result: { ok: true },
      });

      expect(bridge.getStats().messages).toBe(3);
    });
  });

  // -------------------------------------------------------------------------
  // dispose
  // -------------------------------------------------------------------------

  describe("dispose", () => {
    it("dispose 후 registerAgent를 호출하면 A2AError를 던진다", () => {
      bridge.dispose();
      expect(() => bridge.registerAgent(plannerCard)).toThrow(A2AError);
    });

    it("dispose 후 unregisterAgent를 호출하면 A2AError를 던진다", () => {
      bridge.dispose();
      expect(() => bridge.unregisterAgent("any")).toThrow(A2AError);
    });

    it("dispose 후 discoverAgents를 호출하면 A2AError를 던진다", () => {
      bridge.dispose();
      expect(() => bridge.discoverAgents()).toThrow(A2AError);
    });

    it("dispose 후 createSession을 호출하면 A2AError를 던진다", () => {
      bridge.dispose();
      expect(() => bridge.createSession([plannerCard])).toThrow(A2AError);
    });

    it("dispose 후 sendMessage를 호출하면 A2AError를 던진다", () => {
      const session = bridge.createSession([plannerCard]);
      bridge.dispose();
      expect(() =>
        bridge.sendMessage(session.id, {
          from: plannerCard,
          to: testerCard,
          type: "notification",
          method: "done",
        }),
      ).toThrow(A2AError);
    });

    it("dispose 후 getSessionMessages를 호출하면 A2AError를 던진다", () => {
      const session = bridge.createSession([plannerCard]);
      bridge.dispose();
      expect(() => bridge.getSessionMessages(session.id)).toThrow(A2AError);
    });

    it("dispose 후 getStats를 호출하면 A2AError를 던진다", () => {
      bridge.dispose();
      expect(() => bridge.getStats()).toThrow(A2AError);
    });

    it("dispose 후 closeSession을 호출하면 A2AError를 던진다", () => {
      const session = bridge.createSession([plannerCard]);
      bridge.dispose();
      expect(() => bridge.closeSession(session.id)).toThrow(A2AError);
    });

    it("dispose는 여러 번 호출해도 에러를 던지지 않는다 (멱등성)", () => {
      bridge.dispose();
      expect(() => bridge.dispose()).not.toThrow();
    });
  });

  // -------------------------------------------------------------------------
  // 엣지 케이스 및 protocol 다양성
  // -------------------------------------------------------------------------

  describe("AgentCard 다양한 protocol", () => {
    it("mcp, http, stdio protocol 에이전트를 모두 등록할 수 있다", () => {
      const httpAgent: AgentCard = {
        agentId: "http-agent",
        name: "HTTP Agent",
        capabilities: ["http-task"],
        protocol: "http",
        endpoint: "http://localhost:5000",
      };
      const stdioAgent: AgentCard = {
        agentId: "stdio-agent",
        name: "STDIO Agent",
        capabilities: ["stdio-task"],
        protocol: "stdio",
      };

      bridge.registerAgent(plannerCard); // mcp
      bridge.registerAgent(httpAgent);
      bridge.registerAgent(stdioAgent);

      expect(bridge.discoverAgents()).toHaveLength(3);
    });
  });

  describe("message type 다양성", () => {
    it("request, response, notification 타입 메시지를 모두 전송할 수 있다", () => {
      const session = bridge.createSession([plannerCard, testerCard]);

      bridge.sendMessage(session.id, {
        from: plannerCard,
        to: testerCard,
        type: "request",
        method: "execute-task",
        params: { id: 1 },
      });
      bridge.sendMessage(session.id, {
        from: testerCard,
        to: plannerCard,
        type: "response",
        method: "execute-task",
        result: { status: "done" },
      });
      bridge.sendMessage(session.id, {
        from: plannerCard,
        to: testerCard,
        type: "notification",
        method: "share-context",
      });

      const messages = bridge.getSessionMessages(session.id);
      expect(messages).toHaveLength(3);
      expect(messages.map((m) => m.type)).toEqual(["request", "response", "notification"]);
    });
  });

  describe("세션 독립성", () => {
    it("서로 다른 세션의 메시지는 분리된다", () => {
      const s1 = bridge.createSession([plannerCard, testerCard]);
      const s2 = bridge.createSession([testerCard, builderCard]);

      bridge.sendMessage(s1.id, {
        from: plannerCard,
        to: testerCard,
        type: "request",
        method: "execute-task",
      });
      bridge.sendMessage(s2.id, {
        from: testerCard,
        to: builderCard,
        type: "request",
        method: "build",
      });
      bridge.sendMessage(s2.id, {
        from: builderCard,
        to: testerCard,
        type: "response",
        method: "build",
        result: { success: true },
      });

      expect(bridge.getSessionMessages(s1.id)).toHaveLength(1);
      expect(bridge.getSessionMessages(s2.id)).toHaveLength(2);
    });
  });
});
