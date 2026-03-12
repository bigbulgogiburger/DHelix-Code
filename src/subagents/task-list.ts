import { randomUUID } from "node:crypto";
import { writeFile, readFile, mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import { BaseError } from "../utils/error.js";

/** Error thrown when task list operations fail */
export class TaskListError extends BaseError {
  constructor(message: string, context: Record<string, unknown> = {}) {
    super(message, "TASK_LIST_ERROR", context);
  }
}

/** Task priority levels */
export type TaskPriority = "critical" | "high" | "medium" | "low";

/** Task status */
export type TaskStatus =
  | "pending"
  | "in_progress"
  | "completed"
  | "failed"
  | "blocked"
  | "cancelled";

/** A task in the shared task list */
export interface SharedTask {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly priority: TaskPriority;
  readonly status: TaskStatus;
  readonly assignedTo?: string;
  readonly dependsOn?: readonly string[];
  readonly createdAt: number;
  readonly updatedAt: number;
  readonly completedAt?: number;
  readonly result?: string;
  readonly error?: string;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

/** Task creation input */
export interface CreateTaskInput {
  readonly title: string;
  readonly description: string;
  readonly priority?: TaskPriority;
  readonly dependsOn?: readonly string[];
  readonly metadata?: Readonly<Record<string, unknown>>;
}

/** Task update input */
export interface UpdateTaskInput {
  readonly status?: TaskStatus;
  readonly assignedTo?: string;
  readonly result?: string;
  readonly error?: string;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

/** Priority ordering for sorting (lower number = higher priority) */
const PRIORITY_ORDER: Readonly<Record<TaskPriority, number>> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

/** Serialized format for persistence */
interface PersistedTaskList {
  readonly tasks: readonly SharedTask[];
  readonly savedAt: number;
}

/**
 * Shared task list for coordinating work across multiple agents.
 *
 * Supports task creation with dependencies, priority-based ordering,
 * exclusive locking, and file-based persistence. All state mutations
 * produce new objects (immutable update pattern).
 */
export class SharedTaskList {
  private readonly tasks = new Map<string, SharedTask>();
  private readonly locks = new Map<string, string>();
  private readonly persistPath?: string;

  constructor(options?: { readonly persistPath?: string }) {
    this.persistPath = options?.persistPath;
  }

  /** Create a new task */
  createTask(input: CreateTaskInput): SharedTask {
    const now = Date.now();
    const id = randomUUID();
    const priority = input.priority ?? "medium";

    const hasUnmetDeps = this.hasUnmetDependencies(input.dependsOn);

    const task: SharedTask = {
      id,
      title: input.title,
      description: input.description,
      priority,
      status: hasUnmetDeps ? "blocked" : "pending",
      dependsOn: input.dependsOn ? [...input.dependsOn] : undefined,
      createdAt: now,
      updatedAt: now,
      metadata: input.metadata ? Object.freeze({ ...input.metadata }) : undefined,
    };

    this.tasks.set(id, task);
    return task;
  }

  /** Create multiple tasks at once */
  createTasks(inputs: readonly CreateTaskInput[]): readonly SharedTask[] {
    return inputs.map((input) => this.createTask(input));
  }

  /** Get a task by ID */
  getTask(id: string): SharedTask | undefined {
    return this.tasks.get(id);
  }

  /** Get all tasks */
  getAllTasks(): readonly SharedTask[] {
    return [...this.tasks.values()];
  }

  /** Get tasks filtered by status */
  getTasksByStatus(status: TaskStatus): readonly SharedTask[] {
    return [...this.tasks.values()].filter((t) => t.status === status);
  }

  /** Get tasks sorted by priority (critical first, low last) */
  getTasksByPriority(): readonly SharedTask[] {
    return [...this.tasks.values()].sort(
      (a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority],
    );
  }

  /**
   * Get next available task for an agent.
   *
   * Returns the highest-priority task that is:
   * - status = "pending"
   * - not locked by another agent
   * - all dependencies completed
   */
  getNextAvailableTask(agentId: string): SharedTask | undefined {
    const candidates = [...this.tasks.values()]
      .filter((t) => {
        if (t.status !== "pending") return false;
        const lockHolder = this.locks.get(t.id);
        if (lockHolder !== undefined && lockHolder !== agentId) return false;
        if (!this.areDependenciesMet(t.id)) return false;
        return true;
      })
      .sort((a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]);

    return candidates[0];
  }

  /** Try to lock a task for an agent. Returns true if lock acquired. */
  tryLock(taskId: string, agentId: string): boolean {
    const task = this.tasks.get(taskId);
    if (!task) return false;

    const currentHolder = this.locks.get(taskId);
    if (currentHolder !== undefined && currentHolder !== agentId) {
      return false;
    }

    this.locks.set(taskId, agentId);
    return true;
  }

  /** Release a lock on a task. Returns true if released. */
  releaseLock(taskId: string, agentId: string): boolean {
    const currentHolder = this.locks.get(taskId);
    if (currentHolder !== agentId) return false;

    this.locks.delete(taskId);
    return true;
  }

  /** Check if a task is locked */
  isLocked(taskId: string): boolean {
    return this.locks.has(taskId);
  }

  /** Get the agent holding a lock */
  getLockHolder(taskId: string): string | undefined {
    return this.locks.get(taskId);
  }

  /** Update a task (immutable — creates a new task object) */
  updateTask(id: string, update: UpdateTaskInput): SharedTask {
    const existing = this.tasks.get(id);
    if (!existing) {
      throw new TaskListError(`Task not found: ${id}`, { taskId: id });
    }

    const now = Date.now();
    const mergedMetadata =
      update.metadata !== undefined
        ? Object.freeze({ ...existing.metadata, ...update.metadata })
        : existing.metadata;

    const updated: SharedTask = {
      ...existing,
      ...update,
      metadata: mergedMetadata,
      updatedAt: now,
    };

    this.tasks.set(id, updated);

    // When a task completes, unblock dependent tasks whose deps are now met
    if (update.status === "completed") {
      this.promoteBlockedDependents(id);
    }

    return updated;
  }

  /** Complete a task */
  completeTask(id: string, result: string): SharedTask {
    return this.updateTask(id, {
      status: "completed",
      result,
    });
  }

  /** Fail a task */
  failTask(id: string, error: string): SharedTask {
    return this.updateTask(id, {
      status: "failed",
      error,
    });
  }

  /**
   * Cancel a task and all tasks that transitively depend on it.
   * Returns all cancelled tasks.
   */
  cancelTask(id: string): readonly SharedTask[] {
    const existing = this.tasks.get(id);
    if (!existing) {
      throw new TaskListError(`Task not found: ${id}`, { taskId: id });
    }

    const cancelled: SharedTask[] = [];
    const toCancel = [id];

    while (toCancel.length > 0) {
      const currentId = toCancel.pop()!;
      const current = this.tasks.get(currentId);
      if (!current || current.status === "cancelled") continue;

      const updated: SharedTask = {
        ...current,
        status: "cancelled",
        updatedAt: Date.now(),
      };
      this.tasks.set(currentId, updated);
      this.locks.delete(currentId);
      cancelled.push(updated);

      // Find and queue all tasks that depend on this one
      const dependents = this.getDependentTasks(currentId);
      for (const dep of dependents) {
        if (dep.status !== "cancelled") {
          toCancel.push(dep.id);
        }
      }
    }

    return cancelled;
  }

  /** Check if all dependencies of a task are completed */
  areDependenciesMet(taskId: string): boolean {
    const task = this.tasks.get(taskId);
    if (!task) return false;
    if (!task.dependsOn || task.dependsOn.length === 0) return true;

    return task.dependsOn.every((depId) => {
      const dep = this.tasks.get(depId);
      return dep !== undefined && dep.status === "completed";
    });
  }

  /** Get tasks that directly depend on a given task */
  getDependentTasks(taskId: string): readonly SharedTask[] {
    return [...this.tasks.values()].filter(
      (t) => t.dependsOn !== undefined && t.dependsOn.includes(taskId),
    );
  }

  /** Get completion statistics */
  getStats(): {
    readonly total: number;
    readonly pending: number;
    readonly inProgress: number;
    readonly completed: number;
    readonly failed: number;
    readonly blocked: number;
    readonly cancelled: number;
  } {
    let pending = 0;
    let inProgress = 0;
    let completed = 0;
    let failed = 0;
    let blocked = 0;
    let cancelled = 0;

    for (const task of this.tasks.values()) {
      switch (task.status) {
        case "pending":
          pending++;
          break;
        case "in_progress":
          inProgress++;
          break;
        case "completed":
          completed++;
          break;
        case "failed":
          failed++;
          break;
        case "blocked":
          blocked++;
          break;
        case "cancelled":
          cancelled++;
          break;
      }
    }

    return {
      total: this.tasks.size,
      pending,
      inProgress,
      completed,
      failed,
      blocked,
      cancelled,
    };
  }

  /** Save task list to disk (if persistPath configured) */
  async persist(): Promise<void> {
    if (!this.persistPath) return;

    const data: PersistedTaskList = {
      tasks: [...this.tasks.values()],
      savedAt: Date.now(),
    };

    const dir = dirname(this.persistPath);
    await mkdir(dir, { recursive: true });
    await writeFile(this.persistPath, JSON.stringify(data, null, 2), "utf-8");
  }

  /** Load task list from disk */
  async load(): Promise<void> {
    if (!this.persistPath) return;

    try {
      const raw = await readFile(this.persistPath, "utf-8");
      const data = JSON.parse(raw) as PersistedTaskList;

      this.tasks.clear();
      this.locks.clear();

      for (const task of data.tasks) {
        this.tasks.set(task.id, task);
      }
    } catch (error: unknown) {
      const isNotFound =
        error instanceof Error &&
        "code" in error &&
        (error as NodeJS.ErrnoException).code === "ENOENT";
      if (!isNotFound) {
        throw new TaskListError("Failed to load task list", {
          path: this.persistPath,
          cause: error instanceof Error ? error.message : String(error),
        });
      }
      // File doesn't exist yet — start with empty list
    }
  }

  /** Clear all tasks and locks */
  clear(): void {
    this.tasks.clear();
    this.locks.clear();
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  /** Check whether any of the given dependency IDs point to incomplete tasks */
  private hasUnmetDependencies(dependsOn?: readonly string[]): boolean {
    if (!dependsOn || dependsOn.length === 0) return false;

    return dependsOn.some((depId) => {
      const dep = this.tasks.get(depId);
      return dep === undefined || dep.status !== "completed";
    });
  }

  /**
   * After a task completes, check all blocked tasks that depend on it.
   * If all their dependencies are now met, promote them from blocked to pending.
   */
  private promoteBlockedDependents(completedTaskId: string): void {
    const dependents = this.getDependentTasks(completedTaskId);
    for (const dep of dependents) {
      if (dep.status !== "blocked") continue;

      if (this.areDependenciesMet(dep.id)) {
        const promoted: SharedTask = {
          ...dep,
          status: "pending",
          updatedAt: Date.now(),
        };
        this.tasks.set(dep.id, promoted);
      }
    }
  }
}
