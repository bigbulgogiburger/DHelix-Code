import { describe, it, expect, beforeEach, vi } from "vitest";

const mockWriteFile = vi.fn<(...args: unknown[]) => Promise<void>>().mockResolvedValue(undefined);
const mockReadFile = vi.fn<(...args: unknown[]) => Promise<string>>().mockResolvedValue("");
const mockMkdir = vi
  .fn<(...args: unknown[]) => Promise<string | undefined>>()
  .mockResolvedValue(undefined);

vi.mock("node:fs/promises", () => ({
  writeFile: (...args: unknown[]) => mockWriteFile(...args),
  readFile: (...args: unknown[]) => mockReadFile(...args),
  mkdir: (...args: unknown[]) => mockMkdir(...args),
}));

import {
  SharedTaskList,
  TaskListError,
  type CreateTaskInput,
  type SharedTask,
} from "../../../src/subagents/task-list.js";

describe("SharedTaskList", () => {
  let taskList: SharedTaskList;

  beforeEach(() => {
    taskList = new SharedTaskList();
  });

  // ---------------------------------------------------------------------------
  // createTask
  // ---------------------------------------------------------------------------

  describe("createTask", () => {
    it("should create a task with generated id and pending status", () => {
      const task = taskList.createTask({
        title: "Implement feature",
        description: "Build the login form",
      });

      expect(task.id).toBeDefined();
      expect(task.title).toBe("Implement feature");
      expect(task.description).toBe("Build the login form");
      expect(task.status).toBe("pending");
      expect(task.priority).toBe("medium");
      expect(task.createdAt).toBeGreaterThan(0);
      expect(task.updatedAt).toBe(task.createdAt);
    });

    it("should respect explicit priority", () => {
      const task = taskList.createTask({
        title: "Critical fix",
        description: "Fix security vulnerability",
        priority: "critical",
      });

      expect(task.priority).toBe("critical");
    });

    it("should set status to blocked when dependencies exist", () => {
      const dep = taskList.createTask({
        title: "Dependency",
        description: "Must complete first",
      });

      const task = taskList.createTask({
        title: "Dependent task",
        description: "Depends on another task",
        dependsOn: [dep.id],
      });

      expect(task.status).toBe("blocked");
      expect(task.dependsOn).toEqual([dep.id]);
    });

    it("should set status to pending when all dependencies are completed", () => {
      const dep = taskList.createTask({
        title: "Dependency",
        description: "Complete first",
      });
      taskList.completeTask(dep.id, "done");

      const task = taskList.createTask({
        title: "Dependent",
        description: "After dep",
        dependsOn: [dep.id],
      });

      expect(task.status).toBe("pending");
    });

    it("should store metadata when provided", () => {
      const task = taskList.createTask({
        title: "Task with meta",
        description: "Has metadata",
        metadata: { component: "auth", estimatedHours: 4 },
      });

      expect(task.metadata).toEqual({ component: "auth", estimatedHours: 4 });
    });

    it("should generate unique IDs for each task", () => {
      const t1 = taskList.createTask({
        title: "Task 1",
        description: "First",
      });
      const t2 = taskList.createTask({
        title: "Task 2",
        description: "Second",
      });

      expect(t1.id).not.toBe(t2.id);
    });
  });

  // ---------------------------------------------------------------------------
  // createTasks (batch)
  // ---------------------------------------------------------------------------

  describe("createTasks", () => {
    it("should create multiple tasks at once", () => {
      const inputs: readonly CreateTaskInput[] = [
        { title: "Task A", description: "First task" },
        { title: "Task B", description: "Second task", priority: "high" },
        { title: "Task C", description: "Third task", priority: "low" },
      ];

      const tasks = taskList.createTasks(inputs);

      expect(tasks).toHaveLength(3);
      expect(tasks[0].title).toBe("Task A");
      expect(tasks[1].priority).toBe("high");
      expect(tasks[2].priority).toBe("low");
    });

    it("should return empty array for empty input", () => {
      const tasks = taskList.createTasks([]);
      expect(tasks).toHaveLength(0);
    });
  });

  // ---------------------------------------------------------------------------
  // getTask
  // ---------------------------------------------------------------------------

  describe("getTask", () => {
    it("should return a task by id", () => {
      const created = taskList.createTask({
        title: "Find me",
        description: "Test lookup",
      });

      const found = taskList.getTask(created.id);
      expect(found).toBeDefined();
      expect(found!.title).toBe("Find me");
    });

    it("should return undefined for non-existent id", () => {
      expect(taskList.getTask("nonexistent-id")).toBeUndefined();
    });
  });

  // ---------------------------------------------------------------------------
  // getAllTasks
  // ---------------------------------------------------------------------------

  describe("getAllTasks", () => {
    it("should return all tasks", () => {
      taskList.createTask({ title: "A", description: "a" });
      taskList.createTask({ title: "B", description: "b" });
      taskList.createTask({ title: "C", description: "c" });

      const all = taskList.getAllTasks();
      expect(all).toHaveLength(3);
    });

    it("should return empty array when no tasks exist", () => {
      expect(taskList.getAllTasks()).toHaveLength(0);
    });
  });

  // ---------------------------------------------------------------------------
  // getTasksByStatus
  // ---------------------------------------------------------------------------

  describe("getTasksByStatus", () => {
    it("should filter tasks by status", () => {
      const t1 = taskList.createTask({ title: "A", description: "a" });
      taskList.createTask({ title: "B", description: "b" });
      taskList.completeTask(t1.id, "done");

      const completed = taskList.getTasksByStatus("completed");
      expect(completed).toHaveLength(1);
      expect(completed[0].title).toBe("A");

      const pending = taskList.getTasksByStatus("pending");
      expect(pending).toHaveLength(1);
      expect(pending[0].title).toBe("B");
    });

    it("should return empty array when no tasks match", () => {
      taskList.createTask({ title: "A", description: "a" });
      expect(taskList.getTasksByStatus("failed")).toHaveLength(0);
    });
  });

  // ---------------------------------------------------------------------------
  // getTasksByPriority
  // ---------------------------------------------------------------------------

  describe("getTasksByPriority", () => {
    it("should sort tasks by priority (critical first)", () => {
      taskList.createTask({
        title: "Low",
        description: "low",
        priority: "low",
      });
      taskList.createTask({
        title: "Critical",
        description: "critical",
        priority: "critical",
      });
      taskList.createTask({
        title: "High",
        description: "high",
        priority: "high",
      });
      taskList.createTask({
        title: "Medium",
        description: "medium",
        priority: "medium",
      });

      const sorted = taskList.getTasksByPriority();
      expect(sorted[0].priority).toBe("critical");
      expect(sorted[1].priority).toBe("high");
      expect(sorted[2].priority).toBe("medium");
      expect(sorted[3].priority).toBe("low");
    });
  });

  // ---------------------------------------------------------------------------
  // getNextAvailableTask
  // ---------------------------------------------------------------------------

  describe("getNextAvailableTask", () => {
    it("should return the highest-priority pending task", () => {
      taskList.createTask({
        title: "Low priority",
        description: "low",
        priority: "low",
      });
      taskList.createTask({
        title: "High priority",
        description: "high",
        priority: "high",
      });

      const next = taskList.getNextAvailableTask("agent-1");
      expect(next).toBeDefined();
      expect(next!.title).toBe("High priority");
    });

    it("should skip tasks locked by other agents", () => {
      const t1 = taskList.createTask({
        title: "Locked task",
        description: "locked",
        priority: "critical",
      });
      taskList.createTask({
        title: "Available task",
        description: "available",
        priority: "high",
      });

      taskList.tryLock(t1.id, "agent-other");

      const next = taskList.getNextAvailableTask("agent-1");
      expect(next).toBeDefined();
      expect(next!.title).toBe("Available task");
    });

    it("should not skip tasks locked by the requesting agent", () => {
      const t1 = taskList.createTask({
        title: "My locked task",
        description: "mine",
        priority: "critical",
      });
      taskList.createTask({
        title: "Other task",
        description: "other",
        priority: "high",
      });

      taskList.tryLock(t1.id, "agent-1");

      const next = taskList.getNextAvailableTask("agent-1");
      expect(next).toBeDefined();
      expect(next!.title).toBe("My locked task");
    });

    it("should skip tasks with unmet dependencies", () => {
      const dep = taskList.createTask({
        title: "Dependency",
        description: "must finish first",
      });
      // Move dependency to in_progress so it's not a candidate itself
      taskList.updateTask(dep.id, { status: "in_progress" });
      taskList.createTask({
        title: "Blocked",
        description: "blocked",
        priority: "critical",
        dependsOn: [dep.id],
      });
      taskList.createTask({
        title: "Available",
        description: "no deps",
        priority: "low",
      });

      const next = taskList.getNextAvailableTask("agent-1");
      expect(next).toBeDefined();
      expect(next!.title).toBe("Available");
    });

    it("should return undefined when no tasks are available", () => {
      const dep = taskList.createTask({
        title: "Dep",
        description: "dep",
      });
      taskList.createTask({
        title: "Blocked",
        description: "blocked",
        dependsOn: [dep.id],
      });
      taskList.updateTask(dep.id, { status: "in_progress" });

      const next = taskList.getNextAvailableTask("agent-1");
      expect(next).toBeUndefined();
    });
  });

  // ---------------------------------------------------------------------------
  // tryLock / releaseLock
  // ---------------------------------------------------------------------------

  describe("tryLock / releaseLock", () => {
    it("should acquire a lock on an unlocked task", () => {
      const task = taskList.createTask({
        title: "Lockable",
        description: "test",
      });

      expect(taskList.tryLock(task.id, "agent-1")).toBe(true);
      expect(taskList.isLocked(task.id)).toBe(true);
      expect(taskList.getLockHolder(task.id)).toBe("agent-1");
    });

    it("should reject lock when already held by another agent", () => {
      const task = taskList.createTask({
        title: "Contested",
        description: "test",
      });

      taskList.tryLock(task.id, "agent-1");
      expect(taskList.tryLock(task.id, "agent-2")).toBe(false);
      expect(taskList.getLockHolder(task.id)).toBe("agent-1");
    });

    it("should allow re-locking by the same agent", () => {
      const task = taskList.createTask({
        title: "Re-lock",
        description: "test",
      });

      taskList.tryLock(task.id, "agent-1");
      expect(taskList.tryLock(task.id, "agent-1")).toBe(true);
    });

    it("should return false when locking a non-existent task", () => {
      expect(taskList.tryLock("nonexistent", "agent-1")).toBe(false);
    });

    it("should release a lock held by the correct agent", () => {
      const task = taskList.createTask({
        title: "Release",
        description: "test",
      });

      taskList.tryLock(task.id, "agent-1");
      expect(taskList.releaseLock(task.id, "agent-1")).toBe(true);
      expect(taskList.isLocked(task.id)).toBe(false);
    });

    it("should reject release by wrong agent", () => {
      const task = taskList.createTask({
        title: "Wrong agent",
        description: "test",
      });

      taskList.tryLock(task.id, "agent-1");
      expect(taskList.releaseLock(task.id, "agent-2")).toBe(false);
      expect(taskList.isLocked(task.id)).toBe(true);
    });

    it("should return false when releasing a non-locked task", () => {
      const task = taskList.createTask({
        title: "Not locked",
        description: "test",
      });

      expect(taskList.releaseLock(task.id, "agent-1")).toBe(false);
    });
  });

  // ---------------------------------------------------------------------------
  // isLocked / getLockHolder
  // ---------------------------------------------------------------------------

  describe("isLocked / getLockHolder", () => {
    it("should return false/undefined for unlocked tasks", () => {
      const task = taskList.createTask({
        title: "Unlocked",
        description: "test",
      });

      expect(taskList.isLocked(task.id)).toBe(false);
      expect(taskList.getLockHolder(task.id)).toBeUndefined();
    });

    it("should return true/agentId for locked tasks", () => {
      const task = taskList.createTask({
        title: "Locked",
        description: "test",
      });

      taskList.tryLock(task.id, "agent-42");
      expect(taskList.isLocked(task.id)).toBe(true);
      expect(taskList.getLockHolder(task.id)).toBe("agent-42");
    });
  });

  // ---------------------------------------------------------------------------
  // updateTask
  // ---------------------------------------------------------------------------

  describe("updateTask", () => {
    it("should update task status", () => {
      const task = taskList.createTask({
        title: "Update me",
        description: "test",
      });

      const updated = taskList.updateTask(task.id, {
        status: "in_progress",
        assignedTo: "agent-1",
      });

      expect(updated.status).toBe("in_progress");
      expect(updated.assignedTo).toBe("agent-1");
      expect(updated.updatedAt).toBeGreaterThanOrEqual(task.updatedAt);
    });

    it("should merge metadata", () => {
      const task = taskList.createTask({
        title: "With meta",
        description: "test",
        metadata: { a: 1, b: 2 },
      });

      const updated = taskList.updateTask(task.id, {
        metadata: { b: 3, c: 4 },
      });

      expect(updated.metadata).toEqual({ a: 1, b: 3, c: 4 });
    });

    it("should throw TaskListError for non-existent task", () => {
      expect(() => taskList.updateTask("nonexistent", { status: "completed" })).toThrow(
        TaskListError,
      );
    });

    it("should promote blocked dependents when task completes", () => {
      const dep = taskList.createTask({
        title: "Dependency",
        description: "dep",
      });
      const blocked = taskList.createTask({
        title: "Blocked",
        description: "blocked",
        dependsOn: [dep.id],
      });

      expect(taskList.getTask(blocked.id)!.status).toBe("blocked");

      taskList.updateTask(dep.id, { status: "completed" });

      expect(taskList.getTask(blocked.id)!.status).toBe("pending");
    });

    it("should not promote blocked task if other deps are still unmet", () => {
      const dep1 = taskList.createTask({
        title: "Dep 1",
        description: "dep1",
      });
      const dep2 = taskList.createTask({
        title: "Dep 2",
        description: "dep2",
      });
      const blocked = taskList.createTask({
        title: "Blocked",
        description: "needs both",
        dependsOn: [dep1.id, dep2.id],
      });

      taskList.updateTask(dep1.id, { status: "completed" });

      expect(taskList.getTask(blocked.id)!.status).toBe("blocked");
    });

    it("should create a new object (immutable update)", () => {
      const original = taskList.createTask({
        title: "Original",
        description: "test",
      });

      const updated = taskList.updateTask(original.id, {
        status: "in_progress",
      });

      expect(updated).not.toBe(original);
      expect(original.status).toBe("pending");
      expect(updated.status).toBe("in_progress");
    });
  });

  // ---------------------------------------------------------------------------
  // completeTask / failTask
  // ---------------------------------------------------------------------------

  describe("completeTask", () => {
    it("should set status to completed and store result", () => {
      const task = taskList.createTask({
        title: "Complete me",
        description: "test",
      });

      const completed = taskList.completeTask(task.id, "All done");

      expect(completed.status).toBe("completed");
      expect(completed.result).toBe("All done");
    });
  });

  describe("failTask", () => {
    it("should set status to failed and store error", () => {
      const task = taskList.createTask({
        title: "Fail me",
        description: "test",
      });

      const failed = taskList.failTask(task.id, "Something went wrong");

      expect(failed.status).toBe("failed");
      expect(failed.error).toBe("Something went wrong");
    });
  });

  // ---------------------------------------------------------------------------
  // cancelTask
  // ---------------------------------------------------------------------------

  describe("cancelTask", () => {
    it("should cancel a single task", () => {
      const task = taskList.createTask({
        title: "Cancel me",
        description: "test",
      });

      const cancelled = taskList.cancelTask(task.id);

      expect(cancelled).toHaveLength(1);
      expect(cancelled[0].status).toBe("cancelled");
      expect(taskList.getTask(task.id)!.status).toBe("cancelled");
    });

    it("should cascade cancellation to dependent tasks", () => {
      const parent = taskList.createTask({
        title: "Parent",
        description: "parent",
      });
      const child = taskList.createTask({
        title: "Child",
        description: "child",
        dependsOn: [parent.id],
      });
      const grandchild = taskList.createTask({
        title: "Grandchild",
        description: "grandchild",
        dependsOn: [child.id],
      });

      const cancelled = taskList.cancelTask(parent.id);

      expect(cancelled).toHaveLength(3);
      expect(taskList.getTask(parent.id)!.status).toBe("cancelled");
      expect(taskList.getTask(child.id)!.status).toBe("cancelled");
      expect(taskList.getTask(grandchild.id)!.status).toBe("cancelled");
    });

    it("should release locks on cancelled tasks", () => {
      const task = taskList.createTask({
        title: "Locked cancel",
        description: "test",
      });
      taskList.tryLock(task.id, "agent-1");

      taskList.cancelTask(task.id);

      expect(taskList.isLocked(task.id)).toBe(false);
    });

    it("should throw TaskListError for non-existent task", () => {
      expect(() => taskList.cancelTask("nonexistent")).toThrow(TaskListError);
    });

    it("should not re-cancel already cancelled tasks", () => {
      const parent = taskList.createTask({
        title: "Parent",
        description: "parent",
      });
      const child = taskList.createTask({
        title: "Child",
        description: "child",
        dependsOn: [parent.id],
      });

      // Cancel child first
      taskList.cancelTask(child.id);
      // Then cancel parent — child should not appear again
      const cancelled = taskList.cancelTask(parent.id);

      // Only parent is newly cancelled (child was already cancelled)
      expect(cancelled).toHaveLength(1);
      expect(cancelled[0].id).toBe(parent.id);
    });
  });

  // ---------------------------------------------------------------------------
  // areDependenciesMet
  // ---------------------------------------------------------------------------

  describe("areDependenciesMet", () => {
    it("should return true when task has no dependencies", () => {
      const task = taskList.createTask({
        title: "No deps",
        description: "test",
      });

      expect(taskList.areDependenciesMet(task.id)).toBe(true);
    });

    it("should return true when all dependencies are completed", () => {
      const dep1 = taskList.createTask({
        title: "Dep 1",
        description: "dep1",
      });
      const dep2 = taskList.createTask({
        title: "Dep 2",
        description: "dep2",
      });
      taskList.completeTask(dep1.id, "done");
      taskList.completeTask(dep2.id, "done");

      const task = taskList.createTask({
        title: "Has deps",
        description: "test",
        dependsOn: [dep1.id, dep2.id],
      });

      expect(taskList.areDependenciesMet(task.id)).toBe(true);
    });

    it("should return false when some dependencies are not completed", () => {
      const dep1 = taskList.createTask({
        title: "Dep 1",
        description: "dep1",
      });
      const dep2 = taskList.createTask({
        title: "Dep 2",
        description: "dep2",
      });
      taskList.completeTask(dep1.id, "done");
      // dep2 remains pending

      const task = taskList.createTask({
        title: "Partially met",
        description: "test",
        dependsOn: [dep1.id, dep2.id],
      });

      expect(taskList.areDependenciesMet(task.id)).toBe(false);
    });

    it("should return false for non-existent task", () => {
      expect(taskList.areDependenciesMet("nonexistent")).toBe(false);
    });
  });

  // ---------------------------------------------------------------------------
  // getDependentTasks
  // ---------------------------------------------------------------------------

  describe("getDependentTasks", () => {
    it("should return tasks that depend on the given task", () => {
      const parent = taskList.createTask({
        title: "Parent",
        description: "parent",
      });
      taskList.createTask({
        title: "Child 1",
        description: "child1",
        dependsOn: [parent.id],
      });
      taskList.createTask({
        title: "Child 2",
        description: "child2",
        dependsOn: [parent.id],
      });
      taskList.createTask({
        title: "Unrelated",
        description: "unrelated",
      });

      const dependents = taskList.getDependentTasks(parent.id);
      expect(dependents).toHaveLength(2);
      expect(dependents.map((t) => t.title).sort()).toEqual(["Child 1", "Child 2"]);
    });

    it("should return empty array when no tasks depend on it", () => {
      const task = taskList.createTask({
        title: "Lonely",
        description: "no dependents",
      });

      expect(taskList.getDependentTasks(task.id)).toHaveLength(0);
    });
  });

  // ---------------------------------------------------------------------------
  // getStats
  // ---------------------------------------------------------------------------

  describe("getStats", () => {
    it("should return correct counts for all statuses", () => {
      const t1 = taskList.createTask({
        title: "T1",
        description: "pending",
      });
      const t2 = taskList.createTask({
        title: "T2",
        description: "in_progress",
      });
      const t3 = taskList.createTask({
        title: "T3",
        description: "completed",
      });
      const t4 = taskList.createTask({
        title: "T4",
        description: "failed",
      });
      const t5 = taskList.createTask({
        title: "T5",
        description: "blocked",
        dependsOn: [t1.id],
      });

      taskList.updateTask(t2.id, { status: "in_progress" });
      taskList.completeTask(t3.id, "done");
      taskList.failTask(t4.id, "error");

      const stats = taskList.getStats();
      expect(stats.total).toBe(5);
      expect(stats.pending).toBe(1); // t1
      expect(stats.inProgress).toBe(1); // t2
      expect(stats.completed).toBe(1); // t3
      expect(stats.failed).toBe(1); // t4
      expect(stats.blocked).toBe(1); // t5
      expect(stats.cancelled).toBe(0);
    });

    it("should return all zeros for empty list", () => {
      const stats = taskList.getStats();
      expect(stats).toEqual({
        total: 0,
        pending: 0,
        inProgress: 0,
        completed: 0,
        failed: 0,
        blocked: 0,
        cancelled: 0,
      });
    });
  });

  // ---------------------------------------------------------------------------
  // persist / load
  // ---------------------------------------------------------------------------

  describe("persist / load", () => {
    beforeEach(() => {
      mockWriteFile.mockReset().mockResolvedValue(undefined);
      mockReadFile.mockReset().mockResolvedValue("");
      mockMkdir.mockReset().mockResolvedValue(undefined);
    });

    it("should be a no-op when no persistPath is configured", async () => {
      const list = new SharedTaskList();
      list.createTask({ title: "Test", description: "test" });

      // Should not throw and should not call fs
      await list.persist();
      await list.load();

      expect(mockWriteFile).not.toHaveBeenCalled();
      expect(mockReadFile).not.toHaveBeenCalled();
    });

    it("should round-trip tasks through persist and load", async () => {
      const persistPath = "/tmp/test-tasks.json";
      const list = new SharedTaskList({ persistPath });

      const t1 = list.createTask({
        title: "Task 1",
        description: "first",
        priority: "high",
      });
      const t2 = list.createTask({
        title: "Task 2",
        description: "second",
        priority: "low",
      });

      await list.persist();

      expect(mockWriteFile).toHaveBeenCalledOnce();
      const writtenData = JSON.parse(mockWriteFile.mock.calls[0][1] as string);
      expect(writtenData.tasks).toHaveLength(2);

      // Mock readFile to return what was written
      mockReadFile.mockResolvedValue(mockWriteFile.mock.calls[0][1] as string);

      const list2 = new SharedTaskList({ persistPath });
      await list2.load();

      expect(list2.getAllTasks()).toHaveLength(2);
      expect(list2.getTask(t1.id)!.title).toBe("Task 1");
      expect(list2.getTask(t2.id)!.priority).toBe("low");
    });

    it("should handle ENOENT gracefully on load", async () => {
      const enoentError = new Error("File not found") as NodeJS.ErrnoException;
      enoentError.code = "ENOENT";
      mockReadFile.mockRejectedValue(enoentError);

      const list = new SharedTaskList({
        persistPath: "/tmp/nonexistent.json",
      });

      // Should not throw — just start with empty list
      await list.load();
      expect(list.getAllTasks()).toHaveLength(0);
    });

    it("should throw TaskListError for non-ENOENT read errors", async () => {
      const permError = new Error("Permission denied") as NodeJS.ErrnoException;
      permError.code = "EACCES";
      mockReadFile.mockRejectedValue(permError);

      const list = new SharedTaskList({
        persistPath: "/tmp/unreadable.json",
      });

      await expect(list.load()).rejects.toThrow(TaskListError);
    });
  });

  // ---------------------------------------------------------------------------
  // clear
  // ---------------------------------------------------------------------------

  describe("clear", () => {
    it("should remove all tasks and locks", () => {
      const t1 = taskList.createTask({ title: "A", description: "a" });
      taskList.createTask({ title: "B", description: "b" });
      taskList.tryLock(t1.id, "agent-1");

      taskList.clear();

      expect(taskList.getAllTasks()).toHaveLength(0);
      expect(taskList.isLocked(t1.id)).toBe(false);
      expect(taskList.getStats().total).toBe(0);
    });

    it("should allow re-use after clear", () => {
      taskList.createTask({ title: "Before", description: "clear" });
      taskList.clear();

      const task = taskList.createTask({
        title: "After",
        description: "clear",
      });
      expect(taskList.getAllTasks()).toHaveLength(1);
      expect(task.title).toBe("After");
    });
  });
});

// =============================================================================
// TaskListError
// =============================================================================

describe("TaskListError", () => {
  it("should extend BaseError with correct code", () => {
    const error = new TaskListError("test error", { taskId: "abc" });

    expect(error).toBeInstanceOf(Error);
    expect(error.code).toBe("TASK_LIST_ERROR");
    expect(error.message).toBe("test error");
    expect(error.context).toEqual({ taskId: "abc" });
  });
});
