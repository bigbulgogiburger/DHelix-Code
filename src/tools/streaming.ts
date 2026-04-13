/**
 * Tool Streaming Protocol — 도구 실행 중 진행 상태를 실시간으로 전달하는 스트리밍 모듈
 *
 * 이 모듈은 장시간 실행 도구(grep_search, web_fetch, find_references 등)가
 * 실행 중 중간 결과를 UI에 스트리밍할 수 있도록 통일된 프로토콜을 제공합니다.
 *
 * ## 사용 흐름
 * 1. 도구 실행 함수 내에서 `createToolStreamEmitter`로 emitter 생성
 * 2. `emitter.progress()`, `emitter.chunk()`, `emitter.warning()`, `emitter.complete()` 호출
 * 3. 내부적으로 AppEventEmitter를 통해 `tool:stream` 이벤트가 발행됨
 * 4. UI 컴포넌트는 `events.on('tool:stream', handler)`로 실시간 수신
 *
 * ## 이벤트 타입
 * - `progress`: 진행률 업데이트 (백분율, 처리된 바이트 수 등)
 * - `chunk`: 부분 결과 데이터 (검색 결과 배치, 다운로드 청크 등)
 * - `warning`: 비치명적 경고 메시지
 * - `complete`: 도구 실행 완료 요약
 *
 * @example
 * ```typescript
 * async function execute(params: Params, context: ToolContext): Promise<ToolResult> {
 *   const stream = createToolStreamEmitter(context, context.toolCallId ?? 'unknown', 'grep_search');
 *   stream.progress('검색 시작 중...', { percentComplete: 0 });
 *   // ... 검색 로직 ...
 *   stream.chunk('src/foo.ts:42  export function bar()', { itemsFound: 1 });
 *   stream.complete('검색 완료', { itemsFound: total });
 *   return { output: result, isError: false };
 * }
 * ```
 */

import { type AppEventEmitter } from "../utils/events.js";
import { type ToolContext } from "./types.js";

// ─── 인터페이스 ────────────────────────────────────────────────────────────────

/**
 * 도구 스트림 이벤트 — 도구 실행 중 발행되는 진행 상태 이벤트
 *
 * AppEvents의 `tool:stream` 이벤트 페이로드로 사용됩니다.
 */
export interface ToolStreamEvent {
  /** 이벤트 타입:
   * - `progress`: 전체 진행률 업데이트 (백분율, 처리량 등)
   * - `chunk`: 부분 결과 데이터 (검색 매칭 배치, 다운로드 청크 등)
   * - `warning`: 비치명적 경고 (파일 읽기 실패 등 계속 진행 가능한 오류)
   * - `complete`: 실행 완료 요약 (최종 통계, 결과 카운트 등)
   */
  readonly type: "progress" | "chunk" | "warning" | "complete";
  /** 연결된 도구 호출의 고유 ID — AppEvents의 다른 이벤트와 상관관계(correlation) 식별 */
  readonly toolCallId: string;
  /** 이 스트림 이벤트를 발행한 도구의 이름 (예: "grep_search", "web_fetch") */
  readonly toolName: string;
  /** 이벤트 본문 데이터 — 진행 메시지, 청크 내용, 경고 텍스트, 완료 요약 */
  readonly data: string;
  /** 선택적 수치 메타데이터 — UI 진행률 바, 통계 표시에 사용 */
  readonly metadata?: {
    /** 지금까지 처리된 바이트 수 (파일/네트워크 다운로드 진행률) */
    readonly bytesProcessed?: number;
    /** 전체 바이트 수 (알 수 있는 경우) */
    readonly totalBytes?: number;
    /** 지금까지 발견된 항목 수 (검색 결과, 매칭 줄 등) */
    readonly itemsFound?: number;
    /** 작업 시작 후 경과 시간(밀리초) */
    readonly elapsedMs?: number;
    /** 완료 백분율 (0–100, 알 수 있는 경우) */
    readonly percentComplete?: number;
  };
}

// ─── ToolStreamEmitter ─────────────────────────────────────────────────────────

/**
 * 도구 내부에서 사용하는 스트리밍 헬퍼 클래스
 *
 * 도구 실행 함수 안에서 이 클래스를 통해 진행 상태를 발행합니다.
 * `events`가 `undefined`이면 모든 발행 호출이 무시되어 안전합니다(no-op).
 *
 * @example
 * ```typescript
 * const emitter = new ToolStreamEmitter('call-123', 'grep_search', context.events);
 * emitter.progress('파일 스캔 중...', { percentComplete: 25 });
 * emitter.chunk('src/tools/executor.ts:72  executeTool');
 * emitter.complete('검색 완료', { itemsFound: 42 });
 * ```
 */
export class ToolStreamEmitter {
  private readonly toolCallId: string;
  private readonly toolName: string;
  private readonly events: AppEventEmitter | undefined;

  /**
   * @param toolCallId - 이 스트림을 식별하는 도구 호출 ID
   * @param toolName   - 스트림을 발행하는 도구 이름
   * @param events     - AppEventEmitter 인스턴스 (undefined이면 no-op)
   */
  constructor(toolCallId: string, toolName: string, events: AppEventEmitter | undefined) {
    this.toolCallId = toolCallId;
    this.toolName = toolName;
    this.events = events;
  }

  /**
   * 진행률 업데이트를 발행합니다.
   * 전체 작업의 몇 퍼센트가 완료되었는지, 얼마나 많은 데이터를 처리했는지 알릴 때 사용합니다.
   *
   * @param message  - 진행 상황 설명 메시지 (예: "파일 스캔 중... (45/200)")
   * @param metadata - 선택적 수치 메타데이터
   */
  progress(message: string, metadata?: ToolStreamEvent["metadata"]): void {
    this.emit("progress", message, metadata);
  }

  /**
   * 부분 결과 청크를 발행합니다.
   * 검색 결과 배치, 다운로드 청크, 파일 블록 등 중간 결과를 전달할 때 사용합니다.
   *
   * @param data     - 청크 데이터 (예: 검색 매칭 줄, 다운로드된 HTML 조각)
   * @param metadata - 선택적 수치 메타데이터
   */
  chunk(data: string, metadata?: ToolStreamEvent["metadata"]): void {
    this.emit("chunk", data, metadata);
  }

  /**
   * 비치명적 경고를 발행합니다.
   * 실행을 계속하면서 사용자에게 주의 사항을 알릴 때 사용합니다.
   *
   * @param message - 경고 메시지 (예: "파일 읽기 실패: permission denied — 건너뜁니다")
   */
  warning(message: string): void {
    this.emit("warning", message);
  }

  /**
   * 실행 완료를 발행합니다.
   * 도구가 최종 결과를 반환하기 직전에 호출하여 완료 요약을 제공합니다.
   *
   * @param summary  - 완료 요약 메시지 (예: "42개 매칭 발견, 15개 파일 검색")
   * @param metadata - 선택적 최종 통계 메타데이터
   */
  complete(summary: string, metadata?: ToolStreamEvent["metadata"]): void {
    this.emit("complete", summary, metadata);
  }

  /** 내부 이벤트 발행 헬퍼 — events가 undefined이면 no-op */
  private emit(
    type: ToolStreamEvent["type"],
    data: string,
    metadata?: ToolStreamEvent["metadata"],
  ): void {
    if (!this.events) return;
    const event: ToolStreamEvent = {
      type,
      toolCallId: this.toolCallId,
      toolName: this.toolName,
      data,
      ...(metadata !== undefined ? { metadata } : {}),
    };
    this.events.emit("tool:stream", event);
  }
}

// ─── 팩토리 함수 ───────────────────────────────────────────────────────────────

/**
 * ToolContext에서 ToolStreamEmitter를 생성하는 편의 팩토리 함수
 *
 * 도구 정의 파일에서 가장 간편하게 스트리밍 emitter를 얻는 방법입니다.
 * `context.toolCallId`가 없는 경우 `toolCallId` 파라미터를 직접 전달하세요.
 *
 * @param context    - 도구 실행 컨텍스트 (events, toolCallId 사용)
 * @param toolCallId - 도구 호출 ID (context.toolCallId를 오버라이드)
 * @param toolName   - 도구 이름 (레지스트리 이름과 일치해야 함)
 * @returns ToolStreamEmitter 인스턴스
 *
 * @example
 * ```typescript
 * const stream = createToolStreamEmitter(context, context.toolCallId ?? 'unknown', 'web_fetch');
 * stream.progress('다운로드 시작...', { percentComplete: 0 });
 * ```
 */
export function createToolStreamEmitter(
  context: ToolContext,
  toolCallId: string,
  toolName: string,
): ToolStreamEmitter {
  return new ToolStreamEmitter(toolCallId, toolName, context.events);
}

// ─── ToolStreamCollector ──────────────────────────────────────────────────────

/**
 * 테스트 및 디버깅용 스트림 이벤트 수집기
 *
 * AppEventEmitter에서 발행되는 모든 `tool:stream` 이벤트를 수집하여
 * 단위 테스트에서 쉽게 검증할 수 있게 합니다.
 *
 * @example
 * ```typescript
 * const collector = new ToolStreamCollector();
 * const detach = collector.attach(mockEventEmitter);
 *
 * // ... 테스트 로직 실행 ...
 *
 * expect(collector.events).toHaveLength(3);
 * expect(collector.events[0].type).toBe('progress');
 * detach(); // 리스너 해제
 * ```
 */
export class ToolStreamCollector {
  /** 수집된 이벤트 목록 — 발행 순서대로 누적됩니다 */
  readonly events: ToolStreamEvent[] = [];

  /**
   * AppEventEmitter에 `tool:stream` 리스너를 등록하여 이벤트 수집을 시작합니다.
   *
   * @param emitter - 연결할 AppEventEmitter 인스턴스
   * @returns detach 함수 — 호출하면 리스너가 해제되고 수집이 중지됩니다
   */
  attach(emitter: AppEventEmitter): () => void {
    const handler = (event: ToolStreamEvent): void => {
      this.events.push(event);
    };
    emitter.on("tool:stream", handler);
    return () => {
      emitter.off("tool:stream", handler);
    };
  }

  /**
   * 수집된 이벤트를 모두 지웁니다.
   * 여러 테스트 케이스에서 같은 collector 인스턴스를 재사용할 때 유용합니다.
   */
  clear(): void {
    this.events.length = 0;
  }
}
