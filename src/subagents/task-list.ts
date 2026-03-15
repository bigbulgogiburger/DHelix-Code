/**
 * 공유 태스크 리스트 — 여러 에이전트가 협업할 때 작업을 조율하는 모듈
 *
 * 여러 서브에이전트가 하나의 큰 목표를 달성하기 위해 협업할 때,
 * 누가 어떤 작업을 하고 있는지, 어떤 작업이 먼저 완료되어야 하는지를
 * 관리할 수 있는 공유 태스크 리스트를 제공합니다.
 *
 * 주요 기능:
 * - 태스크 생성/조회/수정/완료/실패/취소
 * - 의존성(dependency) 관리: 태스크 A가 완료되어야 태스크 B를 시작
 * - 우선순위(priority) 기반 정렬: critical > high > medium > low
 * - 배타적 잠금(lock): 한 에이전트만 특정 태스크를 처리
 * - 파일 기반 영속성(persistence): 태스크 목록을 JSON 파일로 저장/복원
 *
 * 사용 흐름 예시:
 * 1. 팀 리더 에이전트가 태스크 목록을 생성
 * 2. 각 워커 에이전트가 getNextAvailableTask()로 할당 가능한 태스크를 가져감
 * 3. tryLock()으로 태스크를 잠그고 작업 수행
 * 4. 완료 시 completeTask(), 실패 시 failTask() 호출
 * 5. 의존 태스크가 자동으로 "blocked" → "pending"으로 전환
 */
import { randomUUID } from "node:crypto";
import { writeFile, readFile, mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import { BaseError } from "../utils/error.js";

/** 태스크 리스트 작업 중 발생하는 에러 클래스 */
export class TaskListError extends BaseError {
  constructor(message: string, context: Record<string, unknown> = {}) {
    super(message, "TASK_LIST_ERROR", context);
  }
}

/**
 * 태스크 우선순위 레벨
 * - critical: 즉시 처리 필요 (가장 높음)
 * - high: 높은 우선순위
 * - medium: 보통 (기본값)
 * - low: 낮은 우선순위
 */
export type TaskPriority = "critical" | "high" | "medium" | "low";

/**
 * 태스크 상태
 * - pending: 대기 중 (처리 준비 완료)
 * - in_progress: 진행 중
 * - completed: 완료
 * - failed: 실패
 * - blocked: 의존 태스크가 완료되지 않아 대기 중
 * - cancelled: 취소됨
 */
export type TaskStatus =
  | "pending"
  | "in_progress"
  | "completed"
  | "failed"
  | "blocked"
  | "cancelled";

/**
 * 공유 태스크 리스트의 개별 태스크 구조
 *
 * 불변(immutable) 객체로 설계되어 있어, 수정 시 새로운 객체를 생성합니다.
 * readonly 속성으로 실수로 직접 수정하는 것을 방지합니다.
 */
export interface SharedTask {
  /** 태스크 고유 식별자 (UUID) */
  readonly id: string;
  /** 태스크 제목 */
  readonly title: string;
  /** 태스크 상세 설명 */
  readonly description: string;
  /** 우선순위 (critical > high > medium > low) */
  readonly priority: TaskPriority;
  /** 현재 상태 */
  readonly status: TaskStatus;
  /** 이 태스크를 담당하는 에이전트 ID */
  readonly assignedTo?: string;
  /** 이 태스크가 의존하는 다른 태스크들의 ID 목록 */
  readonly dependsOn?: readonly string[];
  /** 생성 시각 (Unix 타임스탬프, 밀리초) */
  readonly createdAt: number;
  /** 마지막 수정 시각 */
  readonly updatedAt: number;
  /** 완료 시각 */
  readonly completedAt?: number;
  /** 완료 결과 텍스트 */
  readonly result?: string;
  /** 실패 시 에러 메시지 */
  readonly error?: string;
  /** 추가 메타데이터 (자유 형식) */
  readonly metadata?: Readonly<Record<string, unknown>>;
}

/** 태스크 생성 시 필요한 입력 데이터 */
export interface CreateTaskInput {
  readonly title: string;
  readonly description: string;
  /** 우선순위 (기본값: "medium") */
  readonly priority?: TaskPriority;
  /** 의존하는 태스크 ID 목록 (해당 태스크들이 완료되어야 시작 가능) */
  readonly dependsOn?: readonly string[];
  /** 추가 메타데이터 */
  readonly metadata?: Readonly<Record<string, unknown>>;
}

/** 태스크 수정 시 변경할 필드 */
export interface UpdateTaskInput {
  readonly status?: TaskStatus;
  readonly assignedTo?: string;
  readonly result?: string;
  readonly error?: string;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

/**
 * 우선순위별 정렬 순서 (낮은 숫자 = 높은 우선순위)
 * critical(0) > high(1) > medium(2) > low(3)
 */
const PRIORITY_ORDER: Readonly<Record<TaskPriority, number>> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

/** 파일로 저장할 때의 직렬화(serialization) 형식 */
interface PersistedTaskList {
  readonly tasks: readonly SharedTask[];
  /** 저장 시각 (Unix 타임스탬프) */
  readonly savedAt: number;
}

/**
 * 공유 태스크 리스트 클래스 — 여러 에이전트의 작업을 조율합니다
 *
 * 태스크 생성, 의존성 기반 스케줄링, 우선순위 정렬,
 * 배타적 잠금(lock), 파일 기반 영속성을 지원합니다.
 *
 * 모든 상태 변경은 불변 업데이트 패턴(immutable update pattern)을 따릅니다.
 * 즉, 기존 객체를 수정하지 않고 새 객체를 생성하여 교체합니다.
 */
export class SharedTaskList {
  /** 태스크 저장소 (ID → 태스크 객체) */
  private readonly tasks = new Map<string, SharedTask>();
  /** 태스크별 잠금 상태 (태스크 ID → 잠금을 보유한 에이전트 ID) */
  private readonly locks = new Map<string, string>();
  /** 태스크 목록을 저장할 파일 경로 (설정하지 않으면 영속화 비활성) */
  private readonly persistPath?: string;

  /**
   * @param options - 설정 객체
   * @param options.persistPath - 태스크 목록 JSON 파일 저장 경로 (선택적)
   */
  constructor(options?: { readonly persistPath?: string }) {
    this.persistPath = options?.persistPath;
  }

  /**
   * 새 태스크를 생성합니다.
   *
   * 의존하는 태스크가 아직 완료되지 않았으면 자동으로 "blocked" 상태로 생성됩니다.
   * 의존 태스크가 없거나 모두 완료되었으면 "pending" 상태로 생성됩니다.
   *
   * @param input - 태스크 생성 데이터
   * @returns 생성된 태스크 객체 (UUID가 자동 부여됨)
   */
  createTask(input: CreateTaskInput): SharedTask {
    const now = Date.now();
    const id = randomUUID();
    const priority = input.priority ?? "medium";

    // 의존 태스크 중 미완료인 것이 있는지 확인
    const hasUnmetDeps = this.hasUnmetDependencies(input.dependsOn);

    const task: SharedTask = {
      id,
      title: input.title,
      description: input.description,
      priority,
      status: hasUnmetDeps ? "blocked" : "pending", // 의존성 미충족 → blocked
      dependsOn: input.dependsOn ? [...input.dependsOn] : undefined,
      createdAt: now,
      updatedAt: now,
      metadata: input.metadata ? Object.freeze({ ...input.metadata }) : undefined,
    };

    this.tasks.set(id, task);
    return task;
  }

  /**
   * 여러 태스크를 한 번에 생성합니다.
   *
   * @param inputs - 태스크 생성 데이터 배열
   * @returns 생성된 태스크 배열
   */
  createTasks(inputs: readonly CreateTaskInput[]): readonly SharedTask[] {
    return inputs.map((input) => this.createTask(input));
  }

  /**
   * ID로 태스크를 조회합니다.
   *
   * @param id - 태스크 UUID
   * @returns 태스크 객체, 없으면 undefined
   */
  getTask(id: string): SharedTask | undefined {
    return this.tasks.get(id);
  }

  /**
   * 모든 태스크를 배열로 반환합니다.
   *
   * @returns 전체 태스크 배열 (읽기 전용)
   */
  getAllTasks(): readonly SharedTask[] {
    return [...this.tasks.values()];
  }

  /**
   * 특정 상태의 태스크만 필터링하여 반환합니다.
   *
   * @param status - 필터링할 상태 (예: "pending", "completed")
   * @returns 해당 상태의 태스크 배열
   */
  getTasksByStatus(status: TaskStatus): readonly SharedTask[] {
    return [...this.tasks.values()].filter((t) => t.status === status);
  }

  /**
   * 우선순위 순으로 정렬된 태스크 목록을 반환합니다.
   * critical이 맨 앞, low가 맨 뒤로 정렬됩니다.
   *
   * @returns 우선순위 내림차순으로 정렬된 태스크 배열
   */
  getTasksByPriority(): readonly SharedTask[] {
    return [...this.tasks.values()].sort(
      (a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority],
    );
  }

  /**
   * 특정 에이전트가 처리할 수 있는 다음 태스크를 반환합니다.
   *
   * 다음 조건을 모두 만족하는 태스크 중 가장 높은 우선순위를 선택합니다:
   * 1. 상태가 "pending" (대기 중)
   * 2. 다른 에이전트가 잠금(lock)을 보유하지 않음
   * 3. 모든 의존 태스크가 완료됨
   *
   * @param agentId - 태스크를 요청하는 에이전트의 ID
   * @returns 가장 적합한 다음 태스크, 없으면 undefined
   */
  getNextAvailableTask(agentId: string): SharedTask | undefined {
    const candidates = [...this.tasks.values()]
      .filter((t) => {
        // 대기 중인 태스크만 대상
        if (t.status !== "pending") return false;
        // 다른 에이전트가 잠금을 보유 중이면 제외
        const lockHolder = this.locks.get(t.id);
        if (lockHolder !== undefined && lockHolder !== agentId) return false;
        // 의존 태스크가 모두 완료되었는지 확인
        if (!this.areDependenciesMet(t.id)) return false;
        return true;
      })
      // 우선순위 순으로 정렬 (critical 먼저)
      .sort((a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]);

    // 가장 높은 우선순위의 첫 번째 태스크 반환
    return candidates[0];
  }

  /**
   * 태스크에 대한 배타적 잠금(lock)을 시도합니다.
   *
   * 잠금은 한 에이전트만 특정 태스크를 처리하도록 보장합니다.
   * 다른 에이전트가 이미 잠금을 보유 중이면 실패합니다.
   *
   * @param taskId - 잠글 태스크의 ID
   * @param agentId - 잠금을 요청하는 에이전트의 ID
   * @returns true이면 잠금 성공, false이면 실패 (이미 다른 에이전트가 보유)
   */
  tryLock(taskId: string, agentId: string): boolean {
    const task = this.tasks.get(taskId);
    if (!task) return false;

    const currentHolder = this.locks.get(taskId);
    // 이미 다른 에이전트가 잠금을 보유 중이면 실패
    if (currentHolder !== undefined && currentHolder !== agentId) {
      return false;
    }

    this.locks.set(taskId, agentId);
    return true;
  }

  /**
   * 태스크의 잠금을 해제합니다.
   *
   * 자신이 보유한 잠금만 해제할 수 있습니다.
   *
   * @param taskId - 잠금 해제할 태스크 ID
   * @param agentId - 잠금 해제를 요청하는 에이전트 ID
   * @returns true이면 해제 성공, false이면 본인의 잠금이 아님
   */
  releaseLock(taskId: string, agentId: string): boolean {
    const currentHolder = this.locks.get(taskId);
    if (currentHolder !== agentId) return false;

    this.locks.delete(taskId);
    return true;
  }

  /**
   * 태스크가 잠겨있는지 확인합니다.
   *
   * @param taskId - 확인할 태스크 ID
   * @returns true이면 잠금 상태
   */
  isLocked(taskId: string): boolean {
    return this.locks.has(taskId);
  }

  /**
   * 태스크의 잠금을 보유한 에이전트 ID를 반환합니다.
   *
   * @param taskId - 확인할 태스크 ID
   * @returns 잠금을 보유한 에이전트 ID, 잠금이 없으면 undefined
   */
  getLockHolder(taskId: string): string | undefined {
    return this.locks.get(taskId);
  }

  /**
   * 태스크를 업데이트합니다. (불변 패턴 — 새 객체 생성)
   *
   * 기존 태스크 객체를 수정하지 않고 스프레드 연산자(...)로
   * 새 객체를 만들어 교체합니다.
   *
   * 태스크가 "completed"로 변경되면 자동으로 의존 태스크의 상태를 확인하여
   * "blocked" → "pending"으로 승격시킵니다.
   *
   * @param id - 업데이트할 태스크 ID
   * @param update - 변경할 필드
   * @returns 업데이트된 태스크 객체
   * @throws TaskListError — 태스크를 찾을 수 없을 때
   */
  updateTask(id: string, update: UpdateTaskInput): SharedTask {
    const existing = this.tasks.get(id);
    if (!existing) {
      throw new TaskListError(`Task not found: ${id}`, { taskId: id });
    }

    const now = Date.now();
    // 메타데이터는 기존 값과 새 값을 병합
    const mergedMetadata =
      update.metadata !== undefined
        ? Object.freeze({ ...existing.metadata, ...update.metadata })
        : existing.metadata;

    // 불변 업데이트: 기존 객체를 복사하고 변경 필드만 덮어씀
    const updated: SharedTask = {
      ...existing,
      ...update,
      metadata: mergedMetadata,
      updatedAt: now,
    };

    this.tasks.set(id, updated);

    // 태스크가 완료되면 이 태스크에 의존하던 blocked 태스크들을 확인
    if (update.status === "completed") {
      this.promoteBlockedDependents(id);
    }

    return updated;
  }

  /**
   * 태스크를 완료 처리합니다.
   *
   * @param id - 완료할 태스크 ID
   * @param result - 완료 결과 텍스트
   * @returns 업데이트된 태스크 객체
   */
  completeTask(id: string, result: string): SharedTask {
    return this.updateTask(id, {
      status: "completed",
      result,
    });
  }

  /**
   * 태스크를 실패 처리합니다.
   *
   * @param id - 실패한 태스크 ID
   * @param error - 에러 메시지
   * @returns 업데이트된 태스크 객체
   */
  failTask(id: string, error: string): SharedTask {
    return this.updateTask(id, {
      status: "failed",
      error,
    });
  }

  /**
   * 태스크를 취소하고, 이 태스크에 의존하는 모든 태스크도 연쇄적으로 취소합니다.
   *
   * 예: 태스크 A를 취소하면, A에 의존하는 B도 취소되고,
   * B에 의존하는 C도 취소됩니다 (전이적 취소, transitive cancellation).
   *
   * @param id - 취소할 태스크 ID
   * @returns 취소된 모든 태스크 배열 (원래 태스크 + 연쇄 취소된 태스크들)
   * @throws TaskListError — 태스크를 찾을 수 없을 때
   */
  cancelTask(id: string): readonly SharedTask[] {
    const existing = this.tasks.get(id);
    if (!existing) {
      throw new TaskListError(`Task not found: ${id}`, { taskId: id });
    }

    const cancelled: SharedTask[] = [];
    // BFS(너비 우선 탐색)로 연쇄적으로 의존 태스크를 찾아 취소
    const toCancel = [id];

    while (toCancel.length > 0) {
      const currentId = toCancel.pop()!;
      const current = this.tasks.get(currentId);
      if (!current || current.status === "cancelled") continue;

      // 불변 업데이트로 상태를 "cancelled"로 변경
      const updated: SharedTask = {
        ...current,
        status: "cancelled",
        updatedAt: Date.now(),
      };
      this.tasks.set(currentId, updated);
      this.locks.delete(currentId); // 잠금도 해제
      cancelled.push(updated);

      // 이 태스크에 의존하는 다른 태스크들도 취소 큐에 추가
      const dependents = this.getDependentTasks(currentId);
      for (const dep of dependents) {
        if (dep.status !== "cancelled") {
          toCancel.push(dep.id);
        }
      }
    }

    return cancelled;
  }

  /**
   * 특정 태스크의 모든 의존 태스크가 완료되었는지 확인합니다.
   *
   * @param taskId - 확인할 태스크 ID
   * @returns true이면 모든 의존성 충족 (또는 의존성 없음)
   */
  areDependenciesMet(taskId: string): boolean {
    const task = this.tasks.get(taskId);
    if (!task) return false;
    if (!task.dependsOn || task.dependsOn.length === 0) return true;

    // 모든 의존 태스크가 "completed" 상태인지 확인
    return task.dependsOn.every((depId) => {
      const dep = this.tasks.get(depId);
      return dep !== undefined && dep.status === "completed";
    });
  }

  /**
   * 특정 태스크에 직접 의존하는 다른 태스크들을 찾습니다.
   *
   * @param taskId - 기준 태스크 ID
   * @returns 이 태스크에 의존하는 태스크 배열
   */
  getDependentTasks(taskId: string): readonly SharedTask[] {
    return [...this.tasks.values()].filter(
      (t) => t.dependsOn !== undefined && t.dependsOn.includes(taskId),
    );
  }

  /**
   * 태스크 리스트의 통계 요약을 반환합니다.
   *
   * @returns 각 상태별 태스크 수와 전체 태스크 수
   */
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

    // 각 태스크의 상태를 카운트
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

  /**
   * 태스크 리스트를 디스크(파일)에 저장합니다.
   *
   * persistPath가 설정되어 있을 때만 동작합니다.
   * JSON 형식으로 직렬화하여 저장하며, 디렉토리가 없으면 자동 생성합니다.
   */
  async persist(): Promise<void> {
    if (!this.persistPath) return;

    const data: PersistedTaskList = {
      tasks: [...this.tasks.values()],
      savedAt: Date.now(),
    };

    // 저장 디렉토리가 없으면 생성
    const dir = dirname(this.persistPath);
    await mkdir(dir, { recursive: true });
    await writeFile(this.persistPath, JSON.stringify(data, null, 2), "utf-8");
  }

  /**
   * 디스크에서 태스크 리스트를 복원합니다.
   *
   * 파일이 없으면 빈 리스트로 시작합니다 (에러 아님).
   * 파일이 있지만 파싱에 실패하면 에러를 발생시킵니다.
   *
   * @throws TaskListError — 파일 읽기/파싱 실패 시 (파일 미존재는 제외)
   */
  async load(): Promise<void> {
    if (!this.persistPath) return;

    try {
      const raw = await readFile(this.persistPath, "utf-8");
      const data = JSON.parse(raw) as PersistedTaskList;

      // 기존 데이터 초기화 후 파일에서 복원
      this.tasks.clear();
      this.locks.clear();

      for (const task of data.tasks) {
        this.tasks.set(task.id, task);
      }
    } catch (error: unknown) {
      // 파일이 아직 없는 것은 정상 — 빈 리스트로 시작
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
      // 파일이 없으면 빈 리스트로 시작 — 에러 아님
    }
  }

  /**
   * 모든 태스크와 잠금을 제거합니다.
   */
  clear(): void {
    this.tasks.clear();
    this.locks.clear();
  }

  // ---------------------------------------------------------------------------
  // 내부 헬퍼 메서드
  // ---------------------------------------------------------------------------

  /**
   * 주어진 의존 태스크 ID 목록 중 미완료인 것이 있는지 확인합니다.
   *
   * @param dependsOn - 의존 태스크 ID 목록
   * @returns true이면 미충족 의존성이 있음
   */
  private hasUnmetDependencies(dependsOn?: readonly string[]): boolean {
    if (!dependsOn || dependsOn.length === 0) return false;

    return dependsOn.some((depId) => {
      const dep = this.tasks.get(depId);
      // 태스크가 없거나 완료되지 않았으면 미충족
      return dep === undefined || dep.status !== "completed";
    });
  }

  /**
   * 태스크가 완료된 후, 이 태스크에 의존하던 blocked 태스크들의 의존성을 재확인합니다.
   * 모든 의존성이 충족되면 "blocked" → "pending"으로 상태를 승격(promote)합니다.
   *
   * @param completedTaskId - 방금 완료된 태스크의 ID
   */
  private promoteBlockedDependents(completedTaskId: string): void {
    // 완료된 태스크에 의존하는 태스크들을 찾음
    const dependents = this.getDependentTasks(completedTaskId);
    for (const dep of dependents) {
      // blocked 상태인 태스크만 대상
      if (dep.status !== "blocked") continue;

      // 모든 의존성이 이제 충족되었는지 확인
      if (this.areDependenciesMet(dep.id)) {
        // 불변 업데이트로 "pending"으로 승격
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
