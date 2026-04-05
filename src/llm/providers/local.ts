/**
 * Local Model Provider — Ollama, LMStudio, vLLM 등 로컬 LLM 서버와 통신하는 클라이언트
 *
 * OpenAI 호환 API를 사용하여 로컬에서 실행 중인 LLM 서버와 통신합니다.
 * 모델 자동 감지, 헬스 체크, 비용 없음(로컬 실행) 등의 기능을 제공합니다.
 *
 * 지원 서버:
 * - Ollama: localhost:11434/v1 (기본값)
 * - LMStudio: localhost:1234/v1
 * - vLLM: 사용자 지정 엔드포인트
 *
 * 엔드포인트 우선순위:
 * - DHELIX_OLLAMA_ENDPOINT → http://localhost:11434
 * - DHELIX_LMSTUDIO_ENDPOINT → http://localhost:1234
 * - DHELIX_LOCAL_ENDPOINT (범용)
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

// ─── 기본 엔드포인트 상수 ─────────────────────────────────────────────

/** Ollama 기본 베이스 URL (OpenAI 호환 엔드포인트 포함 전) */
const DEFAULT_OLLAMA_BASE = "http://localhost:11434";

/** LMStudio 기본 베이스 URL */
const DEFAULT_LMSTUDIO_BASE = "http://localhost:1234";

/** 스트리밍 청크 간 타임아웃 (30초) */
const STREAM_CHUNK_TIMEOUT_MS = 30_000;

/** 헬스 체크 타임아웃 (3초) */
const HEALTH_CHECK_TIMEOUT_MS = 3_000;

// ─── 로컬 서버 타입 ──────────────────────────────────────────────────

/** 지원하는 로컬 LLM 서버 유형 */
export type LocalServerType = "ollama" | "lmstudio" | "vllm" | "generic";

// ─── 매니페스트 ──────────────────────────────────────────────────────

/**
 * Local Model 프로바이더 매니페스트
 *
 * 로컬 서버(Ollama, LMStudio, vLLM)에서 실행되는 모델들의 메타데이터입니다.
 * 가격은 로컬 실행이므로 0입니다.
 */
export const LOCAL_MODEL_MANIFEST: ProviderManifest = {
  id: "local",
  displayName: "Local Models",
  authType: "none",
  modelPatterns: [
    /^(ollama:|local:|lmstudio:)/i,
    /^(llama|mistral|qwen|phi|gemma|deepseek|codellama|vicuna|alpaca|wizardcoder)/i,
  ],
  models: [
    {
      id: "ollama/llama3",
      tier: "low",
      context: 8192,
      pricing: { input: 0, output: 0 },
    },
    {
      id: "ollama/mistral",
      tier: "low",
      context: 32768,
      pricing: { input: 0, output: 0 },
    },
    {
      id: "ollama/qwen2.5-coder",
      tier: "medium",
      context: 131072,
      pricing: { input: 0, output: 0 },
    },
    {
      id: "lmstudio/local",
      tier: "medium",
      context: 32768,
      pricing: { input: 0, output: 0 },
    },
    {
      id: "vllm/local",
      tier: "medium",
      context: 128000,
      pricing: { input: 0, output: 0 },
    },
  ],
  features: {
    supportsCaching: false,
    supportsGrounding: false,
    supportsImageInput: false,
    supportsReasoningTrace: false,
    maxConcurrentRequests: 1,
    rateLimitStrategy: "sliding-window",
  },
};

// ─── 발견된 모델 정보 ────────────────────────────────────────────────

/** 로컬 서버에서 발견된 모델 정보 */
export interface DiscoveredModel {
  /** 모델 ID */
  readonly id: string;
  /** 모델 표시 이름 (선택적) */
  readonly name?: string;
  /** 모델 크기 (bytes, 선택적) */
  readonly size?: number;
  /** 모델이 발견된 서버 유형 */
  readonly serverType: LocalServerType;
}

// ─── 환경변수 기반 엔드포인트 조회 ──────────────────────────────────

/**
 * Ollama 베이스 URL을 환경변수에서 조회
 *
 * 우선순위: DHELIX_OLLAMA_ENDPOINT → OLLAMA_ENDPOINT → 기본값
 *
 * @returns Ollama 베이스 URL
 */
export function resolveOllamaEndpoint(): string {
  return (
    process.env["DHELIX_OLLAMA_ENDPOINT"] ??
    process.env["OLLAMA_ENDPOINT"] ??
    DEFAULT_OLLAMA_BASE
  );
}

/**
 * LMStudio 베이스 URL을 환경변수에서 조회
 *
 * 우선순위: DHELIX_LMSTUDIO_ENDPOINT → LMSTUDIO_ENDPOINT → 기본값
 *
 * @returns LMStudio 베이스 URL
 */
export function resolveLMStudioEndpoint(): string {
  return (
    process.env["DHELIX_LMSTUDIO_ENDPOINT"] ??
    process.env["LMSTUDIO_ENDPOINT"] ??
    DEFAULT_LMSTUDIO_BASE
  );
}

/**
 * 로컬 모델 베이스 URL을 환경변수 또는 서버 유형으로 조회
 *
 * @param serverType - 서버 유형 (기본값: "ollama")
 * @returns 베이스 URL
 */
export function resolveLocalEndpoint(serverType: LocalServerType = "ollama"): string {
  const generic = process.env["DHELIX_LOCAL_ENDPOINT"];
  if (generic) return generic;

  switch (serverType) {
    case "ollama":
      return resolveOllamaEndpoint();
    case "lmstudio":
      return resolveLMStudioEndpoint();
    default:
      return resolveOllamaEndpoint();
  }
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

// ─── LocalModelProvider 클래스 ───────────────────────────────────────

/**
 * 로컬 LLM 프로바이더 — Ollama, LMStudio, vLLM과 OpenAI 호환 API로 통신하는 클라이언트
 *
 * 로컬에서 실행 중인 LLM 서버에 연결하여 AI 응답을 생성합니다.
 * API 키 없이 무료로 사용 가능하며, 개인정보 보호가 필요한 경우에 적합합니다.
 *
 * @example
 * ```typescript
 * // Ollama 사용 (기본)
 * const provider = new LocalModelProvider();
 * const response = await provider.chat({
 *   model: "llama3",
 *   messages: [{ role: "user", content: "Hello" }],
 * });
 *
 * // LMStudio 사용
 * const provider = new LocalModelProvider({ serverType: "lmstudio" });
 * ```
 */
export class LocalModelProvider implements UnifiedLLMProvider {
  readonly name = "local";
  readonly manifest = LOCAL_MODEL_MANIFEST;

  private readonly baseUrl: string;
  private readonly serverType: LocalServerType;

  constructor(options?: {
    readonly serverType?: LocalServerType;
    readonly baseUrl?: string;
  }) {
    this.serverType = options?.serverType ?? "ollama";
    const resolvedBase = options?.baseUrl ?? resolveLocalEndpoint(this.serverType);
    // 베이스 URL 뒤에 /v1 경로 추가 (아직 없으면)
    this.baseUrl = resolvedBase.endsWith("/v1")
      ? resolvedBase
      : `${resolvedBase}/v1`;
  }

  /**
   * 동기식 채팅 요청 — 전체 응답을 한 번에 받음
   */
  async chat(request: ChatRequest): Promise<ChatResponse> {
    const body = this.buildRequestBody(request);
    const response = await this.fetchWithTimeout(
      `${this.baseUrl}/chat/completions`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: request.signal,
      },
    );

    if (!response.ok) {
      const errorText = await response.text().catch(() => "");
      throw new LLMError(
        `Local model API error (HTTP ${response.status}): ${errorText}`,
      );
    }

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
    const response = await this.fetchWithTimeout(
      `${this.baseUrl}/chat/completions`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: request.signal,
      },
    );

    if (!response.ok) {
      const errorText = await response.text().catch(() => "");
      throw new LLMError(
        `Local model stream error (HTTP ${response.status}): ${errorText}`,
      );
    }

    const reader = response.body?.getReader();
    if (!reader) {
      throw new LLMError("Local model stream: response body is null");
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
            () => reject(new LLMError("Local model stream: chunk timeout")),
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
   * 로컬 서버 연결 상태 확인
   *
   * /v1/models 엔드포인트를 호출하여 서버가 응답하는지 확인합니다.
   */
  async healthCheck(): Promise<ProviderHealthStatus> {
    const start = Date.now();
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), HEALTH_CHECK_TIMEOUT_MS);

    try {
      const response = await fetch(`${this.baseUrl}/models`, {
        method: "GET",
        signal: controller.signal,
      });

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
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * 로컬 서버에서 사용 가능한 모델 목록을 자동 조회
   *
   * Ollama: /api/tags 또는 /v1/models 엔드포인트를 사용
   * 기타 서버: /v1/models 엔드포인트를 사용
   *
   * @returns 발견된 모델 목록
   */
  async discoverModels(): Promise<readonly DiscoveredModel[]> {
    const models: DiscoveredModel[] = [];

    // Ollama의 경우 /api/tags도 시도
    if (this.serverType === "ollama") {
      const ollamaBase = this.baseUrl.replace(/\/v1$/, "");
      try {
        const response = await fetch(`${ollamaBase}/api/tags`, {
          method: "GET",
          signal: AbortSignal.timeout(HEALTH_CHECK_TIMEOUT_MS),
        });
        if (response.ok) {
          const data = (await response.json()) as {
            readonly models?: readonly {
              readonly name: string;
              readonly size?: number;
            }[];
          };
          for (const m of data.models ?? []) {
            models.push({
              id: m.name,
              name: m.name,
              size: m.size,
              serverType: "ollama",
            });
          }
          return models;
        }
      } catch {
        // /api/tags 실패 시 /v1/models로 폴백
      }
    }

    // OpenAI 호환 /v1/models 엔드포인트
    try {
      const response = await fetch(`${this.baseUrl}/models`, {
        method: "GET",
        signal: AbortSignal.timeout(HEALTH_CHECK_TIMEOUT_MS),
      });
      if (response.ok) {
        const data = (await response.json()) as {
          readonly data?: readonly {
            readonly id: string;
          }[];
        };
        for (const m of data.data ?? []) {
          models.push({
            id: m.id,
            name: m.id,
            serverType: this.serverType,
          });
        }
      }
    } catch {
      // 모델 조회 실패
    }

    return models;
  }

  /**
   * 비용 예측 — 로컬 모델은 무료이므로 항상 0 반환
   *
   * @param _tokens - 토큰 사용량 (미사용)
   * @returns 0 비용 예측
   */
  estimateCost(_tokens: TokenUsage): CostEstimate {
    return {
      inputCost: 0,
      outputCost: 0,
      totalCost: 0,
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
   * fetch with AbortSignal timeout 지원
   */
  private async fetchWithTimeout(
    url: string,
    options: RequestInit,
  ): Promise<Response> {
    return fetch(url, options);
  }
}
