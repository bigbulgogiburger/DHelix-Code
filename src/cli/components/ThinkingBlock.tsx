import React, { useState, useEffect } from "react";
import { Box, Text } from "ink";

const THINKING_SPINNER_FRAMES = ["|", "/", "-", "\\"];
const THINKING_SPINNER_INTERVAL_MS = 200;

interface ThinkingBlockProps {
  readonly content: string;
  readonly tokenCount?: number;
  readonly isExpanded?: boolean;
  readonly isStreaming?: boolean;
}

export const ThinkingBlock = React.memo(function ThinkingBlock({
  content,
  tokenCount,
  isExpanded = false,
  isStreaming = false,
}: ThinkingBlockProps) {
  const [expanded, setExpanded] = useState(isExpanded);
  const [spinnerFrame, setSpinnerFrame] = useState(0);

  useEffect(() => {
    setExpanded(isExpanded);
  }, [isExpanded]);

  useEffect(() => {
    if (!isStreaming) return;
    const timer = setInterval(() => {
      setSpinnerFrame((prev) => (prev + 1) % THINKING_SPINNER_FRAMES.length);
    }, THINKING_SPINNER_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [isStreaming]);

  if (!content && !isStreaming) {
    return null;
  }

  const tokenLabel = tokenCount != null ? ` (${tokenCount.toLocaleString()} tokens)` : "";

  if (!expanded) {
    return (
      <Box>
        <Text dimColor>
          {isStreaming ? THINKING_SPINNER_FRAMES[spinnerFrame] + " " : ""}
          Thinking...{tokenLabel}
        </Text>
      </Box>
    );
  }

  const lines = content.split("\n");
  const displayLines =
    lines.length > 20 ? [...lines.slice(0, 20), `... (${lines.length - 20} more lines)`] : lines;

  return (
    <Box flexDirection="column">
      <Text dimColor>
        {isStreaming ? THINKING_SPINNER_FRAMES[spinnerFrame] + " " : ""}
        Thinking{tokenLabel}:
      </Text>
      <Box marginLeft={2} flexDirection="column">
        {displayLines.map((line, i) => (
          <Text key={i} dimColor>
            {line}
          </Text>
        ))}
      </Box>
    </Box>
  );
});
