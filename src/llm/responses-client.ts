/**
 * Responses API 클라이언트 — Codex 모델 전용 API 클라이언트
 *
 * GPT-5 Codex 계열 모델은 Chat Completions API를 지원하지 않고,
 * Responses API(/responses 엔드포인트)만 지원합니다.
 * 이 모듈은 OpenAI SDK를 사용하지 않고 fetch로 직접 HTTP 요청을 수행합니다.
 *
 * 주요 기능:
 * - Responses API 비스트리밍/스트리밍 지원
 * - SSE(Server-Sent Events) 스트림 파싱
 * - 자동 재시도 (일시적 에러 + Rate Limit)
 * - 지수 백오프 + 지터(jitter)로 thundering herd 방지
 * - Azure OpenAI 및 표준 OpenAI URL 지원
 *
 * 참고: https://learn.microsoft.com/en-us/azure/foundry/openai/how-to/responses
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

// ─── 재시도 관련 상수 ────────────────────────────────────────────────

/** 일시적 에러(500, 502, 503, 504, 타임아웃, 네트워크)에 대한 최대 재시도 횟수 */
const MAX_RETRIES_TRANSIENT = 3;

/**
 * Rate Limit(429) 에러에 대한 최대 재시도 횟수
 * client.ts와 달리 5번까지 재시도 — Codex 모델은 Rate Limit이 더 빈번할 수 있음
 */
const MAX_RETRIES_RATE_LIMIT = 5;

/** 일시적 에러 재시도 시 기본 대기 시간 (1초) */
const BASE_RETRY_DELAY_MS = 1_000;

/** Rate Limit 에러 재시도 시 기본 대기 시간 (5초) */
const BASE_RATE_LIMIT_DELAY_MS = 5_000;

/** Rate Limit 백오프 최대 대기 시간 (60초) */
const MAX_RATE_LIMIT_DELAY_MS = 60_000;

/** Responses API 클라이언트 설정 */
export interface ResponsesClientConfig {
  /** API 서버의 기본 URL */
  readonly baseURL: string;
  /** API 인증 키 */
  readonly apiKey?: string;
  /** 요청 타임아웃(밀리초) — 기본값 120초 */
  readonly timeout?: number;
}

/**
 * 모델이 Responses API 전용인지 확인 (Chat Completions API 미지원)
 *
 * Codex 모델(gpt-5-codex, gpt-5.1-codex-mini 등)만 해당됩니다.
 *
 * @param model - 모델 이름
 * @returns Responses API 전용 여부
 */
export function isResponsesOnlyModel(model: string): boolean {
  return /^gpt-5(\.\d+)?-codex/i.test(model);
}

/**
 * 설정된 기본 URL에서 Responses API 엔드포인트 URL을 생성
 *
 * Azure OpenAI와 표준 OpenAI 모두 처리합니다:
 * - 기존 엔드포인트 경로(/responses, /chat/completions 등)를 제거
 * - /deployments/{배포명} 경로를 제거
 * - 깨끗한 기본 경로에 /responses를 추가
 *
 * @param baseURL - 설정된 기본 URL
 * @returns 엔드포인트 URL과 Azure 여부
 */
function buildResponsesEndpoint(baseURL: string): {
  endpoint: string;
  isAzure: boolean;
} {
  // Azure OpenAI URL인지 도메인으로 판단
  const isAzure =
    baseURL.includes(".openai.azure.com") || baseURL.includes(".cognitiveservices.azure.com");

  const urlObj = new URL(baseURL);
  const apiVersion = urlObj.searchParams.get("api-version") ?? undefined;

  // 알려진 엔드포인트 접미사를 제거하여 깨끗한 기본 경로 생성
  let cleanPath = urlObj.pathname;
  cleanPath = cleanPath.replace(/\/(responses|chat\/completions|completions)\/?$/, "");
  cleanPath = cleanPath.replace(/\/deployments\/[^/]+(\/.*)?$/, "");
  cleanPath = cleanPath.replace(/\/$/, "");

  // 깨끗한 기본 경로에 /responses 엔드포인트 추가
  const query = apiVersion ? `?api-version=${apiVersion}` : "";
  const endpoint = `${urlObj.protocol}//${urlObj.host}${cleanPath}/responses${query}`;

  return { endpoint, isAzure };
}

/**
 * 대화 메시지에서 시스템 지시사항을 추출
 *
 * Responses API는 system 메시지를 별도의 `instructions` 파라미터로 전달합니다.
 * 여러 시스템 메시지가 있으면 줄바꿈으로 합칩니다.
 *
 * @param messages - 대화 메시지 배열
 * @returns 합쳐진 시스템 지시사항 문자열 (없으면 undefined)
 */
function extractInstructions(messages: readonly ChatMessage[]): string | undefined {
  const systemMessages = messages.filter((m) => m.role === "system");
  if (systemMessages.length === 0) return undefined;
  return systemMessages.map((m) => m.content).join("\n\n");
}

/**
 * 내부 ChatMessage 배열을 Responses API 입력 형식으로 변환
 *
 * 역할별 변환 규칙:
 * - system → instructions 파라미터로 분리 (여기서는 건너뜀)
 * - user → { role: "user", content: "..." }
 * - assistant (텍스트만) → { type: "message", role: "assistant", content: [{type: "output_text", text}] }
 * - assistant (도구 호출 포함) → function_call 아이템들로 분할
 * - tool 결과 → { type: "function_call_output", call_id, output }
 *
 * @param messages - 내부 ChatMessage 배열
 * @returns Responses API 호환 입력 배열
 */
function toResponsesInput(messages: readonly ChatMessage[]): unknown[] {
  const input: unknown[] = [];

  for (const msg of messages) {
    // system 메시지는 instructions 파라미터로 별도 처리하므로 건너뜀
    if (msg.role === "system") continue;

    // 사용자 메시지 — 그대로 전달
    if (msg.role === "user") {
      input.push({ role: "user", content: msg.content });
      continue;
    }

    // 어시스턴트 메시지
    if (msg.role === "assistant") {
      // 텍스트만 있는 경우 — message 형식으로 변환
      if (msg.content && (!msg.toolCalls || msg.toolCalls.length === 0)) {
        input.push({
          type: "message",
          role: "assistant",
          content: [{ type: "output_text", text: msg.content }],
        });
      }
      // 도구 호출이 있는 경우 — 텍스트와 function_call을 분리
      if (msg.toolCalls && msg.toolCalls.length > 0) {
        if (msg.content) {
          input.push({
            type: "message",
            role: "assistant",
            content: [{ type: "output_text", text: msg.content }],
          });
        }
        // 각 도구 호출을 별도의 function_call 아이템으로 추가
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

    // 도구 실행 결과 — function_call_output 형식으로 변환
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

/**
 * 내부 도구 정의를 Responses API 형식으로 변환
 *
 * @param tools - 내부 도구 정의 배열
 * @returns Responses API 호환 도구 정의 배열
 */
function toResponsesTools(tools: readonly ToolDefinitionForLLM[]): unknown[] {
  return tools.map((t) => ({
    type: "function",
    name: t.function.name,
    description: t.function.description,
    parameters: t.function.parameters,
  }));
}

/**
 * Responses API 응답 형식 — API가 반환하는 JSON 구조
 *
 * 출력은 여러 아이템으로 구성되며, 각 아이템은 메시지나 함수 호출입니다.
 */
interface ResponsesAPIResponse {
  /** 응답 고유 ID */
  readonly id: string;
  /** 사용된 모델 이름 */
  readonly model: string;
  /** 출력 아이템 배열 — 텍스트 메시지와 함수 호출 포함 */
  readonly output: ReadonlyArray<{
    /** 아이템 타입 ("message" 또는 "function_call") */
    readonly type: string;
    /** 아이템 고유 ID */
    readonly id?: string;
    /** 함수 호출 ID (function_call 타입에서 사용) */
    readonly call_id?: string;
    /** 함수 이름 (function_call 타입에서 사용) */
    readonly name?: string;
    /** 함수 인자 JSON 문자열 (function_call 타입에서 사용) */
    readonly arguments?: string;
    /** 메시지 역할 (message 타입에서 사용) */
    readonly role?: string;
    /** 메시지 내용 블록 배열 (message 타입에서 사용) */
    readonly content?: ReadonlyArray<{
      readonly type: string;
      readonly text?: string;
    }>;
  }>;
  /** 전체 출력 텍스트 (편의 필드) */
  readonly output_text?: string;
  /** 토큰 사용량 정보 */
  readonly usage?: {
    readonly input_tokens: number;
    readonly output_tokens: number;
    readonly total_tokens: number;
  };
  /** 응답 상태 ("completed" 등) */
  readonly status?: string;
}

/**
 * Responses API 응답을 내부 ChatResponse 형식으로 변환
 *
 * 출력 아이템들을 순회하며 텍스트 내용과 도구 호출을 추출합니다.
 *
 * @param result - Responses API 응답
 * @returns 내부 ChatResponse 형식
 */
function fromResponsesOutput(result: ResponsesAPIResponse): ChatResponse {
  // output_text 편의 필드가 있으면 우선 사용
  let content = result.output_text ?? "";
  const toolCalls: ToolCallRequest[] = [];

  for (const item of result.output) {
    // 메시지 아이템에서 텍스트 추출
    if (item.type === "message" && item.content) {
      for (const c of item.content) {
        // output_text에서 이미 텍스트를 가져왔으면 건너뜀
        if (c.type === "output_text" && c.text && !content) {
          content = c.text;
        }
      }
    }
    // 함수 호출 아이템 추출
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

/**
 * HTTP 상태 코드가 재시도 가능한지 확인
 *
 * @param status - HTTP 상태 코드
 * @returns 재시도 가능 여부
 */
function isRetryableStatus(status: number): boolean {
  return status === 429 || status === 500 || status === 502 || status === 503 || status === 504;
}

/**
 * HTTP 상태 코드가 Rate Limit 에러인지 확인
 *
 * @param status - HTTP 상태 코드
 * @returns Rate Limit 에러 여부
 */
function isRateLimitStatus(status: number): boolean {
  return status === 429;
}

/**
 * 에러가 일시적 네트워크/연결 에러인지 확인 (HTTP 상태 코드 없음)
 *
 * DNS 해석 실패, 연결 거부, 타임아웃 등 네트워크 수준의 에러를 식별합니다.
 *
 * @param error - 확인할 에러 객체
 * @returns 일시적 네트워크 에러 여부
 */
function isTransientNetworkError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const msg = error.message.toLowerCase();
  return (
    error.name === "AbortError" ||
    msg.includes("econnreset") ||       // 연결 리셋
    msg.includes("econnrefused") ||     // 연결 거부
    msg.includes("etimedout") ||        // 연결 타임아웃
    msg.includes("fetch failed") ||     // fetch 실패
    msg.includes("network")             // 네트워크 에러
  );
}

/**
 * 지정된 밀리초만큼 대기
 *
 * @param ms - 대기할 밀리초
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * 대기 시간에 +/-20% 지터(jitter)를 추가
 *
 * 여러 클라이언트가 동시에 재시도할 때 모두 같은 시점에 요청하는
 * "thundering herd(떼지어 몰려드는)" 문제를 방지합니다.
 * 각 클라이언트가 약간 다른 시간에 재시도하도록 무작위 편차를 추가합니다.
 *
 * @param delayMs - 기본 대기 시간 (밀리초)
 * @returns 지터가 적용된 대기 시간
 */
function addJitter(delayMs: number): number {
  // -20% ~ +20% 범위의 무작위 편차 계산
  const jitter = delayMs * 0.2 * (2 * Math.random() - 1);
  return Math.max(0, Math.round(delayMs + jitter));
}

/**
 * 재시도 대기 시간 계산 — Retry-After 헤더 우선, 그 다음 지수 백오프 + 지터
 *
 * @param status - HTTP 상태 코드 (네트워크 에러이면 undefined)
 * @param attempt - 현재 재시도 횟수 (0부터 시작)
 * @param retryAfterHeader - 서버의 Retry-After 헤더 값 (있으면 우선 사용)
 * @returns 대기할 밀리초
 */
function getRetryDelay(
  status: number | undefined,
  attempt: number,
  retryAfterHeader?: string | null,
): number {
  // Retry-After 헤더가 있으면 서버가 지정한 대기 시간을 사용
  if (retryAfterHeader) {
    const seconds = Number(retryAfterHeader);
    if (!Number.isNaN(seconds) && seconds > 0) {
      return addJitter(seconds * 1_000);
    }
  }
  // Rate Limit: 더 긴 백오프 (5초 → 10초 → 20초 → 40초 → 60초 상한)
  if (status !== undefined && isRateLimitStatus(status)) {
    return addJitter(
      Math.min(BASE_RATE_LIMIT_DELAY_MS * Math.pow(2, attempt), MAX_RATE_LIMIT_DELAY_MS),
    );
  }
  // 일시적 에러: 표준 백오프 (1초 → 2초 → 4초)
  return addJitter(BASE_RETRY_DELAY_MS * Math.pow(2, attempt));
}

/**
 * HTTP 에러를 사용자 친화적인 LLMError로 변환
 *
 * 에러 응답 본문에서 상세 메시지를 추출하고,
 * HTTP 상태 코드에 따라 적절한 에러 메시지를 생성합니다.
 *
 * @param status - HTTP 상태 코드
 * @param body - 에러 응답 본문
 * @param model - 사용 중이던 모델 이름
 * @returns 분류된 LLMError
 */
function classifyHttpError(status: number, body: string, model: string): LLMError {
  // 에러 본문에서 상세 메시지 추출 시도
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
 * Responses API 클라이언트 — Codex 모델 전용 LLM 프로바이더
 *
 * OpenAI SDK를 사용하지 않고 fetch로 직접 HTTP 요청을 수행합니다.
 * SSE(Server-Sent Events)를 직접 파싱하여 스트리밍을 구현합니다.
 *
 * 자동 재시도:
 * - 일시적 에러: 최대 3번 재시도 (지수 백오프 + 지터)
 * - Rate Limit: 최대 5번 재시도 (더 긴 백오프)
 */
export class ResponsesAPIClient implements LLMProvider {
  readonly name = "azure-responses";
  /** Responses API 엔드포인트 URL */
  private readonly endpoint: string;
  /** API 인증 키 */
  private readonly apiKey: string;
  /** Azure OpenAI 사용 여부 — 인증 헤더 형식이 다름 */
  private readonly isAzure: boolean;
  /** 요청 타임아웃 (밀리초) */
  private readonly timeout: number;

  constructor(config: ResponsesClientConfig) {
    const { endpoint, isAzure } = buildResponsesEndpoint(config.baseURL);
    this.endpoint = endpoint;
    this.apiKey = config.apiKey ?? "no-key-required";
    this.isAzure = isAzure;
    this.timeout = config.timeout ?? 120_000;
  }

  /**
   * HTTP 요청 헤더 생성
   *
   * Azure OpenAI는 "api-key" 헤더를, 표준 OpenAI는 "Authorization: Bearer" 헤더를 사용합니다.
   *
   * @returns 인증 정보가 포함된 헤더 객체
   */
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

  /**
   * Responses API 요청 본문 생성
   *
   * 메시지에서 시스템 지시사항을 분리하여 instructions 파라미터로 전달하고,
   * 나머지 메시지를 Responses API 입력 형식으로 변환합니다.
   *
   * @param request - 채팅 요청
   * @param stream - 스트리밍 여부
   * @returns API 요청 본문 객체
   */
  private buildBody(request: ChatRequest, stream: boolean): Record<string, unknown> {
    // 시스템 메시지를 별도의 instructions 파라미터로 추출
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

  /**
   * 동기식 채팅 요청 — 재시도 로직 포함
   *
   * HTTP 에러와 네트워크 에러를 구분하여 적절한 재시도 전략을 적용합니다.
   *
   * @param request - 채팅 요청
   * @returns 전체 LLM 응답
   */
  async chat(request: ChatRequest): Promise<ChatResponse> {
    for (let attempt = 0; ; attempt++) {
      try {
        return await this._chatOnce(request);
      } catch (error) {
        // HTTP 에러 (상태 코드 있음) — 상태 코드에 따라 재시도 여부 결정
        if (error instanceof LLMError) {
          const status = error.context.status as number | undefined;
          if (!status || !isRetryableStatus(status)) throw error;

          const limit = isRateLimitStatus(status) ? MAX_RETRIES_RATE_LIMIT : MAX_RETRIES_TRANSIENT;
          if (attempt >= limit) throw error;

          const retryAfter = error.context.retryAfterHeader as string | undefined;
          const delay = getRetryDelay(status, attempt, retryAfter);
          await sleep(delay);
        // 네트워크 에러 (상태 코드 없음) — DNS, 연결 등의 문제
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

  /**
   * 단일 비스트리밍 요청 실행 (재시도 없음)
   *
   * AbortController를 사용하여 타임아웃과 사용자 취소를 처리합니다.
   *
   * @param request - 채팅 요청
   * @returns LLM 응답
   */
  private async _chatOnce(request: ChatRequest): Promise<ChatResponse> {
    const body = this.buildBody(request, false);

    // 타임아웃 제어를 위한 AbortController 생성
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    // 사용자의 취소 신호(Esc 키)를 연결
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
      // AbortError는 타임아웃 또는 사용자 취소
      if (error instanceof Error && error.name === "AbortError") {
        throw new LLMError("Request timed out or was aborted.", { model: request.model });
      }
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }

    // HTTP 에러 응답 처리
    if (!response.ok) {
      const errorBody = await response.text().catch(() => "");
      const retryAfterHeader = response.headers.get("retry-after");
      const llmError = classifyHttpError(response.status, errorBody, request.model);
      // Retry-After 헤더가 있으면 에러 컨텍스트에 포함 (재시도 시 활용)
      if (retryAfterHeader) {
        throw new LLMError(llmError.message, { ...llmError.context, retryAfterHeader });
      }
      throw llmError;
    }

    // 성공 응답을 내부 형식으로 변환
    const result = (await response.json()) as ResponsesAPIResponse;
    return fromResponsesOutput(result);
  }

  /**
   * 스트리밍 채팅 요청 — 재시도 로직 포함
   *
   * @param request - 채팅 요청
   * @yields ChatChunk — 실시간 응답 조각
   */
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

  /**
   * 단일 스트리밍 요청 실행 (재시도 없음)
   *
   * SSE(Server-Sent Events) 스트림을 받아서 파싱합니다.
   *
   * @param request - 채팅 요청
   * @yields ChatChunk — 실시간 응답 조각
   */
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
      // SSE 스트림 파싱 시작
      yield* this.parseSSEStream(response.body);
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * SSE(Server-Sent Events) 스트림을 파싱하여 ChatChunk로 변환
   *
   * SSE 프로토콜은 줄 단위로 데이터를 전송합니다:
   * - "event: <이벤트타입>" — 이벤트 종류 지정
   * - "data: <JSON데이터>" — 이벤트 데이터
   * - "data: [DONE]" — 스트림 종료 신호
   * - 빈 줄 — 이벤트 구분자
   *
   * 함수 호출은 여러 이벤트에 걸쳐 점진적으로 조립됩니다:
   * 1. response.output_item.added → 함수 이름과 call_id 수신
   * 2. response.function_call_arguments.delta → 인자 조각 수신
   * 3. response.completed → 전체 응답 완료
   *
   * @param body - ReadableStream 응답 본문
   * @yields ChatChunk — 실시간 응답 조각
   */
  private async *parseSSEStream(body: ReadableStream<Uint8Array>): AsyncIterable<ChatChunk> {
    const reader = body.getReader();
    const decoder = new TextDecoder();
    // 불완전한 줄을 저장하는 버퍼 (네트워크 패킷이 줄 중간에서 잘릴 수 있음)
    let buffer = "";

    // 점진적으로 조립 중인 함수 호출을 추적
    // item.id를 키로 사용 (delta 이벤트에서 item_id로 참조됨)
    const functionCalls = new Map<string, { id: string; name: string; arguments: string }>();
    // 최종 토큰 사용량
    let finalUsage:
      | { promptTokens: number; completionTokens: number; totalTokens: number }
      | undefined;

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        // 바이트를 문자열로 디코딩하고 버퍼에 추가
        buffer += decoder.decode(value, { stream: true });

        // 완성된 줄들을 처리 (마지막 불완전한 줄은 버퍼에 유지)
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";   // 마지막 줄은 불완전할 수 있으므로 버퍼에 보관

        let eventType = "";
        for (const line of lines) {
          // "event: " 접두사 → 이벤트 타입 설정
          if (line.startsWith("event: ")) {
            eventType = line.slice(7).trim();
          // "data: " 접두사 → 이벤트 데이터 처리
          } else if (line.startsWith("data: ")) {
            const data = line.slice(6);
            // "[DONE]" → 스트림 종료
            if (data === "[DONE]") {
              yield { type: "done", usage: finalUsage };
              return;
            }

            let parsed: Record<string, unknown>;
            try {
              parsed = JSON.parse(data) as Record<string, unknown>;
            } catch {
              continue;   // 파싱 실패한 데이터는 건너뜀
            }

            const evtType = eventType || (parsed.type as string) || "";

            // 텍스트 델타 이벤트 — 텍스트 응답의 일부분
            if (evtType === "response.output_text.delta") {
              const delta = parsed.delta as string | undefined;
              if (delta) {
                yield { type: "text-delta", text: delta };
              }
            }

            // 출력 아이템 추가 이벤트 — 새로운 함수 호출 시작
            // item.id를 키로 저장하고, call_id를 실제 ID로 사용
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

            // 함수 호출 인자 델타 이벤트 — 인자 조각을 기존 호출에 이어 붙임
            // delta 이벤트는 item_id로 참조 (item.id와 동일), call_id가 아님
            if (evtType === "response.function_call_arguments.delta") {
              const itemId = (parsed.item_id ?? parsed.call_id ?? "") as string;
              const argDelta = (parsed.delta ?? "") as string;
              const existing = functionCalls.get(itemId);
              if (existing) {
                existing.arguments += argDelta;
              } else {
                // 아이템 추가 이벤트를 놓친 경우의 폴백
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

            // 응답 완료 이벤트 — 토큰 사용량 추출
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

            eventType = "";   // 데이터 처리 후 이벤트 타입 초기화
          } else if (line.trim() === "") {
            // 빈 줄은 SSE 스펙에 따라 이벤트 타입을 리셋
            eventType = "";
          }
        }
      }
    } finally {
      // 스트림 리더 잠금 해제 — 반드시 호출해야 메모리 누수 방지
      reader.releaseLock();
    }

    // while 루프가 정상 종료된 경우 (done=true) 완료 신호 전송
    yield { type: "done", usage: finalUsage };
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
