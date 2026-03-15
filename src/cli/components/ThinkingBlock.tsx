/**
 * ThinkingBlock.tsx — LLM의 확장 사고(Extended Thinking) 내용을 표시하는 컴포넌트
 *
 * Claude 등 일부 모델이 지원하는 "확장 사고" 기능의 출력을 보여줍니다.
 * 기본적으로 "Thinking..." 한 줄로 축소되지만, Ctrl+O(상세 모드)로
 * 확장하면 사고 내용을 최대 20줄까지 표시합니다.
 *
 * 스트리밍 중에는 ASCII 스피너(|, /, -, \)가 회전합니다.
 */
import React, { useState, useEffect } from "react";
import { Box, Text } from "ink";

/** 사고 중 표시되는 ASCII 스피너 프레임 */
const THINKING_SPINNER_FRAMES = ["|", "/", "-", "\\"];
/** 스피너 프레임 전환 간격 (200ms) */
const THINKING_SPINNER_INTERVAL_MS = 200;

/**
 * @param content - 사고 내용 텍스트
 * @param tokenCount - 사고에 사용된 토큰 수 (선택적)
 * @param isExpanded - 확장 표시 여부 (기본값: false, 축소)
 * @param isStreaming - 현재 사고 스트리밍 중 여부 (true이면 스피너 표시)
 */
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
