import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { rm } from "node:fs/promises";
import { TaskManager } from "../../../src/core/task-manager.js";

const testDir = join(tmpdir(), "dbcode-task-test-" + Date.now());
const storePath = join(testDir, "tasks.json");

let manager: TaskManager;

beforeEach(async () => {
  manager = new TaskManager(storePath);
  await manager.load();
});

afterAll(async () => {
  await rm(testDir, { recursive: true, force: true });
});

describe("TaskManager", () => {
  it("should create a task", async () => {
    const task = await manager.create({ title: "Test task" });
    expect(task.id).toBeDefined();
    expect(task.title).toBe("Test task");
    expect(task.status).toBe("pending");
    expect(task.dependencies).toEqual([]);
  });

  it("should get a task by ID", async () => {
    const created = await manager.create({ title: "Find me" });
    const found = manager.get(created.id);
    expect(found).toBeDefined();
    expect(found!.title).toBe("Find me");
  });

  it("should update task status", async () => {
    const task = await manager.create({ title: "Update me" });
    const updated = await manager.update(task.id, { status: "in_progress" });
    expect(updated.status).toBe("in_progress");
    expect(updated.updatedAt).not.toBe(task.updatedAt);
  });

  it("should update task title", async () => {
    const task = await manager.create({ title: "Old title" });
    const updated = await manager.update(task.id, { title: "New title" });
    expect(updated.title).toBe("New title");
  });

  it("should throw when updating non-existent task", async () => {
    await expect(manager.update("non-existent", { status: "completed" })).rejects.toThrow(
      "Task not found",
    );
  });

  it("should list tasks by status", async () => {
    await manager.create({ title: "Pending 1" });
    await manager.create({ title: "Pending 2" });
    const task3 = await manager.create({ title: "Done" });
    await manager.update(task3.id, { status: "completed" });

    const pending = manager.listByStatus("pending");
    expect(pending.length).toBeGreaterThanOrEqual(2);

    const completed = manager.listByStatus("completed");
    expect(completed.length).toBeGreaterThanOrEqual(1);
  });

  it("should create task with dependencies", async () => {
    const dep = await manager.create({ title: "Dependency" });
    const task = await manager.create({
      title: "Dependent",
      dependencies: [dep.id],
    });
    expect(task.dependencies).toContain(dep.id);
  });

  it("should throw when dependency doesn't exist", async () => {
    await expect(
      manager.create({ title: "Bad dep", dependencies: ["non-existent"] }),
    ).rejects.toThrow("Dependency task not found");
  });

  it("should block start if dependencies incomplete", async () => {
    const dep = await manager.create({ title: "Incomplete dep" });
    const task = await manager.create({
      title: "Blocked",
      dependencies: [dep.id],
    });

    await expect(manager.update(task.id, { status: "in_progress" })).rejects.toThrow(
      "dependencies not complete",
    );
  });

  it("should allow start when dependencies are complete", async () => {
    const dep = await manager.create({ title: "Complete dep" });
    await manager.update(dep.id, { status: "completed" });

    const task = await manager.create({
      title: "Ready",
      dependencies: [dep.id],
    });

    const updated = await manager.update(task.id, { status: "in_progress" });
    expect(updated.status).toBe("in_progress");
  });

  it("should create parent-child relationships", async () => {
    const parent = await manager.create({ title: "Parent" });
    const child1 = await manager.create({ title: "Child 1", parentId: parent.id });
    const child2 = await manager.create({ title: "Child 2", parentId: parent.id });

    const children = manager.getChildren(parent.id);
    expect(children).toHaveLength(2);
    expect(children.map((c) => c.id)).toContain(child1.id);
    expect(children.map((c) => c.id)).toContain(child2.id);
  });

  it("should get root tasks", async () => {
    // All previously created tasks + this one
    await manager.create({ title: "Root task" });
    const roots = manager.getRootTasks();
    expect(roots.length).toBeGreaterThan(0);
    expect(roots.every((t) => !t.parentId)).toBe(true);
  });

  it("should delete a task", async () => {
    const task = await manager.create({ title: "Delete me" });
    expect(manager.get(task.id)).toBeDefined();
    await manager.delete(task.id);
    expect(manager.get(task.id)).toBeUndefined();
  });

  it("should persist and reload tasks", async () => {
    const task = await manager.create({ title: "Persist me" });

    // Create a new manager and load from the same file
    const manager2 = new TaskManager(storePath);
    await manager2.load();
    const found = manager2.get(task.id);
    expect(found).toBeDefined();
    expect(found!.title).toBe("Persist me");
  });
});
