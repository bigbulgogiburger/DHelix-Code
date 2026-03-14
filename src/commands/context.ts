import { type SlashCommand } from "./registry.js";
import { getModelCapabilities } from "../llm/model-capabilities.js";
import { countMessageTokens } from "../llm/token-counter.js";
import { AGENT_LOOP } from "../constants.js";

/**
 * Format a token count with thousands separators for display.
 */
function formatTokenCount(count: number): string {
  return count.toLocaleString("en-US");
}

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

    // Count tokens from actual conversation messages
    const messages = context.messages ?? [];
    const estimatedTokens = messages.length > 0
      ? countMessageTokens(messages)
      : 0;

    const usedRatio = maxTokens > 0 ? Math.min(estimatedTokens / maxTokens, 1) : 0;

    // Build visual progress bar
    const barWidth = 40;
    const filledCount = Math.round(usedRatio * barWidth);
    const emptyCount = barWidth - filledCount;
    const bar = "[" + "#".repeat(filledCount) + "-".repeat(emptyCount) + "]";

    // Message breakdown
    const totalMessages = messages.length;
    const userMessages = messages.filter((m) => m.role === "user").length;
    const assistantMessages = messages.filter((m) => m.role === "assistant").length;

    // Compaction threshold
    const compactionThreshold = AGENT_LOOP.compactionThreshold;
    const compactionTokens = Math.round(maxTokens * compactionThreshold);
    const tokensUntilCompaction = Math.max(0, compactionTokens - estimatedTokens);

    const lines = [
      "Context Window",
      "==============",
      "",
      `  Model: ${context.model} (${caps.capabilityTier} tier)`,
      `  Max context: ${(maxTokens / 1000).toFixed(0)}K tokens`,
      `  Max output: ${(caps.maxOutputTokens / 1000).toFixed(0)}K tokens`,
      "",
      `  Usage: ${bar} ${(usedRatio * 100).toFixed(0)}%`,
      `         ${formatTokenCount(estimatedTokens)} / ${formatTokenCount(maxTokens)} tokens`,
      "",
      `  Compaction threshold: ${(compactionThreshold * 100).toFixed(1)}%`,
      `  Tokens until compaction: ~${formatTokenCount(tokensUntilCompaction)}`,
      "",
      `  Messages: ${totalMessages} total (${userMessages} user, ${assistantMessages} assistant)`,
      "",
      "  Tip: Use /compact to reduce context usage when approaching limits.",
    ];

    return {
      output: lines.join("\n"),
      success: true,
    };
  },
};
