import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import { randomUUID } from "node:crypto";
import { BaseError } from "../utils/error.js";

/** Task management error */
export class TaskError extends BaseError {
  constructor(message: string, context: Record<string, unknown> = {}) {
    super(message, "TASK_ERROR", context);
  }
}

/** Task status values */
export type TaskStatus = "pending" | "in_progress" | "completed" | "failed" | "cancelled";

/** A single task */
export interface Task {
  readonly id: string;
  readonly title: string;
  readonly description?: string;
  readonly status: TaskStatus;
  readonly parentId?: string;
  readonly dependencies: readonly string[];
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

/** Parameters for creating a task */
export interface CreateTaskParams {
  readonly title: string;
  readonly description?: string;
  readonly parentId?: string;
  readonly dependencies?: readonly string[];
  readonly metadata?: Record<string, unknown>;
}

/** Parameters for updating a task */
export interface UpdateTaskParams {
  readonly title?: string;
  readonly description?: string;
  readonly status?: TaskStatus;
  readonly metadata?: Record<string, unknown>;
}

/** Persistent task state */
interface TaskStore {
  readonly tasks: readonly Task[];
}

/**
 * Task manager — create, update, list, and track tasks with dependencies.
 * Persists state to a JSON file.
 */
export class TaskManager {
  private tasks: Map<string, Task> = new Map();
  private readonly storePath: string;

  constructor(storePath: string) {
    this.storePath = storePath;
  }

  /** Load tasks from persistent storage */
  async load(): Promise<void> {
    try {
      const content = await readFile(this.storePath, "utf-8");
      const store = JSON.parse(content) as TaskStore;
      this.tasks = new Map(store.tasks.map((t) => [t.id, t]));
    } catch (error) {
      if (
        error instanceof Error &&
        "code" in error &&
        (error as NodeJS.ErrnoException).code === "ENOENT"
      ) {
        this.tasks = new Map();
        return;
      }
      throw new TaskError("Failed to load tasks", {
        path: this.storePath,
        cause: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /** Save tasks to persistent storage */
  private async save(): Promise<void> {
    const store: TaskStore = {
      tasks: [...this.tasks.values()],
    };
    await mkdir(dirname(this.storePath), { recursive: true });
    await writeFile(this.storePath, JSON.stringify(store, null, 2), "utf-8");
  }

  /** Create a new task */
  async create(params: CreateTaskParams): Promise<Task> {
    // Validate parent exists
    if (params.parentId && !this.tasks.has(params.parentId)) {
      throw new TaskError(`Parent task not found: ${params.parentId}`);
    }

    // Validate dependencies exist
    for (const depId of params.dependencies ?? []) {
      if (!this.tasks.has(depId)) {
        throw new TaskError(`Dependency task not found: ${depId}`);
      }
    }

    const now = new Date().toISOString();
    const task: Task = {
      id: randomUUID(),
      title: params.title,
      description: params.description,
      status: "pending",
      parentId: params.parentId,
      dependencies: params.dependencies ?? [],
      createdAt: now,
      updatedAt: now,
      metadata: params.metadata ? Object.freeze({ ...params.metadata }) : undefined,
    };

    this.tasks = new Map([...this.tasks, [task.id, task]]);
    await this.save();
    return task;
  }

  /** Update an existing task */
  async update(id: string, params: UpdateTaskParams): Promise<Task> {
    const existing = this.tasks.get(id);
    if (!existing) {
      throw new TaskError(`Task not found: ${id}`);
    }

    // Check dependencies are complete before marking in_progress
    if (params.status === "in_progress") {
      const blockers = this.getBlockingDependencies(id);
      if (blockers.length > 0) {
        throw new TaskError("Cannot start task: dependencies not complete", {
          taskId: id,
          blockers: blockers.map((t) => t.id),
        });
      }
    }

    const updated: Task = {
      ...existing,
      ...(params.title !== undefined ? { title: params.title } : {}),
      ...(params.description !== undefined ? { description: params.description } : {}),
      ...(params.status !== undefined ? { status: params.status } : {}),
      ...(params.metadata !== undefined
        ? { metadata: Object.freeze({ ...existing.metadata, ...params.metadata }) }
        : {}),
      updatedAt: new Date().toISOString(),
    };

    this.tasks = new Map([...this.tasks, [id, updated]]);
    await this.save();
    return updated;
  }

  /** Get a task by ID */
  get(id: string): Task | undefined {
    return this.tasks.get(id);
  }

  /** Get all tasks */
  getAll(): readonly Task[] {
    return [...this.tasks.values()];
  }

  /** List tasks filtered by status */
  listByStatus(status: TaskStatus): readonly Task[] {
    return [...this.tasks.values()].filter((t) => t.status === status);
  }

  /** Get children of a parent task */
  getChildren(parentId: string): readonly Task[] {
    return [...this.tasks.values()].filter((t) => t.parentId === parentId);
  }

  /** Get root tasks (no parent) */
  getRootTasks(): readonly Task[] {
    return [...this.tasks.values()].filter((t) => !t.parentId);
  }

  /** Get blocking dependencies (incomplete deps) for a task */
  getBlockingDependencies(id: string): readonly Task[] {
    const task = this.tasks.get(id);
    if (!task) return [];

    return task.dependencies
      .map((depId) => this.tasks.get(depId))
      .filter((dep): dep is Task => dep !== undefined && dep.status !== "completed");
  }

  /** Delete a task and optionally its children */
  async delete(id: string, cascade = false): Promise<void> {
    if (!this.tasks.has(id)) {
      throw new TaskError(`Task not found: ${id}`);
    }

    const newTasks = new Map(this.tasks);
    newTasks.delete(id);

    if (cascade) {
      const children = this.getChildren(id);
      for (const child of children) {
        newTasks.delete(child.id);
      }
    }

    this.tasks = newTasks;
    await this.save();
  }

  /** Get task count */
  get size(): number {
    return this.tasks.size;
  }
}
