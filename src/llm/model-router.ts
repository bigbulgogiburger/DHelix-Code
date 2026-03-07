import {
  type LLMProvider,
  type ChatRequest,
  type ChatResponse,
  type ChatChunk,
} from "./provider.js";
import { LLMError } from "../utils/error.js";
import { AnthropicProvider } from "./providers/anthropic.js";
import { OpenAICompatibleClient } from "./client.js";

/** Model routing configuration */
export interface ModelRouterConfig {
  /** Primary model provider */
  readonly primary: LLMProvider;
  /** Primary model name */
  readonly primaryModel: string;
  /** Fallback model provider (optional — can be the same provider with different model) */
  readonly fallback?: LLMProvider;
  /** Fallback model name */
  readonly fallbackModel?: string;
  /** Maximum retries before switching to fallback */
  readonly maxRetries?: number;
  /** Delay between retries in ms */
  readonly retryDelayMs?: number;
  /** Complexity threshold for routing (token count) */
  readonly complexityThreshold?: number;
}

/** Error classification for retry/fallback decisions */
type ErrorClass = "transient" | "overload" | "auth" | "permanent";

/**
 * Classify an error to determine retry/fallback behavior.
 */
function classifyError(error: unknown): ErrorClass {
  if (!(error instanceof Error)) return "permanent";

  const message = error.message.toLowerCase();

  // Rate limit / overload
  if (
    message.includes("rate limit") ||
    message.includes("429") ||
    message.includes("overload") ||
    message.includes("503") ||
    message.includes("capacity")
  ) {
    return "overload";
  }

  // Transient network errors
  if (
    message.includes("timeout") ||
    message.includes("econnreset") ||
    message.includes("econnrefused") ||
    message.includes("500") ||
    message.includes("502") ||
    message.includes("504") ||
    message.includes("network")
  ) {
    return "transient";
  }

  // Auth errors — don't retry
  if (
    message.includes("401") ||
    message.includes("403") ||
    message.includes("unauthorized") ||
    message.includes("forbidden")
  ) {
    return "auth";
  }

  return "permanent";
}

/**
 * Sleep for a specified number of milliseconds.
 */
function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new LLMError("Request aborted"));
      return;
    }

    const timer = setTimeout(resolve, ms);
    signal?.addEventListener("abort", () => {
      clearTimeout(timer);
      reject(new LLMError("Request aborted"));
    });
  });
}

/**
 * Model router — provides hybrid routing, retry logic, and fallback model switching.
 *
 * Features:
 * - Retry transient/overload errors with exponential backoff
 * - Auto-switch to fallback model on persistent failures
 * - Classify errors to determine appropriate action
 */
export class ModelRouter implements LLMProvider {
  readonly name = "model-router";
  private readonly primary: LLMProvider;
  private readonly primaryModel: string;
  private readonly fallback: LLMProvider | undefined;
  private readonly fallbackModel: string | undefined;
  private readonly maxRetries: number;
  private readonly retryDelayMs: number;

  private usingFallback = false;

  constructor(config: ModelRouterConfig) {
    this.primary = config.primary;
    this.primaryModel = config.primaryModel;
    this.fallback = config.fallback;
    this.fallbackModel = config.fallbackModel;
    this.maxRetries = config.maxRetries ?? 3;
    this.retryDelayMs = config.retryDelayMs ?? 1000;
  }

  /** Get the currently active model name */
  get activeModel(): string {
    return this.usingFallback && this.fallbackModel ? this.fallbackModel : this.primaryModel;
  }

  /** Get the currently active provider */
  private get activeProvider(): LLMProvider {
    return this.usingFallback && this.fallback ? this.fallback : this.primary;
  }

  /** Check if currently using fallback */
  get isUsingFallback(): boolean {
    return this.usingFallback;
  }

  /** Switch back to primary model */
  resetToPrimary(): void {
    this.usingFallback = false;
  }

  /** Force switch to fallback model */
  switchToFallback(): void {
    if (!this.fallback || !this.fallbackModel) {
      throw new LLMError("No fallback model configured");
    }
    this.usingFallback = true;
  }

  async chat(request: ChatRequest): Promise<ChatResponse> {
    const activeRequest: ChatRequest = {
      ...request,
      model: this.activeModel,
    };

    // Try with retries
    let lastError: unknown;
    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        return await this.activeProvider.chat(activeRequest);
      } catch (error) {
        lastError = error;
        const errorClass = classifyError(error);

        // Don't retry auth or permanent errors
        if (errorClass === "auth" || errorClass === "permanent") {
          break;
        }

        // On overload, try fallback immediately
        if (errorClass === "overload" && this.canSwitchToFallback()) {
          this.usingFallback = true;
          return this.fallback!.chat({
            ...request,
            model: this.fallbackModel!,
          });
        }

        // Transient: retry with exponential backoff
        if (attempt < this.maxRetries) {
          const delay = this.retryDelayMs * Math.pow(2, attempt);
          await sleep(delay, request.signal);
        }
      }
    }

    // All retries exhausted — try fallback
    if (this.canSwitchToFallback() && !this.usingFallback) {
      this.usingFallback = true;
      try {
        return await this.fallback!.chat({
          ...request,
          model: this.fallbackModel!,
        });
      } catch (fallbackError) {
        throw new LLMError("Both primary and fallback models failed", {
          primaryError: lastError instanceof Error ? lastError.message : String(lastError),
          fallbackError:
            fallbackError instanceof Error ? fallbackError.message : String(fallbackError),
        });
      }
    }

    throw lastError instanceof LLMError
      ? lastError
      : new LLMError("LLM request failed after retries", {
          cause: lastError instanceof Error ? lastError.message : String(lastError),
          attempts: this.maxRetries + 1,
        });
  }

  async *stream(request: ChatRequest): AsyncIterable<ChatChunk> {
    const activeRequest: ChatRequest = {
      ...request,
      model: this.activeModel,
    };

    try {
      yield* this.activeProvider.stream(activeRequest);
    } catch (error) {
      const errorClass = classifyError(error);

      // Try fallback for overload/transient
      if (
        (errorClass === "overload" || errorClass === "transient") &&
        this.canSwitchToFallback() &&
        !this.usingFallback
      ) {
        this.usingFallback = true;
        yield* this.fallback!.stream({
          ...request,
          model: this.fallbackModel!,
        });
        return;
      }

      throw error;
    }
  }

  countTokens(text: string): number {
    return this.activeProvider.countTokens(text);
  }

  /** Check if fallback is available and not already in use */
  private canSwitchToFallback(): boolean {
    return !!this.fallback && !!this.fallbackModel && !this.usingFallback;
  }
}

/** Options for provider resolution */
export interface ResolveProviderOptions {
  readonly baseUrl?: string;
  readonly apiKey?: string;
}

/**
 * Resolve the appropriate LLM provider based on model name.
 *
 * Routing rules:
 * - "claude-*" → AnthropicProvider (direct Anthropic API)
 * - "gpt-*", "o1-*", "o3-*" → OpenAICompatibleClient (OpenAI API)
 * - Everything else → OpenAICompatibleClient with custom baseURL
 */
export function resolveProvider(modelName: string, opts: ResolveProviderOptions = {}): LLMProvider {
  if (modelName.startsWith("claude-")) {
    return new AnthropicProvider({
      apiKey: opts.apiKey,
      baseURL: opts.baseUrl,
    });
  }

  if (
    modelName.startsWith("gpt-") ||
    modelName.startsWith("o1-") ||
    modelName.startsWith("o3-")
  ) {
    return new OpenAICompatibleClient({
      baseURL: opts.baseUrl ?? "https://api.openai.com/v1",
      apiKey: opts.apiKey ?? process.env.OPENAI_API_KEY,
    });
  }

  // Default: OpenAI-compatible with custom base URL (Ollama, vLLM, etc.)
  return new OpenAICompatibleClient({
    baseURL: opts.baseUrl ?? "http://localhost:11434/v1",
    apiKey: opts.apiKey,
  });
}
