import { type SlashCommand } from "./registry.js";
import { getModelCapabilities } from "../llm/model-capabilities.js";

/**
 * /context — Show context window usage with visual bar.
 */
export const contextCommand: SlashCommand = {
  name: "context",
  description: "Show context window usage",
  usage: "/context",
  execute: async (_args, context) => {
    const caps = getModelCapabilities(context.model);
    const maxTokens = caps.maxContextTokens;
    // Note: actual token tracking would come from ContextManager in the App
    // For now, show the model's context limits
    const barWidth = 40;
    const usedRatio = 0; // Would be calculated from actual usage
    const filledCount = Math.round(usedRatio * barWidth);
    const emptyCount = barWidth - filledCount;
    const bar = "[" + "#".repeat(filledCount) + "-".repeat(emptyCount) + "]";

    const lines = [
      "Context Window",
      "==============",
      "",
      `  Model: ${context.model}`,
      `  Max context: ${(maxTokens / 1000).toFixed(0)}K tokens`,
      `  Max output: ${(caps.maxOutputTokens / 1000).toFixed(0)}K tokens`,
      "",
      `  Usage: ${bar} ${(usedRatio * 100).toFixed(0)}%`,
      "",
      "  Tip: Use /compact to reduce context usage when approaching limits.",
    ];

    return {
      output: lines.join("\n"),
      success: true,
    };
  },
};
