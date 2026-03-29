/**
 * ReadGroupBlock.tsx — 여러 파일 읽기를 하나의 그룹으로 압축하여 표시하는 컴포넌트
 *
 * 에이전트가 여러 파일을 연속으로 읽을 때, 각각을 개별 표시하면
 * 화면이 너무 길어집니다. 이 컴포넌트는 "Read 5 files" 처럼
 * 하나의 블록으로 압축하여 보여줍니다.
 *
 * 표시 모드:
 * - 축소 모드(기본): "Read 5 files" + 파일명 3개 + "+2 more"
 * - 확장 모드(Ctrl+O): 모든 파일명과 줄 수를 트리 형태로 표시
 */
import React from "react";
import { Box, Text } from "ink";

/**
 * 읽기 그룹의 개별 파일 항목
 * @param filePath - 파일 경로
 * @param lineCount - 읽은 줄 수 (선택적)
 */
export interface ReadGroupEntry {
  readonly filePath: string;
  readonly lineCount?: number;
}

/**
 * @param entries - 그룹화된 파일 읽기 항목 배열
 * @param isExpanded - 확장 모드 여부 (Ctrl+O로 토글)
 */
export interface ReadGroupBlockProps {
  readonly entries: readonly ReadGroupEntry[];
  readonly isExpanded?: boolean;
}

/** 긴 파일 경로를 축약하여 표시 — 예: "…/components/App.tsx" */
function shortenPath(filePath: string, maxLen = 50): string {
  if (filePath.length <= maxLen) return filePath;
  const parts = filePath.split("/");
  const filename = parts[parts.length - 1];
  if (parts.length <= 2) return filePath;
  return `…/${parts[parts.length - 2]}/${filename}`;
}

/**
 * 파일 읽기 그룹 블록 — 헤더("Read N files")와 파일 목록을 표시
 * 확장 모드에서는 트리 커넥터(⎿)로 파일 목록을 연결합니다.
 */
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
        <Text bold color="cyan">
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
