/**
 * 작업(Task) 관리 모듈
 *
 * 프로젝트 내 작업(할 일)을 생성, 수정, 추적하는 관리자입니다.
 * 작업 간 의존성(dependency)과 부모-자식 관계를 지원하며,
 * JSON 파일에 상태를 영구 저장(persist)합니다.
 *
 * 주니어 개발자를 위한 설명:
 * - 이 모듈은 "투두 리스트(할 일 목록)" 시스템입니다
 * - 각 작업은 상태(대기/진행/완료/실패/취소)를 가집니다
 * - 작업 간 의존 관계를 설정하면, 선행 작업이 완료되어야 다음 작업을 시작할 수 있습니다
 * - 모든 데이터는 JSON 파일로 디스크에 저장되어 프로그램을 재시작해도 유지됩니다
 */
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import { randomUUID } from "node:crypto";
import { BaseError } from "../utils/error.js";

/**
 * 작업 관리 관련 에러 클래스
 * 작업을 찾을 수 없거나, 의존성 위반 등의 에러에 사용됩니다.
 */
export class TaskError extends BaseError {
  constructor(message: string, context: Record<string, unknown> = {}) {
    super(message, "TASK_ERROR", context);
  }
}

/**
 * 작업의 상태 값
 *
 * - "pending": 대기 중 (아직 시작하지 않음)
 * - "in_progress": 진행 중
 * - "completed": 완료됨
 * - "failed": 실패함
 * - "cancelled": 취소됨
 */
export type TaskStatus = "pending" | "in_progress" | "completed" | "failed" | "cancelled";

/**
 * 단일 작업 인터페이스
 *
 * @property id - 작업의 고유 식별자 (UUID)
 * @property title - 작업 제목
 * @property description - 작업에 대한 상세 설명 (선택사항)
 * @property status - 현재 상태 (pending, in_progress, completed 등)
 * @property parentId - 부모 작업의 ID (하위 작업인 경우)
 * @property dependencies - 이 작업이 의존하는 다른 작업들의 ID 목록
 *   (이 작업들이 모두 완료되어야 이 작업을 시작할 수 있음)
 * @property createdAt - 작업 생성 시각 (ISO 8601 문자열)
 * @property updatedAt - 마지막 수정 시각 (ISO 8601 문자열)
 * @property metadata - 추가 메타데이터 (자유 형식 키-값 쌍)
 */
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

/**
 * 작업 생성 시 필요한 매개변수
 *
 * @property title - 작업 제목 (필수)
 * @property description - 상세 설명 (선택)
 * @property parentId - 부모 작업 ID (선택, 하위 작업으로 만들 때)
 * @property dependencies - 의존 작업 ID 목록 (선택)
 * @property metadata - 추가 메타데이터 (선택)
 */
export interface CreateTaskParams {
  readonly title: string;
  readonly description?: string;
  readonly parentId?: string;
  readonly dependencies?: readonly string[];
  readonly metadata?: Record<string, unknown>;
}

/**
 * 작업 수정 시 사용하는 매개변수
 * 모든 필드가 선택사항이며, 제공된 필드만 업데이트됩니다.
 */
export interface UpdateTaskParams {
  readonly title?: string;
  readonly description?: string;
  readonly status?: TaskStatus;
  readonly metadata?: Record<string, unknown>;
}

/**
 * 디스크에 저장되는 작업 저장소 구조
 * JSON 파일의 최상위 구조를 나타냅니다.
 */
interface TaskStore {
  readonly tasks: readonly Task[];
}

/**
 * 작업 관리자 — 작업의 CRUD 및 의존성 추적을 담당합니다.
 *
 * 사용 흐름:
 * 1. new TaskManager(파일경로)로 인스턴스 생성
 * 2. load()로 기존 작업 로드
 * 3. create(), update(), delete() 등으로 작업 관리
 * 4. 모든 변경은 자동으로 디스크에 저장됩니다
 */
export class TaskManager {
  /** 작업 ID를 키로 하는 Map (빠른 조회를 위해 Map 사용) */
  private tasks: Map<string, Task> = new Map();
  /** JSON 저장 파일의 경로 */
  private readonly storePath: string;

  /**
   * @param storePath - 작업 데이터를 저장할 JSON 파일 경로
   */
  constructor(storePath: string) {
    this.storePath = storePath;
  }

  /**
   * 디스크에서 작업 데이터를 로드합니다.
   *
   * 파일이 없으면(ENOENT) 빈 상태로 시작합니다.
   * 파일이 있으면 JSON을 파싱하여 내부 Map에 저장합니다.
   */
  async load(): Promise<void> {
    try {
      const content = await readFile(this.storePath, "utf-8");
      const store = JSON.parse(content) as TaskStore;
      // 배열을 Map으로 변환 (ID -> Task 매핑)
      this.tasks = new Map(store.tasks.map((t) => [t.id, t]));
    } catch (error) {
      // ENOENT = 파일이 없음 → 처음 사용하는 것이므로 빈 Map으로 시작
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

  /**
   * 현재 작업 상태를 디스크에 저장합니다.
   * 저장 디렉토리가 없으면 자동으로 생성합니다.
   */
  private async save(): Promise<void> {
    const store: TaskStore = {
      tasks: [...this.tasks.values()],
    };
    // 저장 경로의 상위 디렉토리를 재귀적으로 생성
    await mkdir(dirname(this.storePath), { recursive: true });
    await writeFile(this.storePath, JSON.stringify(store, null, 2), "utf-8");
  }

  /**
   * 새 작업을 생성합니다.
   *
   * 부모 작업과 의존 작업이 존재하는지 검증한 뒤 작업을 생성합니다.
   * UUID를 자동 생성하고, 초기 상태는 "pending"입니다.
   *
   * @param params - 작업 생성 매개변수
   * @returns 생성된 작업 객체
   * @throws TaskError - 부모 또는 의존 작업이 존재하지 않는 경우
   */
  async create(params: CreateTaskParams): Promise<Task> {
    // 부모 작업이 지정되었으면 존재하는지 확인
    if (params.parentId && !this.tasks.has(params.parentId)) {
      throw new TaskError(`Parent task not found: ${params.parentId}`);
    }

    // 의존 작업들이 모두 존재하는지 확인
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
      status: "pending", // 새 작업은 항상 "대기" 상태에서 시작
      parentId: params.parentId,
      dependencies: params.dependencies ?? [],
      createdAt: now,
      updatedAt: now,
      metadata: params.metadata ? Object.freeze({ ...params.metadata }) : undefined,
    };

    // 불변성을 위해 새 Map을 생성 (기존 Map에 추가하지 않음)
    this.tasks = new Map([...this.tasks, [task.id, task]]);
    await this.save();
    return task;
  }

  /**
   * 기존 작업을 수정합니다.
   *
   * "in_progress"로 변경하려면 모든 의존 작업이 완료되어야 합니다.
   * 제공된 필드만 업데이트되며, 나머지는 기존 값을 유지합니다.
   *
   * @param id - 수정할 작업의 ID
   * @param params - 수정할 필드들
   * @returns 수정된 작업 객체
   * @throws TaskError - 작업을 찾을 수 없거나, 의존성이 완료되지 않은 경우
   */
  async update(id: string, params: UpdateTaskParams): Promise<Task> {
    const existing = this.tasks.get(id);
    if (!existing) {
      throw new TaskError(`Task not found: ${id}`);
    }

    // "진행 중"으로 변경하려면 선행 의존 작업이 모두 완료되어야 함
    if (params.status === "in_progress") {
      const blockers = this.getBlockingDependencies(id);
      if (blockers.length > 0) {
        throw new TaskError("Cannot start task: dependencies not complete", {
          taskId: id,
          blockers: blockers.map((t) => t.id),
        });
      }
    }

    // 스프레드 연산자로 기존 값을 복사한 뒤, 제공된 필드만 덮어씀
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

  /**
   * ID로 작업을 조회합니다.
   *
   * @param id - 조회할 작업의 ID
   * @returns 작업 객체, 없으면 undefined
   */
  get(id: string): Task | undefined {
    return this.tasks.get(id);
  }

  /**
   * 모든 작업을 반환합니다.
   *
   * @returns 전체 작업 목록 (읽기 전용 배열)
   */
  getAll(): readonly Task[] {
    return [...this.tasks.values()];
  }

  /**
   * 특정 상태의 작업만 필터링하여 반환합니다.
   *
   * @param status - 필터링할 상태 값
   * @returns 해당 상태의 작업 목록
   */
  listByStatus(status: TaskStatus): readonly Task[] {
    return [...this.tasks.values()].filter((t) => t.status === status);
  }

  /**
   * 특정 부모 작업의 자식 작업들을 반환합니다.
   *
   * @param parentId - 부모 작업의 ID
   * @returns 자식 작업 목록
   */
  getChildren(parentId: string): readonly Task[] {
    return [...this.tasks.values()].filter((t) => t.parentId === parentId);
  }

  /**
   * 최상위 작업(부모가 없는 작업)들을 반환합니다.
   *
   * @returns 루트 작업 목록
   */
  getRootTasks(): readonly Task[] {
    return [...this.tasks.values()].filter((t) => !t.parentId);
  }

  /**
   * 아직 완료되지 않은 의존 작업(차단 요소)들을 반환합니다.
   *
   * 이 작업을 시작하려면 반환된 작업들이 먼저 완료되어야 합니다.
   *
   * @param id - 확인할 작업의 ID
   * @returns 미완료 의존 작업 목록 (비어있으면 시작 가능)
   */
  getBlockingDependencies(id: string): readonly Task[] {
    const task = this.tasks.get(id);
    if (!task) return [];

    return task.dependencies
      .map((depId) => this.tasks.get(depId))
      .filter((dep): dep is Task => dep !== undefined && dep.status !== "completed");
  }

  /**
   * 작업을 삭제합니다.
   *
   * cascade 옵션이 true이면 자식 작업도 함께 삭제합니다.
   *
   * @param id - 삭제할 작업의 ID
   * @param cascade - 자식 작업도 함께 삭제할지 여부 (기본값: false)
   * @throws TaskError - 작업을 찾을 수 없는 경우
   */
  async delete(id: string, cascade = false): Promise<void> {
    if (!this.tasks.has(id)) {
      throw new TaskError(`Task not found: ${id}`);
    }

    const newTasks = new Map(this.tasks);
    newTasks.delete(id);

    // cascade 모드: 자식 작업도 재귀적으로 삭제
    if (cascade) {
      const children = this.getChildren(id);
      for (const child of children) {
        newTasks.delete(child.id);
      }
    }

    this.tasks = newTasks;
    await this.save();
  }

  /**
   * 전체 작업 수를 반환하는 게터
   */
  get size(): number {
    return this.tasks.size;
  }
}
