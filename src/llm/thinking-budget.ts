import { type ModelCapabilities } from "./model-capabilities.js";

/**
 * Calculate thinking budget based on model capabilities and context usage.
 * Returns 0 if the model doesn't support thinking.
 */
export function calculateThinkingBudget(
  caps: ModelCapabilities,
  contextUsagePercent: number = 0,
): number {
  if (!caps.supportsThinking) return 0;

  // Use model-specific default if set
  if (caps.defaultThinkingBudget > 0) {
    // Reduce budget when context is heavily used (>70%)
    if (contextUsagePercent > 70) {
      return Math.max(1024, Math.floor(caps.defaultThinkingBudget * 0.5));
    }
    return caps.defaultThinkingBudget;
  }

  // Auto-calculate: 5% of max context, capped at 16384
  const base = Math.min(Math.floor(caps.maxContextTokens * 0.05), 16384);
  const scaleFactor = contextUsagePercent > 70 ? 0.5 : 1.0;
  return Math.max(1024, Math.floor(base * scaleFactor));
}
