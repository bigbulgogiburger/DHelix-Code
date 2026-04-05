/**
 * Google Gemini API 프로바이더 — Gemini 모델과 OpenAI 호환 엔드포인트로 통신하는 클라이언트
 *
 * Google AI Studio의 OpenAI 호환 엔드포인트를 활용하여
 * Gemini 2.5 Pro, 2.5 Flash, 2.0 Flash 모델과 통신합니다.
 *
 * 주요 기능:
 * - OpenAI 호환 Chat Completions API (비스트리밍/스트리밍)
 * - SSE(Server-Sent Events) 스트림 파싱
 * - 도구 호출 (function calling) 지원
 * - 자동 재시도 (일시적 에러 + Rate Limit)
 * - 스트리밍 유휴 타임아웃
 *
 * API 키 우선순위: DHELIX_GOOGLE_API_KEY → GOOGLE_API_KEY → GEMINI_API_KEY
 * Base URL: https://generativelanguage.googleapis.com/v1beta/openai
 */
import type {
  ChatRequest,
  ChatResponse,
  ChatChunk,
  ChatMessage,
  ToolCallRequest,
  ToolDefinitionForLLM,
} from "../provider.js";
import type {
  UnifiedLLMProvider,
  ProviderManifest,
  ProviderHealthStatus,
  CostEstimate,
} from "./types.js";
import type { TokenUsage } from "../provider.js";
import { LLMError } from "../../utils/error.js";
import { countTokens } from "../token-counter.js";

// ─── API 상수 ────────────────────────────────────────────────────────

/** Google AI Studio OpenAI 호환 기본 엔드포인트 */
const GEMINI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta/openai";

// ─── 재시도 관련 상수 ────────────────────────────────────────────────

/** 일시적 에러(500, 502, 503)에 대한 최대 재시도 횟수 */
const MAX_RETRIES_TRANSIENT = 3;

/** Rate Limit(429) 에러에 대한 최대 재시도 횟수 */
const MAX_RETRIES_RATE_LIMIT = 5;

/** 일시적 에러 재시도 시 기본 대기 시간 (1초) */
const BASE_RETRY_DELAY_MS = 1_000;

/** Rate Limit 에러 재시도 시 기본 대기 시간 (5초) */
const BASE_RATE_LIMIT_DELAY_MS = 5_000;

/** Rate Limit 백오프 최대 대기 시간 (60초) */
const MAX_RATE_LIMIT_DELAY_MS = 60_000;

/** 스트리밍 청크 간 타임아웃 (30초) */
const STREAM_CHUNK_TIMEOUT_MS = 30_000;

// ─── 매니페스트 ──────────────────────────────────────────────────────

/**
 * Google Gemini 프로바이더 매니페스트
 *
 * Gemini 2.5 Pro, 2.5 Flash, 2.0 Flash 모델의 메타데이터와 기능을 정의합니다.
 * 가격은 100만 토큰당 USD 기준입니다.
 */
export const GOOGLE_GEMINI_MANIFEST: ProviderManifest = {
  id: "google-gemini",
  displayName: "Google Gemini",
  authType: "api-key",
  modelPatterns: [/^gemini-/i],
  models: [
    {
      id: "gemini-2.5-pro",
      tier: "high",
      context: 1_000_000,
      pricing: { input: 1.25, output: 10 },
    },
    {
      id: "gemini-2.5-flash",
      tier: "medium",
      context: 1_000_000,
      pricing: { input: 0.15, output: 0.6 },
    },
    {
      id: "gemini-2.0-flash",
      tier: "low",
      context: 1_000_000,
      pricing: { input: 0.1, output: 0.4 },
    },
  ],
  features: {
    supportsCaching: false,
    supportsGrounding: true,
    supportsImageInput: true,
    supportsReasoningTrace: true,
    maxConcurrentRequests: 50,
    rateLimitStrategy: "token-bucket",
  },
};

// ─── API 키 조회 ─────────────────────────────────────────────────────

/**
 * Google Gemini API 키를 환경변수에서 조회
 *
 * 우선순위: DHELIX_GOOGLE_API_KEY → GOOGLE_API_KEY → GEMINI_API_KEY
 *
 * @returns API 키 또는 undefined
 */
export function resolveGeminiApiKey(): string | undefined {
  const keys = [
    "DHELIX_GOOGLE_API_KEY",
    "GOOGLE_API_KEY",
    "GEMINI_API_KEY",
  ] as const;

  for (const key of keys) {
    const value = process.env[key];
    if (value) return value;
  }
  return undefined;
}

// ─── 메시지 변환 ─────────────────────────────────────────────────────

/** OpenAI 호환 메시지 형식 */
interface OpenAIMessage {
  readonly role: "system" | "user" | "assistant" | "tool";
  readonly content: string | null;
  readonly name?: string;
  readonly tool_call_id?: string;
  readonly tool_calls?: readonly {
    readonly id: string;
    readonly type: "function";
    readonly function: { readonly name: string; readonly arguments: string };
  }[];
}

/**
 * 내부 ChatMessage를 OpenAI 호환 형식으로 변환
 *
 * @param messages - 내부 ChatMessage 배열
 * @returns OpenAI 호환 메시지 배열
 */
function toOpenAIMessages(messages: readonly ChatMessage[]): readonly OpenAIMessage[] {
  return messages.map((msg): OpenAIMessage => {
    if (msg.role === "tool") {
      return {
        role: "tool",
        content: msg.content,
        tool_call_id: msg.toolCallId ?? "",
      };
    }
    if (msg.role === "assistant" && msg.toolCalls && msg.toolCalls.length > 0) {
      return {
        role: "assistant",
        content: msg.content || null,
        tool_calls: msg.toolCalls.map((tc) => ({
          id: tc.id,
          type: "function" as const,
          function: { name: tc.name, arguments: tc.arguments },
        })),
      };
    }
    return {
      role: msg.role as "system" | "user" | "assistant",
      content: msg.content,
    };
  });
}

/**
 * 내부 도구 정의를 OpenAI 호환 형식으로 변환
 *
 * @param tools - 내부 도구 정의 배열
 * @returns OpenAI 호환 도구 정의 배열
 */
function toOpenAITools(tools: readonly ToolDefinitionForLLM[]): readonly Record<string, unknown>[] {
  return tools.map((t) => ({
    type: "function",
    function: {
      name: t.function.name,
      description: t.function.description,
      parameters: t.function.parameters,
    },
  }));
}

// ─── 재시도 헬퍼 ─────────────────────────────────────────────────────

/**
 * 에러 유형에 따른 재시도 가능 여부와 지연 시간 결정
 *
 * @param status - HTTP 상태 코드
 * @param attempt - 현재 재시도 횟수
 * @returns 재시도 가능 여부와 지연 시간 (ms), 또는 null (재시도 불가)
 */
function getRetryInfo(
  status: number,
  attempt: number,
): { readonly delayMs: number } | null {
  // Rate Limit
  if (status === 429) {
    if (attempt >= MAX_RETRIES_RATE_LIMIT) return null;
    const delay = Math.min(
      BASE_RATE_LIMIT_DELAY_MS * Math.pow(2, attempt),
      MAX_RATE_LIMIT_DELAY_MS,
    );
    return { delayMs: delay };
  }
  // 일시적 서버 에러
  if (status >= 500 && status <= 503) {
    if (attempt >= MAX_RETRIES_TRANSIENT) return null;
    const delay = BASE_RETRY_DELAY_MS * Math.pow(2, attempt);
    return { delayMs: delay };
  }
  return null;
}

/**
 * 지정된 시간만큼 대기 (AbortSignal 지원)
 *
 * @param ms - 대기 시간 (밀리초)
 * @param signal - 취소 시그널 (선택적)
 */
async function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new LLMError("Request aborted"));
      return;
    }
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener("abort", () => {
      clearTimeout(timer);
      reject(new LLMError("Request aborted"));
    }, { once: true });
  });
}

// ─── GoogleGeminiProvider 클래스 ─────────────────────────────────────

/**
 * Google Gemini 프로바이더 — OpenAI 호환 엔드포인트를 사용하는 Gemini 클라이언트
 *
 * Google AI Studio의 OpenAI 호환 API를 활용하여 별도의 SDK 없이
 * fetch 기반으로 Gemini 모델과 통신합니다.
 *
 * @example
 * ```typescript
 * const provider = new GoogleGeminiProvider();
 * const response = await provider.chat({
 *   model: "gemini-2.5-pro",
 *   messages: [{ role: "user", content: "Hello" }],
 * });
 * ```
 */
export class GoogleGeminiProvider implements UnifiedLLMProvider {
  readonly name = "google-gemini";
  readonly manifest = GOOGLE_GEMINI_MANIFEST;

  private readonly apiKey: string;
  private readonly baseUrl: string;

  constructor(options?: {
    readonly apiKey?: string;
    readonly baseUrl?: string;
  }) {
    const key = options?.apiKey ?? resolveGeminiApiKey();
    if (!key) {
      throw new LLMError(
        "Google Gemini API key not found. " +
        "Set DHELIX_GOOGLE_API_KEY, GOOGLE_API_KEY, or GEMINI_API_KEY environment variable.",
      );
    }
    this.apiKey = key;
    this.baseUrl = options?.baseUrl ?? GEMINI_BASE_URL;
  }

  /**
   * 동기식 채팅 요청 — 전체 응답을 한 번에 받음
   */
  async chat(request: ChatRequest): Promise<ChatResponse> {
    const body = this.buildRequestBody(request);
    const response = await this.fetchWithRetry(
      `${this.baseUrl}/chat/completions`,
      body,
      request.signal,
    );

    const json = (await response.json()) as {
      readonly choices: readonly {
        readonly message: {
          readonly content?: string | null;
          readonly tool_calls?: readonly {
            readonly id: string;
            readonly function: {
              readonly name: string;
              readonly arguments: string;
            };
          }[];
        };
        readonly finish_reason: string;
      }[];
      readonly usage?: {
        readonly prompt_tokens: number;
        readonly completion_tokens: number;
        readonly total_tokens: number;
      };
    };

    const choice = json.choices[0];
    const toolCalls: readonly ToolCallRequest[] =
      choice?.message?.tool_calls?.map((tc) => ({
        id: tc.id,
        name: tc.function.name,
        arguments: tc.function.arguments,
      })) ?? [];

    return {
      content: choice?.message?.content ?? "",
      toolCalls,
      usage: {
        promptTokens: json.usage?.prompt_tokens ?? 0,
        completionTokens: json.usage?.completion_tokens ?? 0,
        totalTokens: json.usage?.total_tokens ?? 0,
      },
      finishReason: choice?.finish_reason ?? "stop",
    };
  }

  /**
   * 스트리밍 채팅 요청 — SSE를 통해 응답을 실시간 청크로 받음
   */
  async *stream(request: ChatRequest): AsyncIterable<ChatChunk> {
    const body = { ...this.buildRequestBody(request), stream: true };
    const response = await this.fetchWithRetry(
      `${this.baseUrl}/chat/completions`,
      body,
      request.signal,
    );

    const reader = response.body?.getReader();
    if (!reader) {
      throw new LLMError("Gemini stream: response body is null");
    }

    const decoder = new TextDecoder();
    let buffer = "";
    let totalPromptTokens = 0;
    let totalCompletionTokens = 0;
    let finishReason = "stop";

    try {
      while (true) {
        const readPromise = reader.read();
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(
            () => reject(new LLMError("Gemini stream: chunk timeout")),
            STREAM_CHUNK_TIMEOUT_MS,
          );
        });

        const { done, value } = await Promise.race([readPromise, timeoutPromise]);
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith("data: ")) continue;
          const data = trimmed.slice(6);
          if (data === "[DONE]") continue;

          try {
            const parsed = JSON.parse(data) as {
              readonly choices?: readonly {
                readonly delta?: {
                  readonly content?: string | null;
                  readonly tool_calls?: readonly {
                    readonly index: number;
                    readonly id?: string;
                    readonly function?: {
                      readonly name?: string;
                      readonly arguments?: string;
                    };
                  }[];
                };
                readonly finish_reason?: string | null;
              }[];
              readonly usage?: {
                readonly prompt_tokens: number;
                readonly completion_tokens: number;
                readonly total_tokens: number;
              };
            };

            const delta = parsed.choices?.[0]?.delta;
            const reason = parsed.choices?.[0]?.finish_reason;

            if (reason) {
              finishReason = reason;
            }
            if (parsed.usage) {
              totalPromptTokens = parsed.usage.prompt_tokens;
              totalCompletionTokens = parsed.usage.completion_tokens;
            }

            if (delta?.content) {
              yield { type: "text-delta", text: delta.content };
            }
            if (delta?.tool_calls) {
              for (const tc of delta.tool_calls) {
                yield {
                  type: "tool-call-delta",
                  toolCall: {
                    id: tc.id,
                    name: tc.function?.name,
                    arguments: tc.function?.arguments,
                  },
                };
              }
            }
          } catch {
            // JSON 파싱 실패 시 무시 (불완전한 청크)
          }
        }
      }
    } finally {
      reader.releaseLock();
    }

    yield {
      type: "done",
      usage: {
        promptTokens: totalPromptTokens,
        completionTokens: totalCompletionTokens,
        totalTokens: totalPromptTokens + totalCompletionTokens,
      },
      finishReason,
    };
  }

  /**
   * 텍스트의 토큰 수를 계산
   */
  countTokens(text: string): number {
    return countTokens(text);
  }

  /**
   * 프로바이더 상태 확인 — models.list 엔드포인트로 API 연결 가능 여부를 확인
   */
  async healthCheck(): Promise<ProviderHealthStatus> {
    const start = Date.now();
    try {
      const response = await fetch(
        `${this.baseUrl}/models`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
          },
        },
      );

      if (!response.ok) {
        return {
          healthy: false,
          latencyMs: Date.now() - start,
          error: `HTTP ${response.status}: ${response.statusText}`,
        };
      }

      return {
        healthy: true,
        latencyMs: Date.now() - start,
      };
    } catch (err) {
      return {
        healthy: false,
        latencyMs: Date.now() - start,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  /**
   * 토큰 사용 비용을 예측
   *
   * 모델별 가격을 기반으로 정확한 비용을 계산합니다.
   * 매칭되는 모델이 없으면 첫 번째 모델(gemini-2.5-pro)의 가격을 사용합니다.
   *
   * @param tokens - 토큰 사용량
   * @param modelId - 모델 ID (선택적, 정확한 가격 계산용)
   * @returns 비용 예측 결과
   */
  estimateCost(tokens: TokenUsage, modelId?: string): CostEstimate {
    const model = modelId
      ? this.manifest.models.find((m) => modelId.startsWith(m.id))
      : undefined;
    const pricing = model?.pricing ?? this.manifest.models[0]!.pricing;

    const inputCost = (tokens.promptTokens / 1_000_000) * pricing.input;
    const outputCost = (tokens.completionTokens / 1_000_000) * pricing.output;

    return {
      inputCost,
      outputCost,
      totalCost: inputCost + outputCost,
      currency: "USD",
    };
  }

  // ─── 내부 헬퍼 ────────────────────────────────────────────────────

  /**
   * ChatRequest를 OpenAI 호환 요청 본문으로 변환
   */
  private buildRequestBody(request: ChatRequest): Record<string, unknown> {
    const body: Record<string, unknown> = {
      model: request.model,
      messages: toOpenAIMessages(request.messages),
    };

    if (request.tools && request.tools.length > 0) {
      body["tools"] = toOpenAITools(request.tools);
    }
    if (request.temperature !== undefined) {
      body["temperature"] = request.temperature;
    }
    if (request.maxTokens !== undefined) {
      body["max_tokens"] = request.maxTokens;
    }

    return body;
  }

  /**
   * 자동 재시도가 포함된 fetch 래퍼
   *
   * 일시적 에러(500-503)와 Rate Limit(429)에 대해
   * 지수 백오프로 자동 재시도합니다.
   */
  private async fetchWithRetry(
    url: string,
    body: Record<string, unknown>,
    signal?: AbortSignal,
  ): Promise<Response> {
    let attempt = 0;

    while (true) {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify(body),
        signal,
      });

      if (response.ok) return response;

      const retryInfo = getRetryInfo(response.status, attempt);
      if (!retryInfo) {
        const errorText = await response.text().catch(() => "");
        throw new LLMError(
          `Gemini API error (HTTP ${response.status}): ${errorText}`,
        );
      }

      await sleep(retryInfo.delayMs, signal);
      attempt++;
    }
  }
}
