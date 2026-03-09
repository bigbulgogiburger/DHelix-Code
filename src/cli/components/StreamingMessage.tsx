import { Text, Box } from "ink";
import React, { useMemo } from "react";
import { renderMarkdown, hasMarkdown } from "../renderer/markdown.js";

interface StreamingMessageProps {
  readonly text: string;
  readonly isComplete: boolean;
  readonly enableMarkdown?: boolean;
}

/**
 * Split streaming text into a renderable (complete) part and a raw (incomplete) part.
 * Complete code blocks (paired ```) and complete paragraphs (double newline separated)
 * are rendered as markdown. The trailing incomplete portion is shown as raw text.
 */
function partialRenderMarkdown(text: string): { rendered: string; raw: string } {
  const codeBlockCount = (text.match(/```/g) || []).length;
  const isInCodeBlock = codeBlockCount % 2 !== 0;

  if (isInCodeBlock) {
    // Find the last unmatched ``` — everything before it is complete
    const lastCodeBlockStart = text.lastIndexOf("```");
    const completePart = text.slice(0, lastCodeBlockStart);
    const incompletePart = text.slice(lastCodeBlockStart);

    return {
      rendered:
        completePart.length > 0 && hasMarkdown(completePart)
          ? renderMarkdown(completePart)
          : completePart,
      raw: incompletePart,
    };
  }

  // Not in a code block — split on last double newline (paragraph boundary)
  const lastParaBreak = text.lastIndexOf("\n\n");
  if (lastParaBreak === -1) {
    // Single paragraph, no complete paragraphs yet
    return { rendered: "", raw: text };
  }

  const completePart = text.slice(0, lastParaBreak);
  const incompletePart = text.slice(lastParaBreak);

  return {
    rendered: hasMarkdown(completePart) ? renderMarkdown(completePart) : completePart,
    raw: incompletePart,
  };
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

  const { rendered, raw } = useMemo(() => {
    if (!enableMarkdown || !hasMarkdown(text)) {
      return { rendered: "", raw: text };
    }
    if (isComplete) {
      return { rendered: renderMarkdown(text), raw: "" };
    }
    return partialRenderMarkdown(text);
  }, [text, isComplete, enableMarkdown]);

  return (
    <Box flexDirection="column">
      <Text color="green" bold>
        assistant:{" "}
      </Text>
      {rendered.length > 0 && <Text>{rendered}</Text>}
      {raw.length > 0 && <Text>{raw}</Text>}
      {!isComplete ? <Text color="gray">{"▌"}</Text> : null}
    </Box>
  );
});
