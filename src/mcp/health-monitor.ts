/**
 * MCP Health Monitor — MCP 서버의 연결 상태를 모니터링하고 자동 재연결을 수행합니다.
 *
 * 설계 원칙:
 * - **의존성 주입**: MCPClient에 직접 의존하지 않음. pingFn과 reconnectFn을 외부에서 주입받음.
 * - **부작용 최소화**: 모니터링 로직은 순수하고, 타이머만 부작용을 가짐.
 * - **이벤트 기반**: 상태 변경 시 등록된 콜백을 호출 (자체 콜백 패턴으로 단순화).
 *
 * 상태 전이:
 * - healthy   → degraded       : consecutiveFailures >= degradedAfter
 * - degraded  → unreachable    : consecutiveFailures >= unreachableAfter
 * - degraded/unreachable → healthy : 핑 성공 시 즉시 복구
 *
 * @example
 * ```typescript
 * const monitor = new McpHealthMonitor({ pingIntervalMs: 30_000 });
 *
 * monitor.registerServer("srv-1", "filesystem", async () => {
 *   await client.listTools(); // 실제 핑 구현 주입
 * });
 *
 * monitor.onStatusChange((serverId, prev, next) => {
 *   console.log(`${serverId}: ${prev} → ${next.status}`);
 * });
 *
 * monitor.start();
 * ```
 */

// ────────────────────────────────────────────────────────────────────────────
// 공개 타입 정의
// ────────────────────────────────────────────────────────────────────────────

/**
 * 단일 MCP 서버의 헬스 상태 스냅샷.
 *
 * - `healthy`     : 정상 동작 중
 * - `degraded`    : 연속 실패가 발생했지만 아직 사용 가능 (경고 표시 권장)
 * - `unreachable` : 다수의 연속 실패로 사실상 연결 불가 상태
 */
export interface McpServerHealth {
  /** 서버를 고유하게 식별하는 ID */
  readonly serverId: string;
  /** 사람이 읽을 수 있는 서버 표시 이름 */
  readonly serverName: string;
  /** 현재 헬스 상태 */
  readonly status: "healthy" | "degraded" | "unreachable";
  /** 마지막 핑 응답 시간 (ms). 아직 핑을 보내지 않았으면 null */
  readonly lastPingMs: number | null;
  /** 현재 연속 실패 횟수 (성공 시 0으로 초기화) */
  readonly consecutiveFailures: number;
  /** 마지막 성공 시각 (Unix ms). 한 번도 성공하지 않았으면 null */
  readonly lastSuccessAt: number | null;
  /** 마지막 실패 시각 (Unix ms). 한 번도 실패하지 않았으면 null */
  readonly lastFailureAt: number | null;
}

/**
 * McpHealthMonitor 생성 설정.
 *
 * 모든 값은 선택적이며, 생략 시 안전한 기본값이 사용됩니다.
 */
export interface HealthMonitorConfig {
  /** 핑 전송 주기 (ms). 기본값: 30_000 (30초) */
  readonly pingIntervalMs?: number;
  /** 핑 타임아웃 (ms). 기본값: 5_000 (5초) */
  readonly pingTimeoutMs?: number;
  /**
   * 연속 실패 횟수가 이 값 이상이 되면 'degraded' 상태로 전환.
   * 기본값: 2
   */
  readonly degradedAfter?: number;
  /**
   * 연속 실패 횟수가 이 값 이상이 되면 'unreachable' 상태로 전환.
   * 기본값: 5
   */
  readonly unreachableAfter?: number;
}

/**
 * requestReconnect 호출 시 사용할 재연결 전략 설정.
 */
export interface ReconnectConfig {
  /** 최대 재시도 횟수. 기본값: 5 */
  readonly maxRetries?: number;
  /** 첫 재시도 대기 시간 (ms). 기본값: 1_000 */
  readonly baseDelayMs?: number;
  /** 재시도 대기 시간의 최대값 (ms). 기본값: 30_000 */
  readonly maxDelayMs?: number;
  /** 백오프 승수. 기본값: 2.0 */
  readonly backoffMultiplier?: number;
}

/**
 * 상태 변경 콜백 함수 시그니처.
 *
 * @param serverId   - 상태가 변경된 서버 ID
 * @param prevStatus - 이전 헬스 상태
 * @param nextHealth - 변경 후 전체 헬스 스냅샷
 */
export type StatusChangeCallback = (
  serverId: string,
  prevStatus: McpServerHealth["status"],
  nextHealth: Readonly<McpServerHealth>,
) => void;

// ────────────────────────────────────────────────────────────────────────────
// 내부 타입 정의
// ────────────────────────────────────────────────────────────────────────────

/** 서버당 내부 가변 상태. 외부에는 불변 스냅샷으로 노출됩니다. */
interface ServerEntry {
  serverId: string;
  serverName: string;
  pingFn: () => Promise<void>;
  status: McpServerHealth["status"];
  lastPingMs: number | null;
  consecutiveFailures: number;
  lastSuccessAt: number | null;
  lastFailureAt: number | null;
}

// ────────────────────────────────────────────────────────────────────────────
// 기본값 상수
// ────────────────────────────────────────────────────────────────────────────

const DEFAULT_PING_INTERVAL_MS = 30_000;
const DEFAULT_PING_TIMEOUT_MS = 5_000;
const DEFAULT_DEGRADED_AFTER = 2;
const DEFAULT_UNREACHABLE_AFTER = 5;

const DEFAULT_MAX_RETRIES = 5;
const DEFAULT_BASE_DELAY_MS = 1_000;
const DEFAULT_MAX_DELAY_MS = 30_000;
const DEFAULT_BACKOFF_MULTIPLIER = 2.0;

// ────────────────────────────────────────────────────────────────────────────
// McpHealthMonitor 클래스
// ────────────────────────────────────────────────────────────────────────────

/**
 * MCP 서버 헬스 모니터.
 *
 * 주기적으로 등록된 서버에 핑을 보내 연결 상태를 추적하고,
 * 상태 변화 시 등록된 콜백을 호출합니다.
 * 재연결 로직은 requestReconnect()를 통해 개별적으로 트리거할 수 있습니다.
 */
export class McpHealthMonitor {
  private readonly config: Required<HealthMonitorConfig>;
  private readonly servers = new Map<string, ServerEntry>();
  private readonly callbacks = new Set<StatusChangeCallback>();
  private intervalHandle: ReturnType<typeof setInterval> | null = null;

  /**
   * @param config - 헬스 모니터 설정 (모두 선택적)
   */
  constructor(config: HealthMonitorConfig = {}) {
    this.config = {
      pingIntervalMs: config.pingIntervalMs ?? DEFAULT_PING_INTERVAL_MS,
      pingTimeoutMs: config.pingTimeoutMs ?? DEFAULT_PING_TIMEOUT_MS,
      degradedAfter: config.degradedAfter ?? DEFAULT_DEGRADED_AFTER,
      unreachableAfter: config.unreachableAfter ?? DEFAULT_UNREACHABLE_AFTER,
    };
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 서버 등록
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * 모니터링할 서버를 등록합니다.
   *
   * 이미 등록된 serverId로 다시 호출하면 기존 항목을 덮어씁니다.
   * pingFn은 외부에서 주입되며, 해당 함수가 throw하면 실패로 간주합니다.
   *
   * @param serverId   - 고유 서버 ID
   * @param serverName - 표시용 서버 이름
   * @param pingFn     - 핑 구현 함수 (throw 시 실패로 처리)
   */
  registerServer(serverId: string, serverName: string, pingFn: () => Promise<void>): void {
    this.servers.set(serverId, {
      serverId,
      serverName,
      pingFn,
      status: "healthy",
      lastPingMs: null,
      consecutiveFailures: 0,
      lastSuccessAt: null,
      lastFailureAt: null,
    });
  }

  /**
   * 등록된 서버를 제거합니다.
   *
   * @param serverId - 제거할 서버 ID
   * @returns 서버가 존재하여 제거되었으면 true, 없으면 false
   */
  unregisterServer(serverId: string): boolean {
    return this.servers.delete(serverId);
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 타이머 수명주기
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * 주기적 핑 타이머를 시작합니다.
   *
   * 이미 실행 중이면 아무 작업도 하지 않습니다.
   * setInterval에 `.unref()`를 호출하여 Node.js 프로세스가
   * 타이머만 남아있을 때 자동으로 종료될 수 있도록 합니다.
   */
  start(): void {
    if (this.intervalHandle !== null) return;

    this.intervalHandle = setInterval(() => {
      void this.pingAll();
    }, this.config.pingIntervalMs);

    // 이 타이머가 프로세스 종료를 막지 않도록 unref
    if (typeof this.intervalHandle === "object" && "unref" in this.intervalHandle) {
      (this.intervalHandle as { unref(): void }).unref();
    }
  }

  /**
   * 주기적 핑 타이머를 정지합니다.
   *
   * 이미 정지된 상태이면 아무 작업도 하지 않습니다.
   */
  stop(): void {
    if (this.intervalHandle === null) return;
    clearInterval(this.intervalHandle);
    this.intervalHandle = null;
  }

  /**
   * 타이머를 정지하고 모든 내부 상태를 정리합니다.
   *
   * 인스턴스를 더 이상 사용하지 않을 때 호출하세요.
   */
  dispose(): void {
    this.stop();
    this.servers.clear();
    this.callbacks.clear();
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 헬스 상태 조회
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * 특정 서버의 헬스 스냅샷을 반환합니다.
   *
   * @param serverId - 조회할 서버 ID
   * @returns 헬스 스냅샷, 등록되지 않은 서버면 undefined
   */
  getHealth(serverId: string): McpServerHealth | undefined {
    const entry = this.servers.get(serverId);
    if (!entry) return undefined;
    return this.toSnapshot(entry);
  }

  /**
   * 등록된 모든 서버의 헬스 스냅샷 배열을 반환합니다.
   *
   * @returns 불변 헬스 스냅샷 배열 (등록 순서 보장)
   */
  getAllHealth(): readonly McpServerHealth[] {
    return [...this.servers.values()].map((entry) => this.toSnapshot(entry));
  }

  /**
   * 특정 서버가 현재 'healthy' 상태인지 확인합니다.
   *
   * @param serverId - 확인할 서버 ID
   * @returns healthy 상태이면 true, 그렇지 않거나 등록되지 않은 서버면 false
   */
  isHealthy(serverId: string): boolean {
    return this.servers.get(serverId)?.status === "healthy";
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 콜백 등록
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * 상태 변경 콜백을 등록합니다.
   *
   * 같은 콜백 함수를 여러 번 등록해도 한 번만 호출됩니다 (Set 기반).
   *
   * @param callback - 상태 변경 시 호출할 함수
   * @returns 콜백을 해제(detach)하는 함수
   *
   * @example
   * ```typescript
   * const detach = monitor.onStatusChange((id, prev, next) => {
   *   if (next.status === 'unreachable') alertOps(id);
   * });
   * // 나중에
   * detach();
   * ```
   */
  onStatusChange(callback: StatusChangeCallback): () => void {
    this.callbacks.add(callback);
    return () => {
      this.callbacks.delete(callback);
    };
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 재연결
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * 지정된 서버에 대해 exponential backoff + jitter를 적용한 재연결을 시도합니다.
   *
   * - 성공 시 해당 서버의 헬스 상태를 'healthy'로 리셋하고 true를 반환합니다.
   * - maxRetries를 초과하면 false를 반환합니다.
   * - reconnectFn이 throw하면 해당 시도는 실패로 간주하고 다음 시도를 예약합니다.
   *
   * @param serverId      - 재연결할 서버 ID
   * @param reconnectFn   - 실제 재연결 구현 함수 (외부 주입)
   * @param config        - 재연결 전략 설정 (선택적)
   * @returns 재연결 성공 시 true, maxRetries 초과 시 false
   */
  async requestReconnect(
    serverId: string,
    reconnectFn: () => Promise<void>,
    config: ReconnectConfig = {},
  ): Promise<boolean> {
    const maxRetries = config.maxRetries ?? DEFAULT_MAX_RETRIES;
    const baseDelayMs = config.baseDelayMs ?? DEFAULT_BASE_DELAY_MS;
    const maxDelayMs = config.maxDelayMs ?? DEFAULT_MAX_DELAY_MS;
    const backoffMultiplier = config.backoffMultiplier ?? DEFAULT_BACKOFF_MULTIPLIER;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        await reconnectFn();

        // 재연결 성공 — 헬스 상태를 healthy로 리셋
        const entry = this.servers.get(serverId);
        if (entry) {
          const prevStatus = entry.status;
          entry.status = "healthy";
          entry.consecutiveFailures = 0;
          entry.lastSuccessAt = Date.now();
          this.notifyCallbacks(serverId, prevStatus, entry);
        }

        return true;
      } catch {
        // 마지막 시도가 아니면 backoff 후 재시도
        if (attempt < maxRetries - 1) {
          const delayMs = this.calculateBackoff(
            attempt,
            baseDelayMs,
            maxDelayMs,
            backoffMultiplier,
          );
          await this.sleep(delayMs);
        }
      }
    }

    return false;
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 내부 핑 로직
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * 등록된 모든 서버에 핑을 보냅니다.
   * 각 핑은 독립적으로 실행되며, 한 서버의 실패가 다른 서버에 영향을 주지 않습니다.
   */
  private async pingAll(): Promise<void> {
    const pingPromises = [...this.servers.values()].map((entry) => this.pingOne(entry));
    await Promise.allSettled(pingPromises);
  }

  /**
   * 단일 서버에 핑을 보내고 결과에 따라 헬스 상태를 업데이트합니다.
   *
   * @param entry - 핑할 서버의 내부 상태
   */
  private async pingOne(entry: ServerEntry): Promise<void> {
    const startTime = Date.now();

    try {
      await this.withTimeout(entry.pingFn(), this.config.pingTimeoutMs);

      const elapsed = Date.now() - startTime;
      const prevStatus = entry.status;

      entry.lastPingMs = elapsed;
      entry.lastSuccessAt = Date.now();
      entry.consecutiveFailures = 0;
      entry.status = "healthy";

      if (prevStatus !== entry.status) {
        this.notifyCallbacks(entry.serverId, prevStatus, entry);
      }
    } catch {
      const prevStatus = entry.status;

      entry.lastPingMs = null;
      entry.lastFailureAt = Date.now();
      entry.consecutiveFailures += 1;

      const nextStatus = this.deriveStatus(entry.consecutiveFailures);
      entry.status = nextStatus;

      if (prevStatus !== entry.status) {
        this.notifyCallbacks(entry.serverId, prevStatus, entry);
      }
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 내부 유틸리티
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * 연속 실패 횟수로부터 헬스 상태를 결정합니다.
   *
   * @param consecutiveFailures - 현재 연속 실패 횟수
   * @returns 계산된 헬스 상태
   */
  private deriveStatus(consecutiveFailures: number): McpServerHealth["status"] {
    if (consecutiveFailures >= this.config.unreachableAfter) return "unreachable";
    if (consecutiveFailures >= this.config.degradedAfter) return "degraded";
    return "healthy";
  }

  /**
   * 등록된 모든 상태 변경 콜백을 호출합니다.
   *
   * @param serverId   - 상태가 변경된 서버 ID
   * @param prevStatus - 이전 상태
   * @param entry      - 현재 내부 서버 상태
   */
  private notifyCallbacks(
    serverId: string,
    prevStatus: McpServerHealth["status"],
    entry: ServerEntry,
  ): void {
    const snapshot = this.toSnapshot(entry);
    for (const cb of this.callbacks) {
      try {
        cb(serverId, prevStatus, snapshot);
      } catch {
        // 콜백 에러가 모니터링 루프를 중단시키지 않도록 무시
      }
    }
  }

  /**
   * 내부 ServerEntry를 외부 공개 McpServerHealth 스냅샷으로 변환합니다.
   *
   * @param entry - 내부 가변 상태
   * @returns 불변 헬스 스냅샷
   */
  private toSnapshot(entry: ServerEntry): McpServerHealth {
    return {
      serverId: entry.serverId,
      serverName: entry.serverName,
      status: entry.status,
      lastPingMs: entry.lastPingMs,
      consecutiveFailures: entry.consecutiveFailures,
      lastSuccessAt: entry.lastSuccessAt,
      lastFailureAt: entry.lastFailureAt,
    };
  }

  /**
   * exponential backoff + jitter 지연 시간을 계산합니다.
   *
   * 공식: min(baseDelayMs * multiplier^attempt, maxDelayMs) * (0.8 ~ 1.2 범위의 jitter)
   *
   * @param attempt           - 0부터 시작하는 현재 시도 번호
   * @param baseDelayMs       - 기본 지연 (ms)
   * @param maxDelayMs        - 최대 지연 (ms)
   * @param backoffMultiplier - 배수
   * @returns 실제 대기할 밀리초
   */
  private calculateBackoff(
    attempt: number,
    baseDelayMs: number,
    maxDelayMs: number,
    backoffMultiplier: number,
  ): number {
    const exponential = baseDelayMs * Math.pow(backoffMultiplier, attempt);
    const capped = Math.min(exponential, maxDelayMs);
    // ±20% jitter 적용
    const jitter = 0.8 + Math.random() * 0.4;
    return Math.floor(capped * jitter);
  }

  /**
   * Promise에 타임아웃을 적용합니다.
   *
   * @param promise   - 타임아웃을 적용할 Promise
   * @param timeoutMs - 타임아웃 (ms)
   * @returns 원래 Promise의 결과
   * @throws Error timeoutMs 이내에 resolve/reject되지 않으면 throw
   */
  private withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`Ping timed out after ${timeoutMs}ms`));
      }, timeoutMs);

      promise.then(
        (value) => {
          clearTimeout(timer);
          resolve(value);
        },
        (error: unknown) => {
          clearTimeout(timer);
          reject(error instanceof Error ? error : new Error(String(error)));
        },
      );
    });
  }

  /**
   * 지정된 시간(ms) 동안 대기합니다.
   *
   * @param ms - 대기할 밀리초
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
