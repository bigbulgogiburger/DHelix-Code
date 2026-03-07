import { useState, useEffect } from "react";
import { Box, Text } from "ink";

import {
  getToolDisplayText,
  getToolStatusIcon,
  SPINNER_FRAMES,
  SPINNER_INTERVAL_MS,
} from "../renderer/tool-display.js";

interface ToolCallBlockProps {
  readonly name: string;
  readonly status: "running" | "complete" | "error" | "denied";
  readonly args?: Record<string, unknown>;
  readonly output?: string;
  readonly isExpanded?: boolean;
}

function useSpinner(active: boolean): string {
  const [frame, setFrame] = useState(0);

  useEffect(() => {
    if (!active) return;
    const timer = setInterval(() => {
      setFrame((prev) => (prev + 1) % SPINNER_FRAMES.length);
    }, SPINNER_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [active]);

  return SPINNER_FRAMES[frame];
}

/** Display a tool call with status indicator */
export function ToolCallBlock({
  name,
  status,
  args,
  output,
  isExpanded = false,
}: ToolCallBlockProps) {
  const spinnerChar = useSpinner(status === "running");
  const icon = status === "running" ? spinnerChar : getToolStatusIcon(status);
  const displayText = getToolDisplayText(name, status, args, output);

  const statusColor = {
    running: "yellow",
    complete: "green",
    error: "red",
    denied: "red",
  }[status] as "yellow" | "green" | "red";

  return (
    <Box flexDirection="column" marginLeft={2}>
      <Box>
        <Text color={statusColor}>[{icon}]</Text>
        <Text> </Text>
        <Text bold>{displayText}</Text>
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
