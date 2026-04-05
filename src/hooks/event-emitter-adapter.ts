/**
 * Hook Event Emitter Adapter — AppEventEmitter 이벤트를 Hook 시스템으로 연결하는 어댑터
 *
 * AppEventEmitter(mitt 기반)에서 발행되는 이벤트를 수신하고,
 * 대응하는 HookEvent 페이로드를 구성하여 HookRunner로 전달합니다.
 *
 * 지원하는 이벤트 매핑:
 * - tool:start → PreToolUse (onToolStart)
 * - tool:complete (isError: false) → PostToolUse (onToolComplete)
 * - tool:complete (isError: true) → PostToolUseFailure (onToolError)
 * - context:pre-compact → PreCompact (onCompactionStart)
 * - context:post-compact → (onCompactionComplete, HookEvent 없음)
 * - permission:mode-change → PermissionRequest (onPermissionGrant / onPermissionDeny)
 *
 * attach/detach 패턴으로 생명주기를 관리합니다.
 * detach()를 호출하면 모든 리스너가 해제되어 메모리 누수를 방지합니다.
 *
 * @example
 * const adapter = createHookAdapter(events, hookRunner, {
 *   sessionId: "sess-abc",
 *   workingDirectory: "/project",
 * });
 * adapter.attach(); // 이벤트 수신 시작
 *
 * // 나중에 정리
 * adapter.detach(); // 모든 리스너 해제
 *
 * @example
 * // 특정 이벤트만 연결
 * const adapter = createHookAdapter(events, hookRunner, {
 *   sessionId: "sess-abc",
 *   workingDirectory: "/project",
 *   enabledEvents: ["tool:start", "tool:complete"],
 * });
 */

import { type AppEventEmitter } from "../utils/events.js";
import { type HookRunner } from "./runner.js";
import { type HookEventPayload } from "./types.js";

/**
 * HookEventAdapter 생성 설정.
 */
export interface HookAdapterConfig {
  /** 현재 세션 ID */
  readonly sessionId?: string;
  /** 작업 디렉토리 경로 */
  readonly workingDirectory?: string;
  /**
   * 활성화할 AppEvents 이벤트 키 목록.
   * 지정하지 않으면 지원되는 모든 이벤트를 연결합니다.
   */
  readonly enabledEvents?: readonly SupportedSourceEvent[];
}

/**
 * 어댑터가 수신하는 AppEvents 이벤트 키 목록.
 */
export type SupportedSourceEvent =
  | "tool:start"
  | "tool:complete"
  | "context:pre-compact"
  | "context:post-compact"
  | "permission:mode-change";

/** 지원되는 모든 소스 이벤트 목록 */
export const SUPPORTED_SOURCE_EVENTS: readonly SupportedSourceEvent[] = [
  "tool:start",
  "tool:complete",
  "context:pre-compact",
  "context:post-compact",
  "permission:mode-change",
] as const;

/**
 * AppEventEmitter와 HookRunner 사이의 어댑터 인터페이스.
 *
 * attach()로 이벤트 수신을 시작하고, detach()로 모든 리스너를 해제합니다.
 */
export interface HookEventAdapter {
  /**
   * 이벤트 수신을 시작합니다.
   * 이미 attach된 상태에서 다시 호출하면 리스너가 중복 등록될 수 있으므로
   * 항상 detach() 후 attach()를 호출하세요.
   */
  attach(): void;
  /**
   * 모든 이벤트 리스너를 해제합니다.
   * 메모리 누수를 방지하기 위해 어댑터를 더 이상 사용하지 않을 때 반드시 호출하세요.
   */
  detach(): void;
  /** 현재 attach 상태인지 확인합니다 */
  readonly isAttached: boolean;
}

/**
 * HookEventAdapter 구현 클래스.
 *
 * mitt 이벤트 에미터는 리스너를 해제하려면 동일한 함수 참조가 필요하므로,
 * 각 리스너를 클래스 필드로 저장하여 detach()에서 정확히 해제할 수 있게 합니다.
 */
class HookEventAdapterImpl implements HookEventAdapter {
  private _isAttached = false;

  private readonly events: AppEventEmitter;
  private readonly hookRunner: HookRunner;
  private readonly config: HookAdapterConfig;

  // mitt off()에 전달할 리스너 참조를 보관합니다
  private readonly toolStartListener: (payload: {
    name: string;
    id: string;
    args?: Record<string, unknown>;
    subagentId?: string;
    subagentType?: string;
  }) => void;

  private readonly toolCompleteListener: (payload: {
    name: string;
    id: string;
    isError: boolean;
    output?: string;
    metadata?: Readonly<Record<string, unknown>>;
    subagentId?: string;
    subagentType?: string;
  }) => void;

  private readonly preCompactListener: (payload: { compactionNumber: number }) => void;

  private readonly postCompactListener: (payload: {
    originalTokens: number;
    compactedTokens: number;
    removedMessages: number;
  }) => void;

  private readonly permissionModeChangeListener: (payload: { mode: string }) => void;

  constructor(events: AppEventEmitter, hookRunner: HookRunner, config: HookAdapterConfig) {
    this.events = events;
    this.hookRunner = hookRunner;
    this.config = config;

    // 리스너를 클로저로 바인딩합니다 (화살표 함수 → this 고정)
    this.toolStartListener = (payload) => {
      void this.handleToolStart(payload);
    };

    this.toolCompleteListener = (payload) => {
      void this.handleToolComplete(payload);
    };

    this.preCompactListener = (payload) => {
      void this.handlePreCompact(payload);
    };

    this.postCompactListener = (payload) => {
      void this.handlePostCompact(payload);
    };

    this.permissionModeChangeListener = (payload) => {
      void this.handlePermissionModeChange(payload);
    };
  }

  get isAttached(): boolean {
    return this._isAttached;
  }

  /**
   * 이벤트 수신을 시작합니다.
   * enabledEvents 설정에 따라 선택적으로 리스너를 등록합니다.
   */
  attach(): void {
    const enabled = this.config.enabledEvents ?? SUPPORTED_SOURCE_EVENTS;

    if (enabled.includes("tool:start")) {
      this.events.on("tool:start", this.toolStartListener);
    }
    if (enabled.includes("tool:complete")) {
      this.events.on("tool:complete", this.toolCompleteListener);
    }
    if (enabled.includes("context:pre-compact")) {
      this.events.on("context:pre-compact", this.preCompactListener);
    }
    if (enabled.includes("context:post-compact")) {
      this.events.on("context:post-compact", this.postCompactListener);
    }
    if (enabled.includes("permission:mode-change")) {
      this.events.on("permission:mode-change", this.permissionModeChangeListener);
    }

    this._isAttached = true;
  }

  /**
   * 모든 이벤트 리스너를 해제합니다.
   * attach()에서 등록한 리스너만 정확히 해제합니다.
   */
  detach(): void {
    this.events.off("tool:start", this.toolStartListener);
    this.events.off("tool:complete", this.toolCompleteListener);
    this.events.off("context:pre-compact", this.preCompactListener);
    this.events.off("context:post-compact", this.postCompactListener);
    this.events.off("permission:mode-change", this.permissionModeChangeListener);

    this._isAttached = false;
  }

  // ---------------------------------------------------------------------------
  // 개별 이벤트 핸들러 — AppEvent → HookEventPayload 변환 후 HookRunner.run() 호출
  // ---------------------------------------------------------------------------

  /**
   * tool:start 이벤트를 PreToolUse 훅으로 중계합니다.
   *
   * @param payload - tool:start 이벤트 페이로드
   */
  private async handleToolStart(payload: {
    name: string;
    id: string;
    args?: Record<string, unknown>;
    subagentId?: string;
  }): Promise<void> {
    const hookPayload: HookEventPayload = {
      event: "PreToolUse",
      sessionId: this.config.sessionId,
      workingDirectory: this.config.workingDirectory,
      toolCall: { name: payload.name, id: payload.id, arguments: payload.args ?? {} },
      data: {
        subagentId: payload.subagentId,
      },
    };

    await this.safeRun("PreToolUse", hookPayload);
  }

  /**
   * tool:complete 이벤트를 PostToolUse 또는 PostToolUseFailure 훅으로 중계합니다.
   *
   * @param payload - tool:complete 이벤트 페이로드
   */
  private async handleToolComplete(payload: {
    name: string;
    id: string;
    isError: boolean;
    output?: string;
    metadata?: Readonly<Record<string, unknown>>;
    subagentId?: string;
  }): Promise<void> {
    const hookEvent = payload.isError ? "PostToolUseFailure" : "PostToolUse";

    const hookPayload: HookEventPayload = {
      event: hookEvent,
      sessionId: this.config.sessionId,
      workingDirectory: this.config.workingDirectory,
      toolCall: { name: payload.name, id: payload.id, arguments: {} },
      data: {
        output: payload.output,
        subagentId: payload.subagentId,
        ...(payload.metadata ?? {}),
      },
    };

    await this.safeRun(hookEvent, hookPayload);
  }

  /**
   * context:pre-compact 이벤트를 PreCompact 훅으로 중계합니다.
   *
   * @param payload - context:pre-compact 이벤트 페이로드
   */
  private async handlePreCompact(payload: { compactionNumber: number }): Promise<void> {
    const hookPayload: HookEventPayload = {
      event: "PreCompact",
      sessionId: this.config.sessionId,
      workingDirectory: this.config.workingDirectory,
      data: {
        compactionNumber: payload.compactionNumber,
      },
    };

    await this.safeRun("PreCompact", hookPayload);
  }

  /**
   * context:post-compact 이벤트를 수신하여 처리합니다.
   *
   * 현재 HookEvent에 PostCompact에 해당하는 이벤트가 없으므로
   * PreCompact 훅에 compactionComplete 플래그를 포함하여 전달합니다.
   *
   * @param payload - context:post-compact 이벤트 페이로드
   */
  private async handlePostCompact(payload: {
    originalTokens: number;
    compactedTokens: number;
    removedMessages: number;
  }): Promise<void> {
    // PostCompact는 현재 별도 HookEvent가 없습니다.
    // PreCompact 이벤트에 compactionComplete: true 플래그를 포함하여
    // 훅 설정에서 data.compactionComplete로 구분할 수 있게 합니다.
    const hookPayload: HookEventPayload = {
      event: "PreCompact",
      sessionId: this.config.sessionId,
      workingDirectory: this.config.workingDirectory,
      data: {
        compactionComplete: true,
        originalTokens: payload.originalTokens,
        compactedTokens: payload.compactedTokens,
        removedMessages: payload.removedMessages,
      },
    };

    await this.safeRun("PreCompact", hookPayload);
  }

  /**
   * permission:mode-change 이벤트를 PermissionRequest 훅으로 중계합니다.
   *
   * @param payload - permission:mode-change 이벤트 페이로드
   */
  private async handlePermissionModeChange(payload: { mode: string }): Promise<void> {
    const hookPayload: HookEventPayload = {
      event: "PermissionRequest",
      sessionId: this.config.sessionId,
      workingDirectory: this.config.workingDirectory,
      data: {
        permissionMode: payload.mode,
      },
    };

    await this.safeRun("PermissionRequest", hookPayload);
  }

  /**
   * HookRunner.run()을 에러 격리(error isolation)로 호출합니다.
   *
   * 훅 실행 중 예외가 발생해도 이벤트 처리 흐름을 절대 중단시키지 않습니다.
   * 에러는 stderr에 경고 메시지로 출력됩니다.
   *
   * @param event - 실행할 HookEvent 이름
   * @param payload - 이벤트 페이로드
   */
  private async safeRun(
    event: HookEventPayload["event"],
    payload: HookEventPayload,
  ): Promise<void> {
    try {
      await this.hookRunner.run(event, payload);
    } catch (error) {
      // 에러 격리: 훅 실행 실패가 앱 흐름을 중단하면 안 됨
      process.stderr.write(
        `[hook-adapter] Error running hook "${event}": ${
          error instanceof Error ? error.message : String(error)
        }\n`,
      );
    }
  }
}

/**
 * HookEventAdapter를 생성합니다.
 *
 * 반환된 어댑터의 attach()를 호출해야 이벤트 수신이 시작됩니다.
 * 사용이 끝나면 detach()를 호출하여 리스너를 해제하세요.
 *
 * @param events - 앱 이벤트 에미터 (AppEventEmitter)
 * @param hookRunner - 훅 실행 엔진 (HookRunner)
 * @param config - 어댑터 설정
 * @returns 새로운 HookEventAdapter 인스턴스
 *
 * @example
 * const adapter = createHookAdapter(events, hookRunner, {
 *   sessionId: "sess-abc",
 *   workingDirectory: "/project",
 * });
 * adapter.attach();
 *
 * // 정리 시
 * adapter.detach();
 */
export function createHookAdapter(
  events: AppEventEmitter,
  hookRunner: HookRunner,
  config: HookAdapterConfig = {},
): HookEventAdapter {
  return new HookEventAdapterImpl(events, hookRunner, config);
}
