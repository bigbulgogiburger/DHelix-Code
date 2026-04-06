import { describe, it, expect, beforeEach } from "vitest";
import {
  OrchestrationEventStore,
  type OrchestratedEvent,
  type EventFilter,
} from "../../../src/subagents/orchestration-store.js";

// ---------------------------------------------------------------------------
// 헬퍼
// ---------------------------------------------------------------------------

function makeSpawnEvent(agentId: string, timestamp = Date.now()): OrchestratedEvent {
  return { type: "agent-spawned", agentId, timestamp };
}

function makeCompletedEvent(agentId: string, duration = 100, timestamp = Date.now()): OrchestratedEvent {
  return { type: "agent-completed", agentId, duration, timestamp };
}

function makeFailedEvent(
  agentId: string,
  error = "timeout",
  retryable = true,
  timestamp = Date.now(),
): OrchestratedEvent {
  return { type: "agent-failed", agentId, error, retryable, timestamp };
}

function makeMessageEvent(
  fromAgentId: string,
  toAgentId: string,
  topic = "result",
  timestamp = Date.now(),
): OrchestratedEvent {
  return { type: "message-sent", fromAgentId, toAgentId, topic, timestamp };
}

function makeQuotaEvent(
  agentId: string,
  tokens: number,
  cost: number,
  timestamp = Date.now(),
): OrchestratedEvent {
  return { type: "quota-consumed", agentId, tokens, cost, timestamp };
}

function makeModelSwitchedEvent(
  fromModel = "claude-haiku",
  toModel = "claude-sonnet",
  trigger = "cost-threshold",
  timestamp = Date.now(),
): OrchestratedEvent {
  return { type: "model-switched", fromModel, toModel, trigger, timestamp };
}

// ---------------------------------------------------------------------------
// 테스트
// ---------------------------------------------------------------------------

describe("OrchestrationEventStore", () => {
  let store: OrchestrationEventStore;

  beforeEach(() => {
    store = new OrchestrationEventStore();
  });

  // ---------------------------------------------------------------------------
  // append / getEventCount
  // ---------------------------------------------------------------------------

  describe("append", () => {
    it("should return a unique UUID for each event", () => {
      const id1 = store.append(makeSpawnEvent("a1"));
      const id2 = store.append(makeSpawnEvent("a2"));
      expect(id1).not.toBe(id2);
      expect(id1).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
      );
    });

    it("should increment getEventCount after each append", () => {
      expect(store.getEventCount()).toBe(0);
      store.append(makeSpawnEvent("a1"));
      expect(store.getEventCount()).toBe(1);
      store.append(makeCompletedEvent("a1"));
      expect(store.getEventCount()).toBe(2);
    });
  });

  // ---------------------------------------------------------------------------
  // query — no filter
  // ---------------------------------------------------------------------------

  describe("query (no filter)", () => {
    it("should return all events in insertion order", () => {
      const e1 = makeSpawnEvent("a1", 1000);
      const e2 = makeCompletedEvent("a1", 50, 2000);
      store.append(e1);
      store.append(e2);

      const result = store.query();
      expect(result).toHaveLength(2);
      expect(result[0]).toEqual(e1);
      expect(result[1]).toEqual(e2);
    });

    it("should return empty array when store is empty", () => {
      expect(store.query()).toEqual([]);
    });
  });

  // ---------------------------------------------------------------------------
  // query — timestamp filter
  // ---------------------------------------------------------------------------

  describe("query (timestamp filter)", () => {
    beforeEach(() => {
      store.append(makeSpawnEvent("a1", 1000));
      store.append(makeSpawnEvent("a2", 2000));
      store.append(makeSpawnEvent("a3", 3000));
    });

    it("should filter by fromTimestamp (inclusive)", () => {
      const result = store.query({ fromTimestamp: 2000 });
      expect(result).toHaveLength(2);
      expect(result.map((e) => (e as { agentId: string }).agentId)).toEqual(["a2", "a3"]);
    });

    it("should filter by toTimestamp (inclusive)", () => {
      const result = store.query({ toTimestamp: 2000 });
      expect(result).toHaveLength(2);
      expect(result.map((e) => (e as { agentId: string }).agentId)).toEqual(["a1", "a2"]);
    });

    it("should filter by both fromTimestamp and toTimestamp", () => {
      const result = store.query({ fromTimestamp: 2000, toTimestamp: 2000 });
      expect(result).toHaveLength(1);
      expect((result[0] as { agentId: string }).agentId).toBe("a2");
    });

    it("should return empty when range excludes all events", () => {
      const result = store.query({ fromTimestamp: 9999 });
      expect(result).toHaveLength(0);
    });
  });

  // ---------------------------------------------------------------------------
  // query — agentId filter
  // ---------------------------------------------------------------------------

  describe("query (agentId filter)", () => {
    beforeEach(() => {
      store.append(makeSpawnEvent("agent-A", 1000));
      store.append(makeSpawnEvent("agent-B", 2000));
      store.append(makeCompletedEvent("agent-A", 100, 3000));
      store.append(makeMessageEvent("agent-A", "agent-B", "result", 4000));
    });

    it("should return events for specific agentId", () => {
      const result = store.query({ agentId: "agent-A" });
      // agent-spawned(A), agent-completed(A), message-sent(from A to B) — 3개
      expect(result).toHaveLength(3);
    });

    it("should include message-sent when agentId is toAgentId", () => {
      const result = store.query({ agentId: "agent-B" });
      // agent-spawned(B), message-sent(from A to B) — 2개
      expect(result).toHaveLength(2);
    });

    it("should return empty for unknown agentId", () => {
      const result = store.query({ agentId: "unknown-agent" });
      expect(result).toHaveLength(0);
    });
  });

  // ---------------------------------------------------------------------------
  // query — eventTypes filter
  // ---------------------------------------------------------------------------

  describe("query (eventTypes filter)", () => {
    beforeEach(() => {
      store.append(makeSpawnEvent("a1", 1000));
      store.append(makeCompletedEvent("a1", 50, 2000));
      store.append(makeFailedEvent("a2", "error", true, 3000));
      store.append(makeQuotaEvent("a1", 1000, 0.01, 4000));
    });

    it("should filter by single event type", () => {
      const result = store.query({ eventTypes: ["agent-spawned"] });
      expect(result).toHaveLength(1);
      expect(result[0].type).toBe("agent-spawned");
    });

    it("should filter by multiple event types", () => {
      const result = store.query({ eventTypes: ["agent-completed", "agent-failed"] });
      expect(result).toHaveLength(2);
    });

    it("should return empty for unmatched event type", () => {
      const result = store.query({ eventTypes: ["model-switched"] });
      expect(result).toHaveLength(0);
    });

    it("should return all events when eventTypes is empty array", () => {
      const result = store.query({ eventTypes: [] });
      expect(result).toHaveLength(4);
    });
  });

  // ---------------------------------------------------------------------------
  // query — combined filters
  // ---------------------------------------------------------------------------

  describe("query (combined filters)", () => {
    it("should apply agentId and eventTypes filters together", () => {
      store.append(makeSpawnEvent("a1", 1000));
      store.append(makeSpawnEvent("a2", 2000));
      store.append(makeCompletedEvent("a1", 50, 3000));

      const result = store.query({ agentId: "a1", eventTypes: ["agent-spawned"] });
      expect(result).toHaveLength(1);
      expect(result[0].type).toBe("agent-spawned");
    });
  });

  // ---------------------------------------------------------------------------
  // getAgentTimeline
  // ---------------------------------------------------------------------------

  describe("getAgentTimeline", () => {
    it("should return all events related to an agent in order", () => {
      store.append(makeSpawnEvent("a1", 1000));
      store.append(makeQuotaEvent("a1", 500, 0.005, 2000));
      store.append(makeCompletedEvent("a1", 100, 3000));

      const timeline = store.getAgentTimeline("a1");
      expect(timeline).toHaveLength(3);
      expect(timeline[0].type).toBe("agent-spawned");
      expect(timeline[1].type).toBe("quota-consumed");
      expect(timeline[2].type).toBe("agent-completed");
    });

    it("should return empty timeline for unknown agent", () => {
      store.append(makeSpawnEvent("a1"));
      expect(store.getAgentTimeline("unknown")).toHaveLength(0);
    });
  });

  // ---------------------------------------------------------------------------
  // getCostSummary
  // ---------------------------------------------------------------------------

  describe("getCostSummary", () => {
    it("should return zeros when no quota events", () => {
      store.append(makeSpawnEvent("a1"));
      const summary = store.getCostSummary();
      expect(summary.totalTokens).toBe(0);
      expect(summary.totalCost).toBe(0);
      expect(summary.byAgent).toEqual({});
    });

    it("should aggregate tokens and cost from quota-consumed events", () => {
      store.append(makeQuotaEvent("agent-A", 1000, 0.01));
      store.append(makeQuotaEvent("agent-A", 500, 0.005));
      store.append(makeQuotaEvent("agent-B", 2000, 0.02));

      const summary = store.getCostSummary();
      expect(summary.totalTokens).toBe(3500);
      expect(summary.totalCost).toBeCloseTo(0.035, 10);
      expect(summary.byAgent["agent-A"]).toBeCloseTo(0.015, 10);
      expect(summary.byAgent["agent-B"]).toBeCloseTo(0.02, 10);
    });

    it("should not include non-quota events in cost summary", () => {
      store.append(makeSpawnEvent("a1"));
      store.append(makeCompletedEvent("a1", 100));
      store.append(makeQuotaEvent("a1", 100, 0.001));

      const summary = store.getCostSummary();
      expect(summary.totalTokens).toBe(100);
      expect(Object.keys(summary.byAgent)).toHaveLength(1);
    });
  });

  // ---------------------------------------------------------------------------
  // clear
  // ---------------------------------------------------------------------------

  describe("clear", () => {
    it("should remove all events from the store", () => {
      store.append(makeSpawnEvent("a1"));
      store.append(makeCompletedEvent("a1", 100));
      expect(store.getEventCount()).toBe(2);

      store.clear();
      expect(store.getEventCount()).toBe(0);
      expect(store.query()).toEqual([]);
    });

    it("should allow appending after clear", () => {
      store.append(makeSpawnEvent("a1"));
      store.clear();
      store.append(makeSpawnEvent("a2"));

      expect(store.getEventCount()).toBe(1);
      const events = store.query();
      expect((events[0] as { agentId: string }).agentId).toBe("a2");
    });
  });

  // ---------------------------------------------------------------------------
  // export
  // ---------------------------------------------------------------------------

  describe("export", () => {
    it("should return empty string when store is empty", () => {
      expect(store.export()).toBe("");
    });

    it("should produce valid JSONL with one line per event", () => {
      store.append(makeSpawnEvent("a1", 1000));
      store.append(makeCompletedEvent("a1", 50, 2000));

      const exported = store.export();
      const lines = exported.split("\n");
      expect(lines).toHaveLength(2);

      // 각 줄이 유효한 JSON인지 확인
      for (const line of lines) {
        expect(() => JSON.parse(line)).not.toThrow();
      }
    });

    it("should include eventId in each exported line", () => {
      store.append(makeSpawnEvent("a1", 1000));
      const exported = store.export();
      const parsed = JSON.parse(exported) as Record<string, unknown>;
      expect(parsed).toHaveProperty("eventId");
      expect(typeof parsed["eventId"]).toBe("string");
    });

    it("should include event fields in each exported line", () => {
      store.append(makeSpawnEvent("agent-test", 1000));
      const exported = store.export();
      const parsed = JSON.parse(exported) as Record<string, unknown>;
      expect(parsed["type"]).toBe("agent-spawned");
      expect(parsed["agentId"]).toBe("agent-test");
      expect(parsed["timestamp"]).toBe(1000);
    });

    it("should include parentId when set on agent-spawned event", () => {
      const event: OrchestratedEvent = {
        type: "agent-spawned",
        agentId: "child",
        parentId: "parent",
        timestamp: 1000,
      };
      store.append(event);
      const parsed = JSON.parse(store.export()) as Record<string, unknown>;
      expect(parsed["parentId"]).toBe("parent");
    });
  });

  // ---------------------------------------------------------------------------
  // 이벤트 타입별 저장 검증
  // ---------------------------------------------------------------------------

  describe("event type coverage", () => {
    it("should store and retrieve model-switched event", () => {
      store.append(makeModelSwitchedEvent("haiku", "sonnet", "complexity"));
      const events = store.query({ eventTypes: ["model-switched"] });
      expect(events).toHaveLength(1);
      expect(events[0].type).toBe("model-switched");
    });

    it("should store message-sent event with correct fields", () => {
      store.append(makeMessageEvent("sender", "receiver", "analysis"));
      const events = store.query({ eventTypes: ["message-sent"] });
      expect(events).toHaveLength(1);
      const ev = events[0];
      if (ev.type === "message-sent") {
        expect(ev.fromAgentId).toBe("sender");
        expect(ev.toAgentId).toBe("receiver");
        expect(ev.topic).toBe("analysis");
      }
    });

    it("should store agent-failed event with retryable field", () => {
      store.append(makeFailedEvent("a1", "OOM", false));
      const events = store.query({ eventTypes: ["agent-failed"] });
      expect(events).toHaveLength(1);
      const ev = events[0];
      if (ev.type === "agent-failed") {
        expect(ev.retryable).toBe(false);
        expect(ev.error).toBe("OOM");
      }
    });
  });
});
