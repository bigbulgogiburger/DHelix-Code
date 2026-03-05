import { type ChatMessage, type ToolCallRequest, type ToolDefinitionForLLM } from "./provider.js";
import { type ExtractedToolCall } from "../tools/types.js";
import { NativeFunctionCallingStrategy } from "./strategies/native-function-calling.js";
import { TextParsingStrategy } from "./strategies/text-parsing.js";

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

/** Models known to support native function calling */
const NATIVE_FUNCTION_CALLING_MODELS = new Set([
  "gpt-4",
  "gpt-4-turbo",
  "gpt-4o",
  "gpt-4o-mini",
  "gpt-3.5-turbo",
  "claude-3",
  "claude-3.5",
  "claude-3-opus",
  "claude-3-sonnet",
  "claude-3-haiku",
  "mistral-large",
  "mistral-medium",
  "command-r",
  "command-r-plus",
]);

/**
 * Check if a model name matches any known native function calling model.
 * Uses prefix matching to handle versioned model names (e.g., "gpt-4-0125-preview").
 */
function supportsNativeFunctionCalling(modelName: string): boolean {
  const lower = modelName.toLowerCase();
  for (const known of NATIVE_FUNCTION_CALLING_MODELS) {
    if (lower.startsWith(known)) return true;
  }
  return false;
}

/**
 * Select the appropriate strategy based on model capabilities.
 * Models known to support function calling use native strategy.
 * Unknown models fall back to text-parsing strategy.
 */
export function selectStrategy(modelName: string): ToolCallStrategy {
  if (supportsNativeFunctionCalling(modelName)) {
    return new NativeFunctionCallingStrategy();
  }
  return new TextParsingStrategy();
}

/**
 * Force a specific strategy regardless of model name.
 */
export function forceStrategy(strategyName: "native" | "text-parsing"): ToolCallStrategy {
  if (strategyName === "native") {
    return new NativeFunctionCallingStrategy();
  }
  return new TextParsingStrategy();
}
