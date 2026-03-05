import { type SlashCommand } from "./registry.js";
import { metrics, COUNTERS } from "../telemetry/metrics.js";

/**
 * /stats — Display usage statistics and session metrics.
 */
export const statsCommand: SlashCommand = {
  name: "stats",
  description: "Show usage statistics",
  usage: "/stats",
  execute: async (_args, context) => {
    const tokensInput = metrics.getCounter(COUNTERS.tokensUsed, {
      type: "input",
      model: context.model,
    });
    const tokensOutput = metrics.getCounter(COUNTERS.tokensUsed, {
      type: "output",
      model: context.model,
    });
    const totalTools = metrics.getCounter(COUNTERS.toolInvocations, {
      tool: "*",
      status: "success",
    });
    const totalErrors = metrics.getCounter(COUNTERS.errors, { category: "llm" });
    const sessions = metrics.getCounter(COUNTERS.sessionsTotal);

    // Build visual bar for token usage
    const totalTokens = tokensInput + tokensOutput;
    const maxBar = 30;
    const inputBar = totalTokens > 0 ? Math.round((tokensInput / totalTokens) * maxBar) : 0;
    const outputBar = maxBar - inputBar;

    const lines = [
      "Usage Statistics",
      "================",
      "",
      `  Model:    ${context.model}`,
      `  Session:  ${context.sessionId ?? "N/A"}`,
      "",
      "  Tokens:",
      `    Input:  ${tokensInput.toLocaleString()}  ${"#".repeat(inputBar)}`,
      `    Output: ${tokensOutput.toLocaleString()}  ${"=".repeat(outputBar)}`,
      `    Total:  ${totalTokens.toLocaleString()}`,
      "",
      `  Sessions: ${sessions}`,
      `  Tools:    ${totalTools} invocations`,
      `  Errors:   ${totalErrors}`,
    ];

    return {
      output: lines.join("\n"),
      success: true,
    };
  },
};
