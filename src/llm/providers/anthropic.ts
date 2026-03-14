import {
  type LLMProvider,
  type ChatRequest,
  type ChatResponse,
  type ChatChunk,
  type ChatMessage,
  type ToolCallRequest,
  type ToolDefinitionForLLM,
} from "../provider.js";
import { LLMError } from "../../utils/error.js";

const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION = "2023-06-01";

/** Maximum retries for transient errors */
const MAX_RETRIES_TRANSIENT = 3;

/** Maximum retries for rate limit errors */
const MAX_RETRIES_RATE_LIMIT = 5;

/** Base delay between retries for transient errors in ms */
const BASE_RETRY_DELAY_MS = 1_000;

/** Base delay between retries for rate limit errors in ms */
const BASE_RATE_LIMIT_DELAY_MS = 5_000;

/** Maximum delay cap for rate limit backoff in ms (60s) */
const MAX_RATE_LIMIT_DELAY_MS = 60_000;

/** Anthropic content block types */
interface AnthropicTextBlock {
  readonly type: "text";
  readonly text: string;
}

interface AnthropicThinkingBlock {
  readonly type: "thinking";
  readonly thinking: string;
}

interface AnthropicToolUseBlock {
  readonly type: "tool_use";
  readonly id: string;
  readonly name: string;
  readonly input: Record<string, unknown>;
}

type AnthropicContentBlock = AnthropicTextBlock | AnthropicThinkingBlock | AnthropicToolUseBlock;

/** Anthropic tool definition */
interface AnthropicTool {
  readonly name: string;
  readonly description: string;
  readonly input_schema: Record<string, unknown>;
}

/** Anthropic message response */
interface AnthropicResponse {
  readonly id: string;
  readonly type: "message";
  readonly role: "assistant";
  readonly content: readonly AnthropicContentBlock[];
  readonly stop_reason: "end_turn" | "max_tokens" | "stop_sequence" | "tool_use" | null;
  readonly usage: {
    readonly input_tokens: number;
    readonly output_tokens: number;
  };
}

/** Anthropic SSE event types */
interface AnthropicMessageStartEvent {
  readonly type: "message_start";
  readonly message: AnthropicResponse;
}

interface AnthropicContentBlockStartEvent {
  readonly type: "content_block_start";
  readonly index: number;
  readonly content_block: AnthropicContentBlock;
}

interface AnthropicContentBlockDeltaEvent {
  readonly type: "content_block_delta";
  readonly index: number;
  readonly delta:
    | { readonly type: "text_delta"; readonly text: string }
    | { readonly type: "thinking_delta"; readonly thinking: string }
    | { readonly type: "input_json_delta"; readonly partial_json: string };
}

interface AnthropicContentBlockStopEvent {
  readonly type: "content_block_stop";
  readonly index: number;
}

interface AnthropicMessageDeltaEvent {
  readonly type: "message_delta";
  readonly delta: {
    readonly stop_reason: string | null;
  };
  readonly usage: {
    readonly output_tokens: number;
  };
}

interface AnthropicMessageStopEvent {
  readonly type: "message_stop";
}

type AnthropicStreamEvent =
  | AnthropicMessageStartEvent
  | AnthropicContentBlockStartEvent
  | AnthropicContentBlockDeltaEvent
  | AnthropicContentBlockStopEvent
  | AnthropicMessageDeltaEvent
  | AnthropicMessageStopEvent;

/** Configuration for the Anthropic provider */
export interface AnthropicProviderConfig {
  readonly apiKey?: string;
  readonly baseURL?: string;
  readonly timeout?: number;
}

/** Extract system messages and convert remaining to Anthropic format */
function extractSystemAndMessages(messages: readonly ChatMessage[]): {
  system: string | undefined;
  messages: Array<Record<string, unknown>>;
} {
  let system: string | undefined;
  const converted: Array<Record<string, unknown>> = [];

  for (const msg of messages) {
    if (msg.role === "system") {
      system = system ? `${system}\n\n${msg.content}` : msg.content;
      continue;
    }

    if (msg.role === "tool") {
      converted.push({
        role: "user",
        content: [
          {
            type: "tool_result",
            tool_use_id: msg.toolCallId ?? "",
            content: msg.content,
          },
        ],
      });
      continue;
    }

    if (msg.role === "assistant" && msg.toolCalls && msg.toolCalls.length > 0) {
      const content: Array<Record<string, unknown>> = [];
      if (msg.content) {
        content.push({ type: "text", text: msg.content });
      }
      for (const tc of msg.toolCalls) {
        let input: Record<string, unknown> = {};
        try {
          input = JSON.parse(tc.arguments) as Record<string, unknown>;
        } catch {
          input = {};
        }
        content.push({
          type: "tool_use",
          id: tc.id,
          name: tc.name,
          input,
        });
      }
      converted.push({ role: "assistant", content });
      continue;
    }

    converted.push({
      role: msg.role,
      content: msg.content,
    });
  }

  return { system, messages: converted };
}

/** Convert our tool definitions to Anthropic format */
function toAnthropicTools(tools: readonly ToolDefinitionForLLM[]): AnthropicTool[] {
  return tools.map((t) => ({
    name: t.function.name,
    description: t.function.description,
    input_schema: t.function.parameters,
  }));
}

/** Map Anthropic stop_reason to OpenAI-style finishReason */
function mapStopReason(stopReason: string | null): string {
  switch (stopReason) {
    case "end_turn":
      return "stop";
    case "max_tokens":
      return "length";
    case "tool_use":
      return "tool_calls";
    case "stop_sequence":
      return "stop";
    default:
      return "stop";
  }
}

/** Check if an HTTP status code is retryable */
function isRetryableStatus(status: number): boolean {
  return status === 429 || status === 500 || status === 502 || status === 503 || status === 529;
}

/** Check if a status is rate-limited */
function isRateLimitStatus(status: number): boolean {
  return status === 429 || status === 529;
}

/** Sleep for the given number of milliseconds */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Classify an HTTP error into a descriptive LLMError */
function classifyHttpError(status: number, body: string, model: string): LLMError {
  let detail: string;
  try {
    const parsed = JSON.parse(body) as { error?: { message?: string } };
    detail = parsed.error?.message ?? body;
  } catch {
    detail = body;
  }

  if (status === 401) {
    return new LLMError("Authentication failed. Check your ANTHROPIC_API_KEY.", {
      model,
      cause: detail,
      status,
    });
  }
  if (status === 403) {
    return new LLMError("Permission denied. Your API key may lack access to this model.", {
      model,
      cause: detail,
      status,
    });
  }
  if (status === 429 || status === 529) {
    return new LLMError("Rate limit exceeded. Please wait before retrying.", {
      model,
      cause: detail,
      status,
    });
  }

  return new LLMError(`Anthropic API error (${status}): ${detail}`, {
    model,
    cause: detail,
    status,
  });
}

/**
 * Parse an SSE stream from a ReadableStream into individual events.
 */
async function* parseSSEStream(
  body: ReadableStream<Uint8Array>,
  signal?: AbortSignal,
): AsyncIterable<AnthropicStreamEvent> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      if (signal?.aborted) {
        throw new LLMError("Request aborted");
      }

      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      let currentEventType: string | null = null;

      for (const line of lines) {
        if (line.startsWith("event: ")) {
          currentEventType = line.slice(7).trim();
          continue;
        }

        if (line.startsWith("data: ") && currentEventType) {
          const data = line.slice(6);
          try {
            const parsed = JSON.parse(data) as AnthropicStreamEvent;
            yield parsed;
          } catch {
            if (process.env.DBCODE_VERBOSE) {
              process.stderr.write(
                `[anthropic] Failed to parse SSE data (event: ${currentEventType}): ${data}\n`,
              );
            }
          }
          currentEventType = null;
          continue;
        }

        if (line.trim() === "") {
          currentEventType = null;
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

/**
 * Anthropic Claude API provider.
 * Directly calls the Anthropic Messages API using fetch (no SDK dependency).
 */
export class AnthropicProvider implements LLMProvider {
  readonly name = "anthropic";
  private readonly apiKey: string;
  private readonly baseURL: string;
  private readonly timeout: number;

  constructor(config: AnthropicProviderConfig = {}) {
    const apiKey = config.apiKey ?? process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new LLMError(
        "ANTHROPIC_API_KEY is required. Set it via environment variable or provider config.",
      );
    }
    this.apiKey = apiKey;
    this.baseURL = config.baseURL ?? ANTHROPIC_API_URL;
    this.timeout = config.timeout ?? 120_000;
  }

  async chat(request: ChatRequest): Promise<ChatResponse> {
    for (let attempt = 0; ; attempt++) {
      try {
        return await this._chatOnce(request);
      } catch (error) {
        if (error instanceof LLMError) {
          const status = error.context.status as number | undefined;
          if (!status || !isRetryableStatus(status)) throw error;

          const limit = isRateLimitStatus(status) ? MAX_RETRIES_RATE_LIMIT : MAX_RETRIES_TRANSIENT;
          if (attempt >= limit) throw error;

          const delay = isRateLimitStatus(status)
            ? Math.min(BASE_RATE_LIMIT_DELAY_MS * Math.pow(2, attempt), MAX_RATE_LIMIT_DELAY_MS)
            : BASE_RETRY_DELAY_MS * Math.pow(2, attempt);
          await sleep(delay);
        } else {
          throw error;
        }
      }
    }
  }

  private async _chatOnce(request: ChatRequest): Promise<ChatResponse> {
    const { system, messages } = extractSystemAndMessages(request.messages);

    const body = this._buildRequestBody(request, system, messages);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    if (request.signal) {
      request.signal.addEventListener("abort", () => controller.abort(), { once: true });
    }

    let response: Response;
    try {
      response = await fetch(this.baseURL, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-api-key": this.apiKey,
          "anthropic-version": ANTHROPIC_VERSION,
          "anthropic-beta": "prompt-caching-2024-07-31",
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
    } catch (error) {
      clearTimeout(timeoutId);
      if (error instanceof Error && error.name === "AbortError") {
        throw new LLMError("Request timed out or was aborted.", { model: request.model });
      }
      throw new LLMError("Failed to connect to Anthropic API.", {
        model: request.model,
        cause: error instanceof Error ? error.message : String(error),
      });
    } finally {
      clearTimeout(timeoutId);
    }

    if (!response.ok) {
      const errorBody = await response.text();
      throw classifyHttpError(response.status, errorBody, request.model);
    }

    const data = (await response.json()) as AnthropicResponse;
    return this._parseResponse(data);
  }

  private _parseResponse(data: AnthropicResponse): ChatResponse {
    let textContent = "";
    let thinkingContent = "";
    const toolCalls: ToolCallRequest[] = [];

    for (const block of data.content) {
      if (block.type === "text") {
        textContent += block.text;
      } else if (block.type === "thinking") {
        thinkingContent += block.thinking;
      } else if (block.type === "tool_use") {
        toolCalls.push({
          id: block.id,
          name: block.name,
          arguments: JSON.stringify(block.input),
        });
      }
    }

    return {
      content: textContent,
      toolCalls,
      usage: {
        promptTokens: data.usage.input_tokens,
        completionTokens: data.usage.output_tokens,
        totalTokens: data.usage.input_tokens + data.usage.output_tokens,
      },
      finishReason: mapStopReason(data.stop_reason),
      ...(thinkingContent ? { thinking: thinkingContent } : {}),
    };
  }

  async *stream(request: ChatRequest): AsyncIterable<ChatChunk> {
    for (let attempt = 0; ; attempt++) {
      try {
        yield* this._streamOnce(request);
        return;
      } catch (error) {
        if (error instanceof LLMError) {
          const status = error.context.status as number | undefined;
          if (!status || !isRetryableStatus(status)) throw error;

          const limit = isRateLimitStatus(status) ? MAX_RETRIES_RATE_LIMIT : MAX_RETRIES_TRANSIENT;
          if (attempt >= limit) throw error;

          const delay = isRateLimitStatus(status)
            ? Math.min(BASE_RATE_LIMIT_DELAY_MS * Math.pow(2, attempt), MAX_RATE_LIMIT_DELAY_MS)
            : BASE_RETRY_DELAY_MS * Math.pow(2, attempt);
          await sleep(delay);
        } else {
          throw error;
        }
      }
    }
  }

  private async *_streamOnce(request: ChatRequest): AsyncIterable<ChatChunk> {
    const { system, messages } = extractSystemAndMessages(request.messages);

    const body = this._buildRequestBody(request, system, messages);
    body.stream = true;

    const controller = new AbortController();
    let idleTimeoutId: ReturnType<typeof setTimeout> | undefined = setTimeout(
      () => controller.abort(),
      this.timeout,
    );

    /** Reset the idle timeout — called on each received SSE chunk */
    const resetIdleTimeout = (): void => {
      if (idleTimeoutId !== undefined) {
        clearTimeout(idleTimeoutId);
      }
      idleTimeoutId = setTimeout(() => controller.abort(), this.timeout);
    };

    if (request.signal) {
      request.signal.addEventListener("abort", () => controller.abort(), { once: true });
    }

    let response: Response;
    try {
      response = await fetch(this.baseURL, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-api-key": this.apiKey,
          "anthropic-version": ANTHROPIC_VERSION,
          "anthropic-beta": "prompt-caching-2024-07-31",
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
    } catch (error) {
      clearTimeout(idleTimeoutId);
      if (error instanceof Error && error.name === "AbortError") {
        throw new LLMError("Request timed out or was aborted.", { model: request.model });
      }
      throw new LLMError("Failed to connect to Anthropic API.", {
        model: request.model,
        cause: error instanceof Error ? error.message : String(error),
      });
    }

    // Don't clear timeout yet — stream is ongoing
    if (!response.ok) {
      clearTimeout(idleTimeoutId);
      const errorBody = await response.text();
      throw classifyHttpError(response.status, errorBody, request.model);
    }

    if (!response.body) {
      clearTimeout(idleTimeoutId);
      throw new LLMError("No response body from Anthropic streaming API.", {
        model: request.model,
      });
    }

    // Track tool calls and thinking blocks being assembled during streaming
    const toolCallsInProgress = new Map<number, { id: string; name: string; arguments: string }>();
    const thinkingBlocks = new Set<number>();

    let inputTokens = 0;
    let outputTokens = 0;

    try {
      for await (const event of parseSSEStream(response.body, request.signal)) {
        resetIdleTimeout();
        switch (event.type) {
          case "message_start": {
            inputTokens = event.message.usage.input_tokens;
            break;
          }

          case "content_block_start": {
            if (event.content_block.type === "tool_use") {
              toolCallsInProgress.set(event.index, {
                id: event.content_block.id,
                name: event.content_block.name,
                arguments: "",
              });
              yield {
                type: "tool-call-delta",
                toolCall: {
                  id: event.content_block.id,
                  name: event.content_block.name,
                  arguments: "",
                },
              };
            } else if (event.content_block.type === "thinking") {
              thinkingBlocks.add(event.index);
            }
            break;
          }

          case "content_block_delta": {
            if (event.delta.type === "text_delta") {
              yield { type: "text-delta", text: event.delta.text };
            } else if (event.delta.type === "thinking_delta") {
              yield { type: "thinking-delta", thinking_delta: event.delta.thinking };
            } else if (event.delta.type === "input_json_delta") {
              const existing = toolCallsInProgress.get(event.index);
              if (existing) {
                existing.arguments += event.delta.partial_json;
                yield {
                  type: "tool-call-delta",
                  toolCall: {
                    id: existing.id,
                    name: existing.name,
                    arguments: event.delta.partial_json,
                  },
                };
              }
            }
            break;
          }

          case "message_delta": {
            outputTokens += event.usage.output_tokens;
            break;
          }

          case "message_stop": {
            // Stream complete
            break;
          }
        }
      }
    } finally {
      clearTimeout(idleTimeoutId);
    }

    yield {
      type: "done",
      usage: {
        promptTokens: inputTokens,
        completionTokens: outputTokens,
        totalTokens: inputTokens + outputTokens,
      },
    };
  }

  private _buildRequestBody(
    request: ChatRequest,
    system: string | undefined,
    messages: Array<Record<string, unknown>>,
  ): Record<string, unknown> {
    const body: Record<string, unknown> = {
      model: request.model,
      messages,
      max_tokens: request.maxTokens ?? 4096,
    };

    if (system) {
      // Split system prompt for caching — static parts get cache_control
      body.system = this.buildCachableSystemBlocks(system);
    }
    if (request.temperature !== undefined) {
      body.temperature = request.temperature;
    }
    if (request.tools && request.tools.length > 0) {
      body.tools = toAnthropicTools(request.tools);
    }
    if (request.thinking) {
      body.thinking = request.thinking;
    }

    return body;
  }

  /**
   * Convert system prompt string to Anthropic cache-friendly block format.
   * Sections separated by "---" are split into blocks.
   * All blocks except dynamic ones get cache_control for caching.
   */
  private buildCachableSystemBlocks(
    system: string,
  ): Array<{ type: "text"; text: string; cache_control?: { type: "ephemeral" } }> {
    const parts = system.split("\n\n---\n\n").filter((p) => p.trim().length > 0);

    if (parts.length <= 1) {
      // Single block — cache the whole thing
      return [{ type: "text", text: system, cache_control: { type: "ephemeral" } }];
    }

    // Dynamic section prefixes (change between requests)
    const dynamicPrefixes = ["# Environment"];

    const blocks: Array<{ type: "text"; text: string; cache_control?: { type: "ephemeral" } }> =
      [];
    let staticBuffer = "";

    for (const part of parts) {
      const isDynamic = dynamicPrefixes.some((prefix) => part.trimStart().startsWith(prefix));

      if (isDynamic) {
        if (staticBuffer) {
          blocks.push({
            type: "text",
            text: staticBuffer.trim(),
            cache_control: { type: "ephemeral" },
          });
          staticBuffer = "";
        }
        blocks.push({ type: "text", text: part.trim() });
      } else {
        staticBuffer += (staticBuffer ? "\n\n---\n\n" : "") + part;
      }
    }

    if (staticBuffer) {
      blocks.push({
        type: "text",
        text: staticBuffer.trim(),
        cache_control: { type: "ephemeral" },
      });
    }

    return blocks;
  }

  countTokens(text: string): number {
    // Approximate: ~4 chars per token for Claude models
    return Math.ceil(text.length / 4);
  }
}
