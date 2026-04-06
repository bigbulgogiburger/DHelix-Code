import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock react
vi.mock("react", () => {
  return {
    default: {
      memo: (component: unknown) => component,
    },
    memo: (fn: unknown) => fn,
    useMemo: (fn: () => unknown) => fn(),
    useState: (initial: unknown) => [initial, () => {}],
  };
});

// Mock ink
vi.mock("ink", () => ({
  Box: ({ children }: { children?: unknown }) => children ?? null,
  Text: ({ children }: { children?: unknown }) => children ?? null,
}));

import type { TaskDisplayItem, TaskStats } from "../../../../src/cli/components/TaskViewPanel.js";

async function getModule() {
  return import("../../../../src/cli/components/TaskViewPanel.js");
}

// ─── Test Fixtures ──────────────────────────────────────────────────────────

function makeTask(overrides: Partial<TaskDisplayItem> = {}): TaskDisplayItem {
  return {
    id: "task-1",
    title: "Test task",
    status: "pending",
    priority: "medium",
    ...overrides,
  };
}

function makeMixedTasks(): readonly TaskDisplayItem[] {
  return [
    makeTask({
      id: "t1",
      title: "Design architecture",
      status: "completed",
      priority: "critical",
      assignedTo: "architect",
    }),
    makeTask({
      id: "t2",
      title: "Implement core",
      status: "in_progress",
      priority: "critical",
      assignedTo: "developer",
    }),
    makeTask({
      id: "t3",
      title: "Write tests",
      status: "pending",
      priority: "high",
      assignedTo: "tester",
    }),
    makeTask({
      id: "t4",
      title: "Code review",
      status: "blocked",
      priority: "high",
      assignedTo: "reviewer",
      dependsOn: ["t2"],
    }),
    makeTask({
      id: "t5",
      title: "Update docs",
      status: "pending",
      priority: "medium",
      assignedTo: "writer",
    }),
  ];
}

// ─── Helper Function Tests ──────────────────────────────────────────────────

describe("TaskViewPanel helpers", () => {
  let mod: Awaited<ReturnType<typeof getModule>>;

  beforeEach(async () => {
    mod = await getModule();
  });

  // ── getStatusIcon ───────────────────────────────────────────────────────

  describe("getStatusIcon", () => {
    it("should return ○ for pending", () => {
      expect(mod.getStatusIcon("pending")).toBe("○");
    });

    it("should return ◐ for in_progress", () => {
      expect(mod.getStatusIcon("in_progress")).toBe("◐");
    });

    it("should return ● for completed", () => {
      expect(mod.getStatusIcon("completed")).toBe("●");
    });

    it("should return ✕ for failed", () => {
      expect(mod.getStatusIcon("failed")).toBe("✕");
    });

    it("should return ⊘ for blocked", () => {
      expect(mod.getStatusIcon("blocked")).toBe("⊘");
    });

    it("should return ⊘ for cancelled", () => {
      expect(mod.getStatusIcon("cancelled")).toBe("⊘");
    });

    it("should return ? for unknown status", () => {
      expect(mod.getStatusIcon("unknown_status")).toBe("?");
    });
  });

  // ── getStatusColor ──────────────────────────────────────────────────────

  describe("getStatusColor", () => {
    it("should return gray for pending", () => {
      expect(mod.getStatusColor("pending")).toBe("gray");
    });

    it("should return yellow for in_progress", () => {
      expect(mod.getStatusColor("in_progress")).toBe("yellow");
    });

    it("should return #00E5FF for completed", () => {
      expect(mod.getStatusColor("completed")).toBe("#00E5FF");
    });

    it("should return red for failed", () => {
      expect(mod.getStatusColor("failed")).toBe("red");
    });

    it("should return #0097A7 for blocked", () => {
      expect(mod.getStatusColor("blocked")).toBe("#0097A7");
    });

    it("should return gray for cancelled", () => {
      expect(mod.getStatusColor("cancelled")).toBe("gray");
    });

    it("should return gray for unknown status", () => {
      expect(mod.getStatusColor("something_else")).toBe("gray");
    });
  });

  // ── getPriorityStars ────────────────────────────────────────────────────

  describe("getPriorityStars", () => {
    it("should return ★★★★ for critical", () => {
      expect(mod.getPriorityStars("critical")).toBe("★★★★");
    });

    it("should return ★★★ for high", () => {
      expect(mod.getPriorityStars("high")).toBe("★★★");
    });

    it("should return ★★ for medium", () => {
      expect(mod.getPriorityStars("medium")).toBe("★★");
    });

    it("should return ★ for low", () => {
      expect(mod.getPriorityStars("low")).toBe("★");
    });

    it("should return ★ for unknown priority", () => {
      expect(mod.getPriorityStars("unknown_priority")).toBe("★");
    });
  });

  // ── getPriorityColor ────────────────────────────────────────────────────

  describe("getPriorityColor", () => {
    it("should return red for critical", () => {
      expect(mod.getPriorityColor("critical")).toBe("red");
    });

    it("should return yellow for high", () => {
      expect(mod.getPriorityColor("high")).toBe("yellow");
    });

    it("should return cyan for medium", () => {
      expect(mod.getPriorityColor("medium")).toBe("cyan");
    });

    it("should return gray for low", () => {
      expect(mod.getPriorityColor("low")).toBe("gray");
    });

    it("should return gray for unknown priority", () => {
      expect(mod.getPriorityColor("unknown_priority")).toBe("gray");
    });
  });

  // ── sortTasks ───────────────────────────────────────────────────────────

  describe("sortTasks", () => {
    it("should sort by priority with critical first", () => {
      const tasks: readonly TaskDisplayItem[] = [
        makeTask({ id: "a", priority: "low" }),
        makeTask({ id: "b", priority: "critical" }),
        makeTask({ id: "c", priority: "high" }),
        makeTask({ id: "d", priority: "medium" }),
      ];

      const sorted = mod.sortTasks(tasks, "priority");
      expect(sorted.map((t) => t.id)).toEqual(["b", "c", "d", "a"]);
    });

    it("should sort by status with in_progress first", () => {
      const tasks: readonly TaskDisplayItem[] = [
        makeTask({ id: "a", status: "completed" }),
        makeTask({ id: "b", status: "in_progress" }),
        makeTask({ id: "c", status: "pending" }),
        makeTask({ id: "d", status: "blocked" }),
        makeTask({ id: "e", status: "failed" }),
        makeTask({ id: "f", status: "cancelled" }),
      ];

      const sorted = mod.sortTasks(tasks, "status");
      expect(sorted.map((t) => t.id)).toEqual(["b", "c", "d", "e", "a", "f"]);
    });

    it("should return tasks in original order for 'created' sortBy", () => {
      const tasks: readonly TaskDisplayItem[] = [
        makeTask({ id: "a", priority: "low" }),
        makeTask({ id: "b", priority: "critical" }),
        makeTask({ id: "c", priority: "high" }),
      ];

      const sorted = mod.sortTasks(tasks, "created");
      expect(sorted.map((t) => t.id)).toEqual(["a", "b", "c"]);
    });

    it("should return tasks in original order for unknown sortBy", () => {
      const tasks: readonly TaskDisplayItem[] = [makeTask({ id: "x" }), makeTask({ id: "y" })];

      const sorted = mod.sortTasks(tasks, "foobar");
      expect(sorted.map((t) => t.id)).toEqual(["x", "y"]);
    });

    it("should not mutate the original array", () => {
      const tasks: readonly TaskDisplayItem[] = [
        makeTask({ id: "a", priority: "low" }),
        makeTask({ id: "b", priority: "critical" }),
      ];

      const sorted = mod.sortTasks(tasks, "priority");
      expect(sorted).not.toBe(tasks);
      expect(tasks[0].id).toBe("a"); // original unchanged
    });

    it("should handle empty array", () => {
      const sorted = mod.sortTasks([], "priority");
      expect(sorted).toEqual([]);
    });

    it("should handle single task", () => {
      const tasks = [makeTask({ id: "only" })];
      const sorted = mod.sortTasks(tasks, "priority");
      expect(sorted).toHaveLength(1);
      expect(sorted[0].id).toBe("only");
    });

    it("should handle all tasks with same priority", () => {
      const tasks: readonly TaskDisplayItem[] = [
        makeTask({ id: "a", priority: "high" }),
        makeTask({ id: "b", priority: "high" }),
        makeTask({ id: "c", priority: "high" }),
      ];

      const sorted = mod.sortTasks(tasks, "priority");
      expect(sorted).toHaveLength(3);
      // All same priority — order is stable (no reordering)
    });

    it("should handle all tasks with same status", () => {
      const tasks: readonly TaskDisplayItem[] = [
        makeTask({ id: "a", status: "pending" }),
        makeTask({ id: "b", status: "pending" }),
        makeTask({ id: "c", status: "pending" }),
      ];

      const sorted = mod.sortTasks(tasks, "status");
      expect(sorted).toHaveLength(3);
    });

    it("should place unknown priority at the end", () => {
      const tasks: readonly TaskDisplayItem[] = [
        makeTask({ id: "a", priority: "unknown_thing" }),
        makeTask({ id: "b", priority: "critical" }),
      ];

      const sorted = mod.sortTasks(tasks, "priority");
      expect(sorted[0].id).toBe("b");
      expect(sorted[1].id).toBe("a");
    });

    it("should place unknown status at the end", () => {
      const tasks: readonly TaskDisplayItem[] = [
        makeTask({ id: "a", status: "weird_status" }),
        makeTask({ id: "b", status: "in_progress" }),
      ];

      const sorted = mod.sortTasks(tasks, "status");
      expect(sorted[0].id).toBe("b");
      expect(sorted[1].id).toBe("a");
    });
  });

  // ── getTaskStats ────────────────────────────────────────────────────────

  describe("getTaskStats", () => {
    it("should return all zeros for empty task list", () => {
      const stats = mod.getTaskStats([]);
      expect(stats).toEqual({
        total: 0,
        completed: 0,
        running: 0,
        pending: 0,
        blocked: 0,
        failed: 0,
        cancelled: 0,
      });
    });

    it("should count a single completed task", () => {
      const stats = mod.getTaskStats([makeTask({ status: "completed" })]);
      expect(stats.total).toBe(1);
      expect(stats.completed).toBe(1);
      expect(stats.running).toBe(0);
    });

    it("should count a single in_progress task as running", () => {
      const stats = mod.getTaskStats([makeTask({ status: "in_progress" })]);
      expect(stats.running).toBe(1);
    });

    it("should count mixed statuses correctly", () => {
      const stats = mod.getTaskStats(makeMixedTasks());
      expect(stats.total).toBe(5);
      expect(stats.completed).toBe(1);
      expect(stats.running).toBe(1);
      expect(stats.pending).toBe(2);
      expect(stats.blocked).toBe(1);
      expect(stats.failed).toBe(0);
      expect(stats.cancelled).toBe(0);
    });

    it("should count all status types", () => {
      const tasks: readonly TaskDisplayItem[] = [
        makeTask({ id: "1", status: "completed" }),
        makeTask({ id: "2", status: "in_progress" }),
        makeTask({ id: "3", status: "pending" }),
        makeTask({ id: "4", status: "blocked" }),
        makeTask({ id: "5", status: "failed" }),
        makeTask({ id: "6", status: "cancelled" }),
      ];

      const stats = mod.getTaskStats(tasks);
      expect(stats).toEqual({
        total: 6,
        completed: 1,
        running: 1,
        pending: 1,
        blocked: 1,
        failed: 1,
        cancelled: 1,
      });
    });

    it("should ignore unknown statuses in counts but include in total", () => {
      const tasks: readonly TaskDisplayItem[] = [
        makeTask({ id: "1", status: "completed" }),
        makeTask({ id: "2", status: "some_unknown_status" }),
      ];

      const stats = mod.getTaskStats(tasks);
      expect(stats.total).toBe(2);
      expect(stats.completed).toBe(1);
      // Unknown status not counted in any named bucket
      expect(stats.running + stats.pending + stats.blocked + stats.failed + stats.cancelled).toBe(
        0,
      );
    });

    it("should handle many tasks (10+)", () => {
      const tasks: readonly TaskDisplayItem[] = Array.from({ length: 15 }, (_, i) =>
        makeTask({ id: `t${i}`, status: i % 2 === 0 ? "completed" : "pending" }),
      );

      const stats = mod.getTaskStats(tasks);
      expect(stats.total).toBe(15);
      expect(stats.completed).toBe(8); // indices 0,2,4,6,8,10,12,14
      expect(stats.pending).toBe(7); // indices 1,3,5,7,9,11,13
    });
  });

  // ── truncateTitle ───────────────────────────────────────────────────────

  describe("truncateTitle", () => {
    it("should not truncate short titles", () => {
      expect(mod.truncateTitle("Short title")).toBe("Short title");
    });

    it("should truncate titles exceeding max length", () => {
      const longTitle = "A".repeat(50);
      const truncated = mod.truncateTitle(longTitle, 40);
      expect(truncated.length).toBe(40);
      expect(truncated.endsWith("…")).toBe(true);
    });

    it("should not truncate titles at exactly max length", () => {
      const exactTitle = "A".repeat(40);
      expect(mod.truncateTitle(exactTitle, 40)).toBe(exactTitle);
    });

    it("should truncate titles one character over max length", () => {
      const overTitle = "A".repeat(41);
      const truncated = mod.truncateTitle(overTitle, 40);
      expect(truncated.length).toBe(40);
      expect(truncated).toBe("A".repeat(39) + "…");
    });

    it("should handle empty title", () => {
      expect(mod.truncateTitle("")).toBe("");
    });

    it("should use default max length when not specified", () => {
      // Default is 40 characters
      const longTitle = "A".repeat(100);
      const truncated = mod.truncateTitle(longTitle);
      expect(truncated.length).toBe(40);
    });
  });
});

// ─── Component Rendering Tests ──────────────────────────────────────────────

describe("TaskViewPanel component", () => {
  let mod: Awaited<ReturnType<typeof getModule>>;

  beforeEach(async () => {
    mod = await getModule();
  });

  describe("TaskViewPanel", () => {
    it("should return null when visible is false", () => {
      const result = mod.TaskViewPanel({
        visible: false,
        tasks: makeMixedTasks(),
      });
      expect(result).toBeNull();
    });

    it("should return non-null when visible is true", () => {
      const result = mod.TaskViewPanel({
        visible: true,
        tasks: makeMixedTasks(),
      });
      expect(result).not.toBeNull();
    });

    it("should render with empty tasks", () => {
      const result = mod.TaskViewPanel({
        visible: true,
        tasks: [],
      });
      expect(result).not.toBeNull();
    });

    it("should render with team name", () => {
      const result = mod.TaskViewPanel({
        visible: true,
        tasks: makeMixedTasks(),
        teamName: "Feature Implementation",
      });
      expect(result).not.toBeNull();
    });

    it("should render without team name", () => {
      const result = mod.TaskViewPanel({
        visible: true,
        tasks: [makeTask()],
      });
      expect(result).not.toBeNull();
    });

    it("should render with onClose callback", () => {
      const onClose = vi.fn();
      const result = mod.TaskViewPanel({
        visible: true,
        tasks: [makeTask()],
        onClose,
      });
      expect(result).not.toBeNull();
    });

    it("should render with a single task", () => {
      const result = mod.TaskViewPanel({
        visible: true,
        tasks: [makeTask({ id: "solo", title: "Single task" })],
      });
      expect(result).not.toBeNull();
    });

    it("should render with many tasks (10+)", () => {
      const tasks = Array.from({ length: 12 }, (_, i) =>
        makeTask({ id: `t${i}`, title: `Task ${i}`, status: "pending" }),
      );
      const result = mod.TaskViewPanel({
        visible: true,
        tasks,
      });
      expect(result).not.toBeNull();
    });
  });

  describe("TaskRow", () => {
    it("should render a pending task", () => {
      const result = mod.TaskRow({ task: makeTask({ status: "pending" }) });
      expect(result).not.toBeNull();
    });

    it("should render an in_progress task", () => {
      const result = mod.TaskRow({ task: makeTask({ status: "in_progress" }) });
      expect(result).not.toBeNull();
    });

    it("should render a completed task", () => {
      const result = mod.TaskRow({ task: makeTask({ status: "completed" }) });
      expect(result).not.toBeNull();
    });

    it("should render a failed task", () => {
      const result = mod.TaskRow({ task: makeTask({ status: "failed" }) });
      expect(result).not.toBeNull();
    });

    it("should render a blocked task", () => {
      const result = mod.TaskRow({ task: makeTask({ status: "blocked" }) });
      expect(result).not.toBeNull();
    });

    it("should render a cancelled task", () => {
      const result = mod.TaskRow({ task: makeTask({ status: "cancelled" }) });
      expect(result).not.toBeNull();
    });

    it("should render with assignedTo", () => {
      const result = mod.TaskRow({
        task: makeTask({ assignedTo: "architect" }),
      });
      expect(result).not.toBeNull();
    });

    it("should render without assignedTo", () => {
      const result = mod.TaskRow({
        task: makeTask({ assignedTo: undefined }),
      });
      expect(result).not.toBeNull();
    });

    it("should render with dependencies", () => {
      const result = mod.TaskRow({
        task: makeTask({ dependsOn: ["dep-1", "dep-2"] }),
      });
      expect(result).not.toBeNull();
    });

    it("should render without dependencies", () => {
      const result = mod.TaskRow({
        task: makeTask({ dependsOn: undefined }),
      });
      expect(result).not.toBeNull();
    });

    it("should render with empty dependencies array", () => {
      const result = mod.TaskRow({
        task: makeTask({ dependsOn: [] }),
      });
      expect(result).not.toBeNull();
    });

    it("should render with very long title", () => {
      const result = mod.TaskRow({
        task: makeTask({ title: "A".repeat(100) }),
      });
      expect(result).not.toBeNull();
    });

    it("should render with results", () => {
      const result = mod.TaskRow({
        task: makeTask({ results: "Completed successfully with 100% coverage" }),
      });
      expect(result).not.toBeNull();
    });

    it("should render each priority level", () => {
      for (const priority of ["critical", "high", "medium", "low"]) {
        const result = mod.TaskRow({ task: makeTask({ priority }) });
        expect(result).not.toBeNull();
      }
    });
  });

  describe("TaskSummaryBar", () => {
    it("should render with all-zero stats", () => {
      const stats: TaskStats = {
        total: 0,
        completed: 0,
        running: 0,
        pending: 0,
        blocked: 0,
        failed: 0,
        cancelled: 0,
      };
      const result = mod.TaskSummaryBar({ stats });
      expect(result).not.toBeNull();
    });

    it("should render with mixed stats", () => {
      const stats: TaskStats = {
        total: 5,
        completed: 1,
        running: 1,
        pending: 2,
        blocked: 1,
        failed: 0,
        cancelled: 0,
      };
      const result = mod.TaskSummaryBar({ stats });
      expect(result).not.toBeNull();
    });

    it("should render with all tasks completed", () => {
      const stats: TaskStats = {
        total: 5,
        completed: 5,
        running: 0,
        pending: 0,
        blocked: 0,
        failed: 0,
        cancelled: 0,
      };
      const result = mod.TaskSummaryBar({ stats });
      expect(result).not.toBeNull();
    });

    it("should render with failed tasks", () => {
      const stats: TaskStats = {
        total: 3,
        completed: 0,
        running: 0,
        pending: 0,
        blocked: 0,
        failed: 3,
        cancelled: 0,
      };
      const result = mod.TaskSummaryBar({ stats });
      expect(result).not.toBeNull();
    });

    it("should render with cancelled tasks", () => {
      const stats: TaskStats = {
        total: 2,
        completed: 0,
        running: 0,
        pending: 0,
        blocked: 0,
        failed: 0,
        cancelled: 2,
      };
      const result = mod.TaskSummaryBar({ stats });
      expect(result).not.toBeNull();
    });
  });

  describe("exports", () => {
    it("should export TaskViewPanel function", () => {
      expect(typeof mod.TaskViewPanel).toBe("function");
    });

    it("should export TaskRow function", () => {
      expect(typeof mod.TaskRow).toBe("function");
    });

    it("should export TaskSummaryBar function", () => {
      expect(typeof mod.TaskSummaryBar).toBe("function");
    });

    it("should export getStatusIcon function", () => {
      expect(typeof mod.getStatusIcon).toBe("function");
    });

    it("should export getStatusColor function", () => {
      expect(typeof mod.getStatusColor).toBe("function");
    });

    it("should export getPriorityStars function", () => {
      expect(typeof mod.getPriorityStars).toBe("function");
    });

    it("should export getPriorityColor function", () => {
      expect(typeof mod.getPriorityColor).toBe("function");
    });

    it("should export sortTasks function", () => {
      expect(typeof mod.sortTasks).toBe("function");
    });

    it("should export getTaskStats function", () => {
      expect(typeof mod.getTaskStats).toBe("function");
    });

    it("should export truncateTitle function", () => {
      expect(typeof mod.truncateTitle).toBe("function");
    });

    it("should not have a default export", () => {
      expect(mod).not.toHaveProperty("default");
    });
  });
});
