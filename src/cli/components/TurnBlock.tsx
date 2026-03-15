/**
 * TurnBlock.tsx — 하나의 대화 턴(사용자 입력 + AI 응답)을 표시하는 컴포넌트
 *
 * "턴"이란 사용자가 메시지를 보내고 에이전트가 응답을 완료하기까지의
 * 한 사이클을 의미합니다. 한 턴에는 사용자 메시지, AI 텍스트 응답,
 * 도구 호출(여러 개), 에러 등 여러 항목이 포함될 수 있습니다.
 *
 * 참고: 현재는 ActivityFeed가 대부분의 표시를 담당하지만,
 * TurnBlock은 단일 턴을 독립적으로 렌더링할 때 사용됩니다.
 */
import { Box, Text } from "ink";
import React from "react";
import { type TurnActivity, type ActivityEntry } from "../../core/activity.js";
import { ToolCallBlock } from "./ToolCallBlock.js";
import { StreamingMessage } from "./StreamingMessage.js";

/**
 * @param turn - 표시할 대화 턴 데이터 (entries 배열 포함)
 * @param isLive - 현재 진행 중인 턴인지 여부 (스트리밍 표시에 영향)
 * @param isExpanded - 도구 출력을 확장해서 보여줄지 여부
 */
interface TurnBlockProps {
  readonly turn: TurnActivity;
  readonly isLive?: boolean;
  readonly isExpanded?: boolean;
}

/** 활동 항목의 타입에서 도구 상태를 결정 (tool-start→running, tool-complete→complete/error 등) */
function getToolStatus(entry: ActivityEntry): "running" | "complete" | "error" | "denied" {
  switch (entry.type) {
    case "tool-start":
      return "running";
    case "tool-complete":
      return entry.data.isError ? "error" : "complete";
    case "tool-denied":
      return "denied";
    default:
      return "complete";
  }
}

/** 주어진 도구 ID의 시작 시간을 entries에서 찾아 반환 (소요시간 계산용) */
function findStartTime(
  entries: readonly ActivityEntry[],
  toolId: string | undefined,
): number | undefined {
  if (!toolId) return undefined;
  const startEntry = entries.find((e) => e.type === "tool-start" && e.data.id === toolId);
  return typeof startEntry?.data.startTime === "number" ? startEntry.data.startTime : undefined;
}

/** 주어진 도구 ID의 메타데이터를 tool-complete 항목에서 찾아 반환 */
function findMetadata(
  entries: readonly ActivityEntry[],
  toolId: string | undefined,
): Readonly<Record<string, unknown>> | undefined {
  if (!toolId) return undefined;
  const completeEntry = entries.find((e) => e.type === "tool-complete" && e.data.id === toolId);
  return completeEntry?.data.metadata as Readonly<Record<string, unknown>> | undefined;
}

/**
 * 단일 활동 항목을 적절한 React 컴포넌트로 렌더링
 * 항목 타입(user-message, assistant-text, tool-start 등)에 따라 분기합니다.
 */
function renderEntry(
  entry: ActivityEntry,
  index: number,
  isLive: boolean,
  allEntries: readonly ActivityEntry[],
  isExpanded?: boolean,
): React.ReactNode {
  switch (entry.type) {
    case "user-message":
      return (
        <Box key={`entry-${index}`} marginBottom={0}>
          <Text color="green" bold>
            {">"}{" "}
          </Text>
          <Text>{String(entry.data.content ?? "")}</Text>
        </Box>
      );

    case "assistant-text":
      return (
        <StreamingMessage
          key={`entry-${index}`}
          text={String(entry.data.content ?? "")}
          isComplete={!isLive || entry.data.isComplete === true}
        />
      );

    case "assistant-intermediate":
      return (
        <StreamingMessage
          key={`entry-${index}`}
          text={String(entry.data.content ?? "")}
          isComplete={true}
        />
      );

    case "tool-start":
    case "tool-complete":
    case "tool-denied": {
      const toolId = typeof entry.data.id === "string" ? entry.data.id : undefined;
      const startTime =
        entry.type === "tool-start"
          ? typeof entry.data.startTime === "number"
            ? entry.data.startTime
            : undefined
          : findStartTime(allEntries, toolId);

      // For tool-start, find metadata from the matching tool-complete entry
      const metadata =
        entry.type === "tool-start"
          ? findMetadata(allEntries, toolId)
          : (entry.data.metadata as Readonly<Record<string, unknown>> | undefined);

      return (
        <ToolCallBlock
          key={`entry-${index}`}
          name={String(entry.data.name ?? "")}
          status={getToolStatus(entry)}
          args={entry.data.args as Record<string, unknown> | undefined}
          output={typeof entry.data.output === "string" ? entry.data.output : undefined}
          metadata={metadata}
          isExpanded={isExpanded}
          startTime={startTime}
        />
      );
    }

    case "error":
      return (
        <Box key={`entry-${index}`} marginLeft={2}>
          <Text color="red">{String(entry.data.message ?? "Unknown error")}</Text>
        </Box>
      );

    default:
      return null;
  }
}

/** 단일 턴을 렌더링 — 사용자 메시지 + AI 응답 + 도구 호출을 세로로 나열 */
export const TurnBlock = React.memo(function TurnBlock({
  turn,
  isLive = false,
  isExpanded,
}: TurnBlockProps) {
  return (
    <Box flexDirection="column" marginBottom={1}>
      {turn.entries.map((entry, i) => renderEntry(entry, i, isLive, turn.entries, isExpanded))}
    </Box>
  );
});
