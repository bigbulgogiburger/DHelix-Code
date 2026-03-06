import { type ChatMessage, type ToolCallRequest, type ToolDefinitionForLLM } from "./provider.js";
import { type ExtractedToolCall } from "../tools/types.js";
import { NativeFunctionCallingStrategy } from "./strategies/native-function-calling.js";
import { TextParsingStrategy } from "./strategies/text-parsing.js";
import { getModelCapabilities } from "./model-capabilities.js";

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
 * Uses the centralized model-capabilities system.
 * Models with tool support → native strategy.
 * Models without → text-parsing strategy (XML fallback).
 */
export function selectStrategy(modelName: string): ToolCallStrategy {
  const caps = getModelCapabilities(modelName);
  if (caps.supportsTools) {
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
