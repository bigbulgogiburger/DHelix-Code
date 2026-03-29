/**
 * OpenAI 호환 LLM 클라이언트 — OpenAI API와 호환되는 모든 서버와 통신하는 핵심 모듈
 *
 * OpenAI, Azure OpenAI, Ollama, vLLM, llama.cpp 등
 * OpenAI 호환 API 서버와 HTTP 통신을 담당합니다.
 *
 * 주요 기능:
 * - Chat Completions API 및 Responses API 지원
 * - 스트리밍/비스트리밍 응답 처리
 * - 일시적 오류(500, 502, 503)에 대한 자동 재시도 (지수 백오프)
 * - Rate Limit(429) 에러 분류 및 처리
 * - Azure OpenAI URL 자동 정규화
 * - Codex 모델을 위한 Responses API 자동 라우팅
 */
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

// ─── 재시도 관련 상수 ────────────────────────────────────────────────
// 네트워크 불안정이나 서버 과부하 시 자동으로 요청을 재시도하기 위한 설정값

/** 일시적 에러(500, 502, 503)에 대한 최대 재시도 횟수 */
const MAX_RETRIES_TRANSIENT = 3;

/**
 * Rate Limit(429) 에러 시 재시도 횟수 — 0으로 설정하여 즉시 실패 처리
 * 429 에러는 서버 측에서 이미 요청 제한을 걸고 있으므로
 * 클라이언트에서 재시도하면 오히려 상황이 악화될 수 있다
 */
const MAX_RETRIES_RATE_LIMIT = 0;

/** 일시적 에러 재시도 시 기본 대기 시간 (1초) — 지수 백오프의 기준값 */
const BASE_RETRY_DELAY_MS = 1_000;

/** Rate Limit 에러 재시도 시 기본 대기 시간 (5초) — 더 긴 대기 필요 */
const BASE_RATE_LIMIT_DELAY_MS = 5_000;

/** Rate Limit 백오프 최대 대기 시간 (60초) — 무한정 대기하지 않도록 상한 설정 */
const MAX_RATE_LIMIT_DELAY_MS = 60_000;

/** 스트리밍 청크 간 타임아웃 (30초) — LLM이 응답을 멈추면 무한 대기 방지 */
const STREAM_CHUNK_TIMEOUT_MS = 30_000;

/**
 * 내부 ChatMessage 형식을 OpenAI API 형식으로 변환
 *
 * 모델마다 메시지 형식이 다르므로, 모델 능력(capabilities)에 따라
 * 적절한 변환을 수행합니다.
 *
 * @param messages - 내부 ChatMessage 배열
 * @param capabilities - 대상 모델의 능력 정보
 * @returns OpenAI API 호환 메시지 배열
 */
function toOpenAIMessages(
  messages: readonly ChatMessage[],
  capabilities: ModelCapabilities,
): OpenAI.ChatCompletionMessageParam[] {
  return messages.map((msg) => {
    // 도구 실행 결과 메시지 — "tool" 역할로 전달
    if (msg.role === "tool") {
      return {
        role: "tool" as const,
        content: msg.content,
        tool_call_id: msg.toolCallId ?? "",
      };
    }
    // 어시스턴트가 도구를 호출한 메시지 — tool_calls 필드 포함
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
    // o1/o3 추론 모델: system 메시지를 developer 역할로 변환
    // 이 모델들은 system 역할을 지원하지 않고 developer 역할을 사용
    if (msg.role === "system" && capabilities.useDeveloperRole) {
      return {
        role: "developer" as const,
        content: msg.content,
      } as OpenAI.ChatCompletionMessageParam;
    }
    // system 메시지를 전혀 지원하지 않는 모델: user 메시지로 변환
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
    // 일반 메시지 — 그대로 전달
    return {
      role: msg.role as "system" | "user" | "assistant",
      content: msg.content,
    };
  });
}

/**
 * 내부 도구 정의를 OpenAI Chat Completions API 형식으로 변환
 *
 * @param tools - 내부 도구 정의 배열
 * @returns OpenAI API 호환 도구 정의 배열
 */
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

/**
 * 모델이 Responses API를 사용해야 하는지 확인
 *
 * Codex 모델(gpt-5-codex 등)은 Chat Completions API 대신
 * Responses API를 사용해야 합니다.
 *
 * @param model - 모델 이름
 * @returns Responses API 사용 여부
 */
function isResponsesApiModel(model: string): boolean {
  return model.toLowerCase().includes("codex");
}

/**
 * 내부 도구 정의를 Responses API 형식으로 변환
 *
 * Responses API는 Chat Completions API와 달리 function 래퍼 없이
 * 평탄화된(flattened) 형식을 사용합니다.
 *
 * @param tools - 내부 도구 정의 배열
 * @returns Responses API 호환 도구 정의 배열
 */
function toResponsesTools(tools: readonly ToolDefinitionForLLM[]): Array<{
  type: "function";
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}> {
  return tools.map((t) => ({
    type: "function" as const,
    name: t.function.name,
    description: t.function.description ?? "",
    parameters: t.function.parameters as Record<string, unknown>,
  }));
}

/**
 * 내부 ChatMessage 배열을 Responses API 입력 형식으로 변환
 *
 * Responses API는 Chat Completions API와 다른 메시지 형식을 사용합니다:
 * - tool 결과 → function_call_output
 * - assistant의 도구 호출 → function_call
 * - system → developer
 *
 * @param messages - 내부 ChatMessage 배열
 * @param capabilities - 대상 모델의 능력 정보
 * @returns Responses API 호환 입력 배열
 */
function toResponsesInput(
  messages: readonly ChatMessage[],
  capabilities: ModelCapabilities,
): Array<Record<string, unknown>> {
  return messages.map((msg) => {
    // 도구 실행 결과 → function_call_output 형식으로 변환
    if (msg.role === "tool") {
      return {
        type: "function_call_output",
        call_id: msg.toolCallId ?? "",
        output: msg.content,
      };
    }
    // 어시스턴트의 도구 호출 메시지 → function_call 아이템들로 분할
    if (msg.role === "assistant" && msg.toolCalls && msg.toolCalls.length > 0) {
      // Responses API에서는 function call이 별도의 아이템으로 분리됨
      // 텍스트 내용과 함수 호출을 각각의 아이템으로 생성
      const items: Array<Record<string, unknown>> = [];
      if (msg.content) {
        items.push({
          role: "assistant",
          content: msg.content,
        });
      }
      for (const tc of msg.toolCalls) {
        items.push({
          type: "function_call",
          id: tc.id,
          name: tc.name,
          arguments: tc.arguments,
          call_id: tc.id,
        });
      }
      // 다중 아이템인 경우 _multi 필드로 묶어서 반환 (나중에 flattenResponsesInput에서 풀어짐)
      return items.length === 1 ? items[0] : { _multi: items };
    }
    // system 메시지 → developer 역할로 변환 (Responses API 규칙)
    if (msg.role === "system") {
      if (capabilities.useDeveloperRole || capabilities.supportsSystemMessage) {
        return { role: "developer", content: msg.content };
      }
      return { role: "user", content: `[System instructions]\n${msg.content}` };
    }
    return { role: msg.role, content: msg.content };
  });
}

/**
 * Responses API 입력에서 _multi 아이템을 풀어서 평탄화
 *
 * toResponsesInput에서 하나의 메시지가 여러 아이템으로 분할된 경우
 * _multi 필드에 묶여 있는데, 이를 개별 아이템으로 펼칩니다.
 *
 * @param items - _multi 필드를 포함할 수 있는 아이템 배열
 * @returns 평탄화된 아이템 배열
 */
function flattenResponsesInput(
  items: Array<Record<string, unknown>>,
): Array<Record<string, unknown>> {
  const result: Array<Record<string, unknown>> = [];
  for (const item of items) {
    if (item._multi && Array.isArray(item._multi)) {
      // _multi 배열의 각 아이템을 개별적으로 추가
      result.push(...(item._multi as Array<Record<string, unknown>>));
    } else {
      result.push(item);
    }
  }
  return result;
}

/**
 * 에러가 재시도 가능한 일시적 에러인지 확인
 *
 * 서버 오류(500, 502, 503), Rate Limit(429), 네트워크 연결 문제 등
 * 시간이 지나면 해결될 수 있는 에러를 식별합니다.
 *
 * @param error - 확인할 에러 객체
 * @returns 재시도 가능 여부
 */
function isRetryableError(error: unknown): boolean {
  if (error instanceof OpenAI.RateLimitError) return true;
  if (error instanceof OpenAI.InternalServerError) return true;
  if (error instanceof OpenAI.APIConnectionError) return true;
  if (error instanceof OpenAI.APIConnectionTimeoutError) return true;
  // 일반 APIError의 HTTP 상태 코드로도 판단 (502 Bad Gateway, 503 Service Unavailable)
  if (error instanceof OpenAI.APIError) {
    const status = error.status;
    return status === 429 || status === 500 || status === 502 || status === 503;
  }
  return false;
}

/**
 * 에러가 Rate Limit(요청 속도 제한) 에러인지 확인
 *
 * @param error - 확인할 에러 객체
 * @returns Rate Limit 에러 여부
 */
function isRateLimitError(error: unknown): boolean {
  if (error instanceof OpenAI.RateLimitError) return true;
  if (error instanceof OpenAI.APIError && error.status === 429) return true;
  return false;
}

/**
 * 재시도 대기 시간 계산 — 지수 백오프(exponential backoff) 적용
 *
 * 지수 백오프란: 재시도할 때마다 대기 시간을 2배씩 늘리는 전략
 * (예: 1초 → 2초 → 4초)
 * 서버가 과부하 상태일 때 부하를 줄여주는 효과가 있습니다.
 *
 * Retry-After 헤더가 있으면 서버가 지정한 시간을 우선 사용합니다.
 *
 * @param error - 발생한 에러 (Retry-After 헤더 확인용)
 * @param attempt - 현재 재시도 횟수 (0부터 시작)
 * @returns 대기할 밀리초
 */
function getRetryDelay(error: unknown, attempt: number): number {
  // Retry-After 헤더가 있으면 서버가 지정한 대기 시간을 사용
  if (error instanceof OpenAI.APIError && error.headers) {
    const retryAfter = error.headers["retry-after"];
    if (retryAfter) {
      const seconds = Number(retryAfter);
      if (!Number.isNaN(seconds) && seconds > 0) {
        return seconds * 1_000;
      }
    }
  }
  // Rate Limit: 더 긴 백오프 적용 (5초 → 10초 → 20초 → 40초 → 60초 상한)
  if (isRateLimitError(error)) {
    return Math.min(BASE_RATE_LIMIT_DELAY_MS * Math.pow(2, attempt), MAX_RATE_LIMIT_DELAY_MS);
  }
  // 일시적 에러: 표준 백오프 (1초 → 2초 → 4초)
  return BASE_RETRY_DELAY_MS * Math.pow(2, attempt);
}

/**
 * OpenAI SDK 에러를 사용자 친화적인 LLMError로 변환
 *
 * 에러의 종류(인증, 권한, Rate Limit, 타임아웃, 네트워크 등)에 따라
 * 적절한 에러 메시지를 생성합니다.
 *
 * @param error - 원본 에러 객체
 * @param operation - 실패한 작업 이름 (예: "chat request")
 * @param model - 사용 중이던 모델 이름
 * @returns 분류된 LLMError
 */
function classifyError(error: unknown, operation: string, model: string): LLMError {
  // 이미 LLMError이면 그대로 반환
  if (error instanceof LLMError) return error;

  // 인증 에러 — API 키가 잘못되었거나 만료됨
  if (error instanceof OpenAI.AuthenticationError) {
    return new LLMError(
      "Authentication failed. Check your API key (OPENAI_API_KEY or DHELIX_API_KEY).",
      { model, cause: error.message, status: error.status },
    );
  }
  // 권한 에러 — API 키에 해당 모델 접근 권한이 없음
  if (error instanceof OpenAI.PermissionDeniedError) {
    return new LLMError("Permission denied. Your API key may lack access to this model.", {
      model,
      cause: error.message,
      status: error.status,
    });
  }
  // Rate Limit 에러 — 요청이 너무 빈번함
  if (error instanceof OpenAI.RateLimitError) {
    const retryAfterMs = getRetryDelay(error, 0);
    return new LLMError("Rate limit exceeded. Please wait before retrying.", {
      model,
      cause: error.message,
      status: 429,
      retryAfterMs,
    });
  }
  // 타임아웃 에러 — 응답이 너무 오래 걸림
  if (error instanceof OpenAI.APIConnectionTimeoutError) {
    return new LLMError(
      "Request timed out. The model may be overloaded or the connection is slow.",
      { model, cause: error.message },
    );
  }
  // 네트워크 연결 에러 — API 서버에 접속할 수 없음
  if (error instanceof OpenAI.APIConnectionError) {
    return new LLMError(
      "Failed to connect to the API. Check your network and baseURL configuration.",
      { model, cause: error.message },
    );
  }
  // 기타 API 에러 — HTTP 상태 코드와 메시지 포함
  if (error instanceof OpenAI.APIError) {
    return new LLMError(`API error (${error.status}): ${error.message}`, {
      model,
      cause: error.message,
      status: error.status,
    });
  }

  // 알 수 없는 에러
  return new LLMError(`LLM ${operation} failed`, {
    model,
    cause: error instanceof Error ? error.message : String(error),
  });
}

/**
 * 지정된 밀리초만큼 대기하는 유틸리티 함수
 *
 * @param ms - 대기할 밀리초
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** OpenAI 호환 클라이언트 설정 */
export interface OpenAIClientConfig {
  /** API 서버의 기본 URL (예: "https://api.openai.com/v1") */
  readonly baseURL: string;
  /** API 인증 키 (없으면 "no-key-required"로 설정 — 로컬 모델용) */
  readonly apiKey?: string;
  /** 요청 타임아웃(밀리초) — 기본값 120초 */
  readonly timeout?: number;
  /** 커스텀 API 키 헤더명 (예: "model-api-key") — 설정 시 Authorization 대신 이 헤더로 키 전달 */
  readonly apiKeyHeader?: string;
}

/**
 * Base URL을 OpenAI SDK에 맞게 정규화
 *
 * Azure OpenAI와 일반 로컬/외부 서버 모두에 대해 URL을 정규화합니다.
 * - 엔드포인트 경로(/chat/completions, /responses 등)를 제거
 * - Azure인 경우: api-version 쿼리 파라미터를 추출, 배포(deployment) 경로를 제거
 *
 * SDK가 자동으로 /chat/completions를 추가하므로 중복을 방지합니다.
 *
 * @param baseURL - 원본 URL (Azure 또는 로컬/일반 서버)
 * @returns 정규화된 URL과 Azure 관련 메타데이터
 */
function normalizeBaseUrl(baseURL: string): {
  baseURL: string;
  apiVersion?: string;
  isAzure: boolean;
} {
  // Azure OpenAI URL인지 판단 (도메인으로 확인)
  const isAzure =
    baseURL.includes(".openai.azure.com") || baseURL.includes(".cognitiveservices.azure.com");
  if (!isAzure) {
    // Azure가 아닌 경우: 사용자가 실수로 포함시킨 엔드포인트 경로를 제거
    // 예: "http://localhost:8080/v1/chat/completions" → "http://localhost:8080/v1"
    const cleanURL = baseURL.replace(/\/(chat\/completions|completions|responses)\/?$/, "");
    return { baseURL: cleanURL, isAzure: false };
  }

  // URL에서 api-version 쿼리 파라미터 추출
  const urlObj = new URL(baseURL);
  const apiVersion = urlObj.searchParams.get("api-version") ?? undefined;

  // Azure 전용 엔드포인트 경로를 제거하여 깨끗한 기본 URL 생성
  let cleanPath = urlObj.pathname;
  // /responses, /chat/completions, /completions 엔드포인트 제거
  cleanPath = cleanPath.replace(/\/(responses|chat\/completions|completions)\/?$/, "");
  // /deployments/{배포명}/... 경로 제거
  cleanPath = cleanPath.replace(/\/deployments\/[^/]+(\/.*)?$/, "");
  // 후행 슬래시 제거
  cleanPath = cleanPath.replace(/\/$/, "");

  const cleanURL = `${urlObj.protocol}//${urlObj.host}${cleanPath}`;
  return { baseURL: cleanURL, apiVersion, isAzure: true };
}

/**
 * OpenAI 호환 LLM 클라이언트
 *
 * OpenAI API 형식을 따르는 모든 서비스와 통신할 수 있는 범용 클라이언트입니다.
 * - OpenAI (GPT-4o, GPT-5 등)
 * - Azure OpenAI
 * - Ollama (로컬 모델)
 * - vLLM, llama.cpp 등
 *
 * 일시적 에러에 대한 자동 재시도와 지수 백오프를 내장하고 있습니다.
 */
export class OpenAICompatibleClient implements LLMProvider {
  readonly name = "openai-compatible";
  /** OpenAI SDK 클라이언트 인스턴스 */
  private readonly client: OpenAI;

  /**
   * @param config - 클라이언트 설정 (baseURL, apiKey, timeout)
   */
  constructor(config: OpenAIClientConfig) {
    // URL을 정규화하고, Azure인 경우 전용 헤더/쿼리를 설정
    const { baseURL, apiVersion, isAzure } = normalizeBaseUrl(config.baseURL);
    const apiKey = config.apiKey ?? "no-key-required";
    const { apiKeyHeader } = config;

    // 커스텀 헤더가 지정된 경우 (사내 모델 등):
    // - Authorization 헤더 대신 커스텀 헤더로 API 키 전달
    // - SDK의 자동 Authorization 헤더를 비활성화하기 위해 apiKey를 빈 문자열로 설정
    const useCustomHeader = !!apiKeyHeader && !isAzure;

    this.client = new OpenAI({
      baseURL,
      apiKey: useCustomHeader ? "sk-placeholder" : apiKey,
      timeout: config.timeout ?? 120_000,
      maxRetries: 0, // SDK의 내장 재시도를 비활성화하고, 직접 재시도 로직을 제어
      ...(isAzure
        ? {
            defaultQuery: { "api-version": apiVersion ?? "2025-01-01-preview" },
            defaultHeaders: { "api-key": apiKey },
          }
        : useCustomHeader
          ? {
              defaultHeaders: { [apiKeyHeader]: apiKey },
            }
          : {}),
    });
  }

  /**
   * 동기식 채팅 요청 — 재시도 로직 포함
   *
   * 일시적 에러 발생 시 지수 백오프로 최대 MAX_RETRIES_TRANSIENT번 재시도합니다.
   * Rate Limit 에러는 즉시 실패 처리합니다.
   *
   * @param request - 채팅 요청
   * @returns 전체 LLM 응답
   * @throws LLMError 모든 재시도 실패 또는 영구적 에러 시
   */
  async chat(request: ChatRequest): Promise<ChatResponse> {
    let lastError: unknown;
    const maxRetries = MAX_RETRIES_TRANSIENT;

    for (let attempt = 0; ; attempt++) {
      try {
        return await this._chatOnce(request);
      } catch (error) {
        lastError = error;

        // 이미 분류된 LLMError는 재시도하지 않음
        if (error instanceof LLMError) throw error;
        // 재시도 불가능한 에러(인증, 권한 등)는 즉시 실패
        if (!isRetryableError(error)) break;

        // Rate Limit 에러는 재시도 한도가 0이므로 즉시 실패
        const limit = isRateLimitError(error) ? MAX_RETRIES_RATE_LIMIT : maxRetries;
        if (attempt >= limit) break;

        // 지수 백오프 대기 후 재시도
        const delay = getRetryDelay(error, attempt);
        await sleep(delay);
      }
    }

    throw classifyError(lastError, "chat request", request.model);
  }

  /**
   * 단일 채팅 요청 실행 (재시도 없음)
   *
   * 모델에 따라 Chat Completions API 또는 Responses API를 선택합니다.
   *
   * @param request - 채팅 요청
   * @returns LLM 응답
   */
  private async _chatOnce(request: ChatRequest): Promise<ChatResponse> {
    // Codex 모델은 Responses API로 라우팅
    if (isResponsesApiModel(request.model)) {
      return this._chatOnceResponses(request);
    }

    // 모델의 능력 정보를 조회하여 요청 파라미터를 조정
    const caps = getModelCapabilities(request.model);
    const params: Record<string, unknown> = {
      model: request.model,
      messages: toOpenAIMessages(request.messages, caps),
    };
    // 최신 모델은 max_completion_tokens, 레거시 모델은 max_tokens 사용
    if (caps.useMaxCompletionTokens) {
      params.max_completion_tokens = request.maxTokens;
    } else {
      params.max_tokens = request.maxTokens;
    }
    // temperature를 지원하는 모델에만 포함 (o1/o3 추론 모델은 지원 안 함)
    if (caps.supportsTemperature && request.temperature !== undefined) {
      params.temperature = request.temperature;
    }
    // 도구(function calling)를 지원하는 모델에만 도구 목록 포함
    if (caps.supportsTools && request.tools) {
      params.tools = toOpenAITools(request.tools);
    }
    const response = await this.client.chat.completions.create(
      params as unknown as OpenAI.ChatCompletionCreateParamsNonStreaming,
      { signal: request.signal },
    );

    // 응답에서 첫 번째 선택지(choice)를 추출
    const choice = response.choices[0];
    if (!choice) {
      throw new LLMError("No response choice from LLM");
    }

    // 도구 호출 응답을 내부 형식으로 변환
    const toolCalls: ToolCallRequest[] =
      choice.message.tool_calls
        ?.filter((tc) => tc.type === "function" && "function" in tc)
        .map((tc) => {
          const funcTc = tc as OpenAI.Chat.Completions.ChatCompletionMessageToolCall;
          return {
            id: funcTc.id,
            name: funcTc.function.name,
            arguments: funcTc.function.arguments,
          };
        }) ?? [];

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

  /**
   * Responses API를 사용한 채팅 요청 — Codex 모델 전용
   *
   * Codex 모델은 Chat Completions API 대신 /responses 엔드포인트를 사용합니다.
   * 입출력 형식이 다르므로 별도의 변환 로직이 필요합니다.
   *
   * @param request - 채팅 요청
   * @returns LLM 응답
   */
  private async _chatOnceResponses(request: ChatRequest): Promise<ChatResponse> {
    const caps = getModelCapabilities(request.model);
    // 메시지를 Responses API 형식으로 변환하고 평탄화
    const input = flattenResponsesInput(toResponsesInput(request.messages, caps));

    const params: Record<string, unknown> = {
      model: request.model,
      input,
    };

    if (request.maxTokens) {
      params.max_output_tokens = request.maxTokens;
    }
    if (caps.supportsTemperature && request.temperature !== undefined) {
      params.temperature = request.temperature;
    }
    if (caps.supportsTools && request.tools) {
      params.tools = toResponsesTools(request.tools);
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const response = await (this.client as any).responses.create(params, {
      signal: request.signal,
    });

    // 응답 출력 아이템에서 텍스트 내용과 도구 호출을 추출
    let content = "";
    const toolCalls: ToolCallRequest[] = [];

    for (const item of response.output ?? []) {
      // 텍스트 응답 아이템
      if (item.type === "message") {
        for (const part of item.content ?? []) {
          if (part.type === "output_text") {
            content += part.text ?? "";
          }
        }
        // 함수 호출 아이템
      } else if (item.type === "function_call") {
        toolCalls.push({
          id: item.call_id ?? item.id ?? "",
          name: item.name ?? "",
          arguments: item.arguments ?? "{}",
        });
      }
    }

    return {
      content,
      toolCalls,
      usage: {
        // Responses API는 input_tokens/output_tokens 필드명을 사용
        promptTokens: response.usage?.input_tokens ?? 0,
        completionTokens: response.usage?.output_tokens ?? 0,
        totalTokens: response.usage?.total_tokens ?? 0,
      },
      finishReason: response.status === "completed" ? "stop" : (response.status ?? "stop"),
    };
  }

  /**
   * 스트리밍 채팅 요청 — 재시도 로직 포함
   *
   * 응답을 실시간 청크로 받으며, 에러 발생 시 처음부터 재시도합니다.
   *
   * @param request - 채팅 요청
   * @yields ChatChunk — 실시간 응답 조각
   */
  async *stream(request: ChatRequest): AsyncIterable<ChatChunk> {
    let lastError: unknown;
    const maxRetries = MAX_RETRIES_TRANSIENT;

    for (let attempt = 0; ; attempt++) {
      try {
        yield* this._streamOnce(request);
        return; // 성공하면 종료
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

  /**
   * 단일 스트리밍 요청 실행 (재시도 없음)
   *
   * Chat Completions API 또는 Responses API 스트리밍을 선택합니다.
   *
   * @param request - 채팅 요청
   * @yields ChatChunk — 실시간 응답 조각
   */
  private async *_streamOnce(request: ChatRequest): AsyncIterable<ChatChunk> {
    // Codex 모델은 Responses API 스트리밍으로 라우팅
    if (isResponsesApiModel(request.model)) {
      yield* this._streamOnceResponses(request);
      return;
    }

    const caps = getModelCapabilities(request.model);
    const params: Record<string, unknown> = {
      model: request.model,
      messages: toOpenAIMessages(request.messages, caps),
      stream: true,
      // 스트리밍 종료 시 토큰 사용량 정보를 포함하도록 요청
      stream_options: { include_usage: true },
    };
    // 모델 능력에 따라 적절한 max tokens 파라미터 사용
    if (caps.useMaxCompletionTokens) {
      params.max_completion_tokens = request.maxTokens;
    } else {
      params.max_tokens = request.maxTokens;
    }
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

    // 도구 호출은 여러 청크에 걸쳐 점진적으로 조립됨
    // index를 키로 사용하여 각 도구 호출의 조각을 누적
    const toolCallsInProgress = new Map<number, { id: string; name: string; arguments: string }>();

    // 최종 토큰 사용량 (마지막 청크에서 수신)
    let streamUsage:
      | { promptTokens: number; completionTokens: number; totalTokens: number }
      | undefined;
    // 응답 종료 사유 (스트리밍 청크에서 수신)
    let streamFinishReason: string | undefined;

    // 청크 간 타임아웃 — LLM이 응답을 멈추면 무한 대기를 방지
    let chunkTimer: ReturnType<typeof setTimeout> | undefined;

    const clearChunkTimer = (): void => {
      if (chunkTimer) {
        clearTimeout(chunkTimer);
        chunkTimer = undefined;
      }
    };

    const chunkTimeoutPromise = (): Promise<never> =>
      new Promise<never>((_, reject) => {
        chunkTimer = setTimeout(() => {
          reject(new LLMError("Stream chunk timeout: no data received for 30 seconds"));
        }, STREAM_CHUNK_TIMEOUT_MS);
      });

    try {
      const iterator = stream[Symbol.asyncIterator]();

      // eslint-disable-next-line no-constant-condition
      while (true) {
        const result = await Promise.race([
          iterator.next(),
          chunkTimeoutPromise(),
        ]);

        clearChunkTimer();

        if (result.done) break;

        const chunk = result.value;

        // OpenAI는 stream_options.include_usage가 true일 때 마지막 청크에 usage를 포함
        if (chunk.usage) {
          streamUsage = {
            promptTokens: chunk.usage.prompt_tokens ?? 0,
            completionTokens: chunk.usage.completion_tokens ?? 0,
            totalTokens: chunk.usage.total_tokens ?? 0,
          };
        }

        // 응답 종료 사유 캡처 — 마지막 유효한 finish_reason을 보존
        const choiceFinishReason = chunk.choices[0]?.finish_reason;
        if (choiceFinishReason) {
          streamFinishReason = choiceFinishReason;
        }

        const delta = chunk.choices[0]?.delta;
        if (!delta) continue;

        // 텍스트 내용 청크
        if (delta.content) {
          yield { type: "text-delta", text: delta.content };
        }

        // 도구 호출 청크 — 점진적으로 조립
        // LLM은 도구 호출 인자를 한 번에 보내지 않고 여러 청크에 나눠서 전송
        if (delta.tool_calls) {
          for (const tc of delta.tool_calls) {
            const existing = toolCallsInProgress.get(tc.index);
            if (existing) {
              // 기존 도구 호출에 인자 조각을 이어 붙임
              existing.arguments += tc.function?.arguments ?? "";
            } else {
              // 새로운 도구 호출 시작
              toolCallsInProgress.set(tc.index, {
                id: tc.id ?? "",
                name: tc.function?.name ?? "",
                arguments: tc.function?.arguments ?? "",
              });
            }
            // UI에서 실시간으로 도구 호출 진행 상황을 표시하기 위해 delta를 전달
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
    } finally {
      clearChunkTimer();
    }

    // 스트리밍 완료 신호와 함께 최종 사용량 및 종료 사유 전달
    yield {
      type: "done",
      usage: streamUsage,
      finishReason: streamFinishReason ?? "stop",
    };
  }

  /**
   * Responses API 스트리밍 — Codex 모델 전용
   *
   * Responses API는 Chat Completions API와 다른 이벤트 형식을 사용합니다.
   * - response.output_text.delta → 텍스트 청크
   * - response.function_call_arguments.done → 도구 호출 완료
   * - response.completed → 전체 응답 완료
   *
   * @param request - 채팅 요청
   * @yields ChatChunk — 실시간 응답 조각
   */
  private async *_streamOnceResponses(request: ChatRequest): AsyncIterable<ChatChunk> {
    const caps = getModelCapabilities(request.model);
    const input = flattenResponsesInput(toResponsesInput(request.messages, caps));

    const params: Record<string, unknown> = {
      model: request.model,
      input,
      stream: true,
    };

    if (request.maxTokens) {
      params.max_output_tokens = request.maxTokens;
    }
    if (caps.supportsTemperature && request.temperature !== undefined) {
      params.temperature = request.temperature;
    }
    if (caps.supportsTools && request.tools) {
      params.tools = toResponsesTools(request.tools);
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const stream = await (this.client as any).responses.create(params, {
      signal: request.signal,
    });

    let streamUsage:
      | { promptTokens: number; completionTokens: number; totalTokens: number }
      | undefined;
    // Responses API의 응답 상태 ("completed" 등)
    let responseStatus: string | undefined;

    // 청크 간 타임아웃 — LLM이 응답을 멈추면 무한 대기를 방지
    let chunkTimer: ReturnType<typeof setTimeout> | undefined;

    const clearChunkTimer = (): void => {
      if (chunkTimer) {
        clearTimeout(chunkTimer);
        chunkTimer = undefined;
      }
    };

    const chunkTimeoutPromise = (): Promise<never> =>
      new Promise<never>((_, reject) => {
        chunkTimer = setTimeout(() => {
          reject(new LLMError("Stream chunk timeout: no data received for 30 seconds"));
        }, STREAM_CHUNK_TIMEOUT_MS);
      });

    // Responses API 스트리밍은 청크가 아닌 이벤트(event) 단위로 데이터를 전송
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const iterator = (stream as any)[Symbol.asyncIterator]();

      // eslint-disable-next-line no-constant-condition
      while (true) {
        const result = await Promise.race([
          iterator.next(),
          chunkTimeoutPromise(),
        ]);

        clearChunkTimer();

        if (result.done) break;

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const event = result.value as any;

        // 텍스트 델타 이벤트 — 텍스트 응답의 일부분
        if (event.type === "response.output_text.delta") {
          yield { type: "text-delta", text: event.delta ?? "" };
        }
        // 함수 호출 인자 완료 이벤트 — 도구 호출 정보가 완성됨
        else if (event.type === "response.function_call_arguments.done") {
          yield {
            type: "tool-call-delta",
            toolCall: {
              id: event.call_id ?? event.item_id ?? "",
              name: event.name ?? "",
              arguments: event.arguments ?? "{}",
            },
          };
        }
        // 응답 완료 이벤트 — 토큰 사용량 정보 및 상태 포함
        else if (event.type === "response.completed") {
          responseStatus = event.response?.status as string | undefined;
          if (event.response?.usage) {
            streamUsage = {
              promptTokens: event.response.usage.input_tokens ?? 0,
              completionTokens: event.response.usage.output_tokens ?? 0,
              totalTokens: event.response.usage.total_tokens ?? 0,
            };
          }
        }
      }
    } finally {
      clearChunkTimer();
    }

    yield {
      type: "done",
      usage: streamUsage,
      finishReason: responseStatus === "completed" ? "stop" : (responseStatus ?? "stop"),
    };
  }

  /**
   * 텍스트의 토큰 수를 계산
   *
   * @param text - 토큰 수를 계산할 텍스트
   * @returns 토큰 수
   */
  countTokens(text: string): number {
    return countTokens(text);
  }
}

/**
 * 모델과 연결 정보로 OpenAI 호환 LLM 클라이언트를 생성하는 팩토리 함수
 *
 * /model 명령에서 프로바이더 전환 시 새 클라이언트를 동적으로 생성하는 데 사용됩니다.
 *
 * 참고: Responses API 전용 모델(gpt-5.x-codex)은
 * createLLMClientForModel() (llm/client-factory.ts)을 사용하세요.
 */
export function createLLMClient(config: OpenAIClientConfig): OpenAICompatibleClient {
  return new OpenAICompatibleClient(config);
}
