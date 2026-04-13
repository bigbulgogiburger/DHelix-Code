/**
 * MCP Streaming Support — MCP 서버 도구 호출에서 스트리밍 응답을 처리하는 모듈
 *
 * JSON-RPC 스트리밍 응답을 청크(chunk) 단위로 변환하고,
 * `src/tools/streaming.ts`의 `ToolStreamEmitter`와 연동하여
 * CLI UI에 실시간 진행 상태를 전달합니다.
 *
 * ## 사용 흐름
 * 1. `McpStreamHandler` 인스턴스 생성 (선택적으로 `McpStreamConfig` 전달)
 * 2. `handleStreamResponse()`로 AsyncIterable 응답을 청크 스트림으로 변환
 * 3. `collectStream()`으로 전체 스트림을 하나의 문자열로 수집
 * 4. `isStreamable()`로 서버가 스트리밍을 지원하는지 사전 확인
 *
 * ## ToolStreamEvent 연동
 * `mcpProgressToToolStreamEvent()`를 사용하여 `McpStreamProgress`를
 * `ToolStreamEvent`로 변환하면, 기존 tool:stream 이벤트 파이프라인과
 * 자연스럽게 통합됩니다.
 *
 * @example
 * ```typescript
 * const handler = new McpStreamHandler({ enabled: true, chunkSize: 4096 });
 * const chunks: string[] = [];
 * for await (const chunk of handler.handleStreamResponse(asyncResponse)) {
 *   chunks.push(chunk);
 * }
 * const result = chunks.join('');
 * ```
 */

import { BaseError } from "../utils/error.js";
import { type ToolStreamEvent } from "../tools/streaming.js";

// ─── 에러 클래스 ────────────────────────────────────────────────────────────────

/**
 * MCP 스트리밍 에러 클래스
 *
 * 스트리밍 처리 중 발생하는 모든 에러를 나타냅니다.
 */
export class McpStreamError extends BaseError {
  constructor(message: string, context: Record<string, unknown> = {}) {
    super(message, "MCP_STREAM_ERROR", context);
  }
}

// ─── 타입 정의 ─────────────────────────────────────────────────────────────────

/**
 * MCP 서버 정보 — 스트리밍 지원 여부 판단에 사용
 *
 * `MCPServerConfig`의 subset으로 스트리밍 관련 판단에 필요한
 * 최소한의 필드만 포함합니다.
 */
export interface McpServerInfo {
  /** 서버 고유 이름 */
  readonly name: string;
  /** 트랜스포트 타입 — "sse"와 "http"만 스트리밍 지원 */
  readonly transport: "stdio" | "http" | "sse";
  /** 스트리밍 명시적 활성화 여부 (transport 기반 자동 판단의 오버라이드) */
  readonly streamingEnabled?: boolean;
}

/**
 * MCP 스트리밍 진행 상태
 *
 * 스트리밍 도중 진행률을 추적하기 위한 불변 스냅샷입니다.
 * `onProgress` 콜백에 전달되며, `ToolStreamEvent`로 변환하여
 * UI에 실시간으로 표시할 수 있습니다.
 */
export interface McpStreamProgress {
  /** 진행 상태를 발생시킨 MCP 서버 이름 */
  readonly serverId: string;
  /** 호출 중인 도구 이름 */
  readonly toolName: string;
  /** 지금까지 수신한 바이트 수 */
  readonly bytesReceived: number;
  /** 지금까지 수신한 청크 수 */
  readonly chunksReceived: number;
  /** 스트리밍 시작 이후 경과 시간(밀리초) */
  readonly elapsedMs: number;
}

/**
 * MCP 스트리밍 설정
 *
 * `McpStreamHandler` 생성 시 동작을 커스터마이즈할 수 있습니다.
 * 모든 필드는 선택적이며, 미입력 시 기본값이 사용됩니다.
 */
export interface McpStreamConfig {
  /** 스트리밍 활성화 여부 (기본: true) */
  readonly enabled: boolean;
  /**
   * 청크 크기 (바이트 단위, 기본: 4096)
   *
   * 개별 청크가 이 크기를 초과하면 분할됩니다.
   * 너무 작으면 오버헤드가 증가하고, 너무 크면 첫 청크가 늦게 도착합니다.
   */
  readonly chunkSize?: number;
  /**
   * 전체 스트림 타임아웃 (밀리초, 기본: 30_000)
   *
   * 스트리밍 시작 후 이 시간 내에 완료되지 않으면 에러가 발생합니다.
   */
  readonly timeoutMs?: number;
  /**
   * 진행 상태 콜백 — 각 청크 수신 후 호출됩니다.
   *
   * UI 업데이트나 로깅에 활용할 수 있습니다.
   * 콜백이 에러를 던지면 스트리밍이 중단됩니다.
   */
  readonly onProgress?: (event: McpStreamProgress) => void;
}

// ─── 기본값 상수 ───────────────────────────────────────────────────────────────

/** 기본 청크 크기 (바이트) */
const DEFAULT_CHUNK_SIZE = 4_096;

/** 기본 타임아웃 (밀리초) */
const DEFAULT_TIMEOUT_MS = 30_000;

// ─── McpStreamHandler ─────────────────────────────────────────────────────────

/**
 * MCP 스트리밍 핸들러
 *
 * JSON-RPC 스트리밍 응답(AsyncIterable)을 청크 스트림으로 변환하고,
 * 진행 상태를 추적하며 타임아웃을 관리합니다.
 *
 * @example
 * ```typescript
 * const handler = new McpStreamHandler({
 *   enabled: true,
 *   chunkSize: 4096,
 *   timeoutMs: 30_000,
 *   onProgress: (progress) => console.log(`Received ${progress.bytesReceived} bytes`),
 * });
 *
 * const fullResult = await handler.collectStream(
 *   handler.handleStreamResponse(asyncIterable, 'my-server', 'my_tool')
 * );
 * ```
 */
export class McpStreamHandler {
  private readonly config: Required<Omit<McpStreamConfig, "onProgress">> & {
    readonly onProgress?: McpStreamConfig["onProgress"];
  };

  /**
   * @param config - 스트리밍 동작 설정 (선택적)
   */
  constructor(config?: McpStreamConfig) {
    this.config = {
      enabled: config?.enabled ?? true,
      chunkSize: config?.chunkSize ?? DEFAULT_CHUNK_SIZE,
      timeoutMs: config?.timeoutMs ?? DEFAULT_TIMEOUT_MS,
      onProgress: config?.onProgress,
    };
  }

  /**
   * AsyncIterable 스트리밍 응답을 문자열 청크의 AsyncGenerator로 변환합니다.
   *
   * JSON-RPC 스트리밍 응답의 각 항목을 JSON 직렬화하고,
   * `chunkSize`를 초과하는 경우 분할합니다.
   * 빈 응답은 빈 스트림을 반환합니다.
   *
   * 타임아웃 내에 스트리밍이 완료되지 않으면 `McpStreamError`를 던집니다.
   *
   * @param response - JSON-RPC 스트리밍 응답 (AsyncIterable)
   * @param serverId - MCP 서버 이름 (진행 상태 추적용, 기본: "unknown")
   * @param toolName - 도구 이름 (진행 상태 추적용, 기본: "unknown")
   * @yields 문자열 청크
   * @throws McpStreamError 타임아웃 또는 스트리밍 에러 발생 시
   */
  async *handleStreamResponse(
    response: AsyncIterable<unknown>,
    serverId = "unknown",
    toolName = "unknown",
  ): AsyncGenerator<string> {
    const startTime = Date.now();
    const { chunkSize, timeoutMs, onProgress } = this.config;

    let bytesReceived = 0;
    let chunksReceived = 0;

    for await (const item of this.withTimeout(response, timeoutMs, serverId, toolName)) {
      // 각 항목을 문자열로 직렬화
      const raw = this.serializeItem(item);
      if (raw.length === 0) continue;

      bytesReceived += raw.length;

      // chunkSize 단위로 분할하여 yield
      let offset = 0;
      while (offset < raw.length) {
        const slice = raw.slice(offset, offset + chunkSize);
        yield slice;
        offset += chunkSize;
      }

      chunksReceived++;

      // 진행 상태 콜백 호출
      if (onProgress) {
        const progress: McpStreamProgress = {
          serverId,
          toolName,
          bytesReceived,
          chunksReceived,
          elapsedMs: Date.now() - startTime,
        };
        onProgress(progress);
      }
    }
  }

  /**
   * AsyncIterable 스트림을 완전히 수집하여 하나의 문자열로 반환합니다.
   *
   * 스트리밍이 완료될 때까지 모든 청크를 누적하고 연결합니다.
   * 타임아웃 내에 완료되지 않으면 `McpStreamError`를 던집니다.
   *
   * @param stream - 수집할 문자열 청크의 AsyncIterable
   * @returns 모든 청크를 연결한 최종 문자열
   * @throws McpStreamError 타임아웃 발생 시
   */
  async collectStream(stream: AsyncIterable<string>): Promise<string> {
    const chunks: string[] = [];
    for await (const chunk of stream) {
      chunks.push(chunk);
    }
    return chunks.join("");
  }

  /**
   * 서버가 스트리밍을 지원하는지 확인합니다.
   *
   * 스트리밍은 SSE(`sse`)와 HTTP(`http`) 트랜스포트에서만 지원됩니다.
   * `stdio` 트랜스포트는 요청/응답 패턴만 지원하므로 스트리밍 불가입니다.
   *
   * `streamingEnabled` 필드가 명시적으로 설정된 경우 트랜스포트 기반
   * 자동 판단보다 우선합니다.
   *
   * @param server - 확인할 MCP 서버 정보
   * @returns 스트리밍 지원 시 true
   */
  isStreamable(server: McpServerInfo): boolean {
    // 핸들러 자체가 비활성화된 경우 항상 false
    if (!this.config.enabled) return false;

    // 명시적 오버라이드가 있으면 우선 적용
    if (server.streamingEnabled !== undefined) {
      return server.streamingEnabled;
    }

    // 트랜스포트 기반 자동 판단: sse, http만 스트리밍 지원
    return server.transport === "sse" || server.transport === "http";
  }

  /**
   * 개별 응답 항목을 문자열로 직렬화합니다.
   *
   * - 이미 문자열이면 그대로 반환
   * - 객체/배열이면 JSON.stringify
   * - null/undefined이면 빈 문자열 반환
   *
   * @param item - 직렬화할 항목
   * @returns 직렬화된 문자열
   */
  private serializeItem(item: unknown): string {
    if (item === null || item === undefined) return "";
    if (typeof item === "string") return item;
    try {
      return JSON.stringify(item);
    } catch {
      return String(item);
    }
  }

  /**
   * AsyncIterable에 타임아웃을 적용하는 래퍼 제너레이터
   *
   * 스트리밍이 `timeoutMs` 이내에 완료되지 않으면 `McpStreamError`를 던집니다.
   * 각 항목 수신 후 경과 시간을 확인합니다.
   *
   * @param iterable - 래핑할 AsyncIterable
   * @param timeoutMs - 타임아웃 (밀리초)
   * @param serverId - 에러 컨텍스트용 서버 ID
   * @param toolName - 에러 컨텍스트용 도구 이름
   * @yields iterable의 각 항목
   * @throws McpStreamError 타임아웃 초과 시
   */
  private async *withTimeout(
    iterable: AsyncIterable<unknown>,
    timeoutMs: number,
    serverId: string,
    toolName: string,
  ): AsyncGenerator<unknown> {
    const startTime = Date.now();

    for await (const item of iterable) {
      const elapsed = Date.now() - startTime;
      if (elapsed > timeoutMs) {
        throw new McpStreamError(`Stream timed out after ${elapsed}ms (limit: ${timeoutMs}ms)`, {
          serverId,
          toolName,
          elapsedMs: elapsed,
          timeoutMs,
        });
      }
      yield item;
    }
  }
}

// ─── 어댑터 함수 ───────────────────────────────────────────────────────────────

/**
 * `McpStreamProgress`를 `ToolStreamEvent`로 변환하는 어댑터 함수
 *
 * MCP 스트리밍 진행 상태를 기존 tool:stream 이벤트 파이프라인에
 * 연결할 때 사용합니다. `AppEventEmitter`의 `tool:stream` 이벤트로
 * 발행하면 CLI UI에 실시간 진행 상태가 표시됩니다.
 *
 * @param progress - 변환할 MCP 스트리밍 진행 상태
 * @param toolCallId - 대응하는 도구 호출 ID
 * @returns ToolStreamEvent (tool:stream 이벤트 페이로드)
 *
 * @example
 * ```typescript
 * const handler = new McpStreamHandler({
 *   enabled: true,
 *   onProgress: (progress) => {
 *     const event = mcpProgressToToolStreamEvent(progress, 'call-123');
 *     appEvents.emit('tool:stream', event);
 *   },
 * });
 * ```
 */
export function mcpProgressToToolStreamEvent(
  progress: McpStreamProgress,
  toolCallId: string,
): ToolStreamEvent {
  return {
    type: "progress",
    toolCallId,
    toolName: progress.toolName,
    data: `[MCP: ${progress.serverId}] ${progress.chunksReceived} chunks received (${progress.bytesReceived} bytes)`,
    metadata: {
      bytesProcessed: progress.bytesReceived,
      elapsedMs: progress.elapsedMs,
    },
  };
}
