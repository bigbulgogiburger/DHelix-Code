import { Box, Static, Text } from "ink";
import React, { useState, useEffect, useRef, useMemo } from "react";
import { type TurnActivity, type ActivityEntry } from "../../core/activity.js";
import { ToolCallBlock } from "./ToolCallBlock.js";
import { ReadGroupBlock, type ReadGroupEntry } from "./ReadGroupBlock.js";
import { StreamingMessage } from "./StreamingMessage.js";

interface ActivityFeedProps {
  readonly completedTurns: readonly TurnActivity[];
  readonly currentTurn?: TurnActivity | null;
  readonly isExpanded?: boolean;
}

/** Group consecutive file_read tool-complete entries for compact display */
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

/** Render a single activity entry */
function renderEntry(
  entry:
    | ActivityEntry
    | { readonly type: "read-group"; readonly entries: readonly ActivityEntry[] },
  isLive: boolean,
  allEntries: readonly ActivityEntry[],
  keyPrefix: string,
  isExpanded?: boolean,
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
          <Text color="green" bold>
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

    case "assistant-intermediate":
      return (
        <StreamingMessage
          key={keyPrefix}
          text={String(entry.data.content ?? "")}
          isComplete={true}
        />
      );

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

      const status =
        entry.type === "tool-start"
          ? ("running" as const)
          : entry.type === "tool-denied"
            ? ("denied" as const)
            : entry.data.isError
              ? ("error" as const)
              : ("complete" as const);

      return (
        <ToolCallBlock
          key={keyPrefix}
          name={String(entry.data.name ?? "")}
          status={status}
          args={entry.data.args as Record<string, unknown> | undefined}
          output={typeof entry.data.output === "string" ? entry.data.output : undefined}
          isExpanded={isExpanded}
          startTime={startTime}
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
 * ActivityFeed with progressive Static flushing.
 *
 * Completed entries are immediately moved to Ink's <Static> so they're
 * rendered once and never re-drawn. Only truly in-progress entries
 * (running tools, incomplete streaming text) stay in the dynamic area.
 *
 * This dramatically reduces the dynamic area size, minimizing flickering.
 */
export const ActivityFeed = React.memo(function ActivityFeed({
  completedTurns,
  currentTurn,
  isExpanded,
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
            renderEntry(entry, true, currentTurn?.entries ?? [], `live-${i}`, isExpanded),
          )}
        </Box>
      )}
    </>
  );
});
