/**
 * 스트리밍 응답 처리 — LLM의 실시간 스트리밍 응답을 누적하고 관리하는 모듈
 *
 * LLM은 응답을 한 번에 보내지 않고, 토큰 단위로 점진적으로 보냅니다(스트리밍).
 * 이 모듈은 이러한 스트리밍 청크(chunk)를 받아서:
 * - 텍스트, 도구 호출, 사고(thinking) 내용을 누적
 * - 메모리 과다 사용을 방지하는 백프레셔(backpressure) 적용
 * - 스트리밍 중 에러 발생 시 부분 데이터 복구
 *
 * 모든 상태 업데이트는 불변(immutable) — 새 객체를 생성하여 반환합니다.
 */
import { type ChatChunk, type TokenUsage, type ToolCallRequest } from "./provider.js";

const trace = (tag: string, msg: string) => {
  if (process.env.DBCODE_VERBOSE) process.stderr.write(`[${tag}] ${msg}\n`);
};

/**
 * 기본 최대 버퍼 크기 (1MB)
 * 이 크기를 초과하면 오래된 텍스트를 잘라냅니다.
 */
export const DEFAULT_MAX_BUFFER_BYTES = 1024 * 1024;

/** 백프레셔 설정 — 메모리 사용량을 제한하는 옵션 */
export interface BackpressureConfig {
  /**
   * 최대 버퍼 크기 (바이트)
   * 이 값을 초과하면 오래된 텍스트를 자동으로 잘라냅니다.
   * 기본값: 1MB
   */
  readonly maxBufferBytes?: number;
}

/**
 * 누적된 스트리밍 상태 — 현재까지 받은 모든 데이터의 스냅샷
 *
 * 스트리밍이 진행됨에 따라 이 객체가 갱신됩니다.
 * 불변 객체이므로 매번 새 인스턴스가 생성됩니다.
 */
export interface StreamAccumulator {
  /** 지금까지 누적된 텍스트 응답 */
  readonly text: string;
  /** 지금까지 조립된 도구 호출 목록 */
  readonly toolCalls: readonly ToolCallRequest[];
  /** 스트리밍이 완료되었는지 여부 */
  readonly isComplete: boolean;
  /** 스트림이 중간에 끊겨서 부분적인 데이터만 복구된 경우 true */
  readonly partial?: boolean;
  /** API가 보고한 토큰 사용량 (스트리밍 완료 시 제공) */
  readonly usage?: TokenUsage;
  /** Extended Thinking에서 누적된 사고 내용 */
  readonly thinking?: string;
  /** 현재 추정 버퍼 크기 (바이트) */
  readonly bufferBytes?: number;
  /** 백프레셔로 인해 텍스트가 잘렸으면 true */
  readonly trimmed?: boolean;
  /** API가 보고한 응답 종료 사유 ("stop", "length", "tool_calls" 등) */
  readonly finishReason?: string;
}

/**
 * 문자열의 바이트 길이를 빠르게 추정
 *
 * 정확한 UTF-8 인코딩 길이 대신 charCodeAt를 사용한 근사치를 계산합니다.
 * Buffer.byteLength보다 훨씬 빠르며, 스트리밍 성능에 영향을 주지 않습니다.
 *
 * UTF-8 인코딩 규칙:
 * - ASCII (0x00~0x7F): 1바이트
 * - 라틴 확장 (0x80~0x7FF): 2바이트
 * - 한글, CJK 등 (0x800~): 3바이트
 *
 * @param str - 바이트 길이를 추정할 문자열
 * @returns 추정 바이트 길이
 */
function estimateByteLength(str: string): number {
  let bytes = 0;
  for (let i = 0; i < str.length; i++) {
    const code = str.charCodeAt(i);
    if (code <= 0x7f)
      bytes += 1; // ASCII 문자
    else if (code <= 0x7ff)
      bytes += 2; // 라틴 확장 문자
    else bytes += 3; // 한글, CJK 등 멀티바이트 문자
  }
  return bytes;
}

/**
 * 백프레셔 적용 — 버퍼가 최대 크기를 초과하면 앞부분을 잘라냄
 *
 * 매우 긴 응답에서 메모리가 무한정 증가하는 것을 방지합니다.
 * 앞부분(오래된 내용)의 절반을 잘라내어 새로운 내용을 위한 공간을 확보합니다.
 *
 * @param text - 현재 누적된 텍스트
 * @param bufferBytes - 현재 추정 버퍼 크기 (바이트)
 * @param maxBufferBytes - 최대 허용 버퍼 크기 (바이트)
 * @returns 잘린 텍스트, 업데이트된 바이트 수, 잘림 여부
 */
function applyBackpressure(
  text: string,
  bufferBytes: number,
  maxBufferBytes: number,
): { text: string; bufferBytes: number; trimmed: boolean } {
  // 최대 크기를 초과하지 않으면 그대로 반환
  if (bufferBytes <= maxBufferBytes) {
    return { text, bufferBytes, trimmed: false };
  }
  // 텍스트의 앞쪽 절반을 잘라내어 공간 확보
  const halfLen = Math.floor(text.length / 2);
  const trimmedText = text.slice(halfLen);
  return {
    text: trimmedText,
    bufferBytes: estimateByteLength(trimmedText),
    trimmed: true,
  };
}

/**
 * 새로운 빈 StreamAccumulator를 생성
 *
 * 스트리밍 시작 시 초기 상태로 사용합니다.
 *
 * @returns 초기화된 StreamAccumulator
 */
export function createStreamAccumulator(): StreamAccumulator {
  return { text: "", toolCalls: [], isComplete: false, bufferBytes: 0 };
}

/**
 * 하나의 스트리밍 청크를 처리하여 갱신된 누적 상태를 반환
 *
 * 불변 업데이트 — 기존 상태를 수정하지 않고 새 객체를 생성합니다.
 * 청크 타입에 따라 다른 처리를 수행합니다:
 * - thinking-delta: 사고 내용 누적
 * - text-delta: 텍스트 누적 + 백프레셔 적용
 * - tool-call-delta: 도구 호출 조립 (신규 또는 기존에 이어 붙이기)
 * - done: 완료 플래그 설정 + 사용량 저장
 *
 * @param state - 현재 누적 상태
 * @param chunk - 처리할 스트리밍 청크
 * @param backpressure - 백프레셔 설정 (선택적)
 * @returns 갱신된 누적 상태 (새 객체)
 */
export function accumulateChunk(
  state: StreamAccumulator,
  chunk: ChatChunk,
  backpressure?: BackpressureConfig,
): StreamAccumulator {
  const maxBytes = backpressure?.maxBufferBytes ?? DEFAULT_MAX_BUFFER_BYTES;

  switch (chunk.type) {
    // Extended Thinking 사고 내용 청크 — 기존 사고에 이어 붙임
    case "thinking-delta":
      return {
        ...state,
        thinking: (state.thinking ?? "") + (chunk.thinking_delta ?? ""),
      };

    // 텍스트 응답 청크 — 기존 텍스트에 이어 붙이고 백프레셔 확인
    case "text-delta": {
      const delta = chunk.text ?? "";
      const newText = state.text + delta;
      const newBytes = (state.bufferBytes ?? 0) + estimateByteLength(delta);
      // 버퍼 크기가 한도를 초과하면 앞부분을 자동으로 잘라냄
      const bp = applyBackpressure(newText, newBytes, maxBytes);
      return {
        ...state,
        text: bp.text,
        bufferBytes: bp.bufferBytes,
        trimmed: bp.trimmed || state.trimmed, // 한 번이라도 잘렸으면 true 유지
      };
    }

    // 도구 호출 청크 — 점진적으로 도구 호출을 조립
    case "tool-call-delta": {
      if (!chunk.toolCall) return state;
      const { id, name, arguments: args } = chunk.toolCall;

      // 같은 ID의 기존 도구 호출이 있는지 확인
      const existingIndex = state.toolCalls.findIndex((tc) => tc.id === id);

      if (existingIndex >= 0) {
        // 기존 도구 호출에 인자 조각을 이어 붙임 (불변 업데이트)
        const updated = state.toolCalls.map((tc, i) =>
          i === existingIndex ? { ...tc, arguments: tc.arguments + (args ?? "") } : tc,
        );
        return { ...state, toolCalls: updated };
      }

      // 새로운 도구 호출 시작 — id와 name이 모두 있어야 유효
      if (id && name) {
        trace("streaming", `New tool call accumulated: id=${id}, name=${name}`);
        return {
          ...state,
          toolCalls: [...state.toolCalls, { id, name, arguments: args ?? "" }],
        };
      }
      trace(
        "streaming",
        `tool-call-delta DROPPED: id=${id || "(empty)"}, name=${name || "(empty)"}`,
      );

      return state;
    }

    // 스트리밍 완료 신호
    case "done":
      return {
        ...state,
        isComplete: true,
        usage: chunk.usage ?? state.usage,
        finishReason: chunk.finishReason ?? state.finishReason,
      };

    default:
      return state;
  }
}

/**
 * 스트리밍 응답을 소비하며 콜백을 호출하는 고수준 함수
 *
 * AsyncIterable<ChatChunk>를 순회하면서:
 * - 각 청크를 누적 상태에 반영
 * - 타입별 콜백을 호출 (텍스트 표시, 도구 호출 표시 등)
 * - 완료 시 최종 상태를 반환
 *
 * 에러 복구:
 * - 스트리밍 도중 에러가 발생하면, 이미 누적된 데이터가 있으면
 *   partial=true로 반환하여 부분 데이터를 보존합니다.
 * - 아무 데이터도 없으면 에러를 재throw하여 상위에서 재시도하도록 합니다.
 *
 * @param stream - 비동기 스트리밍 이터러블
 * @param callbacks - 타입별 콜백 함수 (모두 선택적)
 * @param backpressure - 백프레셔 설정 (선택적)
 * @returns 최종 누적 상태
 */
export async function consumeStream(
  stream: AsyncIterable<ChatChunk>,
  callbacks?: {
    /** 텍스트 조각이 도착할 때마다 호출 — UI에서 실시간 텍스트 표시에 사용 */
    onTextDelta?: (text: string) => void;
    /** 도구 호출 조각이 도착할 때마다 호출 — UI에서 도구 호출 진행 상황 표시 */
    onToolCallDelta?: (toolCall: Partial<ToolCallRequest>) => void;
    /** Extended Thinking 사고 조각이 도착할 때마다 호출 */
    onThinkingDelta?: (text: string) => void;
    /** 스트리밍 완료 시 호출 — 최종 결과 처리 */
    onComplete?: (accumulator: StreamAccumulator) => void;
    /** 토큰 사용량이 보고될 때 호출 — 비용 추적 연동 */
    onUsage?: (usage: TokenUsage) => void;
  },
  backpressure?: BackpressureConfig,
): Promise<StreamAccumulator> {
  let state = createStreamAccumulator();

  try {
    for await (const chunk of stream) {
      // 청크를 누적 상태에 반영
      state = accumulateChunk(state, chunk, backpressure);

      // 타입에 따라 적절한 콜백 호출
      if (chunk.type === "thinking-delta" && chunk.thinking_delta && callbacks?.onThinkingDelta) {
        callbacks.onThinkingDelta(chunk.thinking_delta);
      }
      if (chunk.type === "text-delta" && chunk.text && callbacks?.onTextDelta) {
        callbacks.onTextDelta(chunk.text);
      }
      if (chunk.type === "tool-call-delta" && chunk.toolCall && callbacks?.onToolCallDelta) {
        callbacks.onToolCallDelta(chunk.toolCall);
      }
      if (chunk.type === "done") {
        // 토큰 사용량 콜백 호출
        if (state.usage && callbacks?.onUsage) {
          callbacks.onUsage(state.usage);
        }
        // 완료 콜백 호출
        if (callbacks?.onComplete) {
          callbacks.onComplete(state);
        }
      }
    }
  } catch (error) {
    // 스트리밍 중 에러 발생 — 이미 의미 있는 데이터가 있으면 보존
    // 부분 응답이라도 사용자에게 보여주는 것이 아무것도 없는 것보다 나음
    if (state.text.length > 0 || state.toolCalls.length > 0) {
      return { ...state, partial: true };
    }
    // 누적된 데이터가 없으면 에러를 재throw — 상위에서 재시도 가능
    throw error;
  }

  return state;
}
