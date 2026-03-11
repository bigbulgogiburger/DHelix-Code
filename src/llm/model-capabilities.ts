/** Cost per million tokens (USD) */
export interface ModelPricingInfo {
  readonly inputPerMillion: number;
  readonly outputPerMillion: number;
}

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
  /** Pricing per million tokens (USD). Undefined for models with unknown pricing. */
  readonly pricing?: ModelPricingInfo;
  /** Use max_completion_tokens instead of max_tokens (GPT-4o+, o-series, GPT-5) */
  readonly useMaxCompletionTokens: boolean;
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
    },
  ],
  [
    /^gpt-4o/i,
    {
      maxOutputTokens: 16384,
      tokenizer: "o200k",
      pricing: { inputPerMillion: 2.5, outputPerMillion: 10 },
    },
  ],
  [/^gpt-4\.1/i, { maxContextTokens: 1_000_000, maxOutputTokens: 32768, tokenizer: "o200k" }],
  // GPT-5.1 codex models (Azure Responses API compatible)
  [
    /^gpt-5\.1-codex/i,
    {
      maxContextTokens: 1_000_000,
      maxOutputTokens: 16384,
      tokenizer: "o200k",
      supportsTemperature: false,
    },
  ],
  [
    /^gpt-5/i,
    {
      maxContextTokens: 1_000_000,
      maxOutputTokens: 32768,
      tokenizer: "o200k",
      supportsTemperature: false,
    },
  ],
  [/^gpt-3\.5/i, { maxContextTokens: 16385, tokenizer: "cl100k", useMaxCompletionTokens: false }],
  [
    /^gpt-4-turbo/i,
    {
      maxContextTokens: 128_000,
      tokenizer: "cl100k",
      useMaxCompletionTokens: false,
      pricing: { inputPerMillion: 10, outputPerMillion: 30 },
    },
  ],
  [
    /^gpt-4(?!o|\.)/i,
    { maxContextTokens: 8192, tokenizer: "cl100k", useMaxCompletionTokens: false },
  ],

  // OpenAI reasoning (o-series) — no system message, no temperature, use developer role
  [
    /^o1/i,
    {
      supportsSystemMessage: false,
      supportsTemperature: false,
      useDeveloperRole: true,
      maxContextTokens: 200_000,
      maxOutputTokens: 100_000,
      tokenizer: "o200k",
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
    },
  ],

  // Claude (via proxy) — specific variants must precede the generic /^claude/ pattern
  [
    /^claude-3-opus/i,
    {
      maxContextTokens: 200_000,
      maxOutputTokens: 8192,
      tokenizer: "cl100k",
      pricing: { inputPerMillion: 15, outputPerMillion: 75 },
    },
  ],
  [
    /^claude-3-haiku/i,
    {
      maxContextTokens: 200_000,
      maxOutputTokens: 8192,
      tokenizer: "cl100k",
      pricing: { inputPerMillion: 0.25, outputPerMillion: 1.25 },
    },
  ],
  [
    /^claude-3\.5-sonnet/i,
    {
      maxContextTokens: 200_000,
      maxOutputTokens: 8192,
      tokenizer: "cl100k",
      pricing: { inputPerMillion: 3, outputPerMillion: 15 },
    },
  ],
  [/^claude/i, { maxContextTokens: 200_000, maxOutputTokens: 8192, tokenizer: "cl100k" }],

  // Llama (base models via Ollama — no tools for base llama3)
  [
    /^llama3(?!\.)/i,
    {
      supportsTools: false,
      maxContextTokens: 8192,
      maxOutputTokens: 4096,
      tokenizer: "llama",
    },
  ],
  [/^llama3\.[1-9]/i, { maxContextTokens: 131_072, tokenizer: "llama" }],

  // Codestral
  [/^codestral/i, { maxContextTokens: 256_000, maxOutputTokens: 8192, tokenizer: "cl100k" }],

  // DeepSeek
  [
    /^deepseek-coder(?!-v2)/i,
    {
      supportsTools: false,
      maxContextTokens: 16384,
      tokenizer: "cl100k",
    },
  ],
  [/^deepseek-(coder-v2|v3)/i, { maxContextTokens: 128_000, tokenizer: "cl100k" }],

  // Qwen
  [/^qwen2\.5-coder-7b/i, { maxContextTokens: 32768, tokenizer: "cl100k" }],
  [
    /^qwen2\.5-coder-32b/i,
    { maxContextTokens: 131_072, maxOutputTokens: 8192, tokenizer: "cl100k" },
  ],

  // Mistral
  [/^mistral-(large|medium)/i, { maxContextTokens: 128_000, tokenizer: "cl100k" }],
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
