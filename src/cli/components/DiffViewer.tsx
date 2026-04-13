/**
 * DiffViewer.tsx — 파일 변경사항을 인라인 diff로 표시하는 터미널 컴포넌트
 *
 * 두 텍스트(before/after) 사이의 차이를 unified diff 형태로 렌더링합니다.
 * 각 줄은 변경 유형(추가/삭제/컨텍스트)에 따라 색상이 구분되며,
 * 헝크 헤더와 파일 헤더도 함께 표시됩니다.
 *
 * 기능:
 * - diff 라이브러리를 사용한 정확한 diff 계산
 * - 파일 경로에서 언어 자동 감지
 * - 컨텍스트 줄 수 조정 (기본: 3줄)
 * - 줄번호 (원본/수정 양쪽 표시)
 * - Ink Text 기반 색상 렌더링 (red/green/dim/cyan)
 *
 * 사용 예시:
 * ```tsx
 * <DiffViewer
 *   filePath="src/main.ts"
 *   before={originalCode}
 *   after={modifiedCode}
 *   contextLines={3}
 * />
 * ```
 */
import { Box, Text } from "ink";
import { useMemo } from "react";

import { computeDiff, detectLanguage, formatLineNumber } from "./diff-utils.js";
import type { DiffHunk, DiffLine } from "./diff-utils.js";

/**
 * DiffViewer 컴포넌트의 props
 *
 * @param filePath - 표시할 파일 경로 (헤더 및 언어 감지에 사용)
 * @param before - 원본 파일 내용
 * @param after - 수정된 파일 내용
 * @param mode - 표시 모드: 'inline' 또는 'unified' (기본: 'inline')
 * @param contextLines - 변경 주변에 표시할 컨텍스트 줄 수 (기본: 3)
 * @param language - 구문 강조 언어 (생략 시 filePath에서 자동 감지)
 */
interface DiffViewerProps {
  readonly filePath: string;
  readonly before: string;
  readonly after: string;
  readonly mode?: "inline" | "unified";
  readonly contextLines?: number;
  readonly language?: string;
}

/**
 * 줄번호 표시에 필요한 자릿수를 계산합니다.
 * 최소 4자리를 보장합니다.
 *
 * @param hunks - DiffHunk 배열
 * @returns 줄번호 너비
 */
function computeLineNumberWidth(hunks: readonly DiffHunk[]): number {
  let maxLine = 0;
  for (const hunk of hunks) {
    for (const line of hunk.lines) {
      if (line.oldLineNumber !== undefined && line.oldLineNumber > maxLine) {
        maxLine = line.oldLineNumber;
      }
      if (line.newLineNumber !== undefined && line.newLineNumber > maxLine) {
        maxLine = line.newLineNumber;
      }
    }
  }
  return Math.max(4, String(maxLine).length);
}

/**
 * 개별 diff 줄을 렌더링하는 컴포넌트
 *
 * 변경 유형에 따라 다른 색상과 접두사를 적용합니다:
 * - 삭제 줄: red 텍스트 + "-" prefix
 * - 추가 줄: green 텍스트 + "+" prefix
 * - 컨텍스트 줄: dim 텍스트 + " " prefix
 */
function DiffLineRow({
  line,
  lineNumberWidth,
}: {
  readonly line: DiffLine;
  readonly lineNumberWidth: number;
}) {
  const oldNum = formatLineNumber(line.oldLineNumber, lineNumberWidth);
  const newNum = formatLineNumber(line.newLineNumber, lineNumberWidth);
  const gutter = `${oldNum} ${newNum}`;

  if (line.type === "remove") {
    return (
      <Text color="red">
        {gutter} - {line.content}
      </Text>
    );
  }

  if (line.type === "add") {
    return (
      <Text color="green">
        {gutter} + {line.content}
      </Text>
    );
  }

  return (
    <Text dimColor>
      {gutter} {line.content}
    </Text>
  );
}

/**
 * 개별 헝크를 렌더링하는 컴포넌트
 *
 * 헝크 헤더 (@@ -start,count +start,count @@)를 cyan으로 표시하고,
 * 이어서 각 줄을 DiffLineRow로 렌더링합니다.
 */
function HunkBlock({
  hunk,
  lineNumberWidth,
}: {
  readonly hunk: DiffHunk;
  readonly lineNumberWidth: number;
}) {
  return (
    <Box flexDirection="column">
      <Text color="cyan" dimColor>
        {hunk.header}
      </Text>
      {hunk.lines.map((line, index) => (
        <DiffLineRow
          key={`${line.type}-${line.oldLineNumber ?? 0}-${line.newLineNumber ?? 0}-${index}`}
          line={line}
          lineNumberWidth={lineNumberWidth}
        />
      ))}
    </Box>
  );
}

/**
 * 파일 변경사항을 터미널 인라인 diff로 표시하는 컴포넌트
 *
 * before와 after 텍스트를 비교하여 unified diff 형태로 렌더링합니다.
 * 변경이 없으면 "No changes" 메시지를 표시합니다.
 *
 * 렌더링 구조:
 * 1. 파일 헤더 (--- a/path, +++ b/path) — bold
 * 2. 언어 표시 (감지된 언어) — dim
 * 3. 각 헝크: 헤더(cyan) + 줄들(red/green/dim)
 */
export function DiffViewer({
  filePath,
  before,
  after,
  mode: _mode = "inline",
  contextLines = 3,
  language,
}: DiffViewerProps) {
  const resolvedLanguage = language ?? detectLanguage(filePath);

  const hunks = useMemo(
    () => computeDiff(before, after, contextLines),
    [before, after, contextLines],
  );

  if (hunks.length === 0) {
    return (
      <Box flexDirection="column" paddingX={1}>
        <Text dimColor>No changes in {filePath}</Text>
      </Box>
    );
  }

  const lineNumberWidth = computeLineNumberWidth(hunks);

  return (
    <Box flexDirection="column" paddingX={1}>
      {/* 파일 헤더 */}
      <Text bold color="red">
        --- a/{filePath}
      </Text>
      <Text bold color="green">
        +++ b/{filePath}
      </Text>
      {resolvedLanguage !== "text" ? <Text dimColor>Language: {resolvedLanguage}</Text> : null}

      {/* 빈 줄 구분 */}
      <Text> </Text>

      {/* 헝크들 */}
      {hunks.map((hunk, index) => (
        <HunkBlock key={`hunk-${index}`} hunk={hunk} lineNumberWidth={lineNumberWidth} />
      ))}
    </Box>
  );
}
