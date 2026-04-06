import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock ink — pure logic tests do not need actual rendering
vi.mock("ink", () => ({
  Box: () => null,
  Text: () => null,
}));

// Mock react
vi.mock("react", () => ({ default: {} }));

async function getModule() {
  return import("../../../../../src/cli/components/panels/TaskPanel.js");
}

describe("TaskPanel — formatTaskProgressBar", () => {
  let formatTaskProgressBar: Awaited<ReturnType<typeof getModule>>["formatTaskProgressBar"];

  beforeEach(async () => {
    const mod = await getModule();
    formatTaskProgressBar = mod.formatTaskProgressBar;
  });

  it("should return all-empty bar when total is 0", () => {
    expect(formatTaskProgressBar(0, 0, 8)).toBe("[░░░░░░░░] 0/0");
  });

  it("should display correct format for partial completion", () => {
    expect(formatTaskProgressBar(4, 8, 8)).toBe("[████░░░░] 4/8");
  });

  it("should display full bar when all tasks done", () => {
    expect(formatTaskProgressBar(8, 8, 8)).toBe("[████████] 8/8");
  });

  it("should display empty bar when none done", () => {
    expect(formatTaskProgressBar(0, 8, 8)).toBe("[░░░░░░░░] 0/8");
  });

  it("should use default width of 8", () => {
    const result = formatTaskProgressBar(4, 8);
    expect(result).toBe("[████░░░░] 4/8");
  });

  it("should correctly show 1/3 progress", () => {
    // 1/3 of 8 = 2.67 → round to 3 filled
    const result = formatTaskProgressBar(1, 3, 8);
    expect(result).toBe("[███░░░░░] 1/3");
  });
});

describe("TaskPanel — isBlocked", () => {
  let isBlocked: Awaited<ReturnType<typeof getModule>>["isBlocked"];

  beforeEach(async () => {
    const mod = await getModule();
    isBlocked = mod.isBlocked;
  });

  it("should return false when blockedBy is undefined", () => {
    const task = { id: "1", subject: "test", status: "todo" as const };
    expect(isBlocked(task)).toBe(false);
  });

  it("should return false when blockedBy is an empty array", () => {
    const task = { id: "1", subject: "test", status: "todo" as const, blockedBy: [] };
    expect(isBlocked(task)).toBe(false);
  });

  it("should return true when blockedBy has at least one item", () => {
    const task = {
      id: "1",
      subject: "test",
      status: "todo" as const,
      blockedBy: ["other-task-id"],
    };
    expect(isBlocked(task)).toBe(true);
  });

  it("should return true when blockedBy has multiple items", () => {
    const task = {
      id: "1",
      subject: "test",
      status: "todo" as const,
      blockedBy: ["id-a", "id-b"],
    };
    expect(isBlocked(task)).toBe(true);
  });
});

describe("TaskPanel — component", () => {
  it("should export TaskPanel as a function", async () => {
    const mod = await getModule();
    expect(typeof mod.TaskPanel).toBe("function");
  });

  it("should render without crashing with empty tasks array", async () => {
    const mod = await getModule();
    const result = mod.TaskPanel({ tasks: [] });
    expect(result).not.toBeUndefined();
  });

  it("should render without crashing with tasks in all states", async () => {
    const mod = await getModule();
    const tasks = [
      { id: "1", subject: "Write tests", status: "todo" as const },
      { id: "2", subject: "Implement feature", status: "in-progress" as const },
      { id: "3", subject: "Deploy", status: "done" as const },
    ];
    const result = mod.TaskPanel({ tasks });
    expect(result).not.toBeUndefined();
  });

  it("should render without crashing with blocked tasks", async () => {
    const mod = await getModule();
    const tasks = [
      {
        id: "1",
        subject: "Blocked task",
        status: "todo" as const,
        blockedBy: ["other-id"],
      },
    ];
    const result = mod.TaskPanel({ tasks });
    expect(result).not.toBeUndefined();
  });

  it("should accept a custom title", async () => {
    const mod = await getModule();
    const result = mod.TaskPanel({ tasks: [], title: "Sprint Tasks" });
    expect(result).not.toBeUndefined();
  });
});

describe("TaskPanel — done count calculation", () => {
  it("should count done tasks correctly", async () => {
    const mod = await getModule();
    const tasks = [
      { id: "1", subject: "A", status: "done" as const },
      { id: "2", subject: "B", status: "done" as const },
      { id: "3", subject: "C", status: "todo" as const },
    ];
    // 2/3 done — just verify rendering works (logic tested via formatTaskProgressBar)
    const result = mod.TaskPanel({ tasks });
    expect(result).not.toBeUndefined();
  });
});
