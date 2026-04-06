/**
 * StreamingMessage.tsx — LLM 응답을 실시간으로 스트리밍 표시하는 컴포넌트
 *
 * LLM이 응답을 생성하는 동안 텍스트가 한 글자씩 추가되는 것을 보여줍니다.
 * 완료된 부분은 마크다운으로 렌더링하고, 아직 작성 중인 부분은
 * 원시 텍스트로 표시합니다. 미완성 상태에서는 커서(▌)가 깜빡입니다.
 *
 * 점진적 마크다운 렌더링:
 * - 완료된 코드 블록(```...```)과 문단은 마크다운으로 변환
 * - 미완성 코드 블록이나 마지막 문단은 원시 텍스트로 유지
 */
import { Text, Box } from "ink";
import React, { useMemo } from "react";
import { renderMarkdown, hasMarkdown } from "../renderer/markdown.js";

/**
 * @param text - 표시할 텍스트 (스트리밍 중 점진적으로 증가)
 * @param isComplete - 스트리밍 완료 여부 (true이면 커서 숨김)
 * @param enableMarkdown - 마크다운 렌더링 활성화 여부 (기본값: true)
 */
interface StreamingMessageProps {
  readonly text: string;
  readonly isComplete: boolean;
  readonly enableMarkdown?: boolean;
}

/**
 * 스트리밍 텍스트를 렌더링 가능한(완료된) 부분과 원시(미완성) 부분으로 분리합니다.
 *
 * 코드 블록(```)의 쌍이 맞는지 확인하여:
 * - 미완성 코드 블록이 있으면 → 마지막 ``` 기준으로 분리
 * - 코드 블록이 완성되었으면 → 마지막 빈 줄(문단 경계) 기준으로 분리
 *
 * 이렇게 하면 완성된 부분만 마크다운 렌더링이 적용되어
 * 스트리밍 중에도 안정적인 표시가 가능합니다.
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

/** 스트리밍 어시스턴트 메시지 — 점진적 마크다운 렌더링으로 실시간 표시 */
export const StreamingMessage = React.memo(function StreamingMessage({
  text,
  isComplete,
  enableMarkdown = true,
}: StreamingMessageProps) {
  const { rendered, raw } = useMemo(() => {
    if (!text) {
      return { rendered: "", raw: "" };
    }
    if (!enableMarkdown || !hasMarkdown(text)) {
      return { rendered: "", raw: text };
    }
    if (isComplete) {
      return { rendered: renderMarkdown(text), raw: "" };
    }
    return partialRenderMarkdown(text);
  }, [text, isComplete, enableMarkdown]);

  if (!text) {
    return null;
  }

  return (
    <Box flexDirection="column">
      {rendered.length > 0 && <Text>{rendered}</Text>}
      {raw.length > 0 && <Text>{raw}</Text>}
      {!isComplete ? <Text color="gray">{"▌"}</Text> : null}
    </Box>
  );
});
