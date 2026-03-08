/** Chat message role */
export type ChatRole = "system" | "user" | "assistant" | "tool";

/** A single chat message */
export interface ChatMessage {
  readonly role: ChatRole;
  readonly content: string;
  readonly name?: string;
  readonly toolCallId?: string;
  readonly toolCalls?: readonly ToolCallRequest[];
}

/** Tool call request from the LLM */
export interface ToolCallRequest {
  readonly id: string;
  readonly name: string;
  readonly arguments: string;
}

/** Tool definition for LLM function calling */
export interface ToolDefinitionForLLM {
  readonly type: "function";
  readonly function: {
    readonly name: string;
    readonly description: string;
    readonly parameters: Record<string, unknown>;
  };
}

/** Extended Thinking configuration */
export interface ThinkingConfig {
  readonly type: "enabled";
  readonly budget_tokens: number;
}

/** Request to the LLM */
export interface ChatRequest {
  readonly model: string;
  readonly messages: readonly ChatMessage[];
  readonly tools?: readonly ToolDefinitionForLLM[];
  readonly temperature?: number;
  readonly maxTokens?: number;
  readonly signal?: AbortSignal;
  readonly thinking?: ThinkingConfig;
}

/** Full LLM response */
export interface ChatResponse {
  readonly content: string;
  readonly toolCalls: readonly ToolCallRequest[];
  readonly usage: TokenUsage;
  readonly finishReason: string;
  readonly thinking?: string;
}

/** Streaming chunk from LLM */
export interface ChatChunk {
  readonly type: "text-delta" | "tool-call-delta" | "thinking-delta" | "done";
  readonly text?: string;
  readonly toolCall?: Partial<ToolCallRequest>;
  readonly usage?: TokenUsage;
  readonly thinking_delta?: string;
}

/** Token usage information */
export interface TokenUsage {
  readonly promptTokens: number;
  readonly completionTokens: number;
  readonly totalTokens: number;
}

/**
 * LLM Provider interface — abstraction over OpenAI-compatible APIs.
 */
export interface LLMProvider {
  readonly name: string;
  chat(request: ChatRequest): Promise<ChatResponse>;
  stream(request: ChatRequest): AsyncIterable<ChatChunk>;
  countTokens(text: string): number;
}
