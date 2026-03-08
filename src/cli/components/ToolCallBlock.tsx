import React, { useState, useEffect } from "react";
import { Box, Text } from "ink";

import {
  getToolDisplayText,
  getToolStatusIcon,
  getToolPreview,
  SPINNER_FRAMES,
} from "../renderer/tool-display.js";

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
    // 500ms interval to reduce re-render frequency (was 200ms)
    const timer = setInterval(() => {
      setFrame((prev) => (prev + 1) % SPINNER_FRAMES.length);
    }, 500);
    return () => clearInterval(timer);
  }, [active]);

  return SPINNER_FRAMES[frame];
}

/** Parse a diff line into its components: line number, marker (+/-/space), and content */
function parseDiffLine(line: string): { lineNum: string; marker: "+" | "-" | " "; content: string } {
  // Match pattern: optional leading spaces + digits + space + marker + space + content
  // e.g. "  107 - old code" or "  108 + new code" or "  …"
  const match = line.match(/^(\s*\d+)\s([+-])\s(.*)$/);
  if (match) {
    return { lineNum: match[1], marker: match[2] as "+" | "-", content: match[3] };
  }
  // Context line with line number: "  109   code"
  const ctxMatch = line.match(/^(\s*\d+)\s{2}(.*)$/);
  if (ctxMatch) {
    return { lineNum: ctxMatch[1], marker: " ", content: ctxMatch[2] };
  }
  return { lineNum: "", marker: " ", content: line };
}

/** Render a diff-like preview with line numbers and colored +/- lines */
function DiffPreview({ preview }: { readonly preview: string }) {
  const lines = preview.split("\n");
  return (
    <Box flexDirection="column" marginLeft={4} marginTop={0}>
      {lines.map((line, i) => {
        const { lineNum, marker, content } = parseDiffLine(line);
        if (marker === "+") {
          return (
            <Text key={i}>
              <Text dimColor>{lineNum} </Text>
              <Text color="green">+ {content}</Text>
            </Text>
          );
        }
        if (marker === "-") {
          return (
            <Text key={i}>
              <Text dimColor>{lineNum} </Text>
              <Text color="red">- {content}</Text>
            </Text>
          );
        }
        // Context or overflow line
        if (lineNum) {
          return (
            <Text key={i}>
              <Text dimColor>{lineNum}   </Text>
              <Text color="gray">{content}</Text>
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
