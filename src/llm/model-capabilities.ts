/**
 * 모델 능력(capabilities) 정의 — 각 LLM 모델의 특성과 제한을 관리하는 중앙 레지스트리
 *
 * 이 파일은 LLM 모델마다 다른 특성(도구 지원 여부, 컨텍스트 크기, 토큰 가격 등)을
 * 정의하고, 모델 이름으로 해당 특성을 조회하는 기능을 제공합니다.
 *
 * 주요 역할:
 * - 모델별 기능 플래그 관리 (도구 지원, 시스템 메시지 지원, 스트리밍 지원 등)
 * - 컨텍스트 윈도우 크기 및 최대 출력 토큰 수 관리
 * - 토큰 가격 정보 관리 (비용 추적에 사용)
 * - 능력 티어(tier) 분류 (high/medium/low)
 *
 * 새 모델을 추가할 때는 MODEL_OVERRIDES 배열에 정규식 패턴과 설정을 추가하세요.
 * 주의: 정규식 매칭은 배열 순서대로 이루어지므로, 더 구체적인 패턴을 먼저 배치해야 합니다.
 * (예: gpt-4o-mini가 gpt-4o보다 먼저 와야 함)
 */

/** 모델의 토큰 가격 정보 (USD 기준, 100만 토큰당) */
export interface ModelPricingInfo {
  /** 입력 토큰 100만개당 가격 (USD) */
  readonly inputPerMillion: number;
  /** 출력 토큰 100만개당 가격 (USD) */
  readonly outputPerMillion: number;
}

/**
 * 능력 티어 — 모델의 전반적인 성능 수준
 *
 * 프롬프트 스타일, 컨텍스트 전략, 도구 호출 방식을 결정하는 데 사용됩니다.
 * - "high": 최상위 모델 (GPT-4o, Claude Opus 등) — 네이티브 function calling 사용
 * - "medium": 중간 수준 (GPT-4o-mini, DeepSeek-v3 등) — 구조화된 출력 가이드 필요
 * - "low": 기본 모델 (Llama3, Phi 등) — 텍스트 파싱 폴백 사용
 */
export type CapabilityTier = "high" | "medium" | "low";

/**
 * 모델 능력 플래그 — 요청(request) 형식을 결정하는 데 사용
 *
 * 각 모델은 지원하는 기능이 다르므로, 이 플래그를 통해
 * 요청 파라미터를 동적으로 조정합니다.
 */
export interface ModelCapabilities {
  /** 도구(function calling) 지원 여부 — false이면 텍스트 파싱 전략으로 대체 */
  readonly supportsTools: boolean;
  /** system 역할 메시지 지원 여부 — false이면 user 메시지로 변환 */
  readonly supportsSystemMessage: boolean;
  /** temperature 파라미터 지원 여부 — o1/o3 추론 모델은 지원 안 함 */
  readonly supportsTemperature: boolean;
  /** 스트리밍 응답 지원 여부 */
  readonly supportsStreaming: boolean;
  /** 최대 컨텍스트 윈도우 크기 (토큰 수) — 입력+출력을 합한 최대 토큰 */
  readonly maxContextTokens: number;
  /** 최대 출력 토큰 수 — 한 번의 응답에서 생성할 수 있는 최대 토큰 */
  readonly maxOutputTokens: number;
  /**
   * 사용할 토크나이저 종류
   * - "cl100k": GPT-3.5, GPT-4, Claude 등에 사용
   * - "o200k": GPT-4o, GPT-5 등 최신 모델에 사용
   * - "llama": Llama 계열 모델에 사용
   */
  readonly tokenizer: "cl100k" | "o200k" | "llama";
  /**
   * developer 역할 사용 여부 — o1/o3 추론 모델 전용
   * true이면 system 메시지를 developer 역할로 변환
   */
  readonly useDeveloperRole: boolean;
  /** 토큰 가격 정보 (항상 존재 — 미지 모델은 $1/$3 기본값) */
  readonly pricing: ModelPricingInfo;
  /**
   * max_completion_tokens 파라미터 사용 여부
   * true: 최신 모델(GPT-4o+, o-series, GPT-5) — max_completion_tokens 사용
   * false: 레거시 모델(GPT-3.5, GPT-4) — max_tokens 사용
   */
  readonly useMaxCompletionTokens: boolean;
  /** 능력 티어 — 적응형 프롬프트/컨텍스트 전략에 사용 */
  readonly capabilityTier: CapabilityTier;
  /** 명시적 프롬프트 캐싱 지원 여부 (Anthropic만 해당) */
  readonly supportsCaching: boolean;
  /** Extended Thinking(확장 사고) 지원 여부 (Claude 모델) */
  readonly supportsThinking: boolean;
  /** 기본 사고 예산 (토큰 수, 0이면 컨텍스트 기반 자동 계산) */
  readonly defaultThinkingBudget: number;
}

/** 알 수 없거나 로컬 모델에 적용할 기본 가격 ($1/M 입력, $3/M 출력) */
const DEFAULT_PRICING: ModelPricingInfo = {
  inputPerMillion: 1,
  outputPerMillion: 3,
};

/**
 * 모든 모델에 적용되는 기본 능력 설정
 *
 * MODEL_OVERRIDES에서 일치하는 패턴이 없으면 이 기본값이 사용됩니다.
 * 대부분의 모델이 지원하는 일반적인 기능을 기본값으로 설정합니다.
 */
const DEFAULTS: ModelCapabilities = {
  supportsTools: true,
  supportsSystemMessage: true,
  supportsTemperature: true,
  supportsStreaming: true,
  maxContextTokens: 128_000,        // 128K 컨텍스트 (현대 모델의 일반적인 크기)
  maxOutputTokens: 4096,            // 4K 출력 토큰
  tokenizer: "o200k",               // 최신 OpenAI 토크나이저
  useDeveloperRole: false,
  pricing: DEFAULT_PRICING,
  useMaxCompletionTokens: true,
  capabilityTier: "medium",
  supportsCaching: false,
  supportsThinking: false,
  defaultThinkingBudget: 0,
};

/**
 * 알려진 모델별 능력 재정의(overrides) 배열
 *
 * [정규식 패턴, 기본값에서 덮어쓸 속성들] 쌍의 배열입니다.
 * 패턴 매칭은 배열 순서대로 이루어지므로:
 * - 더 구체적인 패턴을 먼저 배치해야 합니다 (예: gpt-4o-mini → gpt-4o 순서)
 * - 첫 번째로 매칭되는 패턴이 사용됩니다
 */
const MODEL_OVERRIDES: ReadonlyArray<[RegExp, Partial<ModelCapabilities>]> = [
  // ─── OpenAI GPT 시리즈 ────────────────────────────────────────────
  // gpt-4o-mini: 경량화 모델 — gpt-4o보다 저렴하지만 준수한 성능
  [
    /^gpt-4o-mini/i,
    {
      maxOutputTokens: 16384,
      tokenizer: "o200k",
      pricing: { inputPerMillion: 0.15, outputPerMillion: 0.6 },
      capabilityTier: "medium",
    },
  ],
  // gpt-4o: OpenAI의 주력 멀티모달 모델
  [
    /^gpt-4o/i,
    {
      maxOutputTokens: 16384,
      tokenizer: "o200k",
      pricing: { inputPerMillion: 2.5, outputPerMillion: 10 },
      capabilityTier: "high",
    },
  ],
  // gpt-4.1: GPT-4 후속 모델 — 100만 토큰 컨텍스트
  [
    /^gpt-4\.1/i,
    {
      maxContextTokens: 1_000_000,
      maxOutputTokens: 32768,
      tokenizer: "o200k",
      pricing: { inputPerMillion: 2, outputPerMillion: 8 },
      capabilityTier: "high",
    },
  ],
  // gpt-5.1-codex: 코드 특화 모델 (Azure Responses API 호환)
  [
    /^gpt-5\.1-codex/i,
    {
      maxContextTokens: 400_000,
      maxOutputTokens: 100_000,
      tokenizer: "o200k",
      supportsTemperature: true,
      pricing: { inputPerMillion: 0.25, outputPerMillion: 2 },
      capabilityTier: "high",
    },
  ],
  // gpt-5-mini: GPT-5의 경량 버전
  [
    /^gpt-5(\.\d+)?-mini/i,
    {
      maxContextTokens: 400_000,
      maxOutputTokens: 128_000,
      tokenizer: "o200k",
      pricing: { inputPerMillion: 0.25, outputPerMillion: 2 },
      capabilityTier: "medium",
    },
  ],
  // gpt-5-nano: GPT-5의 초경량 버전 — 가장 저렴
  [
    /^gpt-5(\.\d+)?-nano/i,
    {
      maxContextTokens: 400_000,
      maxOutputTokens: 128_000,
      tokenizer: "o200k",
      pricing: { inputPerMillion: 0.05, outputPerMillion: 0.4 },
      capabilityTier: "medium",
    },
  ],
  // gpt-5 범용: 가장 뒤에 배치 (gpt-5-mini, gpt-5-nano 등이 먼저 매칭되도록)
  [
    /^gpt-5/i,
    {
      maxContextTokens: 400_000,
      maxOutputTokens: 128_000,
      tokenizer: "o200k",
      supportsTemperature: true,
      pricing: { inputPerMillion: 2, outputPerMillion: 8 },
      capabilityTier: "high",
    },
  ],
  // gpt-3.5: 레거시 모델 — cl100k 토크나이저, max_tokens 사용
  [
    /^gpt-3\.5/i,
    {
      maxContextTokens: 16385,
      tokenizer: "cl100k",
      useMaxCompletionTokens: false,   // 레거시 모델이므로 max_tokens 사용
      pricing: { inputPerMillion: 0.5, outputPerMillion: 1.5 },
      capabilityTier: "medium",
    },
  ],
  // gpt-4-turbo: GPT-4의 고속 버전 — 128K 컨텍스트
  [
    /^gpt-4-turbo/i,
    {
      maxContextTokens: 128_000,
      tokenizer: "cl100k",
      useMaxCompletionTokens: false,
      pricing: { inputPerMillion: 10, outputPerMillion: 30 },
      capabilityTier: "high",
    },
  ],
  // gpt-4 (기본): 레거시 GPT-4 — 8K 컨텍스트, 가장 비쌈
  // 정규식에서 gpt-4o와 gpt-4.x를 제외하기 위해 부정 전방탐색 사용
  [
    /^gpt-4(?!o|\.)/i,
    {
      maxContextTokens: 8192,
      tokenizer: "cl100k",
      useMaxCompletionTokens: false,
      pricing: { inputPerMillion: 30, outputPerMillion: 60 },
      capabilityTier: "high",
    },
  ],

  // ─── OpenAI 추론(reasoning) 모델 (o-시리즈) ──────────────────────
  // 이 모델들은 시스템 메시지를 지원하지 않고, temperature도 사용 불가
  // 대신 developer 역할을 통해 지시사항을 전달

  // o1-mini: 소형 추론 모델
  [
    /^o1-mini/i,
    {
      supportsSystemMessage: false,    // system 역할 미지원
      supportsTemperature: false,      // temperature 파라미터 미지원
      useDeveloperRole: true,          // developer 역할로 시스템 메시지 전달
      maxContextTokens: 200_000,
      maxOutputTokens: 100_000,
      tokenizer: "o200k",
      pricing: { inputPerMillion: 3, outputPerMillion: 12 },
      capabilityTier: "high",
    },
  ],
  // o1: 대형 추론 모델
  [
    /^o1/i,
    {
      supportsSystemMessage: false,
      supportsTemperature: false,
      useDeveloperRole: true,
      maxContextTokens: 200_000,
      maxOutputTokens: 100_000,
      tokenizer: "o200k",
      pricing: { inputPerMillion: 15, outputPerMillion: 60 },
      capabilityTier: "high",
    },
  ],
  // o3-mini: 소형 차세대 추론 모델
  [
    /^o3-mini/i,
    {
      supportsSystemMessage: false,
      supportsTemperature: false,
      useDeveloperRole: true,
      maxContextTokens: 200_000,
      maxOutputTokens: 100_000,
      tokenizer: "o200k",
      pricing: { inputPerMillion: 1.1, outputPerMillion: 4.4 },
      capabilityTier: "high",
    },
  ],
  // o3: 대형 차세대 추론 모델
  [
    /^o3/i,
    {
      supportsSystemMessage: false,
      supportsTemperature: false,
      useDeveloperRole: true,
      maxContextTokens: 200_000,
      maxOutputTokens: 100_000,
      tokenizer: "o200k",
      pricing: { inputPerMillion: 10, outputPerMillion: 40 },
      capabilityTier: "high",
    },
  ],

  // ─── Anthropic Claude 시리즈 ──────────────────────────────────────
  // Claude 모델은 프롬프트 캐싱과 Extended Thinking을 지원
  // 구체적인 패턴이 범용 /^claude/ 패턴보다 먼저 와야 함

  // Claude Opus 4: 최상위 모델 — 가장 깊은 추론 능력
  [
    /^claude-opus-4/i,
    {
      maxContextTokens: 200_000,
      maxOutputTokens: 16384,
      tokenizer: "cl100k",
      pricing: { inputPerMillion: 15, outputPerMillion: 75 },
      capabilityTier: "high",
      supportsCaching: true,          // Anthropic 프롬프트 캐싱 지원
      supportsThinking: true,         // Extended Thinking 지원
      defaultThinkingBudget: 16384,   // 사고 예산 16K 토큰
    },
  ],
  // Claude Sonnet 4: 균형 잡힌 모델 — 성능과 비용의 최적 균형
  [
    /^claude-sonnet-4/i,
    {
      maxContextTokens: 200_000,
      maxOutputTokens: 16384,
      tokenizer: "cl100k",
      pricing: { inputPerMillion: 3, outputPerMillion: 15 },
      capabilityTier: "high",
      supportsCaching: true,
      supportsThinking: true,
      defaultThinkingBudget: 10000,
    },
  ],
  // Claude Haiku 4: 경량 고속 모델 — 가장 저렴하고 빠름
  [
    /^claude-haiku-4/i,
    {
      maxContextTokens: 200_000,
      maxOutputTokens: 16384,
      tokenizer: "cl100k",
      pricing: { inputPerMillion: 0.8, outputPerMillion: 4 },
      capabilityTier: "medium",
      supportsCaching: true,
      supportsThinking: true,
      defaultThinkingBudget: 5000,
    },
  ],
  // Claude 3 Opus: 이전 세대 최상위 모델
  [
    /^claude-3-opus/i,
    {
      maxContextTokens: 200_000,
      maxOutputTokens: 8192,
      tokenizer: "cl100k",
      pricing: { inputPerMillion: 15, outputPerMillion: 75 },
      capabilityTier: "high",
      supportsCaching: true,
      supportsThinking: true,
      defaultThinkingBudget: 16384,
    },
  ],
  // Claude 3 Haiku: 이전 세대 경량 모델
  [
    /^claude-3-haiku/i,
    {
      maxContextTokens: 200_000,
      maxOutputTokens: 8192,
      tokenizer: "cl100k",
      pricing: { inputPerMillion: 0.25, outputPerMillion: 1.25 },
      capabilityTier: "medium",
      supportsCaching: true,
      supportsThinking: true,
      defaultThinkingBudget: 5000,
    },
  ],
  // Claude 3.5 Sonnet: 이전 세대 균형 모델
  [
    /^claude-3\.5-sonnet/i,
    {
      maxContextTokens: 200_000,
      maxOutputTokens: 8192,
      tokenizer: "cl100k",
      pricing: { inputPerMillion: 3, outputPerMillion: 15 },
      capabilityTier: "high",
      supportsCaching: true,
      supportsThinking: true,
      defaultThinkingBudget: 10000,
    },
  ],
  // Claude 범용 패턴: 위에서 매칭되지 않은 모든 Claude 모델
  [
    /^claude/i,
    {
      maxContextTokens: 200_000,
      maxOutputTokens: 8192,
      tokenizer: "cl100k",
      pricing: { inputPerMillion: 3, outputPerMillion: 15 },
      capabilityTier: "high",
      supportsCaching: true,
      supportsThinking: true,
      defaultThinkingBudget: 10000,
    },
  ],

  // ─── Meta Llama 시리즈 (주로 Ollama를 통한 로컬 실행) ────────────

  // llama3 기본: 도구 지원 없음, 8K 컨텍스트
  // 정규식에서 llama3.x를 제외하기 위해 부정 전방탐색 사용
  [
    /^llama3(?!\.)/i,
    {
      supportsTools: false,            // 기본 llama3는 function calling 미지원
      maxContextTokens: 8192,
      maxOutputTokens: 4096,
      tokenizer: "llama",
      pricing: { inputPerMillion: 0, outputPerMillion: 0 },  // 로컬 실행이므로 무료
      capabilityTier: "low",
    },
  ],
  // llama3.1+: 도구 지원, 131K 컨텍스트
  [
    /^llama3\.[1-9]/i,
    {
      maxContextTokens: 131_072,
      tokenizer: "llama",
      pricing: { inputPerMillion: 0, outputPerMillion: 0 },
      capabilityTier: "low",
    },
  ],

  // ─── Mistral Codestral ────────────────────────────────────────────
  // 코드 특화 모델 — 256K 컨텍스트
  [
    /^codestral/i,
    {
      maxContextTokens: 256_000,
      maxOutputTokens: 8192,
      tokenizer: "cl100k",
      pricing: { inputPerMillion: 0.3, outputPerMillion: 0.9 },
      capabilityTier: "low",
    },
  ],

  // ─── DeepSeek 시리즈 ──────────────────────────────────────────────
  // deepseek-coder (v1): 도구 미지원, 16K 컨텍스트
  [
    /^deepseek-coder(?!-v2)/i,
    {
      supportsTools: false,
      maxContextTokens: 16384,
      tokenizer: "cl100k",
      pricing: { inputPerMillion: 0.27, outputPerMillion: 1.1 },
      capabilityTier: "low",
    },
  ],
  // deepseek-coder-v2 / deepseek-v3: 도구 지원, 128K 컨텍스트
  [
    /^deepseek-(coder-v2|v3)/i,
    {
      maxContextTokens: 128_000,
      tokenizer: "cl100k",
      pricing: { inputPerMillion: 0.27, outputPerMillion: 1.1 },
      capabilityTier: "medium",
    },
  ],

  // ─── Alibaba Qwen 시리즈 ─────────────────────────────────────────
  // qwen2.5-coder-7b: 소형 코드 모델 — 32K 컨텍스트
  [
    /^qwen2\.5-coder-7b/i,
    {
      maxContextTokens: 32768,
      tokenizer: "cl100k",
      pricing: { inputPerMillion: 0, outputPerMillion: 0 },
      capabilityTier: "low",
    },
  ],
  // qwen2.5-coder-32b: 대형 코드 모델 — 131K 컨텍스트
  [
    /^qwen2\.5-coder-32b/i,
    {
      maxContextTokens: 131_072,
      maxOutputTokens: 8192,
      tokenizer: "cl100k",
      pricing: { inputPerMillion: 0, outputPerMillion: 0 },
      capabilityTier: "low",
    },
  ],

  // ─── Mistral AI 시리즈 ────────────────────────────────────────────
  // mistral-large / mistral-medium: 범용 모델
  [
    /^mistral-(large|medium)/i,
    {
      maxContextTokens: 128_000,
      tokenizer: "cl100k",
      pricing: { inputPerMillion: 2, outputPerMillion: 6 },
      capabilityTier: "medium",
    },
  ],

  // ─── Microsoft Phi 시리즈 (로컬 모델) ─────────────────────────────
  // 소형 언어 모델 — 제한된 컨텍스트
  [
    /^phi/i,
    {
      maxContextTokens: 4096,
      maxOutputTokens: 2048,
      tokenizer: "cl100k",
      pricing: { inputPerMillion: 0, outputPerMillion: 0 },
      capabilityTier: "low",
    },
  ],

  // ─── Google Gemma 시리즈 (로컬 모델) ──────────────────────────────
  // 소형 오픈 모델 — 8K 컨텍스트
  [
    /^gemma/i,
    {
      maxContextTokens: 8192,
      maxOutputTokens: 4096,
      tokenizer: "cl100k",
      pricing: { inputPerMillion: 0, outputPerMillion: 0 },
      capabilityTier: "low",
    },
  ],
];

/**
 * 모델 이름으로 능력 정보를 조회
 *
 * MODEL_OVERRIDES 배열에서 모델 이름과 일치하는 첫 번째 패턴을 찾고,
 * 해당 재정의 값을 기본값(DEFAULTS)에 병합하여 반환합니다.
 * 일치하는 패턴이 없으면 기본값을 그대로 반환합니다.
 *
 * @param modelName - 모델 이름 (예: "gpt-4o", "claude-sonnet-4-20250514")
 * @returns 해당 모델의 능력 정보
 */
export function getModelCapabilities(modelName: string): ModelCapabilities {
  for (const [pattern, overrides] of MODEL_OVERRIDES) {
    if (pattern.test(modelName)) {
      // 기본값에 모델 특화 설정을 덮어쓰기(spread)하여 반환
      return { ...DEFAULTS, ...overrides };
    }
  }
  // 알 수 없는 모델 — 안전한 기본값 사용
  return { ...DEFAULTS };
}
