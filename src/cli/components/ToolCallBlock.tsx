import React, { useState, useEffect } from "react";
import { Box, Text } from "ink";

import {
  getToolHeaderInfo,
  getToolPreview,
  formatDuration,
  SPINNER_FRAMES,
} from "../renderer/tool-display.js";

interface ToolCallBlockProps {
  readonly name: string;
  readonly status: "running" | "complete" | "error" | "denied";
  readonly args?: Record<string, unknown>;
  readonly output?: string;
  readonly metadata?: Readonly<Record<string, unknown>>;
  readonly isExpanded?: boolean;
  readonly startTime?: number;
}

function useSpinner(active: boolean): string {
  const [frame, setFrame] = useState(0);

  useEffect(() => {
    if (!active) return;
    const timer = setInterval(() => {
      setFrame((prev) => (prev + 1) % SPINNER_FRAMES.length);
    }, 500);
    return () => clearInterval(timer);
  }, [active]);

  return SPINNER_FRAMES[frame];
}

/** Parse a diff line into its components */
function parseDiffLine(line: string): {
  lineNum: string;
  marker: "+" | "-" | " ";
  content: string;
} {
  const match = line.match(/^(\s*\d+)\s([+-])\s(.*)$/);
  if (match) {
    return { lineNum: match[1], marker: match[2] as "+" | "-", content: match[3] };
  }
  const ctxMatch = line.match(/^(\s*\d+)\s{2}(.*)$/);
  if (ctxMatch) {
    return { lineNum: ctxMatch[1], marker: " ", content: ctxMatch[2] };
  }
  return { lineNum: "", marker: " ", content: line };
}

/** Render a diff preview with colored +/- lines */
function DiffPreview({ preview }: { readonly preview: string }) {
  const lines = preview.split("\n");
  return (
    <Box flexDirection="column" marginLeft={5}>
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
        if (lineNum) {
          return (
            <Text key={i}>
              <Text dimColor>{lineNum} </Text>
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

/** Rich tool call display with semantic header and tree connector */
export const ToolCallBlock = React.memo(function ToolCallBlock({
  name,
  status,
  args,
  output,
  metadata,
  isExpanded = false,
  startTime,
}: ToolCallBlockProps) {
  const spinnerChar = useSpinner(status === "running");
  const duration = startTime && status !== "running" ? Date.now() - startTime : undefined;
  const headerInfo = getToolHeaderInfo(name, status, args, output, duration);
  const preview = getToolPreview(name, status, args, output, metadata);

  // Determine header color override for error/denied
  const effectiveColor = status === "error" || status === "denied" ? "red" : headerInfo.color;

  return (
    <Box flexDirection="column" marginLeft={2}>
      {/* Header row: [spinner/icon] Verb(arg) */}
      <Box>
        {status === "running" && <Text color="yellow">{spinnerChar} </Text>}
        {status === "error" && <Text color="red">{"\u2717"} </Text>}
        {status === "denied" && <Text color="red">! </Text>}
        <Text bold color={effectiveColor}>
          {headerInfo.header}
        </Text>
        {duration && status !== "running" && <Text dimColor> ({formatDuration(duration)})</Text>}
      </Box>

      {/* Subtext row with tree connector ⎿ */}
      {headerInfo.subtext && (
        <Box marginLeft={1}>
          <Text dimColor>{"⎿  "}</Text>
          <Text>{headerInfo.subtext}</Text>
          {!isExpanded && preview && (
            <Text dimColor italic>
              {" (ctrl+o to expand)"}
            </Text>
          )}
        </Box>
      )}

      {/* Diff preview — only when expanded */}
      {isExpanded && preview ? <DiffPreview preview={preview} /> : null}

      {/* Raw output fallback — only when expanded and no diff */}
      {isExpanded && output && !preview ? (
        <Box marginLeft={4}>
          <Text color="gray" wrap="truncate-end">
            {output.length > 500 ? output.slice(0, 500) + "..." : output}
          </Text>
        </Box>
      ) : null}
    </Box>
  );
});
