/**
 * ActivityFeed.tsx — 대화 활동(턴)을 표시하는 핵심 피드 컴포넌트
 *
 * 사용자 메시지, AI 응답, 도구 호출 결과 등 대화의 모든 활동을
 * 시간순으로 표시합니다. Ink의 <Static> 컴포넌트를 사용하여 완료된
 * 항목은 한 번만 렌더링하고 다시 그리지 않아 깜빡임을 최소화합니다.
 *
 * 주요 최적화:
 * - 완료된 항목 → Static 영역 (한 번 렌더링 후 고정)
 * - 진행 중인 항목 → 동적 영역 (실시간 업데이트)
 * - 연속 file_read → ReadGroupBlock으로 그룹화하여 간결하게 표시
 */
import { Box, Static, Text } from "ink";
import React, { useState, useEffect, useRef, useMemo } from "react";
import { type TurnActivity, type ActivityEntry } from "../../core/activity.js";
import { ToolCallBlock } from "./ToolCallBlock.js";
import { ReadGroupBlock, type ReadGroupEntry } from "./ReadGroupBlock.js";
import { StreamingMessage } from "./StreamingMessage.js";
import { ThinkingBlock } from "./ThinkingBlock.js";

/**
 * ActivityFeed 컴포넌트의 Props
 *
 * @param completedTurns - 완료된 대화 턴 목록 (Static 영역에 렌더링)
 * @param currentTurn - 현재 진행 중인 턴 (동적 영역에 렌더링)
 * @param isExpanded - true이면 도구 출력을 확장해서 보여줌 (Ctrl+O로 토글)
 */
interface ActivityFeedProps {
  readonly completedTurns: readonly TurnActivity[];
  readonly currentTurn?: TurnActivity | null;
  readonly isExpanded?: boolean;
  /** 실행 중인 도구의 실시간 출력 (toolCallId → accumulated output) */
  readonly streamingOutputs?: React.RefObject<Map<string, string>>;
}

/**
 * 연속된 file_read 도구 완료 항목을 하나의 그룹으로 묶어 간결하게 표시합니다.
 * 예: 5개 파일을 연속으로 읽었다면 "Read 5 files" 한 줄로 압축
 * 2개 미만이면 그룹화하지 않고 개별 표시합니다.
 */
export function groupConsecutiveReads(
  entries: readonly ActivityEntry[],
): readonly (
  | ActivityEntry
  | { readonly type: "read-group"; readonly entries: readonly ActivityEntry[] }
)[] {
  const result: (
    | ActivityEntry
    | { readonly type: "read-group"; readonly entries: readonly ActivityEntry[] }
  )[] = [];
  let readBuffer: ActivityEntry[] = [];

  const flushReads = () => {
    if (readBuffer.length >= 2) {
      result.push({ type: "read-group", entries: [...readBuffer] });
    } else {
      result.push(...readBuffer);
    }
    readBuffer = [];
  };

  for (const entry of entries) {
    const isReadTool = entry.type === "tool-complete" && entry.data.name === "file_read";

    if (isReadTool) {
      readBuffer.push(entry);
    } else {
      flushReads();
      result.push(entry);
    }
  }
  flushReads();
  return result;
}

/** 주어진 도구 ID와 일치하는 tool-complete 항목에서 메타데이터를 찾음 */
function findMetadata(
  entries: readonly ActivityEntry[],
  toolId: string | undefined,
): Readonly<Record<string, unknown>> | undefined {
  if (!toolId) return undefined;
  const completeEntry = entries.find((e) => e.type === "tool-complete" && e.data.id === toolId);
  return completeEntry?.data.metadata as Readonly<Record<string, unknown>> | undefined;
}

/**
 * 단일 활동 항목을 렌더링하는 함수
 *
 * 항목 타입에 따라 다른 컴포넌트를 반환합니다:
 * - user-message: 사용자 입력 (초록색 ">" 프롬프트)
 * - assistant-text: AI 응답 (마크다운 렌더링)
 * - assistant-intermediate: 중간 AI 응답 (도구 호출 사이의 텍스트)
 * - tool-start/tool-complete/tool-denied: 도구 호출 블록
 * - error: 에러 메시지 (빨간색)
 * - read-group: 그룹화된 파일 읽기 블록
 */
function renderEntry(
  entry:
    | ActivityEntry
    | { readonly type: "read-group"; readonly entries: readonly ActivityEntry[] },
  isLive: boolean,
  allEntries: readonly ActivityEntry[],
  keyPrefix: string,
  isExpanded?: boolean,
  streamingOutputs?: React.RefObject<Map<string, string>>,
): React.ReactNode {
  // Handle grouped reads
  if ("type" in entry && (entry as { readonly type: string }).type === "read-group") {
    const groupEntries = (
      entry as { readonly type: "read-group"; readonly entries: readonly ActivityEntry[] }
    ).entries;
    const readEntries: ReadGroupEntry[] = groupEntries.map((e) => {
      const filePath =
        typeof (e.data.args as Record<string, unknown>)?.file_path === "string"
          ? ((e.data.args as Record<string, unknown>).file_path as string)
          : "unknown";
      const outputStr = typeof e.data.output === "string" ? e.data.output : "";
      const lineCount = outputStr
        .trim()
        .split("\n")
        .filter((l: string) => l.length > 0).length;
      return { filePath, lineCount: lineCount > 0 ? lineCount : undefined };
    });
    return <ReadGroupBlock key={keyPrefix} entries={readEntries} isExpanded={isExpanded} />;
  }

  switch (entry.type) {
    case "user-message":
      return (
        <Box key={keyPrefix} marginBottom={0}>
          <Text color="#00E5FF" bold>
            {">"}{" "}
          </Text>
          <Text>{String(entry.data.content ?? "")}</Text>
        </Box>
      );

    case "assistant-text":
      return (
        <StreamingMessage
          key={keyPrefix}
          text={String(entry.data.content ?? "")}
          isComplete={!isLive || entry.data.isComplete === true}
        />
      );

    case "thinking":
      return (
        <ThinkingBlock
          key={keyPrefix}
          content={String(entry.data.content ?? "")}
          isStreaming={entry.data.isStreaming === true}
          isExpanded={isExpanded}
        />
      );

    case "assistant-intermediate": {
      const intermediateText = String(entry.data.content ?? "");
      if (!intermediateText) return null;
      return (
        <Box key={keyPrefix} marginY={0}>
          <Text color="cyan">{"⏺ "}</Text>
          <Text>{intermediateText}</Text>
        </Box>
      );
    }

    case "tool-start":
    case "tool-complete":
    case "tool-denied": {
      const toolId = typeof entry.data.id === "string" ? entry.data.id : undefined;
      const startEntry = toolId
        ? allEntries.find((e) => e.type === "tool-start" && e.data.id === toolId)
        : undefined;
      const startTime =
        entry.type === "tool-start"
          ? typeof entry.data.startTime === "number"
            ? entry.data.startTime
            : undefined
          : typeof startEntry?.data.startTime === "number"
            ? startEntry.data.startTime
            : undefined;

      const metadata =
        entry.type === "tool-start"
          ? findMetadata(allEntries, toolId)
          : (entry.data.metadata as Readonly<Record<string, unknown>> | undefined);

      const status =
        entry.type === "tool-start"
          ? ("running" as const)
          : entry.type === "tool-denied"
            ? ("denied" as const)
            : entry.data.isError
              ? ("error" as const)
              : ("complete" as const);

      // Look up streaming output for running tools
      const streamingOutput =
        status === "running" && toolId && streamingOutputs?.current
          ? streamingOutputs.current.get(toolId)
          : undefined;

      return (
        <ToolCallBlock
          key={keyPrefix}
          name={String(entry.data.name ?? "")}
          status={status}
          args={entry.data.args as Record<string, unknown> | undefined}
          output={typeof entry.data.output === "string" ? entry.data.output : undefined}
          isExpanded={isExpanded}
          startTime={startTime}
          metadata={metadata}
          streamingOutput={streamingOutput}
        />
      );
    }

    case "error":
      return (
        <Box key={keyPrefix} marginLeft={2}>
          <Text color="red">{String(entry.data.message ?? "Unknown error")}</Text>
        </Box>
      );

    default:
      return null;
  }
}

interface FlushedItem {
  readonly key: string;
  readonly node: React.ReactNode;
}

/**
 * 점진적 Static 플러싱을 사용하는 ActivityFeed 컴포넌트
 *
 * 완료된 항목은 즉시 Ink의 <Static>으로 이동하여 한 번만 렌더링합니다.
 * 실행 중인 도구나 미완성 스트리밍 텍스트만 동적 영역에 남습니다.
 * 이 방식으로 동적 영역 크기를 극적으로 줄여 깜빡임을 최소화합니다.
 *
 * 동작 원리:
 * 1. completedTurns가 증가하면 → 새 턴의 항목들을 Static으로 플러시
 * 2. currentTurn의 항목이 완료되면 → 즉시 Static으로 이동
 * 3. 아직 완료되지 않은 항목만 → 동적 영역(liveEntries)에 표시
 */
export const ActivityFeed = React.memo(function ActivityFeed({
  completedTurns,
  currentTurn,
  isExpanded,
  streamingOutputs,
}: ActivityFeedProps) {
  // Monotonically increasing ID for Static items — ensures append-only
  const nextIdRef = useRef(0);

  // Set of entry objects already flushed to Static (identity-based)
  const flushedSetRef = useRef(new WeakSet<ActivityEntry>());

  // Track how many completed turns we've already processed
  const processedTurnCountRef = useRef(0);

  // The accumulated Static items — only ever grows
  const [staticItems, setStaticItems] = useState<FlushedItem[]>([]);

  // Flush newly completed turns (turns that moved from current → completed)
  useEffect(() => {
    if (completedTurns.length <= processedTurnCountRef.current) return;

    const newItems: FlushedItem[] = [];

    for (let t = processedTurnCountRef.current; t < completedTurns.length; t++) {
      const turn = completedTurns[t];
      for (const entry of turn.entries) {
        // Skip entries already flushed from live tracking
        if (flushedSetRef.current.has(entry)) continue;
        flushedSetRef.current.add(entry);

        const id = nextIdRef.current++;
        const node = renderEntry(entry, false, turn.entries, `s-${id}`, isExpanded);
        if (node) {
          newItems.push({ key: `s-${id}`, node });
        }
      }
      // Add spacing between turns
      const spacerId = nextIdRef.current++;
      newItems.push({
        key: `spacer-${spacerId}`,
        node: <Text key={`spacer-${spacerId}`}>{""}</Text>,
      });
    }

    processedTurnCountRef.current = completedTurns.length;

    if (newItems.length > 0) {
      setStaticItems((prev) => [...prev, ...newItems]);
    }
  }, [completedTurns]);

  // Flush completed entries from the CURRENT turn as they finish
  useEffect(() => {
    if (!currentTurn) return;

    // Determine which tool IDs have a corresponding completion entry
    const completedToolIds = new Set<string>();
    for (const entry of currentTurn.entries) {
      if (
        (entry.type === "tool-complete" || entry.type === "tool-denied") &&
        typeof entry.data.id === "string"
      ) {
        completedToolIds.add(entry.data.id);
      }
    }

    const newItems: FlushedItem[] = [];

    for (const entry of currentTurn.entries) {
      if (flushedSetRef.current.has(entry)) continue;

      const isComplete =
        entry.type === "user-message" ||
        entry.type === "error" ||
        entry.type === "assistant-intermediate" ||
        entry.type === "tool-complete" ||
        entry.type === "tool-denied" ||
        (entry.type === "assistant-text" && entry.data.isComplete === true) ||
        (entry.type === "thinking" && entry.data.isComplete === true) ||
        // tool-start whose tool has already completed
        (entry.type === "tool-start" &&
          typeof entry.data.id === "string" &&
          completedToolIds.has(entry.data.id));

      if (isComplete) {
        flushedSetRef.current.add(entry);
        const id = nextIdRef.current++;
        const node = renderEntry(entry, false, currentTurn.entries, `s-${id}`, isExpanded);
        if (node) {
          newItems.push({ key: `s-${id}`, node });
        }
      }
    }

    if (newItems.length > 0) {
      setStaticItems((prev) => [...prev, ...newItems]);
    }
  }, [currentTurn]);

  // Live entries: only in-progress items from current turn (dynamic area)
  const liveEntries = useMemo(() => {
    if (!currentTurn) return [];
    return currentTurn.entries.filter((entry) => !flushedSetRef.current.has(entry));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentTurn, staticItems]); // staticItems dependency ensures re-filter after flush

  return (
    <>
      <Static items={staticItems}>
        {(item) => (
          <Box key={item.key} flexDirection="column">
            {item.node}
          </Box>
        )}
      </Static>
      {liveEntries.length > 0 && (
        <Box flexDirection="column" marginBottom={1}>
          {liveEntries.map((entry, i) =>
            renderEntry(entry, true, currentTurn?.entries ?? [], `live-${i}`, isExpanded, streamingOutputs),
          )}
        </Box>
      )}
    </>
  );
});
