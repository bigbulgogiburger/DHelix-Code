/**
 * JobQueue -- 인메모리 우선순위 기반 작업 큐
 *
 * 클라우드 작업을 우선순위와 FIFO 순서에 따라 관리합니다.
 * critical > high > normal > low 순으로 우선 처리되며,
 * 같은 우선순위 내에서는 먼저 등록된 작업이 먼저 나갑니다.
 *
 * 현재 인메모리 구현이며, 향후 Redis/SQS 등으로 교체 가능하도록
 * 인터페이스를 안정적으로 설계합니다.
 *
 * @module cloud/job-queue
 */

import { randomUUID } from 'node:crypto';

import type {
  CloudJob,
  CloudJobInput,
  CloudJobResult,
  JobFilter,
  JobStats,
  JobStatus,
} from './types.js';
import { PRIORITY_ORDER } from './types.js';

// ---------------------------------------------------------------------------
// JobQueue
// ---------------------------------------------------------------------------

/**
 * 인메모리 우선순위 기반 작업 큐
 *
 * 작업의 전체 수명주기(등록 → 대기 → 실행 → 완료/실패/취소)를 관리합니다.
 * 불변 객체 패턴을 사용하여 상태 변경 시 새 객체를 생성합니다.
 *
 * @example
 * ```ts
 * const queue = new JobQueue();
 * const jobId = queue.enqueue({
 *   agentManifestId: 'explore',
 *   prompt: 'Analyze codebase structure',
 *   priority: 'normal',
 * });
 * const next = queue.dequeue(); // 가장 높은 우선순위 작업
 * queue.updateStatus(jobId, 'completed', result);
 * ```
 */
export class JobQueue {
  /** 모든 작업을 ID로 인덱싱하는 맵 */
  private readonly jobs: Map<string, CloudJob> = new Map();

  /** 큐에 대기 중인 작업 ID 목록 (삽입 순서 유지) */
  private readonly queuedIds: string[] = [];

  /** disposed 상태 플래그 */
  private disposed = false;

  // -------------------------------------------------------------------------
  // Write Operations
  // -------------------------------------------------------------------------

  /**
   * 새 작업을 큐에 등록합니다.
   *
   * UUID를 자동 생성하고 status를 'queued', createdAt을 현재 시각으로 설정합니다.
   * 작업은 우선순위와 FIFO 순서에 따라 dequeue됩니다.
   *
   * @param input - 작업 생성 입력 (id, status, createdAt 제외)
   * @returns 생성된 작업 ID (UUID v4)
   * @throws disposed 상태에서 호출 시 에러
   */
  enqueue(input: CloudJobInput): string {
    this.assertNotDisposed();

    const id = randomUUID();
    const job: CloudJob = {
      ...input,
      id,
      status: 'queued',
      createdAt: Date.now(),
    };

    this.jobs.set(id, job);
    this.queuedIds.push(id);

    return id;
  }

  /**
   * 가장 높은 우선순위의 대기 중 작업을 꺼냅니다.
   *
   * 우선순위: critical(3) > high(2) > normal(1) > low(0)
   * 같은 우선순위 내에서는 먼저 등록된 작업(FIFO)이 먼저 나옵니다.
   * 꺼낸 작업의 상태는 'running'으로 변경되고 startedAt이 설정됩니다.
   *
   * @returns 가장 높은 우선순위 작업, 대기 작업이 없으면 undefined
   */
  dequeue(): CloudJob | undefined {
    this.assertNotDisposed();

    if (this.queuedIds.length === 0) {
      return undefined;
    }

    // 우선순위가 가장 높은 작업을 찾음
    let bestIdx = 0;
    let bestPriority = -1;

    for (let i = 0; i < this.queuedIds.length; i++) {
      const job = this.jobs.get(this.queuedIds[i]);
      if (job === undefined) {
        continue;
      }
      const p = PRIORITY_ORDER[job.priority];
      if (p > bestPriority) {
        bestPriority = p;
        bestIdx = i;
      }
    }

    const jobId = this.queuedIds[bestIdx];
    this.queuedIds.splice(bestIdx, 1);

    const job = this.jobs.get(jobId);
    if (job === undefined) {
      return undefined;
    }

    const running: CloudJob = {
      ...job,
      status: 'running',
      startedAt: Date.now(),
    };
    this.jobs.set(jobId, running);

    return running;
  }

  /**
   * 작업을 취소합니다.
   *
   * queued 또는 running 상태의 작업만 취소할 수 있습니다.
   * 이미 완료/실패/취소된 작업은 취소할 수 없습니다.
   *
   * @param jobId - 취소할 작업 ID
   * @returns 취소 성공 여부
   */
  cancel(jobId: string): boolean {
    this.assertNotDisposed();

    const job = this.jobs.get(jobId);
    if (job === undefined) {
      return false;
    }

    if (job.status !== 'queued' && job.status !== 'running') {
      return false;
    }

    const cancelled: CloudJob = {
      ...job,
      status: 'cancelled',
      completedAt: Date.now(),
    };
    this.jobs.set(jobId, cancelled);

    // queued 목록에서 제거
    const queueIdx = this.queuedIds.indexOf(jobId);
    if (queueIdx !== -1) {
      this.queuedIds.splice(queueIdx, 1);
    }

    return true;
  }

  /**
   * 작업 상태를 업데이트합니다.
   *
   * 완료/실패 상태로 변경 시 completedAt이 자동 설정됩니다.
   * result는 completed 또는 failed 상태에서만 설정할 수 있습니다.
   *
   * @param jobId - 업데이트할 작업 ID
   * @param status - 새 상태
   * @param result - 작업 결과 (completed/failed 시)
   * @throws 존재하지 않는 작업 ID에 대해 에러
   */
  updateStatus(jobId: string, status: JobStatus, result?: CloudJobResult): void {
    this.assertNotDisposed();

    const job = this.jobs.get(jobId);
    if (job === undefined) {
      throw new Error(`Job not found: ${jobId}`);
    }

    const isTerminal = status === 'completed' || status === 'failed' || status === 'cancelled';
    const updated: CloudJob = {
      ...job,
      status,
      ...(isTerminal ? { completedAt: Date.now() } : {}),
      ...(result !== undefined ? { result } : {}),
    };
    this.jobs.set(jobId, updated);

    // 터미널 상태가 되면 queued 목록에서도 제거
    if (isTerminal) {
      const queueIdx = this.queuedIds.indexOf(jobId);
      if (queueIdx !== -1) {
        this.queuedIds.splice(queueIdx, 1);
      }
    }
  }

  // -------------------------------------------------------------------------
  // Read Operations
  // -------------------------------------------------------------------------

  /**
   * 작업 ID로 작업을 조회합니다.
   *
   * @param jobId - 조회할 작업 ID
   * @returns 작업 객체, 없으면 undefined
   */
  getJob(jobId: string): CloudJob | undefined {
    return this.jobs.get(jobId);
  }

  /**
   * 필터 조건에 맞는 작업 목록을 반환합니다.
   *
   * 필터가 없으면 전체 작업을 반환합니다.
   * 반환 순서는 생성 시각(createdAt) 오름차순입니다.
   *
   * @param filter - 조회 필터 (status, priority)
   * @returns 필터를 통과한 작업 배열 (읽기 전용)
   */
  listJobs(filter?: JobFilter): readonly CloudJob[] {
    const allJobs = [...this.jobs.values()];

    if (filter === undefined) {
      return allJobs.sort((a, b) => a.createdAt - b.createdAt);
    }

    return allJobs
      .filter((job) => {
        if (filter.status !== undefined && job.status !== filter.status) {
          return false;
        }
        if (filter.priority !== undefined && job.priority !== filter.priority) {
          return false;
        }
        return true;
      })
      .sort((a, b) => a.createdAt - b.createdAt);
  }

  /**
   * 작업 큐의 통계를 반환합니다.
   *
   * 각 상태별 작업 수를 집계합니다.
   *
   * @returns 상태별 작업 수
   */
  getStats(): JobStats {
    let queued = 0;
    let running = 0;
    let completed = 0;
    let failed = 0;
    let cancelled = 0;

    for (const job of this.jobs.values()) {
      switch (job.status) {
        case 'queued': queued++; break;
        case 'running': running++; break;
        case 'completed': completed++; break;
        case 'failed': failed++; break;
        case 'cancelled': cancelled++; break;
      }
    }

    return { queued, running, completed, failed, cancelled };
  }

  // -------------------------------------------------------------------------
  // Lifecycle
  // -------------------------------------------------------------------------

  /**
   * 큐의 모든 작업을 제거합니다.
   *
   * 테스트 초기화 또는 세션 리셋 시 사용합니다.
   */
  clear(): void {
    this.jobs.clear();
    this.queuedIds.length = 0;
  }

  /**
   * 큐를 폐기하고 리소스를 정리합니다.
   *
   * 폐기 후 enqueue/dequeue/cancel/updateStatus 호출 시 에러가 발생합니다.
   */
  dispose(): void {
    this.clear();
    this.disposed = true;
  }

  // -------------------------------------------------------------------------
  // Internal
  // -------------------------------------------------------------------------

  /**
   * disposed 상태가 아닌지 확인합니다.
   *
   * @throws 폐기된 큐에 대한 작업 시 에러
   */
  private assertNotDisposed(): void {
    if (this.disposed) {
      throw new Error('JobQueue has been disposed');
    }
  }
}
