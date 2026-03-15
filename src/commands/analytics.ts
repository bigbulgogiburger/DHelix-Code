import { type SlashCommand } from "./registry.js";
import { metrics, COUNTERS, HISTOGRAMS } from "../telemetry/metrics.js";
import { formatDuration, getToolBreakdown } from "./stats.js";
import { formatCost } from "./cost.js";
import { getModelCapabilities } from "../llm/model-capabilities.js";
import { getTokenCacheStats } from "../llm/token-counter.js";

/** Session start timestamp for duration calculation */
const sessionStartedAt = Date.now();

/** Create a simple text-based bar chart */
function makeBar(length: number, maxLength = 20): string {
  const clamped = Math.max(0, Math.min(length, maxLength));
  return "\u2588".repeat(clamped);
}

/** Format a percentage with 1 decimal place */
function formatPercent(value: number): string {
  return `${value.toFixed(1)}%`;
}

/**
 * Collect model distribution from counter data.
 * Returns an array of { model, inputTokens, outputTokens } sorted by total tokens descending.
 */
export function getModelDistribution(): ReadonlyArray<{
  readonly model: string;
  readonly inputTokens: number;
  readonly outputTokens: number;
}> {
  const counterData = metrics.getCounterData();
  const tokenPrefix = COUNTERS.tokensUsed.name;
  const models = new Map<string, { input: number; output: number }>();

  for (const [key, values] of counterData.entries()) {
    if (!key.startsWith(tokenPrefix)) continue;
    const modelMatch = key.match(/model=([^,}]+)/);
    const typeMatch = key.match(/type=(input|output)/);
    if (!modelMatch || !typeMatch) continue;

    const model = modelMatch[1];
    const type = typeMatch[1] as "input" | "output";
    const value = values.length > 0 ? values[values.length - 1].value : 0;

    if (!models.has(model)) {
      models.set(model, { input: 0, output: 0 });
    }
    const entry = models.get(model)!;
    if (type === "input") entry.input = value;
    else entry.output = value;
  }

  return [...models.entries()]
    .map(([model, counts]) => ({
      model,
      inputTokens: counts.input,
      outputTokens: counts.output,
    }))
    .sort((a, b) => (b.inputTokens + b.outputTokens) - (a.inputTokens + a.outputTokens));
}

/**
 * Calculate tool success rate from counter data.
 */
export function getToolSuccessRate(): {
  readonly total: number;
  readonly succeeded: number;
  readonly failed: number;
  readonly rate: number;
} {
  const counterData = metrics.getCounterData();
  const toolPrefix = COUNTERS.toolInvocations.name;
  let succeeded = 0;
  let failed = 0;

  for (const [key, values] of counterData.entries()) {
    if (!key.startsWith(toolPrefix)) continue;
    const statusMatch = key.match(/status=(success|error|failure)/);
    const toolMatch = key.match(/tool=([^,}]+)/);
    if (!statusMatch || !toolMatch) continue;
    if (toolMatch[1] === "*") continue;

    const value = values.length > 0 ? values[values.length - 1].value : 0;
    if (statusMatch[1] === "success") {
      succeeded += value;
    } else {
      failed += value;
    }
  }

  const total = succeeded + failed;
  return {
    total,
    succeeded,
    failed,
    rate: total > 0 ? (succeeded / total) * 100 : 100,
  };
}

/**
 * Get average agent iterations from histogram data.
 */
export function getAverageIterations(): number {
  const histData = metrics.getHistogramData();
  const iterKey = HISTOGRAMS.agentIterations.name;

  for (const [key, values] of histData.entries()) {
    if (!key.startsWith(iterKey) && key !== iterKey) continue;
    if (values.length === 0) continue;

    const sum = values.reduce((acc, v) => acc + v.value, 0);
    return sum / values.length;
  }

  return 0;
}

/**
 * /analytics — Show detailed session analytics and performance metrics.
 */
export const analyticsCommand: SlashCommand = {
  name: "analytics",
  description: "Show detailed session analytics and performance metrics",
  usage: "/analytics",
  execute: async (_args, context) => {
    const durationMs = Date.now() - sessionStartedAt;
    const duration = formatDuration(durationMs);

    // Token totals
    const inputTokens = metrics.getCounter(COUNTERS.tokensUsed, {
      type: "input",
      model: context.model,
    });
    const outputTokens = metrics.getCounter(COUNTERS.tokensUsed, {
      type: "output",
      model: context.model,
    });
    const totalTokens = inputTokens + outputTokens;

    // Cost
    const trackedCost = metrics.getCounter(COUNTERS.tokenCost, { model: context.model });
    const caps = getModelCapabilities(context.model);
    const calculatedInputCost = (inputTokens / 1_000_000) * caps.pricing.inputPerMillion;
    const calculatedOutputCost = (outputTokens / 1_000_000) * caps.pricing.outputPerMillion;
    const totalCost = trackedCost > 0 ? trackedCost : calculatedInputCost + calculatedOutputCost;

    // Model distribution
    const modelDist = getModelDistribution();

    // Tool metrics
    const toolBreakdown = getToolBreakdown();
    const toolSuccessRate = getToolSuccessRate();

    // Average iterations
    const avgIterations = getAverageIterations();

    // Token cache stats
    const cacheStats = getTokenCacheStats();

    // User turns
    const userTurns = context.messages
      ? context.messages.filter((m) => m.role === "user").length
      : 0;

    // Errors
    const llmErrors = metrics.getCounter(COUNTERS.errors, { category: "llm" });

    // Build output
    const lines: string[] = [
      "Session Analytics",
      "==================",
      "",
      "  Overview",
      "  --------",
      `    Duration:       ${duration}`,
      `    Active Model:   ${context.model}`,
      `    Session:        ${context.sessionId ?? "N/A"}`,
      `    User Turns:     ${userTurns}`,
      "",
      "  Token Usage",
      "  -----------",
      `    Input:          ${inputTokens.toLocaleString()}`,
      `    Output:         ${outputTokens.toLocaleString()}`,
      `    Total:          ${totalTokens.toLocaleString()}`,
      `    Est. Cost:      ${formatCost(totalCost)}`,
      "",
    ];

    // Model distribution
    if (modelDist.length > 0) {
      lines.push("  Model Distribution");
      lines.push("  ------------------");
      const totalAllTokens = modelDist.reduce(
        (sum, m) => sum + m.inputTokens + m.outputTokens,
        0,
      );
      const maxModelNameLen = Math.max(...modelDist.map((m) => m.model.length), 5);

      for (const entry of modelDist) {
        const entryTotal = entry.inputTokens + entry.outputTokens;
        const pct = totalAllTokens > 0 ? (entryTotal / totalAllTokens) * 100 : 0;
        const barLen =
          totalAllTokens > 0
            ? Math.max(1, Math.round((entryTotal / totalAllTokens) * 15))
            : 0;
        const paddedName = entry.model.padEnd(maxModelNameLen);
        lines.push(
          `    ${paddedName}  ${formatPercent(pct).padStart(6)}  ${makeBar(barLen, 15)}`,
        );
      }
      lines.push("");
    }

    // Tool usage
    lines.push("  Tool Usage");
    lines.push("  ----------");
    lines.push(`    Total Invocations:  ${toolSuccessRate.total}`);
    lines.push(`    Succeeded:          ${toolSuccessRate.succeeded}`);
    lines.push(`    Failed:             ${toolSuccessRate.failed}`);
    lines.push(`    Success Rate:       ${formatPercent(toolSuccessRate.rate)}`);
    lines.push("");

    if (toolBreakdown.length > 0) {
      lines.push("  Tool Frequency");
      lines.push("  --------------");
      const maxToolCount = toolBreakdown[0].count;
      const maxNameLen = Math.max(...toolBreakdown.map((t) => t.name.length));

      for (const tool of toolBreakdown) {
        const barLen =
          maxToolCount > 0
            ? Math.max(1, Math.round((tool.count / maxToolCount) * 12))
            : 0;
        const paddedName = tool.name.padEnd(maxNameLen);
        lines.push(
          `    ${paddedName}  ${String(tool.count).padStart(4)}  ${makeBar(barLen, 12)}`,
        );
      }
      lines.push("");
    }

    // Agent performance
    lines.push("  Agent Performance");
    lines.push("  -----------------");
    lines.push(
      `    Avg Iterations/Request:  ${avgIterations > 0 ? avgIterations.toFixed(1) : "N/A"}`,
    );
    lines.push(`    LLM Errors:              ${llmErrors}`);
    lines.push("");

    // Cache stats
    lines.push("  Token Cache");
    lines.push("  -----------");
    lines.push(`    Size:       ${cacheStats.size} entries`);
    lines.push(`    Hits:       ${cacheStats.hits}`);
    lines.push(`    Misses:     ${cacheStats.misses}`);
    lines.push(
      `    Hit Rate:   ${formatPercent(cacheStats.hitRate * 100)}`,
    );
    lines.push("");

    // Activity timeline
    lines.push("  Activity Timeline");
    lines.push("  -----------------");

    const durationSec = Math.floor(durationMs / 1000);
    if (userTurns > 0 && durationSec > 0) {
      const turnsPerMin = (userTurns / (durationSec / 60)).toFixed(1);
      const tokensPerMin =
        durationSec >= 60
          ? Math.round(totalTokens / (durationSec / 60)).toLocaleString()
          : totalTokens.toLocaleString();

      lines.push(`    Turns/min:    ${turnsPerMin}`);
      lines.push(
        `    Tokens/min:   ${durationSec >= 60 ? tokensPerMin : `${tokensPerMin} (< 1 min)`}`,
      );
    } else {
      lines.push("    No activity recorded yet.");
    }

    return {
      output: lines.join("\n"),
      success: true,
    };
  },
};
