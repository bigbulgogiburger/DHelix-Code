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
import { AnthropicProvider } from "./providers/anthropic.js";
import { OpenAICompatibleClient } from "./client.js";
import { ResponsesAPIClient, isResponsesOnlyModel } from "./responses-client.js";

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
}

/**
 * 에러 분류 — 재시도/폴백 결정에 사용
 *
 * - "transient": 일시적 에러 (타임아웃, 네트워크) → 재시도 가능
 * - "overload": 과부하/Rate Limit → 대체 모델로 즉시 전환
 * - "auth": 인증/권한 에러 → 재시도 불가
 * - "permanent": 영구적 에러 → 재시도 불가
 */
type ErrorClass = "transient" | "overload" | "auth" | "permanent";

/**
 * 에러를 분류하여 적절한 처리 방식을 결정
 *
 * 에러 메시지에 포함된 키워드를 기반으로 에러 종류를 분류합니다.
 *
 * @param error - 분류할 에러 객체
 * @returns 에러 분류 결과
 */
function classifyError(error: unknown): ErrorClass {
  if (!(error instanceof Error)) return "permanent";

  const message = error.message.toLowerCase();

  // Rate Limit 또는 과부하 — 대체 모델로 즉시 전환하는 것이 효과적
  if (
    message.includes("rate limit") ||
    message.includes("429") ||
    message.includes("overload") ||
    message.includes("503") ||
    message.includes("capacity")
  ) {
    return "overload";
  }

  // 일시적 네트워크 에러 — 재시도하면 해결될 가능성 높음
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

  // 인증/권한 에러 — 재시도해도 해결 안 됨 (API 키 확인 필요)
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
 * 지정된 밀리초만큼 대기 — AbortSignal로 취소 가능
 *
 * @param ms - 대기할 밀리초
 * @param signal - 취소 신호 (사용자가 Esc를 누르면 대기 중단)
 */
function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    // 이미 취소된 상태이면 즉시 reject
    if (signal?.aborted) {
      reject(new LLMError("Request aborted"));
      return;
    }

    const timer = setTimeout(resolve, ms);
    // 대기 중 취소 신호가 오면 타이머를 정리하고 reject
    signal?.addEventListener("abort", () => {
      clearTimeout(timer);
      reject(new LLMError("Request aborted"));
    });
  });
}

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

  /** 현재 대체 모델을 사용 중인지 여부 */
  private usingFallback = false;

  constructor(config: ModelRouterConfig) {
    this.primary = config.primary;
    this.primaryModel = config.primaryModel;
    this.fallback = config.fallback;
    this.fallbackModel = config.fallbackModel;
    this.maxRetries = config.maxRetries ?? 3;
    this.retryDelayMs = config.retryDelayMs ?? 1000;
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
   * 스트리밍 채팅 요청 — 에러 시 대체 모델로 폴백
   *
   * 스트리밍은 부분적으로 데이터를 받은 후 에러가 발생할 수 있으므로,
   * 재시도보다는 대체 모델로의 폴백에 중점을 둡니다.
   *
   * @param request - 채팅 요청
   * @yields ChatChunk — 실시간 응답 조각
   */
  async *stream(request: ChatRequest): AsyncIterable<ChatChunk> {
    const activeRequest: ChatRequest = {
      ...request,
      model: this.activeModel,
    };

    try {
      yield* this.activeProvider.stream(activeRequest);
    } catch (error) {
      const errorClass = classifyError(error);

      // 과부하/일시적 에러일 때 대체 모델로 폴백
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
