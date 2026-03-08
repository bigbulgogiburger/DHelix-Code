import React, { useMemo } from "react";
import { Box, Text } from "ink";
import { VERSION } from "../../constants.js";

interface StatusBarProps {
  readonly model: string;
  readonly tokenCount: number;
  readonly maxTokens: number;
  readonly isStreaming: boolean;
  readonly effortLevel?: string;
  readonly sessionName?: string;
  readonly modelName?: string;
  readonly inputTokens?: number;
  readonly outputTokens?: number;
}

/** Token pricing per 1M tokens (USD) — input / output */
const MODEL_PRICING: Record<string, readonly [number, number]> = {
  // GPT-4.1 series (2025-04)
  "gpt-4.1": [2.0, 8.0],
  "gpt-4.1-mini": [0.4, 1.6],
  "gpt-4.1-nano": [0.1, 0.4],
  // GPT-4o series
  "gpt-4o": [2.5, 10],
  "gpt-4o-mini": [0.15, 0.6],
  // GPT-4 legacy
  "gpt-4-turbo": [10, 30],
  "gpt-4": [30, 60],
  "gpt-3.5-turbo": [0.5, 1.5],
  // Claude
  "claude-opus-4-6": [15, 75],
  "claude-sonnet-4-6": [3, 15],
  "claude-haiku-4-5-20251001": [0.8, 4],
  "claude-3-5-sonnet-20241022": [3, 15],
  "claude-3-5-haiku-20241022": [0.8, 4],
  "claude-3-opus-20240229": [15, 75],
  // OpenAI reasoning
  "o1": [15, 60],
  "o1-mini": [3, 12],
  "o3-mini": [1.1, 4.4],
};

/** Calculate session cost from token counts */
function calculateCost(model: string, inputTokens: number, outputTokens: number): number {
  // Try exact match, then prefix match
  const pricing = MODEL_PRICING[model] ?? Object.entries(MODEL_PRICING).find(([key]) => model.startsWith(key))?.[1];
  if (!pricing) return 0;
  const [inputPricePerM, outputPricePerM] = pricing;
  return (inputTokens / 1_000_000) * inputPricePerM + (outputTokens / 1_000_000) * outputPricePerM;
}

/** Format cost as dollar string */
function formatCost(cost: number): string {
  if (cost === 0) return "";
  if (cost < 0.01) return `$${cost.toFixed(4)}`;
  return `$${cost.toFixed(2)}`;
}

/** Build a visual usage bar */
function usageBar(ratio: number, width = 15): string {
  const filled = Math.round(ratio * width);
  const empty = width - filled;
  return "[" + "#".repeat(filled) + "-".repeat(empty) + "]";
}

/** Status bar showing model, token usage, context %, cost, effort level, and streaming state */
export const StatusBar = React.memo(function StatusBar({
  model,
  tokenCount,
  maxTokens,
  isStreaming,
  effortLevel,
  sessionName,
  modelName,
  inputTokens = 0,
  outputTokens = 0,
}: StatusBarProps) {
  const usage = maxTokens > 0 ? Math.round((tokenCount / maxTokens) * 100) : 0;
  const ratio = maxTokens > 0 ? tokenCount / maxTokens : 0;

  const usageColor = useMemo(
    () => (usage > 80 ? "red" : usage > 60 ? "yellow" : "green"),
    [usage],
  );

  const cost = useMemo(() => calculateCost(model, inputTokens, outputTokens), [model, inputTokens, outputTokens]);
  const costStr = formatCost(cost);

  const displayName = modelName ?? model;

  const contextWarning = usage > 80;

  return (
    <Box borderStyle="single" borderColor={contextWarning ? "red" : "gray"} paddingX={1} justifyContent="space-between">
      <Box gap={1}>
        <Text color="blue">{displayName}</Text>
        <Text color="gray">v{VERSION}</Text>
        {sessionName ? <Text color="gray">({sessionName})</Text> : null}
      </Box>
      <Box gap={1}>
        <Text color={usageColor}>
          {usageBar(ratio)} {usage}%
        </Text>
        {contextWarning && <Text color="red" bold>{"!! Context " + usage + "%"}</Text>}
        {costStr.length > 0 && <Text color="cyan">{costStr}</Text>}
        {effortLevel ? <Text color="magenta">[{effortLevel}]</Text> : null}
      </Box>
      {isStreaming ? <Text color="yellow">streaming...</Text> : <Text color="gray">ready</Text>}
    </Box>
  );
});
