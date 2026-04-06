/**
 * Hook Event Definitions — 누락된 라이프사이클 이벤트 훅 포인트 및 페이로드 타입
 *
 * 기존 HookEvent 타입(types.ts)을 보완하여, 아직 훅 포인트가 없는
 * 이벤트들의 페이로드 타입과 레지스트리를 정의합니다.
 *
 * 새로 추가된 이벤트 카테고리:
 * - onToolStart / onToolComplete / onToolError — 도구 실행 전후
 * - onCompactionStart / onCompactionComplete — 컨텍스트 압축 전후
 * - onSessionCreate / onSessionResume — 세션 수명주기
 * - onModelSwitch — 모델 전환 시
 * - onMcpConnect / onMcpDisconnect — MCP 서버 연결/해제
 * - onPermissionGrant / onPermissionDeny — 권한 결정
 *
 * @example
 * import { HOOK_EVENT_REGISTRY, type OnToolStartPayload } from "./events.js";
 *
 * // 등록된 이벤트 메타데이터 조회
 * const meta = HOOK_EVENT_REGISTRY.getMetadata("onToolStart");
 * // meta.description → "도구 실행이 시작되기 직전에 발생합니다"
 *
 * // 타입 안전한 페이로드 사용
 * const payload: OnToolStartPayload = {
 *   toolName: "file_write",
 *   toolId: "tc-123",
 *   args: { path: "/foo.ts", content: "..." },
 *   sessionId: "sess-abc",
 * };
 */

import { type HookEvent } from "./types.js";

// ---------------------------------------------------------------------------
// 도구 실행 관련 페이로드
// ---------------------------------------------------------------------------

/**
 * onToolStart 이벤트 페이로드 — 도구 실행이 시작되기 직전에 제공됩니다.
 *
 * PreToolUse 훅 이벤트와 짝을 이루며, AppEvents의 "tool:start"를 훅 시스템으로
 * 중계할 때 사용합니다.
 */
export interface OnToolStartPayload {
  /** 실행될 도구 이름 (예: "file_write", "bash_exec") */
  readonly toolName: string;
  /** 도구 호출 고유 ID */
  readonly toolId: string;
  /** 도구에 전달된 인수 (없을 수 있음) */
  readonly args?: Readonly<Record<string, unknown>>;
  /** 현재 세션 ID */
  readonly sessionId?: string;
  /** 서브에이전트에서 전파된 경우 서브에이전트 ID */
  readonly subagentId?: string;
}

/**
 * onToolComplete 이벤트 페이로드 — 도구 실행이 성공적으로 완료된 직후 제공됩니다.
 *
 * PostToolUse 훅 이벤트와 짝을 이루며, AppEvents의 "tool:complete"(isError: false)를
 * 훅 시스템으로 중계할 때 사용합니다.
 */
export interface OnToolCompletePayload {
  /** 실행된 도구 이름 */
  readonly toolName: string;
  /** 도구 호출 고유 ID */
  readonly toolId: string;
  /** 도구 출력 (없을 수 있음) */
  readonly output?: string;
  /** 추가 메타데이터 */
  readonly metadata?: Readonly<Record<string, unknown>>;
  /** 현재 세션 ID */
  readonly sessionId?: string;
  /** 서브에이전트에서 전파된 경우 서브에이전트 ID */
  readonly subagentId?: string;
}

/**
 * onToolError 이벤트 페이로드 — 도구 실행이 에러로 종료된 직후 제공됩니다.
 *
 * PostToolUseFailure 훅 이벤트와 짝을 이루며, AppEvents의 "tool:complete"(isError: true)를
 * 훅 시스템으로 중계할 때 사용합니다.
 */
export interface OnToolErrorPayload {
  /** 실행된 도구 이름 */
  readonly toolName: string;
  /** 도구 호출 고유 ID */
  readonly toolId: string;
  /** 에러 출력 메시지 */
  readonly output?: string;
  /** 현재 세션 ID */
  readonly sessionId?: string;
}

// ---------------------------------------------------------------------------
// 컨텍스트 압축 관련 페이로드
// ---------------------------------------------------------------------------

/**
 * onCompactionStart 이벤트 페이로드 — 컨텍스트 압축이 시작되기 직전 제공됩니다.
 *
 * AppEvents의 "context:pre-compact"를 훅 시스템으로 중계할 때 사용합니다.
 */
export interface OnCompactionStartPayload {
  /** 이번 압축 회차 번호 (1부터 시작) */
  readonly compactionNumber: number;
  /** 현재 세션 ID */
  readonly sessionId?: string;
}

/**
 * onCompactionComplete 이벤트 페이로드 — 컨텍스트 압축이 완료된 직후 제공됩니다.
 *
 * AppEvents의 "context:post-compact"를 훅 시스템으로 중계할 때 사용합니다.
 */
export interface OnCompactionCompletePayload {
  /** 압축 전 토큰 수 */
  readonly originalTokens: number;
  /** 압축 후 토큰 수 */
  readonly compactedTokens: number;
  /** 제거된 메시지 수 */
  readonly removedMessages: number;
  /** 현재 세션 ID */
  readonly sessionId?: string;
}

// ---------------------------------------------------------------------------
// 세션 수명주기 관련 페이로드
// ---------------------------------------------------------------------------

/**
 * onSessionCreate 이벤트 페이로드 — 새로운 세션이 생성될 때 제공됩니다.
 *
 * SessionStart 훅 이벤트와 함께 사용되며, 신규 세션(재개가 아닌) 생성 시
 * 추가적인 컨텍스트를 제공합니다.
 */
export interface OnSessionCreatePayload {
  /** 새로 생성된 세션 ID */
  readonly sessionId: string;
  /** 세션 작업 디렉토리 */
  readonly workingDirectory: string;
  /** 사용 중인 모델 이름 */
  readonly model?: string;
}

/**
 * onSessionResume 이벤트 페이로드 — 기존 세션이 재개될 때 제공됩니다.
 *
 * 이전 대화 내용을 불러와 세션을 이어갈 때 발생합니다.
 */
export interface OnSessionResumePayload {
  /** 재개된 세션 ID */
  readonly sessionId: string;
  /** 세션 작업 디렉토리 */
  readonly workingDirectory: string;
  /** 재개 전 대화 메시지 수 */
  readonly messageCount: number;
  /** 사용 중인 모델 이름 */
  readonly model?: string;
}

// ---------------------------------------------------------------------------
// 모델 전환 관련 페이로드
// ---------------------------------------------------------------------------

/**
 * onModelSwitch 이벤트 페이로드 — LLM 모델이 전환될 때 제공됩니다.
 *
 * 듀얼 모델 라우터 또는 사용자 명령으로 모델이 변경될 때 발생합니다.
 */
export interface OnModelSwitchPayload {
  /** 전환 전 모델 이름 */
  readonly fromModel: string;
  /** 전환 후 모델 이름 */
  readonly toModel: string;
  /** 전환 이유 (예: "user-command", "dual-router", "fallback") */
  readonly reason?: string;
  /** 현재 세션 ID */
  readonly sessionId?: string;
}

// ---------------------------------------------------------------------------
// MCP 서버 연결 관련 페이로드
// ---------------------------------------------------------------------------

/**
 * onMcpConnect 이벤트 페이로드 — MCP 서버가 연결될 때 제공됩니다.
 */
export interface OnMcpConnectPayload {
  /** MCP 서버 이름 */
  readonly serverName: string;
  /** MCP 서버 연결 URL 또는 식별자 */
  readonly serverUrl?: string;
  /** 이 서버에서 제공되는 도구 수 */
  readonly toolCount?: number;
  /** 현재 세션 ID */
  readonly sessionId?: string;
}

/**
 * onMcpDisconnect 이벤트 페이로드 — MCP 서버 연결이 해제될 때 제공됩니다.
 */
export interface OnMcpDisconnectPayload {
  /** MCP 서버 이름 */
  readonly serverName: string;
  /** 연결 해제 이유 (예: "shutdown", "error", "timeout") */
  readonly reason?: string;
  /** 현재 세션 ID */
  readonly sessionId?: string;
}

// ---------------------------------------------------------------------------
// 권한 결정 관련 페이로드
// ---------------------------------------------------------------------------

/**
 * onPermissionGrant 이벤트 페이로드 — 도구 실행 권한이 승인될 때 제공됩니다.
 */
export interface OnPermissionGrantPayload {
  /** 권한이 요청된 도구 이름 */
  readonly toolName: string;
  /** 승인된 권한 모드 */
  readonly permissionMode: string;
  /** 승인 주체 ("user" | "auto" | "policy") */
  readonly grantedBy: "user" | "auto" | "policy";
  /** 현재 세션 ID */
  readonly sessionId?: string;
}

/**
 * onPermissionDeny 이벤트 페이로드 — 도구 실행 권한이 거부될 때 제공됩니다.
 */
export interface OnPermissionDenyPayload {
  /** 권한이 요청된 도구 이름 */
  readonly toolName: string;
  /** 거부 이유 (예: "user-rejected", "policy-violation", "dangerous-pattern") */
  readonly reason: string;
  /** 현재 세션 ID */
  readonly sessionId?: string;
}

// ---------------------------------------------------------------------------
// HookEventRegistry
// ---------------------------------------------------------------------------

/**
 * 훅 이벤트 메타데이터 — 각 이벤트의 이름, 설명, 대응하는 HookEvent를 기술합니다.
 */
export interface HookEventMetadata {
  /** 이벤트 식별자 (camelCase, 예: "onToolStart") */
  readonly id: string;
  /** 이벤트에 대한 사람이 읽을 수 있는 설명 */
  readonly description: string;
  /**
   * 이 이벤트에 대응하는 기존 HookEvent 이름.
   * 기존 HookEvent가 없으면 undefined(신규 확장 이벤트)입니다.
   */
  readonly hookEvent?: HookEvent;
  /** AppEvents에서 이 이벤트를 발행하는 소스 이벤트 키 */
  readonly sourceEvent?: string;
}

/**
 * 등록된 모든 훅 이벤트의 메타데이터를 관리하는 레지스트리.
 *
 * 이벤트 목록 조회, 특정 이벤트의 메타데이터 조회, HookEvent 기반 필터링을 지원합니다.
 *
 * @example
 * const registry = new HookEventRegistry();
 * const allEvents = registry.getAllEvents();
 * const meta = registry.getMetadata("onToolStart");
 * const toolEvents = registry.getEventsByHookEvent("PreToolUse");
 */
export class HookEventRegistry {
  private readonly events: ReadonlyMap<string, HookEventMetadata>;

  constructor() {
    const entries: HookEventMetadata[] = [
      // 도구 실행 관련
      {
        id: "onToolStart",
        description: "도구 실행이 시작되기 직전에 발생합니다",
        hookEvent: "PreToolUse",
        sourceEvent: "tool:start",
      },
      {
        id: "onToolComplete",
        description: "도구 실행이 성공적으로 완료된 직후 발생합니다",
        hookEvent: "PostToolUse",
        sourceEvent: "tool:complete",
      },
      {
        id: "onToolError",
        description: "도구 실행이 에러로 종료된 직후 발생합니다",
        hookEvent: "PostToolUseFailure",
        sourceEvent: "tool:complete",
      },
      // 컨텍스트 압축 관련
      {
        id: "onCompactionStart",
        description: "컨텍스트 압축이 시작되기 직전에 발생합니다",
        hookEvent: "PreCompact",
        sourceEvent: "context:pre-compact",
      },
      {
        id: "onCompactionComplete",
        description: "컨텍스트 압축이 완료된 직후 발생합니다",
        sourceEvent: "context:post-compact",
      },
      // 세션 수명주기 관련
      {
        id: "onSessionCreate",
        description: "새로운 세션이 생성될 때 발생합니다",
        hookEvent: "SessionStart",
      },
      {
        id: "onSessionResume",
        description: "기존 세션이 재개될 때 발생합니다",
        hookEvent: "SessionStart",
      },
      // 모델 전환 관련
      {
        id: "onModelSwitch",
        description: "LLM 모델이 전환될 때 발생합니다",
      },
      // MCP 연결 관련
      {
        id: "onMcpConnect",
        description: "MCP 서버가 연결될 때 발생합니다",
      },
      {
        id: "onMcpDisconnect",
        description: "MCP 서버 연결이 해제될 때 발생합니다",
      },
      // 권한 결정 관련
      {
        id: "onPermissionGrant",
        description: "도구 실행 권한이 승인될 때 발생합니다",
        hookEvent: "PermissionRequest",
        sourceEvent: "permission:mode-change",
      },
      {
        id: "onPermissionDeny",
        description: "도구 실행 권한이 거부될 때 발생합니다",
        hookEvent: "PermissionRequest",
        sourceEvent: "permission:mode-change",
      },
    ];

    this.events = new Map(entries.map((e) => [e.id, e]));
  }

  /**
   * 등록된 모든 훅 이벤트 메타데이터를 반환합니다.
   *
   * @returns 모든 이벤트 메타데이터 배열 (등록 순서 유지)
   */
  getAllEvents(): readonly HookEventMetadata[] {
    return [...this.events.values()];
  }

  /**
   * 특정 이벤트 ID의 메타데이터를 반환합니다.
   *
   * @param id - 조회할 이벤트 ID (예: "onToolStart")
   * @returns 메타데이터 객체, 없으면 undefined
   */
  getMetadata(id: string): HookEventMetadata | undefined {
    return this.events.get(id);
  }

  /**
   * 특정 HookEvent에 매핑된 이벤트 메타데이터 목록을 반환합니다.
   *
   * @param hookEvent - 필터링할 HookEvent 이름
   * @returns 해당 HookEvent를 사용하는 이벤트 메타데이터 배열
   *
   * @example
   * registry.getEventsByHookEvent("PreToolUse");
   * // → [{ id: "onToolStart", hookEvent: "PreToolUse", ... }]
   */
  getEventsByHookEvent(hookEvent: HookEvent): readonly HookEventMetadata[] {
    return this.getAllEvents().filter((e) => e.hookEvent === hookEvent);
  }

  /**
   * 등록된 이벤트 ID 목록을 반환합니다.
   *
   * @returns 모든 이벤트 ID 배열
   */
  getEventIds(): readonly string[] {
    return [...this.events.keys()];
  }

  /**
   * 특정 ID가 등록된 이벤트인지 확인합니다.
   *
   * @param id - 확인할 이벤트 ID
   * @returns 등록된 이벤트이면 true
   */
  hasEvent(id: string): boolean {
    return this.events.has(id);
  }
}

/** 전역 싱글턴 HookEventRegistry 인스턴스 */
export const HOOK_EVENT_REGISTRY = new HookEventRegistry();
