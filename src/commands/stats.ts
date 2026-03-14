import { type SlashCommand } from "./registry.js";
import { metrics, COUNTERS } from "../telemetry/metrics.js";

/** Session start timestamp for duration calculation */
const sessionStartedAt = Date.now();

/** Format a duration in milliseconds to a human-readable string */
export function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}h ${minutes}m ${seconds}s`;
  }
  if (minutes > 0) {
    return `${minutes}m ${seconds}s`;
  }
  return `${seconds}s`;
}

/** Create a visual bar of a given length using block characters */
function makeBar(length: number): string {
  return "\u2588".repeat(length);
}

/** Common tool names to check for breakdown */
const KNOWN_TOOLS: readonly string[] = [
  "file_read",
  "file_edit",
  "file_write",
  "bash_exec",
  "grep_search",
  "glob_search",
  "list_dir",
  "web_search",
  "web_fetch",
  "notebook_edit",
  "mcp_tool",
  "agent",
  "task",
] as const;

/** Collect per-tool invocation counts from metrics */
export function getToolBreakdown(): ReadonlyArray<{ readonly name: string; readonly count: number }> {
  const toolCounts: Array<{ readonly name: string; readonly count: number }> = [];

  // Check known tools first
  for (const toolName of KNOWN_TOOLS) {
    const count = metrics.getCounter(COUNTERS.toolInvocations, {
      tool: toolName,
      status: "success",
    });
    if (count > 0) {
      toolCounts.push({ name: toolName, count });
    }
  }

  // Also scan counter data for any tools not in the known list
  const counterData = metrics.getCounterData();
  const toolPrefix = COUNTERS.toolInvocations.name;
  const knownSet = new Set(KNOWN_TOOLS);

  for (const key of counterData.keys()) {
    if (!key.startsWith(toolPrefix)) continue;
    // Key format: dbcode.tools.invocations{status=success,tool=xyz}
    const toolMatch = key.match(/tool=([^,}]+)/);
    const statusMatch = key.match(/status=success/);
    if (toolMatch && statusMatch) {
      const toolName = toolMatch[1];
      if (toolName === "*" || knownSet.has(toolName)) continue;
      const values = counterData.get(key);
      if (values && values.length > 0) {
        const count = values[values.length - 1].value;
        if (count > 0) {
          toolCounts.push({ name: toolName, count });
        }
      }
    }
  }

  // Sort by count descending
  return [...toolCounts].sort((a, b) => b.count - a.count);
}

/**
 * /stats — Display comprehensive session statistics.
 */
export const statsCommand: SlashCommand = {
  name: "stats",
  description: "Show usage statistics",
  usage: "/stats",
  execute: async (_args, context) => {
    // Duration
    const durationMs = Date.now() - sessionStartedAt;
    const duration = formatDuration(durationMs);

    // Tokens
    const tokensInput = metrics.getCounter(COUNTERS.tokensUsed, {
      type: "input",
      model: context.model,
    });
    const tokensOutput = metrics.getCounter(COUNTERS.tokensUsed, {
      type: "output",
      model: context.model,
    });
    const totalTokens = tokensInput + tokensOutput;

    // Cost
    const totalCost = metrics.getCounter(COUNTERS.tokenCost, { model: context.model });

    // Tool usage
    const totalTools = metrics.getCounter(COUNTERS.toolInvocations, {
      tool: "*",
      status: "success",
    });
    const toolBreakdown = getToolBreakdown();

    // User turns (from messages)
    const userTurns = context.messages
      ? context.messages.filter((m) => m.role === "user").length
      : 0;

    // Errors
    const totalErrors = metrics.getCounter(COUNTERS.errors, { category: "llm" });

    // Build visual bars for tokens
    const maxBar = 30;
    const inputBar =
      totalTokens > 0 ? Math.round((tokensInput / totalTokens) * maxBar) : 0;
    const outputBar =
      totalTokens > 0 ? Math.round((tokensOutput / totalTokens) * maxBar) : 0;

    const lines: string[] = [
      "Session Statistics",
      "==================",
      "",
      `  Duration:    ${duration}`,
      `  Model:       ${context.model}`,
      `  Session:     ${context.sessionId ?? "N/A"}`,
      "",
      "  Tokens:",
      `    Input:     ${tokensInput.toLocaleString().padEnd(10)} ${makeBar(inputBar)}`,
      `    Output:    ${tokensOutput.toLocaleString().padEnd(10)} ${makeBar(outputBar)}`,
      `    Total:     ${totalTokens.toLocaleString()}`,
      "",
      `  Cost:        $${totalCost.toFixed(2)}`,
      "",
      `  Tool Usage:  ${totalTools} invocations`,
    ];

    // Tool breakdown with visual bars
    if (toolBreakdown.length > 0) {
      const maxToolCount = toolBreakdown[0].count;
      const maxToolBar = 14;
      const maxNameLen = Math.max(...toolBreakdown.map((t) => t.name.length));

      for (const tool of toolBreakdown) {
        const barLen =
          maxToolCount > 0
            ? Math.max(1, Math.round((tool.count / maxToolCount) * maxToolBar))
            : 0;
        const paddedName = tool.name.padEnd(maxNameLen);
        lines.push(
          `    ${paddedName}  ${String(tool.count).padStart(4)}  ${makeBar(barLen)}`,
        );
      }
    }

    lines.push("");
    lines.push(`  Turns:       ${userTurns} (user messages)`);
    lines.push(`  Errors:      ${totalErrors}`);

    return {
      output: lines.join("\n"),
      success: true,
    };
  },
};
