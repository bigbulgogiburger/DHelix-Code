import { type SlashCommand } from "./registry.js";
import { metrics, COUNTERS } from "../telemetry/metrics.js";
import { getModelCapabilities } from "../llm/model-capabilities.js";

/**
 * Format a number with comma separators and right-align to a given width.
 */
export function formatTokenCount(n: number, width: number): string {
  return n.toLocaleString("en-US").padStart(width);
}

/**
 * Format a dollar amount with consistent precision.
 * Uses 3 decimal places for sub-dollar amounts, 2 otherwise.
 */
export function formatCost(cost: number): string {
  if (cost === 0) return "$0.00";
  if (cost < 0.01) return `$${cost.toFixed(4)}`;
  if (cost < 1) return `$${cost.toFixed(3)}`;
  return `$${cost.toFixed(2)}`;
}

/**
 * Calculate efficiency metrics from token usage and turn count.
 */
export function calculateEfficiency(
  inputTokens: number,
  outputTokens: number,
  totalCost: number,
  turns: number,
): {
  readonly costPerTurn: number;
  readonly tokensPerTurn: number;
  readonly outputRatio: number;
} {
  const totalTokens = inputTokens + outputTokens;
  if (turns === 0) {
    return { costPerTurn: 0, tokensPerTurn: 0, outputRatio: 0 };
  }
  return {
    costPerTurn: totalCost / turns,
    tokensPerTurn: Math.round(totalTokens / turns),
    outputRatio: totalTokens > 0 ? (outputTokens / totalTokens) * 100 : 0,
  };
}

/**
 * /cost — Show detailed token usage breakdown, pricing, and efficiency metrics.
 */
export const costCommand: SlashCommand = {
  name: "cost",
  description: "Show token usage and cost breakdown",
  usage: "/cost",
  execute: async (_args, context) => {
    const inputTokens = metrics.getCounter(COUNTERS.tokensUsed, {
      type: "input",
      model: context.model,
    });
    const outputTokens = metrics.getCounter(COUNTERS.tokensUsed, {
      type: "output",
      model: context.model,
    });
    const trackedCost = metrics.getCounter(COUNTERS.tokenCost, { model: context.model });

    const caps = getModelCapabilities(context.model);
    const inputCost = (inputTokens / 1_000_000) * caps.pricing.inputPerMillion;
    const outputCost = (outputTokens / 1_000_000) * caps.pricing.outputPerMillion;
    const totalCost = trackedCost > 0 ? trackedCost : inputCost + outputCost;

    const totalTokens = inputTokens + outputTokens;

    // Count user turns from messages
    const turns = context.messages
      ? context.messages.filter((m) => m.role === "user").length
      : 0;

    const efficiency = calculateEfficiency(inputTokens, outputTokens, totalCost, turns);

    // Determine column width for token alignment
    const maxTokenStr = totalTokens.toLocaleString("en-US");
    const colWidth = Math.max(maxTokenStr.length, 6);

    const lines = [
      "Token Usage & Cost",
      "===================",
      "",
      `  Current Model: ${context.model}`,
      "",
      "  Token Breakdown:",
      `    Input:  ${formatTokenCount(inputTokens, colWidth)}  (${formatCost(inputCost)})`,
      `    Output: ${formatTokenCount(outputTokens, colWidth)}  (${formatCost(outputCost)})`,
      `    Total:  ${formatTokenCount(totalTokens, colWidth)}`,
      "",
      `  Estimated Cost: ${formatCost(totalCost)}`,
      "",
      "  Pricing:",
      `    Input:  $${caps.pricing.inputPerMillion.toFixed(2)} / 1M tokens`,
      `    Output: $${caps.pricing.outputPerMillion.toFixed(2)} / 1M tokens`,
      "",
      "  Efficiency:",
    ];

    if (turns > 0) {
      lines.push(
        `    Cost per turn: ${formatCost(efficiency.costPerTurn)}`,
        `    Tokens per turn: ~${efficiency.tokensPerTurn.toLocaleString("en-US")}`,
        `    Output ratio: ${efficiency.outputRatio.toFixed(1)}%`,
      );
    } else {
      lines.push("    No turns recorded yet.");
    }

    lines.push(
      "",
      "  Tip: Use /model to switch to a cheaper model for simple tasks.",
    );

    return {
      output: lines.join("\n"),
      success: true,
    };
  },
};
