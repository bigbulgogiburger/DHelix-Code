import { vi } from "vitest";
import {
  type LLMProvider,
  type ChatResponse,
  type ChatChunk,
  type ChatRequest,
} from "../../src/llm/provider.js";

/**
 * Create a mock ChatCompletion response (text only).
 */
export function mockChatCompletion(
  text: string,
  toolCalls?: Array<{ id: string; name: string; arguments: Record<string, unknown> }>,
): ChatResponse {
  return {
    content: text,
    toolCalls:
      toolCalls?.map((tc) => ({
        id: tc.id,
        name: tc.name,
        arguments: JSON.stringify(tc.arguments),
      })) ?? [],
    usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
    finishReason: toolCalls && toolCalls.length > 0 ? "tool_calls" : "stop",
  };
}

/**
 * Create an async iterable of streaming text chunks.
 */
export async function* mockStreamChunks(text: string): AsyncIterable<ChatChunk> {
  // Split text into word-level chunks for realistic simulation
  const words = text.split(/(\s+)/);
  for (const word of words) {
    yield { type: "text-delta", text: word };
  }
  yield { type: "done", usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 } };
}

/**
 * Create a mock ChatCompletion with tool calls.
 */
export function mockToolCallResponse(
  name: string,
  args: Record<string, unknown>,
  id = "tc_mock_1",
): ChatResponse {
  return mockChatCompletion("", [{ id, name, arguments: args }]);
}

/**
 * Create a mock LLM provider with predetermined responses.
 */
export function createMockLLMProvider(responses: ChatResponse[]): LLMProvider {
  let callIndex = 0;
  return {
    name: "mock",
    chat: vi.fn(async (_request: ChatRequest) => {
      const resp = responses[callIndex] ?? responses[responses.length - 1];
      callIndex++;
      return resp;
    }),
    stream: vi.fn(async function* (_request: ChatRequest) {
      const resp = responses[callIndex] ?? responses[responses.length - 1];
      callIndex++;
      if (resp.content) {
        yield* mockStreamChunks(resp.content);
      }
    }),
    countTokens: vi.fn(() => 10),
  };
}

/**
 * Simulate an error response from the API.
 */
export function mockErrorResponse(status: number, message: string): Error {
  const error = new Error(message);
  (error as Error & { status: number }).status = status;
  return error;
}
