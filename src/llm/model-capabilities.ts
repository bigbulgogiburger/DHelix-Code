/** Cost per million tokens (USD) */
export interface ModelPricingInfo {
  readonly inputPerMillion: number;
  readonly outputPerMillion: number;
}

/** Capability tier — determines prompt style, context strategy, and tool call handling */
export type CapabilityTier = "high" | "medium" | "low";

/** Model capability flags — determines how requests are shaped */
export interface ModelCapabilities {
  readonly supportsTools: boolean;
  readonly supportsSystemMessage: boolean;
  readonly supportsTemperature: boolean;
  readonly supportsStreaming: boolean;
  readonly maxContextTokens: number;
  readonly maxOutputTokens: number;
  readonly tokenizer: "cl100k" | "o200k" | "llama";
  readonly useDeveloperRole: boolean;
  /** Pricing per million tokens (USD). Always present — defaults to $1/$3 for unknown models. */
  readonly pricing: ModelPricingInfo;
  /** Use max_completion_tokens instead of max_tokens (GPT-4o+, o-series, GPT-5) */
  readonly useMaxCompletionTokens: boolean;
  /** Capability tier for adaptive prompt/context strategies */
  readonly capabilityTier: CapabilityTier;
  /** Whether the provider supports explicit prompt caching (Anthropic only) */
  readonly supportsCaching: boolean;
}

/** Default pricing fallback for unknown/local models ($1/M input, $3/M output) */
const DEFAULT_PRICING: ModelPricingInfo = {
  inputPerMillion: 1,
  outputPerMillion: 3,
};

const DEFAULTS: ModelCapabilities = {
  supportsTools: true,
  supportsSystemMessage: true,
  supportsTemperature: true,
  supportsStreaming: true,
  maxContextTokens: 128_000,
  maxOutputTokens: 4096,
  tokenizer: "o200k",
  useDeveloperRole: false,
  pricing: DEFAULT_PRICING,
  useMaxCompletionTokens: true,
  capabilityTier: "medium",
  supportsCaching: false,
};

/** Known model capability overrides (partial, merged with defaults) */
const MODEL_OVERRIDES: ReadonlyArray<[RegExp, Partial<ModelCapabilities>]> = [
  // OpenAI GPT — note: gpt-4o-mini must precede gpt-4o to match correctly
  [
    /^gpt-4o-mini/i,
    {
      maxOutputTokens: 16384,
      tokenizer: "o200k",
      pricing: { inputPerMillion: 0.15, outputPerMillion: 0.6 },
      capabilityTier: "medium",
    },
  ],
  [
    /^gpt-4o/i,
    {
      maxOutputTokens: 16384,
      tokenizer: "o200k",
      pricing: { inputPerMillion: 2.5, outputPerMillion: 10 },
      capabilityTier: "high",
    },
  ],
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
  // GPT-5.1 codex models (Azure Responses API compatible)
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
  // GPT-5 mini
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
  // GPT-5 nano
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
  // GPT-5 generic (must be after specific gpt-5 variants)
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
  [
    /^gpt-3\.5/i,
    {
      maxContextTokens: 16385,
      tokenizer: "cl100k",
      useMaxCompletionTokens: false,
      pricing: { inputPerMillion: 0.5, outputPerMillion: 1.5 },
      capabilityTier: "medium",
    },
  ],
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

  // OpenAI reasoning (o-series) — no system message, no temperature, use developer role
  [
    /^o1-mini/i,
    {
      supportsSystemMessage: false,
      supportsTemperature: false,
      useDeveloperRole: true,
      maxContextTokens: 200_000,
      maxOutputTokens: 100_000,
      tokenizer: "o200k",
      pricing: { inputPerMillion: 3, outputPerMillion: 12 },
      capabilityTier: "high",
    },
  ],
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

  // Claude (via proxy) — specific variants must precede the generic /^claude/ pattern
  [
    /^claude-opus-4/i,
    {
      maxContextTokens: 200_000,
      maxOutputTokens: 16384,
      tokenizer: "cl100k",
      pricing: { inputPerMillion: 15, outputPerMillion: 75 },
      capabilityTier: "high",
      supportsCaching: true,
    },
  ],
  [
    /^claude-sonnet-4/i,
    {
      maxContextTokens: 200_000,
      maxOutputTokens: 16384,
      tokenizer: "cl100k",
      pricing: { inputPerMillion: 3, outputPerMillion: 15 },
      capabilityTier: "high",
      supportsCaching: true,
    },
  ],
  [
    /^claude-haiku-4/i,
    {
      maxContextTokens: 200_000,
      maxOutputTokens: 16384,
      tokenizer: "cl100k",
      pricing: { inputPerMillion: 0.8, outputPerMillion: 4 },
      capabilityTier: "medium",
      supportsCaching: true,
    },
  ],
  [
    /^claude-3-opus/i,
    {
      maxContextTokens: 200_000,
      maxOutputTokens: 8192,
      tokenizer: "cl100k",
      pricing: { inputPerMillion: 15, outputPerMillion: 75 },
      capabilityTier: "high",
      supportsCaching: true,
    },
  ],
  [
    /^claude-3-haiku/i,
    {
      maxContextTokens: 200_000,
      maxOutputTokens: 8192,
      tokenizer: "cl100k",
      pricing: { inputPerMillion: 0.25, outputPerMillion: 1.25 },
      capabilityTier: "medium",
      supportsCaching: true,
    },
  ],
  [
    /^claude-3\.5-sonnet/i,
    {
      maxContextTokens: 200_000,
      maxOutputTokens: 8192,
      tokenizer: "cl100k",
      pricing: { inputPerMillion: 3, outputPerMillion: 15 },
      capabilityTier: "high",
      supportsCaching: true,
    },
  ],
  [
    /^claude/i,
    {
      maxContextTokens: 200_000,
      maxOutputTokens: 8192,
      tokenizer: "cl100k",
      pricing: { inputPerMillion: 3, outputPerMillion: 15 },
      capabilityTier: "high",
      supportsCaching: true,
    },
  ],

  // Llama (base models via Ollama — no tools for base llama3)
  [
    /^llama3(?!\.)/i,
    {
      supportsTools: false,
      maxContextTokens: 8192,
      maxOutputTokens: 4096,
      tokenizer: "llama",
      pricing: { inputPerMillion: 0, outputPerMillion: 0 },
      capabilityTier: "low",
    },
  ],
  [
    /^llama3\.[1-9]/i,
    {
      maxContextTokens: 131_072,
      tokenizer: "llama",
      pricing: { inputPerMillion: 0, outputPerMillion: 0 },
      capabilityTier: "low",
    },
  ],

  // Codestral
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

  // DeepSeek
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
  [
    /^deepseek-(coder-v2|v3)/i,
    {
      maxContextTokens: 128_000,
      tokenizer: "cl100k",
      pricing: { inputPerMillion: 0.27, outputPerMillion: 1.1 },
      capabilityTier: "medium",
    },
  ],

  // Qwen
  [
    /^qwen2\.5-coder-7b/i,
    {
      maxContextTokens: 32768,
      tokenizer: "cl100k",
      pricing: { inputPerMillion: 0, outputPerMillion: 0 },
      capabilityTier: "low",
    },
  ],
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

  // Mistral
  [
    /^mistral-(large|medium)/i,
    {
      maxContextTokens: 128_000,
      tokenizer: "cl100k",
      pricing: { inputPerMillion: 2, outputPerMillion: 6 },
      capabilityTier: "medium",
    },
  ],

  // Phi (local models via Ollama)
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

  // Gemma (local models via Ollama)
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
 * Get model capabilities by name.
 * Matches against known model patterns, falls back to safe defaults.
 */
export function getModelCapabilities(modelName: string): ModelCapabilities {
  for (const [pattern, overrides] of MODEL_OVERRIDES) {
    if (pattern.test(modelName)) {
      return { ...DEFAULTS, ...overrides };
    }
  }
  return { ...DEFAULTS };
}
