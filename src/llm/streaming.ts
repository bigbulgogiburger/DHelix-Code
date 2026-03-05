import { type ChatChunk, type ToolCallRequest } from "./provider.js";

/** Accumulated streaming state */
export interface StreamAccumulator {
  readonly text: string;
  readonly toolCalls: readonly ToolCallRequest[];
  readonly isComplete: boolean;
}

/**
 * Accumulate streaming chunks into a complete response.
 * Immutable — returns a new StreamAccumulator on each update.
 */
export function createStreamAccumulator(): StreamAccumulator {
  return { text: "", toolCalls: [], isComplete: false };
}

/**
 * Process a chunk and return updated accumulator.
 */
export function accumulateChunk(state: StreamAccumulator, chunk: ChatChunk): StreamAccumulator {
  switch (chunk.type) {
    case "text-delta":
      return {
        ...state,
        text: state.text + (chunk.text ?? ""),
      };

    case "tool-call-delta": {
      if (!chunk.toolCall) return state;
      const { id, name, arguments: args } = chunk.toolCall;

      // Find existing tool call being assembled
      const existingIndex = state.toolCalls.findIndex((tc) => tc.id === id && id);

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
      return { ...state, isComplete: true };

    default:
      return state;
  }
}

/**
 * Consume an async iterable of chunks with callbacks.
 */
export async function consumeStream(
  stream: AsyncIterable<ChatChunk>,
  callbacks?: {
    onTextDelta?: (text: string) => void;
    onToolCallDelta?: (toolCall: Partial<ToolCallRequest>) => void;
    onComplete?: (accumulator: StreamAccumulator) => void;
  },
): Promise<StreamAccumulator> {
  let state = createStreamAccumulator();

  for await (const chunk of stream) {
    state = accumulateChunk(state, chunk);

    if (chunk.type === "text-delta" && chunk.text && callbacks?.onTextDelta) {
      callbacks.onTextDelta(chunk.text);
    }
    if (chunk.type === "tool-call-delta" && chunk.toolCall && callbacks?.onToolCallDelta) {
      callbacks.onToolCallDelta(chunk.toolCall);
    }
    if (chunk.type === "done" && callbacks?.onComplete) {
      callbacks.onComplete(state);
    }
  }

  return state;
}
