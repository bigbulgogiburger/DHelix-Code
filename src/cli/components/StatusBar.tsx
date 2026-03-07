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
}

/** Build a visual usage bar */
function usageBar(ratio: number, width = 15): string {
  const filled = Math.round(ratio * width);
  const empty = width - filled;
  return "[" + "#".repeat(filled) + "-".repeat(empty) + "]";
}

/** Status bar showing model, token usage, context %, effort level, and streaming state */
export const StatusBar = React.memo(function StatusBar({
  model,
  tokenCount,
  maxTokens,
  isStreaming,
  effortLevel,
  sessionName,
  modelName,
}: StatusBarProps) {
  const usage = maxTokens > 0 ? Math.round((tokenCount / maxTokens) * 100) : 0;
  const ratio = maxTokens > 0 ? tokenCount / maxTokens : 0;

  const usageColor = useMemo(
    () => (usage > 80 ? "red" : usage > 60 ? "yellow" : "green"),
    [usage],
  );

  const displayName = modelName ?? model;

  return (
    <Box borderStyle="single" borderColor="gray" paddingX={1} justifyContent="space-between">
      <Box gap={1}>
        <Text color="blue">{displayName}</Text>
        <Text color="gray">v{VERSION}</Text>
        {sessionName ? <Text color="gray">({sessionName})</Text> : null}
      </Box>
      <Box gap={1}>
        <Text color={usageColor}>
          {usageBar(ratio)} {usage}%
        </Text>
        {effortLevel ? <Text color="magenta">[{effortLevel}]</Text> : null}
      </Box>
      {isStreaming ? <Text color="yellow">streaming...</Text> : <Text color="gray">ready</Text>}
    </Box>
  );
});
