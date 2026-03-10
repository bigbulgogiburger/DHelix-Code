import { describe, it, expect, beforeEach } from "vitest";
import {
  SharedAgentStateImpl,
  createSharedAgentState,
  type AgentMessage,
  type SharedAgentState,
} from "../../../src/subagents/shared-state.js";

describe("SharedAgentStateImpl", () => {
  let state: SharedAgentStateImpl;

  beforeEach(() => {
    state = new SharedAgentStateImpl();
  });

  // ---------------------------------------------------------------------------
  // Key-value store
  // ---------------------------------------------------------------------------

  describe("set/get/getAll", () => {
    it("should store and retrieve a string value", () => {
      state.set("key1", "value1");
      expect(state.get("key1")).toBe("value1");
    });

    it("should store and retrieve complex objects", () => {
      const obj = { nested: { count: 42 }, tags: ["a", "b"] };
      state.set("config", obj);
      expect(state.get("config")).toEqual(obj);
    });

    it("should store and retrieve numeric values", () => {
      state.set("counter", 0);
      expect(state.get("counter")).toBe(0);
    });

    it("should store null and undefined values", () => {
      state.set("nullVal", null);
      state.set("undefVal", undefined);
      expect(state.get("nullVal")).toBeNull();
      expect(state.get("undefVal")).toBeUndefined();
    });

    it("should return undefined for non-existent keys", () => {
      expect(state.get("nonexistent")).toBeUndefined();
    });

    it("should overwrite existing values", () => {
      state.set("key", "first");
      state.set("key", "second");
      expect(state.get("key")).toBe("second");
    });

    it("should return all key-value pairs via getAll", () => {
      state.set("a", 1);
      state.set("b", 2);
      state.set("c", 3);

      const all = state.getAll();
      expect(all.size).toBe(3);
      expect(all.get("a")).toBe(1);
      expect(all.get("b")).toBe(2);
      expect(all.get("c")).toBe(3);
    });

    it("should return empty map when no keys are set", () => {
      const all = state.getAll();
      expect(all.size).toBe(0);
    });

    it("getAll should return a ReadonlyMap", () => {
      state.set("x", 1);
      const all = state.getAll();
      // ReadonlyMap doesn't have set method — this verifies the type
      expect(typeof all.get).toBe("function");
      expect(typeof all.has).toBe("function");
      expect(typeof all.size).toBe("number");
    });
  });

  // ---------------------------------------------------------------------------
  // Inter-agent messaging
  // ---------------------------------------------------------------------------

  describe("send/getMessages", () => {
    it("should send and retrieve a targeted message", () => {
      const message: AgentMessage = {
        fromAgentId: "agent-1",
        toAgentId: "agent-2",
        type: "result",
        content: "Analysis complete",
        timestamp: Date.now(),
      };

      state.send(message);

      const msgs = state.getMessages("agent-2");
      expect(msgs).toHaveLength(1);
      expect(msgs[0].content).toBe("Analysis complete");
      expect(msgs[0].fromAgentId).toBe("agent-1");
    });

    it("should include broadcasts in getMessages for any agent", () => {
      const broadcast: AgentMessage = {
        fromAgentId: "agent-1",
        type: "progress",
        content: "Starting phase 2",
        timestamp: Date.now(),
      };

      state.send(broadcast);

      // Both agents should see the broadcast
      expect(state.getMessages("agent-2")).toHaveLength(1);
      expect(state.getMessages("agent-3")).toHaveLength(1);
    });

    it("should not return messages addressed to other agents", () => {
      const targeted: AgentMessage = {
        fromAgentId: "agent-1",
        toAgentId: "agent-2",
        type: "result",
        content: "For agent-2 only",
        timestamp: Date.now(),
      };

      state.send(targeted);

      // agent-3 should not see messages addressed to agent-2
      expect(state.getMessages("agent-3")).toHaveLength(0);
    });

    it("should return both targeted and broadcast messages combined", () => {
      const broadcast: AgentMessage = {
        fromAgentId: "agent-1",
        type: "progress",
        content: "broadcast",
        timestamp: Date.now(),
      };

      const targeted: AgentMessage = {
        fromAgentId: "agent-1",
        toAgentId: "agent-2",
        type: "result",
        content: "targeted",
        timestamp: Date.now(),
      };

      state.send(broadcast);
      state.send(targeted);

      const msgs = state.getMessages("agent-2");
      expect(msgs).toHaveLength(2);
    });

    it("should handle multiple messages from different senders", () => {
      state.send({
        fromAgentId: "agent-1",
        toAgentId: "agent-3",
        type: "result",
        content: "from agent-1",
        timestamp: Date.now(),
      });

      state.send({
        fromAgentId: "agent-2",
        toAgentId: "agent-3",
        type: "result",
        content: "from agent-2",
        timestamp: Date.now(),
      });

      const msgs = state.getMessages("agent-3");
      expect(msgs).toHaveLength(2);
      expect(msgs[0].fromAgentId).toBe("agent-1");
      expect(msgs[1].fromAgentId).toBe("agent-2");
    });
  });

  describe("getBroadcasts", () => {
    it("should return only broadcast messages (no toAgentId)", () => {
      state.send({
        fromAgentId: "agent-1",
        type: "progress",
        content: "broadcast 1",
        timestamp: Date.now(),
      });

      state.send({
        fromAgentId: "agent-2",
        toAgentId: "agent-3",
        type: "result",
        content: "targeted message",
        timestamp: Date.now(),
      });

      state.send({
        fromAgentId: "agent-2",
        type: "progress",
        content: "broadcast 2",
        timestamp: Date.now(),
      });

      const broadcasts = state.getBroadcasts();
      expect(broadcasts).toHaveLength(2);
      expect(broadcasts[0].content).toBe("broadcast 1");
      expect(broadcasts[1].content).toBe("broadcast 2");
    });

    it("should return empty array when no broadcasts exist", () => {
      state.send({
        fromAgentId: "agent-1",
        toAgentId: "agent-2",
        type: "result",
        content: "targeted only",
        timestamp: Date.now(),
      });

      expect(state.getBroadcasts()).toHaveLength(0);
    });
  });

  // ---------------------------------------------------------------------------
  // Message queue bounded size
  // ---------------------------------------------------------------------------

  describe("message queue bounded size (max 200)", () => {
    it("should evict oldest messages when exceeding 200", () => {
      // Send 210 messages
      for (let i = 0; i < 210; i++) {
        state.send({
          fromAgentId: "agent-1",
          type: "progress",
          content: `message-${i}`,
          timestamp: i,
        });
      }

      const broadcasts = state.getBroadcasts();
      expect(broadcasts.length).toBe(200);

      // Oldest messages (0-9) should have been evicted
      expect(broadcasts[0].content).toBe("message-10");
      // Most recent should still be present
      expect(broadcasts[broadcasts.length - 1].content).toBe("message-209");
    });

    it("should keep exactly MAX_MESSAGE_QUEUE_SIZE after eviction", () => {
      for (let i = 0; i < 300; i++) {
        state.send({
          fromAgentId: "agent-1",
          type: "progress",
          content: `msg-${i}`,
          timestamp: i,
        });
      }

      const broadcasts = state.getBroadcasts();
      expect(broadcasts.length).toBe(200);
    });

    it("should not evict when at or under 200 messages", () => {
      for (let i = 0; i < 200; i++) {
        state.send({
          fromAgentId: "agent-1",
          type: "progress",
          content: `msg-${i}`,
          timestamp: i,
        });
      }

      const broadcasts = state.getBroadcasts();
      expect(broadcasts.length).toBe(200);
      expect(broadcasts[0].content).toBe("msg-0"); // Nothing evicted
    });
  });

  // ---------------------------------------------------------------------------
  // Progress tracking
  // ---------------------------------------------------------------------------

  describe("reportProgress/getProgress", () => {
    it("should report and retrieve progress for an agent", () => {
      state.reportProgress("agent-1", 0.5, "Analyzing files");

      const progress = state.getProgress();
      expect(progress.size).toBe(1);

      const entry = progress.get("agent-1");
      expect(entry).toBeDefined();
      expect(entry!.progress).toBe(0.5);
      expect(entry!.status).toBe("Analyzing files");
    });

    it("should update progress for the same agent", () => {
      state.reportProgress("agent-1", 0.25, "Starting");
      state.reportProgress("agent-1", 0.75, "Almost done");

      const entry = state.getProgress().get("agent-1");
      expect(entry!.progress).toBe(0.75);
      expect(entry!.status).toBe("Almost done");
    });

    it("should track progress for multiple agents independently", () => {
      state.reportProgress("agent-1", 0.3, "Phase 1");
      state.reportProgress("agent-2", 0.7, "Phase 3");

      const progress = state.getProgress();
      expect(progress.size).toBe(2);
      expect(progress.get("agent-1")!.progress).toBe(0.3);
      expect(progress.get("agent-2")!.progress).toBe(0.7);
    });

    it("should clamp progress to [0, 1] range", () => {
      state.reportProgress("agent-1", -0.5, "underflow");
      expect(state.getProgress().get("agent-1")!.progress).toBe(0);

      state.reportProgress("agent-2", 1.5, "overflow");
      expect(state.getProgress().get("agent-2")!.progress).toBe(1);
    });

    it("should return empty map when no progress is reported", () => {
      expect(state.getProgress().size).toBe(0);
    });
  });

  // ---------------------------------------------------------------------------
  // Cleanup
  // ---------------------------------------------------------------------------

  describe("cleanup", () => {
    it("should clear all state, messages, and progress", () => {
      // Set up some state
      state.set("key1", "value1");
      state.set("key2", "value2");

      state.send({
        fromAgentId: "agent-1",
        type: "result",
        content: "test",
        timestamp: Date.now(),
      });

      state.reportProgress("agent-1", 0.5, "working");

      // Verify state exists
      expect(state.getAll().size).toBe(2);
      expect(state.getBroadcasts()).toHaveLength(1);
      expect(state.getProgress().size).toBe(1);

      // Cleanup
      state.cleanup();

      // Verify everything is cleared
      expect(state.getAll().size).toBe(0);
      expect(state.get("key1")).toBeUndefined();
      expect(state.getBroadcasts()).toHaveLength(0);
      expect(state.getMessages("agent-1")).toHaveLength(0);
      expect(state.getProgress().size).toBe(0);
    });

    it("should allow re-use after cleanup", () => {
      state.set("before", "cleanup");
      state.cleanup();

      state.set("after", "cleanup");
      expect(state.get("before")).toBeUndefined();
      expect(state.get("after")).toBe("cleanup");
    });
  });
});

// =============================================================================
// Factory function
// =============================================================================

describe("createSharedAgentState", () => {
  it("should create a SharedAgentState instance", () => {
    const state = createSharedAgentState();
    expect(state).toBeDefined();
    expect(typeof state.set).toBe("function");
    expect(typeof state.get).toBe("function");
    expect(typeof state.send).toBe("function");
    expect(typeof state.cleanup).toBe("function");
  });

  it("should create independent instances", () => {
    const state1 = createSharedAgentState();
    const state2 = createSharedAgentState();

    state1.set("shared", "state1");
    expect(state2.get("shared")).toBeUndefined();
  });
});
