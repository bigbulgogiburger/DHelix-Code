import { Text, Box } from "ink";
import React from "react";
import { renderMarkdown, hasMarkdown } from "../renderer/markdown.js";

interface StreamingMessageProps {
  readonly text: string;
  readonly isComplete: boolean;
  readonly enableMarkdown?: boolean;
}

/** Streaming assistant message with progressive markdown rendering */
export const StreamingMessage = React.memo(function StreamingMessage({
  text,
  isComplete,
  enableMarkdown = true,
}: StreamingMessageProps) {
  if (!text) {
    return null;
  }

  const shouldRenderMarkdown = isComplete && enableMarkdown && hasMarkdown(text);
  const displayText = shouldRenderMarkdown ? renderMarkdown(text) : text;

  return (
    <Box flexDirection="column">
      <Text color="green" bold>
        assistant:{" "}
      </Text>
      <Text>{displayText}</Text>
      {!isComplete ? <Text color="gray">{"▌"}</Text> : null}
    </Box>
  );
});
