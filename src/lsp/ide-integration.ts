/**
 * IDE Integration v2 — VSCode 통합 강화 모듈
 *
 * inline diff 포워딩, diagnostics 전달, 변경사항 동기화를 담당합니다.
 *
 * 핵심 기능:
 * - diagnostics 큐잉 및 IDE 전달
 * - inline diff 요청 (before/after 표시)
 * - IDE 이벤트 구독/해제
 * - debounce 처리로 과도한 업데이트 방지
 *
 * @example
 * ```typescript
 * import { IDEIntegration } from "./lsp/ide-integration.js";
 *
 * const ide = new IDEIntegration({ debounceMs: 300 });
 * const unsub = ide.onEvent((event) => console.log(event.type));
 * ide.forwardDiagnostics([{ filePath: "/src/foo.ts", line: 5, column: 1, severity: "error", message: "oops", source: "typescript" }]);
 * // ...
 * unsub();
 * ide.dispose();
 * ```
 */

// ── Types ──

/**
 * IDE 이벤트 타입
 * IDE와 DHelix CLI 사이에 교환되는 이벤트를 나타냅니다.
 */
export interface IDEEvent {
  /** 이벤트 종류 */
  readonly type:
    | "file-changed"
    | "diagnostic"
    | "diff-applied"
    | "cursor-moved"
    | "selection-changed";
  /** 관련 파일 경로 */
  readonly filePath: string;
  /** 이벤트 발생 시각 (Unix ms) */
  readonly timestamp: number;
  /** 이벤트 페이로드 (타입별로 다름) */
  readonly data: unknown;
}

/**
 * 진단 정보 (에러/경고 등)
 */
export interface DiagnosticInfo {
  /** 진단 대상 파일 경로 */
  readonly filePath: string;
  /** 1-based 행 번호 */
  readonly line: number;
  /** 1-based 열 번호 */
  readonly column: number;
  /** 심각도 */
  readonly severity: "error" | "warning" | "info" | "hint";
  /** 진단 메시지 */
  readonly message: string;
  /** 진단 출처 ("typescript", "eslint", "dhelix" 등) */
  readonly source: string;
  /** 진단 코드 (옵션) */
  readonly code?: string;
}

/**
 * Inline diff 요청
 */
export interface InlineDiffRequest {
  /** 변경 대상 파일 경로 */
  readonly filePath: string;
  /** 변경 전 내용 */
  readonly before: string;
  /** 변경 후 내용 */
  readonly after: string;
  /** 변경 설명 */
  readonly description: string;
}

/**
 * IDE 통합 설정
 */
export interface IDEIntegrationConfig {
  /** diagnostics 전달 활성화 (기본: true) */
  readonly enableDiagnostics?: boolean;
  /** inline diff 표시 활성화 (기본: true) */
  readonly enableInlineDiff?: boolean;
  /** debounce 간격 ms (기본: 300) */
  readonly debounceMs?: number;
}

// ── Stats ──

/**
 * IDE 통합 모듈의 통계 정보
 */
export interface IDEIntegrationStats {
  /** 총 포워딩된 diagnostics 수 */
  readonly diagnosticsForwarded: number;
  /** 총 요청된 inline diff 수 */
  readonly diffsRequested: number;
  /** 총 수신된 이벤트 수 */
  readonly eventsReceived: number;
}

// ── IDEIntegration ──

/**
 * IDE Integration — VSCode와의 통합을 강화하는 클래스
 *
 * diagnostics 큐잉, inline diff 포워딩, 이벤트 구독 기능을 제공합니다.
 * dispose() 이후에는 어떠한 메서드도 호출할 수 없습니다.
 *
 * @example
 * ```typescript
 * const ide = new IDEIntegration({ debounceMs: 200 });
 *
 * const unsub = ide.onEvent((e) => {
 *   if (e.type === "file-changed") { ... }
 * });
 *
 * ide.forwardDiagnostics([...]);
 * ide.requestInlineDiff({ filePath: "a.ts", before: "x", after: "y", description: "refactor" });
 *
 * console.log(ide.getStats());
 * unsub();
 * ide.dispose();
 * ```
 */
export class IDEIntegration {
  private readonly config: Readonly<Required<IDEIntegrationConfig>>;

  /** 대기 중인 diagnostics 큐 */
  private pendingDiagnostics: DiagnosticInfo[] = [];
  /** 대기 중인 inline diff 큐 */
  private pendingDiffs: InlineDiffRequest[] = [];

  /** 이벤트 구독자 목록 */
  private readonly subscribers: Set<(event: IDEEvent) => void> = new Set();

  /** debounce 타이머 — diagnostics */
  private diagnosticsDebounceTimer: ReturnType<typeof setTimeout> | undefined;
  /** debounce 타이머 — diffs */
  private diffsDebounceTimer: ReturnType<typeof setTimeout> | undefined;

  /** 통계 카운터 */
  private stats: {
    diagnosticsForwarded: number;
    diffsRequested: number;
    eventsReceived: number;
  } = { diagnosticsForwarded: 0, diffsRequested: 0, eventsReceived: 0 };

  private disposed = false;

  /**
   * IDEIntegration 인스턴스를 생성합니다.
   *
   * @param config - 선택적 설정 (enableDiagnostics, enableInlineDiff, debounceMs)
   */
  constructor(config?: IDEIntegrationConfig) {
    this.config = Object.freeze({
      enableDiagnostics: config?.enableDiagnostics ?? true,
      enableInlineDiff: config?.enableInlineDiff ?? true,
      debounceMs: config?.debounceMs ?? 300,
    });
  }

  // ── Public API ──

  /**
   * diagnostics 목록을 큐에 추가하고, debounce 처리 후 이벤트를 발행합니다.
   *
   * enableDiagnostics가 false이면 무시됩니다.
   * dispose() 이후 호출 시 무시됩니다.
   *
   * @param diagnostics - 전달할 DiagnosticInfo 배열
   */
  forwardDiagnostics(diagnostics: readonly DiagnosticInfo[]): void {
    if (this.disposed || !this.config.enableDiagnostics) return;

    this.pendingDiagnostics.push(...diagnostics);
    this.stats.diagnosticsForwarded += diagnostics.length;

    // 기존 debounce 취소 후 재스케줄
    if (this.diagnosticsDebounceTimer !== undefined) {
      clearTimeout(this.diagnosticsDebounceTimer);
    }

    this.diagnosticsDebounceTimer = setTimeout(() => {
      this.diagnosticsDebounceTimer = undefined;
      this.flushDiagnostics();
    }, this.config.debounceMs);
  }

  /**
   * IDE에 inline diff 표시를 요청하고, debounce 처리 후 이벤트를 발행합니다.
   *
   * enableInlineDiff가 false이면 무시됩니다.
   * dispose() 이후 호출 시 무시됩니다.
   *
   * @param request - InlineDiffRequest 객체
   */
  requestInlineDiff(request: InlineDiffRequest): void {
    if (this.disposed || !this.config.enableInlineDiff) return;

    this.pendingDiffs.push(request);
    this.stats.diffsRequested += 1;

    // 기존 debounce 취소 후 재스케줄
    if (this.diffsDebounceTimer !== undefined) {
      clearTimeout(this.diffsDebounceTimer);
    }

    this.diffsDebounceTimer = setTimeout(() => {
      this.diffsDebounceTimer = undefined;
      this.flushDiffs();
    }, this.config.debounceMs);
  }

  /**
   * IDE 이벤트를 구독합니다.
   *
   * dispose() 이후 새로 등록한 구독자는 이벤트를 받지 않습니다.
   *
   * @param callback - 이벤트를 받을 콜백 함수
   * @returns 구독 해제 함수
   */
  onEvent(callback: (event: IDEEvent) => void): () => void {
    this.subscribers.add(callback);
    return () => {
      this.subscribers.delete(callback);
    };
  }

  /**
   * 현재 대기 중인 diagnostics 목록을 반환합니다 (읽기 전용).
   *
   * @returns readonly DiagnosticInfo 배열
   */
  getPendingDiagnostics(): readonly DiagnosticInfo[] {
    return this.pendingDiagnostics;
  }

  /**
   * 현재 대기 중인 inline diff 요청 목록을 반환합니다 (읽기 전용).
   *
   * @returns readonly InlineDiffRequest 배열
   */
  getPendingDiffs(): readonly InlineDiffRequest[] {
    return this.pendingDiffs;
  }

  /**
   * 대기 중인 diagnostics와 inline diff 요청을 모두 초기화합니다.
   * debounce 타이머도 함께 취소됩니다.
   */
  clearPending(): void {
    if (this.diagnosticsDebounceTimer !== undefined) {
      clearTimeout(this.diagnosticsDebounceTimer);
      this.diagnosticsDebounceTimer = undefined;
    }
    if (this.diffsDebounceTimer !== undefined) {
      clearTimeout(this.diffsDebounceTimer);
      this.diffsDebounceTimer = undefined;
    }
    this.pendingDiagnostics = [];
    this.pendingDiffs = [];
  }

  /**
   * 현재까지 누적된 통계 정보를 반환합니다.
   *
   * @returns IDEIntegrationStats (diagnosticsForwarded, diffsRequested, eventsReceived)
   */
  getStats(): IDEIntegrationStats {
    return {
      diagnosticsForwarded: this.stats.diagnosticsForwarded,
      diffsRequested: this.stats.diffsRequested,
      eventsReceived: this.stats.eventsReceived,
    };
  }

  /**
   * IDE 이벤트를 내부적으로 수신합니다.
   *
   * 외부(VSCode 확장, 테스트)에서 이벤트를 주입할 때 사용합니다.
   * dispose() 이후 호출 시 무시됩니다.
   *
   * @param event - 수신된 IDEEvent
   */
  receiveEvent(event: IDEEvent): void {
    if (this.disposed) return;
    this.stats.eventsReceived += 1;
    this.emit(event);
  }

  /**
   * 리소스를 해제하고 모든 타이머·구독자를 정리합니다.
   *
   * dispose() 이후에는 forwardDiagnostics, requestInlineDiff 등이 무시됩니다.
   */
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;

    if (this.diagnosticsDebounceTimer !== undefined) {
      clearTimeout(this.diagnosticsDebounceTimer);
      this.diagnosticsDebounceTimer = undefined;
    }
    if (this.diffsDebounceTimer !== undefined) {
      clearTimeout(this.diffsDebounceTimer);
      this.diffsDebounceTimer = undefined;
    }

    this.pendingDiagnostics = [];
    this.pendingDiffs = [];
    this.subscribers.clear();
  }

  // ── Private Helpers ──

  /**
   * 대기 중인 diagnostics를 이벤트로 발행합니다.
   * 파일별로 그룹화하여 각각 "diagnostic" 이벤트를 emit합니다.
   */
  private flushDiagnostics(): void {
    if (this.pendingDiagnostics.length === 0) return;

    // 파일별로 그룹화
    const byFile = new Map<string, DiagnosticInfo[]>();
    for (const diag of this.pendingDiagnostics) {
      const list = byFile.get(diag.filePath) ?? [];
      list.push(diag);
      byFile.set(diag.filePath, list);
    }

    for (const [filePath, diagnostics] of byFile) {
      this.emit({
        type: "diagnostic",
        filePath,
        timestamp: Date.now(),
        data: diagnostics,
      });
    }
  }

  /**
   * 대기 중인 inline diff 요청을 이벤트로 발행합니다.
   * 각 요청마다 "diff-applied" 이벤트를 emit합니다.
   */
  private flushDiffs(): void {
    for (const diff of this.pendingDiffs) {
      this.emit({
        type: "diff-applied",
        filePath: diff.filePath,
        timestamp: Date.now(),
        data: diff,
      });
    }
  }

  /**
   * 모든 구독자에게 이벤트를 전달합니다.
   *
   * @param event - 발행할 IDEEvent
   */
  private emit(event: IDEEvent): void {
    for (const subscriber of this.subscribers) {
      try {
        subscriber(event);
      } catch {
        // 구독자 에러가 다른 구독자에 영향을 주지 않도록 무시
      }
    }
  }
}
