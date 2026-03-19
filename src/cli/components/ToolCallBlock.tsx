/**
 * ToolCallBlock.tsx — 도구 호출 결과를 리치하게 표시하는 블록 컴포넌트
 *
 * 에이전트가 도구(file_read, bash_exec, file_edit 등)를 호출할 때의
 * 상태와 결과를 시각적으로 표시합니다. tool-display.ts의 렌더러를 사용하여
 * 각 도구에 맞는 의미 있는 헤더와 미리보기를 생성합니다.
 *
 * 표시 구조:
 * [스피너/아이콘] 동사 인수 (소요시간)
 *  ⎿  서브텍스트 (추가 정보)
 *     [diff 미리보기 또는 출력 요약]
 *
 * 상태별 표시:
 * - running: 노란색 스피너 + "Reading"/"Running" 등
 * - complete: 성공 아이콘 + "Read"/"Ran" 등
 * - error: 빨간색 ✗ + 에러 정보
 * - denied: 빨간색 ! + 거부 메시지
 */
import React, { useState, useEffect } from "react";
import { Box, Text } from "ink";

import {
  getToolHeaderInfo,
  getToolPreview,
  formatDuration,
  SPINNER_FRAMES,
} from "../renderer/tool-display.js";

/**
 * ToolCallBlock 컴포넌트의 Props
 *
 * @param name - 도구 이름 (예: "file_read", "bash_exec")
 * @param status - 현재 상태 ("running" | "complete" | "error" | "denied")
 * @param args - 도구에 전달된 인수 (파일 경로, 명령어 등)
 * @param output - 도구 실행 결과 출력 문자열
 * @param metadata - 도구 실행에 대한 추가 메타데이터 (줄 수, 종료 코드 등)
 * @param isExpanded - 출력을 확장해서 보여줄지 여부 (Ctrl+O)
 * @param startTime - 도구 실행 시작 시간 (소요시간 계산용, Date.now() 값)
 * @param streamingOutput - 장시간 실행 도구(bash_exec 등)의 실시간 출력
 */
interface ToolCallBlockProps {
  readonly name: string;
  readonly status: "running" | "complete" | "error" | "denied";
  readonly args?: Record<string, unknown>;
  readonly output?: string;
  readonly metadata?: Readonly<Record<string, unknown>>;
  readonly isExpanded?: boolean;
  readonly startTime?: number;
  /** 장시간 실행 도구의 실시간 스트리밍 출력 */
  readonly streamingOutput?: string;
}

/** 스피너 애니메이션 훅 — active가 true일 때 500ms 간격으로 프레임 순환 */
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

/** diff 한 줄을 줄 번호, 마커(+/-/공백), 내용으로 파싱 */
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

/** file_edit의 diff 미리보기를 색상 있는 +/- 줄로 렌더링 (초록=추가, 빨강=삭제) */
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

/**
 * MCP 에러 출력에서 "[Debug] Arguments sent:" 이후의 JSON 인수를 추출합니다.
 * 디버그 정보가 없으면 undefined를 반환합니다.
 *
 * @param output - 도구의 에러 출력 문자열
 * @returns { message, argsPreview } 또는 undefined
 */
function parseMCPDebugError(
  output: string,
): { readonly message: string; readonly argsPreview: string } | undefined {
  const debugMarker = "[Debug] Arguments sent: ";
  const debugIndex = output.indexOf(debugMarker);
  if (debugIndex < 0) return undefined;

  const message = output.slice(0, debugIndex).trim();
  const argsPreview = output.slice(debugIndex + debugMarker.length).trim();
  return { message, argsPreview };
}

/**
 * 리치 도구 호출 표시 블록 — 의미 있는 헤더와 트리 커넥터(⎿)로 계층 표현
 * tool-display.ts의 getToolHeaderInfo/getToolPreview를 사용하여
 * 각 도구 유형에 맞는 동사, 인수, 서브텍스트, 미리보기를 생성합니다.
 *
 * MCP 도구 지원:
 * - metadata.serverName이 있으면 헤더에 [serverName] 접두사 표시
 * - metadata.truncated가 true이면 출력 잘림 경고 표시
 * - MCP 에러의 [Debug] Arguments sent: 정보를 구조화하여 표시
 */
export const ToolCallBlock = React.memo(function ToolCallBlock({
  name,
  status,
  args,
  output,
  metadata,
  isExpanded = false,
  startTime,
  streamingOutput,
}: ToolCallBlockProps) {
  const spinnerChar = useSpinner(status === "running");
  const duration = startTime && status !== "running" ? Date.now() - startTime : undefined;
  const headerInfo = getToolHeaderInfo(name, status, args, output, duration, metadata);
  const preview = getToolPreview(name, status, args, output, metadata);

  // Determine header color override for error/denied
  const effectiveColor = status === "error" || status === "denied" ? "red" : headerInfo.color;

  // MCP server name from metadata — displayed as [serverName] prefix in header
  const mcpServerName =
    metadata && typeof metadata.serverName === "string" ? metadata.serverName : undefined;

  // MCP truncation flag — when output exceeded token limit
  const isTruncated = metadata?.truncated === true;

  // MCP error debug info — extract structured args preview from error output
  const mcpDebugInfo =
    status === "error" && output && mcpServerName ? parseMCPDebugError(output) : undefined;

  // Build header text with optional MCP server prefix
  const headerText = mcpServerName ? `[${mcpServerName}] ${headerInfo.header}` : headerInfo.header;

  return (
    <Box flexDirection="column" marginLeft={2}>
      {/* Header row: [spinner/icon] [serverName] Verb arg (duration) */}
      <Box>
        {status === "running" && <Text color="yellow">{spinnerChar} </Text>}
        {status === "error" && <Text color="red">{"\u2717"} </Text>}
        {status === "denied" && <Text color="red">! </Text>}
        <Text bold color={effectiveColor}>
          {headerText}
        </Text>
        {duration && status !== "running" && <Text dimColor> ({formatDuration(duration)})</Text>}
      </Box>

      {/* Subtext row with tree connector ⎿ */}
      {headerInfo.subtext && (
        <Box marginLeft={1}>
          <Text dimColor>{"⎿  "}</Text>
          <Text>{headerInfo.subtext}</Text>
        </Box>
      )}

      {/* MCP truncation warning — shown when output was cut off */}
      {isTruncated && (
        <Box marginLeft={1}>
          <Text dimColor>{"⎿  "}</Text>
          <Text color="yellow">{"[Output truncated — exceeded token limit]"}</Text>
        </Box>
      )}

      {/* MCP error with debug args — show error message and dimmed args preview */}
      {mcpDebugInfo && (
        <Box marginLeft={4} flexDirection="column">
          <Text color="red">{mcpDebugInfo.message}</Text>
          <Text dimColor>
            {"Arguments: "}
            {mcpDebugInfo.argsPreview}
          </Text>
        </Box>
      )}

      {/* Live streaming output during execution */}
      {status === "running" && streamingOutput && (
        <Box marginLeft={4} flexDirection="column">
          {streamingOutput
            .split("\n")
            .slice(-8)
            .map((line, i) => (
              <Text key={i} color="gray" wrap="truncate-end">
                {line}
              </Text>
            ))}
        </Box>
      )}

      {/* Diff preview — always shown when available */}
      {preview ? <DiffPreview preview={preview} /> : null}

      {/* Collapsed output preview — show first 3 lines when not expanded */}
      {/* Skip collapsed preview when MCP debug info is already shown */}
      {/* .env 등 민감 파일: metadata.displayOutput(마스킹 버전)을 우선 표시 */}
      {!isExpanded &&
        !preview &&
        !mcpDebugInfo &&
        output &&
        status !== "running" &&
        (() => {
          const displayText = (
            typeof metadata?.displayOutput === "string" ? metadata.displayOutput : output
          ).trim();
          const lines = displayText.split("\n");
          const max = 3;
          const shown = lines.slice(0, max);
          const hidden = lines.length - max;
          return (
            <Box marginLeft={4} flexDirection="column">
              {shown.map((line, i) => (
                <Text key={i} color="gray" wrap="truncate-end">
                  {line}
                </Text>
              ))}
              {hidden > 0 && (
                <Text dimColor>
                  {"  … +"}
                  {hidden}
                  {" lines (ctrl+o to show all)"}
                </Text>
              )}
            </Box>
          );
        })()}

      {/* Raw output fallback — only when expanded and no diff */}
      {/* .env 등 민감 파일: 확장 표시에서도 마스킹 버전 사용 */}
      {isExpanded && output && !preview ? (
        <Box marginLeft={4}>
          <Text color="gray" wrap="truncate-end">
            {(() => {
              const displayText =
                typeof metadata?.displayOutput === "string" ? metadata.displayOutput : output;
              return displayText.length > 2000 ? displayText.slice(0, 2000) + "..." : displayText;
            })()}
          </Text>
        </Box>
      ) : null}
    </Box>
  );
});
