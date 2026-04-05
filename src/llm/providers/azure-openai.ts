/**
 * Azure OpenAI 프로바이더 — Azure OpenAI Service와 통신하는 클라이언트
 *
 * Azure OpenAI Service의 OpenAI 호환 REST API를 활용하여
 * GPT-4o, GPT-4-turbo, GPT-35-turbo 모델과 통신합니다.
 *
 * 주요 기능:
 * - Azure 배포 기반 엔드포인트 형식 지원 (resource.openai.azure.com/openai/deployments/{deployment})
 * - API 버전 쿼리 파라미터 관리 (api-version)
 * - OpenAI 호환 Chat Completions API (비스트리밍/스트리밍)
 * - SSE(Server-Sent Events) 스트림 파싱
 * - 도구 호출 (function calling) 지원
 * - 자동 재시도 (일시적 에러 + Rate Limit)
 * - 스트리밍 유휴 타임아웃
 *
 * API 키 우선순위: DHELIX_AZURE_API_KEY → AZURE_OPENAI_API_KEY
 * Base URL 형식: https://{resource}.openai.azure.com/openai/deployments/{deployment}
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

/** Azure OpenAI API 기본 버전 */
const AZURE_API_VERSION = "2024-08-01-preview";

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
 * Azure OpenAI 프로바이더 매니페스트
 *
 * Azure에 배포된 GPT-4o, GPT-4-turbo, GPT-35-turbo 모델의 메타데이터를 정의합니다.
 * 가격은 100만 토큰당 USD 기준입니다.
 *
 * modelPatterns는 "azure-" 접두사로 시작하는 모델 이름을 매칭합니다.
 * Azure 배포 이름은 관례적으로 "azure-" 접두사를 붙여 구분합니다.
 */
export const AZURE_OPENAI_MANIFEST: ProviderManifest = {
  id: "azure-openai",
  displayName: "Azure OpenAI",
  authType: "api-key",
  modelPatterns: [/^azure-/i],
  models: [
    {
      id: "azure-gpt-4o",
      tier: "high",
      context: 128_000,
      pricing: { input: 2.5, output: 10 },
    },
    {
      id: "azure-gpt-4o-mini",
      tier: "medium",
      context: 128_000,
      pricing: { input: 0.15, output: 0.6 },
    },
    {
      id: "azure-gpt-4-turbo",
      tier: "high",
      context: 128_000,
      pricing: { input: 10, output: 30 },
    },
    {
      id: "azure-gpt-35-turbo",
      tier: "low",
      context: 16_384,
      pricing: { input: 0.5, output: 1.5 },
    },
  ],
  features: {
    supportsCaching: false,
    supportsGrounding: false,
    supportsImageInput: true,
    supportsReasoningTrace: false,
    maxConcurrentRequests: 100,
    rateLimitStrategy: "token-bucket",
  },
};

// ─── API 키 조회 ─────────────────────────────────────────────────────

/**
 * Azure OpenAI API 키를 환경변수에서 조회
 *
 * 우선순위: DHELIX_AZURE_API_KEY → AZURE_OPENAI_API_KEY
 *
 * @returns API 키 또는 undefined
 */
export function resolveAzureApiKey(): string | undefined {
  const keys = [
    "DHELIX_AZURE_API_KEY",
    "AZURE_OPENAI_API_KEY",
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

// ─── AzureOpenAIProvider 클래스 ──────────────────────────────────────

/**
 * Azure OpenAI 프로바이더 — Azure OpenAI Service와 통신하는 클라이언트
 *
 * Azure의 배포 기반 엔드포인트 형식과 api-version 쿼리 파라미터를 처리하며,
 * fetch 기반으로 GPT 모델과 통신합니다.
 *
 * 엔드포인트 형식:
 * https://{resource}.openai.azure.com/openai/deployments/{deployment}/chat/completions?api-version={version}
 *
 * @example
 * ```typescript
 * const provider = new AzureOpenAIProvider({
 *   resourceName: "my-azure-resource",
 *   deploymentName: "gpt-4o",
 * });
 * const response = await provider.chat({
 *   model: "azure-gpt-4o",
 *   messages: [{ role: "user", content: "Hello" }],
 * });
 * ```
 */
export class AzureOpenAIProvider implements UnifiedLLMProvider {
  readonly name = "azure-openai";
  readonly manifest = AZURE_OPENAI_MANIFEST;

  private readonly apiKey: string;
  private readonly resourceName: string;
  private readonly deploymentName: string;
  private readonly apiVersion: string;

  constructor(options?: {
    readonly apiKey?: string;
    readonly resourceName?: string;
    readonly deploymentName?: string;
    readonly apiVersion?: string;
  }) {
    const key = options?.apiKey ?? resolveAzureApiKey();
    if (!key) {
      throw new LLMError(
        "Azure OpenAI API key not found. " +
        "Set DHELIX_AZURE_API_KEY or AZURE_OPENAI_API_KEY environment variable.",
      );
    }
    this.apiKey = key;

    const resource = options?.resourceName ?? process.env["AZURE_OPENAI_RESOURCE_NAME"];
    if (!resource) {
      throw new LLMError(
        "Azure OpenAI resource name not found. " +
        "Pass resourceName option or set AZURE_OPENAI_RESOURCE_NAME environment variable.",
      );
    }
    this.resourceName = resource;

    const deployment = options?.deploymentName ?? process.env["AZURE_OPENAI_DEPLOYMENT_NAME"] ?? "gpt-4o";
    this.deploymentName = deployment;

    this.apiVersion = options?.apiVersion ?? AZURE_API_VERSION;
  }

  /**
   * Azure OpenAI Chat Completions API 엔드포인트 URL 생성
   *
   * 형식: https://{resource}.openai.azure.com/openai/deployments/{deployment}/chat/completions?api-version={version}
   */
  private buildEndpointUrl(): string {
    return (
      `https://${this.resourceName}.openai.azure.com` +
      `/openai/deployments/${this.deploymentName}` +
      `/chat/completions?api-version=${this.apiVersion}`
    );
  }

  /**
   * Azure OpenAI Models 엔드포인트 URL 생성 (healthCheck용)
   */
  private buildModelsUrl(): string {
    return (
      `https://${this.resourceName}.openai.azure.com` +
      `/openai/models?api-version=${this.apiVersion}`
    );
  }

  /**
   * 동기식 채팅 요청 — 전체 응답을 한 번에 받음
   */
  async chat(request: ChatRequest): Promise<ChatResponse> {
    const body = this.buildRequestBody(request);
    const response = await this.fetchWithRetry(
      this.buildEndpointUrl(),
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
      this.buildEndpointUrl(),
      body,
      request.signal,
    );

    const reader = response.body?.getReader();
    if (!reader) {
      throw new LLMError("Azure OpenAI stream: response body is null");
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
            () => reject(new LLMError("Azure OpenAI stream: chunk timeout")),
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
   * 프로바이더 상태 확인 — models 엔드포인트로 API 연결 가능 여부를 확인
   */
  async healthCheck(): Promise<ProviderHealthStatus> {
    const start = Date.now();
    try {
      const response = await fetch(
        this.buildModelsUrl(),
        {
          method: "GET",
          headers: {
            "api-key": this.apiKey,
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
   * 매칭되는 모델이 없으면 첫 번째 모델(azure-gpt-4o)의 가격을 사용합니다.
   *
   * @param tokens - 토큰 사용량
   * @param modelId - 모델 ID (선택적, 정확한 가격 계산용)
   * @returns 비용 예측 결과
   */
  estimateCost(tokens: TokenUsage, modelId?: string): CostEstimate {
    const model = modelId
      ? this.manifest.models.find((m) => m.id === modelId || modelId === m.id)
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
   * Azure OpenAI는 api-key 헤더를 사용합니다 (Bearer 토큰 방식이 아닌).
   * 일시적 에러(500-503)와 Rate Limit(429)에 대해 지수 백오프로 자동 재시도합니다.
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
          "api-key": this.apiKey,
        },
        body: JSON.stringify(body),
        signal,
      });

      if (response.ok) return response;

      const retryInfo = getRetryInfo(response.status, attempt);
      if (!retryInfo) {
        const errorText = await response.text().catch(() => "");
        throw new LLMError(
          `Azure OpenAI API error (HTTP ${response.status}): ${errorText}`,
        );
      }

      await sleep(retryInfo.delayMs, signal);
      attempt++;
    }
  }
}
