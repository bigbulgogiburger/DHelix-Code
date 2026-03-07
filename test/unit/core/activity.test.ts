import { describe, it, expect } from "vitest";
import { ActivityCollector } from "../../../src/core/activity.js";

describe("ActivityCollector", () => {
  it("should start a turn and return an id", () => {
    const collector = new ActivityCollector();
    const id = collector.startTurn();
    expect(id).toBeTruthy();
    expect(typeof id).toBe("string");
  });

  it("should throw when adding entry without active turn", () => {
    const collector = new ActivityCollector();
    expect(() => collector.addEntry("user-message")).toThrow("No active turn");
  });

  it("should add entries to the current turn", () => {
    const collector = new ActivityCollector();
    collector.startTurn();
    collector.addEntry("user-message", { content: "Hello" });
    collector.addEntry("assistant-text", { content: "Hi there" });

    const current = collector.getCurrentTurn();
    expect(current).not.toBeNull();
    expect(current!.entries).toHaveLength(2);
    expect(current!.entries[0].type).toBe("user-message");
    expect(current!.entries[0].data.content).toBe("Hello");
    expect(current!.entries[1].type).toBe("assistant-text");
    expect(current!.isComplete).toBe(false);
  });

  it("should complete the current turn", () => {
    const collector = new ActivityCollector();
    collector.startTurn();
    collector.addEntry("user-message", { content: "test" });
    collector.completeTurn();

    expect(collector.getCurrentTurn()).toBeNull();
    const completed = collector.getCompletedTurns();
    expect(completed).toHaveLength(1);
    expect(completed[0].isComplete).toBe(true);
    expect(completed[0].entries).toHaveLength(1);
  });

  it("should auto-complete previous turn when starting a new one", () => {
    const collector = new ActivityCollector();
    collector.startTurn();
    collector.addEntry("user-message", { content: "first" });

    collector.startTurn();
    collector.addEntry("user-message", { content: "second" });

    const completed = collector.getCompletedTurns();
    expect(completed).toHaveLength(1);
    expect(completed[0].entries[0].data.content).toBe("first");

    const current = collector.getCurrentTurn();
    expect(current).not.toBeNull();
    expect(current!.entries[0].data.content).toBe("second");
  });

  it("should handle completeTurn when no turn is active (no-op)", () => {
    const collector = new ActivityCollector();
    expect(() => collector.completeTurn()).not.toThrow();
  });

  it("should return null for getCurrentTurn when no turn is active", () => {
    const collector = new ActivityCollector();
    expect(collector.getCurrentTurn()).toBeNull();
  });

  it("should return empty array for getCompletedTurns initially", () => {
    const collector = new ActivityCollector();
    expect(collector.getCompletedTurns()).toEqual([]);
  });

  it("should track tool-start and tool-complete entries", () => {
    const collector = new ActivityCollector();
    collector.startTurn();
    collector.addEntry("tool-start", { name: "file_read", id: "tc-1" });
    collector.addEntry("tool-complete", { name: "file_read", id: "tc-1", isError: false });

    const current = collector.getCurrentTurn();
    expect(current!.entries).toHaveLength(2);
    expect(current!.entries[0].type).toBe("tool-start");
    expect(current!.entries[1].type).toBe("tool-complete");
  });

  it("should track tool-denied entries", () => {
    const collector = new ActivityCollector();
    collector.startTurn();
    collector.addEntry("tool-denied", { name: "bash_exec", reason: "User rejected" });

    const current = collector.getCurrentTurn();
    expect(current!.entries[0].type).toBe("tool-denied");
    expect(current!.entries[0].data.reason).toBe("User rejected");
  });

  it("should track error entries", () => {
    const collector = new ActivityCollector();
    collector.startTurn();
    collector.addEntry("error", { message: "LLM timeout" });

    const current = collector.getCurrentTurn();
    expect(current!.entries[0].type).toBe("error");
    expect(current!.entries[0].data.message).toBe("LLM timeout");
  });

  it("should include timestamp on each entry", () => {
    const collector = new ActivityCollector();
    collector.startTurn();
    collector.addEntry("user-message", { content: "test" });

    const current = collector.getCurrentTurn();
    expect(current!.entries[0].timestamp).toBeInstanceOf(Date);
  });

  it("should return all turns via getAllTurns", () => {
    const collector = new ActivityCollector();

    // Complete first turn
    collector.startTurn();
    collector.addEntry("user-message", { content: "first" });
    collector.completeTurn();

    // Start second (in progress)
    collector.startTurn();
    collector.addEntry("user-message", { content: "second" });

    const all = collector.getAllTurns();
    expect(all).toHaveLength(2);
    expect(all[0].isComplete).toBe(true);
    expect(all[1].isComplete).toBe(false);
  });

  it("should return only completed turns in getAllTurns when no active turn", () => {
    const collector = new ActivityCollector();
    collector.startTurn();
    collector.addEntry("user-message", { content: "done" });
    collector.completeTurn();

    const all = collector.getAllTurns();
    expect(all).toHaveLength(1);
    expect(all[0].isComplete).toBe(true);
  });

  it("should preserve entry data immutably", () => {
    const collector = new ActivityCollector();
    collector.startTurn();
    collector.addEntry("user-message", { content: "original" });

    const turn1 = collector.getCurrentTurn();
    collector.addEntry("assistant-text", { content: "reply" });
    const turn2 = collector.getCurrentTurn();

    // turn1 snapshot should not be affected by later additions
    expect(turn1!.entries).toHaveLength(1);
    expect(turn2!.entries).toHaveLength(2);
  });

  it("should generate unique turn IDs", () => {
    const collector = new ActivityCollector();
    const id1 = collector.startTurn();
    collector.completeTurn();
    const id2 = collector.startTurn();

    expect(id1).not.toBe(id2);
  });
});
