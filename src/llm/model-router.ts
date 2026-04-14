/**
 * 모델 라우터 — 주/대체 모델 간 라우팅, 재시도, 폴백(fallback) 전환을 관리하는 모듈
 *
 * LLM API 호출 시 발생하는 다양한 에러 상황을 처리합니다:
 * - 일시적 에러(네트워크, 서버 과부하) → 지수 백오프로 재시도
 * - 과부하/Rate Limit → 즉시 대체(fallback) 모델로 전환
 * - 인증/권한 에러 → 즉시 실패 (재시도 불가)
 * - 모든 재시도 실패 → 대체 모델로 전환 시도
 *
 * 또한 모델 이름 기반으로 적절한 프로바이더(OpenAI, Anthropic 등)를
 * 자동으로 선택하는 resolveProvider 함수를 제공합니다.
 */
import {
  type LLMProvider,
  type ChatRequest,
  type ChatResponse,
  type ChatChunk,
} from "./provider.js";
import { LLMError } from "../utils/error.js";
import {
  classifyLLMError as classifyError,
  waitWithAbort as sleep,
} from "../core/error-classification.js";
import { AnthropicProvider } from "./providers/anthropic.js";
import { OpenAICompatibleClient } from "./client.js";
import { ResponsesAPIClient, isResponsesOnlyModel } from "./responses-client.js";

/** 스트리밍 폴백 경고 정보 */
export interface StreamFallbackWarning {
  /** 원래 사용하던 모델 이름 */
  readonly fromModel: string;
  /** 전환된 대체 모델 이름 */
  readonly toModel: string;
  /** 폴백 시점까지 수신한 부분 텍스트 */
  readonly partialText: string;
  /** 원본 에러 */
  readonly error: unknown;
}

/** 모델 라우터 설정 */
export interface ModelRouterConfig {
  /** 주 모델 프로바이더 — 기본적으로 사용하는 LLM 클라이언트 */
  readonly primary: LLMProvider;
  /** 주 모델 이름 */
  readonly primaryModel: string;
  /** 대체(fallback) 모델 프로바이더 — 주 모델 실패 시 사용 (선택적) */
  readonly fallback?: LLMProvider;
  /** 대체 모델 이름 */
  readonly fallbackModel?: string;
  /** 대체 모델로 전환하기 전 최대 재시도 횟수 (기본값: 3) */
  readonly maxRetries?: number;
  /** 재시도 간 기본 대기 시간(밀리초) — 지수 백오프의 기준값 (기본값: 1000) */
  readonly retryDelayMs?: number;
  /** 복잡도 임계값 (토큰 수) — 향후 복잡도 기반 라우팅에 사용 예정 */
  readonly complexityThreshold?: number;
  /** 스트리밍 중 폴백 발생 시 호출되는 콜백 (선택적) */
  readonly onStreamFallback?: (warning: StreamFallbackWarning) => void;
}

// classifyError and sleep — imported from core/error-classification.js (deduplicated)
// classifyError = classifyLLMError (aliased), sleep = waitWithAbort (aliased)

/**
 * 모델 라우터 — 주 모델과 대체 모델 간 자동 전환을 제공하는 LLM 프로바이더
 *
 * 이 클래스는 LLMProvider 인터페이스를 구현하므로,
 * 다른 코드에서는 일반 프로바이더처럼 사용할 수 있습니다.
 * 내부적으로 재시도와 폴백 로직을 처리합니다.
 *
 * 사용 예시:
 * ```typescript
 * const router = new ModelRouter({
 *   primary: openaiClient,
 *   primaryModel: "gpt-4o",
 *   fallback: anthropicClient,
 *   fallbackModel: "claude-sonnet-4-20250514",
 * });
 * const response = await router.chat(request);
 * ```
 */
export class ModelRouter implements LLMProvider {
  readonly name = "model-router";
  private readonly primary: LLMProvider;
  private readonly primaryModel: string;
  private readonly fallback: LLMProvider | undefined;
  private readonly fallbackModel: string | undefined;
  private readonly maxRetries: number;
  private readonly retryDelayMs: number;
  private readonly onStreamFallback?: (warning: StreamFallbackWarning) => void;

  /** 현재 대체 모델을 사용 중인지 여부 */
  private usingFallback = false;

  constructor(config: ModelRouterConfig) {
    this.primary = config.primary;
    this.primaryModel = config.primaryModel;
    this.fallback = config.fallback;
    this.fallbackModel = config.fallbackModel;
    this.maxRetries = config.maxRetries ?? 3;
    this.retryDelayMs = config.retryDelayMs ?? 1000;
    this.onStreamFallback = config.onStreamFallback;
  }

  /**
   * 현재 활성화된 모델 이름 반환
   * 대체 모델 사용 중이면 fallbackModel, 아니면 primaryModel
   */
  get activeModel(): string {
    return this.usingFallback && this.fallbackModel ? this.fallbackModel : this.primaryModel;
  }

  /**
   * 현재 활성화된 프로바이더 반환
   */
  private get activeProvider(): LLMProvider {
    return this.usingFallback && this.fallback ? this.fallback : this.primary;
  }

  /** 대체 모델 사용 중인지 확인 */
  get isUsingFallback(): boolean {
    return this.usingFallback;
  }

  /** 주 모델로 복원 — 대체 모델 사용을 중단하고 원래 모델로 돌아감 */
  resetToPrimary(): void {
    this.usingFallback = false;
  }

  /** 대체 모델로 강제 전환 */
  switchToFallback(): void {
    if (!this.fallback || !this.fallbackModel) {
      throw new LLMError("No fallback model configured");
    }
    this.usingFallback = true;
  }

  /**
   * 동기식 채팅 요청 — 재시도 및 폴백 로직 포함
   *
   * 처리 흐름:
   * 1. 활성 프로바이더로 요청 시도
   * 2. 에러 발생 시 에러를 분류
   * 3. 과부하(overload) → 대체 모델로 즉시 전환
   * 4. 일시적(transient) → 지수 백오프 후 재시도
   * 5. 모든 재시도 실패 → 대체 모델로 마지막 시도
   * 6. 대체 모델도 실패 → 양쪽 에러 정보를 포함한 에러 throw
   *
   * @param request - 채팅 요청
   * @returns LLM 응답
   */
  async chat(request: ChatRequest): Promise<ChatResponse> {
    const activeRequest: ChatRequest = {
      ...request,
      model: this.activeModel,
    };

    // 재시도 루프
    let lastError: unknown;
    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        return await this.activeProvider.chat(activeRequest);
      } catch (error) {
        lastError = error;
        const errorClass = classifyError(error);

        // 인증/영구 에러는 재시도해도 해결 안 됨 — 즉시 실패
        if (errorClass === "auth" || errorClass === "permanent") {
          break;
        }

        // 과부하 에러는 대체 모델로 즉시 전환 (재시도보다 효과적)
        if (errorClass === "overload" && this.canSwitchToFallback()) {
          this.usingFallback = true;
          return this.fallback!.chat({
            ...request,
            model: this.fallbackModel!,
          });
        }

        // 일시적 에러 — 지수 백오프 후 재시도 (1초 → 2초 → 4초)
        if (attempt < this.maxRetries) {
          const delay = this.retryDelayMs * Math.pow(2, attempt);
          await sleep(delay, request.signal);
        }
      }
    }

    // 모든 재시도 실패 — 마지막 수단으로 대체 모델 시도
    if (this.canSwitchToFallback() && !this.usingFallback) {
      this.usingFallback = true;
      try {
        return await this.fallback!.chat({
          ...request,
          model: this.fallbackModel!,
        });
      } catch (fallbackError) {
        // 주 모델과 대체 모델 모두 실패 — 양쪽 에러 정보를 포함
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

  /**
   * 스트리밍 채팅 요청 — 에러 시 부분 응답을 보존하며 대체 모델로 폴백
   *
   * 스트리밍은 부분적으로 데이터를 받은 후 에러가 발생할 수 있으므로,
   * 수신된 부분 텍스트를 버퍼링하고, 에러 발생 시 대체 모델로 전환하면서
   * 부분 컨텍스트를 함께 전달합니다.
   *
   * @param request - 채팅 요청
   * @yields ChatChunk — 실시간 응답 조각
   */
  async *stream(request: ChatRequest): AsyncIterable<ChatChunk> {
    const activeRequest: ChatRequest = {
      ...request,
      model: this.activeModel,
    };

    // 부분 텍스트를 버퍼링하여 폴백 시 컨텍스트를 보존
    const textParts: string[] = [];
    let streamErrored = false;
    let caughtError: unknown;

    try {
      for await (const chunk of this.activeProvider.stream(activeRequest)) {
        if (chunk.type === "text-delta" && chunk.text) {
          textParts.push(chunk.text);
        }
        yield chunk;
      }
    } catch (error) {
      streamErrored = true;
      caughtError = error;
    }

    if (!streamErrored) {
      return;
    }

    const errorClass = classifyError(caughtError);
    const partialText = textParts.join("");

    // 과부하/일시적 에러일 때 대체 모델로 폴백 (부분 응답 컨텍스트 포함)
    if (
      (errorClass === "overload" || errorClass === "transient") &&
      this.canSwitchToFallback() &&
      !this.usingFallback
    ) {
      this.usingFallback = true;

      // 폴백 경고 이벤트 발생
      const warning: StreamFallbackWarning = {
        fromModel: this.primaryModel,
        toModel: this.fallbackModel!,
        partialText,
        error: caughtError,
      };
      this.onStreamFallback?.(warning);

      // 부분 텍스트가 있으면 대체 모델에 컨텍스트로 전달
      const fallbackRequest = this.buildFallbackRequest(request, partialText);
      yield* this.fallback!.stream(fallbackRequest);
      return;
    }

    throw caughtError;
  }

  /**
   * 폴백 요청 구성 — 부분 텍스트가 있으면 어시스턴트 메시지로 추가
   *
   * 부분 응답을 대체 모델에 전달하여 이어서 생성할 수 있도록 합니다.
   */
  private buildFallbackRequest(originalRequest: ChatRequest, partialText: string): ChatRequest {
    if (!partialText) {
      return {
        ...originalRequest,
        model: this.fallbackModel!,
      };
    }

    // 부분 텍스트를 어시스턴트 메시지로 추가하여 대체 모델이 이어서 생성
    return {
      ...originalRequest,
      model: this.fallbackModel!,
      messages: [
        ...originalRequest.messages,
        {
          role: "assistant" as const,
          content: partialText,
        },
      ],
    };
  }

  /**
   * 텍스트의 토큰 수를 계산 — 현재 활성 프로바이더에 위임
   *
   * @param text - 토큰 수를 계산할 텍스트
   * @returns 토큰 수
   */
  countTokens(text: string): number {
    return this.activeProvider.countTokens(text);
  }

  /**
   * 대체 모델로 전환 가능한지 확인
   *
   * 대체 프로바이더와 모델이 설정되어 있고, 아직 전환하지 않은 경우에만 true
   */
  private canSwitchToFallback(): boolean {
    return !!this.fallback && !!this.fallbackModel && !this.usingFallback;
  }
}

/** 프로바이더 해석 옵션 */
export interface ResolveProviderOptions {
  /** API 서버 기본 URL (기본값은 모델에 따라 자동 설정) */
  readonly baseUrl?: string;
  /** API 인증 키 */
  readonly apiKey?: string;
}

/**
 * 모델 이름을 기반으로 적절한 LLM 프로바이더를 생성
 *
 * 라우팅 규칙:
 * - "claude-*" → AnthropicProvider (Anthropic Messages API 직접 호출)
 * - "gpt-5-codex", "gpt-5.1-codex-*" 등 → ResponsesAPIClient (Responses API)
 * - "gpt-*", "o1-*", "o3-*" → OpenAICompatibleClient (OpenAI Chat Completions API)
 * - 그 외 모든 모델 → OpenAICompatibleClient (localhost:11434, Ollama 기본 주소)
 *
 * @param modelName - 모델 이름
 * @param opts - 프로바이더 설정 (baseUrl, apiKey)
 * @returns 생성된 LLM 프로바이더 인스턴스
 */
export function resolveProvider(modelName: string, opts: ResolveProviderOptions = {}): LLMProvider {
  // Claude 모델 → Anthropic API 직접 호출
  if (modelName.startsWith("claude-")) {
    return new AnthropicProvider({
      apiKey: opts.apiKey,
      baseURL: opts.baseUrl,
    });
  }

  // Codex 모델 → Responses API 클라이언트 (Chat Completions API 미지원)
  if (isResponsesOnlyModel(modelName)) {
    return new ResponsesAPIClient({
      baseURL: opts.baseUrl ?? process.env.OPENAI_BASE_URL ?? "https://api.openai.com/v1",
      apiKey: opts.apiKey ?? process.env.OPENAI_API_KEY,
    });
  }

  // OpenAI 모델 (GPT, o1, o3) → OpenAI API
  if (modelName.startsWith("gpt-") || modelName.startsWith("o1-") || modelName.startsWith("o3-")) {
    return new OpenAICompatibleClient({
      baseURL: opts.baseUrl ?? "https://api.openai.com/v1",
      apiKey: opts.apiKey ?? process.env.OPENAI_API_KEY,
    });
  }

  // 기본값: OpenAI 호환 로컬 서버 (Ollama, vLLM 등)
  // localhost:11434는 Ollama의 기본 포트
  return new OpenAICompatibleClient({
    baseURL: opts.baseUrl ?? "http://localhost:11434/v1",
    apiKey: opts.apiKey,
  });
}
