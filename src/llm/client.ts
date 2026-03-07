import OpenAI from "openai";
import {
  type LLMProvider,
  type ChatRequest,
  type ChatResponse,
  type ChatChunk,
  type ChatMessage,
  type ToolCallRequest,
  type ToolDefinitionForLLM,
} from "./provider.js";
import { countTokens } from "./token-counter.js";
import { LLMError } from "../utils/error.js";
import { getModelCapabilities, type ModelCapabilities } from "./model-capabilities.js";

/** Maximum number of retries for transient errors (500, 502, 503) */
const MAX_RETRIES_TRANSIENT = 3;

/** Maximum number of retries for rate limit errors (429) */
const MAX_RETRIES_RATE_LIMIT = 5;

/** Base delay between retries for transient errors in ms */
const BASE_RETRY_DELAY_MS = 1_000;

/** Base delay between retries for rate limit errors in ms */
const BASE_RATE_LIMIT_DELAY_MS = 5_000;

/** Maximum delay cap for rate limit backoff in ms (60s) */
const MAX_RATE_LIMIT_DELAY_MS = 60_000;

/**
 * Convert our ChatMessage to OpenAI format, adapting for model capabilities.
 */
function toOpenAIMessages(
  messages: readonly ChatMessage[],
  capabilities: ModelCapabilities,
): OpenAI.ChatCompletionMessageParam[] {
  return messages.map((msg) => {
    if (msg.role === "tool") {
      return {
        role: "tool" as const,
        content: msg.content,
        tool_call_id: msg.toolCallId ?? "",
      };
    }
    if (msg.role === "assistant" && msg.toolCalls && msg.toolCalls.length > 0) {
      return {
        role: "assistant" as const,
        content: msg.content || null,
        tool_calls: msg.toolCalls.map((tc) => ({
          id: tc.id,
          type: "function" as const,
          function: { name: tc.name, arguments: tc.arguments },
        })),
      };
    }
    // o1/o3 models: convert system messages to developer role
    if (msg.role === "system" && capabilities.useDeveloperRole) {
      return {
        role: "developer" as const,
        content: msg.content,
      } as OpenAI.ChatCompletionMessageParam;
    }
    // Models that don't support system messages: convert to user messages
    if (
      msg.role === "system" &&
      !capabilities.supportsSystemMessage &&
      !capabilities.useDeveloperRole
    ) {
      return {
        role: "user" as const,
        content: `[System instructions]\n${msg.content}`,
      };
    }
    return {
      role: msg.role as "system" | "user" | "assistant",
      content: msg.content,
    };
  });
}

/** Convert our tool definitions to OpenAI format */
function toOpenAITools(tools: readonly ToolDefinitionForLLM[]): OpenAI.ChatCompletionTool[] {
  return tools.map((t) => ({
    type: "function" as const,
    function: {
      name: t.function.name,
      description: t.function.description,
      parameters: t.function.parameters as Record<string, unknown>,
    },
  }));
}

/** Check if an error is retryable (transient server/network issues) */
function isRetryableError(error: unknown): boolean {
  if (error instanceof OpenAI.RateLimitError) return true;
  if (error instanceof OpenAI.InternalServerError) return true;
  if (error instanceof OpenAI.APIConnectionError) return true;
  if (error instanceof OpenAI.APIConnectionTimeoutError) return true;
  // Also check status code for generic APIError (502, 503)
  if (error instanceof OpenAI.APIError) {
    const status = error.status;
    return status === 429 || status === 500 || status === 502 || status === 503;
  }
  return false;
}

/** Check if an error is a rate limit error */
function isRateLimitError(error: unknown): boolean {
  if (error instanceof OpenAI.RateLimitError) return true;
  if (error instanceof OpenAI.APIError && error.status === 429) return true;
  return false;
}

/** Get retry delay in ms, respecting Retry-After header if available */
function getRetryDelay(error: unknown, attempt: number): number {
  // Check for Retry-After header on rate limit errors
  if (error instanceof OpenAI.APIError && error.headers) {
    const retryAfter = error.headers["retry-after"];
    if (retryAfter) {
      const seconds = Number(retryAfter);
      if (!Number.isNaN(seconds) && seconds > 0) {
        return seconds * 1_000;
      }
    }
  }
  // Rate limit: longer backoff (5s, 10s, 20s, 40s, 60s capped)
  if (isRateLimitError(error)) {
    return Math.min(BASE_RATE_LIMIT_DELAY_MS * Math.pow(2, attempt), MAX_RATE_LIMIT_DELAY_MS);
  }
  // Transient: standard backoff (1s, 2s, 4s)
  return BASE_RETRY_DELAY_MS * Math.pow(2, attempt);
}

/** Convert OpenAI SDK errors to descriptive LLMError */
function classifyError(error: unknown, operation: string, model: string): LLMError {
  if (error instanceof LLMError) return error;

  if (error instanceof OpenAI.AuthenticationError) {
    return new LLMError(
      "Authentication failed. Check your API key (OPENAI_API_KEY or DBCODE_API_KEY).",
      { model, cause: error.message, status: error.status },
    );
  }
  if (error instanceof OpenAI.PermissionDeniedError) {
    return new LLMError(
      "Permission denied. Your API key may lack access to this model.",
      { model, cause: error.message, status: error.status },
    );
  }
  if (error instanceof OpenAI.RateLimitError) {
    const retryAfterMs = getRetryDelay(error, 0);
    return new LLMError(
      "Rate limit exceeded. Please wait before retrying.",
      { model, cause: error.message, status: 429, retryAfterMs },
    );
  }
  if (error instanceof OpenAI.APIConnectionTimeoutError) {
    return new LLMError(
      "Request timed out. The model may be overloaded or the connection is slow.",
      { model, cause: error.message },
    );
  }
  if (error instanceof OpenAI.APIConnectionError) {
    return new LLMError(
      "Failed to connect to the API. Check your network and baseURL configuration.",
      { model, cause: error.message },
    );
  }
  if (error instanceof OpenAI.APIError) {
    return new LLMError(`API error (${error.status}): ${error.message}`, {
      model,
      cause: error.message,
      status: error.status,
    });
  }

  return new LLMError(`LLM ${operation} failed`, {
    model,
    cause: error instanceof Error ? error.message : String(error),
  });
}

/** Sleep for the given number of milliseconds */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Configuration for OpenAI-compatible client */
export interface OpenAIClientConfig {
  readonly baseURL: string;
  readonly apiKey?: string;
  readonly timeout?: number;
}

/**
 * OpenAI-compatible LLM client.
 * Works with any OpenAI-compatible API (OpenAI, Ollama, vLLM, llama.cpp, etc.)
 * Includes automatic retries for transient errors with exponential backoff.
 */
export class OpenAICompatibleClient implements LLMProvider {
  readonly name = "openai-compatible";
  private readonly client: OpenAI;

  constructor(config: OpenAIClientConfig) {
    this.client = new OpenAI({
      baseURL: config.baseURL,
      apiKey: config.apiKey ?? "no-key-required",
      timeout: config.timeout ?? 120_000,
      maxRetries: 0, // We handle retries ourselves for better control
    });
  }

  async chat(request: ChatRequest): Promise<ChatResponse> {
    let lastError: unknown;
    const maxRetries = MAX_RETRIES_TRANSIENT;

    for (let attempt = 0; ; attempt++) {
      try {
        return await this._chatOnce(request);
      } catch (error) {
        lastError = error;

        if (error instanceof LLMError) throw error;
        if (!isRetryableError(error)) break;

        const limit = isRateLimitError(error) ? MAX_RETRIES_RATE_LIMIT : maxRetries;
        if (attempt >= limit) break;

        const delay = getRetryDelay(error, attempt);
        await sleep(delay);
      }
    }

    throw classifyError(lastError, "chat request", request.model);
  }

  private async _chatOnce(request: ChatRequest): Promise<ChatResponse> {
    const caps = getModelCapabilities(request.model);
    const params: Record<string, unknown> = {
      model: request.model,
      messages: toOpenAIMessages(request.messages, caps),
      max_tokens: request.maxTokens,
    };
    // Only include temperature for models that support it
    if (caps.supportsTemperature && request.temperature !== undefined) {
      params.temperature = request.temperature;
    }
    // Only include tools for models that support them
    if (caps.supportsTools && request.tools) {
      params.tools = toOpenAITools(request.tools);
    }
    const response = await this.client.chat.completions.create(
      params as unknown as OpenAI.ChatCompletionCreateParamsNonStreaming,
      { signal: request.signal },
    );

    const choice = response.choices[0];
    if (!choice) {
      throw new LLMError("No response choice from LLM");
    }

    const toolCalls: ToolCallRequest[] =
      choice.message.tool_calls?.map((tc) => ({
        id: tc.id,
        name: tc.function.name,
        arguments: tc.function.arguments,
      })) ?? [];

    return {
      content: choice.message.content ?? "",
      toolCalls,
      usage: {
        promptTokens: response.usage?.prompt_tokens ?? 0,
        completionTokens: response.usage?.completion_tokens ?? 0,
        totalTokens: response.usage?.total_tokens ?? 0,
      },
      finishReason: choice.finish_reason ?? "stop",
    };
  }

  async *stream(request: ChatRequest): AsyncIterable<ChatChunk> {
    let lastError: unknown;
    const maxRetries = MAX_RETRIES_TRANSIENT;

    for (let attempt = 0; ; attempt++) {
      try {
        yield* this._streamOnce(request);
        return;
      } catch (error) {
        lastError = error;

        if (error instanceof LLMError) throw error;
        if (!isRetryableError(error)) break;

        const limit = isRateLimitError(error) ? MAX_RETRIES_RATE_LIMIT : maxRetries;
        if (attempt >= limit) break;

        const delay = getRetryDelay(error, attempt);
        await sleep(delay);
      }
    }

    throw classifyError(lastError, "stream request", request.model);
  }

  private async *_streamOnce(request: ChatRequest): AsyncIterable<ChatChunk> {
    const caps = getModelCapabilities(request.model);
    const params: Record<string, unknown> = {
      model: request.model,
      messages: toOpenAIMessages(request.messages, caps),
      max_tokens: request.maxTokens,
      stream: true,
    };
    if (caps.supportsTemperature && request.temperature !== undefined) {
      params.temperature = request.temperature;
    }
    if (caps.supportsTools && request.tools) {
      params.tools = toOpenAITools(request.tools);
    }
    const stream = await this.client.chat.completions.create(
      params as unknown as OpenAI.ChatCompletionCreateParamsStreaming,
      { signal: request.signal },
    );

    const toolCallsInProgress = new Map<
      number,
      { id: string; name: string; arguments: string }
    >();

    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta;
      if (!delta) continue;

      // Text content
      if (delta.content) {
        yield { type: "text-delta", text: delta.content };
      }

      // Tool calls (incremental assembly)
      if (delta.tool_calls) {
        for (const tc of delta.tool_calls) {
          const existing = toolCallsInProgress.get(tc.index);
          if (existing) {
            existing.arguments += tc.function?.arguments ?? "";
          } else {
            toolCallsInProgress.set(tc.index, {
              id: tc.id ?? "",
              name: tc.function?.name ?? "",
              arguments: tc.function?.arguments ?? "",
            });
          }
          yield {
            type: "tool-call-delta",
            toolCall: {
              id: tc.id ?? existing?.id,
              name: tc.function?.name ?? existing?.name,
              arguments: tc.function?.arguments ?? "",
            },
          };
        }
      }
    }

    yield {
      type: "done",
      usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
    };
  }

  countTokens(text: string): number {
    return countTokens(text);
  }
}
