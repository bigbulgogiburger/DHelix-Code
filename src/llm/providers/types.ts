/**
 * Provider Registry 타입 정의 — 플러거블 프로바이더 시스템의 핵심 인터페이스
 *
 * 이 파일은 ProviderRegistry에서 사용하는 모든 타입을 정의합니다.
 * - ProviderManifest: 프로바이더의 정적 메타데이터 (지원 모델, 기능 등)
 * - ProviderFeatures: 프로바이더가 지원하는 기능 플래그
 * - UnifiedLLMProvider: 기존 LLMProvider를 확장한 통합 인터페이스
 * - ProviderHealthStatus: 프로바이더 상태 확인 결과
 * - CostEstimate: 토큰 사용 비용 예측
 * - ModelEntry: 프로바이더가 지원하는 개별 모델 정보
 * - ProviderFactory: 프로바이더 인스턴스를 생성하는 팩토리 함수 타입
 */
import type { LLMProvider, TokenUsage } from "../provider.js";

/**
 * 프로바이더가 지원하는 기능 플래그
 *
 * 각 프로바이더마다 다른 기능을 제공하므로,
 * 이 인터페이스로 기능 차이를 명시적으로 표현합니다.
 */
export interface ProviderFeatures {
  /** Anthropic 프롬프트 캐싱 지원 여부 */
  readonly supportsCaching: boolean;
  /** Google 검색 그라운딩 지원 여부 */
  readonly supportsGrounding: boolean;
  /** 이미지 입력 지원 여부 */
  readonly supportsImageInput: boolean;
  /** 추론 트레이스 지원 여부 (o-series, Claude thinking) */
  readonly supportsReasoningTrace: boolean;
  /** 최대 동시 요청 수 */
  readonly maxConcurrentRequests: number;
  /** 레이트 리밋 전략 */
  readonly rateLimitStrategy: "token-bucket" | "sliding-window";
}

/**
 * 프로바이더가 지원하는 개별 모델 정보
 *
 * 모델 이름 패턴, 성능 티어, 컨텍스트 크기, 가격 등을 포함합니다.
 */
export interface ModelEntry {
  /** 모델 ID (예: "claude-sonnet-4-20250514") */
  readonly id: string;
  /** 성능 티어 — 프롬프트 전략에 영향 */
  readonly tier: "high" | "medium" | "low";
  /** 최대 컨텍스트 크기 (토큰 수) */
  readonly context: number;
  /** 토큰 가격 정보 (100만 토큰당 USD) */
  readonly pricing: {
    readonly input: number;
    readonly output: number;
  };
}

/**
 * 프로바이더의 정적 메타데이터 — 레지스트리에 등록할 때 사용
 *
 * 프로바이더가 어떤 모델을 지원하고, 어떤 인증 방식을 사용하며,
 * 어떤 기능을 제공하는지를 설명합니다.
 */
export interface ProviderManifest {
  /** 프로바이더 고유 ID (예: "anthropic", "openai-compatible") */
  readonly id: string;
  /** 표시용 이름 (예: "Anthropic Claude") */
  readonly displayName: string;
  /** 지원하는 모델 목록 */
  readonly models: readonly ModelEntry[];
  /** 인증 방식 */
  readonly authType: "api-key" | "oauth" | "iam" | "none";
  /** 프로바이더 기능 플래그 */
  readonly features: ProviderFeatures;
  /**
   * 모델 이름 매칭 패턴 — resolve() 시 이 패턴으로 프로바이더를 선택
   *
   * 배열 내 정규식 중 하나라도 매칭되면 이 프로바이더가 선택됩니다.
   */
  readonly modelPatterns: readonly RegExp[];
}

/**
 * 프로바이더 상태 확인 결과
 */
export interface ProviderHealthStatus {
  /** 정상 여부 */
  readonly healthy: boolean;
  /** 응답 지연 시간 (밀리초) */
  readonly latencyMs: number;
  /** 에러 메시지 (healthy가 false일 때) */
  readonly error?: string;
}

/**
 * 토큰 사용 비용 예측
 */
export interface CostEstimate {
  /** 입력 토큰 비용 (USD) */
  readonly inputCost: number;
  /** 출력 토큰 비용 (USD) */
  readonly outputCost: number;
  /** 총 비용 (USD) */
  readonly totalCost: number;
  /** 통화 단위 */
  readonly currency: "USD";
}

/**
 * 통합 LLM 프로바이더 인터페이스 — 기존 LLMProvider에 매니페스트, 상태 확인, 비용 예측 추가
 *
 * 기존 LLMProvider의 chat/stream/countTokens를 그대로 유지하면서,
 * ProviderRegistry에서 필요한 추가 기능을 제공합니다.
 */
export interface UnifiedLLMProvider extends LLMProvider {
  /** 프로바이더 메타데이터 */
  readonly manifest: ProviderManifest;

  /**
   * 프로바이더 상태 확인 — API 연결 가능 여부를 확인
   * @returns 상태 확인 결과
   */
  healthCheck(): Promise<ProviderHealthStatus>;

  /**
   * 토큰 사용 비용을 예측
   * @param tokens - 토큰 사용량
   * @returns 비용 예측 결과
   */
  estimateCost(tokens: TokenUsage): CostEstimate;
}

/**
 * 프로바이더 인스턴스를 생성하는 팩토리 함수 타입
 *
 * ProviderRegistry.register() 시 매니페스트와 함께 등록됩니다.
 * resolve() 호출 시 이 팩토리를 통해 프로바이더 인스턴스를 생성합니다.
 */
export type ProviderFactory = () => UnifiedLLMProvider;
