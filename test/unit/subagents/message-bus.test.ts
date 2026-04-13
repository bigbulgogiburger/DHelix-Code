import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  AgentMessageBus,
  matchTopicGlob,
  type AgentMessage,
} from "../../../src/subagents/message-bus.js";

// ---------------------------------------------------------------------------
// 헬퍼
// ---------------------------------------------------------------------------

function flushMicrotasks(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

// ---------------------------------------------------------------------------
// matchTopicGlob 유닛 테스트
// ---------------------------------------------------------------------------

describe("matchTopicGlob", () => {
  it("정확한 문자열이 매칭된다", () => {
    expect(matchTopicGlob("type-export", "type-export")).toBe(true);
  });

  it("불일치 문자열은 매칭되지 않는다", () => {
    expect(matchTopicGlob("type-export", "schema-decision")).toBe(false);
  });

  it("* 와일드카드가 접미사 매칭된다", () => {
    expect(matchTopicGlob("type-*", "type-export")).toBe(true);
    expect(matchTopicGlob("type-*", "type-import")).toBe(true);
    expect(matchTopicGlob("type-*", "schema-decision")).toBe(false);
  });

  it("* 와일드카드가 접두사 매칭된다", () => {
    expect(matchTopicGlob("*-export", "type-export")).toBe(true);
    expect(matchTopicGlob("*-export", "module-export")).toBe(true);
  });

  it("단독 *는 모든 문자열에 매칭된다", () => {
    expect(matchTopicGlob("*", "anything")).toBe(true);
    expect(matchTopicGlob("*", "")).toBe(true);
  });

  it("정규식 특수문자가 이스케이프된다", () => {
    expect(matchTopicGlob("foo.bar", "foo.bar")).toBe(true);
    expect(matchTopicGlob("foo.bar", "fooXbar")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// AgentMessageBus 테스트
// ---------------------------------------------------------------------------

describe("AgentMessageBus", () => {
  let bus: AgentMessageBus;

  beforeEach(() => {
    bus = new AgentMessageBus();
  });

  // -------------------------------------------------------------------------
  // send / receive 기본 동작
  // -------------------------------------------------------------------------

  describe("send/receive", () => {
    it("메시지를 전송하고 구독자가 수신한다", async () => {
      const received: AgentMessage[] = [];

      bus.subscribe({
        agentId: "agent-2",
        handler: (msg) => {
          received.push(msg);
        },
      });

      const msgId = bus.send({
        fromAgentId: "agent-1",
        toAgentId: "agent-2",
        topic: "schema-decision",
        payload: { table: "users" },
      });

      await flushMicrotasks();

      expect(msgId).toBeTruthy();
      expect(received).toHaveLength(1);
      expect(received[0].fromAgentId).toBe("agent-1");
      expect(received[0].toAgentId).toBe("agent-2");
      expect(received[0].topic).toBe("schema-decision");
      expect(received[0].payload).toEqual({ table: "users" });
      expect(received[0].id).toBe(msgId);
      expect(received[0].timestamp).toBeGreaterThan(0);
    });

    it("다른 에이전트에게 보낸 메시지는 수신하지 않는다", async () => {
      const received: AgentMessage[] = [];

      bus.subscribe({
        agentId: "agent-3",
        handler: (msg) => {
          received.push(msg);
        },
      });

      bus.send({
        fromAgentId: "agent-1",
        toAgentId: "agent-2",
        topic: "test",
        payload: null,
      });

      await flushMicrotasks();

      expect(received).toHaveLength(0);
    });

    it("send는 고유한 메시지 ID를 반환한다", () => {
      const id1 = bus.send({
        fromAgentId: "a",
        toAgentId: "b",
        topic: "t",
        payload: null,
      });
      const id2 = bus.send({
        fromAgentId: "a",
        toAgentId: "b",
        topic: "t",
        payload: null,
      });

      expect(id1).not.toBe(id2);
    });
  });

  // -------------------------------------------------------------------------
  // broadcast
  // -------------------------------------------------------------------------

  describe("broadcast", () => {
    it("모든 구독자에게 메시지를 전달한다", async () => {
      const received2: AgentMessage[] = [];
      const received3: AgentMessage[] = [];

      bus.subscribe({ agentId: "agent-2", handler: (msg) => received2.push(msg) });
      bus.subscribe({ agentId: "agent-3", handler: (msg) => received3.push(msg) });

      bus.broadcast("agent-1", "announcement", { info: "hello" });

      await flushMicrotasks();

      expect(received2).toHaveLength(1);
      expect(received3).toHaveLength(1);
      expect(received2[0].toAgentId).toBe("*");
      expect(received2[0].topic).toBe("announcement");
    });

    it("송신자 자신은 브로드캐스트를 수신하지 않는다", async () => {
      const receivedSelf: AgentMessage[] = [];

      bus.subscribe({ agentId: "agent-1", handler: (msg) => receivedSelf.push(msg) });
      bus.subscribe({ agentId: "agent-2", handler: () => {} });

      bus.broadcast("agent-1", "test", null);

      await flushMicrotasks();

      expect(receivedSelf).toHaveLength(0);
    });
  });

  // -------------------------------------------------------------------------
  // topicFilter glob 매칭
  // -------------------------------------------------------------------------

  describe("topicFilter", () => {
    it("topicFilter glob 패턴으로 메시지를 필터링한다", async () => {
      const received: AgentMessage[] = [];

      bus.subscribe({
        agentId: "agent-2",
        topicFilter: "type-*",
        handler: (msg) => received.push(msg),
      });

      bus.send({
        fromAgentId: "agent-1",
        toAgentId: "agent-2",
        topic: "type-export",
        payload: null,
      });
      bus.send({
        fromAgentId: "agent-1",
        toAgentId: "agent-2",
        topic: "type-import",
        payload: null,
      });
      bus.send({
        fromAgentId: "agent-1",
        toAgentId: "agent-2",
        topic: "schema-decision",
        payload: null,
      });

      await flushMicrotasks();

      expect(received).toHaveLength(2);
      expect(received[0].topic).toBe("type-export");
      expect(received[1].topic).toBe("type-import");
    });

    it("topicFilter가 없으면 모든 topic을 수신한다", async () => {
      const received: AgentMessage[] = [];

      bus.subscribe({
        agentId: "agent-2",
        handler: (msg) => received.push(msg),
      });

      bus.send({ fromAgentId: "agent-1", toAgentId: "agent-2", topic: "a", payload: null });
      bus.send({ fromAgentId: "agent-1", toAgentId: "agent-2", topic: "b", payload: null });

      await flushMicrotasks();

      expect(received).toHaveLength(2);
    });
  });

  // -------------------------------------------------------------------------
  // waitForReply + timeout
  // -------------------------------------------------------------------------

  describe("waitForReply", () => {
    it("응답 메시지를 대기하고 수신한다", async () => {
      const msgId = bus.send({
        fromAgentId: "agent-1",
        toAgentId: "agent-2",
        topic: "question",
        payload: "what is x?",
      });

      const replyPromise = bus.waitForReply(msgId, 5000);

      // 약간의 지연 후 응답 전송
      setTimeout(() => {
        bus.send({
          fromAgentId: "agent-2",
          toAgentId: "agent-1",
          topic: "answer",
          payload: "x is 42",
          replyToId: msgId,
        });
      }, 10);

      const reply = await replyPromise;

      expect(reply).not.toBeNull();
      expect(reply!.payload).toBe("x is 42");
      expect(reply!.replyToId).toBe(msgId);
    });

    it("이미 도착한 응답이 있으면 즉시 반환한다", async () => {
      const msgId = bus.send({
        fromAgentId: "agent-1",
        toAgentId: "agent-2",
        topic: "question",
        payload: null,
      });

      // 응답을 먼저 전송
      bus.send({
        fromAgentId: "agent-2",
        toAgentId: "agent-1",
        topic: "answer",
        payload: "already here",
        replyToId: msgId,
      });

      const reply = await bus.waitForReply(msgId, 1000);

      expect(reply).not.toBeNull();
      expect(reply!.payload).toBe("already here");
    });

    it("타임아웃 시 null을 반환한다", async () => {
      const msgId = bus.send({
        fromAgentId: "agent-1",
        toAgentId: "agent-2",
        topic: "question",
        payload: null,
      });

      const reply = await bus.waitForReply(msgId, 50);

      expect(reply).toBeNull();
    });
  });

  // -------------------------------------------------------------------------
  // getConversation (양방향)
  // -------------------------------------------------------------------------

  describe("getConversation", () => {
    it("두 에이전트 간 양방향 대화를 반환한다", () => {
      bus.send({ fromAgentId: "agent-1", toAgentId: "agent-2", topic: "q1", payload: "hello" });
      bus.send({ fromAgentId: "agent-2", toAgentId: "agent-1", topic: "a1", payload: "hi" });
      bus.send({ fromAgentId: "agent-1", toAgentId: "agent-2", topic: "q2", payload: "how?" });
      // 다른 에이전트와의 대화는 포함되지 않아야 함
      bus.send({ fromAgentId: "agent-1", toAgentId: "agent-3", topic: "q3", payload: "hey" });

      const conversation = bus.getConversation("agent-1", "agent-2");

      expect(conversation).toHaveLength(3);
      expect(conversation[0].topic).toBe("q1");
      expect(conversation[1].topic).toBe("a1");
      expect(conversation[2].topic).toBe("q2");
    });

    it("순서가 반대여도 동일한 결과를 반환한다", () => {
      bus.send({ fromAgentId: "agent-1", toAgentId: "agent-2", topic: "msg", payload: null });

      const conv1 = bus.getConversation("agent-1", "agent-2");
      const conv2 = bus.getConversation("agent-2", "agent-1");

      expect(conv1).toHaveLength(1);
      expect(conv2).toHaveLength(1);
      expect(conv1[0].id).toBe(conv2[0].id);
    });
  });

  // -------------------------------------------------------------------------
  // getMessages
  // -------------------------------------------------------------------------

  describe("getMessages", () => {
    it("특정 에이전트에게 전달된 메시지를 반환한다", () => {
      bus.send({ fromAgentId: "agent-1", toAgentId: "agent-2", topic: "a", payload: null });
      bus.send({ fromAgentId: "agent-1", toAgentId: "agent-3", topic: "b", payload: null });
      bus.broadcast("agent-1", "c", null);

      const msgs = bus.getMessages("agent-2");

      // 직접 메시지 1개 + 브로드캐스트 1개
      expect(msgs).toHaveLength(2);
    });

    it("topic 필터로 메시지를 조회한다", () => {
      bus.send({ fromAgentId: "agent-1", toAgentId: "agent-2", topic: "a", payload: null });
      bus.send({ fromAgentId: "agent-1", toAgentId: "agent-2", topic: "b", payload: null });

      const msgs = bus.getMessages("agent-2", { topic: "a" });

      expect(msgs).toHaveLength(1);
      expect(msgs[0].topic).toBe("a");
    });
  });

  // -------------------------------------------------------------------------
  // getStats
  // -------------------------------------------------------------------------

  describe("getStats", () => {
    it("전체 통계를 올바르게 집계한다", () => {
      bus.send({
        fromAgentId: "agent-1",
        toAgentId: "agent-2",
        topic: "type-export",
        payload: null,
      });
      bus.send({
        fromAgentId: "agent-1",
        toAgentId: "agent-2",
        topic: "type-import",
        payload: null,
      });
      bus.send({
        fromAgentId: "agent-2",
        toAgentId: "agent-1",
        topic: "type-export",
        payload: null,
      });
      bus.broadcast("agent-3", "announcement", null);

      const stats = bus.getStats();

      expect(stats.totalMessages).toBe(4);
      expect(stats.byAgent).toEqual({
        "agent-1": 2,
        "agent-2": 1,
        "agent-3": 1,
      });
      expect(stats.byTopic).toEqual({
        "type-export": 2,
        "type-import": 1,
        announcement: 1,
      });
    });

    it("메시지가 없으면 빈 통계를 반환한다", () => {
      const stats = bus.getStats();

      expect(stats.totalMessages).toBe(0);
      expect(stats.byAgent).toEqual({});
      expect(stats.byTopic).toEqual({});
    });
  });

  // -------------------------------------------------------------------------
  // unsubscribe
  // -------------------------------------------------------------------------

  describe("unsubscribe", () => {
    it("구독 해제 후 메시지를 수신하지 않는다", async () => {
      const received: AgentMessage[] = [];

      const unsub = bus.subscribe({
        agentId: "agent-2",
        handler: (msg) => received.push(msg),
      });

      bus.send({ fromAgentId: "agent-1", toAgentId: "agent-2", topic: "before", payload: null });
      await flushMicrotasks();

      expect(received).toHaveLength(1);

      unsub();

      bus.send({ fromAgentId: "agent-1", toAgentId: "agent-2", topic: "after", payload: null });
      await flushMicrotasks();

      expect(received).toHaveLength(1);
      expect(received[0].topic).toBe("before");
    });

    it("같은 unsubscribe를 여러 번 호출해도 안전하다", () => {
      const unsub = bus.subscribe({
        agentId: "agent-2",
        handler: () => {},
      });

      expect(() => {
        unsub();
        unsub();
      }).not.toThrow();
    });
  });

  // -------------------------------------------------------------------------
  // clear / dispose
  // -------------------------------------------------------------------------

  describe("clear", () => {
    it("모든 메시지를 삭제한다", () => {
      bus.send({ fromAgentId: "a", toAgentId: "b", topic: "t", payload: null });
      bus.send({ fromAgentId: "a", toAgentId: "b", topic: "t", payload: null });

      expect(bus.getStats().totalMessages).toBe(2);

      bus.clear();

      expect(bus.getStats().totalMessages).toBe(0);
    });
  });

  describe("dispose", () => {
    it("dispose 후 send 호출 시 에러가 발생한다", () => {
      bus.dispose();

      expect(() =>
        bus.send({ fromAgentId: "a", toAgentId: "b", topic: "t", payload: null }),
      ).toThrow("AgentMessageBus has been disposed");
    });

    it("dispose 후 subscribe 호출 시 에러가 발생한다", () => {
      bus.dispose();

      expect(() => bus.subscribe({ agentId: "a", handler: () => {} })).toThrow(
        "AgentMessageBus has been disposed",
      );
    });
  });
});
