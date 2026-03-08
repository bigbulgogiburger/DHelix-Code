import React, { useState, useEffect } from "react";
import { Box, Text } from "ink";

import {
  getToolDisplayText,
  getToolStatusIcon,
  getToolPreview,
  SPINNER_FRAMES,
} from "../renderer/tool-display.js";

const TOOL_SPINNER_INTERVAL_MS = 200;

interface ToolCallBlockProps {
  readonly name: string;
  readonly status: "running" | "complete" | "error" | "denied";
  readonly args?: Record<string, unknown>;
  readonly output?: string;
  readonly isExpanded?: boolean;
  readonly startTime?: number;
}

function useSpinner(active: boolean): string {
  const [frame, setFrame] = useState(0);

  useEffect(() => {
    if (!active) return;
    const timer = setInterval(() => {
      setFrame((prev) => (prev + 1) % SPINNER_FRAMES.length);
    }, TOOL_SPINNER_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [active]);

  return SPINNER_FRAMES[frame];
}

/** Render a diff-like preview with colored +/- lines */
function DiffPreview({ preview }: { readonly preview: string }) {
  const lines = preview.split("\n");
  return (
    <Box flexDirection="column" marginLeft={4} marginTop={0}>
      {lines.map((line, i) => {
        if (line.startsWith("+ ")) {
          return (
            <Text key={i} color="green">
              {line}
            </Text>
          );
        }
        if (line.startsWith("- ")) {
          return (
            <Text key={i} color="red">
              {line}
            </Text>
          );
        }
        return (
          <Text key={i} color="gray">
            {line}
          </Text>
        );
      })}
    </Box>
  );
}

/** Display a tool call with status indicator, detail text, and optional diff preview */
export const ToolCallBlock = React.memo(function ToolCallBlock({
  name,
  status,
  args,
  output,
  isExpanded = false,
  startTime,
}: ToolCallBlockProps) {
  const spinnerChar = useSpinner(status === "running");
  const icon = status === "running" ? spinnerChar : getToolStatusIcon(status);
  const duration = startTime && status !== "running" ? Date.now() - startTime : undefined;
  const displayText = getToolDisplayText(name, status, args, output, duration);
  const preview = getToolPreview(name, status, args, output);

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
      {preview ? <DiffPreview preview={preview} /> : null}
      {isExpanded && output && !preview ? (
        <Box marginLeft={4} marginTop={0}>
          <Text color="gray" wrap="truncate-end">
            {output.length > 500 ? output.slice(0, 500) + "..." : output}
          </Text>
        </Box>
      ) : null}
    </Box>
  );
});
