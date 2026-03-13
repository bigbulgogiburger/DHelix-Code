import React, { useMemo } from "react";
import { Box, Text } from "ink";
import { VERSION } from "../../constants.js";
import { getModelCapabilities } from "../../llm/model-capabilities.js";

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
  readonly permissionMode?: string;
  readonly verboseMode?: boolean;
  readonly thinkingEnabled?: boolean;
}

/** Calculate session cost from token counts using model-capabilities SSOT */
function calculateCost(model: string, inputTokens: number, outputTokens: number): number {
  const caps = getModelCapabilities(model);
  const pricing = caps.pricing;
  return (
    (inputTokens / 1_000_000) * pricing.inputPerMillion +
    (outputTokens / 1_000_000) * pricing.outputPerMillion
  );
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
  permissionMode,
  verboseMode,
  thinkingEnabled,
}: StatusBarProps) {
  const usage = maxTokens > 0 ? Math.round((tokenCount / maxTokens) * 100) : 0;
  const ratio = maxTokens > 0 ? tokenCount / maxTokens : 0;

  const usageColor = useMemo(() => (usage > 80 ? "red" : usage > 60 ? "yellow" : "green"), [usage]);

  const cost = useMemo(
    () => calculateCost(model, inputTokens, outputTokens),
    [model, inputTokens, outputTokens],
  );
  const costStr = formatCost(cost);

  const displayName = modelName ?? model;

  const contextWarning = usage > 80;

  return (
    <Box
      borderStyle="single"
      borderColor={contextWarning ? "red" : "gray"}
      paddingX={1}
      justifyContent="space-between"
    >
      <Box gap={1}>
        <Text color="blue">{displayName}</Text>
        <Text color="gray">v{VERSION}</Text>
        {sessionName ? <Text color="gray">({sessionName})</Text> : null}
      </Box>
      <Box gap={1}>
        <Text color={usageColor}>
          {usageBar(ratio)} {usage}%
        </Text>
        {contextWarning && (
          <Text color="red" bold>
            {"!! Context " + usage + "%"}
          </Text>
        )}
        {costStr.length > 0 && <Text color="cyan">{costStr}</Text>}
        {effortLevel ? <Text color="magenta">[{effortLevel}]</Text> : null}
        {permissionMode ? <Text color="green">[{permissionMode}]</Text> : null}
        {verboseMode ? <Text color="yellow">[Verbose]</Text> : null}
        {thinkingEnabled ? <Text color="cyan">[Thinking]</Text> : null}
      </Box>
      {isStreaming ? <Text color="yellow">streaming...</Text> : <Text color="gray">ready</Text>}
    </Box>
  );
});
