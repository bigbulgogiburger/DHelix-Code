/**
 * Azure OpenAI Responses API client.
 *
 * Used for models that only support the Responses API (e.g., gpt-5.x-codex variants).
 * Implements LLMProvider with direct fetch calls since OpenAI SDK v4.x lacks responses support.
 *
 * Docs: https://learn.microsoft.com/en-us/azure/foundry/openai/how-to/responses
 */
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

/** Maximum retries for transient errors (500, 502, 503, 504, timeout, connection) */
const MAX_RETRIES_TRANSIENT = 3;

/** Maximum retries for rate limit errors (429) */
const MAX_RETRIES_RATE_LIMIT = 5;

/** Base delay between retries for transient errors in ms */
const BASE_RETRY_DELAY_MS = 1_000;

/** Base delay between retries for rate limit errors in ms */
const BASE_RATE_LIMIT_DELAY_MS = 5_000;

/** Maximum delay cap for rate limit backoff in ms (60s) */
const MAX_RATE_LIMIT_DELAY_MS = 60_000;

/** Configuration for Responses API client */
export interface ResponsesClientConfig {
  readonly baseURL: string;
  readonly apiKey?: string;
  readonly timeout?: number;
}

/**
 * Check if a model requires the Responses API (not Chat Completions).
 * Codex variants (gpt-5-codex, gpt-5.1-codex-mini, etc.) only support Responses API.
 */
export function isResponsesOnlyModel(model: string): boolean {
  return /^gpt-5(\.\d+)?-codex/i.test(model);
}

/**
 * Build the Responses API endpoint URL from the configured base URL.
 *
 * Handles both URL formats:
 * - Legacy: https://resource.cognitiveservices.azure.com/openai/responses?api-version=...
 * - v1:     https://resource.openai.azure.com/openai/v1/responses
 */
function buildResponsesEndpoint(baseURL: string): {
  endpoint: string;
  isAzure: boolean;
} {
  const isAzure =
    baseURL.includes(".openai.azure.com") || baseURL.includes(".cognitiveservices.azure.com");

  const urlObj = new URL(baseURL);
  const apiVersion = urlObj.searchParams.get("api-version") ?? undefined;

  // Clean the path — strip known endpoint suffixes
  let cleanPath = urlObj.pathname;
  cleanPath = cleanPath.replace(/\/(responses|chat\/completions|completions)\/?$/, "");
  cleanPath = cleanPath.replace(/\/deployments\/[^/]+(\/.*)?$/, "");
  cleanPath = cleanPath.replace(/\/$/, "");

  // Build the full responses endpoint
  const query = apiVersion ? `?api-version=${apiVersion}` : "";
  const endpoint = `${urlObj.protocol}//${urlObj.host}${cleanPath}/responses${query}`;

  return { endpoint, isAzure };
}

/** Extract system messages → Responses API `instructions` parameter */
function extractInstructions(messages: readonly ChatMessage[]): string | undefined {
  const systemMessages = messages.filter((m) => m.role === "system");
  if (systemMessages.length === 0) return undefined;
  return systemMessages.map((m) => m.content).join("\n\n");
}

/**
 * Convert our ChatMessage[] to Responses API input format.
 *
 * Mapping:
 * - system  → instructions param (extracted separately)
 * - user    → { role: "user", content: "..." }
 * - assistant (text only)     → { type: "message", role: "assistant", content: [{type: "output_text", text}] }
 * - assistant (with tools)    → function_call items
 * - tool result               → { type: "function_call_output", call_id, output }
 */
function toResponsesInput(messages: readonly ChatMessage[]): unknown[] {
  const input: unknown[] = [];

  for (const msg of messages) {
    if (msg.role === "system") continue;

    if (msg.role === "user") {
      input.push({ role: "user", content: msg.content });
      continue;
    }

    if (msg.role === "assistant") {
      // Text content
      if (msg.content && (!msg.toolCalls || msg.toolCalls.length === 0)) {
        input.push({
          type: "message",
          role: "assistant",
          content: [{ type: "output_text", text: msg.content }],
        });
      }
      // Tool calls
      if (msg.toolCalls && msg.toolCalls.length > 0) {
        if (msg.content) {
          input.push({
            type: "message",
            role: "assistant",
            content: [{ type: "output_text", text: msg.content }],
          });
        }
        for (const tc of msg.toolCalls) {
          input.push({
            type: "function_call",
            call_id: tc.id,
            name: tc.name,
            arguments: tc.arguments,
          });
        }
      }
      continue;
    }

    if (msg.role === "tool") {
      input.push({
        type: "function_call_output",
        call_id: msg.toolCallId ?? "",
        output: msg.content,
      });
    }
  }

  return input;
}

/** Convert our tool definitions to Responses API format */
function toResponsesTools(tools: readonly ToolDefinitionForLLM[]): unknown[] {
  return tools.map((t) => ({
    type: "function",
    name: t.function.name,
    description: t.function.description,
    parameters: t.function.parameters,
  }));
}

/** Responses API response shape */
interface ResponsesAPIResponse {
  readonly id: string;
  readonly model: string;
  readonly output: ReadonlyArray<{
    readonly type: string;
    readonly id?: string;
    readonly call_id?: string;
    readonly name?: string;
    readonly arguments?: string;
    readonly role?: string;
    readonly content?: ReadonlyArray<{
      readonly type: string;
      readonly text?: string;
    }>;
  }>;
  readonly output_text?: string;
  readonly usage?: {
    readonly input_tokens: number;
    readonly output_tokens: number;
    readonly total_tokens: number;
  };
  readonly status?: string;
}

/** Convert Responses API output to our ChatResponse */
function fromResponsesOutput(result: ResponsesAPIResponse): ChatResponse {
  let content = result.output_text ?? "";
  const toolCalls: ToolCallRequest[] = [];

  for (const item of result.output) {
    if (item.type === "message" && item.content) {
      for (const c of item.content) {
        if (c.type === "output_text" && c.text && !content) {
          content = c.text;
        }
      }
    }
    if (item.type === "function_call") {
      toolCalls.push({
        id: item.call_id ?? item.id ?? "",
        name: item.name ?? "",
        arguments: item.arguments ?? "",
      });
    }
  }

  return {
    content,
    toolCalls,
    usage: {
      promptTokens: result.usage?.input_tokens ?? 0,
      completionTokens: result.usage?.output_tokens ?? 0,
      totalTokens: result.usage?.total_tokens ?? 0,
    },
    finishReason: result.status === "completed" ? "stop" : (result.status ?? "stop"),
  };
}

/** Check if an HTTP status code is retryable (transient or rate limit) */
function isRetryableStatus(status: number): boolean {
  return status === 429 || status === 500 || status === 502 || status === 503 || status === 504;
}

/** Check if a status is a rate limit error */
function isRateLimitStatus(status: number): boolean {
  return status === 429;
}

/** Check if an error is a transient network/connection error (no HTTP status) */
function isTransientNetworkError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const msg = error.message.toLowerCase();
  return (
    error.name === "AbortError" ||
    msg.includes("econnreset") ||
    msg.includes("econnrefused") ||
    msg.includes("etimedout") ||
    msg.includes("fetch failed") ||
    msg.includes("network")
  );
}

/** Sleep for the given number of milliseconds */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Add jitter of +/-20% to a delay value to prevent thundering herd */
function addJitter(delayMs: number): number {
  const jitter = delayMs * 0.2 * (2 * Math.random() - 1);
  return Math.max(0, Math.round(delayMs + jitter));
}

/** Get retry delay, honoring Retry-After header for rate limit responses */
function getRetryDelay(
  status: number | undefined,
  attempt: number,
  retryAfterHeader?: string | null,
): number {
  // Honor Retry-After header if present
  if (retryAfterHeader) {
    const seconds = Number(retryAfterHeader);
    if (!Number.isNaN(seconds) && seconds > 0) {
      return addJitter(seconds * 1_000);
    }
  }
  // Rate limit: longer backoff (5s, 10s, 20s, 40s, 60s cap)
  if (status !== undefined && isRateLimitStatus(status)) {
    return addJitter(
      Math.min(BASE_RATE_LIMIT_DELAY_MS * Math.pow(2, attempt), MAX_RATE_LIMIT_DELAY_MS),
    );
  }
  // Transient: standard backoff (1s, 2s, 4s)
  return addJitter(BASE_RETRY_DELAY_MS * Math.pow(2, attempt));
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
    return new LLMError("Authentication failed. Check your API key.", {
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
  if (status === 404) {
    return new LLMError("Model or endpoint not found. Check your baseURL and model name.", {
      model,
      cause: detail,
      status,
    });
  }
  if (status === 429) {
    return new LLMError("Rate limit exceeded. Please wait before retrying.", {
      model,
      cause: detail,
      status,
    });
  }

  return new LLMError(`Responses API error (${status}): ${detail}`, {
    model,
    cause: detail,
    status,
  });
}

/**
 * Responses API client — for models that require the Responses API (codex variants).
 * Uses direct fetch calls with SSE parsing for streaming.
 * Includes automatic retries for transient/rate-limit errors with exponential backoff + jitter.
 */
export class ResponsesAPIClient implements LLMProvider {
  readonly name = "azure-responses";
  private readonly endpoint: string;
  private readonly apiKey: string;
  private readonly isAzure: boolean;
  private readonly timeout: number;

  constructor(config: ResponsesClientConfig) {
    const { endpoint, isAzure } = buildResponsesEndpoint(config.baseURL);
    this.endpoint = endpoint;
    this.apiKey = config.apiKey ?? "no-key-required";
    this.isAzure = isAzure;
    this.timeout = config.timeout ?? 120_000;
  }

  private getHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (this.isAzure) {
      headers["api-key"] = this.apiKey;
    } else {
      headers["Authorization"] = `Bearer ${this.apiKey}`;
    }
    return headers;
  }

  private buildBody(request: ChatRequest, stream: boolean): Record<string, unknown> {
    const instructions = extractInstructions(request.messages);
    const input = toResponsesInput(request.messages);

    const body: Record<string, unknown> = {
      model: request.model,
      input,
    };
    if (instructions) body.instructions = instructions;
    if (request.maxTokens) body.max_output_tokens = request.maxTokens;
    if (request.tools && request.tools.length > 0) {
      body.tools = toResponsesTools(request.tools);
    }
    if (stream) body.stream = true;
    return body;
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

          const retryAfter = error.context.retryAfterHeader as string | undefined;
          const delay = getRetryDelay(status, attempt, retryAfter);
          await sleep(delay);
        } else if (isTransientNetworkError(error)) {
          if (attempt >= MAX_RETRIES_TRANSIENT) {
            throw new LLMError("Failed to connect to Responses API after retries.", {
              model: request.model,
              cause: error instanceof Error ? error.message : String(error),
            });
          }
          const delay = getRetryDelay(undefined, attempt);
          await sleep(delay);
        } else {
          throw error;
        }
      }
    }
  }

  private async _chatOnce(request: ChatRequest): Promise<ChatResponse> {
    const body = this.buildBody(request, false);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    if (request.signal) {
      request.signal.addEventListener("abort", () => controller.abort(), { once: true });
    }

    let response: Response;
    try {
      response = await fetch(this.endpoint, {
        method: "POST",
        headers: this.getHeaders(),
        body: JSON.stringify(body),
        signal: controller.signal,
      });
    } catch (error) {
      clearTimeout(timeoutId);
      if (error instanceof Error && error.name === "AbortError") {
        throw new LLMError("Request timed out or was aborted.", { model: request.model });
      }
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }

    if (!response.ok) {
      const errorBody = await response.text().catch(() => "");
      const retryAfterHeader = response.headers.get("retry-after");
      const llmError = classifyHttpError(response.status, errorBody, request.model);
      if (retryAfterHeader) {
        throw new LLMError(llmError.message, { ...llmError.context, retryAfterHeader });
      }
      throw llmError;
    }

    const result = (await response.json()) as ResponsesAPIResponse;
    return fromResponsesOutput(result);
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

          const retryAfter = error.context.retryAfterHeader as string | undefined;
          const delay = getRetryDelay(status, attempt, retryAfter);
          await sleep(delay);
        } else if (isTransientNetworkError(error)) {
          if (attempt >= MAX_RETRIES_TRANSIENT) {
            throw new LLMError("Failed to connect to Responses API stream after retries.", {
              model: request.model,
              cause: error instanceof Error ? error.message : String(error),
            });
          }
          const delay = getRetryDelay(undefined, attempt);
          await sleep(delay);
        } else {
          throw error;
        }
      }
    }
  }

  private async *_streamOnce(request: ChatRequest): AsyncIterable<ChatChunk> {
    const body = this.buildBody(request, true);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    if (request.signal) {
      request.signal.addEventListener("abort", () => controller.abort(), { once: true });
    }

    let response: Response;
    try {
      response = await fetch(this.endpoint, {
        method: "POST",
        headers: this.getHeaders(),
        body: JSON.stringify(body),
        signal: controller.signal,
      });
    } catch (error) {
      clearTimeout(timeoutId);
      if (error instanceof Error && error.name === "AbortError") {
        throw new LLMError("Request timed out or was aborted.", { model: request.model });
      }
      throw error;
    }

    if (!response.ok) {
      clearTimeout(timeoutId);
      const errorBody = await response.text().catch(() => "");
      const retryAfterHeader = response.headers.get("retry-after");
      const llmError = classifyHttpError(response.status, errorBody, request.model);
      if (retryAfterHeader) {
        throw new LLMError(llmError.message, { ...llmError.context, retryAfterHeader });
      }
      throw llmError;
    }

    if (!response.body) {
      clearTimeout(timeoutId);
      throw new LLMError("No response body for streaming", { model: request.model });
    }

    try {
      yield* this.parseSSEStream(response.body);
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /** Parse SSE stream from the Responses API */
  private async *parseSSEStream(body: ReadableStream<Uint8Array>): AsyncIterable<ChatChunk> {
    const reader = body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    // Track function calls being assembled incrementally
    const functionCalls = new Map<string, { id: string; name: string; arguments: string }>();
    let finalUsage:
      | { promptTokens: number; completionTokens: number; totalTokens: number }
      | undefined;

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        // Process complete lines
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        let eventType = "";
        for (const line of lines) {
          if (line.startsWith("event: ")) {
            eventType = line.slice(7).trim();
          } else if (line.startsWith("data: ")) {
            const data = line.slice(6);
            if (data === "[DONE]") {
              yield { type: "done", usage: finalUsage };
              return;
            }

            let parsed: Record<string, unknown>;
            try {
              parsed = JSON.parse(data) as Record<string, unknown>;
            } catch {
              continue;
            }

            const evtType = eventType || (parsed.type as string) || "";

            // Text delta
            if (evtType === "response.output_text.delta") {
              const delta = parsed.delta as string | undefined;
              if (delta) {
                yield { type: "text-delta", text: delta };
              }
            }

            // Function call: new item added — capture name and call_id
            // Key by item.id (used in delta events as item_id), store call_id as the real ID
            if (evtType === "response.output_item.added") {
              const item = parsed.item as Record<string, unknown> | undefined;
              if (item?.type === "function_call") {
                const itemId = (item.id ?? "") as string;
                const callId = (item.call_id ?? item.id ?? "") as string;
                functionCalls.set(itemId, {
                  id: callId,
                  name: (item.name ?? "") as string,
                  arguments: "",
                });
              }
            }

            // Function call arguments delta
            // Delta events reference item_id (= item.id), not call_id
            if (evtType === "response.function_call_arguments.delta") {
              const itemId = (parsed.item_id ?? parsed.call_id ?? "") as string;
              const argDelta = (parsed.delta ?? "") as string;
              const existing = functionCalls.get(itemId);
              if (existing) {
                existing.arguments += argDelta;
              } else {
                functionCalls.set(itemId, {
                  id: itemId,
                  name: (parsed.name ?? "") as string,
                  arguments: argDelta,
                });
              }
              yield {
                type: "tool-call-delta",
                toolCall: {
                  id: existing?.id ?? itemId,
                  name: existing?.name ?? (parsed.name as string) ?? "",
                  arguments: argDelta,
                },
              };
            }

            // Response completed — extract usage
            if (evtType === "response.completed") {
              const resp = parsed.response as Record<string, unknown> | undefined;
              const usage = resp?.usage as Record<string, number> | undefined;
              if (usage) {
                finalUsage = {
                  promptTokens: usage.input_tokens ?? 0,
                  completionTokens: usage.output_tokens ?? 0,
                  totalTokens: usage.total_tokens ?? 0,
                };
              }
            }

            eventType = "";
          } else if (line.trim() === "") {
            // Empty line resets event type (SSE spec)
            eventType = "";
          }
        }
      }
    } finally {
      reader.releaseLock();
    }

    yield { type: "done", usage: finalUsage };
  }

  countTokens(text: string): number {
    return countTokens(text);
  }
}
