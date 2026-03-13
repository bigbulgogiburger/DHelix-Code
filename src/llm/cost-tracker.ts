import { type TokenUsage } from "./provider.js";
import { getModelCapabilities } from "./model-capabilities.js";

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

/**
 * Look up pricing for a model by name.
 * Delegates to model-capabilities as the single source of truth for pricing.
 */
export function getModelPricing(modelName: string): ModelPricing {
  const caps = getModelCapabilities(modelName);
  const p = caps.pricing;
  return {
    inputPerMillion: p.inputPerMillion,
    outputPerMillion: p.outputPerMillion,
  };
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
