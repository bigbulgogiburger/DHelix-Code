import { Box, Text } from "ink";

interface ToolCallBlockProps {
  readonly name: string;
  readonly status: "running" | "complete" | "error" | "denied";
  readonly output?: string;
  readonly isExpanded?: boolean;
}

/** Display a tool call with status indicator */
export function ToolCallBlock({ name, status, output, isExpanded = false }: ToolCallBlockProps) {
  const statusIcon = {
    running: "...",
    complete: "+",
    error: "x",
    denied: "!",
  }[status];

  const statusColor = {
    running: "yellow",
    complete: "green",
    error: "red",
    denied: "red",
  }[status] as "yellow" | "green" | "red";

  return (
    <Box flexDirection="column" marginLeft={2}>
      <Box>
        <Text color={statusColor}>[{statusIcon}]</Text>
        <Text> </Text>
        <Text bold>{name}</Text>
        {status === "running" ? <Text color="gray"> running...</Text> : null}
      </Box>
      {isExpanded && output ? (
        <Box marginLeft={4} marginTop={0}>
          <Text color="gray" wrap="truncate-end">
            {output.length > 500 ? output.slice(0, 500) + "..." : output}
          </Text>
        </Box>
      ) : null}
    </Box>
  );
}
