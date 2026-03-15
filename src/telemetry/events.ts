/**
 * 텔레메트리 이벤트 — 도구 결정, 에러, 세션 라이프사이클 등의 구조화된 이벤트 정의
 *
 * 앱의 주요 동작(도구 실행, LLM 호출, 에러 발생 등)을 구조화된 이벤트로 기록합니다.
 * 수집된 이벤트는 OTLP(OpenTelemetry Protocol)로 내보내거나 분석에 활용됩니다.
 *
 * 이벤트 타입:
 * - tool_decision: 도구 호출 승인/거부 결정
 * - tool_execution: 도구 실행 결과 (성공/실패, 소요 시간)
 * - llm_call: LLM API 호출 정보 (모델, 토큰 수, 지연 시간)
 * - session_start/end: 세션 시작/종료
 * - error: 주요 에러 발생
 * - agent_iteration: 에이전트 루프 반복 정보
 *
 * @example
 * import { eventBuffer, createEvent } from "./events.js";
 * eventBuffer.record(createEvent<ToolExecutionEvent>({
 *   type: "tool_execution",
 *   toolName: "file_read",
 *   success: true,
 *   durationMs: 45,
 * }));
 */

/** 기본 이벤트 — 모든 이벤트가 공유하는 공통 필드 */
interface BaseEvent {
  /** ISO 8601 형식의 타임스탬프 (예: "2024-01-15T10:30:00.000Z") */
  readonly timestamp: string;
  /** 이벤트가 발생한 세션의 ID (선택적) */
  readonly sessionId?: string;
}

/**
 * 도구 결정 이벤트 — 도구 호출이 승인/거부될 때 기록됩니다.
 *
 * decision 값:
 * - "approved": 사용자가 수동으로 승인
 * - "denied": 사용자가 거부
 * - "auto_approved": 자동 승인 (신뢰 설정에 의해)
 * - "blocked_by_hook": 훅에 의해 차단됨
 */
export interface ToolDecisionEvent extends BaseEvent {
  readonly type: "tool_decision";
  /** 결정 대상 도구 이름 (예: "file_write") */
  readonly toolName: string;
  /** 결정 결과 */
  readonly decision: "approved" | "denied" | "auto_approved" | "blocked_by_hook";
  /** 결정 이유 (선택적) */
  readonly reason?: string;
  /** 결정에 소요된 시간 (밀리초, 선택적) */
  readonly durationMs?: number;
}

/**
 * 도구 실행 이벤트 — 도구가 실행 완료될 때 기록됩니다.
 */
export interface ToolExecutionEvent extends BaseEvent {
  readonly type: "tool_execution";
  /** 실행된 도구 이름 */
  readonly toolName: string;
  /** 실행 성공 여부 */
  readonly success: boolean;
  /** 실행 소요 시간 (밀리초) */
  readonly durationMs: number;
  /** 에러 코드 (실패 시, 선택적) */
  readonly errorCode?: string;
}

/**
 * LLM 호출 이벤트 — 각 LLM API 호출마다 기록됩니다.
 */
export interface LLMCallEvent extends BaseEvent {
  readonly type: "llm_call";
  /** 사용된 모델명 (예: "gpt-4o", "claude-3-opus") */
  readonly model: string;
  /** 입력(프롬프트) 토큰 수 */
  readonly inputTokens: number;
  /** 출력(응답) 토큰 수 */
  readonly outputTokens: number;
  /** API 호출 소요 시간 (밀리초) */
  readonly durationMs: number;
  /** 호출 성공 여부 */
  readonly success: boolean;
  /** 에러 코드 (실패 시, 선택적) */
  readonly errorCode?: string;
}

/**
 * 세션 라이프사이클 이벤트 — 세션 시작/종료 시 기록됩니다.
 */
export interface SessionEvent extends BaseEvent {
  readonly type: "session_start" | "session_end";
  /** 사용된 모델명 */
  readonly model: string;
  /** 세션 지속 시간 (초, session_end에서 제공) */
  readonly durationSeconds?: number;
  /** 총 에이전트 반복 횟수 (session_end에서 제공) */
  readonly totalIterations?: number;
  /** 사용된 총 토큰 수 (session_end에서 제공) */
  readonly totalTokens?: number;
}

/**
 * 에러 이벤트 — 주요 에러 발생 시 기록됩니다.
 */
export interface ErrorEvent extends BaseEvent {
  readonly type: "error";
  /** 에러 카테고리: llm, tool, permission, config, internal */
  readonly category: "llm" | "tool" | "permission" | "config" | "internal";
  /** 에러 코드 (BaseError의 code 필드) */
  readonly code: string;
  /** 에러 메시지 */
  readonly message: string;
  /** 복구 가능한 에러인지 여부 */
  readonly recoverable: boolean;
}

/**
 * 에이전트 반복(iteration) 이벤트 — 각 에이전트 루프 반복 시 기록됩니다.
 */
export interface AgentIterationEvent extends BaseEvent {
  readonly type: "agent_iteration";
  /** 반복 번호 */
  readonly iteration: number;
  /** 이 반복에서 실행된 도구 호출 수 */
  readonly toolCalls: number;
  /** 사용된 모델명 */
  readonly model: string;
}

/** 모든 텔레메트리 이벤트 타입의 유니온 */
export type TelemetryEvent =
  | ToolDecisionEvent
  | ToolExecutionEvent
  | LLMCallEvent
  | SessionEvent
  | ErrorEvent
  | AgentIterationEvent;

/**
 * 인메모리(in-memory) 이벤트 버퍼.
 *
 * 이벤트를 메모리에 수집하고, OTLP 내보내기(export) 또는 flush 시까지 보관합니다.
 * 버퍼가 최대 크기(maxSize)를 초과하면 가장 오래된 이벤트부터 제거됩니다.
 *
 * @example
 * const buffer = new EventBuffer(500); // 최대 500개 이벤트
 * buffer.record(event);
 * const events = buffer.flush(); // 모든 이벤트를 가져오고 버퍼 비움
 */
export class EventBuffer {
  /** 이벤트를 저장하는 내부 배열 */
  private events: TelemetryEvent[] = [];
  /** 버퍼 최대 크기 — 초과 시 오래된 이벤트 제거 */
  private readonly maxSize: number;

  /**
   * @param maxSize - 버퍼 최대 크기 (기본값: 1000)
   */
  constructor(maxSize = 1000) {
    this.maxSize = maxSize;
  }

  /**
   * 이벤트를 버퍼에 기록합니다.
   * 버퍼가 가득 차면 가장 오래된 이벤트를 제거하여 공간을 확보합니다.
   *
   * @param event - 기록할 텔레메트리 이벤트
   */
  record(event: TelemetryEvent): void {
    this.events.push(event);
    // 최대 크기 초과 시 오래된 이벤트 제거 (앞에서부터 잘라냄)
    if (this.events.length > this.maxSize) {
      this.events = this.events.slice(-this.maxSize);
    }
  }

  /**
   * 모든 버퍼된 이벤트를 가져오고 버퍼를 비웁니다.
   * OTLP 내보내기 후 호출하여 이벤트를 정리합니다.
   *
   * @returns 버퍼에 있던 모든 이벤트의 복사본
   */
  flush(): readonly TelemetryEvent[] {
    const flushed = [...this.events];
    this.events = [];
    return flushed;
  }

  /** 현재 버퍼에 저장된 이벤트 수 */
  get size(): number {
    return this.events.length;
  }

  /**
   * 버퍼를 비우지 않고 현재 이벤트를 조회합니다.
   * 디버깅이나 모니터링에 유용합니다.
   *
   * @returns 현재 버퍼의 이벤트 복사본
   */
  peek(): readonly TelemetryEvent[] {
    return [...this.events];
  }
}

/**
 * 텔레메트리 이벤트를 생성합니다.
 * timestamp를 자동으로 현재 시간(ISO 8601)으로 채워줍니다.
 *
 * @param event - 타임스탬프를 제외한 이벤트 데이터
 * @returns 타임스탬프가 포함된 완전한 이벤트 객체
 *
 * @example
 * const event = createEvent<ToolExecutionEvent>({
 *   type: "tool_execution",
 *   toolName: "file_read",
 *   success: true,
 *   durationMs: 45,
 * });
 * // event.timestamp → "2024-01-15T10:30:00.000Z" (자동 생성)
 */
export function createEvent<T extends TelemetryEvent>(
  event: Omit<T, "timestamp"> & { timestamp?: string },
): T {
  return {
    ...event,
    timestamp: event.timestamp ?? new Date().toISOString(),
  } as T;
}

/** 싱글톤 이벤트 버퍼 — 앱 전체에서 공유 */
export const eventBuffer = new EventBuffer();
