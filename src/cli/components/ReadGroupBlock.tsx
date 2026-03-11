import React from "react";
import { Box, Text } from "ink";

export interface ReadGroupEntry {
  readonly filePath: string;
  readonly lineCount?: number;
}

export interface ReadGroupBlockProps {
  readonly entries: readonly ReadGroupEntry[];
  readonly isExpanded?: boolean;
}

/** Shorten path for display */
function shortenPath(filePath: string, maxLen = 50): string {
  if (filePath.length <= maxLen) return filePath;
  const parts = filePath.split("/");
  const filename = parts[parts.length - 1];
  if (parts.length <= 2) return filePath;
  return `…/${parts[parts.length - 2]}/${filename}`;
}

export const ReadGroupBlock = React.memo(function ReadGroupBlock({
  entries,
  isExpanded = false,
}: ReadGroupBlockProps) {
  const count = entries.length;
  const fileWord = count === 1 ? "file" : "files";

  return (
    <Box flexDirection="column" marginLeft={2}>
      {/* Header */}
      <Box>
        <Text bold color="blue">
          Read {count} {fileWord}
        </Text>
      </Box>

      {/* Tree connector + file list */}
      {isExpanded ? (
        // Expanded: show each file with line count
        <Box flexDirection="column" marginLeft={1}>
          {entries.map((entry, i) => (
            <Box key={i}>
              <Text dimColor>{i === 0 ? "⎿  " : "   "}</Text>
              <Text>{shortenPath(entry.filePath)}</Text>
              {entry.lineCount != null && <Text dimColor> ({entry.lineCount} lines)</Text>}
            </Box>
          ))}
        </Box>
      ) : (
        // Collapsed: compact list
        <Box marginLeft={1}>
          <Text dimColor>⎿ </Text>
          <Text>
            {entries.length <= 3
              ? entries.map((e) => shortenPath(e.filePath, 30)).join(", ")
              : entries
                  .slice(0, 3)
                  .map((e) => shortenPath(e.filePath, 30))
                  .join(", ") + `, +${entries.length - 3} more`}
          </Text>
        </Box>
      )}
    </Box>
  );
});
