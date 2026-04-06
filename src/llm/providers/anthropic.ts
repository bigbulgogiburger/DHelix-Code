/**
 * Anthropic Claude API 프로바이더 — Claude 모델과 직접 통신하는 클라이언트
 *
 * Anthropic의 Messages API를 사용하여 Claude 모델과 통신합니다.
 * OpenAI SDK를 사용하지 않고 fetch로 직접 HTTP 요청을 수행합니다.
 *
 * 주요 기능:
 * - Messages API 비스트리밍/스트리밍 지원
 * - SSE(Server-Sent Events) 스트림 파싱
 * - Extended Thinking(확장 사고) 지원
 * - 프롬프트 캐싱 (cache_control: ephemeral)
 * - 도구 호출 (tool_use) 지원
 * - 자동 재시도 (일시적 에러 + Rate Limit)
 * - 스트리밍 유휴 타임아웃 (청크 수신 시 타이머 리셋)
 *
 * Anthropic 전용 특징:
 * - system 메시지를 별도의 system 파라미터로 분리
 * - tool 결과를 user 역할의 tool_result 블록으로 전달
 * - 529 상태 코드 (Anthropic 과부하)를 Rate Limit으로 처리
 */
import {
  type ChatRequest,
  type ChatResponse,
  type ChatChunk,
  type ChatMessage,
  type ToolCallRequest,
  type ToolDefinitionForLLM,
  type TokenUsage,
} from "../provider.js";
import { LLMError } from "../../utils/error.js";
import type { AppEventEmitter } from "../../utils/events.js";
import type { UnifiedLLMProvider, ProviderHealthStatus, CostEstimate } from "./types.js";
import { ANTHROPIC_MANIFEST } from "./registry.js";

// ─── API 상수 ────────────────────────────────────────────────────────

/** Anthropic Messages API 기본 엔드포인트 */
const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";

/** Anthropic API 버전 — 요청 헤더에 포함 */
const ANTHROPIC_VERSION = "2023-06-01";

// ─── 재시도 관련 상수 ────────────────────────────────────────────────

/** 일시적 에러(500, 502, 503)에 대한 최대 재시도 횟수 */
const MAX_RETRIES_TRANSIENT = 3;

/**
 * Rate Limit(429, 529) 에러에 대한 최대 재시도 횟수
 * Anthropic은 일시적 과부하 시 429 외에도 529를 반환하므로
 * 좀 더 관대하게 재시도합니다
 */
const MAX_RETRIES_RATE_LIMIT = 5;

/** 일시적 에러 재시도 시 기본 대기 시간 (1초) */
const BASE_RETRY_DELAY_MS = 1_000;

/** Rate Limit 에러 재시도 시 기본 대기 시간 (5초) */
const BASE_RATE_LIMIT_DELAY_MS = 5_000;

/** Rate Limit 백오프 최대 대기 시간 (60초) */
const MAX_RATE_LIMIT_DELAY_MS = 60_000;

// ─── Anthropic API 타입 정의 ────────────────────────────────────────

/** 텍스트 콘텐츠 블록 — 일반 텍스트 응답 */
interface AnthropicTextBlock {
  readonly type: "text";
  /** 텍스트 내용 */
  readonly text: string;
}

/** Extended Thinking 콘텐츠 블록 — 모델의 내부 사고 과정 */
interface AnthropicThinkingBlock {
  readonly type: "thinking";
  /** 사고 내용 텍스트 */
  readonly thinking: string;
}

/** 도구 사용 콘텐츠 블록 — 모델이 도구를 호출할 때 생성 */
interface AnthropicToolUseBlock {
  readonly type: "tool_use";
  /** 도구 호출 고유 ID — 결과를 매칭할 때 사용 */
  readonly id: string;
  /** 호출할 도구 이름 */
  readonly name: string;
  /** 도구에 전달할 인자 (이미 파싱된 객체) */
  readonly input: Record<string, unknown>;
}

/** Anthropic 응답의 콘텐츠 블록 — 텍스트, 사고, 도구 사용 중 하나 */
type AnthropicContentBlock = AnthropicTextBlock | AnthropicThinkingBlock | AnthropicToolUseBlock;

/** Anthropic API 도구 정의 형식 — OpenAI와 약간 다른 구조 */
interface AnthropicTool {
  /** 도구 이름 */
  readonly name: string;
  /** 도구 설명 */
  readonly description: string;
  /** 입력 매개변수 JSON 스키마 (OpenAI의 parameters에 해당) */
  readonly input_schema: Record<string, unknown>;
}

/**
 * Anthropic Messages API 응답 형식
 *
 * OpenAI의 choices 배열과 달리, content 배열에 여러 블록이 포함됩니다.
 * 텍스트, 사고, 도구 호출이 모두 같은 content 배열에 섞여 있습니다.
 */
interface AnthropicResponse {
  /** 응답 고유 ID */
  readonly id: string;
  /** 항상 "message" */
  readonly type: "message";
  /** 항상 "assistant" */
  readonly role: "assistant";
  /** 응답 콘텐츠 블록 배열 — 텍스트, 사고, 도구 사용 등 */
  readonly content: readonly AnthropicContentBlock[];
  /**
   * 응답 종료 사유
   * - "end_turn": 정상 완료
   * - "max_tokens": 토큰 한도 도달
   * - "stop_sequence": 중단 시퀀스 감지
   * - "tool_use": 도구 사용 요청
   */
  readonly stop_reason: "end_turn" | "max_tokens" | "stop_sequence" | "tool_use" | null;
  /** 토큰 사용량 (캐시 관련 필드 포함) */
  readonly usage: {
    /** 입력 토큰 수 */
    readonly input_tokens: number;
    /** 출력 토큰 수 */
    readonly output_tokens: number;
    /** 캐시 생성에 사용된 입력 토큰 수 (최초 캐시 저장 시) */
    readonly cache_creation_input_tokens?: number;
    /** 캐시에서 읽은 입력 토큰 수 (캐시 적중 시) */
    readonly cache_read_input_tokens?: number;
  };
}

// ─── SSE(Server-Sent Events) 스트리밍 이벤트 타입 ────────────────────

/** 메시지 시작 이벤트 — 스트리밍 시작 시 초기 메타데이터 포함 */
interface AnthropicMessageStartEvent {
  readonly type: "message_start";
  /** 초기 응답 메타데이터 (사용량, ID 등) */
  readonly message: AnthropicResponse;
}

/** 콘텐츠 블록 시작 이벤트 — 새 텍스트/사고/도구 블록이 시작될 때 */
interface AnthropicContentBlockStartEvent {
  readonly type: "content_block_start";
  /** 블록 인덱스 — 여러 블록을 구분 */
  readonly index: number;
  /** 시작되는 블록 정보 (타입, ID, 이름 등) */
  readonly content_block: AnthropicContentBlock;
}

/**
 * 콘텐츠 블록 델타 이벤트 — 블록의 내용이 점진적으로 전달될 때
 *
 * delta 타입에 따라 다른 필드가 포함됩니다:
 * - text_delta: 텍스트 조각
 * - thinking_delta: 사고 조각
 * - input_json_delta: 도구 인자 JSON 조각
 */
interface AnthropicContentBlockDeltaEvent {
  readonly type: "content_block_delta";
  /** 어떤 블록의 델타인지 식별 */
  readonly index: number;
  readonly delta:
    | { readonly type: "text_delta"; readonly text: string }
    | { readonly type: "thinking_delta"; readonly thinking: string }
    | { readonly type: "input_json_delta"; readonly partial_json: string };
}

/** 콘텐츠 블록 종료 이벤트 */
interface AnthropicContentBlockStopEvent {
  readonly type: "content_block_stop";
  readonly index: number;
}

/** 메시지 델타 이벤트 — 최종 메타데이터 (종료 사유, 출력 토큰 수) */
interface AnthropicMessageDeltaEvent {
  readonly type: "message_delta";
  readonly delta: {
    /** 응답 종료 사유 */
    readonly stop_reason: string | null;
  };
  readonly usage: {
    /** 출력 토큰 수 */
    readonly output_tokens: number;
  };
}

/** 메시지 종료 이벤트 — 스트리밍 완료 */
interface AnthropicMessageStopEvent {
  readonly type: "message_stop";
}

/** 모든 SSE 이벤트의 유니온 타입 */
type AnthropicStreamEvent =
  | AnthropicMessageStartEvent
  | AnthropicContentBlockStartEvent
  | AnthropicContentBlockDeltaEvent
  | AnthropicContentBlockStopEvent
  | AnthropicMessageDeltaEvent
  | AnthropicMessageStopEvent;

/** Anthropic 프로바이더 설정 */
export interface AnthropicProviderConfig {
  /** API 키 — 없으면 ANTHROPIC_API_KEY 환경변수에서 읽음 */
  readonly apiKey?: string;
  /** API 엔드포인트 URL — 프록시 사용 시 변경 */
  readonly baseURL?: string;
  /** 요청 타임아웃(밀리초) — 기본값 120초 */
  readonly timeout?: number;
  /** 이벤트 발행기 — 캐시 통계 등의 이벤트를 발행 */
  readonly eventEmitter?: AppEventEmitter;
}

// ─── 내부 유틸리티 함수 ──────────────────────────────────────────────

/**
 * 내부 ChatMessage 배열에서 시스템 메시지를 분리하고 나머지를 Anthropic 형식으로 변환
 *
 * Anthropic API는 시스템 메시지를 별도의 system 파라미터로 받습니다.
 * (OpenAI처럼 messages 배열에 system 역할을 넣지 않음)
 *
 * 역할별 변환 규칙:
 * - system → 별도 system 파라미터로 분리 (여러 개면 줄바꿈으로 합침)
 * - tool → user 역할의 tool_result 블록으로 변환
 * - assistant (도구 호출) → text + tool_use 블록으로 변환
 * - user/assistant → 그대로 전달
 *
 * @param messages - 내부 ChatMessage 배열
 * @returns 분리된 시스템 메시지와 변환된 메시지 배열
 */
function extractSystemAndMessages(messages: readonly ChatMessage[]): {
  system: string | undefined;
  messages: Array<Record<string, unknown>>;
} {
  let system: string | undefined;
  const converted: Array<Record<string, unknown>> = [];

  for (const msg of messages) {
    // system 메시지를 별도로 수집 (여러 개이면 줄바꿈으로 합침)
    if (msg.role === "system") {
      system = system ? `${system}\n\n${msg.content}` : msg.content;
      continue;
    }

    // tool 결과 → Anthropic의 tool_result 형식으로 변환
    // Anthropic은 도구 결과를 user 역할의 특수 블록으로 받음
    if (msg.role === "tool") {
      converted.push({
        role: "user",
        content: [
          {
            type: "tool_result",
            tool_use_id: msg.toolCallId ?? "", // 원래 도구 호출 ID와 매칭
            content: msg.content,
          },
        ],
      });
      continue;
    }

    // assistant 메시지 중 도구 호출이 있는 경우
    // 텍스트 블록과 tool_use 블록을 하나의 content 배열에 포함
    if (msg.role === "assistant" && msg.toolCalls && msg.toolCalls.length > 0) {
      const content: Array<Record<string, unknown>> = [];
      if (msg.content) {
        content.push({ type: "text", text: msg.content });
      }
      for (const tc of msg.toolCalls) {
        // 도구 인자를 JSON 문자열에서 객체로 파싱
        let input: Record<string, unknown> = {};
        try {
          input = JSON.parse(tc.arguments) as Record<string, unknown>;
        } catch {
          input = {}; // 파싱 실패 시 빈 객체
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

    // 일반 user/assistant 메시지 — 그대로 전달
    converted.push({
      role: msg.role,
      content: msg.content,
    });
  }

  return { system, messages: converted };
}

/**
 * 내부 도구 정의를 Anthropic API 형식으로 변환
 *
 * OpenAI 형식과의 차이:
 * - OpenAI: { type: "function", function: { name, description, parameters } }
 * - Anthropic: { name, description, input_schema }
 *
 * @param tools - 내부 도구 정의 배열
 * @returns Anthropic API 호환 도구 정의 배열
 */
function toAnthropicTools(tools: readonly ToolDefinitionForLLM[]): AnthropicTool[] {
  return tools.map((t) => ({
    name: t.function.name,
    description: t.function.description,
    input_schema: t.function.parameters,
  }));
}

/**
 * Anthropic의 stop_reason을 OpenAI 스타일의 finishReason으로 매핑
 *
 * 내부 인터페이스는 OpenAI 스타일을 따르므로 변환이 필요합니다.
 *
 * @param stopReason - Anthropic의 종료 사유
 * @returns OpenAI 스타일의 종료 사유
 */
function mapStopReason(stopReason: string | null): string {
  switch (stopReason) {
    case "end_turn":
      return "stop"; // 정상 종료
    case "max_tokens":
      return "length"; // 토큰 한도 도달
    case "tool_use":
      return "tool_calls"; // 도구 사용 요청
    case "stop_sequence":
      return "stop"; // 중단 시퀀스
    default:
      return "stop";
  }
}

/**
 * HTTP 상태 코드가 재시도 가능한지 확인
 *
 * Anthropic 전용: 529(과부하)도 재시도 대상에 포함
 *
 * @param status - HTTP 상태 코드
 * @returns 재시도 가능 여부
 */
function isRetryableStatus(status: number): boolean {
  return status === 429 || status === 500 || status === 502 || status === 503 || status === 529;
}

/**
 * HTTP 상태 코드가 Rate Limit 에러인지 확인
 *
 * Anthropic은 429 외에도 529(서버 과부하)를 Rate Limit으로 처리합니다.
 *
 * @param status - HTTP 상태 코드
 * @returns Rate Limit 에러 여부
 */
function isRateLimitStatus(status: number): boolean {
  return status === 429 || status === 529;
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
 * HTTP 에러를 사용자 친화적인 LLMError로 변환
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
  // 429 또는 529 — Anthropic의 Rate Limit/과부하
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
 * ReadableStream에서 SSE(Server-Sent Events) 이벤트를 파싱
 *
 * Anthropic의 스트리밍 응답은 SSE 프로토콜을 사용합니다.
 * 각 이벤트는 다음 형식으로 전달됩니다:
 * ```
 * event: message_start
 * data: {"type":"message_start","message":{...}}
 *
 * event: content_block_delta
 * data: {"type":"content_block_delta","delta":{...}}
 * ```
 *
 * @param body - ReadableStream 응답 본문
 * @param signal - 취소 신호 (사용자가 Esc를 누르면 파싱 중단)
 * @yields 파싱된 Anthropic SSE 이벤트
 */
async function* parseSSEStream(
  body: ReadableStream<Uint8Array>,
  signal?: AbortSignal,
): AsyncIterable<AnthropicStreamEvent> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  // 불완전한 줄을 저장하는 버퍼
  let buffer = "";

  try {
    while (true) {
      // 취소 신호 확인
      if (signal?.aborted) {
        throw new LLMError("Request aborted");
      }

      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? ""; // 마지막 불완전한 줄은 버퍼에 유지

      let currentEventType: string | null = null;

      for (const line of lines) {
        // "event: " 접두사 → 이벤트 타입 설정
        if (line.startsWith("event: ")) {
          currentEventType = line.slice(7).trim();
          continue;
        }

        // "data: " 접두사 + 이벤트 타입이 있는 경우 → JSON 파싱 후 yield
        if (line.startsWith("data: ") && currentEventType) {
          const data = line.slice(6);
          try {
            const parsed = JSON.parse(data) as AnthropicStreamEvent;
            yield parsed;
          } catch {
            // JSON 파싱 실패 — 상세 모드에서만 경고 출력
            if (process.env.DHELIX_VERBOSE) {
              process.stderr.write(
                `[anthropic] Failed to parse SSE data (event: ${currentEventType}): ${data}\n`,
              );
            }
          }
          currentEventType = null;
          continue;
        }

        // 빈 줄 → SSE 스펙에 따라 이벤트 타입 리셋
        if (line.trim() === "") {
          currentEventType = null;
        }
      }
    }
  } finally {
    // 스트림 리더 잠금 해제 — 반드시 호출해야 메모리 누수 방지
    reader.releaseLock();
  }
}

/**
 * Anthropic Claude API 프로바이더
 *
 * Anthropic의 Messages API를 직접 호출합니다 (SDK 의존성 없음).
 * fetch를 사용하여 HTTP 요청을 보내고, SSE를 직접 파싱합니다.
 *
 * 특징:
 * - 프롬프트 캐싱: 시스템 프롬프트를 블록으로 분할하여 캐싱
 * - Extended Thinking: 모델의 내부 사고 과정을 받아올 수 있음
 * - 스트리밍 유휴 타임아웃: 청크 수신 시 타이머를 리셋하여 느린 응답도 허용
 */
export class AnthropicProvider implements UnifiedLLMProvider {
  readonly name = "anthropic";
  /** API 인증 키 */
  private readonly apiKey: string;
  /** API 엔드포인트 URL */
  private readonly baseURL: string;
  /** 요청 타임아웃 (밀리초) */
  private readonly timeout: number;
  /** 이벤트 발행기 — 캐시 통계 등을 외부에 알림 */
  private readonly eventEmitter?: AppEventEmitter;

  /**
   * @param config - 프로바이더 설정
   * @throws LLMError ANTHROPIC_API_KEY가 없으면 에러
   */
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
    this.eventEmitter = config.eventEmitter;
  }

  /**
   * 동기식 채팅 요청 — 재시도 로직 포함
   *
   * HTTP 상태 코드에 따라 재시도 여부와 대기 시간을 결정합니다.
   * Rate Limit(429, 529)은 더 긴 백오프, 일시적 에러(500-503)는 표준 백오프.
   *
   * @param request - 채팅 요청
   * @returns 전체 LLM 응답
   */
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

          // Rate Limit이면 더 긴 대기, 일시적이면 표준 대기
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

  /**
   * 단일 비스트리밍 요청 실행 (재시도 없음)
   *
   * @param request - 채팅 요청
   * @returns LLM 응답
   */
  private async _chatOnce(request: ChatRequest): Promise<ChatResponse> {
    // 시스템 메시지를 분리하고 나머지를 Anthropic 형식으로 변환
    const { system, messages } = extractSystemAndMessages(request.messages);

    const body = this._buildRequestBody(request, system, messages);

    // 타임아웃 제어를 위한 AbortController
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    // 사용자의 취소 신호를 연결
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
          // 프롬프트 캐싱 베타 활성화 — cache_control 필드 사용 가능
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

    // HTTP 에러 응답 처리
    if (!response.ok) {
      const errorBody = await response.text();
      throw classifyHttpError(response.status, errorBody, request.model);
    }

    // 성공 응답을 파싱
    const data = (await response.json()) as AnthropicResponse;
    return this._parseResponse(data, request.model);
  }

  /**
   * Anthropic 응답을 내부 ChatResponse 형식으로 변환
   *
   * content 배열의 각 블록을 순회하며:
   * - text 블록 → textContent에 누적
   * - thinking 블록 → thinkingContent에 누적
   * - tool_use 블록 → toolCalls 배열에 추가
   *
   * @param data - Anthropic API 응답
   * @param model - 모델 이름 (캐시 통계 이벤트에 사용)
   * @returns 내부 ChatResponse 형식
   */
  private _parseResponse(data: AnthropicResponse, model: string): ChatResponse {
    let textContent = "";
    let thinkingContent = "";
    const toolCalls: ToolCallRequest[] = [];

    for (const block of data.content) {
      if (block.type === "text") {
        textContent += block.text;
      } else if (block.type === "thinking") {
        thinkingContent += block.thinking;
      } else if (block.type === "tool_use") {
        // Anthropic은 도구 인자를 이미 파싱된 객체로 전달
        // 내부 형식에 맞추기 위해 JSON 문자열로 다시 변환
        toolCalls.push({
          id: block.id,
          name: block.name,
          arguments: JSON.stringify(block.input),
        });
      }
    }

    // 캐시 통계 이벤트 발행 (캐시 활동이 있는 경우)
    this._emitCacheStats(data.usage, model);

    return {
      content: textContent,
      toolCalls,
      usage: {
        promptTokens: data.usage.input_tokens,
        completionTokens: data.usage.output_tokens,
        totalTokens: data.usage.input_tokens + data.usage.output_tokens,
      },
      finishReason: mapStopReason(data.stop_reason),
      // Extended Thinking 내용이 있으면 포함
      ...(thinkingContent ? { thinking: thinkingContent } : {}),
    };
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

  /**
   * 단일 스트리밍 요청 실행 (재시도 없음)
   *
   * 유휴 타임아웃 패턴을 사용합니다:
   * - 초기 타임아웃 설정
   * - SSE 청크를 수신할 때마다 타이머를 리셋
   * - 이를 통해 느린 응답(긴 사고 시간 등)도 중간에 끊지 않음
   *
   * @param request - 채팅 요청
   * @yields ChatChunk — 실시간 응답 조각
   */
  private async *_streamOnce(request: ChatRequest): AsyncIterable<ChatChunk> {
    const { system, messages } = extractSystemAndMessages(request.messages);

    const body = this._buildRequestBody(request, system, messages);
    body.stream = true; // 스트리밍 활성화

    const controller = new AbortController();
    // 유휴 타임아웃 — 초기 설정
    let idleTimeoutId: ReturnType<typeof setTimeout> | undefined = setTimeout(
      () => controller.abort(),
      this.timeout,
    );

    /**
     * 유휴 타임아웃 리셋 — SSE 청크를 수신할 때마다 호출
     * 데이터를 받고 있는 한 타임아웃이 발생하지 않도록 타이머를 갱신합니다.
     */
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

    // 타임아웃을 아직 해제하지 않음 — 스트리밍이 진행 중
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

    // 스트리밍 중 점진적으로 조립 중인 도구 호출을 추적
    // index를 키로 사용하여 여러 도구 호출을 동시에 조립
    const toolCallsInProgress = new Map<number, { id: string; name: string; arguments: string }>();
    // Extended Thinking 블록의 인덱스를 추적
    const thinkingBlocks = new Set<number>();

    let inputTokens = 0; // 입력 토큰 수 (message_start에서 수신)
    let outputTokens = 0; // 출력 토큰 수 (message_delta에서 누적)
    let stopReason: string | null = null; // 응답 종료 사유 (message_delta에서 수신)

    try {
      for await (const event of parseSSEStream(response.body, request.signal)) {
        // 청크를 수신할 때마다 유휴 타임아웃을 리셋
        resetIdleTimeout();
        switch (event.type) {
          // 메시지 시작 — 입력 토큰 수와 캐시 통계 수신
          case "message_start": {
            inputTokens = event.message.usage.input_tokens;
            // 초기 캐시 통계 이벤트 발행
            this._emitCacheStats(event.message.usage, request.model);
            break;
          }

          // 콘텐츠 블록 시작 — 새로운 텍스트/사고/도구 블록
          case "content_block_start": {
            if (event.content_block.type === "tool_use") {
              // 새 도구 호출 시작 — ID와 이름을 기록하고 인자 누적 준비
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
              // Extended Thinking 블록 시작 — 인덱스를 기록
              thinkingBlocks.add(event.index);
            }
            break;
          }

          // 콘텐츠 블록 델타 — 텍스트/사고/도구 인자의 점진적 전달
          case "content_block_delta": {
            if (event.delta.type === "text_delta") {
              // 텍스트 응답 조각
              yield { type: "text-delta", text: event.delta.text };
            } else if (event.delta.type === "thinking_delta") {
              // Extended Thinking 사고 조각
              yield { type: "thinking-delta", thinking_delta: event.delta.thinking };
            } else if (event.delta.type === "input_json_delta") {
              // 도구 호출 인자 JSON 조각 — 해당 인덱스의 도구 호출에 이어 붙임
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

          // 메시지 델타 — 출력 토큰 수 누적 + 종료 사유 캡처
          case "message_delta": {
            outputTokens += event.usage.output_tokens;
            if (event.delta.stop_reason) {
              stopReason = event.delta.stop_reason;
            }
            break;
          }

          // 메시지 종료 — 스트리밍 완료
          case "message_stop": {
            break;
          }
        }
      }
    } finally {
      // 스트리밍 완료 후 유휴 타임아웃 정리
      clearTimeout(idleTimeoutId);
    }

    // 스트리밍 완료 신호와 함께 최종 토큰 사용량 및 종료 사유 전달
    yield {
      type: "done",
      usage: {
        promptTokens: inputTokens,
        completionTokens: outputTokens,
        totalTokens: inputTokens + outputTokens,
      },
      finishReason: mapStopReason(stopReason),
    };
  }

  /**
   * Anthropic API 요청 본문 생성
   *
   * 시스템 프롬프트를 캐시 가능한 블록으로 분할하고,
   * 모델, 메시지, 도구, temperature, thinking 등의 파라미터를 포함합니다.
   *
   * @param request - 원본 요청
   * @param system - 분리된 시스템 메시지 텍스트
   * @param messages - Anthropic 형식으로 변환된 메시지 배열
   * @returns API 요청 본문 객체
   */
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
      // 시스템 프롬프트를 캐시 가능한 블록으로 분할
      body.system = this.buildCachableSystemBlocks(system);
    }
    if (request.temperature !== undefined) {
      body.temperature = request.temperature;
    }
    if (request.tools && request.tools.length > 0) {
      body.tools = toAnthropicTools(request.tools);
    }
    // Extended Thinking 설정 (Claude 모델 전용)
    if (request.thinking) {
      body.thinking = request.thinking;
    }

    return body;
  }

  /**
   * 시스템 프롬프트를 캐시 친화적인 블록으로 분할
   *
   * Anthropic의 프롬프트 캐싱은 시스템 프롬프트를 블록 단위로 캐시합니다.
   * 요청 간에 변하지 않는 정적 블록에 cache_control을 설정하면,
   * 같은 내용을 반복 전송할 때 토큰을 절약할 수 있습니다.
   *
   * 분할 규칙:
   * - "---"로 구분된 섹션을 블록으로 분할
   * - 동적 섹션("# Environment" 등)은 캐시하지 않음 (매 요청마다 변함)
   * - 정적 섹션은 cache_control: { type: "ephemeral" }을 설정
   *
   * @param system - 시스템 프롬프트 전체 텍스트
   * @returns 캐시 설정이 포함된 텍스트 블록 배열
   */
  private buildCachableSystemBlocks(
    system: string,
  ): Array<{ type: "text"; text: string; cache_control?: { type: "ephemeral" } }> {
    // "---"로 섹션을 분리
    const parts = system.split("\n\n---\n\n").filter((p) => p.trim().length > 0);

    if (parts.length <= 1) {
      // 단일 블록 — 전체를 캐시
      return [{ type: "text", text: system, cache_control: { type: "ephemeral" } }];
    }

    // 동적 섹션의 접두사 — 이 접두사로 시작하는 섹션은 캐시하지 않음
    // (매 요청마다 내용이 변하므로 캐시 효과 없음)
    const dynamicPrefixes = ["# Environment"];

    const blocks: Array<{ type: "text"; text: string; cache_control?: { type: "ephemeral" } }> = [];
    // 연속된 정적 섹션을 합쳐서 하나의 블록으로 만들기 위한 버퍼
    let staticBuffer = "";

    for (const part of parts) {
      const isDynamic = dynamicPrefixes.some((prefix) => part.trimStart().startsWith(prefix));

      if (isDynamic) {
        // 동적 섹션 발견 — 이전까지 모은 정적 버퍼를 캐시 블록으로 저장
        if (staticBuffer) {
          blocks.push({
            type: "text",
            text: staticBuffer.trim(),
            cache_control: { type: "ephemeral" }, // 캐시 활성화
          });
          staticBuffer = "";
        }
        // 동적 블록은 cache_control 없이 추가 (캐시 비활성)
        blocks.push({ type: "text", text: part.trim() });
      } else {
        // 정적 섹션 — 버퍼에 누적 (연속된 정적 섹션을 합침)
        staticBuffer += (staticBuffer ? "\n\n---\n\n" : "") + part;
      }
    }

    // 남은 정적 버퍼를 캐시 블록으로 저장
    if (staticBuffer) {
      blocks.push({
        type: "text",
        text: staticBuffer.trim(),
        cache_control: { type: "ephemeral" },
      });
    }

    return blocks;
  }

  /**
   * 캐시 통계 이벤트 발행
   *
   * Anthropic API 응답에 포함된 캐시 관련 토큰 수를 이벤트로 발행합니다.
   * - cache_creation_input_tokens: 캐시에 새로 저장된 토큰 수
   * - cache_read_input_tokens: 캐시에서 읽은 토큰 수 (비용 절감)
   *
   * 캐시 활동이 없으면 (두 값 모두 0) 이벤트를 발행하지 않습니다.
   *
   * @param usage - API 응답의 사용량 정보
   * @param model - 모델 이름
   */
  private _emitCacheStats(
    usage: {
      readonly cache_creation_input_tokens?: number;
      readonly cache_read_input_tokens?: number;
    },
    model: string,
  ): void {
    const cacheCreation = usage.cache_creation_input_tokens ?? 0;
    const cacheRead = usage.cache_read_input_tokens ?? 0;

    // 캐시 활동이 있을 때만 이벤트 발행
    if (cacheCreation > 0 || cacheRead > 0) {
      this.eventEmitter?.emit("llm:cache-stats", {
        cacheCreationInputTokens: cacheCreation,
        cacheReadInputTokens: cacheRead,
        model,
      });
    }
  }

  /**
   * 텍스트의 토큰 수를 추정
   *
   * Claude 모델은 약 4글자당 1토큰의 비율을 가집니다.
   * 정확한 계산이 아닌 빠른 근사치입니다.
   *
   * @param text - 토큰 수를 추정할 텍스트
   * @returns 추정 토큰 수
   */
  countTokens(text: string): number {
    return Math.ceil(text.length / 4);
  }

  // ─── UnifiedLLMProvider 구현 ──────────────────────────────────────

  /** 프로바이더 매니페스트 — 모델 목록, 기능, 인증 방식 */
  readonly manifest = ANTHROPIC_MANIFEST;

  /**
   * Anthropic API 연결 상태를 확인합니다.
   *
   * `/v1/models` 엔드포인트로 간단한 GET 요청을 보내
   * 인증 + 연결 상태를 검증합니다.
   */
  async healthCheck(): Promise<ProviderHealthStatus> {
    const start = Date.now();
    try {
      const response = await fetch(`${this.baseURL}/v1/models`, {
        method: "GET",
        headers: {
          "x-api-key": this.apiKey,
          "anthropic-version": "2023-06-01",
        },
        signal: AbortSignal.timeout(5_000),
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
    }
  }

  /**
   * 토큰 사용 비용을 예측합니다.
   *
   * Anthropic 모델별 가격을 기반으로 정확한 비용을 계산합니다.
   *
   * @param tokens - 토큰 사용량
   * @param modelId - 모델 ID (선택적)
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
}
