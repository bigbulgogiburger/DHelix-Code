import { type TokenUsage } from "./provider.js";

/** Pricing per million tokens (USD) */
export interface ModelPricing {
  readonly inputPerMillion: number;
  readonly outputPerMillion: number;
}

/** A single tracked usage entry */
export interface TokenUsageEntry {
  readonly model: string;
  readonly promptTokens: number;
  readonly completionTokens: number;
  readonly totalTokens: number;
  readonly cost: number; // USD
  readonly timestamp: number;
  readonly iteration: number;
}

/** Aggregated cost summary */
export interface CostSummary {
  readonly totalCost: number;
  readonly totalTokens: number;
  readonly totalPromptTokens: number;
  readonly totalCompletionTokens: number;
  readonly entries: readonly TokenUsageEntry[];
  readonly modelBreakdown: ReadonlyMap<string, { readonly tokens: number; readonly cost: number }>;
}

/** Known model pricing table — cost per million tokens in USD */
const MODEL_PRICING: ReadonlyArray<[RegExp, ModelPricing]> = [
  // Anthropic Claude
  [/^claude-3\.5-sonnet/i, { inputPerMillion: 3, outputPerMillion: 15 }],
  [/^claude-3-opus/i, { inputPerMillion: 15, outputPerMillion: 75 }],
  [/^claude-3-haiku/i, { inputPerMillion: 0.25, outputPerMillion: 1.25 }],

  // OpenAI GPT
  [/^gpt-4o-mini/i, { inputPerMillion: 0.15, outputPerMillion: 0.6 }],
  [/^gpt-4o/i, { inputPerMillion: 2.5, outputPerMillion: 10 }],
  [/^gpt-4-turbo/i, { inputPerMillion: 10, outputPerMillion: 30 }],
];

/** Default pricing fallback for unknown/local models */
const DEFAULT_PRICING: ModelPricing = {
  inputPerMillion: 1,
  outputPerMillion: 3,
};

/**
 * Look up pricing for a model by name.
 * Matches against known model patterns, falls back to default pricing.
 */
export function getModelPricing(modelName: string): ModelPricing {
  for (const [pattern, pricing] of MODEL_PRICING) {
    if (pattern.test(modelName)) {
      return pricing;
    }
  }
  return { ...DEFAULT_PRICING };
}

/**
 * Calculate cost in USD for a given token usage and model.
 */
export function calculateCost(
  model: string,
  promptTokens: number,
  completionTokens: number,
): number {
  const pricing = getModelPricing(model);
  const inputCost = (promptTokens / 1_000_000) * pricing.inputPerMillion;
  const outputCost = (completionTokens / 1_000_000) * pricing.outputPerMillion;
  return inputCost + outputCost;
}

/**
 * Track cumulative LLM usage and cost across an agent session.
 *
 * Immutable entries — once recorded, entries cannot be modified.
 * Thread-safe for single-threaded Node.js usage (no concurrent mutations).
 */
export class CostTracker {
  private readonly _entries: TokenUsageEntry[] = [];

  /**
   * Record a usage entry from an LLM call.
   * Cost is calculated automatically from the model's pricing table.
   */
  addUsage(entry: Omit<TokenUsageEntry, "cost" | "timestamp">): void {
    const cost = calculateCost(entry.model, entry.promptTokens, entry.completionTokens);
    this._entries.push({
      ...entry,
      cost,
      timestamp: Date.now(),
    });
  }

  /**
   * Record usage directly from a TokenUsage object and model name.
   * Convenience method for integration with the agent loop.
   */
  addFromTokenUsage(model: string, usage: TokenUsage, iteration: number): void {
    this.addUsage({
      model,
      promptTokens: usage.promptTokens,
      completionTokens: usage.completionTokens,
      totalTokens: usage.totalTokens,
      iteration,
    });
  }

  /** Get aggregated cost summary across all recorded entries. */
  getSummary(): CostSummary {
    let totalCost = 0;
    let totalTokens = 0;
    let totalPromptTokens = 0;
    let totalCompletionTokens = 0;
    const breakdown = new Map<string, { tokens: number; cost: number }>();

    for (const entry of this._entries) {
      totalCost += entry.cost;
      totalTokens += entry.totalTokens;
      totalPromptTokens += entry.promptTokens;
      totalCompletionTokens += entry.completionTokens;

      const existing = breakdown.get(entry.model);
      if (existing) {
        existing.tokens += entry.totalTokens;
        existing.cost += entry.cost;
      } else {
        breakdown.set(entry.model, {
          tokens: entry.totalTokens,
          cost: entry.cost,
        });
      }
    }

    return {
      totalCost,
      totalTokens,
      totalPromptTokens,
      totalCompletionTokens,
      entries: [...this._entries],
      modelBreakdown: breakdown,
    };
  }

  /** Reset all tracked entries (e.g., for a new session). */
  reset(): void {
    this._entries.length = 0;
  }

  /** Number of recorded entries. */
  get entryCount(): number {
    return this._entries.length;
  }
}
