import { type SlashCommand } from "./registry.js";
import { metrics, COUNTERS } from "../telemetry/metrics.js";

/**
 * /cost — Show token usage breakdown and estimated cost.
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
    const totalCost = metrics.getCounter(COUNTERS.tokenCost, { model: context.model });

    const lines = [
      "Token Usage & Cost",
      "==================",
      "",
      `  Model: ${context.model}`,
      "",
      "  Tokens:",
      `    Input:  ${inputTokens.toLocaleString()}`,
      `    Output: ${outputTokens.toLocaleString()}`,
      `    Total:  ${(inputTokens + outputTokens).toLocaleString()}`,
      "",
      `  Estimated Cost: $${totalCost.toFixed(4)}`,
      "",
      "  Note: Cost estimates based on public pricing. Local models have zero cost.",
    ];

    return {
      output: lines.join("\n"),
      success: true,
    };
  },
};
