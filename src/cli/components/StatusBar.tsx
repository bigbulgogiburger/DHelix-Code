import { Box, Text } from "ink";

interface StatusBarProps {
  readonly model: string;
  readonly tokenCount: number;
  readonly maxTokens: number;
  readonly isStreaming: boolean;
}

/** Status bar showing model, token usage, and streaming state */
export function StatusBar({ model, tokenCount, maxTokens, isStreaming }: StatusBarProps) {
  const usage = maxTokens > 0 ? Math.round((tokenCount / maxTokens) * 100) : 0;
  const usageColor = usage > 80 ? "red" : usage > 60 ? "yellow" : "green";

  return (
    <Box borderStyle="single" borderColor="gray" paddingX={1} justifyContent="space-between">
      <Text color="blue">{model}</Text>
      <Text color={usageColor}>
        {tokenCount.toLocaleString()}/{maxTokens.toLocaleString()} tokens ({usage}%)
      </Text>
      {isStreaming ? <Text color="yellow">streaming...</Text> : <Text color="gray">ready</Text>}
    </Box>
  );
}
