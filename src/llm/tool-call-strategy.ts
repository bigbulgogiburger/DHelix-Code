import { type ChatMessage, type ToolCallRequest, type ToolDefinitionForLLM } from "./provider.js";
import { type ExtractedToolCall } from "../tools/types.js";
import { NativeFunctionCallingStrategy } from "./strategies/native-function-calling.js";

/** Prepared LLM request with tool definitions embedded */
export interface PreparedRequest {
  readonly messages: readonly ChatMessage[];
  readonly tools?: readonly ToolDefinitionForLLM[];
}

/**
 * Strategy for handling tool calls with different LLM capabilities.
 * Native: uses OpenAI-style tool_calls field
 * Text-parsing: parses XML tool calls from text output (fallback)
 */
export interface ToolCallStrategy {
  readonly name: "native" | "text-parsing";
  prepareRequest(
    messages: readonly ChatMessage[],
    tools: readonly ToolDefinitionForLLM[],
  ): PreparedRequest;
  extractToolCalls(
    content: string,
    toolCalls: readonly ToolCallRequest[],
  ): readonly ExtractedToolCall[];
  formatToolResults(
    results: readonly { id: string; output: string; isError: boolean }[],
  ): readonly ChatMessage[];
}

/**
 * Select the appropriate strategy based on model capabilities.
 */
export function selectStrategy(_modelName: string): ToolCallStrategy {
  return new NativeFunctionCallingStrategy();
}
