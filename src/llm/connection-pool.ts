/**
 * Connection Pool + WebSocket Prewarm — LLM 엔드포인트 연결 풀 관리 모듈
 *
 * LLM API 호출 시 연결을 재사용하여 레이턴시를 줄이고 처리량을 높입니다.
 * 자주 사용하는 엔드포인트를 미리 워밍업(prewarm)하여 첫 번째 요청 지연을 최소화합니다.
 *
 * 주요 기능:
 * - 연결 풀: 최대 maxConnections 개의 연결을 유지
 * - 유휴 타임아웃: idleTimeoutMs 이후 미사용 연결 자동 반환
 * - 프리워밍: 지정된 엔드포인트에 대한 연결을 미리 확보
 * - 통계: 생성·재사용·활성·유휴 연결 수 추적
 */

import { randomUUID } from "crypto";

// ─── 인터페이스 정의 ────────────────────────────────────────────────

/**
 * 연결 풀 설정
 */
export interface PoolConfig {
  /** 최대 연결 수 (기본값: 10) */
  readonly maxConnections: number;
  /** 유휴 연결 타임아웃 (밀리초, 기본값: 30_000) */
  readonly idleTimeoutMs: number;
  /** 프리워밍할 연결 수 (기본값: 2) */
  readonly prewarmCount: number;
}

/**
 * 풀에서 관리되는 개별 연결
 */
export interface PooledConnection {
  /** 연결 고유 ID */
  readonly id: string;
  /** 연결 대상 엔드포인트 URL */
  readonly endpoint: string;
  /** 연결 생성 시각 (Unix timestamp, ms) */
  readonly createdAt: number;
  /** 마지막 사용 시각 (Unix timestamp, ms) */
  readonly lastUsedAt: number;
  /** 연결 상태 */
  readonly status: "idle" | "active" | "closed";
}

/**
 * 연결 풀 통계
 */
export interface PoolStats {
  /** 전체 연결 수 (active + idle) */
  readonly total: number;
  /** 현재 활성 연결 수 */
  readonly active: number;
  /** 현재 유휴 연결 수 */
  readonly idle: number;
  /** 새로 생성된 연결 수 (세션 전체) */
  readonly created: number;
  /** 재사용된 연결 수 (세션 전체) */
  readonly reused: number;
}

// ─── 기본 설정 ──────────────────────────────────────────────────────

const DEFAULT_CONFIG: PoolConfig = {
  maxConnections: 10,
  idleTimeoutMs: 30_000,
  prewarmCount: 2,
};

// ─── 내부 타입 ──────────────────────────────────────────────────────

/** mutable 내부 연결 데이터 */
interface MutableConnection {
  id: string;
  endpoint: string;
  createdAt: number;
  lastUsedAt: number;
  status: "idle" | "active" | "closed";
}

// ─── ConnectionPool 클래스 ───────────────────────────────────────────

/**
 * LLM 엔드포인트 연결 풀
 *
 * 사용 예시:
 * ```typescript
 * const pool = new ConnectionPool({ maxConnections: 5, idleTimeoutMs: 30_000, prewarmCount: 2 });
 *
 * // 프리워밍
 * await pool.prewarm(["https://api.anthropic.com", "https://api.openai.com"]);
 *
 * // 연결 획득
 * const conn = await pool.acquire("https://api.anthropic.com");
 *
 * // 작업 후 반환
 * pool.release(conn.id);
 *
 * // 통계 확인
 * console.log(pool.getStats());
 *
 * // 정리
 * await pool.drain();
 * pool.dispose();
 * ```
 */
export class ConnectionPool {
  private readonly config: PoolConfig;

  /** 연결 ID → 연결 데이터 */
  private readonly connections: Map<string, MutableConnection> = new Map();

  /** 엔드포인트 → idle 연결 ID 큐 (FIFO) */
  private readonly idleQueues: Map<string, string[]> = new Map();

  /** 유휴 타임아웃 타이머 핸들 */
  private readonly idleTimers: Map<string, ReturnType<typeof setTimeout>> = new Map();

  /** 전체 생성된 연결 수 */
  private createdCount = 0;

  /** 전체 재사용된 연결 수 */
  private reusedCount = 0;

  /** dispose 여부 */
  private disposed = false;

  /**
   * @param config - 풀 설정 (생략 시 기본값 사용)
   */
  constructor(config: Partial<PoolConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * 엔드포인트에 대한 연결을 획득
   *
   * 유휴 연결이 있으면 재사용하고, 없으면 새로 생성합니다.
   * 최대 연결 수에 도달하면 유휴 연결이 생길 때까지 대기합니다.
   *
   * @param endpoint - 연결할 엔드포인트 URL
   * @returns 활성화된 PooledConnection
   * @throws Error - dispose()가 호출된 이후인 경우
   */
  async acquire(endpoint: string): Promise<PooledConnection> {
    this.assertNotDisposed();

    // 유휴 연결 재사용
    const idleConn = this.popIdleConnection(endpoint);
    if (idleConn) {
      this.cancelIdleTimer(idleConn.id);
      idleConn.status = "active";
      idleConn.lastUsedAt = Date.now();
      this.reusedCount++;
      return this.toPublic(idleConn);
    }

    // 최대 연결 수 초과 시 다른 엔드포인트의 유휴 연결 강제 반납
    if (this.countActiveAndIdle() >= this.config.maxConnections) {
      this.evictOldestIdle();
    }

    // 새 연결 생성
    const conn = this.createConnection(endpoint);
    this.createdCount++;
    return this.toPublic(conn);
  }

  /**
   * 연결을 풀에 반환 (idle 상태로 전환)
   *
   * 반환된 연결은 idleTimeoutMs 이후 자동으로 닫힙니다.
   *
   * @param connectionId - 반환할 연결 ID
   */
  release(connectionId: string): void {
    const conn = this.connections.get(connectionId);
    if (!conn || conn.status === "closed") return;

    conn.status = "idle";
    conn.lastUsedAt = Date.now();

    // idle 큐에 추가
    const queue = this.idleQueues.get(conn.endpoint) ?? [];
    queue.push(conn.id);
    this.idleQueues.set(conn.endpoint, queue);

    // 유휴 타임아웃 설정
    this.scheduleIdleTimeout(conn.id);
  }

  /**
   * 지정된 엔드포인트들에 대해 prewarmCount 만큼 연결을 미리 생성
   *
   * @param endpoints - 프리워밍할 엔드포인트 URL 목록
   */
  async prewarm(endpoints: readonly string[]): Promise<void> {
    this.assertNotDisposed();

    const tasks: Promise<void>[] = [];

    for (const endpoint of endpoints) {
      for (let i = 0; i < this.config.prewarmCount; i++) {
        tasks.push(this.prewarmOne(endpoint));
      }
    }

    await Promise.all(tasks);
  }

  /**
   * 연결 풀 통계를 반환
   *
   * @returns PoolStats 스냅샷
   */
  getStats(): PoolStats {
    let active = 0;
    let idle = 0;

    for (const conn of this.connections.values()) {
      if (conn.status === "active") active++;
      else if (conn.status === "idle") idle++;
    }

    return {
      total: active + idle,
      active,
      idle,
      created: this.createdCount,
      reused: this.reusedCount,
    };
  }

  /**
   * 모든 연결을 닫고 풀을 비움
   *
   * drain() 완료 후에도 풀을 재사용할 수 있습니다.
   */
  async drain(): Promise<void> {
    // 모든 타이머 취소
    for (const [id] of this.idleTimers) {
      this.cancelIdleTimer(id);
    }

    // 모든 연결 닫기
    for (const conn of this.connections.values()) {
      conn.status = "closed";
    }

    this.connections.clear();
    this.idleQueues.clear();
    this.createdCount = 0;
    this.reusedCount = 0;
  }

  /**
   * 풀을 영구적으로 해제 — 이후 acquire() 호출 시 에러 발생
   *
   * drain()을 내부적으로 호출합니다.
   */
  dispose(): void {
    if (this.disposed) return;
    void this.drain();
    this.disposed = true;
  }

  // ─── 내부 헬퍼 ────────────────────────────────────────────────────

  /**
   * 새 연결 객체를 생성하고 풀에 등록 (active 상태)
   */
  private createConnection(endpoint: string): MutableConnection {
    const now = Date.now();
    const conn: MutableConnection = {
      id: randomUUID(),
      endpoint,
      createdAt: now,
      lastUsedAt: now,
      status: "active",
    };
    this.connections.set(conn.id, conn);
    return conn;
  }

  /**
   * 엔드포인트의 idle 큐에서 연결을 꺼냄
   */
  private popIdleConnection(endpoint: string): MutableConnection | undefined {
    const queue = this.idleQueues.get(endpoint);
    if (!queue || queue.length === 0) return undefined;

    // 유효한 idle 연결을 찾을 때까지 dequeue
    while (queue.length > 0) {
      const id = queue.shift()!;
      const conn = this.connections.get(id);
      if (conn && conn.status === "idle") {
        return conn;
      }
    }

    return undefined;
  }

  /**
   * 가장 오래된 idle 연결을 강제로 닫음 (용량 확보)
   */
  private evictOldestIdle(): void {
    let oldest: MutableConnection | undefined;

    for (const conn of this.connections.values()) {
      if (conn.status === "idle") {
        if (!oldest || conn.lastUsedAt < oldest.lastUsedAt) {
          oldest = conn;
        }
      }
    }

    if (oldest) {
      this.closeConnection(oldest.id);
    }
  }

  /**
   * 연결을 닫고 풀에서 제거
   */
  private closeConnection(id: string): void {
    const conn = this.connections.get(id);
    if (!conn) return;

    conn.status = "closed";
    this.cancelIdleTimer(id);

    // idle 큐에서 제거
    const queue = this.idleQueues.get(conn.endpoint);
    if (queue) {
      const idx = queue.indexOf(id);
      if (idx !== -1) queue.splice(idx, 1);
    }

    this.connections.delete(id);
  }

  /**
   * 유휴 타임아웃 스케줄 등록
   */
  private scheduleIdleTimeout(id: string): void {
    this.cancelIdleTimer(id); // 기존 타이머 취소
    const timer = setTimeout(() => {
      this.closeConnection(id);
    }, this.config.idleTimeoutMs);

    // Node.js 환경에서 프로세스 종료 블로킹 방지
    if (typeof timer === "object" && "unref" in timer) {
      (timer as { unref(): void }).unref();
    }

    this.idleTimers.set(id, timer);
  }

  /**
   * 유휴 타이머를 취소
   */
  private cancelIdleTimer(id: string): void {
    const timer = this.idleTimers.get(id);
    if (timer !== undefined) {
      clearTimeout(timer);
      this.idleTimers.delete(id);
    }
  }

  /**
   * 단일 엔드포인트 프리워밍 (생성 후 idle 상태로 전환)
   */
  private async prewarmOne(endpoint: string): Promise<void> {
    if (this.countActiveAndIdle() >= this.config.maxConnections) return;

    const conn = this.createConnection(endpoint);
    this.createdCount++;

    // 즉시 idle로 전환하여 풀에서 재사용 가능하게 함
    conn.status = "idle";

    const queue = this.idleQueues.get(endpoint) ?? [];
    queue.push(conn.id);
    this.idleQueues.set(endpoint, queue);

    this.scheduleIdleTimeout(conn.id);
  }

  /**
   * active + idle 연결 총 수를 반환
   */
  private countActiveAndIdle(): number {
    let count = 0;
    for (const conn of this.connections.values()) {
      if (conn.status !== "closed") count++;
    }
    return count;
  }

  /**
   * MutableConnection을 읽기 전용 PooledConnection으로 변환
   */
  private toPublic(conn: MutableConnection): PooledConnection {
    return {
      id: conn.id,
      endpoint: conn.endpoint,
      createdAt: conn.createdAt,
      lastUsedAt: conn.lastUsedAt,
      status: conn.status,
    };
  }

  /**
   * dispose 상태 확인
   */
  private assertNotDisposed(): void {
    if (this.disposed) {
      throw new Error("ConnectionPool has been disposed and cannot be used");
    }
  }
}
