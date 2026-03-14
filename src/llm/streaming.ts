import { type ChatChunk, type TokenUsage, type ToolCallRequest } from "./provider.js";

/** Default maximum buffer size in bytes (1MB) */
export const DEFAULT_MAX_BUFFER_BYTES = 1024 * 1024;

/** Backpressure configuration */
export interface BackpressureConfig {
  /** Maximum buffer size in bytes before trimming old content (default: 1MB) */
  readonly maxBufferBytes?: number;
}

/** Accumulated streaming state */
export interface StreamAccumulator {
  readonly text: string;
  readonly toolCalls: readonly ToolCallRequest[];
  readonly isComplete: boolean;
  /** True when the stream disconnected mid-response and only partial content was recovered */
  readonly partial?: boolean;
  /** Token usage reported by the API (available when stream_options.include_usage is enabled) */
  readonly usage?: TokenUsage;
  /** Accumulated thinking content from Extended Thinking */
  readonly thinking?: string;
  /** Current estimated buffer size in bytes */
  readonly bufferBytes?: number;
  /** True if text was trimmed due to backpressure */
  readonly trimmed?: boolean;
}

/** Estimate byte length of a string (fast approximation using charCodeAt) */
function estimateByteLength(str: string): number {
  let bytes = 0;
  for (let i = 0; i < str.length; i++) {
    const code = str.charCodeAt(i);
    if (code <= 0x7f) bytes += 1;
    else if (code <= 0x7ff) bytes += 2;
    else bytes += 3;
  }
  return bytes;
}

/**
 * Apply backpressure by trimming the front of text when buffer exceeds max size.
 * Returns the trimmed text and updated byte count.
 */
function applyBackpressure(
  text: string,
  bufferBytes: number,
  maxBufferBytes: number,
): { text: string; bufferBytes: number; trimmed: boolean } {
  if (bufferBytes <= maxBufferBytes) {
    return { text, bufferBytes, trimmed: false };
  }
  // Trim front half of text to make room
  const halfLen = Math.floor(text.length / 2);
  const trimmedText = text.slice(halfLen);
  return {
    text: trimmedText,
    bufferBytes: estimateByteLength(trimmedText),
    trimmed: true,
  };
}

/**
 * Accumulate streaming chunks into a complete response.
 * Immutable — returns a new StreamAccumulator on each update.
 */
export function createStreamAccumulator(): StreamAccumulator {
  return { text: "", toolCalls: [], isComplete: false, bufferBytes: 0 };
}

/**
 * Process a chunk and return updated accumulator.
 * Accepts an optional backpressure config to limit buffer growth.
 */
export function accumulateChunk(
  state: StreamAccumulator,
  chunk: ChatChunk,
  backpressure?: BackpressureConfig,
): StreamAccumulator {
  const maxBytes = backpressure?.maxBufferBytes ?? DEFAULT_MAX_BUFFER_BYTES;

  switch (chunk.type) {
    case "thinking-delta":
      return {
        ...state,
        thinking: (state.thinking ?? "") + (chunk.thinking_delta ?? ""),
      };

    case "text-delta": {
      const delta = chunk.text ?? "";
      const newText = state.text + delta;
      const newBytes = (state.bufferBytes ?? 0) + estimateByteLength(delta);
      const bp = applyBackpressure(newText, newBytes, maxBytes);
      return {
        ...state,
        text: bp.text,
        bufferBytes: bp.bufferBytes,
        trimmed: bp.trimmed || state.trimmed,
      };
    }

    case "tool-call-delta": {
      if (!chunk.toolCall) return state;
      const { id, name, arguments: args } = chunk.toolCall;

      // Find existing tool call being assembled
      const existingIndex = state.toolCalls.findIndex((tc) => tc.id === id);

      if (existingIndex >= 0) {
        // Append to existing tool call arguments
        const updated = state.toolCalls.map((tc, i) =>
          i === existingIndex ? { ...tc, arguments: tc.arguments + (args ?? "") } : tc,
        );
        return { ...state, toolCalls: updated };
      }

      // New tool call
      if (id && name) {
        return {
          ...state,
          toolCalls: [...state.toolCalls, { id, name, arguments: args ?? "" }],
        };
      }

      return state;
    }

    case "done":
      return { ...state, isComplete: true, usage: chunk.usage ?? state.usage };

    default:
      return state;
  }
}

/**
 * Consume an async iterable of chunks with callbacks.
 * Supports optional backpressure to limit memory usage.
 */
export async function consumeStream(
  stream: AsyncIterable<ChatChunk>,
  callbacks?: {
    onTextDelta?: (text: string) => void;
    onToolCallDelta?: (toolCall: Partial<ToolCallRequest>) => void;
    onThinkingDelta?: (text: string) => void;
    onComplete?: (accumulator: StreamAccumulator) => void;
    /** Called when token usage is reported by the API (via stream_options.include_usage) */
    onUsage?: (usage: TokenUsage) => void;
  },
  backpressure?: BackpressureConfig,
): Promise<StreamAccumulator> {
  let state = createStreamAccumulator();

  try {
    for await (const chunk of stream) {
      state = accumulateChunk(state, chunk, backpressure);

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
        if (state.usage && callbacks?.onUsage) {
          callbacks.onUsage(state.usage);
        }
        if (callbacks?.onComplete) {
          callbacks.onComplete(state);
        }
      }
    }
  } catch (error) {
    // If we accumulated meaningful content before the error,
    // return what we have rather than losing everything
    if (state.text.length > 0 || state.toolCalls.length > 0) {
      return { ...state, partial: true };
    }
    // No content accumulated — rethrow so client retry kicks in
    throw error;
  }

  return state;
}
